-- Version 5 asks conditions, medicines, allergies, hospitals, professionals,
-- documents and visit times with their own controls instead of free text. The
-- published-definition check is taught those controls here, by extending the
-- list of controls the engine can draw in the live function. Nothing else about
-- the check changes.
DO $do$
DECLARE
  _src text;
  _old text := '''repeatable'',''matrix'',''weekly_pattern''';
  _new text := '''repeatable'',''matrix'',''weekly_pattern'',''condition_list'',''medicine_list'',''allergy_list'',''hospital'',''professional'',''appointment_preference'',''care_upload''';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO _src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'private' AND p.proname = 'care_definition_issues';

  IF _src IS NULL THEN
    RAISE EXCEPTION 'private.care_definition_issues does not exist';
  END IF;

  IF position(_old in _src) = 0 THEN
    IF position('condition_list' in _src) > 0 THEN
      RETURN; -- already taught these controls
    END IF;
    RAISE EXCEPTION 'The control list could not be found in private.care_definition_issues';
  END IF;

  EXECUTE replace(_src, _old, _new);
END
$do$;
