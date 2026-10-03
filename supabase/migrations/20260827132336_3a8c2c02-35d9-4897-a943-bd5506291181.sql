ALTER TABLE public.mu_documents
  ADD COLUMN IF NOT EXISTS conditional_until date,
  ADD COLUMN IF NOT EXISTS conditional_reason text;

CREATE OR REPLACE FUNCTION public.mu_review_document(_document_id uuid, _outcome text, _reason text DEFAULT NULL::text, _expires_at date DEFAULT NULL::date, _conditional_until date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE d public.mu_documents; actor text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF _outcome NOT IN ('accepted', 'rejected', 'pending', 'conditional') THEN
    RAISE EXCEPTION 'Unknown review outcome %', _outcome;
  END IF;
  IF _outcome = 'rejected' AND coalesce(btrim(coalesce(_reason, '')), '') = '' THEN
    RAISE EXCEPTION 'A reason is required when a document is rejected';
  END IF;
  IF _outcome = 'conditional' THEN
    IF _conditional_until IS NULL THEN
      RAISE EXCEPTION 'A review date is required when a document is accepted for now';
    END IF;
    IF _conditional_until <= current_date THEN
      RAISE EXCEPTION 'The review date must be in the future';
    END IF;
    IF coalesce(btrim(coalesce(_reason, '')), '') = '' THEN
      RAISE EXCEPTION 'A reason is required when a document is accepted for now';
    END IF;
  END IF;

  SELECT coalesce(display_name, email) INTO actor FROM public.admin_permissions WHERE user_id = auth.uid() LIMIT 1;

  UPDATE public.mu_documents
     SET review_outcome = CASE WHEN _outcome = 'conditional' THEN 'accepted' ELSE _outcome END,
         review_reason = CASE WHEN _outcome = 'rejected' THEN btrim(_reason) ELSE NULL END,
         conditional_until = CASE WHEN _outcome = 'conditional' THEN _conditional_until ELSE NULL END,
         conditional_reason = CASE WHEN _outcome = 'conditional' THEN btrim(_reason) ELSE NULL END,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         expires_at = coalesce(_expires_at, expires_at)
   WHERE id = _document_id
   RETURNING * INTO d;

  IF d.id IS NULL THEN RAISE EXCEPTION 'Document not found'; END IF;

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (d.person_id, auth.uid(), actor, 'document_' || _outcome,
          jsonb_build_object('document_id', d.id, 'label', d.label, 'doc_type', d.doc_type,
                             'reason', coalesce(d.review_reason, d.conditional_reason),
                             'conditional_until', d.conditional_until));

  RETURN jsonb_build_object('person_id', d.person_id, 'doc_type', d.doc_type, 'label', d.label,
                            'reason', coalesce(d.review_reason, d.conditional_reason),
                            'conditional_until', d.conditional_until);
END;
$function$;

DROP FUNCTION IF EXISTS public.mu_document_status(uuid);
CREATE FUNCTION public.mu_document_status(_person_id uuid)
 RETURNS TABLE(doc_type text, label text, helper text, required boolean, status text, document_id uuid, document_label text, document_url text, expires_at date, review_reason text, reviewed_at timestamp with time zone, source_note text, conditional_until date, conditional_reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prof text;
  staff boolean;
  trk text;
  nysc text;
BEGIN
  SELECT p.profession, p.is_staff, coalesce(btrim(coalesce(p.track, '')), ''), lower(coalesce(p.nysc_status, ''))
    INTO prof, staff, trk, nysc
    FROM public.mu_people p WHERE p.id = _person_id;
  staff := COALESCE(staff, false);

  RETURN QUERY
  WITH req AS (
    SELECT r.doc_type, r.label, r.helper, r.sort_order,
           (r.rule = 'always'
             OR (r.rule = 'licensed_only' AND trk NOT IN ('student','non_clinical','support')
                 AND public.mu_expects_licence(prof))
             OR (r.rule = 'staff_only' AND staff)
             OR (r.rule = 'nysc_only' AND nysc IN ('completed', 'exempt'))) AS required
      FROM public.mu_required_documents r
     WHERE r.active
       AND (r.rule <> 'staff_only' OR staff)
       AND (r.track_key IS NULL OR r.track_key = trk)
       AND NOT (trk = ANY (coalesce(r.exempt_tracks, '{}')))
       AND (r.rule <> 'nysc_only' OR nysc IN ('completed', 'exempt'))
  ),
  best AS (
    SELECT DISTINCT ON (d.doc_type)
           d.doc_type, d.id, d.label, d.url, d.expires_at, d.review_reason,
           d.reviewed_at, d.source_note, d.review_outcome, d.conditional_until, d.conditional_reason
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
           WHEN b.review_outcome = 'accepted' AND b.conditional_until IS NOT NULL AND b.conditional_until >= current_date THEN 'conditional'
           WHEN b.review_outcome = 'accepted' AND b.expires_at IS NOT NULL AND b.expires_at < current_date THEN 'expired'
           WHEN b.review_outcome = 'accepted' THEN 'accepted'
           WHEN b.review_outcome = 'rejected' THEN 'rejected'
           ELSE 'pending'
         END,
         b.id, b.label, b.url, b.expires_at, b.review_reason, b.reviewed_at, b.source_note,
         b.conditional_until, b.conditional_reason
    FROM req LEFT JOIN best b ON b.doc_type = req.doc_type
   ORDER BY req.sort_order;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mu_derive_verification(_person_id uuid, _gaps jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  n_missing int; n_pending int; n_bad int;
BEGIN
  -- The NYSC certificate is asked for, chased and shown as outstanding, but it
  -- never holds verification back. Everything else still does. A document
  -- accepted for now (conditional) counts as in place until its review date.
  SELECT count(*) FILTER (WHERE s.status = 'missing'),
         count(*) FILTER (WHERE s.status = 'pending'),
         count(*) FILTER (WHERE s.status IN ('rejected', 'expired'))
    INTO n_missing, n_pending, n_bad
    FROM public.mu_document_status(_person_id) s
   WHERE s.required AND s.doc_type <> 'NYSC';

  IF n_bad > 0 THEN RETURN 'failed'; END IF;
  IF n_missing = 0 AND n_pending = 0 AND coalesce(jsonb_array_length(coalesce(_gaps, '[]'::jsonb)), 0) = 0 THEN
    RETURN 'verified';
  END IF;
  IF n_pending > 0 THEN RETURN 'in_review'; END IF;
  RETURN 'unverified';
END;
$function$;

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
   WHERE (d.review_outcome = 'pending'
          OR (d.review_outcome = 'accepted' AND d.expires_at IS NOT NULL AND d.expires_at < current_date))
     AND (d.conditional_until IS NULL OR d.conditional_until < current_date)
     AND NOT (
       (coalesce(d.doc_type, public.mu_doc_type(d.label, d.url)) = 'CV' OR d.doc_kind = 'cv')
       AND public.mu_cv_was_read(d.id, d.person_id)
     )
   ORDER BY coalesce(sl.n, 0) DESC, d.created_at ASC
   LIMIT least(coalesce(_limit, 200), 500);
END;
$function$;