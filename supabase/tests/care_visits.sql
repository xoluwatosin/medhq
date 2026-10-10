-- Build step 3: schedule and visits. Rollback safe: every synthetic row is
-- created inside one statement that always ends by raising, so nothing it
-- writes is ever kept. Run it on a privileged (owner) connection. It borrows
-- one existing client and service and changes neither (the synthetic home it
-- pins is created here and links to no client).
--
-- A pass is reported as the final notice-shaped error:
--   care_visits: all assertions passed
--
-- What it proves:
--   1. no anon or authenticated write privilege on the new tables;
--   2. only coordinators and clinical staff schedule;
--   3. patterns make visits on the right days in Lagos time, once only, and
--      leave a slot open when the worker is already booked;
--   4. a worker must be able to use the app, be assigned on the date, and be
--      free; one primary carer per episode;
--   5. only the assigned worker checks in, inside the window; distance is
--      measured and a far or missing location is flagged, not blocked;
--   6. a replayed check-in or check-out changes nothing and adds no event;
--      events cannot be edited;
--   7. "My visits" shows a worker only their own visits;
--   8. alerts report overdue checkouts, visits not started, unassigned visits
--      and location flags, to schedulers only;
--   9. delivery records may name a visit only on the same episode;
--  10. ending a pattern cancels its visits that have not started.

DO $$
DECLARE
  _admin uuid; _client uuid; _svc text; _home uuid;
  _u_carer uuid := gen_random_uuid(); _u_other uuid := gen_random_uuid();
  _u_office uuid := gen_random_uuid(); _u_coord uuid := gen_random_uuid();
  _carer uuid; _other uuid; _office uuid;
  _ep uuid; _ep2 uuid; _pat uuid; _pat2 uuid;
  _v1 uuid; _v2 uuid; _v3 uuid; _v4 uuid; _vfar uuid; _ev1 uuid := gen_random_uuid(); _ev2 uuid := gen_random_uuid();
  _r jsonb; _n integer; _t text; _d date; _ts timestamptz;
BEGIN
  -- 1. privileges --------------------------------------------------------------
  FOREACH _t IN ARRAY ARRAY['public.care_home_pins','public.care_roster_patterns','public.care_visits','public.care_visit_events'] LOOP
    IF has_table_privilege('authenticated', _t, 'INSERT') OR has_table_privilege('authenticated', _t, 'UPDATE')
       OR has_table_privilege('authenticated', _t, 'DELETE') OR has_table_privilege('anon', _t, 'SELECT') THEN
      RAISE EXCEPTION 'care_visits: % takes direct writes', _t;
    END IF;
  END LOOP;

  -- Setup ---------------------------------------------------------------------
  SELECT ur.user_id INTO _admin FROM public.user_roles ur
    JOIN public.admin_permissions ap ON ap.user_id = ur.user_id AND COALESCE(ap.is_active, true)
   WHERE ur.role = 'admin' LIMIT 1;
  IF _admin IS NULL THEN RAISE EXCEPTION 'care_visits: no admin user to test as'; END IF;
  UPDATE public.admin_permissions SET permissions = permissions || '["care_clinical","workforce"]'::jsonb WHERE user_id = _admin;
  SELECT id INTO _client FROM public.clients ORDER BY created_at LIMIT 1;
  SELECT slug INTO _svc FROM public.services ORDER BY slug LIMIT 1;
  IF _client IS NULL OR _svc IS NULL THEN RAISE EXCEPTION 'care_visits: no client or service to test with'; END IF;

  INSERT INTO public.care_episodes (client_id, service_code, status) VALUES (_client, _svc, 'active') RETURNING id INTO _ep;
  INSERT INTO public.care_episodes (client_id, service_code, status) VALUES (_client, _svc, 'active') RETURNING id INTO _ep2;

  INSERT INTO auth.users (id, email) VALUES
    (_u_carer, 'synthetic-cv1@example.invalid'), (_u_other, 'synthetic-cv2@example.invalid'),
    (_u_office, 'synthetic-cv3@example.invalid'), (_u_coord, 'synthetic-cv4@example.invalid');
  INSERT INTO public.mu_people (full_name, auth_user_id, is_staff, staff_status, work_setting)
  VALUES ('Synthetic visit carer', _u_carer, true, 'active', 'field') RETURNING id INTO _carer;
  INSERT INTO public.mu_people (full_name, auth_user_id, is_staff, staff_status, work_setting)
  VALUES ('Synthetic second carer', _u_other, true, 'active', 'field') RETURNING id INTO _other;
  INSERT INTO public.mu_people (full_name, auth_user_id, is_staff, staff_status, work_setting)
  VALUES ('Synthetic office person', _u_office, true, 'active', 'office') RETURNING id INTO _office;
  INSERT INTO public.user_roles (user_id, role) VALUES (_u_coord, 'admin');
  INSERT INTO public.admin_permissions (user_id, email, permissions)
  VALUES (_u_coord, 'synthetic-cv4@example.invalid', '["care_coordinator"]'::jsonb);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin::text, 'role', 'authenticated')::text, true);
  PERFORM public.care_worker_capability_set(_carer, true, 'test');
  PERFORM public.care_worker_capability_set(_other, true, 'test');
  INSERT INTO public.care_delivery_assignments (episode_id, person_id, capability_code, status, effective_from) VALUES
    (_ep, _carer, 'care_worker', 'active', current_date - 1),
    (_ep, _other, 'care_worker', 'active', current_date - 1),
    (_ep, _office, 'care_worker', 'active', current_date - 1),
    (_ep2, _carer, 'care_worker', 'active', current_date - 1);

  -- 2. only schedulers ------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_carer::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.care_visit_create(_ep, jsonb_build_object('scheduled_start', now() + interval '1 day', 'duration_minutes', 60));
    RAISE EXCEPTION 'care_visits: a carer scheduled a visit';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_visits:%' THEN RAISE; END IF;
  END;
  IF public.care_visit_alerts() IS NOT NULL THEN RAISE EXCEPTION 'care_visits: a carer read alerts'; END IF;

  -- The coordinator schedules (and reads), without clinical permission.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_coord::text, 'role', 'authenticated')::text, true);

  -- 3. patterns ---------------------------------------------------------------------
  -- Every day at 08:00 Lagos for 30 minutes, primary carer.
  _pat := public.care_roster_pattern_create(_ep, jsonb_build_object(
    'person_id', _carer, 'is_primary', true, 'weekdays', '[1,2,3,4,5,6,7]'::jsonb,
    'start_time', '08:00', 'duration_minutes', 30, 'valid_from', current_date + 1));
  _r := public.care_visits_generate(_ep, current_date + 7);
  IF (_r->>'created')::int <> 7 OR (_r->>'open')::int <> 0 THEN
    RAISE EXCEPTION 'care_visits: expected 7 visits, got %', _r;
  END IF;
  IF EXISTS (SELECT 1 FROM public.care_visits WHERE pattern_id = _pat
              AND (to_char(scheduled_start AT TIME ZONE 'Africa/Lagos', 'HH24:MI') <> '08:00'
                   OR scheduled_end - scheduled_start <> interval '30 minutes' OR person_id <> _carer)) THEN
    RAISE EXCEPTION 'care_visits: generated visits have the wrong time, length or worker';
  END IF;
  _r := public.care_visits_generate(_ep, current_date + 7);
  IF (_r->>'created')::int <> 0 THEN RAISE EXCEPTION 'care_visits: generating twice made more visits (%)', _r; END IF;

  -- A second pattern for the same worker at an overlapping time on Mondays only:
  -- the slot is made, but open.
  _pat2 := public.care_roster_pattern_create(_ep, jsonb_build_object(
    'person_id', _carer, 'weekdays', '[1]'::jsonb, 'start_time', '08:15', 'duration_minutes', 60,
    'valid_from', current_date + 1, 'valid_until', current_date + 7));
  _r := public.care_visits_generate(_ep, current_date + 7);
  IF (_r->>'created')::int <> 1 OR (_r->>'open')::int <> 1 THEN
    RAISE EXCEPTION 'care_visits: overlapping slot not left open (%)', _r;
  END IF;
  SELECT extract(isodow FROM scheduled_start AT TIME ZONE 'Africa/Lagos')::int INTO _n
    FROM public.care_visits WHERE pattern_id = _pat2;
  IF _n <> 1 THEN RAISE EXCEPTION 'care_visits: Monday pattern made a visit on day %', _n; END IF;

  BEGIN
    PERFORM public.care_visits_generate(_ep, current_date + 90);
    RAISE EXCEPTION 'care_visits: generated more than 62 days ahead';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_visits:%' THEN RAISE; END IF;
  END;

  -- 4. who can take a visit -------------------------------------------------------
  BEGIN
    PERFORM public.care_roster_pattern_create(_ep, jsonb_build_object(
      'person_id', _other, 'is_primary', true, 'weekdays', '[2]'::jsonb, 'start_time', '12:00', 'duration_minutes', 30));
    RAISE EXCEPTION 'care_visits: a second primary carer was set';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_visits:%' THEN RAISE; END IF;
  END;
  FOREACH _t IN ARRAY ARRAY[_office::text, _other::text] LOOP
    BEGIN
      PERFORM public.care_visit_create(_ep2, jsonb_build_object(
        'scheduled_start', now() + interval '3 hours', 'duration_minutes', 60, 'person_id', _t));
      RAISE EXCEPTION 'care_visits: % was booked without app access or an assignment', _t;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM LIKE 'care_visits:%' THEN RAISE; END IF;
    END;
  END LOOP;
  BEGIN
    PERFORM public.care_visit_create(_ep, jsonb_build_object('scheduled_start', now() + interval '1 day', 'duration_minutes', 5));
    RAISE EXCEPTION 'care_visits: a 5-minute visit was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_visits:%' THEN RAISE; END IF;
  END;

  -- A synthetic pinned home on Victoria Island (links to no client), so a
  -- visit can carry an expected location.
  INSERT INTO public.care_homes (address_line, landmark) VALUES ('1 Synthetic Close', 'Opposite the test pharmacy')
  RETURNING id INTO _home;
  PERFORM public.care_home_pin_set(_home, 6.428055, 3.421955, 'Blue gate');

  -- One-off visits for the carer: one starting soon (episode one), one later on
  -- episode two; and one for the other carer.
  _v1 := public.care_visit_create(_ep, jsonb_build_object('scheduled_start', now() + interval '10 minutes', 'duration_minutes', 45));
  PERFORM public.care_visit_assign(_v1, _carer);
  _v2 := public.care_visit_create(_ep2, jsonb_build_object('scheduled_start', now() + interval '3 hours', 'duration_minutes', 60, 'person_id', _carer));
  _v3 := public.care_visit_create(_ep, jsonb_build_object('scheduled_start', now() + interval '20 minutes', 'duration_minutes', 30, 'person_id', _other));
  BEGIN
    PERFORM public.care_visit_assign(_v3, _carer);
    RAISE EXCEPTION 'care_visits: a worker was double-booked';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_visits:%' THEN RAISE; END IF;
  END;
  -- Give v1 and v3 the pinned home's location (as if the client lived there).
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.care_visits SET expected_lat = 6.428055, expected_lng = 3.421955,
         expected_address = '1 Synthetic Close' WHERE id IN (_v1, _v3);

  -- 5. check-in ---------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_other::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.care_visit_check_in(_v1, gen_random_uuid(), 6.428, 3.422, 10);
    RAISE EXCEPTION 'care_visits: someone else checked in to a visit';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_visits:%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_carer::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.care_visit_check_in(_v2, gen_random_uuid(), 6.428, 3.422, 10);
    RAISE EXCEPTION 'care_visits: checked in three hours early';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_visits:%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'Check-in opens%' THEN RAISE EXCEPTION 'care_visits: wrong refusal (%)', SQLERRM; END IF;
  END;
  -- About 50 metres from the pin: in progress, no flags.
  _r := public.care_visit_check_in(_v1, _ev1, 6.428500, 3.421955, 15);
  SELECT * INTO STRICT _n FROM (SELECT check_in_distance_m FROM public.care_visits WHERE id = _v1) x;
  IF _r->>'status' <> 'in_progress' OR _n NOT BETWEEN 40 AND 60 OR jsonb_array_length(_r->'location_flags') <> 0 THEN
    RAISE EXCEPTION 'care_visits: near check-in recorded wrongly (% / % m)', _r, _n;
  END IF;

  -- 6. replays are idempotent -------------------------------------------------------
  _r := public.care_visit_check_in(_v1, _ev1, 6.5, 3.5, 15);
  SELECT count(*) INTO _n FROM public.care_visit_events WHERE visit_id = _v1;
  IF _n <> 1 OR (SELECT check_in_lat FROM public.care_visits WHERE id = _v1) <> 6.428500 THEN
    RAISE EXCEPTION 'care_visits: a replayed check-in changed the visit or added an event';
  END IF;
  BEGIN
    PERFORM public.care_visit_check_in(_v1, gen_random_uuid(), 6.4285, 3.4219, 15);
    RAISE EXCEPTION 'care_visits: checked in twice';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_visits:%' THEN RAISE; END IF;
  END;
  -- Check out about 2 km away: completed, flagged far.
  _r := public.care_visit_check_out(_v1, _ev2, 6.446, 3.421955, 20, 'Ate well. Medication taken.');
  IF _r->>'status' <> 'completed' OR NOT (_r->'location_flags') ? 'far_at_check_out' THEN
    RAISE EXCEPTION 'care_visits: far check-out not flagged (%)', _r;
  END IF;
  _r := public.care_visit_check_out(_v1, _ev2, 6.446, 3.421955, 20, 'Again');
  IF (SELECT count(*) FROM public.care_visit_events WHERE visit_id = _v1) <> 2
     OR (SELECT check_out_note FROM public.care_visits WHERE id = _v1) <> 'Ate well. Medication taken.' THEN
    RAISE EXCEPTION 'care_visits: a replayed check-out changed the visit';
  END IF;
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    UPDATE public.care_visit_events SET kind = 'edited' WHERE visit_id = _v1;
    RAISE EXCEPTION 'care_visits: a visit event was edited';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_visits:%' THEN RAISE; END IF;
  END;

  -- No location and far check-in: flagged, still allowed.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_other::text, 'role', 'authenticated')::text, true);
  _r := public.care_visit_check_in(_v3, gen_random_uuid());
  IF _r->>'status' <> 'in_progress' OR NOT (_r->'location_flags') ? 'no_location_at_check_in' THEN
    RAISE EXCEPTION 'care_visits: check-in without location not flagged (%)', _r;
  END IF;

  -- 7. my visits ---------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_carer::text, 'role', 'authenticated')::text, true);
  _r := public.care_my_visits(NULL, 7);
  IF NOT _r @> jsonb_build_array(jsonb_build_object('id', _v1)) OR NOT _r @> jsonb_build_array(jsonb_build_object('id', _v2))
     OR _r @> jsonb_build_array(jsonb_build_object('id', _v3)) THEN
    RAISE EXCEPTION 'care_visits: my visits wrong (%)', _r;
  END IF;
  IF _r->0->>'client_name' IS NULL THEN RAISE EXCEPTION 'care_visits: my visits lacks the client name'; END IF;
  -- The carer cannot read the tables directly.
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO _n FROM public.care_visits;
  EXECUTE 'RESET ROLE';
  IF _n <> 0 THEN RAISE EXCEPTION 'care_visits: a carer read % visits directly', _n; END IF;
  -- Office staff (no app access) see nothing.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_office::text, 'role', 'authenticated')::text, true);
  IF jsonb_array_length(public.care_my_visits(NULL, 7)) <> 0 THEN RAISE EXCEPTION 'care_visits: office staff saw visits'; END IF;

  -- 8. alerts ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  -- v3 overran; v2 never started (moved into the past); an unassigned visit tomorrow.
  UPDATE public.care_visits SET scheduled_start = now() - interval '2 hours', scheduled_end = now() - interval '1 hour' WHERE id = _v3;
  UPDATE public.care_visits SET scheduled_start = now() - interval '1 hour', scheduled_end = now() WHERE id = _v2;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_coord::text, 'role', 'authenticated')::text, true);
  _v4 := public.care_visit_create(_ep, jsonb_build_object('scheduled_start', now() + interval '1 day', 'duration_minutes', 30));
  _r := public.care_visit_alerts();
  IF NOT _r @> jsonb_build_array(jsonb_build_object('id', _v3, 'kind', 'overdue_checkout'))
     OR NOT _r @> jsonb_build_array(jsonb_build_object('id', _v2, 'kind', 'not_started'))
     OR NOT _r @> jsonb_build_array(jsonb_build_object('id', _v4, 'kind', 'unassigned'))
     OR NOT _r @> jsonb_build_array(jsonb_build_object('id', _v1, 'kind', 'location')) THEN
    RAISE EXCEPTION 'care_visits: alerts wrong (%)', _r;
  END IF;
  PERFORM public.care_visit_close(_v2, 'missed', 'Carer unwell, family informed');
  BEGIN
    PERFORM public.care_visit_close(_v4, 'missed', 'Not yet');
    RAISE EXCEPTION 'care_visits: a future visit was marked missed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_visits:%' THEN RAISE; END IF;
  END;

  -- 9. delivery records name a visit on the same episode only ----------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin::text, 'role', 'authenticated')::text, true);
  PERFORM public.care_observation_record(_ep, jsonb_build_object(
    'observation_type', 'pulse', 'value', '{"bpm":72}'::jsonb, 'visit_id', _v1));
  BEGIN
    PERFORM public.care_observation_record(_ep, jsonb_build_object(
      'observation_type', 'pulse', 'value', '{"bpm":72}'::jsonb, 'visit_id', _v2));
    RAISE EXCEPTION 'care_visits: an observation named a visit on another episode';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_visits:%' THEN RAISE; END IF;
  END;

  -- 10. ending a pattern cancels what has not started ----------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_coord::text, 'role', 'authenticated')::text, true);
  _n := public.care_roster_pattern_end(_pat, 'Family moving to weekly visits');
  IF _n <> 7 OR EXISTS (SELECT 1 FROM public.care_visits WHERE pattern_id = _pat AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'care_visits: ending the pattern cancelled % visits', _n;
  END IF;

  RAISE EXCEPTION 'care_visits: all assertions passed';
END $$;
