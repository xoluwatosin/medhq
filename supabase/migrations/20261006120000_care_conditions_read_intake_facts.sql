-- Pre-assessment version 11 asks only what the intake has not already settled.
-- Its conditions read five facts the page and the server build from the intake
-- (intakeRoutingAnswers in src/lib/care-intake.ts and
-- supabase/functions/_shared/care-form.ts), alongside the derived_ facts.
-- The publish guard must know them, or it refuses the form as naming
-- questions that are not in it. Nothing else about the check changes.

CREATE OR REPLACE FUNCTION private.care_definition_condition_issues(_definition jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  _known text[];
  _issues jsonb := '[]'::jsonb;
  _section jsonb; _field jsonb; _cond jsonb; _key text; _rule jsonb;
  _si int := 0; _fi int;
  _path text; _fpath text;
BEGIN
  IF _definition IS NULL OR jsonb_typeof(_definition -> 'sections') <> 'array' THEN
    RETURN _issues;
  END IF;

  SELECT COALESCE(array_agg(fl ->> 'id'), '{}')
    INTO _known
    FROM jsonb_array_elements(_definition -> 'sections') s,
         jsonb_array_elements(COALESCE(s -> 'fields', '[]'::jsonb)) fl
   WHERE fl ? 'id';

  _known := _known || ARRAY['derived_is_self','derived_age_years','derived_age_band',
                            'derived_recipient_group','derived_service','derived_is_parent',
                            'derived_service_conflict',
                            'intake_relationship','intake_filler_parent','intake_first_recipient',
                            'intake_sole_self','intake_newborn_dob'];

  FOR _section IN SELECT value FROM jsonb_array_elements(_definition -> 'sections') LOOP
    _path := format('sections[%s]', _si);
    _si := _si + 1;

    IF jsonb_typeof(_section -> 'when') = 'object' THEN
      IF (_section -> 'when') ? 'notWhen' THEN
        _issues := _issues || private.care_condition_issues(
          (_section -> 'when') -> 'notWhen', _known, _path || '.when.notWhen');
      END IF;
      IF (_section -> 'when') ? 'condition' THEN
        _issues := _issues || private.care_condition_issues(
          (_section -> 'when') -> 'condition', _known, _path || '.when.condition');
      END IF;
    END IF;

    _fi := 0;
    FOR _field IN SELECT value FROM jsonb_array_elements(COALESCE(_section -> 'fields', '[]'::jsonb)) LOOP
      _fpath := format('%s.fields[%s]', _path, _fi);
      _fi := _fi + 1;
      IF _field ? 'showWhen' THEN
        _issues := _issues || private.care_condition_issues(_field -> 'showWhen', _known, _fpath || '.showWhen');
      END IF;
      IF COALESCE(_field ->> 'id', '') LIKE 'derived%' THEN
        _issues := _issues || jsonb_build_object(
          'path', _fpath || '.id', 'problem', 'derived_ is reserved for the facts the engine derives');
      END IF;
      IF COALESCE(_field ->> 'id', '') LIKE 'intake\_%' THEN
        _issues := _issues || jsonb_build_object(
          'path', _fpath || '.id', 'problem', 'intake_ is reserved for the facts the intake settles');
      END IF;
    END LOOP;
  END LOOP;

  FOR _key, _rule IN SELECT key, value FROM jsonb_each(COALESCE(_definition -> 'moduleRules', '{}'::jsonb)) LOOP
    FOR _cond IN SELECT value FROM jsonb_array_elements(COALESCE(_rule -> 'whenAny', '[]'::jsonb)) LOOP
      _issues := _issues || private.care_condition_issues(_cond, _known, 'moduleRules.' || _key);
    END LOOP;
  END LOOP;

  RETURN _issues;
END;
$function$;
