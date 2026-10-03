-- Regression cover for the Tranche 7 correction.
--
-- Run the whole file as one statement with a role that may write. The block
-- always ends by raising, so every synthetic client, document, work item and
-- permission it made is rolled back. A run that ends with
--   care_t7_correction: all checks passed
-- is a pass. Any other message is a failure, and says which rule broke.

DO $$
DECLARE
  _admin uuid;
  _plain uuid;
  _assessor uuid;
  _assessor_auth uuid;
  _client uuid;
  _pre_def uuid;
  _pre uuid;
  _visit uuid;
  _doc uuid;
  _doc2 uuid;
  _plan uuid;
  _count integer;
  _text text;
  _json jsonb;
BEGIN
  SELECT user_id INTO _admin FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  SELECT id, auth_user_id INTO _assessor, _assessor_auth FROM public.mu_people
   WHERE auth_user_id IS NOT NULL AND auth_user_id <> _admin ORDER BY id LIMIT 1;
  SELECT id INTO _pre_def FROM public.form_definitions
   WHERE kind = 'pre_assessment' AND status = 'published' ORDER BY version DESC LIMIT 1;

  IF _admin IS NULL OR _assessor IS NULL THEN
    RAISE EXCEPTION 'FAIL: the run needs an admin and a person with a sign-in';
  END IF;

  -- A coordinator: admin, but without clinical authority.
  SELECT p.auth_user_id INTO _plain FROM public.mu_people p
   WHERE p.auth_user_id IS NOT NULL
     AND p.auth_user_id <> _admin AND p.auth_user_id <> _assessor_auth
   ORDER BY p.id LIMIT 1;
  IF _plain IS NULL THEN RAISE EXCEPTION 'FAIL: the run needs a second sign-in to act as a coordinator'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_plain, 'admin') ON CONFLICT DO NOTHING;
  INSERT INTO public.admin_permissions (user_id, email, permissions)
  VALUES (_plain, 'coordinator@example.test', '["care"]'::jsonb)
  ON CONFLICT (user_id) DO UPDATE SET permissions = '["care"]'::jsonb;

  INSERT INTO public.admin_permissions (user_id, email, permissions)
  VALUES (_admin, 'regression@example.test', '["care_clinical"]'::jsonb)
  ON CONFLICT (user_id) DO UPDATE SET permissions = public.admin_permissions.permissions || '["care_clinical"]'::jsonb;

  UPDATE public.mu_people SET is_staff = true, staff_status = 'active' WHERE id = _assessor;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin, 'role', 'authenticated')::text, true);
  PERFORM public.care_assessor_capability_set(_assessor, true, 'Regression run');

  INSERT INTO public.clients (full_name, stage, state_code)
  VALUES ('Regression T7 Client', 'enquiry', 'lagos') RETURNING id INTO _client;

  INSERT INTO public.care_documents (client_id, kind, form_definition_id, status, responses, submitted_at)
  VALUES (_client, 'pre_assessment', _pre_def, 'submitted', '{}'::jsonb, now())
  RETURNING id INTO _pre;

  _visit := public.care_assessment_schedule(_client, now() + interval '3 days', NULL, 'home', NULL);
  PERFORM public.care_assessment_assign(_visit, _assessor);

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _assessor_auth, 'role', 'authenticated')::text, true);
  PERFORM public.care_assessment_start(_visit);
  SELECT document_id INTO _doc FROM public.care_assessment_work WHERE id = _visit;
  UPDATE public.care_documents SET responses = '{"note.assessor_account":"first account"}'::jsonb WHERE id = _doc;
  PERFORM public.care_assessment_submit(_visit);

  -- 1. A coordinator without clinical authority cannot review.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _plain, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.care_assessment_accept(_visit);
    RAISE EXCEPTION 'FAIL: a coordinator accepted an assessment';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.care_assessment_return(_visit, 'Please clarify');
    RAISE EXCEPTION 'FAIL: a coordinator returned an assessment';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;

  -- 2. The assessor cannot review their own assessment.
  INSERT INTO public.user_roles (user_id, role) VALUES (_assessor_auth, 'admin') ON CONFLICT DO NOTHING;
  INSERT INTO public.admin_permissions (user_id, email, permissions)
  VALUES (_assessor_auth, 'regression-assessor@example.test', '["care_clinical"]'::jsonb)
  ON CONFLICT (user_id) DO UPDATE SET permissions = public.admin_permissions.permissions || '["care_clinical"]'::jsonb;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _assessor_auth, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.care_assessment_accept(_visit);
    RAISE EXCEPTION 'FAIL: the assessor accepted their own assessment';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin, 'role', 'authenticated')::text, true);

  -- 3. A sent assessment is immutable in every protected respect.
  BEGIN
    UPDATE public.care_documents SET responses = '{"note.assessor_account":"tampered"}'::jsonb WHERE id = _doc;
    RAISE EXCEPTION 'FAIL: a sent assessment was edited';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.care_documents SET version = 99 WHERE id = _doc;
    RAISE EXCEPTION 'FAIL: a sent assessment version was changed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.care_documents SET authored_by_person_id = NULL WHERE id = _doc;
    RAISE EXCEPTION 'FAIL: a sent assessment author was changed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.care_documents SET built_from_id = _pre WHERE id = _doc;
    RAISE EXCEPTION 'FAIL: a sent assessment provenance was changed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.care_documents SET submitted_at = now() + interval '1 day' WHERE id = _doc;
    RAISE EXCEPTION 'FAIL: a sent assessment submission time was changed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.care_documents SET status = 'draft' WHERE id = _doc;
    RAISE EXCEPTION 'FAIL: a sent assessment was reopened';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;

  -- 4. Return preserves the source, makes one successor and one visit task.
  PERFORM public.care_assessment_return(_visit, 'Please confirm the medicines list');
  SELECT status INTO _text FROM public.care_documents WHERE id = _doc;
  IF _text <> 'submitted' THEN RAISE EXCEPTION 'FAIL: the sent assessment did not stay as it was sent (%)', _text; END IF;
  SELECT document_id INTO _doc2 FROM public.care_assessment_work WHERE id = _visit;
  IF _doc2 = _doc THEN RAISE EXCEPTION 'FAIL: no successor draft was created on return'; END IF;
  SELECT count(*) INTO _count FROM public.care_work_items
   WHERE client_id = _client AND kind = 'conduct' AND status = 'open';
  IF _count <> 1 THEN RAISE EXCEPTION 'FAIL: returning did not reopen exactly one visit task (%)', _count; END IF;

  -- 5. The assessor is notified once, with no clinical content in the payload.
  SELECT count(*) INTO _count FROM public.care_notifications
   WHERE client_id = _client AND kind = 'assessment_returned';
  IF _count <> 1 THEN RAISE EXCEPTION 'FAIL: return raised % notifications', _count; END IF;
  PERFORM public.care_assessment_return(_visit, 'Please confirm the medicines list');
  SELECT count(*) INTO _count FROM public.care_notifications
   WHERE client_id = _client AND kind = 'assessment_returned';
  IF _count <> 1 THEN RAISE EXCEPTION 'FAIL: a repeated return duplicated the notification (%)', _count; END IF;
  SELECT subject INTO _text FROM public.care_notifications
   WHERE client_id = _client AND kind = 'assessment_returned';
  IF _text LIKE '%medicines%' THEN
    RAISE EXCEPTION 'FAIL: the notification carries clinical detail';
  END IF;

  -- 6. Resubmission supersedes the first sent version.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _assessor_auth, 'role', 'authenticated')::text, true);
  PERFORM public.care_assessment_submit(_visit);
  SELECT status INTO _text FROM public.care_documents WHERE id = _doc;
  IF _text <> 'superseded' THEN RAISE EXCEPTION 'FAIL: the first assessment was not superseded (%)', _text; END IF;
  SELECT version INTO _count FROM public.care_documents WHERE id = _doc2;
  IF _count <> 2 THEN RAISE EXCEPTION 'FAIL: the resubmitted assessment is not version two (%)', _count; END IF;

  -- 7. Acceptance is idempotent: one plan draft, one prepare_plan, one package.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin, 'role', 'authenticated')::text, true);
  SELECT public.care_assessment_accept(_visit) INTO _json;
  _plan := (_json ->> 'care_plan_id')::uuid;
  PERFORM public.care_assessment_accept(_visit);
  PERFORM public.care_assessment_accept(_visit);
  IF _plan IS NULL THEN RAISE EXCEPTION 'FAIL: acceptance did not open a care plan'; END IF;
  SELECT count(*) INTO _count FROM public.care_documents WHERE client_id = _client AND kind = 'care_plan';
  IF _count <> 1 THEN RAISE EXCEPTION 'FAIL: acceptance made % care plans', _count; END IF;
  SELECT count(*) INTO _count FROM public.care_work_items
   WHERE client_id = _client AND kind = 'prepare_plan' AND status IN ('open','blocked');
  IF _count <> 1 THEN RAISE EXCEPTION 'FAIL: plan preparation was raised % times', _count; END IF;
  SELECT count(*) INTO _count FROM public.care_work_items
   WHERE client_id = _client AND kind = 'agree_package' AND status IN ('open','blocked');
  IF _count <> 1 THEN RAISE EXCEPTION 'FAIL: package agreement was raised % times', _count; END IF;
  SELECT count(*) INTO _count FROM public.care_notifications
   WHERE client_id = _client AND kind = 'assessment_accepted';
  IF _count <> 1 THEN RAISE EXCEPTION 'FAIL: acceptance raised % notifications', _count; END IF;

  -- 8. Clinical writes work through the functions.
  SELECT public.care_plan_save_section(_plan, 'medicines', '{"note":"Two medicines, morning only"}'::jsonb) INTO _json;
  IF _json ->> 'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'FAIL: a clinical section save was refused'; END IF;
  IF public.care_plan_item_save(_plan, 'need', NULL, '{"title":"Help with washing"}'::jsonb) IS NULL THEN
    RAISE EXCEPTION 'FAIL: a clinical need could not be recorded';
  END IF;

  -- 9. A coordinator cannot write clinical content by any route.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _plain, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.care_plan_save_section(_plan, 'medicines', '{"note":"coordinator"}'::jsonb);
    RAISE EXCEPTION 'FAIL: a coordinator wrote a care plan section';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.care_plan_item_save(_plan, 'need', NULL, '{"title":"coordinator"}'::jsonb);
    RAISE EXCEPTION 'FAIL: a coordinator added a care plan need';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.care_plan_item_remove(_plan, 'need', gen_random_uuid());
    RAISE EXCEPTION 'FAIL: a coordinator removed care plan content';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.care_plan_new_version(_plan, 'coordinator');
    RAISE EXCEPTION 'FAIL: a coordinator started a new plan version';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;

  -- 10. No administrator writes clinical tables directly.
  SELECT count(*) INTO _count FROM information_schema.role_table_grants
   WHERE grantee = 'authenticated' AND table_schema = 'public'
     AND table_name IN ('care_documents','care_plan_needs','care_plan_goals','care_plan_tasks')
     AND privilege_type NOT IN ('SELECT','REFERENCES','TRIGGER');
  IF _count <> 0 THEN
    RAISE EXCEPTION 'FAIL: signed-in accounts still hold % direct clinical write grants', _count;
  END IF;
  SELECT count(*) INTO _count FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('care_documents','care_plan_needs','care_plan_goals','care_plan_tasks')
     AND cmd <> 'SELECT';
  IF _count <> 0 THEN
    RAISE EXCEPTION 'FAIL: % write policies remain on the clinical tables', _count;
  END IF;

  -- 11. There is no premature issue path.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.care_plan_submit(_plan);
    RAISE EXCEPTION 'FAIL: a care plan was issued before the package and staffing exist';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  SELECT status INTO _text FROM public.care_documents WHERE id = _plan;
  IF _text <> 'draft' THEN RAISE EXCEPTION 'FAIL: the plan left draft (%)', _text; END IF;
  IF public.care_derive_stage(_client) <> 'care_plan_preparation' THEN
    RAISE EXCEPTION 'FAIL: a plan draft advanced the client beyond plan preparation (%)',
      public.care_derive_stage(_client);
  END IF;
  SELECT count(*) INTO _count FROM public.care_work_items
   WHERE client_id = _client AND kind = 'prepare_plan' AND status = 'completed';
  IF _count <> 0 THEN RAISE EXCEPTION 'FAIL: a draft completed plan preparation'; END IF;

  -- 12. The whole sent record is readable without editing it.
  SELECT public.care_assessment_record(_visit) INTO _json;
  IF _json IS NULL OR _json -> 'document' ->> 'id' IS NULL THEN
    RAISE EXCEPTION 'FAIL: the sent assessment record could not be read';
  END IF;

  RAISE EXCEPTION 'care_t7_correction: all checks passed';
END $$;
