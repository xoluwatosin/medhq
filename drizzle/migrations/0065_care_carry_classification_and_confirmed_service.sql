-- Pass 3: what the family said, classified, with the evidence frozen at send.
ALTER TABLE public.care_documents ADD COLUMN IF NOT EXISTS active_evidence jsonb;
ALTER TABLE public.care_documents ADD COLUMN IF NOT EXISTS routing_facts jsonb;

COMMENT ON COLUMN public.care_documents.active_evidence IS
  'The clinical evidence carried from this form, frozen when it was sent. Raw responses are never edited to match it.';
COMMENT ON COLUMN public.care_documents.routing_facts IS
  'The service, recipient facts and modules frozen onto an assessment when the visit opened.';

-- A definition may only say one of five things about how an answer travels.
CREATE OR REPLACE FUNCTION private.care_definition_carry_issues(_definition jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT COALESCE(jsonb_agg(
    'A question carries as clinical evidence, context, operational, authority and consent, or not at all: '
    || (fl ->> 'id')), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(_definition -> 'sections', '[]'::jsonb)) s,
         jsonb_array_elements(COALESCE(s -> 'fields', '[]'::jsonb)) fl
   WHERE fl ? 'carry'
     AND (fl ->> 'carry') NOT IN
       ('clinical_evidence','context','operational','authority_consent','not_carried');
$function$;

CREATE OR REPLACE FUNCTION private.care_definition_publish_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _issues jsonb := '[]'::jsonb; _first text;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  SELECT COALESCE(jsonb_agg(i), '[]'::jsonb) INTO _issues
    FROM jsonb_array_elements(private.care_definition_issues(NEW.definition)) i;
  _issues := _issues || private.care_definition_condition_issues(NEW.definition);
  _issues := _issues || private.care_definition_carry_issues(NEW.definition);
  IF jsonb_array_length(_issues) > 0 THEN
    _first := _issues ->> 0;
    RAISE EXCEPTION 'That form cannot be published: %', _first;
  END IF;
  RETURN NEW;
END;
$function$;

-- The evidence a form actually carries: clinical questions that applied and
-- were answered, read from the definition the family answered.
CREATE OR REPLACE FUNCTION private.care_active_evidence(_document uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _d public.care_documents%ROWTYPE;
  _definition jsonb;
  _sections jsonb;
  _out jsonb;
BEGIN
  SELECT * INTO _d FROM public.care_documents WHERE id = _document;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;
  SELECT definition INTO _definition FROM public.form_definitions WHERE id = _d.form_definition_id;
  IF _definition IS NULL THEN RETURN '[]'::jsonb; END IF;

  _sections := private.care_sections_for(
    _definition, private.care_resolve_modules(_d.client_id, _definition));

  SELECT COALESCE(jsonb_agg(fl ->> 'id'), '[]'::jsonb) INTO _out
    FROM jsonb_array_elements(_sections) s,
         jsonb_array_elements(COALESCE(s -> 'fields', '[]'::jsonb)) fl
   WHERE COALESCE(fl ->> 'carry', 'context') = 'clinical_evidence'
     AND (NOT (fl ? 'showWhen')
          OR private.care_condition_met(fl -> 'showWhen', COALESCE(_d.responses, '{}'::jsonb)))
     AND private.care_answered(COALESCE(_d.responses, '{}'::jsonb) -> (fl ->> 'id'));
  RETURN _out;
END;
$function$;

-- Pass 4: the service confirmed at intake, not the one the enquiry guessed.
CREATE OR REPLACE FUNCTION private.care_confirmed_service(_client_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _service text;
BEGIN
  SELECT NULLIF(d.responses ->> 'derived_service', 'unknown') INTO _service
    FROM public.care_documents d
   WHERE d.client_id = _client_id AND d.kind = 'pre_assessment' AND d.status = 'submitted'
   ORDER BY d.submitted_at DESC NULLS LAST LIMIT 1;
  RETURN COALESCE(_service, private.care_service_key(_client_id));
END;
$function$;

CREATE OR REPLACE FUNCTION private.care_routing_facts(_client_id uuid, _definition jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _pre public.care_documents%ROWTYPE;
BEGIN
  SELECT * INTO _pre FROM public.care_documents
   WHERE client_id = _client_id AND kind = 'pre_assessment' AND status = 'submitted'
   ORDER BY submitted_at DESC NULLS LAST LIMIT 1;
  RETURN jsonb_build_object(
    'service', private.care_confirmed_service(_client_id),
    'enquiry_service', private.care_service_key(_client_id),
    'recipient_group', COALESCE(_pre.responses ->> 'derived_recipient_group', 'unknown'),
    'age_band', COALESCE(_pre.responses ->> 'derived_age_band', 'unknown'),
    'source_document_id', _pre.id,
    'modules', private.care_resolve_modules(_client_id, COALESCE(_definition, '{}'::jsonb)),
    'frozen_at', now());
END;
$function$;

-- Module resolution now follows the confirmed service.
CREATE OR REPLACE FUNCTION private.care_resolve_modules(_client_id uuid, _definition jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _responses jsonb := '{}'::jsonb;
  _service text;
  _rules jsonb := COALESCE(_definition -> 'moduleRules', '{}'::jsonb);
  _key text; _rule jsonb; _cond jsonb; _hit boolean;
  _out text[] := '{}'::text[];
BEGIN
  SELECT COALESCE(responses, '{}'::jsonb) INTO _responses
    FROM public.care_documents
   WHERE client_id = _client_id AND kind = 'pre_assessment' AND status = 'submitted'
   ORDER BY submitted_at DESC NULLS LAST LIMIT 1;

  _service := COALESCE(NULLIF(_responses ->> 'derived_service', 'unknown'),
                       private.care_service_key(_client_id));

  FOR _key IN SELECT jsonb_object_keys(_rules) ORDER BY 1 LOOP
    _rule := _rules -> _key;
    _hit := false;
    IF _service IS NOT NULL
       AND COALESCE(_rule -> 'always', '[]'::jsonb) ? _service THEN
      _hit := true;
    END IF;
    IF NOT _hit THEN
      FOR _cond IN SELECT jsonb_array_elements(COALESCE(_rule -> 'whenAny', '[]'::jsonb)) LOOP
        IF private.care_condition_met(_cond, _responses) THEN _hit := true; EXIT; END IF;
      END LOOP;
    END IF;
    IF _hit THEN _out := _out || _key; END IF;
  END LOOP;

  RETURN to_jsonb(_out);
END;
$function$;

-- Opening the visit freezes the route as well as the modules.
CREATE OR REPLACE FUNCTION private.care_assessment_document(_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _definition uuid;
  _body jsonb;
  _doc uuid;
BEGIN
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF _w.document_id IS NOT NULL THEN RETURN _w.document_id; END IF;

  SELECT id, definition INTO _definition, _body FROM public.form_definitions
   WHERE kind = 'assessment' AND status = 'published'
   ORDER BY version DESC LIMIT 1;

  IF _definition IS NULL THEN
    RAISE EXCEPTION 'The assessment framework has not been published yet';
  END IF;

  INSERT INTO public.care_documents
    (client_id, kind, form_definition_id, status, responses, authored_by_person_id,
     assessment_work_id, resolved_modules, routing_facts)
  VALUES (_w.client_id, 'assessment', _definition, 'draft', '{}'::jsonb, _w.assessor_person_id,
          _id, private.care_resolve_modules(_w.client_id, COALESCE(_body, '{}'::jsonb)),
          private.care_routing_facts(_w.client_id, COALESCE(_body, '{}'::jsonb)))
  RETURNING id INTO _doc;

  UPDATE public.care_assessment_work SET document_id = _doc, updated_at = now() WHERE id = _id;
  RETURN _doc;
END;
$function$;

-- A route only changes deliberately, and says what changed and why.
CREATE OR REPLACE FUNCTION public.care_assessment_reroute(_id uuid, _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _d public.care_documents%ROWTYPE;
  _body jsonb; _facts jsonb;
BEGIN
  IF NOT (private.care_ops_ok() OR private.care_clinical_ok()) THEN
    RAISE EXCEPTION 'Not allowed to change this assessment''s route';
  END IF;
  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Say why the route is changing';
  END IF;

  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assessment is not on record'; END IF;
  IF _w.document_id IS NULL THEN RAISE EXCEPTION 'That visit has not opened yet'; END IF;

  SELECT * INTO _d FROM public.care_documents WHERE id = _w.document_id;
  IF _d.status <> 'draft' THEN
    RAISE EXCEPTION 'A sent assessment keeps the route it was written against';
  END IF;

  SELECT definition INTO _body FROM public.form_definitions WHERE id = _d.form_definition_id;
  _facts := private.care_routing_facts(_w.client_id, COALESCE(_body, '{}'::jsonb));

  UPDATE public.care_documents
     SET routing_facts = _facts,
         resolved_modules = COALESCE(_facts -> 'modules', '[]'::jsonb),
         updated_at = now()
   WHERE id = _d.id;

  PERFORM private.care_assessment_log(_id, 'rerouted',
    jsonb_build_object('from', _d.routing_facts, 'to', _facts, 'reason', btrim(_reason)));

  RETURN jsonb_build_object('ok', true, 'routing_facts', _facts);
END;
$function$;

REVOKE ALL ON FUNCTION public.care_assessment_reroute(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.care_assessment_reroute(uuid, text) TO authenticated;

-- Only active clinical evidence has to be confirmed or amended.
CREATE OR REPLACE FUNCTION public.care_assessment_submit(_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _d public.care_documents%ROWTYPE;
  _src public.care_documents%ROWTYPE;
  _version integer;
  _definition jsonb; _sections jsonb;
  _src_def jsonb; _evidence jsonb;
  _missing integer := 0; _undecided integer := 0;
BEGIN
  IF NOT public.care_is_assigned_assessor(_id) THEN
    RAISE EXCEPTION 'Only the assigned assessor can send this assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF _w.status = 'submitted' THEN
    PERFORM private.care_review_open(_id, _w.document_id, _w.client_id);
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

  SELECT * INTO _src FROM public.care_documents WHERE id = _w.source_document_id;
  IF _src.id IS NOT NULL THEN
    _evidence := _src.active_evidence;
    IF _evidence IS NULL THEN
      SELECT f.definition INTO _src_def FROM public.form_definitions f WHERE f.id = _src.form_definition_id;
      SELECT COALESCE(jsonb_agg(fl ->> 'id'), '[]'::jsonb) INTO _evidence
        FROM jsonb_array_elements(COALESCE(_src_def -> 'sections', '[]'::jsonb)) s,
             jsonb_array_elements(COALESCE(s -> 'fields','[]'::jsonb)) fl
       WHERE COALESCE(fl ->> 'carry', 'clinical_evidence') = 'clinical_evidence'
         AND private.care_answered(COALESCE(_src.responses,'{}'::jsonb) -> (fl ->> 'id'));
    END IF;

    SELECT count(*) INTO _undecided
      FROM jsonb_array_elements_text(COALESCE(_evidence, '[]'::jsonb)) fid
     WHERE NOT (COALESCE(_d.responses,'{}'::jsonb) ? ('confirm.' || fid));
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
         review_checklist = NULL, updated_at = now()
   WHERE id = _id;

  PERFORM private.care_review_open(_id, _w.document_id, _w.client_id);
  PERFORM private.care_assessment_escalate(_d, _definition);
  PERFORM private.care_assessment_log(_id, 'submitted',
    jsonb_build_object('document_id', _w.document_id, 'version', _version));
  PERFORM private.care_work_apply(_w.client_id, 'assessment_submitted', _id);
  RETURN jsonb_build_object('ok', true, 'document_id', _w.document_id, 'version', _version);
END;
$function$;
