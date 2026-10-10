-- The assessor reads the answers given about the person they are visiting.
--
-- Since the form became multi-recipient, answers about a care recipient are
-- held under that recipient's key (r1__allergies, r2__allergies). The
-- assessment brief, the clinical evidence frozen at submission, and module
-- routing still read plain keys, so the assessor saw almost nothing and no
-- evidence was offered to confirm or amend.
--
-- private.care_recipient_answers returns a document's answers with the
-- client's own recipient answers also under plain keys. The recipient is the
-- one whose name matches the client, else the only recipient, else the one at
-- the client's position on the request.

CREATE OR REPLACE FUNCTION private.care_recipient_scope(_responses jsonb, _client_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _recipients jsonb := COALESCE(_responses -> 'care_intake' -> 'recipients', '[]'::jsonb);
  _c public.clients%ROWTYPE;
  _found text;
  _order integer;
BEGIN
  IF jsonb_typeof(_recipients) <> 'array' OR jsonb_array_length(_recipients) = 0 THEN RETURN NULL; END IF;
  SELECT * INTO _c FROM public.clients WHERE id = _client_id;

  SELECT r ->> 'id' INTO _found
    FROM jsonb_array_elements(_recipients) r
   WHERE lower(btrim(COALESCE(r ->> 'firstName', '') || ' ' || COALESCE(r ->> 'lastName', '')))
         IN (lower(btrim(COALESCE(_c.full_name, ''))),
             lower(btrim(COALESCE(_c.first_name, '') || ' ' || COALESCE(_c.last_name, ''))))
   LIMIT 1;
  IF _found IS NOT NULL THEN RETURN _found; END IF;

  IF jsonb_array_length(_recipients) = 1 THEN RETURN _recipients -> 0 ->> 'id'; END IF;

  SELECT display_order INTO _order FROM public.care_request_recipients
   WHERE client_id = _client_id ORDER BY created_at LIMIT 1;
  IF _order IS NOT NULL AND _order BETWEEN 1 AND jsonb_array_length(_recipients) THEN
    RETURN _recipients -> (_order - 1) ->> 'id';
  END IF;
  RETURN _recipients -> 0 ->> 'id';
END;
$function$;

CREATE OR REPLACE FUNCTION private.care_recipient_answers(_responses jsonb, _client_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _scope text := private.care_recipient_scope(COALESCE(_responses, '{}'::jsonb), _client_id);
  _own jsonb;
BEGIN
  IF _scope IS NULL THEN RETURN COALESCE(_responses, '{}'::jsonb); END IF;
  SELECT COALESCE(jsonb_object_agg(substr(key, length(_scope) + 3), value), '{}'::jsonb) INTO _own
    FROM jsonb_each(_responses)
   WHERE left(key, length(_scope) + 2) = _scope || '__';
  RETURN _responses || _own;
END;
$function$;

REVOKE ALL ON FUNCTION private.care_recipient_scope(jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.care_recipient_answers(jsonb, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.care_intake_responses(_source uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _d public.care_documents%ROWTYPE;
BEGIN
  SELECT * INTO _d FROM public.care_documents WHERE id = _source;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
  RETURN private.care_with_derived(
    private.care_recipient_answers(COALESCE(_d.responses, '{}'::jsonb), _d.client_id),
    private.care_service_key(_d.client_id));
END;
$function$;

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
  _responses jsonb;
  _out jsonb;
BEGIN
  SELECT * INTO _d FROM public.care_documents WHERE id = _document;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;
  SELECT definition INTO _definition FROM public.form_definitions WHERE id = _d.form_definition_id;
  IF _definition IS NULL THEN RETURN '[]'::jsonb; END IF;

  _responses := private.care_intake_responses(_document);
  _sections := private.care_sections_for(
    _definition, private.care_modules_for(_document, _d.client_id, _definition, NULL));

  SELECT COALESCE(jsonb_agg(fl ->> 'id'), '[]'::jsonb) INTO _out
    FROM jsonb_array_elements(_sections) s,
         jsonb_array_elements(COALESCE(s -> 'fields', '[]'::jsonb)) fl
   WHERE COALESCE(fl ->> 'carry', 'context') = 'clinical_evidence'
     AND (NOT (fl ? 'showWhen')
          OR private.care_condition_met(fl -> 'showWhen', _responses))
     AND private.care_answered(_responses -> (fl ->> 'id'));
  RETURN _out;
END;
$function$;

CREATE OR REPLACE FUNCTION private.care_active_evidence_of(_client_id uuid, _definition_id uuid, _responses jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _definition jsonb; _sections jsonb; _out jsonb; _own jsonb;
BEGIN
  SELECT definition INTO _definition FROM public.form_definitions WHERE id = _definition_id;
  IF _definition IS NULL THEN RETURN '[]'::jsonb; END IF;
  _own := private.care_recipient_answers(COALESCE(_responses, '{}'::jsonb), _client_id);

  _sections := private.care_sections_for(
    _definition, private.care_resolve_modules(_client_id, _definition));

  SELECT COALESCE(jsonb_agg(fl ->> 'id'), '[]'::jsonb) INTO _out
    FROM jsonb_array_elements(_sections) s,
         jsonb_array_elements(COALESCE(s -> 'fields', '[]'::jsonb)) fl
   WHERE COALESCE(fl ->> 'carry', 'context') = 'clinical_evidence'
     AND (NOT (fl ? 'showWhen')
          OR private.care_condition_met(fl -> 'showWhen', _own))
     AND private.care_answered(_own -> (fl ->> 'id'));
  RETURN _out;
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_assessment_brief(_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _client public.clients%ROWTYPE;
  _src public.care_documents%ROWTYPE;
  _pre jsonb; _pre_def jsonb; _pre_version integer;
  _doc public.care_documents%ROWTYPE;
  _definition jsonb; _version integer;
BEGIN
  IF NOT public.care_is_assigned_assessor(_id) THEN
    RAISE EXCEPTION 'Not your assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id;
  SELECT * INTO _client FROM public.clients WHERE id = _w.client_id;

  SELECT * INTO _src FROM public.care_documents WHERE id = _w.source_document_id;
  IF _src.id IS NOT NULL THEN
    _pre := private.care_recipient_answers(COALESCE(_src.responses, '{}'::jsonb), _src.client_id);
    SELECT definition, version INTO _pre_def, _pre_version
      FROM public.form_definitions WHERE id = _src.form_definition_id;
  END IF;

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
    'active_evidence', CASE
      WHEN _src.id IS NULL THEN '[]'::jsonb
      WHEN jsonb_array_length(COALESCE(_src.active_evidence, '[]'::jsonb)) > 0 THEN _src.active_evidence
      ELSE private.care_active_evidence(_src.id) END,
    'definition', COALESCE(_definition, '{}'::jsonb),
    'definition_version', _version,
    'resolved_modules', COALESCE(_doc.resolved_modules, '[]'::jsonb),
    'routing_facts', COALESCE(_doc.routing_facts, '{}'::jsonb),
    'responses', COALESCE(_doc.responses, '{}'::jsonb)
  );
END;
$function$;
