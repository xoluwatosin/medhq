ALTER TABLE public.mu_documents
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.mu_documents(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.mu_supersede_older_cvs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.doc_kind, public.mu_doc_type(NEW.label, NEW.url)) NOT IN ('cv', 'CV') THEN
    RETURN NEW;
  END IF;

  IF NEW.review_outcome = 'accepted' THEN
    UPDATE public.mu_documents d
       SET superseded_at = now(), superseded_by = NEW.id
     WHERE d.person_id = NEW.person_id
       AND d.id <> NEW.id
       AND d.superseded_at IS NULL
       AND coalesce(d.doc_kind, public.mu_doc_type(d.label, d.url)) IN ('cv', 'CV')
       AND d.created_at <= NEW.created_at;
  ELSIF TG_OP = 'INSERT' THEN
    UPDATE public.mu_documents d
       SET superseded_at = now(), superseded_by = NEW.id
     WHERE d.person_id = NEW.person_id
       AND d.id <> NEW.id
       AND d.superseded_at IS NULL
       AND coalesce(d.review_outcome, 'pending') = 'pending'
       AND coalesce(d.doc_kind, public.mu_doc_type(d.label, d.url)) IN ('cv', 'CV')
       AND d.created_at <= NEW.created_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mu_documents_supersede_cvs ON public.mu_documents;
CREATE TRIGGER mu_documents_supersede_cvs
AFTER INSERT OR UPDATE OF review_outcome ON public.mu_documents
FOR EACH ROW EXECUTE FUNCTION public.mu_supersede_older_cvs();

WITH cvs AS (
  SELECT d.id,
         row_number() OVER (
           PARTITION BY d.person_id
           ORDER BY CASE d.review_outcome WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                    d.created_at DESC
         ) AS rank,
         first_value(d.id) OVER (
           PARTITION BY d.person_id
           ORDER BY CASE d.review_outcome WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                    d.created_at DESC
         ) AS current_id
    FROM public.mu_documents d
   WHERE d.superseded_at IS NULL
     AND coalesce(d.doc_kind, public.mu_doc_type(d.label, d.url)) IN ('cv', 'CV')
)
UPDATE public.mu_documents d
   SET superseded_at = now(), superseded_by = c.current_id
  FROM cvs c
 WHERE d.id = c.id AND c.rank > 1;

CREATE OR REPLACE FUNCTION public.mu_document_status(_person_id uuid)
RETURNS TABLE(doc_type text, label text, helper text, required boolean, status text,
              document_id uuid, document_label text, document_url text, expires_at date,
              review_reason text, reviewed_at timestamp with time zone, source_note text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof text;
  staff boolean;
BEGIN
  SELECT p.profession, p.is_staff INTO prof, staff FROM public.mu_people p WHERE p.id = _person_id;
  staff := COALESCE(staff, false);

  RETURN QUERY
  WITH req AS (
    SELECT r.doc_type, r.label, r.helper, r.sort_order,
           (r.rule = 'always'
             OR (r.rule = 'licensed_only' AND public.mu_expects_licence(prof))
             OR (r.rule = 'staff_only' AND staff)) AS required
      FROM public.mu_required_documents r
     WHERE r.active
       AND (r.rule <> 'staff_only' OR staff)
  ),
  best AS (
    SELECT DISTINCT ON (d.doc_type)
           d.doc_type, d.id, d.label, d.url, d.expires_at, d.review_reason,
           d.reviewed_at, d.source_note, d.review_outcome
      FROM public.mu_documents d
     WHERE d.person_id = _person_id
       AND d.superseded_at IS NULL
     ORDER BY d.doc_type,
              CASE d.review_outcome WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
              d.created_at DESC
  )
  SELECT req.doc_type, req.label, req.helper, req.required,
         CASE
           WHEN b.id IS NULL THEN 'missing'
           WHEN b.review_outcome = 'accepted' AND b.expires_at IS NOT NULL AND b.expires_at < current_date THEN 'expired'
           WHEN b.review_outcome = 'accepted' THEN 'accepted'
           WHEN b.review_outcome = 'rejected' THEN 'rejected'
           ELSE 'pending'
         END,
         b.id, b.label, b.url, b.expires_at, b.review_reason, b.reviewed_at, b.source_note
    FROM req LEFT JOIN best b ON b.doc_type = req.doc_type
   ORDER BY req.sort_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.mu_verification_queue(_limit integer DEFAULT 100)
RETURNS TABLE(person_id uuid, full_name text, credential_type text, state text,
              evidence_document_id uuid, document_label text, document_url text, claim_source text,
              on_active_shortlist boolean, shortlist_count integer, evidence_at timestamp with time zone)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  WITH sl AS (
    SELECT s.person_id, count(*)::int AS n
      FROM public.mu_shortlists s
      JOIN public.matchmaker_opportunities op ON op.id = s.opportunity_id AND op.status IN ('open','draft')
     GROUP BY s.person_id
  )
  SELECT c.person_id, p.full_name, c.credential_type,
         public.mu_credential_state(c.claim, c.evidence_document_id, c.verification_outcome, c.expires_at),
         c.evidence_document_id, d.label, d.url, c.claim_source,
         coalesce(sl.n, 0) > 0, coalesce(sl.n, 0), c.evidence_at
    FROM public.mu_credentials c
    JOIN public.mu_people p ON p.id = c.person_id
    LEFT JOIN public.mu_documents d ON d.id = c.evidence_document_id
    LEFT JOIN sl ON sl.person_id = c.person_id
   WHERE public.mu_credential_state(c.claim, c.evidence_document_id, c.verification_outcome, c.expires_at)
         IN ('documented','expired')
     AND (d.id IS NULL OR d.superseded_at IS NULL)
   ORDER BY coalesce(sl.n, 0) DESC, c.evidence_at ASC NULLS LAST
   LIMIT least(coalesce(_limit, 100), 500);
END;
$$;

DROP VIEW IF EXISTS public.mu_readiness_v;
DROP FUNCTION IF EXISTS public.mu_readiness_items(uuid);

CREATE FUNCTION public.mu_readiness_items(_person_id uuid)
RETURNS TABLE(code text, sentence text, owner text, sort_order integer, route text, action text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.mu_people;
  req public.mu_role_requirements;
  n_refs int;
  queried text[];
BEGIN
  IF NOT (private.has_role(auth.uid(), 'admin'::app_role) OR _person_id = public.mu_my_person_id()) THEN
    RETURN;
  END IF;

  SELECT * INTO p FROM public.mu_people WHERE id = _person_id;
  IF p.id IS NULL THEN RETURN; END IF;
  req := public.mu_role_requirement(p.profession, p.track);
  SELECT count(*) INTO n_refs FROM public.mu_references r WHERE r.person_id = p.id;
  SELECT coalesce(array_agg(DISTINCT f.field), '{}') INTO queried
    FROM public.mu_parsed_fields f
   WHERE f.person_id = _person_id AND f.status = 'queried';

  RETURN QUERY
  SELECT 'document_rejected:' || s.doc_type,
         s.label || ' was rejected and has to be replaced.',
         'candidate'::text, 10, '/portal/documents'::text, ('Upload ' || lower(s.label))::text
    FROM public.mu_document_status(_person_id) s
   WHERE s.required AND s.status IN ('rejected', 'expired');

  RETURN QUERY
  SELECT 'document_missing:' || s.doc_type,
         s.label || ' is not on file.',
         'candidate'::text, 20, '/portal/documents'::text, ('Upload ' || lower(s.label))::text
    FROM public.mu_document_status(_person_id) s
   WHERE s.required AND s.status = 'missing';

  RETURN QUERY
  SELECT 'document_pending:' || s.doc_type,
         s.label || ' is on file and awaits a decision.',
         'office'::text, 30, NULL::text, NULL::text
    FROM public.mu_document_status(_person_id) s
   WHERE s.required AND s.status = 'pending';

  RETURN QUERY
  SELECT 'gap:' || g.value,
         CASE g.value
           WHEN 'lga' THEN 'No local government area is recorded.'
           WHEN 'state' THEN 'No state is recorded.'
           WHEN 'sex' THEN 'No sex is recorded.'
           WHEN 'languages' THEN 'No languages are recorded.'
           WHEN 'profession' THEN 'No profession is recorded.'
           WHEN 'phone' THEN 'No telephone number is recorded.'
           WHEN 'licensing_body' THEN 'No licensing body is recorded.'
           WHEN 'license_number' THEN 'No licence number is recorded.'
           WHEN 'license_expiry' THEN 'No licence expiry date is recorded.'
           WHEN 'years_experience' THEN 'No length of experience is recorded.'
           WHEN 'right_to_work' THEN 'Right to work is not confirmed.'
           WHEN 'nysc_status' THEN 'No NYSC status is recorded.'
           WHEN 'work_preferences' THEN 'No work preferences are recorded.'
           WHEN 'availability' THEN 'No availability is recorded.'
           WHEN 'cv' THEN 'No CV is on file.'
           ELSE 'No ' || lower(replace(g.value, '_', ' ')) || ' is recorded.'
         END,
         'candidate'::text, 40,
         CASE g.value
           WHEN 'work_preferences' THEN '/portal/preferences'
           WHEN 'availability' THEN '/portal/availability'
           WHEN 'cv' THEN '/portal/documents'
           ELSE NULL
         END::text,
         CASE g.value
           WHEN 'work_preferences' THEN 'Set your preferences'
           WHEN 'availability' THEN 'Set your availability'
           WHEN 'cv' THEN 'Upload your CV'
           ELSE NULL
         END::text
    FROM jsonb_array_elements_text(coalesce(p.candidate_gaps, '[]'::jsonb)) g(value)
   WHERE NOT (g.value = ANY(queried))
     AND g.value <> 'references';

  RETURN QUERY
  SELECT 'question:' || f.field,
         'A question about the ' || lower(replace(f.field, '_', ' ')) || ' is with the candidate.',
         'candidate'::text, 50, NULL::text, NULL::text
    FROM (SELECT DISTINCT field FROM public.mu_parsed_fields
           WHERE person_id = _person_id AND status = 'queried') f;

  IF n_refs < coalesce(req.min_references, 1) THEN
    RETURN QUERY SELECT 'references'::text,
      ('This role asks for ' || coalesce(req.min_references, 1) || ' references and ' ||
       CASE WHEN n_refs = 0 THEN 'none are on file.'
            WHEN n_refs = 1 THEN 'one is on file.'
            ELSE n_refs || ' are on file.' END)::text,
      'candidate'::text, 60, '/portal/documents#references'::text, 'Add a reference'::text;
  END IF;
END;
$$;

CREATE VIEW public.mu_readiness_v
WITH (security_invoker = true) AS
SELECT p.id AS person_id,
       p.verification_state,
       COALESCE(i.items, '[]'::jsonb) AS outstanding,
       COALESCE(jsonb_array_length(COALESCE(i.items, '[]'::jsonb)), 0) AS outstanding_count,
       COALESCE(i.candidate_count, 0::bigint) AS candidate_count,
       COALESCE(i.office_count, 0::bigint) AS office_count,
       p.verification_state = 'verified'::text AND COALESCE(i.items, '[]'::jsonb) = '[]'::jsonb AS placement_ready
  FROM public.mu_people p
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('code', r.code, 'sentence', r.sentence, 'owner', r.owner,
                                        'route', r.route, 'action', r.action)
                     ORDER BY r.sort_order, r.code) AS items,
           count(*) FILTER (WHERE r.owner = 'candidate') AS candidate_count,
           count(*) FILTER (WHERE r.owner = 'office') AS office_count
      FROM public.mu_readiness_items(p.id) r
  ) i ON true;

GRANT SELECT ON public.mu_readiness_v TO authenticated;
GRANT ALL ON public.mu_readiness_v TO service_role;

CREATE OR REPLACE FUNCTION public.mu_promote_extra_parsed_fields(_person_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  promoted int := 0;
  r record;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  FOR r IN
    SELECT DISTINCT ON (pf.person_id, pf.field)
           pf.id, pf.person_id, pf.field, btrim(pf.value) AS value, pf.confidence
      FROM public.mu_parsed_fields pf
     WHERE pf.field IN ('sex','nysc_status','right_to_work','languages','license_number','license_expiry','phone')
       AND coalesce(btrim(pf.value), '') <> ''
       AND lower(btrim(pf.value)) NOT IN ('not stated','unknown','none','n/a')
       AND (_person_id IS NULL OR pf.person_id = _person_id)
     ORDER BY pf.person_id, pf.field, pf.confidence DESC, pf.created_at DESC
  LOOP
    IF r.field = 'sex' THEN
      UPDATE public.mu_people SET sex = r.value
       WHERE id = r.person_id AND coalesce(btrim(coalesce(sex, '')), '') = '';
    ELSIF r.field = 'nysc_status' THEN
      UPDATE public.mu_people SET nysc_status = r.value
       WHERE id = r.person_id AND coalesce(btrim(coalesce(nysc_status, '')), '') = '';
    ELSIF r.field = 'license_number' THEN
      UPDATE public.mu_people SET license_number = r.value
       WHERE id = r.person_id AND coalesce(btrim(coalesce(license_number, '')), '') = '';
    ELSIF r.field = 'phone' THEN
      UPDATE public.mu_people SET phone = r.value
       WHERE id = r.person_id AND coalesce(btrim(coalesce(phone, '')), '') = '';
    ELSIF r.field = 'license_expiry' THEN
      UPDATE public.mu_people SET license_expiry = public.mu_loose_date(r.value)
       WHERE id = r.person_id AND license_expiry IS NULL
         AND public.mu_loose_date(r.value) IS NOT NULL;
    ELSIF r.field = 'right_to_work' THEN
      UPDATE public.mu_people
         SET right_to_work = (lower(r.value) LIKE 'y%' OR lower(r.value) LIKE 'true%'),
             right_to_work_status = CASE WHEN lower(r.value) LIKE 'y%' OR lower(r.value) LIKE 'true%'
                                         THEN 'confirmed' ELSE 'absent' END
       WHERE id = r.person_id AND right_to_work IS NULL;
    ELSIF r.field = 'languages' THEN
      UPDATE public.mu_people
         SET languages = (
               SELECT coalesce(jsonb_agg(jsonb_build_object('language', btrim(t), 'fluency', 'Unstated')), '[]'::jsonb)
                 FROM unnest(string_to_array(r.value, ',')) t
                WHERE btrim(t) <> ''
             )
       WHERE id = r.person_id
         AND coalesce(jsonb_array_length(coalesce(languages, '[]'::jsonb)), 0) = 0;
    END IF;

    IF FOUND THEN promoted := promoted + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object('promoted', promoted);
END;
$$;

CREATE OR REPLACE FUNCTION public.mu_queue_cv_parse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_doc uuid;
  cur_status text;
  attempts int;
BEGIN
  IF public.mu_doc_type(NEW.label, NEW.url) <> 'CV' THEN
    RETURN NEW;
  END IF;

  SELECT parse_document_id, coalesce(parse_status, 'not_parsed'), coalesce(parse_attempts, 0)
    INTO cur_doc, cur_status, attempts
    FROM public.mu_people WHERE id = NEW.person_id;

  IF cur_doc = NEW.id AND cur_status IN ('queued', 'parsed', 'empty') THEN
    RETURN NEW;
  END IF;

  IF cur_doc = NEW.id AND attempts >= 3 THEN
    UPDATE public.mu_people SET parse_status = 'failed' WHERE id = NEW.person_id;
    RETURN NEW;
  END IF;

  UPDATE public.mu_people
     SET parse_status = 'queued',
         parse_document_id = NEW.id,
         parse_attempts = CASE WHEN cur_doc IS DISTINCT FROM NEW.id THEN 1 ELSE parse_attempts + 1 END,
         parse_last_attempt_at = now()
   WHERE id = NEW.person_id;

  PERFORM private.mu_dispatch_parse(NEW.person_id);
  RETURN NEW;
END;
$$;