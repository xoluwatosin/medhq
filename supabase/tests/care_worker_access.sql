-- Workforce app access for field carers. Rollback safe: every synthetic row is
-- created inside one statement that always ends by raising, so nothing it
-- writes is ever kept. Run it on a privileged (owner) connection.
--
-- A pass is reported as the final notice-shaped error:
--   care_worker_access: all assertions passed
--
-- What it proves:
--   1. care_worker is granted only to a signed-in, field member of the Workforce;
--   2. only an admin with the workforce area can grant or revoke it, and each
--      change is logged once;
--   3. mu_portal_mode keeps its keys and adds care_worker, true only while all
--      three conditions hold (field, Workforce, capability);
--   4. it cannot be revoked while a care assignment is planned or active;
--   5. a carer sees only their own live assignments, and nothing once access
--      closes;
--   6. carers still cannot read the delivery tables directly.

DO $$
DECLARE
  _admin uuid;
  _u1 uuid := gen_random_uuid(); _u2 uuid := gen_random_uuid(); _u3 uuid := gen_random_uuid();
  _carer uuid; _other uuid; _office uuid;
  _ep uuid; _a uuid; _a2 uuid; _client uuid; _svc text;
  _mode jsonb; _cap jsonb; _list jsonb; _n integer;
BEGIN
  SELECT ur.user_id INTO _admin
    FROM public.user_roles ur
    JOIN public.admin_permissions ap ON ap.user_id = ur.user_id AND COALESCE(ap.is_active, true)
   WHERE ur.role = 'admin'
   LIMIT 1;
  IF _admin IS NULL THEN RAISE EXCEPTION 'care_worker_access: no admin user to test as'; END IF;
  UPDATE public.admin_permissions SET permissions = permissions || '["workforce"]'::jsonb
   WHERE user_id = _admin AND NOT permissions ? 'workforce';

  INSERT INTO auth.users (id, email) VALUES
    (_u1, 'synthetic-cw1@example.invalid'),
    (_u2, 'synthetic-cw2@example.invalid'),
    (_u3, 'synthetic-cw3@example.invalid');

  -- A talent with a sign-in, not yet in the Workforce, no work setting.
  INSERT INTO public.mu_people (full_name, auth_user_id) VALUES ('Synthetic carer', _u1)
  RETURNING id INTO _carer;
  INSERT INTO public.mu_people (full_name, auth_user_id, is_staff, staff_status, work_setting)
  VALUES ('Synthetic second carer', _u2, true, 'active', 'field') RETURNING id INTO _other;
  INSERT INTO public.mu_people (full_name, auth_user_id, is_staff, staff_status, work_setting)
  VALUES ('Synthetic office staff', _u3, true, 'active', 'office') RETURNING id INTO _office;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin::text, 'role', 'authenticated')::text, true);

  -- 1. each condition is enforced at grant time ------------------------------
  BEGIN
    PERFORM public.care_worker_capability_set(_carer, true, 'test');
    RAISE EXCEPTION 'care_worker_access: granted to someone outside the Workforce';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_worker_access:%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%Workforce first%' THEN RAISE EXCEPTION 'care_worker_access: wrong refusal (%)', SQLERRM; END IF;
  END;

  UPDATE public.mu_people SET is_staff = true, staff_status = 'active' WHERE id = _carer;
  BEGIN
    PERFORM public.care_worker_capability_set(_carer, true, 'test');
    RAISE EXCEPTION 'care_worker_access: granted to someone without a field work setting';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_worker_access:%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%field%' THEN RAISE EXCEPTION 'care_worker_access: wrong refusal (%)', SQLERRM; END IF;
  END;

  BEGIN
    PERFORM public.care_worker_capability_set(_office, true, 'test');
    RAISE EXCEPTION 'care_worker_access: granted to office staff';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_worker_access:%' THEN RAISE; END IF;
  END;

  UPDATE public.mu_people SET auth_user_id = NULL, work_setting = 'field' WHERE id = _carer;
  BEGIN
    PERFORM public.care_worker_capability_set(_carer, true, 'test');
    RAISE EXCEPTION 'care_worker_access: granted to someone without a sign-in';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_worker_access:%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%sign-in%' THEN RAISE EXCEPTION 'care_worker_access: wrong refusal (%)', SQLERRM; END IF;
  END;
  UPDATE public.mu_people SET auth_user_id = _u1 WHERE id = _carer;

  -- 2. grant works once, is logged once; only admins with the area ----------
  PERFORM public.care_worker_capability_set(_carer, true, 'Starts Monday');
  PERFORM public.care_worker_capability_set(_carer, true, 'Again');
  SELECT count(*) INTO _n FROM public.mu_capabilities
   WHERE person_id = _carer AND capability = 'care_worker' AND revoked_at IS NULL;
  IF _n <> 1 THEN RAISE EXCEPTION 'care_worker_access: expected one live capability, found %', _n; END IF;
  SELECT count(*) INTO _n FROM public.mu_activity WHERE person_id = _carer AND action = 'care_worker_granted';
  IF _n <> 1 THEN RAISE EXCEPTION 'care_worker_access: expected one grant log, found %', _n; END IF;
  PERFORM public.care_worker_capability_set(_other, true, NULL);

  _cap := public.care_worker_capability(_carer);
  IF NOT (_cap->>'active')::boolean OR NOT (_cap->>'app_access')::boolean THEN
    RAISE EXCEPTION 'care_worker_access: admin view does not show access (%)', _cap;
  END IF;

  -- A carer cannot grant, and sees no admin view.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _u2::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.care_worker_capability_set(_carer, false, 'test');
    RAISE EXCEPTION 'care_worker_access: a carer changed a capability';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_worker_access:%' THEN RAISE; END IF;
  END;
  IF public.care_worker_capability(_carer) IS NOT NULL THEN
    RAISE EXCEPTION 'care_worker_access: a carer read the admin view';
  END IF;

  -- An admin without the workforce area cannot grant either (skipped when the
  -- test admin is the super admin, who holds every area).
  IF NOT private.is_super_admin(_admin) THEN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', _admin::text, 'role', 'authenticated')::text, true);
    UPDATE public.admin_permissions SET permissions = permissions - 'workforce' WHERE user_id = _admin;
    BEGIN
      PERFORM public.care_worker_capability_set(_carer, false, 'test');
      RAISE EXCEPTION 'care_worker_access: an admin without the workforce area changed a capability';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM LIKE 'care_worker_access:%' THEN RAISE; END IF;
    END;
    UPDATE public.admin_permissions SET permissions = permissions || '["workforce"]'::jsonb WHERE user_id = _admin;
  END IF;

  -- 3. portal mode keeps its keys and adds care_worker ------------------------
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _u1::text, 'role', 'authenticated')::text, true);
  _mode := public.mu_portal_mode();
  IF NOT (_mode ? 'person_id' AND _mode ? 'full_name' AND _mode ? 'mode'
          AND _mode ? 'staff_status' AND _mode ? 'assessor') THEN
    RAISE EXCEPTION 'care_worker_access: portal mode lost a key (%)', _mode;
  END IF;
  IF _mode->>'mode' <> 'workforce' OR NOT (_mode->>'care_worker')::boolean THEN
    RAISE EXCEPTION 'care_worker_access: a granted field carer has no access (%)', _mode;
  END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _u3::text, 'role', 'authenticated')::text, true);
  IF (public.mu_portal_mode()->>'care_worker')::boolean THEN
    RAISE EXCEPTION 'care_worker_access: office staff have access';
  END IF;

  -- 4. revoke is blocked by live assignments ----------------------------------
  -- The synthetic episode borrows an existing client and service, so no client
  -- record (and none of its triggers) is created. The client is not changed.
  SELECT id INTO _client FROM public.clients ORDER BY created_at LIMIT 1;
  SELECT slug INTO _svc FROM public.services ORDER BY slug LIMIT 1;
  IF _client IS NULL OR _svc IS NULL THEN RAISE EXCEPTION 'care_worker_access: no client or service to test with'; END IF;
  INSERT INTO public.care_episodes (client_id, service_code, status) VALUES (_client, _svc, 'active') RETURNING id INTO _ep;
  INSERT INTO public.care_delivery_assignments (episode_id, person_id, capability_code, status, effective_from)
  VALUES (_ep, _carer, 'care_worker', 'active', current_date) RETURNING id INTO _a;
  INSERT INTO public.care_delivery_assignments (episode_id, person_id, capability_code, status, effective_from)
  VALUES (_ep, _carer, 'care_worker', 'ended', current_date - 30);
  INSERT INTO public.care_delivery_assignments (episode_id, person_id, capability_code, status, effective_from)
  VALUES (_ep, _other, 'care_worker', 'planned', current_date + 7) RETURNING id INTO _a2;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.care_worker_capability_set(_carer, false, 'test');
    RAISE EXCEPTION 'care_worker_access: revoked while an assignment was active';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_worker_access:%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%1 care assignment%' THEN RAISE EXCEPTION 'care_worker_access: wrong refusal (%)', SQLERRM; END IF;
  END;

  -- 5. a carer sees only their own live assignments ---------------------------
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _u1::text, 'role', 'authenticated')::text, true);
  _list := public.care_worker_my_assignments();
  IF jsonb_array_length(_list) <> 1 OR _list->0->>'id' <> _a::text THEN
    RAISE EXCEPTION 'care_worker_access: carer saw the wrong assignments (%)', _list;
  END IF;

  -- 6. the delivery table itself stays closed to carers.
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO _n FROM public.care_delivery_assignments;
  EXECUTE 'RESET ROLE';
  IF _n <> 0 THEN RAISE EXCEPTION 'care_worker_access: a carer read % delivery rows directly', _n; END IF;

  -- Moving to office work closes access without touching the capability.
  UPDATE public.mu_people SET work_setting = 'office' WHERE id = _carer;
  IF (public.mu_portal_mode()->>'care_worker')::boolean THEN
    RAISE EXCEPTION 'care_worker_access: access survived a move to office work';
  END IF;
  IF jsonb_array_length(public.care_worker_my_assignments()) <> 0 THEN
    RAISE EXCEPTION 'care_worker_access: assignments visible after access closed';
  END IF;
  UPDATE public.mu_people SET work_setting = 'field' WHERE id = _carer;

  -- Revoke goes through once the assignment ends, and closes access.
  UPDATE public.care_delivery_assignments SET status = 'ended' WHERE id = _a;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin::text, 'role', 'authenticated')::text, true);
  PERFORM public.care_worker_capability_set(_carer, false, 'Left');
  SELECT count(*) INTO _n FROM public.mu_activity WHERE person_id = _carer AND action = 'care_worker_revoked';
  IF _n <> 1 THEN RAISE EXCEPTION 'care_worker_access: expected one revoke log, found %', _n; END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _u1::text, 'role', 'authenticated')::text, true);
  IF (public.mu_portal_mode()->>'care_worker')::boolean THEN
    RAISE EXCEPTION 'care_worker_access: access survived a revoke';
  END IF;

  RAISE EXCEPTION 'care_worker_access: all assertions passed';
END $$;
