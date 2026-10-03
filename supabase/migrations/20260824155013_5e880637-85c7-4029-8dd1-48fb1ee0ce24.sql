CREATE OR REPLACE FUNCTION public.mu_readiness_items(_person_id uuid)
RETURNS TABLE(code text, sentence text, owner text, sort_order integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Missing record fields, named the way the form names them. A field the
  -- candidate has already been asked about is listed once, as the question.
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
           WHEN 'references' THEN 'No references are recorded.'
           WHEN 'cv' THEN 'No CV is on file.'
           ELSE 'No ' || lower(replace(g.value, '_', ' ')) || ' is recorded.'
         END,
         'candidate', 40
    FROM jsonb_array_elements_text(coalesce(p.candidate_gaps, '[]'::jsonb)) g(value)
   WHERE NOT (g.value = ANY(queried))
     AND NOT (g.value = 'references' AND n_refs < coalesce(req.min_references, 1));

  RETURN QUERY
  SELECT 'question:' || f.field,
         'A question about the ' || lower(replace(f.field, '_', ' ')) || ' is with the candidate.',
         'candidate', 50
    FROM (SELECT DISTINCT field FROM public.mu_parsed_fields
           WHERE person_id = _person_id AND status = 'queried') f;

  IF n_refs < coalesce(req.min_references, 1) THEN
    RETURN QUERY SELECT 'references'::text,
      'This role asks for ' || coalesce(req.min_references, 1) || ' references and ' ||
      CASE WHEN n_refs = 0 THEN 'none are on file.'
           WHEN n_refs = 1 THEN 'one is on file.'
           ELSE n_refs || ' are on file.' END,
      'candidate', 60;
  END IF;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.mu_readiness_items(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mu_readiness_items(uuid) TO authenticated;