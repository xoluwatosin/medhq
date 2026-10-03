-- Version 6 of the pre-assessment asks a follow-up to be answered by choosing
-- from the medicines already entered. The published-definition check is taught
-- that control here. Nothing else about the check changes.
DO $do$
DECLARE
  _src text;
  _old text := '''appointment_preference'',''care_upload''';
  _new text := '''appointment_preference'',''care_upload'',''medicine_choice''';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO _src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'private' AND p.proname = 'care_definition_issues';

  IF _src IS NULL THEN
    RAISE EXCEPTION 'private.care_definition_issues does not exist';
  END IF;

  IF position('medicine_choice' in _src) > 0 THEN
    RETURN;
  END IF;

  IF position(_old in _src) = 0 THEN
    RAISE EXCEPTION 'The control list could not be found in private.care_definition_issues';
  END IF;

  EXECUTE replace(_src, _old, _new);
END
$do$;
