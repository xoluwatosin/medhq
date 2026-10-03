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
    'license_expiry','nysc_status','right_to_work','address_line','address_landmark','address_area'
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
    ELSIF k IN ('address_line','address_landmark','address_area') THEN
      UPDATE public.mu_people
         SET address_source = 'candidate_stated', address_captured_at = now()
       WHERE id = p.id;
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

  RETURN jsonb_build_object('changed', changes);
END;
$function$;

REVOKE ALL ON FUNCTION public.mu_candidate_update_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_candidate_update_profile(jsonb) TO authenticated;