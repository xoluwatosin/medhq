-- 1) Promote languages + availability from join applications (route parity)
CREATE OR REPLACE FUNCTION public.mu_promote_application_answers(_person_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r record;
  lga_n int := 0; lic_n int := 0; rtw_n int := 0; nysc_n int := 0; lang_n int := 0; avail_n int := 0;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  FOR r IN
    WITH answers AS (
      SELECT a.person_id, a.created_at, kv.key, btrim(kv.value #>> '{}') AS val
        FROM public.matchmaker_applications a,
             LATERAL jsonb_each(coalesce(a.question_answers, '{}'::jsonb)) kv
       WHERE a.person_id IS NOT NULL
         AND (_person_id IS NULL OR a.person_id = _person_id)
    ),
    picked AS (
      SELECT person_id,
             CASE
               WHEN key ILIKE '%your lga%' OR key ILIKE '%specify your lga%' THEN 'lga'
               WHEN key ILIKE '%licen%practice%' OR key ILIKE '%license to practice%' THEN 'licence'
               WHEN key ILIKE '%right to work%' THEN 'rtw'
               WHEN key ILIKE '%nysc%' THEN 'nysc'
               WHEN key ILIKE '%language%' THEN 'lang'
             END AS field,
             val, created_at
        FROM answers
       WHERE coalesce(val,'') <> ''
    ),
    best AS (
      SELECT DISTINCT ON (person_id, field) person_id, field, val
        FROM picked WHERE field IS NOT NULL
       ORDER BY person_id, field, created_at DESC
    )
    SELECT person_id,
           max(val) FILTER (WHERE field = 'lga')     AS lga,
           max(val) FILTER (WHERE field = 'licence') AS licence,
           max(val) FILTER (WHERE field = 'rtw')     AS rtw,
           max(val) FILTER (WHERE field = 'nysc')    AS nysc,
           max(val) FILTER (WHERE field = 'lang')    AS lang
      FROM best GROUP BY person_id
  LOOP
    IF coalesce(btrim(coalesce(r.lga,'')),'') <> '' THEN
      UPDATE public.mu_people p
         SET lga = regexp_replace(r.lga, '\s+LGA$', '', 'i'),
             promotion_provenance = p.promotion_provenance || jsonb_build_object(
               'lga', jsonb_build_object('source','self_declared','origin','application_answer','promoted_at', now()))
       WHERE p.id = r.person_id AND coalesce(btrim(coalesce(p.lga,'')),'') = '';
      IF FOUND THEN lga_n := lga_n + 1; END IF;
    END IF;

    IF r.licence IS NOT NULL THEN
      UPDATE public.mu_people p
         SET licence_status = CASE WHEN r.licence ILIKE 'yes%' THEN 'confirmed'
                                   WHEN r.licence ILIKE 'no%'  THEN 'absent'
                                   ELSE p.licence_status END,
             promotion_provenance = p.promotion_provenance || jsonb_build_object(
               'licence_status', jsonb_build_object('source','self_declared','origin','application_answer','promoted_at', now()))
       WHERE p.id = r.person_id AND p.licence_status = 'unknown' AND (r.licence ILIKE 'yes%' OR r.licence ILIKE 'no%');
      IF FOUND THEN lic_n := lic_n + 1; END IF;
    END IF;

    IF r.rtw IS NOT NULL THEN
      UPDATE public.mu_people p
         SET right_to_work_status = CASE WHEN r.rtw ILIKE 'yes%' THEN 'confirmed'
                                         WHEN r.rtw ILIKE 'no%'  THEN 'absent'
                                         ELSE p.right_to_work_status END,
             right_to_work = CASE WHEN r.rtw ILIKE 'yes%' THEN true
                                  WHEN r.rtw ILIKE 'no%' THEN false ELSE p.right_to_work END,
             promotion_provenance = p.promotion_provenance || jsonb_build_object(
               'right_to_work', jsonb_build_object('source','self_declared','origin','application_answer','promoted_at', now()))
       WHERE p.id = r.person_id AND p.right_to_work_status = 'unknown' AND (r.rtw ILIKE 'yes%' OR r.rtw ILIKE 'no%');
      IF FOUND THEN rtw_n := rtw_n + 1; END IF;
    END IF;

    IF r.nysc IS NOT NULL THEN
      UPDATE public.mu_people p
         SET nysc_status = r.nysc
       WHERE p.id = r.person_id AND p.nysc_status IS NULL;
      IF FOUND THEN nysc_n := nysc_n + 1; END IF;
    END IF;

    IF coalesce(btrim(coalesce(r.lang,'')),'') <> '' THEN
      UPDATE public.mu_people p
         SET languages = (
               SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('language', btrim(t), 'fluency', 'Unstated')), '[]'::jsonb)
                 FROM unnest(string_to_array(r.lang, ',')) t
                WHERE btrim(t) <> ''
             )
       WHERE p.id = r.person_id AND coalesce(p.languages, '[]'::jsonb) = '[]'::jsonb;
      IF FOUND THEN lang_n := lang_n + 1; END IF;
    END IF;
  END LOOP;

  UPDATE public.mu_people p
     SET lga = j.lga_primary
    FROM public.join_applications j
   WHERE j.person_id = p.id
     AND coalesce(btrim(coalesce(p.lga,'')),'') = ''
     AND coalesce(btrim(coalesce(j.lga_primary,'')),'') <> ''
     AND (_person_id IS NULL OR p.id = _person_id);

  UPDATE public.mu_people p
     SET right_to_work_status = CASE WHEN j.right_to_work THEN 'confirmed' ELSE 'absent' END,
         right_to_work = j.right_to_work
    FROM public.join_applications j
   WHERE j.person_id = p.id
     AND p.right_to_work_status = 'unknown'
     AND j.right_to_work IS NOT NULL
     AND (_person_id IS NULL OR p.id = _person_id);

  UPDATE public.mu_people p
     SET licence_status = CASE WHEN j.license_to_practice ILIKE 'yes%' THEN 'confirmed'
                               WHEN j.license_to_practice ILIKE 'no%'  THEN 'absent'
                               ELSE p.licence_status END
    FROM public.join_applications j
   WHERE j.person_id = p.id
     AND p.licence_status = 'unknown'
     AND j.license_to_practice IS NOT NULL
     AND (_person_id IS NULL OR p.id = _person_id);

  UPDATE public.mu_people p
     SET nysc_status = j.nysc_status
    FROM public.join_applications j
   WHERE j.person_id = p.id AND p.nysc_status IS NULL AND j.nysc_status IS NOT NULL
     AND (_person_id IS NULL OR p.id = _person_id);

  -- Languages given on the network application form
  WITH src AS (
    SELECT DISTINCT ON (j.person_id) j.person_id, j.languages
      FROM public.join_applications j
     WHERE j.person_id IS NOT NULL
       AND jsonb_typeof(coalesce(j.languages, 'null'::jsonb)) = 'array'
       AND jsonb_array_length(coalesce(j.languages, '[]'::jsonb)) > 0
     ORDER BY j.person_id, j.created_at DESC
  )
  UPDATE public.mu_people p
     SET languages = src.languages
    FROM src
   WHERE p.id = src.person_id
     AND coalesce(p.languages, '[]'::jsonb) = '[]'::jsonb
     AND (_person_id IS NULL OR p.id = _person_id);
  GET DIAGNOSTICS avail_n = ROW_COUNT;
  lang_n := lang_n + avail_n;

  -- Availability pattern given on the network application form
  WITH src AS (
    SELECT DISTINCT ON (j.person_id) j.person_id, j.availability
      FROM public.join_applications j
     WHERE j.person_id IS NOT NULL AND coalesce(array_length(j.availability, 1), 0) > 0
     ORDER BY j.person_id, j.created_at DESC
  )
  UPDATE public.mu_people p
     SET availability = to_jsonb(src.availability)
    FROM src
   WHERE p.id = src.person_id
     AND coalesce(p.availability, '[]'::jsonb) = '[]'::jsonb
     AND (_person_id IS NULL OR p.id = _person_id);
  GET DIAGNOSTICS avail_n = ROW_COUNT;

  RETURN jsonb_build_object('lga', lga_n, 'licence_status', lic_n, 'right_to_work', rtw_n,
                            'nysc', nysc_n, 'languages', lang_n, 'availability_pattern', avail_n);
END;
$fn$;

-- 2) Route parity in the derived gap list
CREATE OR REPLACE FUNCTION public.mu_candidate_gaps_row(p public.mu_people)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  g text[] := '{}';
  lic_state text;
  pending text[];
BEGIN
  SELECT coalesce(array_agg(DISTINCT field), '{}')
    INTO pending
    FROM public.mu_parsed_fields
   WHERE person_id = p.id AND status = 'candidate_updated'
     AND coalesce(btrim(coalesce(value, '')), '') <> '';

  IF coalesce(btrim(coalesce(p.profession, '')), '') = '' THEN g := g || 'profession'::text; END IF;
  IF p.years_experience IS NULL THEN g := g || 'years_experience'::text; END IF;
  IF coalesce(btrim(coalesce(p.state, '')), '') = '' THEN g := g || 'state'::text; END IF;
  IF coalesce(btrim(coalesce(p.lga, '')), '') = '' THEN g := g || 'lga'::text; END IF;

  SELECT public.mu_credential_state(c.claim, c.evidence_document_id, c.verification_outcome, c.expires_at)
    INTO lic_state
    FROM public.mu_credentials c
   WHERE c.person_id = p.id AND c.credential_type = 'licence';
  lic_state := coalesce(lic_state, 'unknown');

  IF public.mu_expects_licence(p.profession) AND lic_state NOT IN ('declined', 'verified') THEN
    IF coalesce(btrim(coalesce(p.licensing_body, '')), '') = '' THEN g := g || 'licensing_body'::text; END IF;
    IF coalesce(btrim(coalesce(p.license_number, '')), '') = '' THEN g := g || 'license_number'::text; END IF;
    IF p.license_expiry IS NULL THEN g := g || 'license_expiry'::text; END IF;
  END IF;

  -- Asked on the network application form but not on every route: ask everyone.
  IF coalesce(p.languages, '[]'::jsonb) = '[]'::jsonb THEN g := g || 'languages'::text; END IF;
  IF p.right_to_work IS NULL AND coalesce(p.right_to_work_status, 'unknown') = 'unknown'
    THEN g := g || 'right_to_work'::text; END IF;
  IF public.mu_expects_licence(p.profession)
     AND coalesce(btrim(coalesce(p.nysc_status, '')), '') = ''
    THEN g := g || 'nysc_status'::text; END IF;
  IF coalesce(btrim(coalesce(p.sex, '')), '') = '' THEN g := g || 'sex'::text; END IF;

  IF p.last_availability_update IS NULL THEN g := g || 'availability'::text; END IF;

  SELECT coalesce(array_agg(x ORDER BY ord), '{}') INTO g
    FROM unnest(g) WITH ORDINALITY t(x, ord)
   WHERE NOT (x = ANY (pending));

  RETURN to_jsonb(g);
END;
$fn$;

-- 3) Backfill what we already hold, then re-derive gaps for everyone
SELECT public.mu_promote_application_answers(NULL);
UPDATE public.mu_people SET updated_at = now();