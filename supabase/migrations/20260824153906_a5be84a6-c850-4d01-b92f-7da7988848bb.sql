CREATE OR REPLACE FUNCTION public.mu_readiness_items(_person_id uuid)
RETURNS TABLE(code text, sentence text, owner text, sort_order int)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p public.mu_people;
  req public.mu_role_requirements;
  n_refs int;
BEGIN
  IF NOT (private.has_role(auth.uid(), 'admin'::app_role) OR _person_id = public.mu_my_person_id()) THEN
    RETURN;
  END IF;

  SELECT * INTO p FROM public.mu_people WHERE id = _person_id;
  IF p.id IS NULL THEN RETURN; END IF;
  req := public.mu_role_requirement(p.profession, p.track);
  SELECT count(*) INTO n_refs FROM public.mu_references r WHERE r.person_id = p.id;

  RETURN QUERY
  SELECT 'document_rejected:' || s.doc_type,
         s.label || ' was rejected and has to be replaced.',
         'candidate', 10
    FROM public.mu_document_status(_person_id) s
   WHERE s.required AND s.status IN ('rejected', 'expired');

  RETURN QUERY
  SELECT 'document_missing:' || s.doc_type,
         s.label || ' is not on file.',
         'candidate', 20
    FROM public.mu_document_status(_person_id) s
   WHERE s.required AND s.status = 'missing';

  RETURN QUERY
  SELECT 'document_pending:' || s.doc_type,
         s.label || ' is on file and awaits a decision.',
         'office', 30
    FROM public.mu_document_status(_person_id) s
   WHERE s.required AND s.status = 'pending';

  RETURN QUERY
  SELECT 'gap:' || g.value,
         initcap(replace(g.value, '_', ' ')) || ' is not recorded.',
         'candidate', 40
    FROM jsonb_array_elements_text(coalesce(p.candidate_gaps, '[]'::jsonb)) g(value);

  RETURN QUERY
  SELECT 'question:' || f.id::text,
         'A question about ' || replace(f.field, '_', ' ') || ' is with the candidate.',
         'candidate', 50
    FROM public.mu_parsed_fields f
   WHERE f.person_id = _person_id AND f.status = 'queried';

  IF n_refs < coalesce(req.min_references, 1) THEN
    RETURN QUERY SELECT 'references'::text,
      'This role asks for ' || coalesce(req.min_references, 1) || ' references and ' ||
      CASE WHEN n_refs = 0 THEN 'none are on file.' ELSE n_refs || ' are on file.' END,
      'candidate', 60;
  END IF;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.mu_readiness_items(uuid) FROM anon;