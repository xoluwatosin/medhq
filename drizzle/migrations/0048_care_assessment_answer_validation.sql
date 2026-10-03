-- Pass 2, part two: the server validates every answer against the exact
-- definition and frozen modules the document was written with, blocks an
-- incomplete submission, and raises only allowlisted escalations.

-- Budget bands are read from the bands held in the system, so that control
-- carries no list of its own. Care plans are structural documents, not
-- questionnaires, so the questionnaire contract is applied to questionnaires.
CREATE OR REPLACE FUNCTION private.care_definition_publish_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE _issues jsonb;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  IF NEW.kind NOT IN ('pre_assessment', 'assessment') THEN RETURN NEW; END IF;
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

CREATE OR REPLACE FUNCTION private.care_answer_problem(_field jsonb, _value jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  _type text := COALESCE(_field ->> 'type', 'text');
  _values text[];
  _entry jsonb;
BEGIN
  IF _value IS NULL OR jsonb_typeof(_value) = 'null' THEN RETURN NULL; END IF;

  SELECT COALESCE(array_agg(o ->> 'value'), '{}')
    INTO _values FROM jsonb_array_elements(COALESCE(_field -> 'options', '[]'::jsonb)) o;

  IF _type = 'yes_no' THEN
    IF jsonb_typeof(_value) <> 'string' OR NOT ((_value #>> '{}') IN ('yes','no')) THEN
      RETURN 'Answer yes or no';
    END IF;

  ELSIF _type IN ('choice','budget_band') THEN
    IF jsonb_typeof(_value) <> 'string' THEN RETURN 'Choose one of the recorded options'; END IF;
    IF array_length(_values, 1) > 0 AND NOT ((_value #>> '{}') = ANY(_values)) THEN
      RETURN 'Choose one of the recorded options';
    END IF;

  ELSIF _type = 'multi' THEN
    IF jsonb_typeof(_value) <> 'array' THEN RETURN 'Choose from the recorded options'; END IF;
    IF array_length(_values, 1) > 0 AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(_value) x WHERE NOT (x = ANY(_values))) THEN
      RETURN 'Choose from the recorded options';
    END IF;

  ELSIF _type = 'number' THEN
    IF private.care_numeric(_value) IS NULL THEN RETURN 'Record a number'; END IF;

  ELSIF _type = 'date' THEN
    IF jsonb_typeof(_value) <> 'string' OR (_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}' THEN
      RETURN 'Record a date';
    END IF;

  ELSIF _type = 'checkbox' THEN
    IF jsonb_typeof(_value) <> 'boolean' THEN RETURN 'That answer could not be recorded'; END IF;

  ELSIF _type = 'measurement' THEN
    IF jsonb_typeof(_value) <> 'object' THEN RETURN 'Record each measurement with its unit'; END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_each(_value) e
       WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(_field -> 'measures','[]'::jsonb)) m
                          WHERE m ->> 'key' = e.key)) THEN
      RETURN 'That measurement is not part of this question';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_each(_value) e
       WHERE jsonb_typeof(e.value) <> 'null' AND private.care_numeric(e.value) IS NULL) THEN
      RETURN 'A measurement is recorded as a number';
    END IF;

  ELSIF _type = 'repeatable' THEN
    IF jsonb_typeof(_value) <> 'array' THEN RETURN 'Record each entry separately'; END IF;
    FOR _entry IN SELECT value FROM jsonb_array_elements(_value) LOOP
      IF jsonb_typeof(_entry) <> 'object' THEN RETURN 'Record each entry separately'; END IF;
      IF EXISTS (
        SELECT 1 FROM jsonb_each(_entry) e
         WHERE e.key <> '__id'
           AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(_field -> 'items','[]'::jsonb)) i
                            WHERE i = e.key)) THEN
        RETURN 'That part is not one this entry records';
      END IF;
      IF COALESCE(_entry ->> '__id', '') = '' THEN RETURN 'Each entry needs its own reference'; END IF;
    END LOOP;
    IF (SELECT count(DISTINCT e ->> '__id') FROM jsonb_array_elements(_value) e)
       <> jsonb_array_length(_value) THEN
      RETURN 'Each entry needs its own reference';
    END IF;

  ELSIF _type = 'matrix' THEN
    IF jsonb_typeof(_value) <> 'object' THEN RETURN 'Record a level for each activity'; END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_each(_value) e
       WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(_field -> 'rows','[]'::jsonb)) r
                          WHERE r = e.key)) THEN
      RETURN 'That activity is not part of this question';
    END IF;
    IF array_length(_values, 1) > 0 AND EXISTS (
      SELECT 1 FROM jsonb_each_text(_value) e WHERE NOT (e.value = ANY(_values))) THEN
      RETURN 'Choose one of the recorded levels';
    END IF;

  ELSIF _type = 'weekly_pattern' THEN
    IF jsonb_typeof(_value) <> 'object' THEN RETURN 'Record the pattern day by day'; END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_each(_value) e
       WHERE e.key NOT IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')
          OR jsonb_typeof(e.value) <> 'array') THEN
      RETURN 'Record the pattern day by day';
    END IF;
    IF array_length(_values, 1) > 0 AND EXISTS (
      SELECT 1 FROM jsonb_each(_value) e, jsonb_array_elements_text(e.value) x
       WHERE NOT (x = ANY(_values))) THEN
      RETURN 'Choose from the recorded times';
    END IF;

  ELSIF _type IN ('text','textarea','long_text','phone','relationship','lga') THEN
    IF jsonb_typeof(_value) <> 'string' THEN RETURN 'That answer could not be recorded'; END IF;
    IF length(_value #>> '{}') > 20000 THEN RETURN 'That answer is too long'; END IF;

  ELSIF jsonb_typeof(_value) = 'string' AND length(_value #>> '{}') > 20000 THEN
    RETURN 'That answer is too long';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_assessment_brief(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _client public.clients%ROWTYPE;
  _pre jsonb; _pre_def jsonb; _pre_version integer;
  _doc public.care_documents%ROWTYPE;
  _definition jsonb; _version integer;
BEGIN
  IF NOT public.care_is_assigned_assessor(_id) THEN
    RAISE EXCEPTION 'Not your assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id;
  SELECT * INTO _client FROM public.clients WHERE id = _w.client_id;

  SELECT d.responses, f.definition, f.version INTO _pre, _pre_def, _pre_version
    FROM public.care_documents d
    JOIN public.form_definitions f ON f.id = d.form_definition_id
   WHERE d.id = _w.source_document_id;

  SELECT * INTO _doc FROM public.care_documents WHERE id = _w.document_id;
  IF _doc.id IS NOT NULL THEN
    SELECT definition, version INTO _definition, _version
      FROM public.form_definitions WHERE id = _doc.form_definition_id;
  END IF;

  RETURN jsonb_build_object(
    'assessment', to_jsonb(_w),
    'source_document_id', _w.source_document_id,
    'document_id', _w.document_id,
    'client', jsonb_build_object(
      'id', _client.id,
      'reference', _client.enquiry_number,
      'name', _client.full_name,
      'stage', _client.stage,
      'state_code', _client.state_code,
      'lga_code', _client.lga_code,
      'address_line', _client.address_line
    ),
    'pre_assessment', COALESCE(_pre, '{}'::jsonb),
    'pre_assessment_definition', COALESCE(_pre_def, '{}'::jsonb),
    'pre_assessment_version', _pre_version,
    'definition', COALESCE(_definition, '{}'::jsonb),
    'definition_version', _version,
    'resolved_modules', COALESCE(_doc.resolved_modules, '[]'::jsonb),
    'responses', COALESCE(_doc.responses, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.care_assessment_capture(_id uuid, _events jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _doc public.care_documents%ROWTYPE;
  _event jsonb;
  _accepted text[] := ARRAY[]::text[];
  _responses jsonb; _rows integer;
  _src_answers jsonb; _src_def jsonb;
  _definition jsonb; _sections jsonb;
  _field text; _key text; _value jsonb; _decision text; _fielddef jsonb; _problem text;
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
        _problem := private.care_answer_problem(_fielddef, _value -> 'value');
        IF _problem IS NOT NULL THEN RAISE EXCEPTION '%', _problem; END IF;
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
    VALUES (_id, _event ->> 'client_event_id', _field, _value,
            COALESCE((_event ->> 'captured_at')::timestamptz, now()),
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
$$;

CREATE UNIQUE INDEX IF NOT EXISTS care_flags_document_kind_idx
  ON public.care_flags (document_id, kind, COALESCE(detail, ''))
  WHERE document_id IS NOT NULL;

-- A form names a destination. The server decides what that means, from an
-- explicit allowlist. Form configuration never carries code.
CREATE OR REPLACE FUNCTION private.care_assessment_escalate(_doc public.care_documents, _definition jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
DECLARE
  _sections jsonb := private.care_sections_for(COALESCE(_definition,'{}'::jsonb),
                                               COALESCE(_doc.resolved_modules,'[]'::jsonb));
  _field jsonb; _value jsonb; _to text; _kind text; _severity text; _made integer := 0; _rows integer;
BEGIN
  FOR _field IN
    SELECT fl FROM jsonb_array_elements(_sections) s,
                    jsonb_array_elements(COALESCE(s -> 'fields','[]'::jsonb)) fl
     WHERE fl ? 'routes'
  LOOP
    _value := COALESCE(_doc.responses, '{}'::jsonb) -> (_field ->> 'id');
    CONTINUE WHEN NOT private.care_answered(_value);
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(COALESCE((_field -> 'routes') -> 'unless','[]'::jsonb)) u
       WHERE u = ANY(private.care_value_list(_value)));

    _to := (_field -> 'routes') ->> 'to';
    CONTINUE WHEN _to IS NULL OR _to NOT IN ('clinical_lead','nurse_review','safeguarding','coordinator');
    _kind := CASE WHEN _to = 'safeguarding' THEN 'safeguarding' ELSE 'clinical_review' END;
    _severity := CASE WHEN COALESCE(((_field -> 'routes') ->> 'sameDay')::boolean, false)
                      THEN 'urgent' ELSE 'review' END;

    INSERT INTO public.care_flags (client_id, document_id, kind, severity, detail, raised_by)
    VALUES (_doc.client_id, _doc.id, _kind, _severity, _field ->> 'record', 'assessment')
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS _rows = ROW_COUNT;
    _made := _made + _rows;
  END LOOP;
  RETURN _made;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_assessment_submit(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _d public.care_documents%ROWTYPE;
  _version integer;
  _definition jsonb; _sections jsonb;
  _src_answers jsonb; _src_def jsonb;
  _missing integer := 0; _undecided integer := 0;
BEGIN
  IF NOT public.care_is_assigned_assessor(_id) THEN
    RAISE EXCEPTION 'Only the assigned assessor can send this assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF _w.status = 'submitted' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'document_id', _w.document_id);
  END IF;
  IF _w.document_id IS NULL THEN RAISE EXCEPTION 'There is nothing to send yet'; END IF;

  SELECT * INTO _d FROM public.care_documents WHERE id = _w.document_id;
  SELECT definition INTO _definition FROM public.form_definitions WHERE id = _d.form_definition_id;
  _sections := private.care_sections_for(COALESCE(_definition,'{}'::jsonb),
                                         COALESCE(_d.resolved_modules,'[]'::jsonb));

  SELECT count(*) INTO _missing
    FROM jsonb_array_elements(_sections) s,
         jsonb_array_elements(COALESCE(s -> 'fields','[]'::jsonb)) fl
   WHERE COALESCE((fl ->> 'required')::boolean, false)
     AND (NOT (fl ? 'showWhen')
          OR private.care_condition_met(fl -> 'showWhen', COALESCE(_d.responses,'{}'::jsonb)))
     AND NOT private.care_answered(COALESCE(_d.responses,'{}'::jsonb) -> (fl ->> 'id'));
  IF _missing > 0 THEN
    RAISE EXCEPTION 'Answer every required question before sending this assessment';
  END IF;

  SELECT d.responses, f.definition INTO _src_answers, _src_def
    FROM public.care_documents d
    JOIN public.form_definitions f ON f.id = d.form_definition_id
   WHERE d.id = _w.source_document_id;

  IF _src_def IS NOT NULL THEN
    SELECT count(*) INTO _undecided
      FROM jsonb_array_elements(_src_def -> 'sections') s,
           jsonb_array_elements(COALESCE(s -> 'fields','[]'::jsonb)) fl
     WHERE private.care_answered(COALESCE(_src_answers,'{}'::jsonb) -> (fl ->> 'id'))
       AND NOT (COALESCE(_d.responses,'{}'::jsonb) ? ('confirm.' || (fl ->> 'id')));
    IF _undecided > 0 THEN
      RAISE EXCEPTION 'Confirm or amend everything the family told us before sending this assessment';
    END IF;
  END IF;

  SELECT 1 + COALESCE(MAX(version), 0) INTO _version FROM public.care_documents
   WHERE client_id = _w.client_id AND kind = 'assessment' AND status IN ('submitted','superseded');

  UPDATE public.care_documents
     SET status = 'submitted', version = _version, submitted_at = now(),
         supersedes_id = CASE WHEN EXISTS (
             SELECT 1 FROM public.care_documents p
              WHERE p.id = _d.built_from_id AND p.kind = 'assessment'
           ) THEN _d.built_from_id ELSE supersedes_id END,
         content_hash = md5(COALESCE(_d.responses, '{}'::jsonb)::text), updated_at = now()
   WHERE id = _w.document_id;

  IF _d.built_from_id IS NOT NULL THEN
    UPDATE public.care_documents SET status = 'superseded', updated_at = now()
     WHERE id = _d.built_from_id AND kind = 'assessment' AND status = 'submitted';
  END IF;

  UPDATE public.care_assessment_work
     SET status = 'submitted', submitted_at = now(),
         review_decision = NULL, reviewed_by = NULL, reviewed_at = NULL, review_reason = NULL,
         updated_at = now()
   WHERE id = _id;

  PERFORM private.care_assessment_escalate(_d, _definition);
  PERFORM private.care_assessment_log(_id, 'submitted',
    jsonb_build_object('document_id', _w.document_id, 'version', _version));
  PERFORM private.care_work_apply(_w.client_id, 'assessment_submitted', _id);
  RETURN jsonb_build_object('ok', true, 'document_id', _w.document_id, 'version', _version);
END;
$$;

REVOKE REFERENCES, TRIGGER ON public.care_documents FROM anon, authenticated;
REVOKE REFERENCES, TRIGGER ON public.care_plan_needs FROM anon, authenticated;
REVOKE REFERENCES, TRIGGER ON public.care_plan_goals FROM anon, authenticated;
REVOKE REFERENCES, TRIGGER ON public.care_plan_tasks FROM anon, authenticated;
REVOKE REFERENCES, TRIGGER ON public.care_flags FROM anon, authenticated;