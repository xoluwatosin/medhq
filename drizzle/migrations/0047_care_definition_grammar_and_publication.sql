-- Pass 2: one condition grammar, governed publication.
-- The browser (src/lib/care.ts, src/lib/care-schema.ts) and the database read a
-- definition the same way: same operators, same module rules, same idea of what
-- counts as an answer. A definition the engine cannot read safely cannot be
-- published at all.

CREATE OR REPLACE FUNCTION private.care_answered(_value jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _value IS NULL THEN false
    WHEN jsonb_typeof(_value) = 'null' THEN false
    WHEN jsonb_typeof(_value) = 'string' THEN btrim(_value #>> '{}') <> ''
    WHEN jsonb_typeof(_value) = 'boolean' THEN (_value #>> '{}') = 'true'
    WHEN jsonb_typeof(_value) = 'array' THEN jsonb_array_length(_value) > 0
    WHEN jsonb_typeof(_value) = 'object' THEN EXISTS (
      SELECT 1 FROM jsonb_each(_value) e WHERE private.care_answered(e.value))
    ELSE true END;
$$;

CREATE OR REPLACE FUNCTION private.care_numeric(_value jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _value IS NULL THEN NULL
    WHEN jsonb_typeof(_value) = 'number' THEN (_value #>> '{}')::numeric
    WHEN jsonb_typeof(_value) = 'string' AND btrim(_value #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN (btrim(_value #>> '{}'))::numeric
    ELSE NULL END;
$$;

CREATE OR REPLACE FUNCTION private.care_value_list(_value jsonb)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _value IS NULL OR jsonb_typeof(_value) = 'null' THEN '{}'::text[]
    WHEN jsonb_typeof(_value) = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(_value))
    WHEN jsonb_typeof(_value) = 'string' AND (_value #>> '{}') = '' THEN '{}'::text[]
    ELSE ARRAY[_value #>> '{}'] END;
$$;

CREATE OR REPLACE FUNCTION private.care_condition_met(_cond jsonb, _responses jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  _value jsonb;
  _list text[];
  _n numeric;
BEGIN
  IF _cond IS NULL OR jsonb_typeof(_cond) <> 'object' THEN RETURN false; END IF;
  _value := COALESCE(_responses -> (_cond ->> 'field'), 'null'::jsonb);

  IF _cond ? 'empty' THEN
    RETURN CASE WHEN (_cond ->> 'empty')::boolean
      THEN NOT private.care_answered(_value) ELSE private.care_answered(_value) END;
  END IF;

  IF _cond ? 'gte' THEN
    _n := private.care_numeric(_value);
    RETURN _n IS NOT NULL AND _n >= (_cond ->> 'gte')::numeric;
  END IF;

  _list := private.care_value_list(_value);

  IF _cond ? 'contains' THEN
    RETURN EXISTS (SELECT 1 FROM jsonb_array_elements_text(_cond -> 'contains') x WHERE x = ANY(_list));
  END IF;
  IF _cond ? 'notIn' THEN
    RETURN array_length(_list, 1) > 0
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(_cond -> 'notIn') x WHERE x = ANY(_list));
  END IF;
  IF _cond ? 'in' THEN
    RETURN EXISTS (SELECT 1 FROM jsonb_array_elements_text(_cond -> 'in') x WHERE x = ANY(_list));
  END IF;

  RETURN private.care_answered(_value);
END;
$$;

CREATE OR REPLACE FUNCTION private.care_modules_for(_definition jsonb, _service text, _responses jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  _rules jsonb := COALESCE(_definition -> 'moduleRules', '{}'::jsonb);
  _key text; _rule jsonb; _cond jsonb; _hit boolean;
  _out text[] := '{}'::text[]; _result jsonb;
BEGIN
  FOR _key, _rule IN SELECT key, value FROM jsonb_each(_rules) LOOP
    _hit := _service IS NOT NULL
            AND jsonb_typeof(_rule -> 'always') = 'array'
            AND (_rule -> 'always') ? _service;
    IF NOT _hit THEN
      FOR _cond IN SELECT value FROM jsonb_array_elements(COALESCE(_rule -> 'whenAny', '[]'::jsonb)) LOOP
        IF private.care_condition_met(_cond, COALESCE(_responses, '{}'::jsonb)) THEN
          _hit := true; EXIT;
        END IF;
      END LOOP;
    END IF;
    IF _hit THEN _out := _out || _key; END IF;
  END LOOP;
  SELECT COALESCE(jsonb_agg(m ORDER BY m), '[]'::jsonb) INTO _result FROM unnest(_out) m;
  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION private.care_resolve_modules(_client_id uuid, _definition jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
DECLARE
  _responses jsonb := '{}'::jsonb;
BEGIN
  SELECT COALESCE(responses, '{}'::jsonb) INTO _responses
    FROM public.care_documents
   WHERE client_id = _client_id AND kind = 'pre_assessment' AND status = 'submitted'
   ORDER BY version DESC NULLS LAST, submitted_at DESC LIMIT 1;
  RETURN private.care_modules_for(_definition, private.care_service_key(_client_id), _responses);
END;
$$;

CREATE OR REPLACE FUNCTION private.care_sections_for(_definition jsonb, _modules jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(jsonb_agg(s ORDER BY ord), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(_definition -> 'sections', '[]'::jsonb)) WITH ORDINALITY t(s, ord)
   WHERE (s ->> 'when') = 'always'
      OR jsonb_typeof(s -> 'when') <> 'object'
      OR NOT (s -> 'when') ? 'module'
      OR COALESCE(_modules, '[]'::jsonb) ? ((s -> 'when') ->> 'module');
$$;

CREATE OR REPLACE FUNCTION private.care_definition_issues(_definition jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  _types text[] := ARRAY['text','textarea','long_text','number','date','phone','choice','multi',
                         'checkbox','upload','confirm','contact','person_name','relationship',
                         'address','lga','language_picker','budget_band','yes_no','measurement',
                         'repeatable','matrix','weekly_pattern'];
  _needs text[] := ARRAY['choice','multi','budget_band','matrix'];
  _targets text[] := ARRAY['clinical_lead','nurse_review','safeguarding','coordinator'];
  _ops text[] := ARRAY['in','notIn','contains','empty','gte'];
  _audience text[] := ARRAY['client','internal','restricted'];
  _issues jsonb := '[]'::jsonb;
  _known text[] := '{}'::text[];
  _seen text[] := '{}'::text[];
  _sections text[] := '{}'::text[];
  _modules text[] := '{}'::text[];
  _section jsonb; _field jsonb; _cond jsonb; _path text; _fpath text;
  _si int := 0; _fi int; _oi int;
  _values text[]; _option jsonb; _key text; _rule jsonb; _m text;
  _opcount int;
BEGIN
  IF _definition IS NULL OR jsonb_typeof(_definition) <> 'object' THEN
    RETURN jsonb_build_array(jsonb_build_object('path','definition','problem','A definition must be an object'));
  END IF;
  IF jsonb_typeof(_definition -> 'sections') <> 'array'
     OR jsonb_array_length(_definition -> 'sections') = 0 THEN
    RETURN jsonb_build_array(jsonb_build_object('path','sections','problem','A definition needs at least one section'));
  END IF;

  SELECT COALESCE(array_agg(fl ->> 'id'), '{}')
    INTO _known
    FROM jsonb_array_elements(_definition -> 'sections') s,
         jsonb_array_elements(COALESCE(s -> 'fields', '[]'::jsonb)) fl
   WHERE fl ? 'id';

  FOR _section IN SELECT value FROM jsonb_array_elements(_definition -> 'sections') LOOP
    _path := format('sections[%s]', _si);
    _si := _si + 1;

    IF COALESCE(_section ->> 'id', '') = '' THEN
      _issues := _issues || jsonb_build_object('path', _path || '.id', 'problem', 'A section needs a stable identifier');
    ELSIF (_section ->> 'id') = ANY(_sections) THEN
      _issues := _issues || jsonb_build_object('path', _path || '.id', 'problem', 'That section identifier is already used');
    ELSE
      _sections := _sections || (_section ->> 'id');
    END IF;

    IF COALESCE(btrim(_section ->> 'title'), '') = '' THEN
      _issues := _issues || jsonb_build_object('path', _path || '.title', 'problem', 'A section needs a title');
    END IF;

    IF (_section ->> 'when') IS DISTINCT FROM 'always' AND jsonb_typeof(_section -> 'when') <> 'object' THEN
      _issues := _issues || jsonb_build_object('path', _path || '.when', 'problem', 'A section applies always, or on a stated condition');
    ELSIF jsonb_typeof(_section -> 'when') = 'object' THEN
      IF (_section -> 'when') ? 'module' THEN _modules := _modules || ((_section -> 'when') ->> 'module'); END IF;
      IF (_section -> 'when') ? 'notWhen' THEN
        _cond := (_section -> 'when') -> 'notWhen';
        IF NOT ((_cond ->> 'field') = ANY(_known)) THEN
          _issues := _issues || jsonb_build_object('path', _path || '.when.notWhen.field', 'problem', 'That question is not in this definition');
        END IF;
      END IF;
    END IF;

    IF jsonb_typeof(_section -> 'fields') <> 'array' THEN
      _issues := _issues || jsonb_build_object('path', _path || '.fields', 'problem', 'A section needs its questions');
      CONTINUE;
    END IF;
    IF jsonb_array_length(_section -> 'fields') = 0 AND COALESCE(_section ->> 'mode','') <> 'confirm_amend' THEN
      _issues := _issues || jsonb_build_object('path', _path || '.fields', 'problem', 'A section needs at least one question');
      CONTINUE;
    END IF;

    _fi := 0;
    FOR _field IN SELECT value FROM jsonb_array_elements(_section -> 'fields') LOOP
      _fpath := format('%s.fields[%s]', _path, _fi);
      _fi := _fi + 1;

      IF COALESCE(_field ->> 'id', '') = '' THEN
        _issues := _issues || jsonb_build_object('path', _fpath || '.id', 'problem', 'A question needs a stable identifier');
      ELSIF (_field ->> 'id') = ANY(_seen) THEN
        _issues := _issues || jsonb_build_object('path', _fpath || '.id', 'problem', 'That question identifier is already used');
      ELSE
        _seen := _seen || (_field ->> 'id');
      END IF;

      IF COALESCE(btrim(_field ->> 'record'), '') = '' THEN
        _issues := _issues || jsonb_build_object('path', _fpath || '.record', 'problem', 'A question needs a name for the record');
      END IF;
      IF COALESCE(btrim(_field ->> 'asked'), '') = '' THEN
        _issues := _issues || jsonb_build_object('path', _fpath || '.asked', 'problem', 'A question needs the words it is asked in');
      END IF;
      IF NOT (COALESCE(_field ->> 'type','') = ANY(_types)) THEN
        _issues := _issues || jsonb_build_object('path', _fpath || '.type', 'problem', 'That is not a control this engine can draw');
      END IF;

      IF (_field ->> 'type') = ANY(_needs)
         AND COALESCE(jsonb_array_length(_field -> 'options'), 0) = 0
         AND NOT (_field ? 'optionsFrom') THEN
        _issues := _issues || jsonb_build_object('path', _fpath || '.options', 'problem', 'This control needs a list to pick from');
      END IF;

      _values := '{}'::text[];
      _oi := 0;
      IF jsonb_typeof(_field -> 'options') = 'array' THEN
        FOR _option IN SELECT value FROM jsonb_array_elements(_field -> 'options') LOOP
          IF COALESCE(_option ->> 'value', '') = '' THEN
            _issues := _issues || jsonb_build_object('path', format('%s.options[%s].value', _fpath, _oi), 'problem', 'An option needs a stored value');
          ELSIF (_option ->> 'value') = ANY(_values) THEN
            _issues := _issues || jsonb_build_object('path', format('%s.options[%s].value', _fpath, _oi), 'problem', 'That option value is repeated');
          ELSE
            _values := _values || (_option ->> 'value');
          END IF;
          IF COALESCE(btrim(_option ->> 'label'), '') = '' THEN
            _issues := _issues || jsonb_build_object('path', format('%s.options[%s].label', _fpath, _oi), 'problem', 'An option needs words to read');
          END IF;
          _oi := _oi + 1;
        END LOOP;
      END IF;

      IF (_field ->> 'type') = 'measurement' THEN
        IF COALESCE(jsonb_array_length(_field -> 'measures'), 0) = 0 THEN
          _issues := _issues || jsonb_build_object('path', _fpath || '.measures', 'problem', 'A measurement needs its measures and their fixed units');
        ELSIF EXISTS (
          SELECT 1 FROM jsonb_array_elements(_field -> 'measures') m
           WHERE COALESCE(m ->> 'key','') = '' OR COALESCE(btrim(m ->> 'label'),'') = ''
              OR COALESCE(btrim(m ->> 'unit'),'') = '')
           OR (SELECT count(DISTINCT m ->> 'key') FROM jsonb_array_elements(_field -> 'measures') m)
              <> jsonb_array_length(_field -> 'measures') THEN
          _issues := _issues || jsonb_build_object('path', _fpath || '.measures', 'problem', 'Each measure needs its own key, a name and a fixed unit');
        END IF;
      END IF;

      IF (_field ->> 'type') = 'repeatable' THEN
        IF COALESCE(jsonb_array_length(_field -> 'items'), 0) = 0 THEN
          _issues := _issues || jsonb_build_object('path', _fpath || '.items', 'problem', 'A repeatable item needs the parts each entry records');
        ELSIF (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(_field -> 'items') x)
              <> jsonb_array_length(_field -> 'items') THEN
          _issues := _issues || jsonb_build_object('path', _fpath || '.items', 'problem', 'Each part of an entry needs its own name');
        END IF;
      END IF;

      IF (_field ->> 'type') = 'matrix' THEN
        IF COALESCE(jsonb_array_length(_field -> 'rows'), 0) = 0 THEN
          _issues := _issues || jsonb_build_object('path', _fpath || '.rows', 'problem', 'A matrix needs its rows');
        ELSIF (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(_field -> 'rows') x)
              <> jsonb_array_length(_field -> 'rows') THEN
          _issues := _issues || jsonb_build_object('path', _fpath || '.rows', 'problem', 'Each row needs its own name');
        END IF;
      END IF;

      IF _field ? 'audience' AND NOT ((_field ->> 'audience') = ANY(_audience)) THEN
        _issues := _issues || jsonb_build_object('path', _fpath || '.audience', 'problem', 'That is not a reading audience');
      END IF;
      IF _field ? 'assessorOnly' AND jsonb_typeof(_field -> 'assessorOnly') <> 'boolean' THEN
        _issues := _issues || jsonb_build_object('path', _fpath || '.assessorOnly', 'problem', 'Assessor-only is yes or no');
      END IF;

      IF _field ? 'routes' THEN
        IF NOT (COALESCE((_field -> 'routes') ->> 'to','') = ANY(_targets)) THEN
          _issues := _issues || jsonb_build_object('path', _fpath || '.routes.to', 'problem', 'An escalation must reach an allowed destination');
        END IF;
        IF (_field -> 'routes') ? 'sameDay'
           AND jsonb_typeof((_field -> 'routes') -> 'sameDay') <> 'boolean' THEN
          _issues := _issues || jsonb_build_object('path', _fpath || '.routes.sameDay', 'problem', 'Same day is yes or no');
        END IF;
        IF array_length(_values, 1) > 0 AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE((_field -> 'routes') -> 'unless', '[]'::jsonb)) u
           WHERE NOT (u = ANY(_values))) THEN
          _issues := _issues || jsonb_build_object('path', _fpath || '.routes.unless', 'problem', 'An exception must be one of this question''s answers');
        END IF;
      END IF;

      IF _field ? 'showWhen' THEN
        _cond := _field -> 'showWhen';
        IF jsonb_typeof(_cond) <> 'object' OR NOT (_cond ? 'field') THEN
          _issues := _issues || jsonb_build_object('path', _fpath || '.showWhen', 'problem', 'A condition names the question it reads');
        ELSE
          IF NOT ((_cond ->> 'field') = ANY(_known)) THEN
            _issues := _issues || jsonb_build_object('path', _fpath || '.showWhen.field', 'problem', 'That question is not in this definition');
          END IF;
          SELECT count(*) INTO _opcount FROM jsonb_object_keys(_cond) k WHERE k <> 'field';
          IF _opcount <> 1 THEN
            _issues := _issues || jsonb_build_object('path', _fpath || '.showWhen', 'problem', 'A condition uses exactly one test');
          END IF;
          IF EXISTS (SELECT 1 FROM jsonb_object_keys(_cond) k WHERE k <> 'field' AND NOT (k = ANY(_ops))) THEN
            _issues := _issues || jsonb_build_object('path', _fpath || '.showWhen', 'problem', 'That test is not one the engine can read');
          END IF;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  FOR _key, _rule IN SELECT key, value FROM jsonb_each(COALESCE(_definition -> 'moduleRules', '{}'::jsonb)) LOOP
    IF NOT (_key = ANY(_modules)) THEN
      _issues := _issues || jsonb_build_object('path', 'moduleRules.' || _key, 'problem', 'No section attaches to this module');
    END IF;
    FOR _cond IN SELECT value FROM jsonb_array_elements(COALESCE(_rule -> 'whenAny', '[]'::jsonb)) LOOP
      IF NOT ((_cond ->> 'field') = ANY(_known)) THEN
        _issues := _issues || jsonb_build_object('path', 'moduleRules.' || _key, 'problem', 'That question is not in this definition');
      END IF;
      IF EXISTS (SELECT 1 FROM jsonb_object_keys(_cond) k WHERE k <> 'field' AND NOT (k = ANY(_ops))) THEN
        _issues := _issues || jsonb_build_object('path', 'moduleRules.' || _key, 'problem', 'That test is not one the engine can read');
      END IF;
    END LOOP;
  END LOOP;

  FOREACH _m IN ARRAY _modules LOOP
    IF NOT (COALESCE(_definition -> 'moduleRules', '{}'::jsonb) ? _m) THEN
      _issues := _issues || jsonb_build_object('path', 'moduleRules.' || _m, 'problem', 'A module used by a section has no rule that opens it');
    END IF;
  END LOOP;

  RETURN _issues;
END;
$$;

CREATE OR REPLACE FUNCTION private.care_definition_publish_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE _issues jsonb;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'published'
     AND OLD.definition IS NOT DISTINCT FROM NEW.definition THEN
    RETURN NEW;
  END IF;
  _issues := private.care_definition_issues(NEW.definition);
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