-- One condition grammar, composed, and the derived routing facts.
--
-- A pre-assessment routes on who the care is for, how old they are and what is
-- being asked for. Those facts are worked out from the answers, in the browser
-- (src/lib/care.ts) and here, the same way. A condition may now join other
-- conditions with allOf, anyOf and not, and where a condition writes several
-- tests every one of them has to hold: nothing decides on the first key it
-- happens to find.

CREATE OR REPLACE FUNCTION private.care_condition_met(_cond jsonb, _responses jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  _value jsonb;
  _list text[];
  _n numeric;
  _inner jsonb;
  _tested boolean := false;
BEGIN
  IF _cond IS NULL OR jsonb_typeof(_cond) <> 'object' THEN RETURN false; END IF;

  IF _cond ? 'allOf' THEN
    FOR _inner IN SELECT value FROM jsonb_array_elements(_cond -> 'allOf') LOOP
      IF NOT private.care_condition_met(_inner, _responses) THEN RETURN false; END IF;
    END LOOP;
  END IF;

  IF _cond ? 'anyOf' THEN
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_cond -> 'anyOf') a
       WHERE private.care_condition_met(a.value, _responses)
    ) THEN RETURN false; END IF;
  END IF;

  IF _cond ? 'not' THEN
    IF private.care_condition_met(_cond -> 'not', _responses) THEN RETURN false; END IF;
  END IF;

  IF NOT (_cond ? 'field') THEN
    RETURN (_cond ? 'allOf') OR (_cond ? 'anyOf') OR (_cond ? 'not');
  END IF;

  _value := COALESCE(_responses -> (_cond ->> 'field'), 'null'::jsonb);
  _list := private.care_value_list(_value);

  IF _cond ? 'empty' THEN
    _tested := true;
    IF (_cond ->> 'empty')::boolean THEN
      IF private.care_answered(_value) THEN RETURN false; END IF;
    ELSE
      IF NOT private.care_answered(_value) THEN RETURN false; END IF;
    END IF;
  END IF;

  IF _cond ? 'gte' THEN
    _tested := true;
    _n := private.care_numeric(_value);
    IF _n IS NULL OR _n < (_cond ->> 'gte')::numeric THEN RETURN false; END IF;
  END IF;

  IF _cond ? 'lt' THEN
    _tested := true;
    _n := private.care_numeric(_value);
    IF _n IS NULL OR _n >= (_cond ->> 'lt')::numeric THEN RETURN false; END IF;
  END IF;

  IF _cond ? 'contains' THEN
    _tested := true;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(_cond -> 'contains') x WHERE x = ANY(_list))
    THEN RETURN false; END IF;
  END IF;

  IF _cond ? 'notIn' THEN
    _tested := true;
    IF COALESCE(array_length(_list, 1), 0) = 0
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(_cond -> 'notIn') x WHERE x = ANY(_list))
    THEN RETURN false; END IF;
  END IF;

  IF _cond ? 'in' THEN
    _tested := true;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(_cond -> 'in') x WHERE x = ANY(_list))
    THEN RETURN false; END IF;
  END IF;

  IF _tested THEN RETURN true; END IF;
  RETURN private.care_answered(_value);
END;
$$;

-- The facts a definition routes on, from the answers alone. The service held on
-- the enquiry is only a starting point: a disagreement is raised, never
-- silently resolved.
CREATE OR REPLACE FUNCTION private.care_derived_facts(
  _responses jsonb, _recorded_service text DEFAULT NULL, _now timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  _self boolean;
  _dob date;
  _days int;
  _years int;
  _approx numeric;
  _band text;
  _answered text;
  _service text;
  _group text;
  _settled boolean;
  _conflict boolean;
BEGIN
  _responses := COALESCE(_responses, '{}'::jsonb);
  _self := COALESCE(_responses ->> 'who_for', '') = 'myself';
  BEGIN
    _dob := NULLIF(left(COALESCE(_responses ->> 'date_of_birth', ''), 10), '')::date;
  EXCEPTION WHEN others THEN _dob := NULL;
  END;

  IF _dob IS NOT NULL AND _dob <= (_now AT TIME ZONE 'UTC')::date THEN
    _days := ((_now AT TIME ZONE 'UTC')::date - _dob);
    _years := extract(year from age((_now AT TIME ZONE 'UTC')::date, _dob))::int;
  ELSE
    _approx := private.care_numeric(_responses -> 'approx_age');
    IF COALESCE(_responses ->> 'dob_known', '') = 'no'
       AND _approx IS NOT NULL AND _approx >= 0 AND _approx <= 120 THEN
      _years := floor(_approx)::int;
    ELSE
      _years := NULL;
    END IF;
    _days := NULL;
  END IF;

  _band := CASE
    WHEN _years IS NULL THEN 'unknown'
    WHEN _days IS NOT NULL AND _days < 28 THEN 'newborn'
    WHEN _years < 2 THEN 'infant'
    WHEN _years < 18 THEN 'child'
    WHEN _years < 65 THEN 'adult'
    ELSE 'older_person' END;

  _answered := COALESCE(NULLIF(_responses ->> 'service_confirmed', ''),
                        NULLIF(_responses ->> 'service_requested', ''));
  _service := COALESCE(_answered, NULLIF(_recorded_service, ''), '');

  _group := CASE
    WHEN _service IN ('antenatal','postnatal') AND _band NOT IN ('newborn','infant') THEN 'maternal'
    WHEN _band IN ('newborn','infant') THEN 'baby'
    WHEN _band = 'child' THEN 'child'
    WHEN _band = 'older_person' THEN 'older_person'
    WHEN _band = 'adult' THEN 'adult'
    ELSE 'unknown' END;

  _settled := COALESCE(_responses ->> 'service_confirmed', '') <> '';
  _conflict := (NOT _settled
                AND COALESCE(_recorded_service, '') <> ''
                AND COALESCE(_answered, '') <> ''
                AND _recorded_service <> _answered)
            OR (_self AND _band IN ('newborn','infant','child'))
            OR (_service IN ('nanny','additional_needs') AND _years IS NOT NULL AND _years >= 18)
            OR (_service IN ('antenatal','postnatal') AND _band IN ('child','newborn','infant'));

  RETURN jsonb_build_object(
    'derived_is_self', CASE WHEN _self THEN 'yes' ELSE 'no' END,
    'derived_age_years', CASE WHEN _years IS NULL THEN 'null'::jsonb ELSE to_jsonb(_years) END,
    'derived_age_band', _band,
    'derived_recipient_group', _group,
    'derived_service', COALESCE(NULLIF(_service, ''), 'unknown'),
    'derived_is_parent', CASE WHEN COALESCE(_responses ->> 'is_parent_guardian','') = 'yes' THEN 'yes' ELSE 'no' END,
    'derived_service_conflict', CASE WHEN _conflict THEN 'yes' ELSE 'no' END);
END;
$$;

-- The answers as conditions read them. Nothing derived is ever stored.
CREATE OR REPLACE FUNCTION private.care_with_derived(
  _responses jsonb, _recorded_service text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(_responses, '{}'::jsonb)
      || private.care_derived_facts(COALESCE(_responses, '{}'::jsonb), _recorded_service);
$$;

-- One condition, checked before publication. Composed conditions are read all
-- the way down, and a condition may name a derived routing fact.
CREATE OR REPLACE FUNCTION private.care_condition_issues(_cond jsonb, _known text[], _path text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  _ops text[] := ARRAY['in','notIn','contains','empty','gte','lt'];
  _issues jsonb := '[]'::jsonb;
  _inner jsonb;
  _i int;
  _composed boolean;
  _tests int;
BEGIN
  IF _cond IS NULL OR jsonb_typeof(_cond) <> 'object' THEN
    RETURN jsonb_build_array(jsonb_build_object(
      'path', _path, 'problem', 'A condition names the question it reads'));
  END IF;

  IF _cond ? 'allOf' THEN
    IF jsonb_typeof(_cond -> 'allOf') <> 'array' OR jsonb_array_length(_cond -> 'allOf') = 0 THEN
      _issues := _issues || jsonb_build_object('path', _path || '.allOf', 'problem', 'allOf holds the conditions it joins');
    ELSE
      _i := 0;
      FOR _inner IN SELECT value FROM jsonb_array_elements(_cond -> 'allOf') LOOP
        _issues := _issues || private.care_condition_issues(_inner, _known, format('%s.allOf[%s]', _path, _i));
        _i := _i + 1;
      END LOOP;
    END IF;
  END IF;

  IF _cond ? 'anyOf' THEN
    IF jsonb_typeof(_cond -> 'anyOf') <> 'array' OR jsonb_array_length(_cond -> 'anyOf') = 0 THEN
      _issues := _issues || jsonb_build_object('path', _path || '.anyOf', 'problem', 'anyOf holds the conditions it joins');
    ELSE
      _i := 0;
      FOR _inner IN SELECT value FROM jsonb_array_elements(_cond -> 'anyOf') LOOP
        _issues := _issues || private.care_condition_issues(_inner, _known, format('%s.anyOf[%s]', _path, _i));
        _i := _i + 1;
      END LOOP;
    END IF;
  END IF;

  IF _cond ? 'not' THEN
    _issues := _issues || private.care_condition_issues(_cond -> 'not', _known, _path || '.not');
  END IF;

  _composed := (_cond ? 'allOf') OR (_cond ? 'anyOf') OR (_cond ? 'not');
  SELECT count(*) INTO _tests FROM jsonb_object_keys(_cond) k
   WHERE k NOT IN ('field','allOf','anyOf','not');

  IF NOT (_cond ? 'field') THEN
    IF NOT _composed THEN
      _issues := _issues || jsonb_build_object('path', _path, 'problem', 'A condition names the question it reads');
    END IF;
    IF _tests > 0 THEN
      _issues := _issues || jsonb_build_object('path', _path, 'problem', 'A test needs the question it reads');
    END IF;
    RETURN _issues;
  END IF;

  IF NOT ((_cond ->> 'field') = ANY(_known)) THEN
    _issues := _issues || jsonb_build_object('path', _path || '.field', 'problem', 'That question is not in this definition');
  END IF;
  IF _tests = 0 THEN
    _issues := _issues || jsonb_build_object('path', _path, 'problem', 'A condition applies at least one test');
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(_cond) k
              WHERE k NOT IN ('field','allOf','anyOf','not') AND NOT (k = ANY(_ops))) THEN
    _issues := _issues || jsonb_build_object('path', _path, 'problem', 'That test is not one the engine can read');
  END IF;

  RETURN _issues;
END;
$$;

-- Every condition a definition holds, wherever it is written.
CREATE OR REPLACE FUNCTION private.care_definition_condition_issues(_definition jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
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
                            'derived_service_conflict'];

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
    END LOOP;
  END LOOP;

  FOR _key, _rule IN SELECT key, value FROM jsonb_each(COALESCE(_definition -> 'moduleRules', '{}'::jsonb)) LOOP
    FOR _cond IN SELECT value FROM jsonb_array_elements(COALESCE(_rule -> 'whenAny', '[]'::jsonb)) LOOP
      _issues := _issues || private.care_condition_issues(_cond, _known, 'moduleRules.' || _key);
    END LOOP;
  END LOOP;

  RETURN _issues;
END;
$$;

-- Publication reads the whole definition. Everything the older check said still
-- holds, except its reading of conditions, which only knew the single-test
-- grammar: those findings are replaced by the composed reading above.
CREATE OR REPLACE FUNCTION private.care_definition_publish_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
DECLARE
  _condition_problems text[] := ARRAY[
    'A condition names the question it reads',
    'That question is not in this definition',
    'A condition uses exactly one test',
    'That test is not one the engine can read'];
  _issues jsonb;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'published'
     AND OLD.definition IS DISTINCT FROM NEW.definition THEN
    RAISE EXCEPTION 'A published form cannot be edited. Publish a new version instead.';
  END IF;

  SELECT COALESCE(jsonb_agg(i), '[]'::jsonb) INTO _issues
    FROM jsonb_array_elements(private.care_definition_issues(NEW.definition)) i
   WHERE NOT ((i ->> 'problem') = ANY(_condition_problems));

  _issues := _issues || private.care_definition_condition_issues(NEW.definition);

  IF jsonb_array_length(_issues) > 0 THEN
    RAISE EXCEPTION 'This form cannot be published: % (%)',
      (_issues -> 0) ->> 'problem', (_issues -> 0) ->> 'path';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS care_definition_publish_guard ON public.form_definitions;
CREATE TRIGGER care_definition_publish_guard
BEFORE INSERT OR UPDATE ON public.form_definitions
FOR EACH ROW EXECUTE FUNCTION private.care_definition_publish_guard();