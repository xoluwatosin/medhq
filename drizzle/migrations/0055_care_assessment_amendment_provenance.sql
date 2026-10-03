-- Amending a family answer is a clinical act, so it is recorded like one.
--
-- An amendment now has to carry a reason, and the server stamps the rest:
-- what it replaces, which record that answer came from, who amended it and
-- when. The family's own answer is never changed by any of this.
CREATE OR REPLACE FUNCTION public.care_assessment_capture(_id uuid, _events jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _doc public.care_documents%ROWTYPE;
  _event jsonb;
  _accepted text[] := ARRAY[]::text[];
  _responses jsonb; _rows integer;
  _src_answers jsonb; _src_def jsonb;
  _definition jsonb; _sections jsonb;
  _field text; _key text; _value jsonb; _decision text; _fielddef jsonb; _problem text;
  _at timestamptz;
BEGIN
  IF NOT public.care_is_assigned_assessor(_id) THEN
    RAISE EXCEPTION 'Only the assigned assessor can record this assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id;
  IF _w.status = 'submitted' THEN RAISE EXCEPTION 'This assessment has already been sent'; END IF;
  IF _w.status = 'cancelled' THEN RAISE EXCEPTION 'That visit has been cancelled'; END IF;
  IF _w.document_id IS NULL THEN RAISE EXCEPTION 'This assessment has not been opened yet'; END IF;
  IF jsonb_typeof(_events) <> 'array' THEN RAISE EXCEPTION 'Nothing to record'; END IF;

  SELECT d.responses, f.definition INTO _src_answers, _src_def
    FROM public.care_documents d
    JOIN public.form_definitions f ON f.id = d.form_definition_id
   WHERE d.id = _w.source_document_id;
  IF _src_def IS NULL THEN
    RAISE EXCEPTION 'This assessment is not linked to a returned pre-assessment';
  END IF;

  SELECT * INTO _doc FROM public.care_documents WHERE id = _w.document_id FOR UPDATE;
  IF _doc.status <> 'draft' THEN RAISE EXCEPTION 'This assessment can no longer be changed'; END IF;
  _responses := COALESCE(_doc.responses, '{}'::jsonb);

  SELECT definition INTO _definition FROM public.form_definitions WHERE id = _doc.form_definition_id;
  _sections := private.care_sections_for(COALESCE(_definition, '{}'::jsonb),
                                         COALESCE(_doc.resolved_modules, '[]'::jsonb));

  FOR _event IN
    SELECT e FROM jsonb_array_elements(_events) e
     ORDER BY COALESCE((e ->> 'client_seq')::bigint, 0),
              COALESCE((e ->> 'captured_at')::timestamptz, now())
  LOOP
    _field := COALESCE(_event ->> 'field_id', '');
    _value := _event -> 'value';
    _at := COALESCE((_event ->> 'captured_at')::timestamptz, now());
    IF COALESCE(_event ->> 'client_event_id', '') = '' OR _field = '' THEN
      RAISE EXCEPTION 'That answer could not be recorded';
    END IF;

    IF _field LIKE 'confirm.%' THEN
      _key := substr(_field, 9);
      SELECT fl INTO _fielddef
        FROM jsonb_array_elements(_src_def -> 'sections') s,
             jsonb_array_elements(COALESCE(s -> 'fields','[]'::jsonb)) fl
       WHERE fl ->> 'id' = _key LIMIT 1;
      IF _fielddef IS NULL OR NOT private.care_answered(_src_answers -> _key) THEN
        RAISE EXCEPTION 'That answer is not part of this assessment';
      END IF;
      IF jsonb_typeof(_value) <> 'object' THEN RAISE EXCEPTION 'That answer could not be recorded'; END IF;
      _decision := _value ->> 'decision';
      IF _decision NOT IN ('confirmed','amended') THEN
        RAISE EXCEPTION 'That answer could not be recorded';
      END IF;
      IF _decision = 'amended' THEN
        IF NOT private.care_answered(_value -> 'value') THEN
          RAISE EXCEPTION 'Record what is different';
        END IF;
        IF COALESCE(btrim(_value ->> 'reason'), '') = '' THEN
          RAISE EXCEPTION 'Record why this answer is being amended';
        END IF;
        IF length(_value ->> 'reason') > 4000 THEN
          RAISE EXCEPTION 'That reason is too long';
        END IF;
        _problem := private.care_answer_problem(_fielddef, _value -> 'value');
        IF _problem IS NOT NULL THEN RAISE EXCEPTION '%', _problem; END IF;
        -- Provenance is the server's to write, never the device's.
        _value := (_value - 'at' - 'by' - 'replaces' - 'source_document_id')
                  || jsonb_build_object(
                       'at', to_jsonb(_at),
                       'by', to_jsonb(_w.assessor_person_id),
                       'replaces', COALESCE(_src_answers -> _key, 'null'::jsonb),
                       'source_document_id', to_jsonb(_w.source_document_id));
      ELSE
        _value := (_value - 'at' - 'by' - 'replaces' - 'source_document_id')
                  || jsonb_build_object(
                       'at', to_jsonb(_at),
                       'by', to_jsonb(_w.assessor_person_id),
                       'source_document_id', to_jsonb(_w.source_document_id));
      END IF;

    ELSIF _field LIKE 'note.%' THEN
      _key := substr(_field, 6);
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_src_def -> 'sections') s WHERE s ->> 'id' = _key)
         AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_sections) s WHERE s ->> 'id' = _key) THEN
        RAISE EXCEPTION 'That part of the visit is not part of this assessment';
      END IF;
      IF _value IS NOT NULL AND jsonb_typeof(_value) NOT IN ('string','null') THEN
        RAISE EXCEPTION 'That answer could not be recorded';
      END IF;
      IF jsonb_typeof(_value) = 'string' AND length(_value #>> '{}') > 20000 THEN
        RAISE EXCEPTION 'That account is too long';
      END IF;

    ELSE
      SELECT fl INTO _fielddef
        FROM jsonb_array_elements(_sections) s,
             jsonb_array_elements(COALESCE(s -> 'fields','[]'::jsonb)) fl
       WHERE fl ->> 'id' = _field LIMIT 1;
      IF _fielddef IS NULL THEN
        RAISE EXCEPTION 'That answer is not part of this assessment';
      END IF;
      _problem := private.care_answer_problem(_fielddef, _value);
      IF _problem IS NOT NULL THEN RAISE EXCEPTION '%', _problem; END IF;
    END IF;

    INSERT INTO public.care_assessment_capture_events
      (assessment_id, client_event_id, field_id, value, captured_at, author_person_id, client_seq)
    VALUES (_id, _event ->> 'client_event_id', _field, _value, _at,
            _w.assessor_person_id, NULLIF(_event ->> 'client_seq', '')::bigint)
    ON CONFLICT (assessment_id, client_event_id) DO NOTHING;
    GET DIAGNOSTICS _rows = ROW_COUNT;
    IF _rows > 0 THEN
      _responses := _responses || jsonb_build_object(_field, _value);
    END IF;
    _accepted := _accepted || (_event ->> 'client_event_id');
  END LOOP;

  UPDATE public.care_documents SET responses = _responses, updated_at = now() WHERE id = _doc.id;
  UPDATE public.care_assessment_work SET updated_at = now() WHERE id = _id;
  RETURN jsonb_build_object('ok', true, 'accepted', to_jsonb(_accepted), 'document_id', _doc.id);
END;
$function$;