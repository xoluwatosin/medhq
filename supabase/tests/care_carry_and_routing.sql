-- Rollback-safe checks for carried evidence and confirmed-service routing.
-- Run with: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/care_carry_and_routing.sql
BEGIN;

DO $$
DECLARE
  _def uuid; _client uuid; _doc uuid; _evidence jsonb; _service text; _bad boolean := false;
BEGIN
  -- A definition may only classify a carry in the five recorded ways.
  IF jsonb_array_length(private.care_definition_carry_issues(
       '{"sections":[{"id":"s","fields":[{"id":"q","carry":"whatever"}]}]}'::jsonb)) <> 1 THEN
    RAISE EXCEPTION 'FAIL: an unknown carry classification was accepted';
  END IF;
  IF jsonb_array_length(private.care_definition_carry_issues(
       '{"sections":[{"id":"s","fields":[{"id":"q","carry":"clinical_evidence"}]}]}'::jsonb)) <> 0 THEN
    RAISE EXCEPTION 'FAIL: a valid carry classification was rejected';
  END IF;

  INSERT INTO public.form_definitions (kind, version, status, definition)
  VALUES ('pre_assessment', 9001, 'draft', jsonb_build_object(
    'sections', jsonb_build_array(jsonb_build_object(
      'id', 'sec', 'title', 'Test', 'when', 'always', 'fields', jsonb_build_array(
        jsonb_build_object('id','clin_a','type','text','carry','clinical_evidence'),
        jsonb_build_object('id','clin_b','type','text','carry','clinical_evidence'),
        jsonb_build_object('id','ops_a','type','text','carry','operational'))))))
  RETURNING id INTO _def;

  INSERT INTO public.clients (full_name, stage) VALUES ('Synthetic carry test', 'enquiry')
  RETURNING id INTO _client;

  INSERT INTO public.care_documents (client_id, kind, form_definition_id, status, responses)
  VALUES (_client, 'pre_assessment', _def, 'draft',
          jsonb_build_object('clin_a','yes','ops_a','yes','derived_service','home_care'))
  RETURNING id INTO _doc;

  -- Nothing is frozen while the family is still filling the form in.
  SELECT active_evidence IS NULL INTO _bad FROM public.care_documents WHERE id = _doc;
  IF NOT _bad THEN RAISE EXCEPTION 'FAIL: evidence was frozen before the form was sent'; END IF;

  -- Sending the form freezes exactly what the engine works out here.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgrelid = 'public.care_documents'::regclass
                    AND tgname = 'care_freeze_active_evidence' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'FAIL: sent forms do not freeze their carried evidence';
  END IF;

  _evidence := private.care_active_evidence_of(_client, _def,
    (SELECT responses FROM public.care_documents WHERE id = _doc));
  IF NOT (_evidence @> '["clin_a"]'::jsonb) THEN
    RAISE EXCEPTION 'FAIL: answered clinical evidence was not carried';
  END IF;
  IF _evidence @> '["clin_b"]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: an unanswered question was carried as evidence';
  END IF;
  IF _evidence @> '["ops_a"]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: an operational answer was carried as clinical evidence';
  END IF;

  -- The route follows the service confirmed on the sent form, not the enquiry.
  INSERT INTO public.care_documents (client_id, kind, form_definition_id, status, responses, submitted_at)
  VALUES (_client, 'pre_assessment', _def, 'submitted',
          jsonb_build_object('clin_a','yes','derived_service','night_care'), now());
  _service := private.care_confirmed_service(_client);
  IF _service <> 'night_care' THEN
    RAISE EXCEPTION 'FAIL: routing did not follow the confirmed service, got %', COALESCE(_service,'nothing');
  END IF;

  RAISE NOTICE 'PASS: carry classification, frozen evidence and confirmed-service routing';
END $$;

ROLLBACK;
