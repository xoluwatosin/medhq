CREATE OR REPLACE FUNCTION public.mu_candidate_gaps_row(p mu_people)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  g text[] := '{}';
  lic_state text;
  pending text[];
  req public.mu_role_requirements;
  wants_licence boolean;
  n_refs int;
BEGIN
  SELECT coalesce(array_agg(DISTINCT field), '{}')
    INTO pending
    FROM public.mu_parsed_fields
   WHERE person_id = p.id AND status = 'candidate_updated'
     AND coalesce(btrim(coalesce(value, '')), '') <> '';

  req := public.mu_role_requirement(p.profession, p.track);

  IF coalesce(btrim(coalesce(p.profession, '')), '') = '' THEN g := g || 'profession'::text; END IF;
  -- Years of experience is deduced from the CV and work history, never asked.
  IF coalesce(btrim(coalesce(p.state, '')), '') = '' THEN g := g || 'state'::text; END IF;
  IF coalesce(btrim(coalesce(p.lga, '')), '') = ''
     OR public.mu_norm_lga(p.lga, p.state) IS NULL THEN g := g || 'lga'::text; END IF;

  SELECT public.mu_credential_state(c.claim, c.evidence_document_id, c.verification_outcome, c.expires_at)
    INTO lic_state
    FROM public.mu_credentials c
   WHERE c.person_id = p.id AND c.credential_type = 'licence';
  lic_state := coalesce(lic_state, 'unknown');

  wants_licence := coalesce(req.expects_licence, false) OR public.mu_expects_licence(p.profession);

  IF wants_licence AND lic_state NOT IN ('declined', 'verified') THEN
    IF coalesce(btrim(coalesce(p.licensing_body, '')), '') = '' THEN g := g || 'licensing_body'::text; END IF;
    IF coalesce(btrim(coalesce(p.license_number, '')), '') = '' THEN g := g || 'license_number'::text; END IF;
    IF p.license_expiry IS NULL THEN g := g || 'license_expiry'::text; END IF;
  END IF;

  IF coalesce(p.languages, '[]'::jsonb) = '[]'::jsonb THEN g := g || 'languages'::text; END IF;

  IF coalesce(req.needs_right_to_work, true)
     AND p.right_to_work IS NULL AND coalesce(p.right_to_work_status, 'unknown') = 'unknown'
    THEN g := g || 'right_to_work'::text; END IF;

  IF coalesce(req.needs_nysc, false) OR (wants_licence AND req.role_key IS NULL) THEN
    IF coalesce(btrim(coalesce(p.nysc_status, '')), '') = '' THEN g := g || 'nysc_status'::text; END IF;
  END IF;

  IF coalesce(req.needs_institution, false)
     AND coalesce(btrim(coalesce(p.institution, '')), '') = ''
    THEN g := g || 'institution'::text; END IF;

  IF coalesce(btrim(coalesce(p.sex, '')), '') = '' THEN g := g || 'sex'::text; END IF;

  IF coalesce(req.needs_availability, true) AND p.last_availability_update IS NULL
    THEN g := g || 'availability'::text; END IF;

  IF coalesce(req.needs_preferences, true)
     AND NOT EXISTS (SELECT 1 FROM public.mu_work_preferences w WHERE w.person_id = p.id)
    THEN g := g || 'work_preferences'::text; END IF;

  SELECT count(*) INTO n_refs FROM public.mu_references r WHERE r.person_id = p.id;
  IF n_refs < coalesce(req.min_references, 1) THEN g := g || 'references'::text; END IF;

  SELECT coalesce(array_agg(x ORDER BY ord), '{}') INTO g
    FROM unnest(g) WITH ORDINALITY t(x, ord)
   WHERE NOT (x = ANY (pending));

  RETURN to_jsonb(g);
END; $function$;