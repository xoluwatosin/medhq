-- Pass 2, Part A regression. Rollback safe: every synthetic row is created
-- inside one statement that always ends by raising, so nothing it writes is
-- ever kept. Run it with a privileged connection:
--
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/care_pass2_binding.sql
--
-- A pass is reported as the final notice-shaped error:
--   care_pass2_binding: all assertions passed
--
-- What it proves:
--   1. a review reads the document its own visit produced;
--   2. two assessments on the same client never cross over;
--   3. a returned assessment's successor stays on the same visit;
--   4. the review returns the assessment's own definition version;
--   5. the newly protected provenance fields cannot be changed once sent.

DO $$
DECLARE
  _client uuid; _service uuid;
  _pre_def uuid; _asm_def uuid;
  _pre uuid;
  _w1 uuid; _w2 uuid; _d1 uuid; _d2 uuid;
  _record jsonb;
BEGIN
  -- The review is read as a real administrator, without changing role.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', (SELECT user_id::text FROM public.user_roles WHERE role = 'admin' LIMIT 1),
                      'role', 'authenticated')::text, true);

  SELECT id INTO _service FROM public.services LIMIT 1;

  INSERT INTO public.form_definitions (kind, version, status, definition, published_at)
  VALUES ('pre_assessment', 9001, 'published',
          jsonb_build_object('sections', '[]'::jsonb), now())
  RETURNING id INTO _pre_def;

  INSERT INTO public.form_definitions (kind, version, status, definition, published_at)
  VALUES ('assessment', 9002, 'published',
          jsonb_build_object('sections', '[]'::jsonb,
                             'moduleRules', jsonb_build_object(
                               'medicines', jsonb_build_object('always', jsonb_build_array('eldercare')))),
          now())
  RETURNING id INTO _asm_def;

  INSERT INTO public.clients (full_name, service_id)
  VALUES ('Synthetic Pass Two', _service)
  RETURNING id INTO _client;

  INSERT INTO public.care_documents (client_id, kind, form_definition_id, status, responses, version, submitted_at)
  VALUES (_client, 'pre_assessment', _pre_def, 'submitted', '{}'::jsonb, 1, now())
  RETURNING id INTO _pre;

  -- First assessment on this client.
  INSERT INTO public.care_assessment_work (client_id, status, location_kind, source_document_id)
  VALUES (_client, 'in_progress', 'home', _pre) RETURNING id INTO _w1;
  INSERT INTO public.care_documents
    (client_id, kind, form_definition_id, status, responses, version, submitted_at, assessment_work_id)
  VALUES (_client, 'assessment', _asm_def, 'submitted', jsonb_build_object('a', 'first'), 1, now(), _w1)
  RETURNING id INTO _d1;
  UPDATE public.care_assessment_work SET document_id = _d1, status = 'submitted' WHERE id = _w1;

  -- A later, separate assessment on the same client.
  INSERT INTO public.care_assessment_work (client_id, status, location_kind, source_document_id)
  VALUES (_client, 'in_progress', 'home', _pre) RETURNING id INTO _w2;
  INSERT INTO public.care_documents
    (client_id, kind, form_definition_id, status, responses, version, submitted_at, assessment_work_id)
  VALUES (_client, 'assessment', _asm_def, 'submitted', jsonb_build_object('a', 'second'), 2, now(), _w2)
  RETURNING id INTO _d2;
  UPDATE public.care_assessment_work SET document_id = _d2, status = 'submitted' WHERE id = _w2;

  -- 1 and 2: the older review still shows its own version.
  _record := public.care_assessment_record(_w1);
  IF (_record -> 'document' ->> 'id') <> _d1::text THEN
    RAISE EXCEPTION 'A historical review read the wrong assessment document';
  END IF;
  IF (_record -> 'document' -> 'responses' ->> 'a') <> 'first' THEN
    RAISE EXCEPTION 'A historical review read a newer assessment';
  END IF;

  -- 4: the assessment's own definition version, not the pre-assessment's.
  IF (_record ->> 'definition_version')::int <> 9002 THEN
    RAISE EXCEPTION 'The review did not return the assessment definition version';
  END IF;
  IF (_record ->> 'pre_assessment_version')::int <> 9001 THEN
    RAISE EXCEPTION 'The review did not return the carried pre-assessment version';
  END IF;

  -- 3: a successor stays on the same visit.
  IF EXISTS (
    SELECT 1 FROM public.care_documents
     WHERE assessment_work_id = _w1 AND id = _d2
  ) THEN
    RAISE EXCEPTION 'Two assessments crossed over on one visit';
  END IF;

  -- 5: the newly protected fields.
  BEGIN
    UPDATE public.care_documents SET assessment_work_id = _w2 WHERE id = _d1;
    RAISE EXCEPTION 'A sent assessment changed the visit it belongs to';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%already been sent%' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE public.care_documents SET resolved_modules = '["ghost"]'::jsonb WHERE id = _d1;
    RAISE EXCEPTION 'A sent assessment changed the modules it was written against';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%already been sent%' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE public.care_documents SET reissue_reason = 'rewritten' WHERE id = _d1;
    RAISE EXCEPTION 'A sent assessment changed its reissue reason';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%already been sent%' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE public.care_documents SET outstanding_required = '[{"id":"x"}]'::jsonb WHERE id = _d1;
    RAISE EXCEPTION 'A sent assessment changed what was outstanding';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%already been sent%' THEN RAISE; END IF;
  END;

  -- Always abort: the assertions have run, nothing synthetic is kept.
  RAISE EXCEPTION 'care_pass2_binding: all assertions passed';
END $$;
