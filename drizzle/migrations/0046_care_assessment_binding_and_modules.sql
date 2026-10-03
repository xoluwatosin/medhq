-- Pass 2, Part A. Bind a clinical review to the exact assessment document the
-- visit produced, freeze the modules that document was written against,
-- complete document immutability and drop unnecessary table privileges.

ALTER TABLE public.care_documents
  ADD COLUMN IF NOT EXISTS assessment_work_id uuid REFERENCES public.care_assessment_work(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_modules jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS care_documents_assessment_work_idx
  ON public.care_documents(assessment_work_id, version DESC);

-- Backfill runs before the trigger is strengthened, so historical submitted
-- documents can still be bound to the visit that produced them.
WITH RECURSIVE chain AS (
  SELECT w.id AS work_id, d.id AS document_id, d.built_from_id
    FROM public.care_assessment_work w
    JOIN public.care_documents d ON d.id = w.document_id
   WHERE d.kind = 'assessment'
  UNION ALL
  SELECT c.work_id, p.id, p.built_from_id
    FROM chain c
    JOIN public.care_documents p ON p.id = c.built_from_id
   WHERE p.kind = 'assessment'
)
UPDATE public.care_documents d
   SET assessment_work_id = c.work_id
  FROM chain c
 WHERE d.id = c.document_id AND d.assessment_work_id IS NULL;

-- The definition's own service key, read from the client's service section.
CREATE OR REPLACE FUNCTION private.care_service_key(_client_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT CASE s.questionnaire_section
    WHEN 's1' THEN 'antenatal'
    WHEN 's2' THEN 'postnatal'
    WHEN 's3' THEN 'post_surgical'
    WHEN 's4' THEN 'eldercare'
    WHEN 's5' THEN 'clinical_home_care'
    WHEN 's6' THEN 'nanny'
    WHEN 's7' THEN 'additional_needs'
    WHEN 's8' THEN 'other'
    ELSE NULL END
    FROM public.clients c
    LEFT JOIN public.services s ON s.id = c.service_id
   WHERE c.id = _client_id;
$function$;

-- Deterministic module resolution, mirroring the rules the questionnaire
-- engine runs in the browser. Same definition plus same answers always gives
-- the same modules, in the same order.
CREATE OR REPLACE FUNCTION private.care_resolve_modules(_client_id uuid, _definition jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _responses jsonb := '{}'::jsonb;
  _service text := private.care_service_key(_client_id);
  _rules jsonb := COALESCE(_definition -> 'moduleRules', '{}'::jsonb);
  _key text; _rule jsonb; _cond jsonb; _hit boolean;
  _value jsonb; _list text[]; _out text[] := '{}'::text[];
  _result jsonb;
BEGIN
  SELECT COALESCE(responses, '{}'::jsonb) INTO _responses
    FROM public.care_documents
   WHERE client_id = _client_id AND kind = 'pre_assessment' AND status = 'submitted'
   ORDER BY version DESC NULLS LAST, submitted_at DESC LIMIT 1;

  FOR _key, _rule IN SELECT key, value FROM jsonb_each(_rules) LOOP
    _hit := _service IS NOT NULL
            AND jsonb_typeof(_rule -> 'always') = 'array'
            AND (_rule -> 'always') ? _service;
    IF NOT _hit THEN
      FOR _cond IN SELECT value FROM jsonb_array_elements(COALESCE(_rule -> 'whenAny', '[]'::jsonb)) LOOP
        _value := COALESCE(_responses -> (_cond ->> 'field'), 'null'::jsonb);
        _list := CASE jsonb_typeof(_value)
          WHEN 'array' THEN ARRAY(SELECT jsonb_array_elements_text(_value))
          WHEN 'null' THEN '{}'::text[]
          ELSE ARRAY[_value #>> '{}'] END;
        IF (_cond ? 'in' AND EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(_cond -> 'in') x WHERE x = ANY(_list)))
           OR (_cond ? 'contains' AND EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(_cond -> 'contains') x WHERE x = ANY(_list)))
        THEN _hit := true; EXIT; END IF;
      END LOOP;
    END IF;
    IF _hit THEN _out := _out || _key; END IF;
  END LOOP;

  SELECT COALESCE(jsonb_agg(m ORDER BY m), '[]'::jsonb) INTO _result FROM unnest(_out) m;
  RETURN _result;
END;
$function$;

-- Starting a visit still creates exactly one draft, now bound to the visit and
-- carrying the modules it was written against.
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
     assessment_work_id, resolved_modules)
  VALUES (_w.client_id, 'assessment', _definition, 'draft', '{}'::jsonb, _w.assessor_person_id,
          _id, private.care_resolve_modules(_w.client_id, COALESCE(_body, '{}'::jsonb)))
  RETURNING id INTO _doc;

  UPDATE public.care_assessment_work SET document_id = _doc, updated_at = now() WHERE id = _id;
  RETURN _doc;
END;
$function$;

-- A returned assessment's successor stays on the same visit and keeps the same
-- frozen modules, so the chain never crosses to another assessment.
CREATE OR REPLACE FUNCTION public.care_assessment_return(_id uuid, _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _source public.care_documents%ROWTYPE;
  _next uuid; _self boolean; _to text;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'Not allowed to review assessments';
  END IF;
  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Say what needs clarifying';
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

  INSERT INTO public.care_documents
    (client_id, kind, form_definition_id, status, responses, built_from_id,
     reissue_reason, authored_by_person_id, assessment_work_id, resolved_modules)
  VALUES (_source.client_id, 'assessment', _source.form_definition_id, 'draft',
          _source.responses, _source.id, btrim(_reason), _w.assessor_person_id,
          _id, _source.resolved_modules)
  RETURNING id INTO _next;

  UPDATE public.care_assessment_work
     SET review_decision = 'returned', reviewed_by = auth.uid(), reviewed_at = now(),
         review_reason = btrim(_reason), status = 'in_progress', submitted_at = NULL,
         document_id = _next, updated_at = now()
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
    jsonb_build_object('source_document_id', _source.id, 'document_id', _next, 'reason', btrim(_reason)));

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_w.client_id, 'assessment_returned',
          jsonb_build_object('assessment_id', _id, 'reason', btrim(_reason)), auth.uid());

  PERFORM public.care_refresh_stage(_w.client_id);
  RETURN jsonb_build_object('ok', true, 'document_id', _next);
END;
$function$;

-- Every authorship, freeze and provenance field is now protected.
CREATE OR REPLACE FUNCTION private.care_document_freeze()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF OLD.kind NOT IN ('assessment','care_plan') THEN RETURN NEW; END IF;
  IF OLD.status NOT IN ('submitted','superseded') THEN RETURN NEW; END IF;

  IF NEW.responses IS DISTINCT FROM OLD.responses
     OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.form_definition_id IS DISTINCT FROM OLD.form_definition_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.authored_by_person_id IS DISTINCT FROM OLD.authored_by_person_id
     OR NEW.authored_by_token_id IS DISTINCT FROM OLD.authored_by_token_id
     OR NEW.built_from_id IS DISTINCT FROM OLD.built_from_id
     OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id
     OR NEW.reissue_reason IS DISTINCT FROM OLD.reissue_reason
     OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
     OR NEW.outstanding_required IS DISTINCT FROM OLD.outstanding_required
     OR NEW.assessment_work_id IS DISTINCT FROM OLD.assessment_work_id
     OR NEW.resolved_modules IS DISTINCT FROM OLD.resolved_modules
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'That record has already been sent and cannot be changed';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'submitted' AND NEW.status = 'superseded')
  THEN
    RAISE EXCEPTION 'That record has already been sent and cannot be reopened';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS care_documents_freeze ON public.care_documents;
CREATE TRIGGER care_documents_freeze
  BEFORE UPDATE ON public.care_documents
  FOR EACH ROW EXECUTE FUNCTION private.care_document_freeze();

-- Clinical tables are read through policies and written only through the
-- security-definer routines. Nothing else needs a privilege here.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.care_documents FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.care_plan_needs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.care_plan_goals FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.care_plan_tasks FROM anon, authenticated;
REVOKE SELECT ON public.care_plan_needs, public.care_plan_goals, public.care_plan_tasks FROM anon;

-- The review reads the exact document this visit produced, rendered from the
-- exact definition that document was written against.
CREATE OR REPLACE FUNCTION public.care_assessment_record(_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _d public.care_documents%ROWTYPE;
  _pre jsonb; _pre_definition jsonb; _pre_version integer;
  _definition jsonb; _definition_version integer; _author text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to read this assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assessment is not on record'; END IF;

  -- Bound to this visit, never merely the latest assessment on the client.
  SELECT * INTO _d FROM public.care_documents
   WHERE assessment_work_id = _w.id AND kind = 'assessment'
     AND status IN ('submitted','superseded')
   ORDER BY version DESC NULLS LAST, submitted_at DESC LIMIT 1;

  IF NOT FOUND THEN
    -- Records written before binding existed: only this visit's own document.
    SELECT * INTO _d FROM public.care_documents
     WHERE id = _w.document_id AND kind = 'assessment'
       AND status IN ('submitted','superseded');
    IF NOT FOUND THEN RETURN NULL; END IF;
  END IF;

  SELECT f.definition, f.version INTO _definition, _definition_version
    FROM public.form_definitions f WHERE f.id = _d.form_definition_id;

  SELECT d.responses, f.definition, f.version INTO _pre, _pre_definition, _pre_version
    FROM public.care_documents d
    JOIN public.form_definitions f ON f.id = d.form_definition_id
   WHERE d.id = _w.source_document_id;

  SELECT p.full_name INTO _author FROM public.mu_people p
   WHERE p.id = COALESCE(_d.authored_by_person_id, _w.assessor_person_id);

  RETURN jsonb_build_object(
    'document', to_jsonb(_d),
    'author', _author,
    'source_document_id', _w.source_document_id,
    'definition', COALESCE(_definition, '{}'::jsonb),
    'definition_version', _definition_version,
    'resolved_modules', COALESCE(_d.resolved_modules, '[]'::jsonb),
    'pre_assessment', COALESCE(_pre, '{}'::jsonb),
    'pre_assessment_definition', COALESCE(_pre_definition, '{}'::jsonb),
    'pre_assessment_version', _pre_version,
    'flags', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', fl.id, 'kind', fl.kind, 'severity', fl.severity,
        'detail', fl.detail, 'cleared_at', fl.cleared_at)
        ORDER BY fl.created_at)
      FROM public.care_flags fl WHERE fl.client_id = _w.client_id), '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.care_assessment_record(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.care_assessment_record(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.care_resolve_modules(uuid, jsonb) FROM public;
REVOKE ALL ON FUNCTION private.care_service_key(uuid) FROM public;
