-- A CV is not evidence, it is a self-declared document. Once the reader has
-- read it there is nothing for a person to accept, so it leaves the review
-- queue. Only CVs the reader could not read stay visible, so someone can chase
-- a better copy.
CREATE OR REPLACE FUNCTION public.mu_cv_was_read(_document_id uuid, _person_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mu_cv_parses cp
     WHERE cp.person_id = _person_id
       AND cp.error IS NULL
       AND (cp.document_id IS NULL OR cp.document_id = _document_id)
  ) OR EXISTS (
    SELECT 1 FROM public.mu_people p
     WHERE p.id = _person_id AND p.parse_status = 'parsed'
  );
$$;

CREATE OR REPLACE FUNCTION public.mu_review_queue(_limit integer DEFAULT 200)
RETURNS TABLE(
  document_id uuid, person_id uuid, full_name text, person_email text,
  label text, url text, doc_type text, review_outcome text,
  source_table text, source_note text, uploaded_by_name text,
  created_at timestamptz, expires_at date,
  credential_type text, credential_state text,
  is_required boolean, on_active_shortlist boolean, shortlist_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
    SELECT c.evidence_document_id AS did,
           min(c.credential_type) AS ctype
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
         coalesce(sl.n, 0) > 0, coalesce(sl.n, 0)
    FROM public.mu_documents d
    JOIN public.mu_people p ON p.id = d.person_id
    LEFT JOIN sl ON sl.pid = d.person_id
    LEFT JOIN cred ON cred.did = d.id
   WHERE (d.review_outcome = 'pending'
          OR (d.review_outcome = 'accepted' AND d.expires_at IS NOT NULL AND d.expires_at < current_date))
     AND NOT (
       coalesce(d.doc_type, public.mu_doc_type(d.label, d.url)) = 'CV'
       AND public.mu_cv_was_read(d.id, d.person_id)
     )
   ORDER BY coalesce(sl.n, 0) DESC, d.created_at ASC
   LIMIT least(coalesce(_limit, 200), 500);
END;
$$;

CREATE OR REPLACE FUNCTION public.mu_review_queue_count()
RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  SELECT count(*)::int INTO n
    FROM public.mu_documents d
   WHERE (d.review_outcome = 'pending'
          OR (d.review_outcome = 'accepted' AND d.expires_at IS NOT NULL AND d.expires_at < current_date))
     AND NOT (
       coalesce(d.doc_type, public.mu_doc_type(d.label, d.url)) = 'CV'
       AND public.mu_cv_was_read(d.id, d.person_id)
     );
  RETURN coalesce(n, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mu_cv_was_read(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_cv_was_read(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mu_review_queue(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_review_queue(integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mu_review_queue_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_review_queue_count() TO authenticated;