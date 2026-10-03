-- Three more controls the pre-assessment engine can draw: a clock time, a
-- grouped list of choices, and one person's details asked together.
--
-- The published-form guard checks every control against a fixed list inside
-- private.care_definition_issues. The rest of that function is unchanged, so
-- the list is extended in place rather than the whole function being restated
-- and risking drift from what is actually running.
DO $$
DECLARE
  _src text;
  _patched text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO _src
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'private' AND p.proname = 'care_definition_issues';

  IF _src IS NULL THEN
    RAISE EXCEPTION 'private.care_definition_issues does not exist';
  END IF;

  IF position('''tag_list''' in _src) > 0 THEN
    RETURN;
  END IF;

  _patched := replace(
    _src,
    '''medicine_choice''];',
    '''medicine_choice'',''time'',''tag_list'',''contact_block''];');

  IF _patched = _src THEN
    RAISE EXCEPTION 'The list of controls could not be found in private.care_definition_issues';
  END IF;

  EXECUTE _patched;
END $$;
