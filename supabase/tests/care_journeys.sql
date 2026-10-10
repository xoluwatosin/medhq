-- Build step 4 (second part): journeys and the live map. Rollback safe: every
-- synthetic row is created inside one statement that always ends by raising,
-- so nothing it writes is ever kept. Run it on a privileged (owner)
-- connection. It borrows one existing client and service and changes neither.
--
-- A pass is reported as the final notice-shaped error:
--   care_journeys: all assertions passed
--
-- What it proves:
--   1. no anon or authenticated write privilege on the new tables;
--   2. a journey starts only for the worker's own visit, from three hours
--      before it; a retried tap returns the same journey; one open journey
--      per worker;
--   3. points go only into the worker's own open journey, once each, never
--      from the future; the last position follows the newest point;
--   4. checking in ends the journey, and the phone is told to stop;
--   5. a journey left running six hours is closed;
--   6. the live map is for schedulers only and shows who is travelling and
--      who is on a visit;
--   7. points older than 90 days are deleted and newer ones kept.

DO $$
DECLARE
  _admin uuid; _client uuid; _svc text;
  _u_carer uuid := gen_random_uuid(); _u_other uuid := gen_random_uuid(); _u_coord uuid := gen_random_uuid();
  _carer uuid; _other uuid; _ep uuid; _v1 uuid; _v2 uuid; _vfar uuid; _vo uuid;
  _ev uuid := gen_random_uuid(); _j1 uuid; _j2 uuid; _jold uuid;
  _r jsonb; _n integer; _t text;
BEGIN
  -- 1. privileges --------------------------------------------------------------
  FOREACH _t IN ARRAY ARRAY['public.care_journeys','public.care_journey_points'] LOOP
    IF has_table_privilege('authenticated', _t, 'INSERT') OR has_table_privilege('authenticated', _t, 'UPDATE')
       OR has_table_privilege('authenticated', _t, 'DELETE') OR has_table_privilege('anon', _t, 'SELECT') THEN
      RAISE EXCEPTION 'care_journeys: % takes direct writes', _t;
    END IF;
  END LOOP;

  -- Setup ---------------------------------------------------------------------
  SELECT ur.user_id INTO _admin FROM public.user_roles ur
    JOIN public.admin_permissions ap ON ap.user_id = ur.user_id AND COALESCE(ap.is_active, true)
   WHERE ur.role = 'admin' LIMIT 1;
  IF _admin IS NULL THEN RAISE EXCEPTION 'care_journeys: no admin user to test as'; END IF;
  UPDATE public.admin_permissions SET permissions = permissions || '["workforce"]'::jsonb WHERE user_id = _admin;
  SELECT id INTO _client FROM public.clients ORDER BY created_at LIMIT 1;
  SELECT slug INTO _svc FROM public.services ORDER BY slug LIMIT 1;
  IF _client IS NULL OR _svc IS NULL THEN RAISE EXCEPTION 'care_journeys: no client or service to test with'; END IF;
  INSERT INTO public.care_episodes (client_id, service_code, status) VALUES (_client, _svc, 'active') RETURNING id INTO _ep;

  INSERT INTO auth.users (id, email) VALUES
    (_u_carer, 'synthetic-jr1@example.invalid'), (_u_other, 'synthetic-jr2@example.invalid'),
    (_u_coord, 'synthetic-jr3@example.invalid');
  INSERT INTO public.mu_people (full_name, auth_user_id, is_staff, staff_status, work_setting)
  VALUES ('Synthetic journey carer', _u_carer, true, 'active', 'field') RETURNING id INTO _carer;
  INSERT INTO public.mu_people (full_name, auth_user_id, is_staff, staff_status, work_setting)
  VALUES ('Synthetic other carer', _u_other, true, 'active', 'field') RETURNING id INTO _other;
  INSERT INTO public.user_roles (user_id, role) VALUES (_u_coord, 'admin');
  INSERT INTO public.admin_permissions (user_id, email, permissions)
  VALUES (_u_coord, 'synthetic-jr3@example.invalid', '["care_coordinator"]'::jsonb);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin::text, 'role', 'authenticated')::text, true);
  PERFORM public.care_worker_capability_set(_carer, true, 'test');
  PERFORM public.care_worker_capability_set(_other, true, 'test');
  INSERT INTO public.care_delivery_assignments (episode_id, person_id, capability_code, status, effective_from) VALUES
    (_ep, _carer, 'care_worker', 'active', current_date - 1),
    (_ep, _other, 'care_worker', 'active', current_date - 1);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_coord::text, 'role', 'authenticated')::text, true);
  _v1 := public.care_visit_create(_ep, jsonb_build_object('scheduled_start', now() + interval '30 minutes', 'duration_minutes', 30, 'person_id', _carer));
  _v2 := public.care_visit_create(_ep, jsonb_build_object('scheduled_start', now() + interval '90 minutes', 'duration_minutes', 30, 'person_id', _carer));
  _vfar := public.care_visit_create(_ep, jsonb_build_object('scheduled_start', now() + interval '5 hours', 'duration_minutes', 30, 'person_id', _carer));
  _vo := public.care_visit_create(_ep, jsonb_build_object('scheduled_start', now() + interval '40 minutes', 'duration_minutes', 30, 'person_id', _other));

  -- 2. starting a journey ----------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_carer::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.care_journey_start(_vo, gen_random_uuid());
    RAISE EXCEPTION 'care_journeys: a journey started for another worker''s visit';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_journeys:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.care_journey_start(_vfar, gen_random_uuid());
    RAISE EXCEPTION 'care_journeys: a journey started five hours early';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_journeys:%' THEN RAISE; END IF;
  END;
  _r := public.care_journey_start(_v2, gen_random_uuid(), 6.40, 3.40, 30);
  _j2 := (_r->>'id')::uuid;
  _r := public.care_journey_start(_v1, _ev, 6.41, 3.41, 20);
  _j1 := (_r->>'id')::uuid;
  IF (SELECT end_reason FROM public.care_journeys WHERE id = _j2) <> 'stopped' THEN
    RAISE EXCEPTION 'care_journeys: starting a second journey left the first open';
  END IF;
  IF (public.care_journey_start(_v1, _ev, 6.0, 3.0, 5)->>'id')::uuid <> _j1
     OR (SELECT count(*) FROM public.care_journeys WHERE person_id = _carer) <> 2 THEN
    RAISE EXCEPTION 'care_journeys: a retried tap opened another journey';
  END IF;
  IF (public.care_my_journey()->>'id')::uuid <> _j1 THEN
    RAISE EXCEPTION 'care_journeys: the worker cannot see their open journey';
  END IF;

  -- 3. points ---------------------------------------------------------------------
  _r := public.care_journey_points_add(_j1, jsonb_build_array(
    -- The test runs in one transaction, so now() stands still: these points
    -- are stamped just after the journey's own starting point.
    jsonb_build_object('at', now() + interval '10 seconds', 'lat', 6.4200, 'lng', 3.4200, 'accuracy_m', 12),
    jsonb_build_object('at', now() + interval '20 seconds', 'lat', 6.4250, 'lng', 3.4210, 'accuracy_m', 9, 'speed_mps', 8.5, 'heading', 90),
    jsonb_build_object('at', now() + interval '20 seconds', 'lat', 6.4250, 'lng', 3.4210, 'accuracy_m', 9),
    jsonb_build_object('at', now() + interval '1 hour', 'lat', 1, 'lng', 1)));
  IF NOT (_r->>'open')::boolean OR (_r->>'added')::int <> 2 THEN
    RAISE EXCEPTION 'care_journeys: points stored wrongly (%)', _r;
  END IF;
  IF (SELECT last_lat FROM public.care_journeys WHERE id = _j1) <> 6.4250 THEN
    RAISE EXCEPTION 'care_journeys: last position did not follow the newest point';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_other::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.care_journey_points_add(_j1, '[{"at":"2026-01-01T00:00:00Z","lat":1,"lng":1}]'::jsonb);
    RAISE EXCEPTION 'care_journeys: another worker added points to a journey';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_journeys:%' THEN RAISE; END IF;
  END;

  -- 6. live map (while travelling) ---------------------------------------------------
  IF public.care_live_map() IS NOT NULL THEN RAISE EXCEPTION 'care_journeys: a worker read the live map'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_coord::text, 'role', 'authenticated')::text, true);
  _r := public.care_live_map();
  IF NOT _r->'travelling' @> jsonb_build_array(jsonb_build_object('journey_id', _j1, 'person_name', 'Synthetic journey carer', 'lat', 6.4250)) THEN
    RAISE EXCEPTION 'care_journeys: live map misses the traveller (%)', _r;
  END IF;
  IF jsonb_array_length(public.care_journey_route(_j1)) <> 3 THEN
    RAISE EXCEPTION 'care_journeys: route has the wrong number of points';
  END IF;

  -- 4. check-in ends the journey ----------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_carer::text, 'role', 'authenticated')::text, true);
  PERFORM public.care_visit_check_in(_v1, gen_random_uuid(), 6.4260, 3.4215, 10);
  IF (SELECT end_reason FROM public.care_journeys WHERE id = _j1) <> 'checked_in' THEN
    RAISE EXCEPTION 'care_journeys: check-in did not end the journey';
  END IF;
  IF (public.care_journey_points_add(_j1, jsonb_build_array(jsonb_build_object('at', now(), 'lat', 6.43, 'lng', 3.43)))->>'open')::boolean THEN
    RAISE EXCEPTION 'care_journeys: points still accepted after check-in';
  END IF;
  IF public.care_my_journey() IS NOT NULL THEN RAISE EXCEPTION 'care_journeys: a closed journey still shows'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_coord::text, 'role', 'authenticated')::text, true);
  _r := public.care_live_map();
  IF _r->'travelling' @> jsonb_build_array(jsonb_build_object('journey_id', _j1))
     OR NOT _r->'on_visit' @> jsonb_build_array(jsonb_build_object('visit_id', _v1, 'lat', 6.4260)) THEN
    RAISE EXCEPTION 'care_journeys: live map wrong after check-in (%)', _r;
  END IF;

  -- 5. a journey left running is closed ---------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_other::text, 'role', 'authenticated')::text, true);
  _r := public.care_journey_start(_vo, gen_random_uuid());
  PERFORM set_config('request.jwt.claims', '{}', true);
  UPDATE public.care_journeys SET started_at = now() - interval '7 hours' WHERE id = (_r->>'id')::uuid;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_other::text, 'role', 'authenticated')::text, true);
  IF (public.care_journey_points_add((_r->>'id')::uuid, '[]'::jsonb)->>'open')::boolean
     OR (SELECT end_reason FROM public.care_journeys WHERE id = (_r->>'id')::uuid) <> 'timed_out' THEN
    RAISE EXCEPTION 'care_journeys: a six-hour journey stayed open';
  END IF;

  -- 7. 90-day retention -------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '{}', true);
  INSERT INTO public.care_journeys (person_id, visit_id, client_event_id, started_at, ended_at, end_reason, last_lat, last_lng)
  VALUES (_carer, _vfar, gen_random_uuid(), now() - interval '100 days', now() - interval '100 days', 'stopped', 6.4, 3.4)
  RETURNING id INTO _jold;
  INSERT INTO public.care_journey_points (journey_id, recorded_at, lat, lng)
  VALUES (_jold, now() - interval '100 days', 6.4, 3.4), (_jold, now() - interval '91 days', 6.41, 3.41),
         (_jold, now() - interval '89 days', 6.42, 3.42);
  PERFORM private.care_journey_points_purge();
  SELECT count(*) INTO _n FROM public.care_journey_points WHERE journey_id = _jold;
  IF _n <> 1 OR (SELECT count(*) FROM public.care_journey_points WHERE journey_id = _j1) <> 3
     OR (SELECT last_lat FROM public.care_journeys WHERE id = _jold) IS NOT NULL THEN
    RAISE EXCEPTION 'care_journeys: retention wrong (% old points left)', _n;
  END IF;

  RAISE EXCEPTION 'care_journeys: all assertions passed';
END $$;
