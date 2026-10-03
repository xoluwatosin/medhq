-- Regression cover for the assessment lifecycle.
--
-- Run the whole file as one statement against the database with a role that
-- may write (the Cloud SQL editor, or the database tooling).
--
-- The block always ends by raising, so every synthetic client, person,
-- document and capability it made is rolled back. A run that ends with
--   care_assessment_lifecycle: all checks passed
-- is a pass. Any other message is a failure, and says which rule broke.

DO $$
DECLARE
  _admin uuid;
  _one uuid;           -- first assessor person
  _two uuid;           -- second assessor person, for the handover
  _one_auth uuid;
  _two_auth uuid;
  _client uuid;
  _definition uuid;
  _pre uuid;
  _pre_later uuid;
  _visit uuid;
  _doc uuid;
  _doc2 uuid;
  _work uuid;
  _count integer;
  _text text;
  _stage text;
  _due timestamptz;
  _due2 timestamptz;
  _appt timestamptz;
  _now timestamptz;
  _conduct uuid;
  _conduct2 uuid;
  _client2 uuid;
  _pre2 uuid;
  _visit2 uuid;
  _spare uuid;

BEGIN
  SELECT user_id INTO _admin FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  SELECT id, auth_user_id INTO _one, _one_auth FROM public.mu_people
   WHERE auth_user_id IS NOT NULL ORDER BY id LIMIT 1;
  SELECT id, auth_user_id INTO _two, _two_auth FROM public.mu_people
   WHERE auth_user_id IS NOT NULL AND id <> _one ORDER BY id LIMIT 1;
  SELECT id INTO _definition FROM public.form_definitions
   WHERE kind = 'pre_assessment' AND status = 'published' ORDER BY version DESC LIMIT 1;

  UPDATE public.mu_people SET staff_status = 'active', is_staff = true WHERE id IN (_one, _two);

  -- Workforce membership itself is the gate: an active candidate with a
  -- sign-in but no workforce record cannot hold the capability.
  UPDATE public.mu_people SET is_staff = false WHERE id = _two;
  BEGIN
    PERFORM public.care_assessor_capability_set(_two, true, 'Regression run');
    RAISE EXCEPTION 'FAIL: a non-workforce person was made a Clinical Assessor';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
  IF public.care_assessor_eligible(_two) THEN
    RAISE EXCEPTION 'FAIL: a non-workforce person counts as an eligible assessor';
  END IF;
  UPDATE public.mu_people SET is_staff = true WHERE id = _two;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin, 'role', 'authenticated')::text, true);

  -- Capability is granted from the workforce record, and is what makes
  -- somebody assignable.
  PERFORM public.care_assessor_capability_set(_one, true, 'Regression run');
  PERFORM public.care_assessor_capability_set(_two, true, 'Regression run');
  IF NOT public.care_assessor_eligible(_one) THEN
    RAISE EXCEPTION 'FAIL: an active assessor with an account is not eligible';
  END IF;

  INSERT INTO public.clients (full_name, stage, state_code)
  VALUES ('Regression Test Client', 'enquiry', 'lagos') RETURNING id INTO _client;

  INSERT INTO public.care_documents (client_id, kind, form_definition_id, status, responses, submitted_at)
  VALUES (_client, 'pre_assessment', _definition, 'submitted',
          jsonb_build_object('who_for', 'someone_else', 'first_name', 'Ada'), now())
  RETURNING id INTO _pre;

  /* 1. Booking is administration. No clinical document is created. */
  _visit := public.care_assessment_schedule(_client, now() + interval '3 days', NULL, 'home', 'Gate code 44');
  SELECT document_id, source_document_id INTO _doc, _pre_later
    FROM public.care_assessment_work WHERE id = _visit;
  IF _doc IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: booking a visit created a clinical document';
  END IF;
  IF _pre_later IS DISTINCT FROM _pre THEN
    RAISE EXCEPTION 'FAIL: the visit did not lock on to the returned pre-assessment';
  END IF;

  /* 1b. A visit more than a day away is due exactly a day before it. */
  SELECT appointment_at INTO _appt FROM public.care_assessment_work WHERE id = _visit;
  SELECT id, due_at INTO _conduct, _due FROM public.care_work_items
   WHERE client_id = _client AND kind = 'conduct' AND status IN ('open','blocked');
  IF _conduct IS NULL THEN RAISE EXCEPTION 'FAIL: booking raised no visit task'; END IF;
  IF abs(extract(epoch FROM (_due - (_appt - interval '24 hours')))) > 2 THEN
    RAISE EXCEPTION 'FAIL: the visit is due % and not a day before %', _due, _appt;
  END IF;

  /* 2. A later pre-assessment never replaces the evidence already carried. */

  INSERT INTO public.care_documents (client_id, kind, form_definition_id, status, responses, submitted_at)
  VALUES (_client, 'pre_assessment', _definition, 'submitted',
          jsonb_build_object('who_for', 'myself'), now() + interval '1 minute');
  PERFORM public.care_assessment_reschedule(_visit, now() + interval '4 days', NULL,
    'The family asked for a later day', 'clinic', 'Ask for the daughter');
  SELECT source_document_id INTO _pre_later
    FROM public.care_assessment_work WHERE id = _visit;
  IF _pre_later IS DISTINCT FROM _pre THEN
    RAISE EXCEPTION 'FAIL: a newer pre-assessment replaced the locked source';
  END IF;
  SELECT location_kind INTO _text FROM public.care_assessment_work WHERE id = _visit;
  IF _text <> 'clinic' THEN RAISE EXCEPTION 'FAIL: moving the visit lost the place'; END IF;
  SELECT notes INTO _text FROM public.care_assessment_work WHERE id = _visit;
  IF _text <> 'Ask for the daughter' THEN
    RAISE EXCEPTION 'FAIL: moving the visit lost the notes for the assessor';
  END IF;

  /* 3. The visit is due a day before it happens, on the same task. */
  SELECT id, due_at INTO _conduct2, _due2 FROM public.care_work_items
   WHERE client_id = _client AND kind = 'conduct' AND status IN ('open','blocked');
  IF (SELECT count(*) FROM public.care_work_items
       WHERE client_id = _client AND kind = 'conduct' AND status IN ('open','blocked')) <> 1 THEN
    RAISE EXCEPTION 'FAIL: moving the visit raised a second visit task';
  END IF;
  IF _conduct2 IS DISTINCT FROM _conduct THEN
    RAISE EXCEPTION 'FAIL: moving the visit replaced the task instead of updating it';
  END IF;
  SELECT appointment_at INTO _appt FROM public.care_assessment_work WHERE id = _visit;
  IF abs(extract(epoch FROM (_due2 - (_appt - interval '24 hours')))) > 2 THEN
    RAISE EXCEPTION 'FAIL: after moving, the visit is due % and not a day before %', _due2, _appt;
  END IF;
  IF _due2 <= _due THEN
    RAISE EXCEPTION 'FAIL: a later appointment did not move the due time later';
  END IF;

  /* 3b. A visit inside the next day is due straight away, not in the past. */
  INSERT INTO public.clients (full_name, stage, state_code)
  VALUES ('Regression Short Notice Client', 'enquiry', 'lagos') RETURNING id INTO _client2;
  INSERT INTO public.care_documents (client_id, kind, form_definition_id, status, responses, submitted_at)
  VALUES (_client2, 'pre_assessment', _definition, 'submitted',
          jsonb_build_object('who_for', 'myself'), now())
  RETURNING id INTO _pre2;
  _now := clock_timestamp();
  _visit2 := public.care_assessment_schedule(_client2, now() + interval '3 hours', NULL, 'home', NULL);
  SELECT due_at INTO _due FROM public.care_work_items
   WHERE client_id = _client2 AND kind = 'conduct' AND status IN ('open','blocked');
  IF _due < _now - interval '2 seconds' THEN
    RAISE EXCEPTION 'FAIL: a short-notice visit was made due in the past (%)', _due;
  END IF;
  IF _due > clock_timestamp() + interval '1 minute' THEN
    RAISE EXCEPTION 'FAIL: a short-notice visit is not due straight away (%)', _due;
  END IF;


  /* 4. Only an eligible assessor can be assigned. */
  BEGIN
    PERFORM public.care_assessment_assign(_visit, gen_random_uuid(), NULL);
    RAISE EXCEPTION 'FAIL: an unknown person was assigned';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
  PERFORM public.care_assessment_assign(_visit, _one, NULL);
  SELECT document_id INTO _doc FROM public.care_assessment_work WHERE id = _visit;
  IF _doc IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: assigning an assessor created a clinical document';
  END IF;

  /* 5. Domain-managed work cannot be ticked off by hand. */
  SELECT id INTO _work FROM public.care_work_items
   WHERE client_id = _client AND kind = 'conduct' AND status IN ('open','blocked') LIMIT 1;
  BEGIN
    PERFORM public.care_work_complete(_work, 'done');
    RAISE EXCEPTION 'FAIL: the visit task was completed by hand';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.care_work_cancel(_work, 'because');
    RAISE EXCEPTION 'FAIL: the visit task was cancelled by hand';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;

  /* 6. Opening the visit creates exactly one framework-backed draft. */
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _one_auth, 'role', 'authenticated')::text, true);
  _doc := public.care_assessment_start(_visit);
  _doc2 := public.care_assessment_start(_visit);
  IF _doc IS NULL OR _doc <> _doc2 THEN
    RAISE EXCEPTION 'FAIL: opening the visit twice made two documents';
  END IF;
  SELECT count(*) INTO _count FROM public.care_documents
   WHERE client_id = _client AND kind = 'assessment';
  IF _count <> 1 THEN RAISE EXCEPTION 'FAIL: % assessment documents exist', _count; END IF;
  SELECT form_definition_id INTO _pre_later FROM public.care_documents WHERE id = _doc;
  IF _pre_later IS NULL THEN RAISE EXCEPTION 'FAIL: the document has no framework'; END IF;

  /* 7. The database decides what may be captured. */
  BEGIN
    PERFORM public.care_assessment_capture(_visit, jsonb_build_array(
      jsonb_build_object('client_event_id', 'x1', 'field_id', 'diagnosis', 'value', to_jsonb('anything'::text))));
    RAISE EXCEPTION 'FAIL: an invented field was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.care_assessment_capture(_visit, jsonb_build_array(
      jsonb_build_object('client_event_id', 'x2', 'field_id', 'confirm.never_asked',
                         'value', jsonb_build_object('decision', 'confirmed'))));
    RAISE EXCEPTION 'FAIL: a decision about an unanswered question was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.care_assessment_capture(_visit, jsonb_build_array(
      jsonb_build_object('client_event_id', 'x3', 'field_id', 'confirm.who_for',
                         'value', jsonb_build_object('decision', 'amended', 'value', 'a made up option'))));
    RAISE EXCEPTION 'FAIL: a controlled answer was amended to something off the list';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;

  /* 8. Real captures, replayed, settle to one record in written order. */
  PERFORM public.care_assessment_capture(_visit, jsonb_build_array(
    jsonb_build_object('client_event_id', 'e2', 'field_id', 'note.core_a',
                       'value', to_jsonb('Second thought'::text),
                       'client_seq', 2, 'captured_at', (now() - interval '5 minutes')::text),
    jsonb_build_object('client_event_id', 'e1', 'field_id', 'note.core_a',
                       'value', to_jsonb('First thought'::text),
                       'client_seq', 1, 'captured_at', now()::text),
    jsonb_build_object('client_event_id', 'e3', 'field_id', 'confirm.who_for',
                       'value', jsonb_build_object('decision', 'amended', 'value', 'myself'),
                       'client_seq', 3, 'captured_at', now()::text)));
  PERFORM public.care_assessment_capture(_visit, jsonb_build_array(
    jsonb_build_object('client_event_id', 'e1', 'field_id', 'note.core_a',
                       'value', to_jsonb('First thought'::text), 'client_seq', 1)));
  SELECT count(*) INTO _count FROM public.care_assessment_capture_events WHERE assessment_id = _visit;
  IF _count <> 3 THEN RAISE EXCEPTION 'FAIL: a replay wrote % events instead of 3', _count; END IF;
  SELECT responses ->> 'note.core_a' INTO _text FROM public.care_documents WHERE id = _doc;
  IF _text <> 'Second thought' THEN
    RAISE EXCEPTION 'FAIL: events replayed out of order, the note reads "%"', _text;
  END IF;

  /* 9. A handover keeps the first assessor's name on what they wrote. */
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.care_assessment_assign(_visit, _two, NULL);
    RAISE EXCEPTION 'FAIL: an opened assessment was handed over with no reason';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
  PERFORM public.care_assessment_assign(_visit, _two, 'First assessor taken ill');
  SELECT authored_by_person_id INTO _pre_later FROM public.care_documents WHERE id = _doc;
  IF _pre_later IS DISTINCT FROM _one THEN
    RAISE EXCEPTION 'FAIL: a handover rewrote who wrote the assessment';
  END IF;
  SELECT count(*) INTO _count FROM public.care_assessment_capture_events
   WHERE assessment_id = _visit AND author_person_id = _one;
  IF _count <> 3 THEN RAISE EXCEPTION 'FAIL: a handover rewrote who captured the answers'; END IF;

  /* 10. Cancelling after the visit was opened keeps the writing and clears
        the live clinical fact. */
  PERFORM public.care_assessment_cancel(_visit, 'The family postponed');
  SELECT status INTO _text FROM public.care_documents WHERE id = _doc;
  IF _text <> 'abandoned' THEN
    RAISE EXCEPTION 'FAIL: a cancelled visit left its draft live, status is "%"', _text;
  END IF;
  SELECT responses ->> 'note.core_a' INTO _text FROM public.care_documents WHERE id = _doc;
  IF _text <> 'Second thought' THEN RAISE EXCEPTION 'FAIL: cancelling destroyed the writing'; END IF;
  _stage := public.care_derive_stage(_client);
  IF _stage <> 'pre_assessment_received' THEN
    RAISE EXCEPTION 'FAIL: after cancelling, the client sits at "%"', _stage;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.care_work_items
                  WHERE client_id = _client AND kind = 'book' AND status IN ('open','blocked')) THEN
    RAISE EXCEPTION 'FAIL: cancelling did not ask anyone to rearrange the visit';
  END IF;

  /* 11. A fresh visit, carried through to clinical review. */
  _visit := public.care_assessment_schedule(_client, now() + interval '2 days', NULL, 'home', NULL);
  PERFORM public.care_assessment_assign(_visit, _one, NULL);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _one_auth, 'role', 'authenticated')::text, true);
  _doc := public.care_assessment_start(_visit);
  PERFORM public.care_assessment_capture(_visit, jsonb_build_array(
    jsonb_build_object('client_event_id', 'f1', 'field_id', 'note.core_a',
                       'value', to_jsonb('All as described'::text), 'client_seq', 1)));
  PERFORM public.care_assessment_submit(_visit);
  PERFORM public.care_assessment_submit(_visit);
  SELECT count(*) INTO _count FROM public.care_work_items
   WHERE client_id = _client AND kind = 'clinical_review' AND status IN ('open','blocked');
  IF _count <> 1 THEN
    RAISE EXCEPTION 'FAIL: sending the assessment raised % review tasks', _count;
  END IF;
  _stage := public.care_derive_stage(_client);
  IF _stage <> 'clinical_review' THEN
    RAISE EXCEPTION 'FAIL: a sent assessment left the client at "%"', _stage;
  END IF;

  /* 12. Who may hold the Clinical Assessor capability, and when it may go. */
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin, 'role', 'authenticated')::text, true);

  INSERT INTO public.mu_people (full_name, staff_status)
  VALUES ('Regression Ineligible Person', 'none') RETURNING id INTO _spare;
  BEGIN
    PERFORM public.care_assessor_capability_set(_spare, true, 'Regression run');
    RAISE EXCEPTION 'FAIL: somebody off the workforce was made a Clinical Assessor';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
  UPDATE public.mu_people SET staff_status = 'active', is_staff = true WHERE id = _spare;
  BEGIN
    PERFORM public.care_assessor_capability_set(_spare, true, 'Regression run');
    RAISE EXCEPTION 'FAIL: somebody with no sign-in was made a Clinical Assessor';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
  IF public.care_assessor_eligible(_spare) THEN
    RAISE EXCEPTION 'FAIL: an unreachable person counts as an eligible assessor';
  END IF;

  /* A visit still to happen holds the capability in place. */
  PERFORM public.care_assessment_assign(_visit2, _one, NULL);
  BEGIN
    PERFORM public.care_assessor_capability_set(_one, false, 'Regression run');
    RAISE EXCEPTION 'FAIL: an assessor with a scheduled visit was stood down';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;

  /* Once the visit is somebody else's, standing them down is safe. */
  PERFORM public.care_assessment_assign(_visit2, _two, NULL);
  PERFORM public.care_assessor_capability_set(_one, false, 'Regression run');
  IF public.care_assessor_eligible(_one) THEN
    RAISE EXCEPTION 'FAIL: a stood-down assessor is still assignable';
  END IF;
  IF EXISTS (SELECT 1 FROM public.care_assessor_options() o WHERE o.person_id = _one) THEN
    RAISE EXCEPTION 'FAIL: a stood-down assessor is still offered for visits';
  END IF;
  SELECT authored_by_person_id INTO _spare FROM public.care_documents WHERE id = _doc;
  IF _spare IS DISTINCT FROM _one THEN
    RAISE EXCEPTION 'FAIL: standing an assessor down rewrote what they had written';
  END IF;

  /* An opened visit holds it in place too. */
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _two_auth, 'role', 'authenticated')::text, true);
  PERFORM public.care_assessment_start(_visit2);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin, 'role', 'authenticated')::text, true);
  IF public.care_assessor_live_assessments(_two) <> 1 THEN
    RAISE EXCEPTION 'FAIL: an opened visit is not counted against the assessor';
  END IF;
  BEGIN
    PERFORM public.care_assessor_capability_set(_two, false, 'Regression run');
    RAISE EXCEPTION 'FAIL: an assessor part way through a visit was stood down';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;

  RAISE EXCEPTION 'care_assessment_lifecycle: all checks passed';

END $$;
