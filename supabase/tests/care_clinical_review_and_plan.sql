-- Regression cover for clinical review and the versioned care plan.
--
-- Run the whole file as one statement against the database with a role that
-- may write. The block always ends by raising, so every synthetic client,
-- document, work item and permission it made is rolled back. A run that ends
-- with
--   care_clinical_review_and_plan: all checks passed
-- is a pass. Any other message is a failure, and says which rule broke.

DO $$
DECLARE
  _admin uuid;
  _assessor uuid;
  _assessor_auth uuid;
  _client uuid;
  _pre_def uuid;
  _ass_def uuid;
  _pre uuid;
  _visit uuid;
  _doc uuid;
  _doc2 uuid;
  _plan uuid;
  _plan2 uuid;
  _need uuid;
  _goal uuid;
  _task uuid;
  _count integer;
  _stage text;
  _text text;
  _json jsonb;
BEGIN
  SELECT user_id INTO _admin FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  SELECT id, auth_user_id INTO _assessor, _assessor_auth FROM public.mu_people
   WHERE auth_user_id IS NOT NULL AND auth_user_id <> _admin ORDER BY id LIMIT 1;
  SELECT id INTO _pre_def FROM public.form_definitions
   WHERE kind = 'pre_assessment' AND status = 'published' ORDER BY version DESC LIMIT 1;
  SELECT id INTO _ass_def FROM public.form_definitions
   WHERE kind = 'assessment' AND status = 'published' ORDER BY version DESC LIMIT 1;

  IF _admin IS NULL OR _assessor IS NULL THEN
    RAISE EXCEPTION 'FAIL: the run needs an admin and a person with a sign-in';
  END IF;

  -- The reviewer holds the clinical permission.
  INSERT INTO public.admin_permissions (user_id, email, permissions)
  VALUES (_admin, 'regression@example.test', '["care_clinical"]'::jsonb)
  ON CONFLICT (user_id) DO UPDATE SET permissions = public.admin_permissions.permissions || '["care_clinical"]'::jsonb;

  UPDATE public.mu_people SET is_staff = true, staff_status = 'active' WHERE id = _assessor;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin, 'role', 'authenticated')::text, true);

  PERFORM public.care_assessor_capability_set(_assessor, true, 'Regression run');

  INSERT INTO public.clients (full_name, stage, state_code)
  VALUES ('Regression Review Client', 'enquiry', 'lagos') RETURNING id INTO _client;

  INSERT INTO public.care_documents (client_id, kind, form_definition_id, status, responses, submitted_at)
  VALUES (_client, 'pre_assessment', _pre_def, 'submitted', '{}'::jsonb, now())
  RETURNING id INTO _pre;

  _visit := public.care_assessment_schedule(_client, now() + interval '3 days', NULL, 'home', NULL);
  PERFORM public.care_assessment_assign(_visit, _assessor);

  -- The assessor carries out and sends the assessment.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _assessor_auth, 'role', 'authenticated')::text, true);
  PERFORM public.care_assessment_start(_visit);
  SELECT document_id INTO _doc FROM public.care_assessment_work WHERE id = _visit;
  UPDATE public.care_documents SET responses = '{"note.assessor_account":"first account"}'::jsonb WHERE id = _doc;
  PERFORM public.care_assessment_submit(_visit);

  SELECT public.care_derive_stage(_client) INTO _stage;
  IF _stage <> 'clinical_review' THEN
    RAISE EXCEPTION 'FAIL: a sent assessment does not sit in clinical review (%)', _stage;
  END IF;

  -- 1. Somebody without the clinical permission cannot review.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.care_assessment_accept(_visit);
    RAISE EXCEPTION 'FAIL: an unauthorised account accepted an assessment';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;

  -- 2. The assessor cannot review their own assessment.
  INSERT INTO public.user_roles (user_id, role) VALUES (_assessor_auth, 'admin')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.admin_permissions (user_id, email, permissions)
  VALUES (_assessor_auth, 'regression-assessor@example.test', '["care_clinical"]'::jsonb)
  ON CONFLICT (user_id) DO UPDATE SET permissions = public.admin_permissions.permissions || '["care_clinical"]'::jsonb;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _assessor_auth, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.care_assessment_accept(_visit);
    RAISE EXCEPTION 'FAIL: the assessor accepted their own assessment';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin, 'role', 'authenticated')::text, true);

  -- 3. Returning for clarification needs a reason.
  BEGIN
    PERFORM public.care_assessment_return(_visit, '   ');
    RAISE EXCEPTION 'FAIL: an assessment was returned without a reason';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;

  -- 4. Return keeps the sent record and opens a successor.
  PERFORM public.care_assessment_return(_visit, 'Please confirm the medicines list');
  SELECT status INTO _text FROM public.care_documents WHERE id = _doc;
  IF _text <> 'submitted' THEN
    RAISE EXCEPTION 'FAIL: the sent assessment did not stay as it was sent (%)', _text;
  END IF;
  SELECT responses ->> 'note.assessor_account' INTO _text FROM public.care_documents WHERE id = _doc;
  IF _text <> 'first account' THEN
    RAISE EXCEPTION 'FAIL: the sent assessment content changed on return';
  END IF;

  SELECT document_id INTO _doc2 FROM public.care_assessment_work WHERE id = _visit;
  IF _doc2 = _doc THEN RAISE EXCEPTION 'FAIL: no successor draft was created on return'; END IF;
  SELECT built_from_id::text INTO _text FROM public.care_documents WHERE id = _doc2;
  IF _text IS DISTINCT FROM _doc::text THEN
    RAISE EXCEPTION 'FAIL: the successor does not carry its provenance';
  END IF;

  SELECT status INTO _text FROM public.care_assessment_work WHERE id = _visit;
  IF _text <> 'in_progress' THEN
    RAISE EXCEPTION 'FAIL: the assessor was not given the assessment back (%)', _text;
  END IF;
  SELECT public.care_derive_stage(_client) INTO _stage;
  IF _stage <> 'assessment_in_progress' THEN
    RAISE EXCEPTION 'FAIL: a returned assessment still shows as in review (%)', _stage;
  END IF;

  SELECT count(*) INTO _count FROM public.care_work_items
   WHERE client_id = _client AND kind = 'conduct' AND status = 'open';
  IF _count <> 1 THEN
    RAISE EXCEPTION 'FAIL: returning did not reopen exactly one visit task (%)', _count;
  END IF;

  -- Return is idempotent.
  PERFORM public.care_assessment_return(_visit, 'Please confirm the medicines list');
  SELECT count(*) INTO _count FROM public.care_documents
   WHERE client_id = _client AND kind = 'assessment';
  IF _count <> 2 THEN
    RAISE EXCEPTION 'FAIL: returning twice made more than one successor (%)', _count;
  END IF;

  -- 5. Resubmission is version two, and supersedes the first.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _assessor_auth, 'role', 'authenticated')::text, true);
  UPDATE public.care_documents SET responses = '{"note.assessor_account":"clarified account"}'::jsonb WHERE id = _doc2;
  PERFORM public.care_assessment_submit(_visit);
  SELECT version INTO _count FROM public.care_documents WHERE id = _doc2;
  IF _count <> 2 THEN RAISE EXCEPTION 'FAIL: the resubmitted assessment is not version two (%)', _count; END IF;
  SELECT status INTO _text FROM public.care_documents WHERE id = _doc;
  IF _text <> 'superseded' THEN
    RAISE EXCEPTION 'FAIL: the first assessment was not superseded (%)', _text;
  END IF;
  SELECT review_decision INTO _text FROM public.care_assessment_work WHERE id = _visit;
  IF _text IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: the earlier review decision was carried into a fresh review';
  END IF;

  -- A sent assessment cannot be edited.
  BEGIN
    UPDATE public.care_documents SET responses = '{"note.assessor_account":"tampered"}'::jsonb WHERE id = _doc;
    RAISE EXCEPTION 'FAIL: a sent assessment was edited';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;

  -- 6. Acceptance opens the plan and the package in parallel, once.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin, 'role', 'authenticated')::text, true);
  SELECT public.care_assessment_accept(_visit) INTO _json;
  _plan := (_json ->> 'care_plan_id')::uuid;
  IF _plan IS NULL THEN RAISE EXCEPTION 'FAIL: acceptance did not open a care plan'; END IF;

  PERFORM public.care_assessment_accept(_visit);
  SELECT count(*) INTO _count FROM public.care_work_items
   WHERE client_id = _client AND kind = 'prepare_plan' AND status IN ('open','blocked');
  IF _count <> 1 THEN RAISE EXCEPTION 'FAIL: plan preparation was raised % times', _count; END IF;
  SELECT count(*) INTO _count FROM public.care_work_items
   WHERE client_id = _client AND kind = 'agree_package' AND status IN ('open','blocked');
  IF _count <> 1 THEN RAISE EXCEPTION 'FAIL: package agreement was raised % times', _count; END IF;
  SELECT count(*) INTO _count FROM public.care_work_items
   WHERE client_id = _client AND kind = 'clinical_review' AND status IN ('open','blocked');
  IF _count <> 0 THEN RAISE EXCEPTION 'FAIL: clinical review stayed open after acceptance'; END IF;
  SELECT count(*) INTO _count FROM public.care_documents
   WHERE client_id = _client AND kind = 'care_plan';
  IF _count <> 1 THEN RAISE EXCEPTION 'FAIL: acceptance made % care plans', _count; END IF;

  -- 7. The plan carries the fourteen canonical sections and its provenance.
  SELECT jsonb_array_length(f.definition -> 'sections') INTO _count
    FROM public.care_documents d JOIN public.form_definitions f ON f.id = d.form_definition_id
   WHERE d.id = _plan;
  IF _count <> 14 THEN RAISE EXCEPTION 'FAIL: the care plan does not have fourteen sections (%)', _count; END IF;
  SELECT built_from_id::text INTO _text FROM public.care_documents WHERE id = _plan;
  IF _text IS DISTINCT FROM _doc2::text THEN
    RAISE EXCEPTION 'FAIL: the care plan does not point back at the accepted assessment';
  END IF;
  SELECT public.care_derive_stage(_client) INTO _stage;
  IF _stage <> 'care_plan_preparation' THEN
    RAISE EXCEPTION 'FAIL: an accepted assessment does not move to plan preparation (%)', _stage;
  END IF;

  -- 8. Section saves are acknowledged, and only real sections are accepted.
  SELECT public.care_plan_save_section(_plan, 'medicines', '{"note":"Two medicines, morning only"}'::jsonb) INTO _json;
  IF _json ->> 'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'FAIL: a section save was not acknowledged'; END IF;
  IF (_json -> 'saved' ->> 'note') <> 'Two medicines, morning only' THEN
    RAISE EXCEPTION 'FAIL: the acknowledgement does not carry what was saved';
  END IF;
  BEGIN
    PERFORM public.care_plan_save_section(_plan, 'not_a_section', '{"note":"x"}'::jsonb);
    RAISE EXCEPTION 'FAIL: an unknown care plan section was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;

  -- 9. Needs, goals and tasks belong to this version.
  _need := public.care_plan_item_save(_plan, 'need', NULL, '{"title":"Help with washing"}'::jsonb);
  _goal := public.care_plan_item_save(_plan, 'goal', NULL,
             jsonb_build_object('title','Wash without distress','need_id', _need));
  _task := public.care_plan_item_save(_plan, 'task', NULL,
             jsonb_build_object('title','Morning wash','goal_id', _goal, 'frequency','Daily'));
  IF _need IS NULL OR _goal IS NULL OR _task IS NULL THEN
    RAISE EXCEPTION 'FAIL: the structured plan layer did not record an entry';
  END IF;

  -- 10. Issuing the plan freezes it and closes plan preparation.
  PERFORM public.care_plan_submit(_plan);
  SELECT status INTO _text FROM public.care_documents WHERE id = _plan;
  IF _text <> 'submitted' THEN RAISE EXCEPTION 'FAIL: the care plan was not issued (%)', _text; END IF;
  BEGIN
    PERFORM public.care_plan_save_section(_plan, 'medicines', '{"note":"changed"}'::jsonb);
    RAISE EXCEPTION 'FAIL: an issued care plan was edited';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.care_plan_item_save(_plan, 'need', NULL, '{"title":"late addition"}'::jsonb);
    RAISE EXCEPTION 'FAIL: an issued care plan took a new need';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
  SELECT count(*) INTO _count FROM public.care_work_items
   WHERE client_id = _client AND kind = 'prepare_plan' AND status IN ('open','blocked');
  IF _count <> 0 THEN RAISE EXCEPTION 'FAIL: plan preparation stayed open after issue'; END IF;

  -- 11. A change starts a successor version and copies the structured layer.
  _plan2 := public.care_plan_new_version(_plan, 'Hours changed');
  IF _plan2 = _plan THEN RAISE EXCEPTION 'FAIL: no successor plan version was made'; END IF;
  SELECT version INTO _count FROM public.care_documents WHERE id = _plan2;
  IF _count <> 2 THEN RAISE EXCEPTION 'FAIL: the successor plan is not version two (%)', _count; END IF;
  SELECT supersedes_id::text INTO _text FROM public.care_documents WHERE id = _plan2;
  IF _text IS DISTINCT FROM _plan::text THEN
    RAISE EXCEPTION 'FAIL: the successor plan does not carry its provenance';
  END IF;
  SELECT count(*) INTO _count FROM public.care_plan_needs WHERE document_id = _plan2;
  IF _count <> 1 THEN RAISE EXCEPTION 'FAIL: needs were not carried to the new version (%)', _count; END IF;
  SELECT count(*) INTO _count FROM public.care_plan_tasks t
    JOIN public.care_plan_goals g ON g.id = t.goal_id AND g.document_id = _plan2
   WHERE t.document_id = _plan2;
  IF _count <> 1 THEN RAISE EXCEPTION 'FAIL: tasks were not relinked inside the new version (%)', _count; END IF;
  -- Asking again returns the open draft rather than a third version.
  IF public.care_plan_new_version(_plan, 'Hours changed') <> _plan2 THEN
    RAISE EXCEPTION 'FAIL: a second successor was started while a draft was open';
  END IF;

  PERFORM public.care_plan_submit(_plan2);
  SELECT status INTO _text FROM public.care_documents WHERE id = _plan;
  IF _text <> 'superseded' THEN
    RAISE EXCEPTION 'FAIL: the earlier plan version was not superseded (%)', _text;
  END IF;

  RAISE EXCEPTION 'care_clinical_review_and_plan: all checks passed';
END $$;
