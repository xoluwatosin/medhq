-- Care groups, multi-recipient requests, service intentions and grouped
-- assessment visits. Everything here is synthetic and rolled back.
BEGIN;

DO $$
DECLARE
  _group uuid; _request uuid; _other_request uuid;
  _mum uuid; _baby uuid; _gran uuid;
  _r_mum uuid; _r_baby uuid; _r_gran uuid; _r_other uuid;
  _person_a uuid; _person_b uuid;
  _svc_postnatal uuid; _svc_elder uuid; _svc_nanny uuid;
  _intention uuid; _visit uuid; _work uuid;
  _flagged boolean; _reason text; _count integer; _overview jsonb;
BEGIN
  SELECT id INTO _svc_postnatal FROM public.services WHERE slug = 'postnatal' LIMIT 1;
  SELECT id INTO _svc_elder FROM public.services WHERE slug = 'eldercare' LIMIT 1;
  SELECT id INTO _svc_nanny FROM public.services WHERE slug = 'nanny_childcare' LIMIT 1;

  -- ------------------------------------------------- a group of three people
  INSERT INTO public.care_groups (display_name, state_code, source)
  VALUES ('ZZ synthetic household', 'LA', 'test') RETURNING id INTO _group;

  INSERT INTO public.clients (full_name, date_of_birth)
  VALUES ('ZZ synthetic mother', (now() - interval '32 years')::date) RETURNING id INTO _mum;
  INSERT INTO public.clients (full_name, date_of_birth)
  VALUES ('ZZ synthetic baby', (now() - interval '20 days')::date) RETURNING id INTO _baby;
  INSERT INTO public.clients (full_name, date_of_birth)
  VALUES ('ZZ synthetic grandmother', (now() - interval '78 years')::date) RETURNING id INTO _gran;

  INSERT INTO public.care_people (full_name) VALUES ('ZZ synthetic enquirer') RETURNING id INTO _person_a;
  INSERT INTO public.care_people (full_name) VALUES ('ZZ synthetic partner') RETURNING id INTO _person_b;

  INSERT INTO public.care_requests (group_id, enquirer_person_id, status, source)
  VALUES (_group, _person_a, 'open', 'test') RETURNING id INTO _request;

  INSERT INTO public.care_request_recipients (request_id, client_id, display_order)
  VALUES (_request, _mum, 1) RETURNING id INTO _r_mum;
  INSERT INTO public.care_request_recipients (request_id, client_id, display_order)
  VALUES (_request, _baby, 2) RETURNING id INTO _r_baby;
  INSERT INTO public.care_request_recipients (request_id, client_id, display_order)
  VALUES (_request, _gran, 3) RETURNING id INTO _r_gran;

  -- One request holds several recipients, each keeping its own care record.
  SELECT count(*) INTO _count FROM public.care_request_recipients WHERE request_id = _request;
  IF _count <> 3 THEN RAISE EXCEPTION 'A request must hold every recipient: %', _count; END IF;

  -- A recipient cannot be listed twice on one request.
  BEGIN
    INSERT INTO public.care_request_recipients (request_id, client_id) VALUES (_request, _mum);
    RAISE EXCEPTION 'A recipient was listed twice on one request';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- ------------------------------------------------------------ memberships
  INSERT INTO public.care_group_members (group_id, person_id, role)
  VALUES (_group, _person_a, 'enquirer');
  INSERT INTO public.care_group_members (group_id, person_id, role)
  VALUES (_group, _person_b, 'payer');

  BEGIN
    INSERT INTO public.care_group_members (group_id, person_id, role)
    VALUES (_group, _person_a, 'enquirer');
    RAISE EXCEPTION 'The same membership was recorded twice';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Membership grants nothing. No access grant may appear from grouping alone.
  SELECT count(*) INTO _count FROM public.care_access_grants
   WHERE person_id IN (_person_a, _person_b);
  IF _count <> 0 THEN RAISE EXCEPTION 'Grouping created access it must never create'; END IF;

  -- ---------------------------------------------------------- relationships
  INSERT INTO public.care_person_relationships (group_id, from_person_id, to_person_id, relationship_code)
  VALUES (_group, _person_a, _person_b, 'spouse_or_partner_of');

  BEGIN
    INSERT INTO public.care_person_relationships (group_id, from_person_id, to_person_id, relationship_code)
    VALUES (_group, _person_a, _person_a, 'sibling_of');
    RAISE EXCEPTION 'A person was related to themselves';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.care_person_relationships (group_id, from_person_id, to_person_id, relationship_code)
    VALUES (_group, _person_a, _person_b, 'not_a_real_term');
    RAISE EXCEPTION 'An ungoverned relationship term was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  -- ------------------------------------------------------ service intentions
  -- A shared service across two recipients.
  INSERT INTO public.care_service_intentions (request_id, service_id, state, is_shared, source)
  VALUES (_request, _svc_postnatal, 'confirmed', true, 'test') RETURNING id INTO _intention;
  INSERT INTO public.care_service_intention_recipients (intention_id, request_recipient_id)
  VALUES (_intention, _r_mum), (_intention, _r_baby);

  SELECT bool_or(needs_clinical_resolution) INTO _flagged
    FROM public.care_service_intention_recipients WHERE intention_id = _intention;
  IF _flagged THEN RAISE EXCEPTION 'A mother and newborn on postnatal care were wrongly flagged'; END IF;

  -- An eldercare intention for the grandmother sits alongside it.
  INSERT INTO public.care_service_intentions (request_id, service_id, state, source)
  VALUES (_request, _svc_elder, 'proposed', 'test') RETURNING id INTO _intention;
  INSERT INTO public.care_service_intention_recipients (intention_id, request_recipient_id)
  VALUES (_intention, _r_gran);
  SELECT needs_clinical_resolution INTO _flagged
    FROM public.care_service_intention_recipients WHERE intention_id = _intention;
  IF _flagged THEN RAISE EXCEPTION 'Eldercare for a 78 year old was wrongly flagged'; END IF;

  -- An obviously wrong pairing is flagged, never silently accepted or corrected.
  INSERT INTO public.care_service_intentions (request_id, service_id, source)
  VALUES (_request, _svc_nanny, 'test') RETURNING id INTO _intention;
  INSERT INTO public.care_service_intention_recipients (intention_id, request_recipient_id)
  VALUES (_intention, _r_gran);
  SELECT needs_clinical_resolution, conflict_reason INTO _flagged, _reason
    FROM public.care_service_intention_recipients WHERE intention_id = _intention;
  IF NOT _flagged OR _reason IS NULL THEN
    RAISE EXCEPTION 'Childcare for a 78 year old was not flagged for clinical resolution';
  END IF;

  -- A service cannot reach a recipient on a different request.
  INSERT INTO public.care_requests (group_id, status, source) VALUES (_group, 'draft', 'test')
    RETURNING id INTO _other_request;
  INSERT INTO public.care_request_recipients (request_id, client_id)
  VALUES (_other_request, _mum) RETURNING id INTO _r_other;
  BEGIN
    INSERT INTO public.care_service_intention_recipients (intention_id, request_recipient_id)
    VALUES (_intention, _r_other);
    RAISE EXCEPTION 'A service crossed from one request to another';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%same request%' THEN RAISE; END IF;
  END;

  -- ---------------------------------------------------------- grouped visits
  INSERT INTO public.care_assessment_visits (group_id, request_id, appointment_at, location_kind, status)
  VALUES (_group, _request, now() + interval '3 days', 'home', 'planned') RETURNING id INTO _visit;

  INSERT INTO public.care_assessment_work (client_id, status, visit_id)
  VALUES (_mum, 'requested', _visit) RETURNING id INTO _work;
  INSERT INTO public.care_assessment_work (client_id, status, visit_id)
  VALUES (_baby, 'requested', _visit);

  -- One visit, but one assessment record per recipient. Never merged.
  SELECT count(DISTINCT client_id) INTO _count FROM public.care_assessment_work WHERE visit_id = _visit;
  IF _count <> 2 THEN RAISE EXCEPTION 'A grouped visit must keep one record per recipient: %', _count; END IF;

  -- --------------------------------------------------------- the compatibility rule
  -- Every pre-existing care record has exactly one recipient row.
  SELECT count(*) INTO _count FROM public.clients c
   WHERE NOT EXISTS (SELECT 1 FROM public.care_request_recipients rr WHERE rr.client_id = c.id);
  IF _count > 0 THEN RAISE EXCEPTION 'Care records were left outside the new model: %', _count; END IF;

  SELECT count(*) INTO _count FROM (
    SELECT origin_client_id FROM public.care_groups
     WHERE origin_client_id IS NOT NULL GROUP BY origin_client_id HAVING count(*) > 1) x;
  IF _count > 0 THEN RAISE EXCEPTION 'The backfill was not deterministic'; END IF;

  -- ------------------------------------------------------------- the overview
  SELECT jsonb_build_object(
    'recipients', (SELECT count(*) FROM public.care_request_recipients WHERE request_id = _request),
    'services', (SELECT count(*) FROM public.care_service_intentions WHERE request_id = _request)
  ) INTO _overview;
  IF (_overview ->> 'services')::int <> 3 THEN
    RAISE EXCEPTION 'The request did not hold every service intention';
  END IF;

  RAISE NOTICE 'care group foundation: all checks passed';
END $$;

ROLLBACK;
