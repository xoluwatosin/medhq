-- Pass 7.5E: observations, interventions and goal evidence. Rollback safe:
-- every synthetic row is created inside one statement that always ends by
-- raising, so nothing it writes is ever kept. Run it on a privileged (owner)
-- connection. It borrows one existing care document (and that document's
-- client) and one service, and changes none of them.
--
-- A pass is reported as the final notice-shaped error:
--   care_delivery_records: all assertions passed
--
-- What it proves:
--   1. no anon or authenticated write privilege on any of the three tables;
--   2. who may record: clinical staff, a care worker with an active assignment
--      on the episode; not coordinators, unassigned or planned-only carers,
--      or office staff; family only against a monitoring item allowing it;
--   3. payloads are validated (fields, values, times, links across episodes);
--   4. a correction creates a successor and never mutates the original;
--      records cannot be edited or deleted even by the owner;
--   5. observation, intervention and follow-up observation form a chain;
--   6. an escalation raises a care flag and links it;
--   7. readers see by visibility: staff everything, an assigned care worker
--      family and care-team records, a family member with the clinical scope
--      family records only, anyone else nothing;
--   8. two episodes on one client never cross-read.

DO $$
DECLARE
  _admin uuid; _client uuid; _client2 uuid; _doc uuid; _svc text;
  _u_carer uuid := gen_random_uuid(); _u_other uuid := gen_random_uuid();
  _u_planned uuid := gen_random_uuid(); _u_office uuid := gen_random_uuid();
  _u_fam uuid := gen_random_uuid(); _u_coord uuid := gen_random_uuid();
  _u_stranger uuid := gen_random_uuid();
  _carer uuid; _other uuid; _planned uuid; _office uuid; _fam uuid; _basis uuid;
  _ep uuid; _ep2 uuid; _plan uuid; _i_self uuid; _i_team uuid; _i_ep2 uuid;
  _goal uuid; _goal_other uuid;
  _o1 uuid; _o1b uuid; _o2 uuid; _o_fam uuid; _o_prof uuid; _o_err uuid; _o_err2 uuid;
  _o_after uuid; _o_ep2 uuid; _iv uuid; _ev uuid; _ev2 uuid; _flag uuid;
  _before jsonb; _r jsonb; _n integer; _t text;
BEGIN
  -- 1. table privileges --------------------------------------------------------
  FOREACH _t IN ARRAY ARRAY['public.care_observations','public.care_interventions','public.care_goal_evidence'] LOOP
    IF has_table_privilege('authenticated', _t, 'INSERT')
       OR has_table_privilege('authenticated', _t, 'UPDATE')
       OR has_table_privilege('authenticated', _t, 'DELETE')
       OR has_table_privilege('anon', _t, 'SELECT')
       OR has_table_privilege('anon', _t, 'INSERT') THEN
      RAISE EXCEPTION 'care_delivery_records: % takes direct writes', _t;
    END IF;
  END LOOP;

  -- Setup ---------------------------------------------------------------------
  SELECT ur.user_id INTO _admin
    FROM public.user_roles ur
    JOIN public.admin_permissions ap ON ap.user_id = ur.user_id AND COALESCE(ap.is_active, true)
   WHERE ur.role = 'admin' LIMIT 1;
  IF _admin IS NULL THEN RAISE EXCEPTION 'care_delivery_records: no admin user to test as'; END IF;
  UPDATE public.admin_permissions SET permissions = permissions || '["care_clinical","workforce"]'::jsonb
   WHERE user_id = _admin;

  SELECT id, client_id INTO _doc, _client FROM public.care_documents ORDER BY created_at LIMIT 1;
  SELECT id INTO _client2 FROM public.clients WHERE id <> _client ORDER BY created_at LIMIT 1;
  SELECT slug INTO _svc FROM public.services ORDER BY slug LIMIT 1;
  IF _doc IS NULL OR _client2 IS NULL OR _svc IS NULL THEN
    RAISE EXCEPTION 'care_delivery_records: no document, second client or service to test with';
  END IF;

  INSERT INTO public.care_episodes (client_id, service_code, status) VALUES (_client, _svc, 'active') RETURNING id INTO _ep;
  INSERT INTO public.care_episodes (client_id, service_code, status) VALUES (_client, _svc, 'active') RETURNING id INTO _ep2;
  INSERT INTO public.care_plan_goals (document_id, client_id, title)
  VALUES (_doc, _client, 'Walk to the garden with a frame') RETURNING id INTO _goal;
  INSERT INTO public.care_plan_goals (document_id, client_id, title)
  VALUES (_doc, _client2, 'Another client''s goal') RETURNING id INTO _goal_other;

  INSERT INTO auth.users (id, email) VALUES
    (_u_carer, 'synthetic-dr1@example.invalid'), (_u_other, 'synthetic-dr2@example.invalid'),
    (_u_planned, 'synthetic-dr3@example.invalid'), (_u_office, 'synthetic-dr4@example.invalid'),
    (_u_fam, 'synthetic-dr5@example.invalid'), (_u_coord, 'synthetic-dr6@example.invalid'),
    (_u_stranger, 'synthetic-dr7@example.invalid');
  INSERT INTO public.mu_people (full_name, auth_user_id, is_staff, staff_status, work_setting)
  VALUES ('Synthetic delivery carer', _u_carer, true, 'active', 'field') RETURNING id INTO _carer;
  INSERT INTO public.mu_people (full_name, auth_user_id, is_staff, staff_status, work_setting)
  VALUES ('Synthetic other-episode carer', _u_other, true, 'active', 'field') RETURNING id INTO _other;
  INSERT INTO public.mu_people (full_name, auth_user_id, is_staff, staff_status, work_setting)
  VALUES ('Synthetic planned carer', _u_planned, true, 'active', 'field') RETURNING id INTO _planned;
  INSERT INTO public.mu_people (full_name, auth_user_id, is_staff, staff_status, work_setting)
  VALUES ('Synthetic office staff', _u_office, true, 'active', 'office') RETURNING id INTO _office;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin::text, 'role', 'authenticated')::text, true);
  PERFORM public.care_worker_capability_set(_carer, true, 'test');
  PERFORM public.care_worker_capability_set(_other, true, 'test');
  PERFORM public.care_worker_capability_set(_planned, true, 'test');
  INSERT INTO public.care_delivery_assignments (episode_id, person_id, capability_code, status, effective_from) VALUES
    (_ep, _carer, 'care_worker', 'active', current_date),
    (_ep2, _other, 'care_worker', 'active', current_date),
    (_ep, _planned, 'care_worker', 'planned', current_date + 7),
    (_ep, _office, 'care_worker', 'active', current_date);

  INSERT INTO public.care_people (full_name, auth_user_id) VALUES ('Synthetic family member', _u_fam) RETURNING id INTO _fam;
  INSERT INTO public.care_access_bases (person_id, client_id, basis_kind) VALUES (_fam, _client, 'client_consent') RETURNING id INTO _basis;
  INSERT INTO public.care_access_grants (person_id, client_id, journey_scope, clinical_scope, clinical_basis_id, state)
  VALUES (_fam, _client, true, true, _basis, 'active');

  INSERT INTO public.user_roles (user_id, role) VALUES (_u_coord, 'admin');
  INSERT INTO public.admin_permissions (user_id, email, permissions)
  VALUES (_u_coord, 'synthetic-dr6@example.invalid', '["care_coordinator"]'::jsonb);

  _plan := public.care_monitoring_plan_create(_ep, 'Delivery test plan', NULL);
  _i_self := public.care_monitoring_item_add(_plan, '{"observation_type":"blood_glucose","frequency":"daily","visibility":"family","self_entry_permitted":true,"unit":"mmol/L"}');
  _i_team := public.care_monitoring_item_add(_plan, '{"observation_type":"blood_pressure","frequency":"each_visit","unit":"mmHg"}');
  _i_ep2 := public.care_monitoring_item_add(public.care_monitoring_plan_create(_ep2, 'Other plan', NULL),
                                            '{"observation_type":"weight","frequency":"weekly"}');

  -- 2. who may record ----------------------------------------------------------
  _o_prof := public.care_observation_record(_ep, '{"observation_type":"wound_state","value":{"text":"Edges pink, no exudate"},"visibility":"professional"}');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_carer::text, 'role', 'authenticated')::text, true);
  _o1 := public.care_observation_record(_ep, jsonb_build_object(
    'monitoring_item_id', _i_team, 'value', jsonb_build_object('systolic', 196, 'diastolic', 96),
    'observed_at', now() - interval '20 minutes'));
  _o2 := public.care_observation_record(_ep, '{"observation_type":"confusion","value":{"text":"More confused than usual"},"visibility":"family"}');
  SELECT to_jsonb(o) INTO _before FROM public.care_observations o WHERE id = _o1;
  IF _before->>'observation_type' <> 'blood_pressure' OR _before->>'performer_capability' <> 'care_worker'
     OR (_before->>'performer_person_id')::uuid <> _carer OR _before->>'visibility' <> 'care_team'
     OR (_before->>'client_id')::uuid <> _client OR _before->>'source' <> 'manual' THEN
    RAISE EXCEPTION 'care_delivery_records: observation recorded wrongly (%)', _before;
  END IF;

  FOREACH _t IN ARRAY ARRAY[_u_other::text, _u_planned::text, _u_office::text, _u_coord::text, _u_stranger::text] LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', _t, 'role', 'authenticated')::text, true);
    BEGIN
      PERFORM public.care_observation_record(_ep, '{"observation_type":"pulse","value":{"bpm":80}}');
      RAISE EXCEPTION 'care_delivery_records: % recorded an observation', _t;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM LIKE 'care_delivery_records:%' THEN RAISE; END IF;
      IF SQLERRM NOT LIKE 'You cannot record care%' THEN
        RAISE EXCEPTION 'care_delivery_records: wrong refusal for % (%)', _t, SQLERRM;
      END IF;
    END;
  END LOOP;

  -- Family: only against a self-entry item, and always family-visible.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_fam::text, 'role', 'authenticated')::text, true);
  _o_fam := public.care_observation_record(_ep, jsonb_build_object(
    'monitoring_item_id', _i_self, 'value', jsonb_build_object('value', 6.2), 'source', 'device'));
  IF (SELECT source || '/' || visibility || '/' || performer_capability FROM public.care_observations WHERE id = _o_fam)
     <> 'family_self_entry/family/family' THEN
    RAISE EXCEPTION 'care_delivery_records: family entry not marked as self-entry';
  END IF;
  BEGIN
    PERFORM public.care_observation_record(_ep, jsonb_build_object('monitoring_item_id', _i_team, 'value', '{"systolic":120}'::jsonb));
    RAISE EXCEPTION 'care_delivery_records: family recorded against an item without self-entry';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_records:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.care_observation_record(_ep, '{"observation_type":"pulse","value":{"bpm":80}}');
    RAISE EXCEPTION 'care_delivery_records: family recorded without a monitoring item';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_records:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.care_intervention_record(_ep, '{"intervention_type":"dressing_change"}');
    RAISE EXCEPTION 'care_delivery_records: family recorded an intervention';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_records:%' THEN RAISE; END IF;
  END;

  -- 3. validation ------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_carer::text, 'role', 'authenticated')::text, true);
  FOREACH _t IN ARRAY ARRAY[
    '{"observation_type":"pulse","value":{"bpm":80},"colour":"red"}',
    '{"observation_type":"pulse","value":{}}',
    '{"observation_type":"pulse"}',
    '{"observation_type":"Pulse Rate!","value":{"bpm":80}}',
    '{"observation_type":"pulse","value":{"bpm":80},"observed_at":"2999-01-01T00:00:00Z"}',
    '{"observation_type":"pulse","value":{"bpm":80},"source":"family_self_entry"}',
    '{"observation_type":"pulse","value":{"bpm":80},"escalate":{"severity":"whenever","detail":"x"}}',
    '{"observation_type":"pulse","value":{"bpm":80},"escalate":{"severity":"urgent"}}',
    '{"observation_type":"weight","value":{"kg":70},"monitoring_item_id":"' || _i_ep2 || '"}',
    '{"observation_type":"pulse","value":{"bpm":80},"monitoring_item_id":"' || _i_team || '"}'] LOOP
    BEGIN
      PERFORM public.care_observation_record(_ep, _t::jsonb);
      RAISE EXCEPTION 'care_delivery_records: accepted a bad observation %', _t;
    EXCEPTION WHEN raise_exception OR check_violation OR invalid_text_representation THEN
      IF SQLERRM LIKE 'care_delivery_records:%' THEN RAISE; END IF;
    END;
  END LOOP;
  BEGIN
    PERFORM public.care_goal_evidence_record(_ep, jsonb_build_object('goal_id', _goal_other, 'evidence_type', 'observed'));
    RAISE EXCEPTION 'care_delivery_records: evidence recorded against another client''s goal';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_records:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.care_goal_evidence_record(_ep, jsonb_build_object('goal_id', _goal, 'frequency', 5, 'opportunity_count', 3));
    RAISE EXCEPTION 'care_delivery_records: evidence counted more successes than opportunities';
  EXCEPTION WHEN raise_exception OR check_violation THEN
    IF SQLERRM LIKE 'care_delivery_records:%' THEN RAISE; END IF;
  END;

  -- 4. corrections are successors; nothing is edited or deleted ---------------
  _o1b := public.care_observation_correct(_o1, '{"value":{"systolic":169,"diastolic":96}}', 'Misread the screen');
  IF (SELECT to_jsonb(o) FROM public.care_observations o WHERE id = _o1) IS DISTINCT FROM _before THEN
    RAISE EXCEPTION 'care_delivery_records: the original observation changed';
  END IF;
  SELECT to_jsonb(o) INTO _r FROM public.care_observations o WHERE id = _o1b;
  IF (_r->>'corrects_id')::uuid <> _o1 OR (_r->'value'->>'systolic')::int <> 169
     OR _r->>'observation_type' <> 'blood_pressure' OR (_r->>'monitoring_item_id')::uuid <> _i_team
     OR _r->>'observed_at' <> _before->>'observed_at' OR _r->>'correction_reason' <> 'Misread the screen' THEN
    RAISE EXCEPTION 'care_delivery_records: correction did not carry the original (%)', _r;
  END IF;
  BEGIN
    PERFORM public.care_observation_correct(_o1, '{"value":{"systolic":170}}', 'Again');
    RAISE EXCEPTION 'care_delivery_records: an already-corrected observation was corrected again';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_records:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.care_observation_correct(_o1b, '{"value":{"systolic":170}}', '  ');
    RAISE EXCEPTION 'care_delivery_records: a correction without a reason was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_records:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.care_observation_correct(_o1b, '{"observation_type":"pulse"}', 'Wrong type');
    RAISE EXCEPTION 'care_delivery_records: a correction changed what was observed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_records:%' THEN RAISE; END IF;
  END;
  -- A carer cannot correct someone else's record.
  BEGIN
    PERFORM public.care_observation_correct(_o_prof, '{"value":{"text":"x"}}', 'Not mine');
    RAISE EXCEPTION 'care_delivery_records: a carer corrected a clinician''s record';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_records:%' THEN RAISE; END IF;
  END;
  -- Entered in error: a successor, original untouched; nothing follows it.
  _o_err := public.care_observation_record(_ep, '{"observation_type":"pulse","value":{"bpm":80},"visibility":"family"}');
  _o_err2 := public.care_observation_correct(_o_err, NULL, 'Wrong client');
  IF (SELECT status FROM public.care_observations WHERE id = _o_err) <> 'final'
     OR (SELECT status FROM public.care_observations WHERE id = _o_err2) <> 'entered_in_error' THEN
    RAISE EXCEPTION 'care_delivery_records: entered-in-error not recorded as a successor';
  END IF;
  BEGIN
    PERFORM public.care_observation_correct(_o_err2, '{"value":{"bpm":81}}', 'Revive');
    RAISE EXCEPTION 'care_delivery_records: an entered-in-error record was corrected';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_records:%' THEN RAISE; END IF;
  END;

  -- Even the owner cannot edit or delete (this block runs as the owner).
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    UPDATE public.care_observations SET value = '{"systolic":1}' WHERE id = _o1;
    RAISE EXCEPTION 'care_delivery_records: an observation was edited in place';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_records:%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.care_observations WHERE id = _o2;
    RAISE EXCEPTION 'care_delivery_records: an observation was deleted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_records:%' THEN RAISE; END IF;
  END;

  -- 5. chain: observation -> intervention -> follow-up observation ------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_carer::text, 'role', 'authenticated')::text, true);
  _iv := public.care_intervention_record(_ep, jsonb_build_object(
    'intervention_type', 'repositioning', 'before_observation_id', _o1b, 'outcome', 'completed',
    'detail', jsonb_build_object('position', 'left side'), 'visibility', 'family'));
  _o_after := public.care_observation_record(_ep, jsonb_build_object(
    'monitoring_item_id', _i_team, 'value', jsonb_build_object('systolic', 150, 'diastolic', 90),
    'after_intervention_id', _iv));
  IF (SELECT before_observation_id FROM public.care_interventions WHERE id = _iv) <> _o1b
     OR (SELECT after_intervention_id FROM public.care_observations WHERE id = _o_after) <> _iv THEN
    RAISE EXCEPTION 'care_delivery_records: chain not linked';
  END IF;
  _o_ep2 := NULL;
  BEGIN
    PERFORM public.care_intervention_record(_ep2, jsonb_build_object('intervention_type', 'feed', 'before_observation_id', _o1b));
    RAISE EXCEPTION 'care_delivery_records: recorded on an episode without an assignment';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_records:%' THEN RAISE; END IF;
  END;
  _ev := public.care_goal_evidence_record(_ep, jsonb_build_object(
    'goal_id', _goal, 'support_level', 'prompted', 'frequency', 2, 'opportunity_count', 3,
    'duration_minutes', 10, 'visibility', 'family'));
  _ev2 := public.care_goal_evidence_correct(_ev, '{"support_level":"partial_assistance"}', 'Needed a hand on the step');
  IF (SELECT support_level FROM public.care_goal_evidence WHERE id = _ev) <> 'prompted'
     OR (SELECT support_level || '/' || frequency FROM public.care_goal_evidence WHERE id = _ev2) <> 'partial_assistance/2' THEN
    RAISE EXCEPTION 'care_delivery_records: goal evidence correction wrong';
  END IF;

  -- 6. escalation raises and links a care flag --------------------------------
  _o_ep2 := public.care_observation_record(_ep, jsonb_build_object(
    'observation_type', 'breathing', 'value', jsonb_build_object('text', 'Short of breath at rest'),
    'escalate', jsonb_build_object('severity', 'urgent', 'detail', 'Short of breath at rest, lips pale')));
  SELECT flag_id INTO _flag FROM public.care_observations WHERE id = _o_ep2;
  IF _flag IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.care_flags WHERE id = _flag AND client_id = _client AND severity = 'urgent'
          AND kind = 'clinical_review' AND raised_by = 'care_delivery' AND cleared_at IS NULL) THEN
    RAISE EXCEPTION 'care_delivery_records: escalation did not raise a linked flag';
  END IF;
  -- Removing a flag clears the link and nothing else.
  PERFORM set_config('request.jwt.claims', '', true);
  DELETE FROM public.care_flags WHERE id = _flag;
  IF (SELECT flag_id FROM public.care_observations WHERE id = _o_ep2) IS NOT NULL THEN
    RAISE EXCEPTION 'care_delivery_records: flag link survived the flag';
  END IF;

  -- 7. readers by visibility ----------------------------------------------------
  -- Staff (clinical): every level, current versions, entered-in-error shown.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin::text, 'role', 'authenticated')::text, true);
  _r := public.care_delivery_read(_ep);
  IF NOT _r->'observations' @> jsonb_build_array(jsonb_build_object('id', _o_prof))
     OR NOT _r->'observations' @> jsonb_build_array(jsonb_build_object('id', _o_err2, 'status', 'entered_in_error'))
     OR _r->'observations' @> jsonb_build_array(jsonb_build_object('id', _o1))
     OR _r->'observations' @> jsonb_build_array(jsonb_build_object('id', _o_err))
     OR NOT _r->'goal_evidence' @> jsonb_build_array(jsonb_build_object('id', _ev2, 'goal_title', 'Walk to the garden with a frame')) THEN
    RAISE EXCEPTION 'care_delivery_records: staff read wrong (%)', _r;
  END IF;
  -- Coordinator: reads everything, records nothing (checked in 2).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_coord::text, 'role', 'authenticated')::text, true);
  IF NOT public.care_delivery_read(_ep)->'observations' @> jsonb_build_array(jsonb_build_object('id', _o_prof)) THEN
    RAISE EXCEPTION 'care_delivery_records: coordinator cannot read';
  END IF;
  -- Assigned carer: family and care team, no professional, no error markers.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_carer::text, 'role', 'authenticated')::text, true);
  _r := public.care_delivery_read(_ep);
  IF NOT _r->'observations' @> jsonb_build_array(jsonb_build_object('id', _o1b))
     OR NOT _r->'observations' @> jsonb_build_array(jsonb_build_object('id', _o2))
     OR _r->'observations' @> jsonb_build_array(jsonb_build_object('id', _o_prof))
     OR _r->'observations' @> jsonb_build_array(jsonb_build_object('id', _o_err2))
     OR _r->'observations' @> jsonb_build_array(jsonb_build_object('id', _o_err))
     OR jsonb_path_exists(_r, '$.**.flag_id ? (@ != null)') THEN
    RAISE EXCEPTION 'care_delivery_records: carer read wrong (%)', _r;
  END IF;
  -- The planned carer reads (to prepare) but cannot record (checked in 2).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_planned::text, 'role', 'authenticated')::text, true);
  IF public.care_delivery_read(_ep) IS NULL THEN
    RAISE EXCEPTION 'care_delivery_records: planned carer cannot read';
  END IF;
  -- Family: family-visible current records only.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_fam::text, 'role', 'authenticated')::text, true);
  _r := public.care_delivery_read(_ep);
  SELECT count(*) INTO _n FROM jsonb_array_elements(_r->'observations') x WHERE x->>'visibility' <> 'family';
  IF _n <> 0 OR NOT _r->'observations' @> jsonb_build_array(jsonb_build_object('id', _o2))
     OR NOT _r->'observations' @> jsonb_build_array(jsonb_build_object('id', _o_fam))
     OR _r->'observations' @> jsonb_build_array(jsonb_build_object('id', _o1b))
     OR _r->'observations' @> jsonb_build_array(jsonb_build_object('id', _o_err))
     OR _r->'observations' @> jsonb_build_array(jsonb_build_object('id', _o_err2))
     OR NOT _r->'interventions' @> jsonb_build_array(jsonb_build_object('id', _iv))
     OR NOT _r->'goal_evidence' @> jsonb_build_array(jsonb_build_object('id', _ev2)) THEN
    RAISE EXCEPTION 'care_delivery_records: family read wrong (%)', _r;
  END IF;
  -- Family corrects their own entry, not anyone else's.
  PERFORM public.care_observation_correct(_o_fam, '{"value":{"value":6.0}}', 'Typed it wrong');
  BEGIN
    PERFORM public.care_observation_correct(_o2, '{"value":{"text":"Fine"}}', 'Disagree');
    RAISE EXCEPTION 'care_delivery_records: family corrected a carer''s record';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_records:%' THEN RAISE; END IF;
  END;
  -- Strangers and office staff: nothing.
  FOREACH _t IN ARRAY ARRAY[_u_stranger::text, _u_office::text] LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', _t, 'role', 'authenticated')::text, true);
    IF public.care_delivery_read(_ep) IS NOT NULL THEN
      RAISE EXCEPTION 'care_delivery_records: % read the episode', _t;
    END IF;
  END LOOP;
  -- Direct table reads: carers and family see no rows; clinical staff see all.
  FOREACH _t IN ARRAY ARRAY[_u_carer::text, _u_fam::text] LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', _t, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT (SELECT count(*) FROM public.care_observations) + (SELECT count(*) FROM public.care_interventions)
         + (SELECT count(*) FROM public.care_goal_evidence) INTO _n;
    EXECUTE 'RESET ROLE';
    IF _n <> 0 THEN RAISE EXCEPTION 'care_delivery_records: % read % rows directly', _t, _n; END IF;
  END LOOP;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO _n FROM public.care_observations WHERE episode_id = _ep;
  EXECUTE 'RESET ROLE';
  IF _n < 8 THEN RAISE EXCEPTION 'care_delivery_records: clinical staff read only % rows directly', _n; END IF;

  -- 8. two episodes never cross-read --------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_other::text, 'role', 'authenticated')::text, true);
  _o_ep2 := public.care_observation_record(_ep2, jsonb_build_object('monitoring_item_id', _i_ep2, 'value', '{"kg":71}'::jsonb));
  _r := public.care_delivery_read(_ep2);
  IF jsonb_array_length(_r->'observations') <> 1 OR _r->'observations'->0->>'id' <> _o_ep2::text
     OR jsonb_array_length(_r->'interventions') <> 0 OR jsonb_array_length(_r->'goal_evidence') <> 0 THEN
    RAISE EXCEPTION 'care_delivery_records: episode two read wrong (%)', _r;
  END IF;
  IF public.care_delivery_read(_ep) IS NOT NULL THEN
    RAISE EXCEPTION 'care_delivery_records: a carer on episode two read episode one';
  END IF;
  BEGIN
    PERFORM public.care_intervention_record(_ep2, jsonb_build_object('intervention_type', 'feed', 'before_observation_id', _o1b));
    RAISE EXCEPTION 'care_delivery_records: an intervention linked an observation from another episode';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'care_delivery_records:%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u_carer::text, 'role', 'authenticated')::text, true);
  _r := public.care_delivery_read(_ep);
  IF _r->'observations' @> jsonb_build_array(jsonb_build_object('id', _o_ep2)) THEN
    RAISE EXCEPTION 'care_delivery_records: episode one shows episode two''s record';
  END IF;

  RAISE EXCEPTION 'care_delivery_records: all assertions passed';
END $$;
