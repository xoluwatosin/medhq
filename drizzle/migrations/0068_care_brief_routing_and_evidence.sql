-- The visit reads the route and the carried evidence exactly as they were
-- frozen, never as they would be worked out today.
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
    _pre := COALESCE(_src.responses, '{}'::jsonb);
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
      ELSE COALESCE(_src.active_evidence, private.care_active_evidence(_src.id)) END,
    'definition', COALESCE(_definition, '{}'::jsonb),
    'definition_version', _version,
    'resolved_modules', COALESCE(_doc.resolved_modules, '[]'::jsonb),
    'routing_facts', COALESCE(_doc.routing_facts, '{}'::jsonb),
    'responses', COALESCE(_doc.responses, '{}'::jsonb)
  );
END;
$function$;
