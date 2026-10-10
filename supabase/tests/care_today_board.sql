-- Build step 4 (first part): Today board, live alerts and the emergency
-- button. Rollback safe: every synthetic row is created inside one statement
-- that always ends by raising, so nothing it writes is ever kept (including
-- the bell notifications it causes). Run it on a privileged (owner)
-- connection. It borrows one existing client and service and changes neither.
--
-- A pass is reported as the final notice-shaped error:
--   care_today_board: all assertions passed
--
-- What it proves:
--   1. no anon or authenticated write privilege on the new tables;
--   2. a field worker raises an emergency with or without a visit or a
--      location; every coordinator is notified once; a retried press raises
--      nothing new; nobody else can raise one; another worker's visit is refused;
--   3. only schedulers acknowledge and resolve, and resolving needs a note;
--   4. overdue checkouts and visits not started notify coordinators once;
--   5. the board, the episode list and the episode schedule are for
--      schedulers only and carry what the Today page needs.

DO $$
DECLARE
  _admin uuid; _client uuid; _svc text;
  _u_carer uuid := gen_random_uuid(); _u_other uuid := gen_random_uuid();
  _u_coord uuid := gen_random_uuid(); _u_stranger uuid := gen_random_uuid();
  _carer uuid; _other uuid;
  _ep uuid; _v1 uuid; _v2 uuid; _v3 uuid; _vo uuid;
  _ev uuid := gen_random_uuid();
  _r jsonb; _a jsonb; _n integer; _t text;
BEGIN
  -- 1. privileges --------------------------------------------------------------
  FOREACH _t IN ARRAY ARRAY['public.care_worker_alerts','public.care_visit_alert_log'] LOOP
    IF has_table_privilege('authenticated', _t, 'INSERT') OR has_table_privilege('authenticated', _t, 'UPDATE')
       OR has_table_privilege('authenticated', _t, 'DELETE') OR has_table_privilege('anon', _t, 'SELECT') THEN
      RAISE EXCEPTION 'care_today_board: % takes direct writes', _t;
    END IF;
  END LOOP;

  -- Setup ---------------------------------------------------------------------
  SELECT ur.user_id INTO _admin FROM public.user_roles ur
    JOIN public.admin_permissions ap ON ap.user_id = ur.user_id AND COALESCE(ap.is_active, true)
   WHERE ur.role = 'admin' LIMIT 1;
  IF _admin IS NULL THEN RAISE EXCEPTION 'care_today_board: no admin user to test as'; END IF;
  UPDATE public.admin_permissions SET permissions = permissions || '["care_clinical","workforce"]'::jsonb WHERE user_id = _admin;
  SELECT id INTO _client FROM public.clients ORDER BY created_at LIMIT 1;
  SELECT slug INTO _svc FROM public.services ORDER BY slug LIMIT 1;
  IF _client IS NULL OR _svc IS NULL THEN RAISE EXCEPTION 'care_today_board: no client or service to test with'; END IF;
  INSERT INTO public.care_episodes (client_id, service_code, status) VALUES (_client, _svc, 'active') RETURNING id INTO _ep;

  INSERT INTO auth.users (id, email) VALUES
    (_u_carer, 'synthetic-tb1@example.invalid'), (_u_other, 'synthetic-tb2@example.invalid'),
    (_u_coord, 'synthetic-tb3@example.invalid'), (_u_stranger, 'synthetic-tb4@example.invalid');
  INSERT INTO public.mu_people (full_name, auth_user_id, is_staff, staff_status, work_setting)
  VALUES ('Synthetic board carer', _u_carer, true, 'active', 'field') RETURNING id INTO _carer;
  INSERT INTO public.mu_people (full_name, auth_user_id, is_staff, staff_status, work_setting)
  VALUES ('Synthetic other carer', _u_other, true, 'active', 'field') RETURNING id INTO _other;
  INSERT INTO public.user_roles (user_id, role) VALUES (_u_coord, 'admin');
  INSERT INTO public.admin_permissions (user_id, email, permissions)
  VALUES (_u_coord, 'synthetic-tb3@example.invalid', '["care_coordinator"]'::jsonb);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin::text, 'role', 'authenticated')::text, true);
  PERFORM public.care_worker_capability_set(_carer, true, 'test');
  PERFORM public.care_worker_capability_set(_other, true, 'test');
  INSERT INTO public.care_delivery_assignments (episode_id, person_id, capability_code, status, effective_from) VALUES
    (_ep, _carer, 'care_worker', 'active', current_date - 1),
    (_ep, _other, 'care_worker', 'active', current_date - 1);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_coord::text, 'role', 'authenticated')::text, true);
  PERFORM public.care_roster_pattern_create(_ep, jsonb_build_object(
    'person_id', _carer, 'is_primary', true, 'weekdays', '[1,2,3,4,5,6,7]'::jsonb,
    'start_time', '06:00', 'duration_minutes', 30, 'valid_from', current_date + 2));
  _v1 := public.care_visit_create(_ep, jsonb_build_object('scheduled_start', now() + interval '20 minutes', 'duration_minutes', 30, 'person_id', _carer));
  _v2 := public.care_visit_create(_ep, jsonb_build_object('scheduled_start', now() + interval '2 hours', 'duration_minutes', 30, 'person_id', _carer));
  _vo := public.care_visit_create(_ep, jsonb_build_object('scheduled_start', now() + interval '4 hours', 'duration_minutes', 30, 'person_id', _other));
  _v3 := public.care_visit_create(_ep, jsonb_build_object('scheduled_start', now() + interval '6 hours', 'duration_minutes', 30));

  -- 2. emergency button ----------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_stranger::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.care_worker_alert_raise(gen_random_uuid());
    RAISE EXCEPTION 'care_today_board: someone without app access raised an emergency';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_today_board:%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_carer::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.care_worker_alert_raise(gen_random_uuid(), _vo);
    RAISE EXCEPTION 'care_today_board: an emergency named another worker''s visit';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_today_board:%' THEN RAISE; END IF;
  END;
  -- During a visit, with a nonsense location: raised, location dropped.
  _a := public.care_worker_alert_raise(_ev, _v1, 999, 3.4, 10, 'Dog loose in the compound');
  IF _a->>'status' <> 'open' OR (SELECT lat FROM public.care_worker_alerts WHERE id = (_a->>'id')::uuid) IS NOT NULL THEN
    RAISE EXCEPTION 'care_today_board: emergency recorded wrongly (%)', _a;
  END IF;
  SELECT count(*) INTO _n FROM public.staff_notifications
   WHERE user_id = _u_coord AND kind = 'care_emergency' AND ref_id = (_a->>'id')::uuid;
  IF _n <> 1 THEN RAISE EXCEPTION 'care_today_board: coordinator got % emergency notifications', _n; END IF;
  -- A retried press returns the same alert and notifies no one again.
  _r := public.care_worker_alert_raise(_ev, _v1, 6.4, 3.4, 10, 'Again');
  IF _r->>'id' <> _a->>'id'
     OR (SELECT count(*) FROM public.care_worker_alerts WHERE person_id = _carer) <> 1
     OR (SELECT count(*) FROM public.staff_notifications WHERE user_id = _u_coord AND kind = 'care_emergency') <> 1 THEN
    RAISE EXCEPTION 'care_today_board: a retried press raised a second alert';
  END IF;
  IF public.care_my_open_alert()->>'id' <> _a->>'id' THEN
    RAISE EXCEPTION 'care_today_board: worker cannot see their open alert';
  END IF;
  -- Workers cannot handle alerts.
  BEGIN
    PERFORM public.care_worker_alert_update((_a->>'id')::uuid, 'resolved', 'Fine now');
    RAISE EXCEPTION 'care_today_board: a worker resolved an alert';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_today_board:%' THEN RAISE; END IF;
  END;
  -- Off duty, no visit, with a location: also allowed.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_other::text, 'role', 'authenticated')::text, true);
  _r := public.care_worker_alert_raise(gen_random_uuid(), NULL, 6.45, 3.39, 25, NULL);
  IF (SELECT lat FROM public.care_worker_alerts WHERE id = (_r->>'id')::uuid) <> 6.45 THEN
    RAISE EXCEPTION 'care_today_board: emergency without a visit lost its location';
  END IF;

  -- 3. acknowledge and resolve -------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_coord::text, 'role', 'authenticated')::text, true);
  PERFORM public.care_worker_alert_update((_a->>'id')::uuid, 'acknowledged');
  BEGIN
    PERFORM public.care_worker_alert_update((_a->>'id')::uuid, 'resolved', '  ');
    RAISE EXCEPTION 'care_today_board: an alert was resolved without a note';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_today_board:%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_carer::text, 'role', 'authenticated')::text, true);
  IF public.care_my_open_alert()->>'status' <> 'acknowledged' THEN
    RAISE EXCEPTION 'care_today_board: worker does not see the acknowledgement';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_coord::text, 'role', 'authenticated')::text, true);
  PERFORM public.care_worker_alert_update((_a->>'id')::uuid, 'resolved', 'Called the carer; family tied the dog up');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_carer::text, 'role', 'authenticated')::text, true);
  IF public.care_my_open_alert() IS NOT NULL THEN RAISE EXCEPTION 'care_today_board: a resolved alert still shows'; END IF;

  -- 4. live alerts notify once ------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '{}', true);
  -- v1 started and overran; v2 never started.
  UPDATE public.care_visits SET status = 'in_progress', check_in_at = now() - interval '2 hours',
         scheduled_start = now() - interval '2 hours', scheduled_end = now() - interval '1 hour' WHERE id = _v1;
  UPDATE public.care_visits SET scheduled_start = now() - interval '40 minutes', scheduled_end = now() - interval '10 minutes'
   WHERE id = _v2;
  _n := private.care_visit_alerts_notify();
  IF NOT EXISTS (SELECT 1 FROM public.care_visit_alert_log WHERE visit_id = _v1 AND kind = 'overdue_checkout')
     OR NOT EXISTS (SELECT 1 FROM public.care_visit_alert_log WHERE visit_id = _v2 AND kind = 'not_started')
     OR (SELECT count(*) FROM public.staff_notifications WHERE user_id = _u_coord
          AND kind IN ('care_visit_overdue_checkout','care_visit_not_started') AND ref_id IN (_v1, _v2)) <> 2 THEN
    RAISE EXCEPTION 'care_today_board: live alerts not sent (% sent)', _n;
  END IF;
  PERFORM private.care_visit_alerts_notify();
  IF (SELECT count(*) FROM public.staff_notifications WHERE user_id = _u_coord
       AND kind IN ('care_visit_overdue_checkout','care_visit_not_started') AND ref_id IN (_v1, _v2)) <> 2 THEN
    RAISE EXCEPTION 'care_today_board: live alerts sent twice';
  END IF;

  -- 5. coordinator reads ---------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_carer::text, 'role', 'authenticated')::text, true);
  IF public.care_visits_board(NULL) IS NOT NULL OR public.care_schedule_episodes() IS NOT NULL
     OR public.care_episode_schedule(_ep) IS NOT NULL THEN
    RAISE EXCEPTION 'care_today_board: a worker read coordinator views';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_coord::text, 'role', 'authenticated')::text, true);
  _r := public.care_visits_board(NULL);
  IF NOT _r->'visits' @> jsonb_build_array(jsonb_build_object('id', _v1, 'alert', 'overdue_checkout', 'person_name', 'Synthetic board carer'))
     OR NOT _r->'visits' @> jsonb_build_array(jsonb_build_object('id', _v2, 'alert', 'not_started'))
     OR NOT _r->'emergencies' @> jsonb_build_array(jsonb_build_object('person_name', 'Synthetic other carer', 'status', 'open'))
     OR _r->'emergencies' @> jsonb_build_array(jsonb_build_object('id', _a->>'id')) THEN
    RAISE EXCEPTION 'care_today_board: board wrong (%)', _r;
  END IF;
  -- The unassigned visit may fall on tomorrow's Lagos date; read its own day.
  _r := public.care_visits_board((SELECT (scheduled_start AT TIME ZONE 'Africa/Lagos')::date FROM public.care_visits WHERE id = _v3));
  IF NOT _r->'visits' @> jsonb_build_array(jsonb_build_object('id', _v3, 'alert', 'unassigned')) THEN
    RAISE EXCEPTION 'care_today_board: unassigned visit missing from its day (%)', _r;
  END IF;

  _r := public.care_schedule_episodes();
  IF NOT _r @> jsonb_build_array(jsonb_build_object('episode_id', _ep, 'primary_carer', 'Synthetic board carer',
                                                     'patterns', 1, 'workers', 2, 'open_visits', 1)) THEN
    RAISE EXCEPTION 'care_today_board: episode list wrong (%)', _r;
  END IF;
  _r := public.care_episode_schedule(_ep);
  IF jsonb_array_length(_r->'workers') <> 2
     OR NOT _r->'workers' @> jsonb_build_array(jsonb_build_object('person_id', _carer, 'app_access', true))
     OR NOT _r->'patterns' @> jsonb_build_array(jsonb_build_object('start_time', '06:00', 'is_primary', true))
     OR NOT _r->'visits' @> jsonb_build_array(jsonb_build_object('id', _v3, 'person_id', NULL)) THEN
    RAISE EXCEPTION 'care_today_board: episode schedule wrong (%)', _r;
  END IF;

  RAISE EXCEPTION 'care_today_board: all assertions passed';
END $$;
