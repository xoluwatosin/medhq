
ALTER TABLE public.mu_documents ADD COLUMN IF NOT EXISTS hold_reason text;

-- Dates on documents arrive as 2027-07-01, 2027-07 or 2027. Read what we can.
CREATE OR REPLACE FUNCTION public.mu_loose_date(_t text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE s text := btrim(coalesce(_t,''));
BEGIN
  IF s = '' THEN RETURN NULL; END IF;
  IF s ~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN s::date; END IF;
  IF s ~ '^\d{4}-\d{2}$' THEN RETURN (s || '-01')::date; END IF;
  IF s ~ '^\d{4}$' THEN RETURN (s || '-01-01')::date; END IF;
  BEGIN RETURN s::date; EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
END;
$$;

-- What the system may decide on its own, and what it must leave to a person.
CREATE OR REPLACE FUNCTION public.mu_document_verdict(_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  d public.mu_documents;
  e public.mu_document_extractions;
  t public.mu_document_types;
  kind text;
  expiry date;
  q jsonb;
BEGIN
  SELECT * INTO d FROM public.mu_documents WHERE id = _document_id;
  IF d.id IS NULL THEN RETURN jsonb_build_object('action','hold','reason','Document not found'); END IF;

  SELECT * INTO e FROM public.mu_document_extractions x
   WHERE x.document_id = _document_id ORDER BY x.created_at DESC LIMIT 1;

  IF e.id IS NULL THEN
    RETURN jsonb_build_object('action','wait','reason','Not read yet');
  END IF;

  IF coalesce(e.error,'') <> '' THEN
    RETURN jsonb_build_object('action','hold','ask',true,'reason','We could not open or read this copy.');
  END IF;

  q := coalesce(e.extraction->'quality', e.quality, '{}'::jsonb);
  kind := coalesce(e.doc_type, d.doc_kind, 'other');

  IF coalesce(q->>'readable','true') = 'false' THEN
    RETURN jsonb_build_object('action','hold','ask',true,'reason','The copy we hold is not clear enough to read.');
  END IF;

  IF coalesce(q->>'belongs_to_holder','true') = 'false' THEN
    RETURN jsonb_build_object('action','hold','ask',true,
      'reason','The name on this document does not match the name on the profile.');
  END IF;

  IF e.classification_confidence < 0.85 OR kind = 'other' THEN
    RETURN jsonb_build_object('action','hold','ask',false,
      'reason','We cannot tell with confidence what this document is.');
  END IF;

  SELECT * INTO t FROM public.mu_document_types WHERE code = kind;

  expiry := public.mu_loose_date(coalesce(
    e.extraction->'credential'->'expiry_date'->>'value',
    e.extraction->'training'->'expiry_date'->>'value',
    e.extraction->'identity'->'expiry_date'->>'value',
    e.extraction->'check'->'expiry_date'->>'value'
  ));

  IF expiry IS NOT NULL AND expiry < current_date THEN
    RETURN jsonb_build_object('action','hold','ask',true,'kind',kind,
      'reason','This document expired on ' || to_char(expiry,'DD Mon YYYY') || '.');
  END IF;

  IF kind = 'practising_licence' AND expiry IS NULL THEN
    RETURN jsonb_build_object('action','hold','ask',true,'kind',kind,
      'reason','We cannot see an expiry date on this licence.');
  END IF;

  RETURN jsonb_build_object('action','accept','kind',kind,'expires_at',expiry,
                            'evidences', coalesce(to_jsonb(t.evidences), '[]'::jsonb));
END;
$$;

-- Settle everything the logic can settle. Anything else keeps its hold reason
-- and, where only the candidate can fix it, becomes a request in their portal.
CREATE OR REPLACE FUNCTION public.mu_autosettle_documents(_limit integer DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record; v jsonb; ev text; accepted int := 0; held int := 0; asked int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  FOR r IN
    SELECT d.id, d.person_id FROM public.mu_documents d
     WHERE d.review_outcome = 'pending'
     ORDER BY d.created_at ASC
     LIMIT least(coalesce(_limit,500), 2000)
  LOOP
    v := public.mu_document_verdict(r.id);

    IF v->>'action' = 'accept' THEN
      UPDATE public.mu_documents
         SET review_outcome = 'accepted',
             hold_reason = NULL,
             review_reason = NULL,
             reviewed_at = now(),
             expires_at = coalesce(public.mu_loose_date(v->>'expires_at'), expires_at)
       WHERE id = r.id;

      FOR ev IN SELECT jsonb_array_elements_text(coalesce(v->'evidences','[]'::jsonb)) LOOP
        BEGIN
          PERFORM public.mu_attach_credential_document(r.person_id, ev, r.id, 'document');
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END LOOP;

      INSERT INTO public.mu_activity (person_id, actor_name, action, detail)
      VALUES (r.person_id, 'System', 'document_auto_accepted',
              jsonb_build_object('document_id', r.id, 'kind', v->>'kind'));
      accepted := accepted + 1;

    ELSIF v->>'action' = 'hold' THEN
      UPDATE public.mu_documents SET hold_reason = v->>'reason' WHERE id = r.id;
      held := held + 1;

      IF coalesce((v->>'ask')::boolean, false) THEN
        BEGIN
          PERFORM public.mu_request_documents(
            r.person_id,
            ARRAY[coalesce(v->>'kind','other')]::text[],
            v->>'reason' || ' Please upload a clear, current copy.',
            (current_date + 14)
          );
          asked := asked + 1;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('accepted', accepted, 'held', held, 'asked', asked);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mu_autosettle_documents(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_document_verdict(uuid) TO authenticated;

-- The moment a document has been read, settle it.
CREATE OR REPLACE FUNCTION public.mu_settle_after_read()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v jsonb; ev text;
BEGIN
  v := public.mu_document_verdict(NEW.document_id);
  IF v->>'action' = 'accept' THEN
    UPDATE public.mu_documents
       SET review_outcome = 'accepted', hold_reason = NULL, reviewed_at = now(),
           expires_at = coalesce(public.mu_loose_date(v->>'expires_at'), expires_at)
     WHERE id = NEW.document_id AND review_outcome = 'pending';
    FOR ev IN SELECT jsonb_array_elements_text(coalesce(v->'evidences','[]'::jsonb)) LOOP
      BEGIN
        PERFORM public.mu_attach_credential_document(NEW.person_id, ev, NEW.document_id, 'document');
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END LOOP;
  ELSIF v->>'action' = 'hold' THEN
    UPDATE public.mu_documents SET hold_reason = v->>'reason'
     WHERE id = NEW.document_id AND review_outcome = 'pending';
    IF coalesce((v->>'ask')::boolean, false) THEN
      BEGIN
        PERFORM public.mu_request_documents(NEW.person_id, ARRAY[coalesce(v->>'kind','other')]::text[],
          v->>'reason' || ' Please upload a clear, current copy.', (current_date + 14));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mu_settle_after_read ON public.mu_document_extractions;
CREATE TRIGGER mu_settle_after_read
AFTER INSERT OR UPDATE ON public.mu_document_extractions
FOR EACH ROW EXECUTE FUNCTION public.mu_settle_after_read();

-- Queue: hide CVs the parser has already read whatever they were labelled,
-- and carry the hold reason through.
DROP FUNCTION IF EXISTS public.mu_review_queue(integer);
CREATE OR REPLACE FUNCTION public.mu_review_queue(_limit integer DEFAULT 200)
RETURNS TABLE(document_id uuid, person_id uuid, full_name text, person_email text, label text, url text,
  doc_type text, review_outcome text, source_table text, source_note text, uploaded_by_name text,
  created_at timestamp with time zone, expires_at date, credential_type text, credential_state text,
  is_required boolean, on_active_shortlist boolean, shortlist_count integer, hold_reason text, read_state text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  WITH sl AS (
    SELECT s.person_id AS pid, count(*)::int AS n
      FROM public.mu_shortlists s
      JOIN public.matchmaker_opportunities op ON op.id = s.opportunity_id AND op.status IN ('open','draft')
     GROUP BY s.person_id
  ),
  cred AS (
    SELECT c.evidence_document_id AS did, min(c.credential_type) AS ctype
      FROM public.mu_credentials c
     WHERE c.evidence_document_id IS NOT NULL
     GROUP BY c.evidence_document_id
  )
  SELECT d.id, d.person_id, p.full_name, p.email,
         d.label, d.url, coalesce(d.doc_type, public.mu_doc_type(d.label, d.url)), d.review_outcome,
         d.source_table, d.source_note, d.uploaded_by_name,
         d.created_at, d.expires_at,
         cred.ctype,
         NULL::text,
         EXISTS (
           SELECT 1 FROM public.mu_required_documents rd
            WHERE rd.doc_type = coalesce(d.doc_type, public.mu_doc_type(d.label, d.url))
         ),
         coalesce(sl.n, 0) > 0, coalesce(sl.n, 0),
         d.hold_reason,
         CASE WHEN EXISTS (SELECT 1 FROM public.mu_document_extractions x WHERE x.document_id = d.id)
              THEN 'read' ELSE 'unread' END
    FROM public.mu_documents d
    JOIN public.mu_people p ON p.id = d.person_id
    LEFT JOIN sl ON sl.pid = d.person_id
    LEFT JOIN cred ON cred.did = d.id
   WHERE (d.review_outcome = 'pending'
          OR (d.review_outcome = 'accepted' AND d.expires_at IS NOT NULL AND d.expires_at < current_date))
     AND NOT (
       (coalesce(d.doc_type, public.mu_doc_type(d.label, d.url)) = 'CV' OR d.doc_kind = 'cv')
       AND public.mu_cv_was_read(d.id, d.person_id)
     )
   ORDER BY coalesce(sl.n, 0) DESC, d.created_at ASC
   LIMIT least(coalesce(_limit, 200), 500);
END;
$$;

-- Settle the current backlog.
SELECT public.mu_autosettle_documents(2000);

-- Live updates from the portal into the admin profile.
ALTER TABLE public.mu_people REPLICA IDENTITY FULL;
ALTER TABLE public.mu_documents REPLICA IDENTITY FULL;
ALTER TABLE public.mu_parsed_fields REPLICA IDENTITY FULL;
ALTER TABLE public.mu_document_requests REPLICA IDENTITY FULL;
ALTER TABLE public.mu_work_preferences REPLICA IDENTITY FULL;
ALTER TABLE public.mu_references REPLICA IDENTITY FULL;
ALTER TABLE public.mu_availability_days REPLICA IDENTITY FULL;
ALTER TABLE public.mu_availability_recurrence REPLICA IDENTITY FULL;
ALTER TABLE public.mu_activity REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.mu_people;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mu_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mu_parsed_fields;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mu_document_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mu_work_preferences;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mu_references;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mu_availability_days;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mu_availability_recurrence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mu_activity;
