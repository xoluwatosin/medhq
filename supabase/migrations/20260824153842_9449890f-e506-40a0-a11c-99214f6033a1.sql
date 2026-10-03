-- 1. Role requirements: what each kind of candidate must satisfy.
CREATE TABLE public.mu_role_requirements (
  role_key text PRIMARY KEY,
  label text NOT NULL,
  pattern text,
  track_key text,
  expects_licence boolean NOT NULL DEFAULT false,
  needs_nysc boolean NOT NULL DEFAULT false,
  needs_right_to_work boolean NOT NULL DEFAULT true,
  needs_institution boolean NOT NULL DEFAULT false,
  needs_preferences boolean NOT NULL DEFAULT true,
  needs_availability boolean NOT NULL DEFAULT true,
  min_references integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mu_role_requirements TO authenticated;
GRANT ALL ON public.mu_role_requirements TO service_role;
ALTER TABLE public.mu_role_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage role requirements" ON public.mu_role_requirements
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Signed in people read role requirements" ON public.mu_role_requirements
  FOR SELECT TO authenticated USING (active);

CREATE TRIGGER mu_role_requirements_updated_at
  BEFORE UPDATE ON public.mu_role_requirements
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

INSERT INTO public.mu_role_requirements
  (role_key, label, pattern, track_key, expects_licence, needs_nysc, needs_right_to_work, needs_institution, min_references, sort_order)
VALUES
  ('student', 'Student', NULL, 'student', false, false, true, true, 1, 10),
  ('clinical_licensed', 'Licensed clinical professional',
    '(registered nurse|nursing officer|staff nurse|midwif|medical doctor|physician|pharmacist|pharmacy technician|physiotherap|physical therap|laboratory scientist|medical lab|radiograph|sonograph|paramedic|emergency medical|occupational therap|speech and language|dietit|dietic|nutrition|psycholog|counsell|community health extension|dent(ist|al surgeon)|optometr)',
    NULL, true, true, true, false, 2, 20),
  ('care_support', 'Support and care',
    '(caregiver|care giver|carer|care assistant|health assistant|support worker|nanny|childminder|housekeep|domestic|aide|attendant|orderly|ward assistant)',
    NULL, false, false, true, false, 2, 30),
  ('non_clinical', 'Non-clinical',
    '(admin|account|finance|driver|security|marketing|human resources|recruit|logistic|receptionist|customer|operations|technolog|developer|analyst)',
    NULL, false, false, true, false, 1, 40),
  ('general', 'General', NULL, NULL, false, false, true, false, 1, 900);

-- 2. Which requirement set a person falls under.
CREATE OR REPLACE FUNCTION public.mu_role_requirement(_profession text, _track text)
RETURNS public.mu_role_requirements
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT r.* FROM public.mu_role_requirements r
   WHERE r.active
     AND (
       (r.track_key IS NOT NULL AND r.track_key = coalesce(btrim(coalesce(_track, '')), ''))
       OR (r.pattern IS NOT NULL AND coalesce(btrim(coalesce(_profession, '')), '') <> '' AND _profession ~* r.pattern)
       OR r.role_key = 'general'
     )
   ORDER BY r.sort_order
   LIMIT 1
$function$;

-- 3. Gaps, judged against that requirement set.
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
  IF p.years_experience IS NULL THEN g := g || 'years_experience'::text; END IF;
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

-- 4. Keep gaps fresh when references or preferences change.
CREATE TRIGGER mu_references_rederive_gaps
  AFTER INSERT OR UPDATE OR DELETE ON public.mu_references
  FOR EACH ROW EXECUTE FUNCTION public.mu_rederive_gaps_for_person();

CREATE TRIGGER mu_work_preferences_rederive_gaps
  AFTER INSERT OR UPDATE OR DELETE ON public.mu_work_preferences
  FOR EACH ROW EXECUTE FUNCTION public.mu_rederive_gaps_for_person();

-- 5. One outstanding list, read by both the office and the candidate.
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

CREATE OR REPLACE VIEW public.mu_readiness_v
WITH (security_invoker = true)
AS
SELECT p.id AS person_id,
       p.verification_state,
       coalesce(i.items, '[]'::jsonb) AS outstanding,
       coalesce(jsonb_array_length(coalesce(i.items, '[]'::jsonb)), 0) AS outstanding_count,
       coalesce(i.candidate_count, 0) AS candidate_count,
       coalesce(i.office_count, 0) AS office_count,
       (p.verification_state = 'verified' AND coalesce(i.items, '[]'::jsonb) = '[]'::jsonb) AS placement_ready
  FROM public.mu_people p
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('code', r.code, 'sentence', r.sentence, 'owner', r.owner)
                     ORDER BY r.sort_order, r.code) AS items,
           count(*) FILTER (WHERE r.owner = 'candidate') AS candidate_count,
           count(*) FILTER (WHERE r.owner = 'office') AS office_count
      FROM public.mu_readiness_items(p.id) r
  ) i ON true;

GRANT SELECT ON public.mu_readiness_v TO authenticated;
GRANT SELECT ON public.mu_readiness_v TO service_role;

-- 6. Settle the derivation over every existing record.
UPDATE public.mu_people SET updated_at = now();