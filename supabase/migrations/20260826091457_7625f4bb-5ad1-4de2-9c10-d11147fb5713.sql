-- 1) Trigger: run promotion as internal, best-effort housekeeping.
CREATE OR REPLACE FUNCTION public.mu_after_parse_promote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('mu.internal_caller', 'on', true);
  BEGIN
    PERFORM public.mu_promote_application_answers(NEW.id);
    PERFORM public.mu_promote_parsed_fields(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'mu_after_parse_promote: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

-- 2) Guards: allow the internal trigger path, still refuse direct non-admin calls.
CREATE OR REPLACE FUNCTION public.mu_promote_application_answers(_person_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  lga_n int := 0; lic_n int := 0; rtw_n int := 0; nysc_n int := 0; lang_n int := 0; avail_n int := 0;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT private.has_role(auth.uid(), 'admin'::app_role)
     AND current_setting('mu.internal_caller', true) IS DISTINCT FROM 'on' THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.mu_promote_parsed_fields(_person_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  promoted int := 0;
  skipped  int := 0;
  conflicts int := 0;
  r record;
BEGIN
  -- Internal callers (triggers, the scheduler) set mu.internal_caller.
  IF auth.uid() IS NOT NULL
     AND NOT private.has_role(auth.uid(), 'admin'::app_role)
     AND current_setting('mu.internal_caller', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  FOR r IN
    WITH best AS (
      SELECT DISTINCT ON (pf.person_id, pf.field)
             pf.id, pf.person_id, pf.field, btrim(pf.value) AS value, pf.confidence
        FROM public.mu_parsed_fields pf
       WHERE pf.field IN ('profession','licensing_body','state','lga','years_experience')
         AND coalesce(btrim(pf.value), '') <> ''
         AND (_person_id IS NULL OR pf.person_id = _person_id)
       ORDER BY pf.person_id, pf.field, pf.confidence DESC, pf.created_at DESC
    )
    SELECT * FROM best
  LOOP
    IF r.field = 'years_experience' THEN
      IF EXISTS (
        SELECT 1 FROM public.mu_people p
         WHERE p.id = r.person_id
           AND p.years_experience IS NOT NULL
           AND r.value ~ '^[0-9]+$'
           AND p.years_experience <> r.value::int
      ) THEN
        INSERT INTO public.mu_field_conflicts (person_id, field, stored_value, parsed_value, parsed_field_id)
        SELECT r.person_id, r.field, p.years_experience::text, r.value, r.id
          FROM public.mu_people p WHERE p.id = r.person_id
        ON CONFLICT (person_id, field) DO UPDATE
          SET stored_value = EXCLUDED.stored_value,
              parsed_value = EXCLUDED.parsed_value,
              parsed_field_id = EXCLUDED.parsed_field_id;
        conflicts := conflicts + 1;
      END IF;
      CONTINUE;
    END IF;

    IF r.field = 'profession' THEN
      UPDATE public.mu_people p
         SET profession = r.value,
             profession_source = 'parsed',
             profession_confidence = r.confidence,
             promotion_provenance = p.promotion_provenance || jsonb_build_object(
               'profession', jsonb_build_object(
                 'parsed_field_id', r.id, 'confidence', r.confidence,
                 'source', 'parsed', 'promoted_at', now()))
       WHERE p.id = r.person_id
         AND coalesce(btrim(coalesce(p.profession,'')), '') = '';
    ELSIF r.field = 'licensing_body' THEN
      UPDATE public.mu_people p
         SET licensing_body = r.value,
             promotion_provenance = p.promotion_provenance || jsonb_build_object(
               'licensing_body', jsonb_build_object(
                 'parsed_field_id', r.id, 'confidence', r.confidence,
                 'source', 'parsed', 'promoted_at', now()))
       WHERE p.id = r.person_id
         AND coalesce(btrim(coalesce(p.licensing_body,'')), '') = '';
    ELSIF r.field = 'state' THEN
      UPDATE public.mu_people p
         SET state = r.value,
             promotion_provenance = p.promotion_provenance || jsonb_build_object(
               'state', jsonb_build_object(
                 'parsed_field_id', r.id, 'confidence', r.confidence,
                 'source', 'parsed', 'promoted_at', now()))
       WHERE p.id = r.person_id
         AND coalesce(btrim(coalesce(p.state,'')), '') = '';
    ELSIF r.field = 'lga' THEN
      UPDATE public.mu_people p
         SET lga = r.value,
             promotion_provenance = p.promotion_provenance || jsonb_build_object(
               'lga', jsonb_build_object(
                 'parsed_field_id', r.id, 'confidence', r.confidence,
                 'source', 'parsed', 'promoted_at', now()))
       WHERE p.id = r.person_id
         AND coalesce(btrim(coalesce(p.lga,'')), '') = '';
    END IF;

    IF FOUND THEN
      promoted := promoted + 1;
    ELSE
      skipped := skipped + 1;
      INSERT INTO public.mu_field_conflicts (person_id, field, stored_value, parsed_value, parsed_field_id)
      SELECT r.person_id, r.field,
             CASE r.field WHEN 'profession' THEN p.profession
                          WHEN 'licensing_body' THEN p.licensing_body
                          WHEN 'state' THEN p.state
                          WHEN 'lga' THEN p.lga END,
             r.value, r.id
        FROM public.mu_people p
       WHERE p.id = r.person_id
         AND lower(btrim(coalesce(
               CASE r.field WHEN 'profession' THEN p.profession
                            WHEN 'licensing_body' THEN p.licensing_body
                            WHEN 'state' THEN p.state
                            WHEN 'lga' THEN p.lga END, '')))
             <> lower(r.value)
      ON CONFLICT (person_id, field) DO UPDATE
        SET stored_value = EXCLUDED.stored_value,
            parsed_value = EXCLUDED.parsed_value,
            parsed_field_id = EXCLUDED.parsed_field_id;
      IF FOUND THEN conflicts := conflicts + 1; END IF;
    END IF;
  END LOOP;

  UPDATE public.mu_people
     SET profession_source = 'self_declared'
   WHERE profession IS NOT NULL AND profession_source IS NULL;

  RETURN jsonb_build_object('promoted', promoted, 'skipped', skipped, 'conflicts', conflicts);
END;
$function$;

-- 3) Candidate profile update: stamp candidate-stated sources even when the
--    value itself is unchanged (confirming an existing answer still counts).
CREATE OR REPLACE FUNCTION public.mu_candidate_update_profile(_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p            public.mu_people%ROWTYPE;
  allowed      text[] := ARRAY[
    'state','lga','profession','sex','languages','licensing_body','license_number',
    'license_expiry','nysc_status','right_to_work','address_line','address_landmark','address_area',
    'track','institution','course_of_study','study_level','year_of_study','expected_graduation',
    'joining_statement'
  ];
  k            text;
  v            text;
  old_value    text;
  changes      jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO p FROM public.mu_people WHERE auth_user_id = auth.uid();
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'No profile for this account';
  END IF;

  FOR k, v IN SELECT key, btrim(coalesce(value #>> '{}', '')) FROM jsonb_each(_patch)
  LOOP
    IF NOT (k = ANY(allowed)) THEN CONTINUE; END IF;

    EXECUTE format('SELECT (%I)::text FROM public.mu_people WHERE id = $1', k)
      INTO old_value USING p.id;

    IF coalesce(old_value, '') = coalesce(v, '') THEN CONTINUE; END IF;

    IF k = 'languages' THEN
      UPDATE public.mu_people
         SET languages = (
               SELECT coalesce(jsonb_agg(jsonb_build_object('language', t, 'fluency', 'Unstated')), '[]'::jsonb)
                 FROM unnest(string_to_array(v, ',')) AS t
                WHERE btrim(t) <> ''
             )
       WHERE id = p.id;
    ELSIF k = 'right_to_work' THEN
      UPDATE public.mu_people
         SET right_to_work = (lower(v) LIKE 'y%'),
             right_to_work_status = CASE WHEN lower(v) LIKE 'y%' THEN 'confirmed' ELSE 'absent' END
       WHERE id = p.id;
    ELSIF k = 'license_expiry' THEN
      UPDATE public.mu_people
         SET license_expiry = nullif(v, '')::date
       WHERE id = p.id;
    ELSE
      EXECUTE format('UPDATE public.mu_people SET %I = nullif($1, %L) WHERE id = $2', k, '')
        USING v, p.id;
    END IF;

    IF k IN ('state','lga') THEN
      UPDATE public.mu_people SET location_source = 'candidate_stated' WHERE id = p.id;
    ELSIF k = 'profession' THEN
      UPDATE public.mu_people SET profession_source = 'candidate_stated' WHERE id = p.id;
    ELSIF k = 'track' THEN
      UPDATE public.mu_people
         SET track_source = 'candidate_confirmed', track_confirmed_at = now()
       WHERE id = p.id;
    ELSIF k IN ('address_line','address_landmark','address_area') THEN
      UPDATE public.mu_people SET address_source = 'candidate_stated', address_captured_at = now() WHERE id = p.id;
    END IF;

    changes := changes || jsonb_build_object('field', k, 'from', old_value, 'to', v);

    INSERT INTO public.mu_activity (person_id, action, detail, actor_id, actor_name)
    VALUES (
      p.id,
      'candidate_updated_profile',
      jsonb_build_object('field', k, 'from', old_value, 'to', v),
      auth.uid(),
      p.full_name
    );
  END LOOP;

  -- Confirming an answer that was already on file still counts as stated by
  -- the candidate, even though nothing changed above.
  IF _patch ? 'state' OR _patch ? 'lga' THEN
    UPDATE public.mu_people SET location_source = 'candidate_stated' WHERE id = p.id;
  END IF;
  IF _patch ? 'track' THEN
    UPDATE public.mu_people
       SET track_source = 'candidate_confirmed',
           track_confirmed_at = coalesce(track_confirmed_at, now())
     WHERE id = p.id;
  END IF;

  RETURN jsonb_build_object('changed', changes);
END;
$function$;