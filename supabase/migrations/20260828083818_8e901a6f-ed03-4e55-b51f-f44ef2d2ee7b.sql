-- One place that decides what is genuinely waiting for a decision.
CREATE OR REPLACE FUNCTION public.mu_review_pending_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT d.id
    FROM public.mu_documents d
    JOIN public.mu_people p ON p.id = d.person_id
   WHERE d.superseded_at IS NULL
     AND (
       d.review_outcome = 'pending'
       -- An expired acceptance comes back only if nobody has looked at it
       -- since it expired. Once an admin reviews it again, it stays cleared.
       OR (d.review_outcome = 'accepted'
           AND d.expires_at IS NOT NULL
           AND d.expires_at < current_date
           AND (d.reviewed_at IS NULL OR d.reviewed_at::date <= d.expires_at))
     )
     AND (d.conditional_until IS NULL OR d.conditional_until < current_date)
     AND NOT (
       (coalesce(d.doc_type, public.mu_doc_type(d.label, d.url)) = 'CV' OR d.doc_kind = 'cv')
       AND public.mu_cv_was_read(d.id, d.person_id)
     );
$$;

REVOKE EXECUTE ON FUNCTION public.mu_review_pending_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_review_pending_ids() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mu_review_queue(_limit integer DEFAULT 200)
RETURNS TABLE(document_id uuid, person_id uuid, full_name text, person_email text, label text, url text, doc_type text, review_outcome text, source_table text, source_note text, uploaded_by_name text, created_at timestamp with time zone, expires_at date, credential_type text, credential_state text, is_required boolean, on_active_shortlist boolean, shortlist_count integer, hold_reason text, read_state text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
   WHERE d.id IN (SELECT public.mu_review_pending_ids())
   ORDER BY coalesce(sl.n, 0) DESC, d.created_at ASC
   LIMIT least(coalesce(_limit, 200), 1000);
END;
$function$;

-- The whole backlog, whatever the page is showing.
CREATE OR REPLACE FUNCTION public.mu_review_queue_count()
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  SELECT count(*)::int INTO n FROM public.mu_review_pending_ids();
  RETURN n;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mu_review_queue_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_review_queue_count() TO authenticated, service_role;

-- Auto-settling should not touch documents that have already been replaced.
CREATE OR REPLACE FUNCTION public.mu_autosettle_documents(_limit integer DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record; v jsonb; ev text; accepted int := 0; held int := 0; asked int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  FOR r IN
    SELECT d.id, d.person_id FROM public.mu_documents d
     WHERE d.review_outcome = 'pending'
       AND d.superseded_at IS NULL
     ORDER BY d.created_at ASC
     LIMIT least(coalesce(_limit,500), 2000)
  LOOP
    v := public.mu_document_verdict(r.id);

    IF v->>'action' = 'accept' THEN
      UPDATE public.mu_documents
         SET review_outcome = 'accepted', hold_reason = NULL, review_reason = NULL, reviewed_at = now(),
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
        PERFORM public.mu_system_request_document(
          r.person_id, coalesce(v->>'kind','other'),
          v->>'reason' || ' Please upload a clear, current copy.');
        asked := asked + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('accepted', accepted, 'held', held, 'asked', asked);
END;
$function$;