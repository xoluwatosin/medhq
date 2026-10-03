-- Stage 1 correction: the care group foundation is least privilege, every
-- writer is a controlled function, and a recipient only becomes a person
-- because a member of staff said so. Everything here is synthetic and rolled
-- back at the foot of the file.
BEGIN;

-- --------------------------------------------------------------- privileges
DO $$
DECLARE _t text; _p text;
BEGIN
  FOREACH _t IN ARRAY ARRAY[
    'care_groups','care_group_members','care_person_relationships','care_requests',
    'care_request_recipients','care_service_intentions','care_service_intention_recipients',
    'care_assessment_visits']
  LOOP
    FOREACH _p IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
      IF has_table_privilege('authenticated', 'public.' || _t, _p)
         OR has_table_privilege('anon', 'public.' || _t, _p) THEN
        RAISE EXCEPTION 'ordinary users must not write % directly (%)', _t, _p;
      END IF;
    END LOOP;
    IF has_table_privilege('anon', 'public.' || _t, 'SELECT') THEN
      RAISE EXCEPTION 'signed-out visitors must not read %', _t;
    END IF;
    IF NOT has_table_privilege('service_role', 'public.' || _t, 'SELECT') THEN
      RAISE EXCEPTION 'the service role must still read %', _t;
    END IF;

    -- Reading is an explicit admin read, never a blanket FOR ALL policy.
    IF EXISTS (SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = _t AND cmd = 'ALL') THEN
      RAISE EXCEPTION 'a blanket manage-everything policy still exists on %', _t;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = _t AND cmd = 'SELECT'
                      AND qual LIKE '%has_role%') THEN
      RAISE EXCEPTION 'an explicit admin read policy is missing on %', _t;
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || _t)::regclass) THEN
      RAISE EXCEPTION 'row level security is off on %', _t;
    END IF;
  END LOOP;

  IF has_table_privilege('anon', 'public.care_group_relationship_terms', 'SELECT') THEN
    RAISE EXCEPTION 'the relationship vocabulary must not be public';
  END IF;

  RAISE NOTICE 'care group privileges: pass';
END $$;

-- ------------------------------------------------------- controlled writers
DO $$
DECLARE _f text; _src text;
BEGIN
  FOREACH _f IN ARRAY ARRAY[
    'public.care_person_create(text,text,text,text,text)',
    'public.care_recipient_person_link(uuid,uuid,text)',
    'public.care_recipient_create(uuid,text,uuid,text,date,integer,text,text,text,text,text,text,text)',
    'public.care_request_readiness(uuid)']
  LOOP
    IF has_function_privilege('anon', _f, 'EXECUTE') THEN
      RAISE EXCEPTION 'signed-out visitors must not execute %', _f;
    END IF;
    IF NOT has_function_privilege('authenticated', _f, 'EXECUTE') THEN
      RAISE EXCEPTION 'signed-in staff must be able to execute %', _f;
    END IF;
    _src := pg_get_functiondef(_f::regprocedure);
    IF _src NOT LIKE '%SECURITY DEFINER%' OR _src NOT LIKE '%search_path%' THEN
      RAISE EXCEPTION '% must be SECURITY DEFINER with a fixed search path', _f;
    END IF;
    IF _src NOT LIKE '%care_group_admin_guard%' THEN
      RAISE EXCEPTION '% must check the caller', _f;
    END IF;
  END LOOP;

  -- Identity is never guessed and never merged.
  _src := pg_get_functiondef(
    'public.care_recipient_create(uuid,text,uuid,text,date,integer,text,text,text,text,text,text,text)'::regprocedure);
  IF _src LIKE '%lower(_email)%' OR _src LIKE '%WHERE email =%' OR _src LIKE '%ILIKE%' THEN
    RAISE EXCEPTION 'a recipient must never be matched to a person by email or name';
  END IF;
  _src := pg_get_functiondef('public.care_recipient_person_link(uuid,uuid,text)'::regprocedure);
  IF _src NOT LIKE '%never merged%' THEN
    RAISE EXCEPTION 'relinking a recipient to a different person must be refused';
  END IF;

  RAISE NOTICE 'controlled writers: pass';
END $$;

-- ------------------------------------------- one group, several recipients
DO $$
DECLARE
  _group uuid; _request uuid; _mum_p uuid; _baby_p uuid; _mum uuid; _baby uuid;
  _r_mum uuid; _r_baby uuid; _ready jsonb;
BEGIN
  INSERT INTO public.care_groups (display_name, source) VALUES ('ZZ synthetic family', 'test')
  RETURNING id INTO _group;

  INSERT INTO public.care_people (full_name, source) VALUES ('ZZ synthetic mother', 'test')
  RETURNING id INTO _mum_p;
  INSERT INTO public.care_people (full_name, source) VALUES ('ZZ synthetic baby', 'test')
  RETURNING id INTO _baby_p;

  -- The same contact details on two people must never make them one person.
  IF _mum_p = _baby_p THEN RAISE EXCEPTION 'two people must stay two people'; END IF;

  INSERT INTO public.care_requests (group_id, status, source, enquirer_person_id)
  VALUES (_group, 'open', 'test', _mum_p) RETURNING id INTO _request;

  INSERT INTO public.clients (full_name, stage) VALUES ('ZZ synthetic mother', 'new') RETURNING id INTO _mum;
  INSERT INTO public.clients (full_name, stage) VALUES ('ZZ synthetic baby', 'new') RETURNING id INTO _baby;

  INSERT INTO public.care_request_recipients (request_id, client_id, person_id, display_order)
  VALUES (_request, _mum, _mum_p, 1) RETURNING id INTO _r_mum;
  INSERT INTO public.care_request_recipients (request_id, client_id, person_id, display_order)
  VALUES (_request, _baby, _baby_p, 2) RETURNING id INTO _r_baby;

  IF (SELECT count(*) FROM public.care_request_recipients WHERE request_id = _request) <> 2 THEN
    RAISE EXCEPTION 'one request must hold several recipients';
  END IF;

  -- Membership and relationship are facts about people. They grant nothing.
  INSERT INTO public.care_group_members (group_id, person_id, role) VALUES (_group, _mum_p, 'enquirer');
  INSERT INTO public.care_person_relationships (group_id, from_person_id, to_person_id, relationship_code)
  VALUES (_group, _mum_p, _baby_p, 'mother_of');

  IF EXISTS (SELECT 1 FROM public.care_access_grants
              WHERE person_id IN (_mum_p, _baby_p) AND state = 'active') THEN
    RAISE EXCEPTION 'membership and relationships must never create access';
  END IF;

  RAISE NOTICE 'multi recipient family: pass';
END $$;

ROLLBACK;
