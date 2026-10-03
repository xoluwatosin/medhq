-- A staff correction is checked against the same published questions the
-- family answered. The screen is not the guard: the database is.

CREATE OR REPLACE FUNCTION private.care_check_answer(_field jsonb, _value jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public, private
AS $$
DECLARE
  _type text := _field->>'type';
  _opts text[];
  _txt text;
  _list text[];
  _state text;
  _area text;
  _state_code text;
BEGIN
  IF _value IS NULL OR jsonb_typeof(_value) = 'null' THEN RETURN NULL; END IF;

  SELECT coalesce(array_agg(o->>'value'), '{}')
    INTO _opts
    FROM jsonb_array_elements(coalesce(_field->'options', '[]'::jsonb)) o;

  IF _type = 'choice' THEN
    IF jsonb_typeof(_value) <> 'string' OR NOT ((_value #>> '{}') = ANY(_opts)) THEN
      RETURN 'That answer is not one of the choices';
    END IF;

  ELSIF _type = 'budget_band' THEN
    IF jsonb_typeof(_value) <> 'string' THEN RETURN 'That is not a band we hold'; END IF;
    _txt := _value #>> '{}';
    IF NOT (_txt = ANY(_opts))
       AND NOT EXISTS (SELECT 1 FROM public.budget_bands b WHERE b.id::text = _txt) THEN
      RETURN 'That is not a band we hold';
    END IF;

  ELSIF _type = 'multi' THEN
    IF jsonb_typeof(_value) <> 'array' THEN RETURN 'That answer is not a list of choices'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(_value) v WHERE NOT (v = ANY(_opts))) THEN
      RETURN 'One of those is not a choice we offer';
    END IF;

  ELSIF _type = 'checkbox' THEN
    IF jsonb_typeof(_value) <> 'boolean' THEN RETURN 'That answer should be a tick'; END IF;

  ELSIF _type = 'number' THEN
    IF jsonb_typeof(_value) = 'number' THEN
      NULL;
    ELSIF jsonb_typeof(_value) = 'string' AND (_value #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN
      NULL;
    ELSE
      RETURN 'That should be a number';
    END IF;

  ELSIF _type = 'date' THEN
    IF jsonb_typeof(_value) <> 'string' OR (_value #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN
      RETURN 'That is not a date';
    END IF;
    BEGIN
      PERFORM (left(_value #>> '{}', 10))::date;
    EXCEPTION WHEN others THEN
      RETURN 'That is not a date';
    END;

  ELSIF _type = 'language_picker' THEN
    IF jsonb_typeof(_value) = 'string' THEN
      SELECT coalesce(array_agg(btrim(x)), '{}')
        INTO _list
        FROM unnest(string_to_array(_value #>> '{}', ',')) x
       WHERE btrim(x) <> '';
    ELSIF jsonb_typeof(_value) = 'array' THEN
      SELECT coalesce(array_agg(btrim(v)), '{}')
        INTO _list
        FROM jsonb_array_elements_text(_value) v
       WHERE btrim(v) <> '';
    ELSE
      RETURN 'That is not a language we hold';
    END IF;
    IF coalesce(array_length(_list, 1), 0) = 0 THEN RETURN 'That is not a language we hold'; END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(_list) l
       WHERE NOT EXISTS (
         SELECT 1 FROM public.care_languages cl
          WHERE lower(cl.label) = lower(l) AND cl.is_active
       )
    ) THEN
      RETURN 'That is not a language we hold';
    END IF;

  ELSIF _type = 'relationship' THEN
    IF jsonb_typeof(_value) <> 'object' THEN RETURN 'Choose a relationship'; END IF;
    _txt := btrim(coalesce(_value->>'value', ''));
    IF _txt = '' THEN RETURN 'Choose a relationship'; END IF;
    IF lower(_txt) = 'other' THEN
      IF btrim(coalesce(_value->>'other', '')) = '' THEN RETURN 'Say how they are related'; END IF;
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.care_relationship_terms r WHERE lower(r.label) = lower(_txt)
    ) THEN
      RETURN 'That is not a relationship we hold';
    END IF;

  ELSIF _type = 'lga' THEN
    IF jsonb_typeof(_value) <> 'object' THEN RETURN 'Choose a state'; END IF;
    _state := btrim(coalesce(_value->>'state', ''));
    _area := btrim(coalesce(_value->>'lga', ''));
    IF _state = '' THEN RETURN 'Choose a state'; END IF;
    SELECT s.code INTO _state_code FROM public.care_states s WHERE lower(s.label) = lower(_state);
    IF _state_code IS NULL THEN RETURN 'That is not a Nigerian state we hold'; END IF;
    IF _area <> '' AND NOT EXISTS (
      SELECT 1 FROM public.care_lgas g
       WHERE g.state_code = _state_code AND lower(g.label) = lower(_area)
    ) THEN
      RETURN 'That area is not in the chosen state';
    END IF;

  ELSIF _type = 'person_name' THEN
    IF jsonb_typeof(_value) <> 'object' THEN RETURN 'That name is not in a shape we can read'; END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_each(_value) e WHERE jsonb_typeof(e.value) NOT IN ('string', 'null')
    ) THEN
      RETURN 'That name is not in a shape we can read';
    END IF;

  ELSIF _type = 'confirm' THEN
    IF jsonb_typeof(_value) <> 'object'
       OR jsonb_typeof(coalesce(_value->'confirmed', 'null'::jsonb)) <> 'boolean' THEN
      RETURN 'That confirmation is not in a shape we can read';
    END IF;
    IF _value ? 'value' AND jsonb_typeof(_value->'value') NOT IN ('string', 'null') THEN
      RETURN 'That confirmation is not in a shape we can read';
    END IF;

  ELSIF _type IN ('text', 'long_text', 'address', 'phone') THEN
    IF jsonb_typeof(_value) <> 'string' THEN RETURN 'That answer should be text'; END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_amend_section(
  _document_id uuid,
  _section_id text,
  _changes jsonb,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _doc public.care_documents%ROWTYPE;
  _definition jsonb;
  _section jsonb;
  _field jsonb;
  _session uuid := gen_random_uuid();
  _key text;
  _value jsonb;
  _current jsonb;
  _problem text;
  _written integer := 0;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to correct an answer';
  END IF;
  IF COALESCE(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'Give a reason for the correction';
  END IF;

  SELECT * INTO _doc FROM public.care_documents WHERE id = _document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That form is not on the record'; END IF;

  SELECT d.definition INTO _definition
    FROM public.form_definitions d
   WHERE d.id = _doc.form_definition_id;
  IF _definition IS NULL THEN RAISE EXCEPTION 'The questions behind this form are not on the record'; END IF;

  SELECT s INTO _section
    FROM jsonb_array_elements(coalesce(_definition->'sections', '[]'::jsonb)) s
   WHERE s->>'id' = _section_id
   LIMIT 1;
  IF _section IS NULL THEN RAISE EXCEPTION 'That part of the form is not on the record'; END IF;

  FOR _key, _value IN SELECT * FROM jsonb_each(COALESCE(_changes, '{}'::jsonb)) LOOP
    SELECT f INTO _field
      FROM jsonb_array_elements(coalesce(_section->'fields', '[]'::jsonb)) f
     WHERE f->>'id' = _key
     LIMIT 1;

    IF _field IS NULL THEN
      IF EXISTS (
        SELECT 1
          FROM jsonb_array_elements(coalesce(_definition->'sections', '[]'::jsonb)) s,
               jsonb_array_elements(coalesce(s->'fields', '[]'::jsonb)) f
         WHERE f->>'id' = _key
      ) THEN
        RAISE EXCEPTION 'That question is not in that part of the form';
      ELSE
        RAISE EXCEPTION 'That question is not in this form';
      END IF;
    END IF;

    -- What the record says today: the latest correction if there is one,
    -- otherwise what the family submitted. The correction is checked as the
    -- value the record would then hold.
    SELECT a.corrected_value INTO _current
      FROM public.care_response_amendments a
     WHERE a.document_id = _document_id AND a.field_id = _key
     ORDER BY a.created_at DESC
     LIMIT 1;
    IF _current IS NULL THEN _current := COALESCE(_doc.responses -> _key, 'null'::jsonb); END IF;

    CONTINUE WHEN _current = _value;

    _problem := private.care_check_answer(_field, _value);
    IF _problem IS NOT NULL THEN RAISE EXCEPTION '%', _problem; END IF;

    INSERT INTO public.care_response_amendments
      (document_id, client_id, field_id, section_id, session_id,
       original_value, corrected_value, reason, amended_by, amended_by_name)
    VALUES
      (_document_id, _doc.client_id, _key, _section_id, _session,
       _current, _value, btrim(_reason), auth.uid(),
       (SELECT email FROM auth.users WHERE id = auth.uid()));
    _written := _written + 1;
  END LOOP;

  IF _written > 0 THEN
    INSERT INTO public.care_activity (client_id, action, detail, actor_id, actor_name)
    VALUES (_doc.client_id, 'responses_amended',
            jsonb_build_object('section', _section_id, 'fields', _written, 'session', _session),
            auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()));
  END IF;

  RETURN jsonb_build_object('ok', true, 'session_id', _session, 'written', _written);
END;
$$;

REVOKE ALL ON FUNCTION public.care_amend_section(uuid, text, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_amend_section(uuid, text, jsonb, text) TO authenticated, service_role;