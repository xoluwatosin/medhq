-- Pass 7.5B + 7.5C regression. Rollback safe: every synthetic row is created
-- inside one statement that always ends by raising, so nothing it writes is
-- ever kept. Run it on a privileged (owner) connection, such as the Lovable
-- Cloud SQL runner. The sandbox psql role cannot read the care tables directly.
--
-- A pass is reported as the final notice-shaped error:
--   care_delivery_foundation: all assertions passed
--
-- What it proves:
--   1. a published service configuration cannot be edited in place;
--   2. publishing a new version never changes an episode already activated;
--   3. an episode freezes the configuration it was activated against;
--   4. module resolution is deterministic and a required module always survives;
--   5. a delivery assignment demands a real, held delivery capability;
--   6. assignment status transitions are one way and reasoned;
--   7. the client stage counts only live assignments on live episodes;
--   8. the legacy care_assignments table is read only and still empty;
--   9. clinical and delivery tables take no direct writes from authenticated.

DO $$
DECLARE
  _admin uuid; _client uuid; _person uuid;
  _svc text;
  _cfg1 uuid; _cfg2 uuid; _ep uuid; _ep2 uuid;
  _a uuid; _modules jsonb; _snapshot jsonb;
  _stage text; _n integer; _ok boolean;
BEGIN
  SELECT user_id INTO _admin FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF _admin IS NULL THEN RAISE EXCEPTION 'care_delivery_foundation: no admin user to test as'; END IF;

  -- Act as a real signed-in coordinator, without changing database role.
  INSERT INTO public.admin_permissions (user_id, email, permissions, is_active)
  VALUES (_admin, 'synthetic-7-5@example.invalid', '["care_coordinator"]'::jsonb, true)
  ON CONFLICT DO NOTHING;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin::text, 'role', 'authenticated')::text, true);

  SELECT slug INTO _svc FROM public.services ORDER BY slug LIMIT 1;

  INSERT INTO public.clients (full_name, date_of_birth)
  VALUES ('Synthetic 7.5 client', current_date - interval '40 years')
  RETURNING id INTO _client;

  INSERT INTO public.mu_people (full_name) VALUES ('Synthetic 7.5 worker')
  RETURNING id INTO _person;

  -- 1. draft, publish, and the published version is frozen ------------------
  _cfg1 := public.care_service_config_draft(_svc, jsonb_build_array(
    jsonb_build_object('code', 'safeguarding', 'required', true),
    jsonb_build_object('code', 'child_development', 'maxAgeYears', 5),
    jsonb_build_object('code', 'wound_care', 'capabilities', jsonb_build_array('nurse'))));
  PERFORM public.care_service_config_publish(_cfg1);

  BEGIN
    UPDATE public.care_service_configurations SET modules = '[]'::jsonb WHERE id = _cfg1;
    RAISE EXCEPTION 'care_delivery_foundation: a published configuration was edited';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_foundation:%' THEN RAISE; END IF;
  END;

  -- 2 + 3. an activated episode keeps its own snapshot ----------------------
  _ep := public.care_episode_create(_client, _svc);
  PERFORM public.care_episode_activate(_ep);
  SELECT configuration_snapshot, service_configuration_id INTO _snapshot, _cfg2
    FROM public.care_episodes WHERE id = _ep;
  IF _cfg2 IS DISTINCT FROM _cfg1 THEN
    RAISE EXCEPTION 'care_delivery_foundation: episode did not bind the published configuration';
  END IF;

  _cfg2 := public.care_service_config_draft(_svc, jsonb_build_array(
    jsonb_build_object('code', 'safeguarding', 'required', true)));
  PERFORM public.care_service_config_publish(_cfg2);
  IF (SELECT configuration_snapshot FROM public.care_episodes WHERE id = _ep)
     IS DISTINCT FROM _snapshot THEN
    RAISE EXCEPTION 'care_delivery_foundation: a new version changed a running episode';
  END IF;

  -- 4. deterministic resolution; required survives every default ------------
  _modules := public.care_episode_modules(_ep, 'care_worker');
  IF NOT (_modules @> jsonb_build_array(jsonb_build_object(
            'code','safeguarding','required',true,'familyVisible',false,'options','{}'::jsonb))) THEN
    RAISE EXCEPTION 'care_delivery_foundation: required module was dropped';
  END IF;
  IF _modules::text LIKE '%child_development%' THEN
    RAISE EXCEPTION 'care_delivery_foundation: age rule did not apply for a 40 year old';
  END IF;
  IF _modules::text LIKE '%wound_care%' THEN
    RAISE EXCEPTION 'care_delivery_foundation: capability rule did not apply';
  END IF;
  IF _modules IS DISTINCT FROM public.care_episode_modules(_ep, 'care_worker') THEN
    RAISE EXCEPTION 'care_delivery_foundation: module resolution is not deterministic';
  END IF;

  -- 5. an assignment needs a real, held delivery capability -----------------
  BEGIN
    PERFORM public.care_assignment_plan(_ep, _person, 'assessor');
    RAISE EXCEPTION 'care_delivery_foundation: assessor was accepted as a delivery capability';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_foundation:%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.care_assignment_plan(_ep, _person, 'care_worker');
    RAISE EXCEPTION 'care_delivery_foundation: a person without the capability was assigned';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_foundation:%' THEN RAISE; END IF;
  END;

  INSERT INTO public.mu_capabilities (person_id, capability) VALUES (_person, 'care_worker');
  _a := public.care_assignment_plan(_ep, _person, 'care_worker');

  -- 6. transitions are one way and reasoned ---------------------------------
  BEGIN
    PERFORM public.care_assignment_end(_a, 'too soon');
    RAISE EXCEPTION 'care_delivery_foundation: a planned assignment was ended';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_foundation:%' THEN RAISE; END IF;
  END;

  PERFORM public.care_assignment_activate(_a);
  PERFORM public.care_assignment_activate(_a); -- idempotent

  BEGIN
    PERFORM public.care_assignment_end(_a, '   ');
    RAISE EXCEPTION 'care_delivery_foundation: an assignment ended without a reason';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_foundation:%' THEN RAISE; END IF;
  END;

  -- 7. stage counts only live assignments on live episodes ------------------
  _stage := public.care_derive_stage(_client);
  IF _stage IS DISTINCT FROM 'care_running' THEN
    RAISE EXCEPTION 'care_delivery_foundation: expected care_running, got %', _stage;
  END IF;

  PERFORM public.care_assignment_end(_a, 'synthetic end', current_date - 1);
  IF public.care_derive_stage(_client) = 'care_running' THEN
    RAISE EXCEPTION 'care_delivery_foundation: an ended assignment still ran care';
  END IF;

  SELECT (public.mu_workforce_blockers(_person) ->> 'assignments')::integer INTO _n;
  IF _n <> 0 THEN
    RAISE EXCEPTION 'care_delivery_foundation: ended assignment still blocks workforce exit';
  END IF;

  -- a cancelled episode takes no assignment
  _ep2 := public.care_episode_create(_client, _svc);
  PERFORM public.care_episode_set_status(_ep2, 'cancelled', 'synthetic');
  BEGIN
    PERFORM public.care_assignment_plan(_ep2, _person, 'care_worker');
    RAISE EXCEPTION 'care_delivery_foundation: a cancelled episode took an assignment';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_foundation:%' THEN RAISE; END IF;
  END;

  -- 8. the legacy table is empty and read only ------------------------------
  SELECT count(*) INTO _n FROM public.care_assignments;
  IF _n <> 0 THEN
    RAISE EXCEPTION 'care_delivery_foundation: legacy care_assignments is no longer empty';
  END IF;
  SELECT bool_or(privilege_type IN ('INSERT','UPDATE','DELETE')) INTO _ok
    FROM information_schema.role_table_grants
   WHERE table_name = 'care_assignments' AND grantee IN ('anon','authenticated');
  IF COALESCE(_ok, false) THEN
    RAISE EXCEPTION 'care_delivery_foundation: legacy care_assignments still takes writes';
  END IF;

  -- 9. the new tables take no direct writes ---------------------------------
  SELECT bool_or(privilege_type IN ('INSERT','UPDATE','DELETE')) INTO _ok
    FROM information_schema.role_table_grants
   WHERE table_name IN ('care_episodes','care_service_configurations','care_delivery_assignments')
     AND grantee IN ('anon','authenticated');
  IF COALESCE(_ok, false) THEN
    RAISE EXCEPTION 'care_delivery_foundation: a delivery table takes direct writes';
  END IF;

  RAISE EXCEPTION 'care_delivery_foundation: all assertions passed';
END $$;
