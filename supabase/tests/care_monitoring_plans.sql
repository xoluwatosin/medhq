-- Pass 7.5D: monitoring plans. Rollback safe: every synthetic row is created
-- inside one statement that always ends by raising, so nothing it writes is
-- ever kept. Run it on a privileged (owner) connection. It borrows one existing
-- client and service for its synthetic episodes and changes neither.
--
-- A pass is reported as the final notice-shaped error:
--   care_monitoring_plans: all assertions passed
--
-- What it proves:
--   1. no anon or authenticated write privilege on either table;
--   2. only clinical staff change plans, and only through the functions;
--   3. one open plan per running episode;
--   4. item payloads are validated (fields, codes, frequency, self-entry);
--   5. a revision stops the original and creates one successor pointing back;
--   6. readers see by visibility: staff everything, an assigned care worker
--      family and care-team items, a family member with the clinical scope
--      family items only, anyone else nothing;
--   7. two episodes on one client never cross-read;
--   8. ending a plan stops its items and closes it to changes.

DO $$
DECLARE
  _admin uuid; _client uuid; _svc text;
  _u_carer uuid := gen_random_uuid(); _u_other uuid := gen_random_uuid();
  _u_fam uuid := gen_random_uuid(); _u_journey uuid := gen_random_uuid();
  _carer uuid; _other uuid; _fam uuid; _journey uuid; _basis uuid;
  _ep uuid; _ep2 uuid; _done uuid; _plan uuid; _plan2 uuid;
  _i_fam uuid; _i_team uuid; _i_prof uuid; _i_safe uuid; _i_new uuid;
  _r jsonb; _n integer; _t text;
BEGIN
  -- 1. table privileges --------------------------------------------------------
  FOREACH _t IN ARRAY ARRAY['public.care_monitoring_plans','public.care_monitoring_items'] LOOP
    IF has_table_privilege('authenticated', _t, 'INSERT')
       OR has_table_privilege('authenticated', _t, 'UPDATE')
       OR has_table_privilege('authenticated', _t, 'DELETE')
       OR has_table_privilege('anon', _t, 'SELECT')
       OR has_table_privilege('anon', _t, 'INSERT') THEN
      RAISE EXCEPTION 'care_monitoring_plans: % takes direct writes', _t;
    END IF;
  END LOOP;

  SELECT ur.user_id INTO _admin
    FROM public.user_roles ur
    JOIN public.admin_permissions ap ON ap.user_id = ur.user_id AND COALESCE(ap.is_active, true)
   WHERE ur.role = 'admin' LIMIT 1;
  IF _admin IS NULL THEN RAISE EXCEPTION 'care_monitoring_plans: no admin user to test as'; END IF;

  SELECT id INTO _client FROM public.clients ORDER BY created_at LIMIT 1;
  SELECT slug INTO _svc FROM public.services ORDER BY slug LIMIT 1;
  IF _client IS NULL OR _svc IS NULL THEN RAISE EXCEPTION 'care_monitoring_plans: no client or service to test with'; END IF;

  INSERT INTO public.care_episodes (client_id, service_code, status) VALUES (_client, _svc, 'active') RETURNING id INTO _ep;
  INSERT INTO public.care_episodes (client_id, service_code, status) VALUES (_client, _svc, 'active') RETURNING id INTO _ep2;
  INSERT INTO public.care_episodes (client_id, service_code, status) VALUES (_client, _svc, 'completed') RETURNING id INTO _done;

  -- 2. only clinical staff -------------------------------------------------------
  IF NOT private.is_super_admin(_admin) THEN
    UPDATE public.admin_permissions SET permissions = (permissions - 'care_clinical') WHERE user_id = _admin;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin::text, 'role', 'authenticated')::text, true);
    BEGIN
      PERFORM public.care_monitoring_plan_create(_ep, 'Test plan', NULL);
      RAISE EXCEPTION 'care_monitoring_plans: an admin without care_clinical created a plan';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM LIKE 'care_monitoring_plans:%' THEN RAISE; END IF;
    END;
  END IF;
  UPDATE public.admin_permissions SET permissions = permissions || '["care_clinical"]'::jsonb
   WHERE user_id = _admin AND NOT permissions ? 'care_clinical';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin::text, 'role', 'authenticated')::text, true);

  -- 3. one open plan per running episode ----------------------------------------
  _plan := public.care_monitoring_plan_create(_ep, 'Blood pressure and wound', current_date + 28);
  BEGIN
    PERFORM public.care_monitoring_plan_create(_ep, 'Second plan', NULL);
    RAISE EXCEPTION 'care_monitoring_plans: a second open plan was created';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_monitoring_plans:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.care_monitoring_plan_create(_done, 'Plan on a finished episode', NULL);
    RAISE EXCEPTION 'care_monitoring_plans: a plan was created on a completed episode';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_monitoring_plans:%' THEN RAISE; END IF;
  END;

  -- 4. item validation ------------------------------------------------------------
  _i_fam := public.care_monitoring_item_add(_plan, jsonb_build_object(
    'observation_type', 'blood_pressure', 'purpose', 'Hypertension follow-up', 'frequency', 'daily',
    'times_per_period', 2, 'unit', 'mmHg', 'target', jsonb_build_object('systolic_max', 140),
    'visibility', 'family', 'self_entry_permitted', true, 'escalation_ref', 'bp.default'));
  _i_team := public.care_monitoring_item_add(_plan, jsonb_build_object(
    'observation_type', 'wound_appearance', 'frequency', 'each_visit', 'visibility', 'care_team'));
  _i_prof := public.care_monitoring_item_add(_plan, jsonb_build_object(
    'observation_type', 'medication_review', 'frequency', 'weekly', 'responsible_capability', 'nurse',
    'visibility', 'professional'));
  _i_safe := public.care_monitoring_item_add(_plan, jsonb_build_object(
    'observation_type', 'unexplained_bruising', 'frequency', 'as_needed', 'visibility', 'safeguarding'));

  BEGIN
    PERFORM public.care_monitoring_item_add(_plan, jsonb_build_object('observation_type', 'pulse', 'frequency', 'daily', 'colour', 'red'));
    RAISE EXCEPTION 'care_monitoring_plans: an unknown field was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_monitoring_plans:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.care_monitoring_item_add(_plan, jsonb_build_object('observation_type', 'pulse', 'frequency', 'daily',
      'visibility', 'care_team', 'self_entry_permitted', true));
    RAISE EXCEPTION 'care_monitoring_plans: family self-entry allowed on a care-team item';
  EXCEPTION WHEN raise_exception OR check_violation THEN
    IF SQLERRM LIKE 'care_monitoring_plans:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.care_monitoring_item_add(_plan, jsonb_build_object('observation_type', 'pulse', 'frequency', 'each_visit',
      'times_per_period', 3));
    RAISE EXCEPTION 'care_monitoring_plans: times per period accepted on each_visit';
  EXCEPTION WHEN raise_exception OR check_violation THEN
    IF SQLERRM LIKE 'care_monitoring_plans:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.care_monitoring_item_add(_plan, jsonb_build_object('observation_type', 'Blood Pressure!', 'frequency', 'daily'));
    RAISE EXCEPTION 'care_monitoring_plans: a malformed observation type was accepted';
  EXCEPTION WHEN raise_exception OR check_violation THEN
    IF SQLERRM LIKE 'care_monitoring_plans:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.care_monitoring_item_add(_plan, jsonb_build_object('observation_type', 'pulse', 'frequency', 'hourly'));
    RAISE EXCEPTION 'care_monitoring_plans: an unknown frequency was accepted';
  EXCEPTION WHEN raise_exception OR check_violation THEN
    IF SQLERRM LIKE 'care_monitoring_plans:%' THEN RAISE; END IF;
  END;

  -- 5. a revision supersedes ------------------------------------------------------
  _i_new := public.care_monitoring_item_revise(_i_team, jsonb_build_object(
    'observation_type', 'wound_appearance', 'frequency', 'daily', 'visibility', 'care_team',
    'method', 'Photograph and measure'), 'Dressing changed to daily');
  SELECT count(*) INTO _n FROM public.care_monitoring_items
   WHERE id = _i_team AND status = 'stopped' AND stop_reason LIKE 'Revised:%';
  IF _n <> 1 THEN RAISE EXCEPTION 'care_monitoring_plans: the revised item was not stopped'; END IF;
  SELECT count(*) INTO _n FROM public.care_monitoring_items WHERE supersedes_id = _i_team AND status = 'active';
  IF _n <> 1 THEN RAISE EXCEPTION 'care_monitoring_plans: expected one successor, found %', _n; END IF;
  BEGIN
    PERFORM public.care_monitoring_item_revise(_i_team, jsonb_build_object('observation_type', 'wound_appearance', 'frequency', 'weekly'), 'Again');
    RAISE EXCEPTION 'care_monitoring_plans: a stopped item was revised';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_monitoring_plans:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.care_monitoring_item_stop(_i_new, '   ');
    RAISE EXCEPTION 'care_monitoring_plans: an item was stopped without a reason';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_monitoring_plans:%' THEN RAISE; END IF;
  END;

  -- 6. readers --------------------------------------------------------------------
  _r := public.care_monitoring_read(_ep);
  IF jsonb_array_length(_r->'items') <> 4 THEN
    RAISE EXCEPTION 'care_monitoring_plans: staff should see 4 active items, saw %', jsonb_array_length(_r->'items');
  END IF;

  INSERT INTO auth.users (id, email) VALUES
    (_u_carer, 'synthetic-mp1@example.invalid'), (_u_other, 'synthetic-mp2@example.invalid'),
    (_u_fam, 'synthetic-mp3@example.invalid'), (_u_journey, 'synthetic-mp4@example.invalid');
  INSERT INTO public.mu_people (full_name, auth_user_id, is_staff, staff_status, work_setting)
  VALUES ('Synthetic monitoring carer', _u_carer, true, 'active', 'field') RETURNING id INTO _carer;
  INSERT INTO public.mu_people (full_name, auth_user_id, is_staff, staff_status, work_setting)
  VALUES ('Synthetic unassigned carer', _u_other, true, 'active', 'field') RETURNING id INTO _other;
  PERFORM public.care_worker_capability_set(_carer, true, 'test');
  PERFORM public.care_worker_capability_set(_other, true, 'test');
  INSERT INTO public.care_delivery_assignments (episode_id, person_id, capability_code, status, effective_from)
  VALUES (_ep, _carer, 'care_worker', 'active', current_date);

  INSERT INTO public.care_people (full_name, auth_user_id) VALUES ('Synthetic family reader', _u_fam) RETURNING id INTO _fam;
  INSERT INTO public.care_access_bases (person_id, client_id, basis_kind) VALUES (_fam, _client, 'client_consent') RETURNING id INTO _basis;
  INSERT INTO public.care_access_grants (person_id, client_id, journey_scope, clinical_scope, clinical_basis_id, state)
  VALUES (_fam, _client, true, true, _basis, 'active');
  INSERT INTO public.care_people (full_name, auth_user_id) VALUES ('Synthetic journey reader', _u_journey) RETURNING id INTO _journey;
  INSERT INTO public.care_access_grants (person_id, client_id, journey_scope, state)
  VALUES (_journey, _client, true, 'active');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_carer::text, 'role', 'authenticated')::text, true);
  _r := public.care_monitoring_read(_ep);
  SELECT string_agg(x->>'visibility', ',' ORDER BY x->>'visibility') INTO _t FROM jsonb_array_elements(_r->'items') x;
  IF _t IS DISTINCT FROM 'care_team,family' THEN
    RAISE EXCEPTION 'care_monitoring_plans: assigned carer saw % (expected care_team,family)', _t;
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_other::text, 'role', 'authenticated')::text, true);
  IF public.care_monitoring_read(_ep) IS NOT NULL THEN
    RAISE EXCEPTION 'care_monitoring_plans: an unassigned carer read the plan';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_fam::text, 'role', 'authenticated')::text, true);
  _r := public.care_monitoring_read(_ep);
  SELECT string_agg(x->>'visibility', ',') INTO _t FROM jsonb_array_elements(_r->'items') x;
  IF _t IS DISTINCT FROM 'family' THEN
    RAISE EXCEPTION 'care_monitoring_plans: family reader saw % (expected family)', _t;
  END IF;
  BEGIN
    PERFORM public.care_monitoring_item_stop(_i_fam, 'family tried');
    RAISE EXCEPTION 'care_monitoring_plans: a family reader changed the plan';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_monitoring_plans:%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_journey::text, 'role', 'authenticated')::text, true);
  IF public.care_monitoring_read(_ep) IS NOT NULL THEN
    RAISE EXCEPTION 'care_monitoring_plans: a journey-only reader read the clinical plan';
  END IF;

  -- The tables stay closed to everyone but staff.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_carer::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO _n FROM public.care_monitoring_items;
  EXECUTE 'RESET ROLE';
  IF _n <> 0 THEN RAISE EXCEPTION 'care_monitoring_plans: a carer read % items directly', _n; END IF;

  -- 7. two episodes on one client never cross-read --------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin::text, 'role', 'authenticated')::text, true);
  _plan2 := public.care_monitoring_plan_create(_ep2, 'Other episode', NULL);
  PERFORM public.care_monitoring_item_add(_plan2, jsonb_build_object('observation_type', 'feeding', 'frequency', 'daily', 'visibility', 'family'));
  _r := public.care_monitoring_read(_ep2);
  IF jsonb_array_length(_r->'items') <> 1 OR _r->'items'->0->>'observation_type' <> 'feeding' THEN
    RAISE EXCEPTION 'care_monitoring_plans: episodes cross-read (%)', _r;
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_carer::text, 'role', 'authenticated')::text, true);
  IF public.care_monitoring_read(_ep2) IS NOT NULL THEN
    RAISE EXCEPTION 'care_monitoring_plans: a carer read an episode they are not assigned to';
  END IF;

  -- 8. ending a plan ----------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin::text, 'role', 'authenticated')::text, true);
  PERFORM public.care_monitoring_plan_end(_plan, 'Discharged');
  SELECT count(*) INTO _n FROM public.care_monitoring_items WHERE plan_id = _plan AND status = 'active';
  IF _n <> 0 THEN RAISE EXCEPTION 'care_monitoring_plans: % items still active after the plan ended', _n; END IF;
  BEGIN
    PERFORM public.care_monitoring_item_add(_plan, jsonb_build_object('observation_type', 'pulse', 'frequency', 'daily'));
    RAISE EXCEPTION 'care_monitoring_plans: an item was added to an ended plan';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_monitoring_plans:%' THEN RAISE; END IF;
  END;
  IF (public.care_monitoring_read(_ep)->'plan') <> 'null'::jsonb THEN
    RAISE EXCEPTION 'care_monitoring_plans: an ended plan is still read as open';
  END IF;

  RAISE EXCEPTION 'care_monitoring_plans: all assertions passed';
END $$;
