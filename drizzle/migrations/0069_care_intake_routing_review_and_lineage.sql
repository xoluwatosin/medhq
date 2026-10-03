-- Intake integrity correction.
--
-- Routing is worked out from the exact submitted pre-assessment the visit came
-- from, using the shared derived-facts contract. Nothing reads a stored
-- derived_* answer, because the form-save path never writes one.

-- The exact source form: the one the visit names, or the last one sent.
CREATE OR REPLACE FUNCTION private.care_pre_assessment_source(_client_id uuid, _preferred uuid)
 RETURNS public.care_documents
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _d public.care_documents%ROWTYPE;
BEGIN
  IF _preferred IS NOT NULL THEN
    SELECT * INTO _d FROM public.care_documents
     WHERE id = _preferred AND kind = 'pre_assessment';
    IF FOUND THEN RETURN _d; END IF;
  END IF;
  SELECT * INTO _d FROM public.care_documents
   WHERE client_id = _client_id AND kind = 'pre_assessment' AND status = 'submitted'
   ORDER BY submitted_at DESC NULLS LAST, created_at DESC LIMIT 1;
  RETURN _d;
END;
$function$;

-- The derived facts of one exact form, read from its own raw answers and the
-- service the enquiry recorded. Never from anything stored as an answer.
CREATE OR REPLACE FUNCTION private.care_intake_facts(_source uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _d public.care_documents%ROWTYPE;
BEGIN
  SELECT * INTO _d FROM public.care_documents WHERE id = _source;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
  RETURN private.care_derived_facts(
    COALESCE(_d.responses, '{}'::jsonb), private.care_service_key(_d.client_id));
END;
$function$;

-- The answers of one form as the conditions read them.
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
    COALESCE(_d.responses, '{}'::jsonb), private.care_service_key(_d.client_id));
END;
$function$;

-- The service confirmed at intake, from that exact form.
CREATE OR REPLACE FUNCTION private.care_confirmed_service_of(_source uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT NULLIF(private.care_intake_facts(_source) ->> 'derived_service', 'unknown');
$function$;

CREATE OR REPLACE FUNCTION private.care_confirmed_service(_client_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _src public.care_documents%ROWTYPE;
BEGIN
  SELECT * INTO _src FROM private.care_pre_assessment_source(_client_id, NULL);
  RETURN COALESCE(private.care_confirmed_service_of(_src.id),
                  private.care_service_key(_client_id));
END;
$function$;

-- Modules, from one exact source form and the service confirmed on it.
CREATE OR REPLACE FUNCTION private.care_modules_for(
  _source uuid, _client_id uuid, _definition jsonb, _service_override text DEFAULT NULL)
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
  IF _source IS NOT NULL THEN
    _responses := private.care_intake_responses(_source);
  END IF;
  _service := COALESCE(NULLIF(_service_override, ''),
                       private.care_confirmed_service_of(_source),
                       private.care_service_key(_client_id));

  FOR _key IN SELECT jsonb_object_keys(_rules) ORDER BY 1 LOOP
    _rule := _rules -> _key;
    _hit := false;
    IF _service IS NOT NULL AND COALESCE(_rule -> 'always', '[]'::jsonb) ? _service THEN
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

-- Kept for callers that only know the client: it resolves the source itself.
CREATE OR REPLACE FUNCTION private.care_resolve_modules(_client_id uuid, _definition jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _src public.care_documents%ROWTYPE;
BEGIN
  SELECT * INTO _src FROM private.care_pre_assessment_source(_client_id, NULL);
  RETURN private.care_modules_for(_src.id, _client_id, COALESCE(_definition, '{}'::jsonb), NULL);
END;
$function$;

-- The whole route, frozen from one exact source form.
CREATE OR REPLACE FUNCTION private.care_routing_facts_for(
  _source uuid, _client_id uuid, _definition jsonb,
  _service_override text DEFAULT NULL, _group_override text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _facts jsonb; _service text; _group text;
BEGIN
  _facts := private.care_intake_facts(_source);
  _service := COALESCE(NULLIF(_service_override, ''),
                       NULLIF(_facts ->> 'derived_service', 'unknown'),
                       private.care_service_key(_client_id));
  _group := COALESCE(NULLIF(_group_override, ''), _facts ->> 'derived_recipient_group', 'unknown');

  RETURN jsonb_build_object(
    'service', COALESCE(_service, 'unknown'),
    'enquiry_service', private.care_service_key(_client_id),
    'recipient_group', _group,
    'age_band', COALESCE(_facts ->> 'derived_age_band', 'unknown'),
    'age_years', COALESCE(_facts -> 'derived_age_years', 'null'::jsonb),
    'is_self', COALESCE(_facts ->> 'derived_is_self', 'no'),
    'service_conflict', COALESCE(_facts ->> 'derived_service_conflict', 'no'),
    'source_document_id', _source,
    'corrected', (_service_override IS NOT NULL OR _group_override IS NOT NULL),
    'modules', private.care_modules_for(_source, _client_id, COALESCE(_definition, '{}'::jsonb), _service),
    'frozen_at', now());
END;
$function$;

CREATE OR REPLACE FUNCTION private.care_routing_facts(_client_id uuid, _definition jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _src public.care_documents%ROWTYPE;
BEGIN
  SELECT * INTO _src FROM private.care_pre_assessment_source(_client_id, NULL);
  RETURN private.care_routing_facts_for(_src.id, _client_id, COALESCE(_definition, '{}'::jsonb), NULL, NULL);
END;
$function$;

-- Active evidence reads the exact source definition, the exact source answers
-- and the derived facts of that form, so a hidden answer stays hidden.
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
     AND private.care_answered(COALESCE(_d.responses, '{}'::jsonb) -> (fl ->> 'id'));
  RETURN _out;
END;
$function$;

-- Opening the visit freezes the route worked out from its own source form.
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
  _src public.care_documents%ROWTYPE;
  _facts jsonb;
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

  SELECT * INTO _src FROM private.care_pre_assessment_source(_w.client_id, _w.source_document_id);
  _facts := private.care_routing_facts_for(_src.id, _w.client_id, COALESCE(_body, '{}'::jsonb), NULL, NULL);

  INSERT INTO public.care_documents
    (client_id, kind, form_definition_id, status, responses, authored_by_person_id,
     assessment_work_id, resolved_modules, routing_facts)
  VALUES (_w.client_id, 'assessment', _definition, 'draft', '{}'::jsonb, _w.assessor_person_id,
          _id, COALESCE(_facts -> 'modules', '[]'::jsonb), _facts)
  RETURNING id INTO _doc;

  UPDATE public.care_assessment_work SET document_id = _doc, updated_at = now() WHERE id = _id;
  RETURN _doc;
END;
$function$;

-- Rerouting. Where nothing clinical has been written yet the draft snapshot is
-- corrected in place; where capture exists and applicability changes, a fresh
-- draft opens and the earlier draft is kept exactly as written.
DROP FUNCTION IF EXISTS public.care_assessment_reroute(uuid, text);

CREATE FUNCTION public.care_assessment_reroute(
  _id uuid, _reason text,
  _service text DEFAULT NULL, _recipient_group text DEFAULT NULL,
  _restart boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _d public.care_documents%ROWTYPE;
  _src public.care_documents%ROWTYPE;
  _body jsonb; _facts jsonb;
  _captured boolean; _material boolean; _outcome text; _next uuid;
BEGIN
  IF NOT (private.care_ops_ok() OR private.care_clinical_ok()) THEN
    RAISE EXCEPTION 'Not allowed to change this assessment''s route';
  END IF;
  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Say why the route is changing';
  END IF;
  IF _service IS NOT NULL AND _service NOT IN
     ('antenatal','postnatal','post_surgical','eldercare','clinical_home_care',
      'nanny','additional_needs','other') THEN
    RAISE EXCEPTION 'That is not a service we run';
  END IF;
  IF _recipient_group IS NOT NULL AND _recipient_group NOT IN
     ('baby','child','adult','older_person','maternal') THEN
    RAISE EXCEPTION 'That is not a group we assess for';
  END IF;

  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assessment is not on record'; END IF;
  IF _w.document_id IS NULL THEN RAISE EXCEPTION 'That visit has not opened yet'; END IF;

  SELECT * INTO _d FROM public.care_documents WHERE id = _w.document_id;
  IF _d.status <> 'draft' THEN
    RAISE EXCEPTION 'A sent assessment keeps the route it was written against';
  END IF;

  SELECT definition INTO _body FROM public.form_definitions WHERE id = _d.form_definition_id;
  SELECT * INTO _src FROM private.care_pre_assessment_source(_w.client_id, _w.source_document_id);
  _facts := private.care_routing_facts_for(
    _src.id, _w.client_id, COALESCE(_body, '{}'::jsonb), _service, _recipient_group);

  _captured := COALESCE(_d.responses, '{}'::jsonb) <> '{}'::jsonb;
  _material := COALESCE(_facts -> 'modules', '[]'::jsonb)
                 IS DISTINCT FROM COALESCE(_d.routing_facts -> 'modules', '[]'::jsonb)
            OR COALESCE(_facts ->> 'service', '')
                 IS DISTINCT FROM COALESCE(_d.routing_facts ->> 'service', '')
            OR COALESCE(_facts ->> 'recipient_group', '')
                 IS DISTINCT FROM COALESCE(_d.routing_facts ->> 'recipient_group', '');

  IF (_captured AND _material) OR _restart THEN
    INSERT INTO public.care_documents
      (client_id, kind, form_definition_id, status, responses, built_from_id,
       reissue_reason, authored_by_person_id, assessment_work_id,
       resolved_modules, routing_facts)
    VALUES (_d.client_id, 'assessment', _d.form_definition_id, 'draft', '{}'::jsonb, _d.id,
            btrim(_reason), _w.assessor_person_id, _id,
            COALESCE(_facts -> 'modules', '[]'::jsonb), _facts)
    RETURNING id INTO _next;

    UPDATE public.care_documents SET status = 'superseded', updated_at = now() WHERE id = _d.id;
    UPDATE public.care_assessment_work
       SET document_id = _next, updated_at = now() WHERE id = _id;
    _outcome := 'restarted';
  ELSE
    UPDATE public.care_documents
       SET routing_facts = _facts,
           resolved_modules = COALESCE(_facts -> 'modules', '[]'::jsonb),
           updated_at = now()
     WHERE id = _d.id;
    _next := _d.id;
    _outcome := 'updated';
  END IF;

  PERFORM private.care_assessment_log(_id, 'rerouted',
    jsonb_build_object('from', _d.routing_facts, 'to', _facts, 'reason', btrim(_reason),
                       'outcome', _outcome, 'document_id', _next,
                       'previous_document_id', _d.id,
                       'had_capture', _captured, 'material', _material));

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_w.client_id, 'assessment_rerouted',
          jsonb_build_object('assessment_id', _id, 'outcome', _outcome,
                             'reason', btrim(_reason)), auth.uid());

  RETURN jsonb_build_object('ok', true, 'outcome', _outcome,
                            'document_id', _next, 'routing_facts', _facts);
END;
$function$;

REVOKE ALL ON FUNCTION public.care_assessment_reroute(uuid, text, text, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.care_assessment_reroute(uuid, text, text, text, boolean) TO authenticated;

-- A note is required wherever a check is not met.
CREATE OR REPLACE FUNCTION public.care_review_checklist_save(_id uuid, _checklist jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _r public.care_assessment_reviews;
  _item text;
  _decision text;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'Not allowed to review assessments';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assessment is not on record'; END IF;
  IF _w.status <> 'submitted' THEN RAISE EXCEPTION 'That assessment has not been sent for review'; END IF;
  IF jsonb_typeof(COALESCE(_checklist, 'null'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'That checklist could not be recorded';
  END IF;

  PERFORM private.care_review_open(_id, _w.document_id, _w.client_id);
  SELECT * INTO _r FROM private.care_review_current(_id);
  IF _r.id IS NULL THEN RAISE EXCEPTION 'There is no review open on this assessment'; END IF;
  IF _r.status <> 'open' THEN RAISE EXCEPTION 'That assessment has already been reviewed'; END IF;

  FOR _item IN SELECT jsonb_object_keys(_checklist) LOOP
    IF NOT (_item = ANY(private.care_review_checklist_items())) THEN
      RAISE EXCEPTION 'That is not a check on this review';
    END IF;
    _decision := _checklist #>> ARRAY[_item, 'decision'];
    IF _decision IS NOT NULL AND _decision NOT IN ('met', 'not_met', 'not_applicable') THEN
      RAISE EXCEPTION 'That checklist decision could not be recorded';
    END IF;
    IF _decision = 'not_met'
       AND NULLIF(btrim(COALESCE(_checklist #>> ARRAY[_item, 'note'], '')), '') IS NULL THEN
      RAISE EXCEPTION 'Say what is wrong with a check that is not met';
    END IF;
    IF length(COALESCE(_checklist #>> ARRAY[_item, 'note'], '')) > 4000 THEN
      RAISE EXCEPTION 'That note is too long';
    END IF;
  END LOOP;

  UPDATE public.care_assessment_reviews
     SET checklist = _checklist, updated_at = now() WHERE id = _r.id;

  UPDATE public.care_assessment_work
     SET review_checklist = _checklist, updated_at = now()
   WHERE id = _id;
  RETURN jsonb_build_object('ok', true, 'review_id', _r.id);
END;
$function$;

-- A return names its category. The contract no longer allows it to be missing.
CREATE OR REPLACE FUNCTION public.care_assessment_return(
  _id uuid, _reason text,
  _category text DEFAULT NULL, _instructions text DEFAULT NULL, _priority text DEFAULT 'routine')
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _r public.care_assessment_reviews;
  _source public.care_documents%ROWTYPE;
  _next uuid; _self boolean; _to text;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'Not allowed to review assessments';
  END IF;
  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Say what needs clarifying';
  END IF;
  IF COALESCE(_category, '') NOT IN
     ('incomplete','clinical_detail','evidence_not_decided','risk_or_safeguarding',
      'medicines','recommendation','other') THEN
    RAISE EXCEPTION 'Choose what kind of return this is';
  END IF;
  IF NULLIF(btrim(COALESCE(_instructions, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Say what the assessor must do next';
  END IF;
  IF COALESCE(_priority, '') NOT IN ('routine', 'important', 'urgent') THEN
    RAISE EXCEPTION 'Choose how urgent this return is';
  END IF;

  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assessment is not on record'; END IF;
  IF _w.review_decision = 'returned' AND _w.status = 'in_progress' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'document_id', _w.document_id);
  END IF;
  IF _w.review_decision = 'accepted' THEN
    RAISE EXCEPTION 'That assessment has already been accepted';
  END IF;
  IF _w.status <> 'submitted' THEN RAISE EXCEPTION 'That assessment has not been sent for review'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.mu_people p
                  WHERE p.id = _w.assessor_person_id AND p.auth_user_id = auth.uid())
    INTO _self;
  IF _self THEN RAISE EXCEPTION 'The assessor cannot review their own assessment'; END IF;

  SELECT * INTO _source FROM public.care_documents WHERE id = _w.document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'The sent assessment is not on record'; END IF;

  PERFORM private.care_review_open(_id, _w.document_id, _w.client_id);
  SELECT * INTO _r FROM private.care_review_current(_id);
  IF _r.status <> 'open' THEN RAISE EXCEPTION 'That assessment has already been reviewed'; END IF;

  INSERT INTO public.care_documents
    (client_id, kind, form_definition_id, status, responses, built_from_id,
     reissue_reason, authored_by_person_id, assessment_work_id, resolved_modules, routing_facts)
  VALUES (_source.client_id, 'assessment', _source.form_definition_id, 'draft',
          _source.responses, _source.id, btrim(_reason), _w.assessor_person_id,
          _id, _source.resolved_modules, _source.routing_facts)
  RETURNING id INTO _next;

  UPDATE public.care_assessment_reviews
     SET status = 'returned', decision = 'returned', reviewer_user_id = auth.uid(),
         decision_reason = btrim(_reason),
         return_category = _category,
         return_instructions = btrim(_instructions),
         return_priority = _priority,
         completed_at = now(), updated_at = now()
   WHERE id = _r.id;

  UPDATE public.care_assessment_work
     SET review_decision = 'returned', reviewed_by = auth.uid(), reviewed_at = now(),
         review_reason = btrim(_reason), status = 'in_progress', submitted_at = NULL,
         document_id = _next, review_checklist = NULL, updated_at = now()
   WHERE id = _id;

  UPDATE public.care_work_items
     SET status = 'completed', outcome = 'Returned for clarification',
         completed_at = now(), completed_by = auth.uid()
   WHERE client_id = _w.client_id AND kind = 'clinical_review' AND status IN ('open','blocked');

  PERFORM private.care_work_add(
    _w.client_id, 'conduct', 'Clarify the assessment', 'assessment_visit:' || _id::text,
    'The assessment came back for clarification.', 'high', false,
    public.care_working_due(now(), 2), 'care', NULL, 'assessment_returned');

  SELECT lower(btrim(p.email)) INTO _to FROM public.mu_people p
   WHERE p.id = _w.assessor_person_id AND COALESCE(btrim(p.email), '') <> '';

  PERFORM private.care_notify_record(
    'assessment_returned', _w.client_id,
    'assessment_returned:' || _id::text || ':' || _next::text,
    'An assessment has been returned for clarification',
    _to, 'care_assessment_work', _id);

  PERFORM private.care_assessment_log(_id, 'returned',
    jsonb_build_object('source_document_id', _source.id, 'document_id', _next,
                       'reason', btrim(_reason), 'category', _category,
                       'priority', _priority, 'review_id', _r.id));

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_w.client_id, 'assessment_returned',
          jsonb_build_object('assessment_id', _id, 'reason', btrim(_reason)), auth.uid());

  PERFORM public.care_refresh_stage(_w.client_id);
  RETURN jsonb_build_object('ok', true, 'document_id', _next, 'review_id', _r.id);
END;
$function$;

-- A proposal is projected from the care plan built from the accepted
-- assessment it belongs to. There is no fallback to the latest plan on the
-- client, and a draft belonging to another plan is never repointed.
DROP FUNCTION IF EXISTS public.care_proposal_draft(uuid);

CREATE FUNCTION public.care_proposal_draft(
  _client_id uuid, _assessment_document_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _accepted uuid;
  _plan public.care_documents%ROWTYPE;
  _content jsonb := '{}'::jsonb;
  _key text;
  _existing public.care_proposals%ROWTYPE;
  _conflict public.care_proposals%ROWTYPE;
  _next integer;
BEGIN
  IF NOT private.care_ops_ok() THEN
    RAISE EXCEPTION 'Not allowed to prepare a care proposal';
  END IF;

  IF _assessment_document_id IS NOT NULL THEN
    SELECT w.document_id INTO _accepted FROM public.care_assessment_work w
     WHERE w.client_id = _client_id AND w.document_id = _assessment_document_id
       AND w.review_decision = 'accepted';
    IF _accepted IS NULL THEN
      RAISE EXCEPTION 'That assessment has not been accepted for this client';
    END IF;
  ELSE
    SELECT w.document_id INTO _accepted FROM public.care_assessment_work w
     WHERE w.client_id = _client_id AND w.review_decision = 'accepted'
     ORDER BY w.reviewed_at DESC NULLS LAST LIMIT 1;
    IF _accepted IS NULL THEN
      RAISE EXCEPTION 'There is no accepted assessment to prepare a proposal from';
    END IF;
  END IF;

  SELECT * INTO _plan FROM public.care_documents
   WHERE kind = 'care_plan' AND built_from_id = _accepted
   ORDER BY version DESC LIMIT 1;

  IF _plan.id IS NULL THEN
    RAISE EXCEPTION 'There is no care plan built from that accepted assessment yet';
  END IF;

  FOREACH _key IN ARRAY private.care_proposal_sections() LOOP
    IF _plan.responses ? _key THEN
      _content := _content || jsonb_build_object(_key, _plan.responses -> _key);
    END IF;
  END LOOP;

  SELECT * INTO _existing FROM public.care_proposals
   WHERE client_id = _client_id AND status = 'draft' AND plan_document_id = _plan.id
   ORDER BY version DESC LIMIT 1;

  IF _existing.id IS NULL THEN
    SELECT * INTO _conflict FROM public.care_proposals
     WHERE client_id = _client_id AND status = 'draft' AND plan_document_id <> _plan.id
     ORDER BY version DESC LIMIT 1;
    IF _conflict.id IS NOT NULL THEN
      RAISE EXCEPTION 'A draft proposal is already open on an earlier care plan. Withdraw it before preparing this one';
    END IF;
  END IF;

  IF _existing.id IS NOT NULL THEN
    UPDATE public.care_proposals
       SET content = _content, content_hash = md5(_content::text)
     WHERE id = _existing.id;
    RETURN jsonb_build_object('ok', true, 'proposal_id', _existing.id,
                              'version', _existing.version, 'plan_document_id', _plan.id);
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO _next
    FROM public.care_proposals WHERE client_id = _client_id;

  INSERT INTO public.care_proposals (client_id, plan_document_id, version, content, content_hash,
                                     created_by, supersedes_id)
  VALUES (_client_id, _plan.id, _next, _content, md5(_content::text), auth.uid(),
          (SELECT id FROM public.care_proposals
            WHERE client_id = _client_id AND status = 'sent'
            ORDER BY version DESC LIMIT 1))
  RETURNING * INTO _existing;

  RETURN jsonb_build_object('ok', true, 'proposal_id', _existing.id,
                            'version', _existing.version, 'plan_document_id', _plan.id);
END;
$function$;

REVOKE ALL ON FUNCTION public.care_proposal_draft(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.care_proposal_draft(uuid, uuid) TO authenticated;

-- Who a proposal may actually be sent to: people with clinical access.
CREATE OR REPLACE FUNCTION public.care_proposal_recipients(_client_id uuid)
 RETURNS TABLE (person_id uuid, full_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT g.person_id, COALESCE(p.full_name, 'Name not recorded')
    FROM public.care_access_grants g
    LEFT JOIN public.care_people p ON p.id = g.person_id
   WHERE g.client_id = _client_id AND g.state = 'active' AND g.clinical_scope
     AND private.care_ops_ok()
   ORDER BY 2;
$function$;

REVOKE ALL ON FUNCTION public.care_proposal_recipients(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.care_proposal_recipients(uuid) TO authenticated;