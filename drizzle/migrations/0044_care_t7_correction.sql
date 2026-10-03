-- Tranche 7 correction: no premature plan issue, least-privilege clinical
-- writes, stronger document immutability, and review notifications.

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
     OR NEW.built_from_id IS DISTINCT FROM OLD.built_from_id
     OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id
     OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
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

DROP POLICY IF EXISTS "Admins manage care documents" ON public.care_documents;
DROP POLICY IF EXISTS "Admins read care documents" ON public.care_documents;
CREATE POLICY "Admins read care documents" ON public.care_documents
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage plan needs" ON public.care_plan_needs;
DROP POLICY IF EXISTS "Admins read plan needs" ON public.care_plan_needs;
CREATE POLICY "Admins read plan needs" ON public.care_plan_needs
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage plan goals" ON public.care_plan_goals;
DROP POLICY IF EXISTS "Admins read plan goals" ON public.care_plan_goals;
CREATE POLICY "Admins read plan goals" ON public.care_plan_goals
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage plan tasks" ON public.care_plan_tasks;
DROP POLICY IF EXISTS "Admins read plan tasks" ON public.care_plan_tasks;
CREATE POLICY "Admins read plan tasks" ON public.care_plan_tasks
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

REVOKE INSERT, UPDATE, DELETE ON public.care_documents FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.care_plan_needs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.care_plan_goals FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.care_plan_tasks FROM authenticated;

ALTER TABLE public.care_notifications DROP CONSTRAINT IF EXISTS care_notifications_kind_check;
ALTER TABLE public.care_notifications
  ADD CONSTRAINT care_notifications_kind_check
  CHECK (kind = ANY (ARRAY[
    'pre_assessment_link','portal_invitation','account_setup',
    'assessment_returned','assessment_accepted']));

CREATE OR REPLACE FUNCTION private.care_notify_record(
  _kind text, _client_id uuid, _dedupe_key text, _subject text,
  _destination text, _related_table text, _related_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.care_notifications (
    kind, channel, destination, client_id, related_table, related_id,
    subject, dedupe_key, origin, created_by)
  VALUES (_kind, CASE WHEN _destination IS NULL THEN 'manual' ELSE 'email' END,
          _destination, _client_id, _related_table, _related_id,
          _subject, _dedupe_key, 'care_review', auth.uid())
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO _id;

  IF _id IS NULL THEN
    SELECT id INTO _id FROM public.care_notifications WHERE dedupe_key = _dedupe_key;
  END IF;
  RETURN _id;
END;
$function$;

CREATE OR REPLACE FUNCTION private.care_plan_issue_ready(_client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT false;
$function$;

COMMENT ON FUNCTION private.care_plan_issue_ready(uuid) IS
  'Returns true once the package is agreed and staffing is arranged. Implemented in Tranche 8.';

CREATE OR REPLACE FUNCTION public.care_plan_submit(_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _d public.care_documents%ROWTYPE;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'Not allowed to issue the care plan';
  END IF;
  SELECT * INTO _d FROM public.care_documents WHERE id = _document_id FOR UPDATE;
  IF NOT FOUND OR _d.kind <> 'care_plan' THEN RAISE EXCEPTION 'That care plan is not on record'; END IF;
  IF _d.status = 'submitted' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'document_id', _document_id, 'version', _d.version);
  END IF;
  IF _d.status <> 'draft' THEN RAISE EXCEPTION 'That care plan version cannot be issued'; END IF;

  IF NOT private.care_plan_issue_ready(_d.client_id) THEN
    RAISE EXCEPTION 'The care plan cannot be issued until the package is agreed and staffing is arranged';
  END IF;

  UPDATE public.care_documents
     SET status = 'submitted', submitted_at = now(),
         content_hash = md5(COALESCE(_d.responses, '{}'::jsonb)::text), updated_at = now()
   WHERE id = _document_id;

  IF _d.supersedes_id IS NOT NULL THEN
    UPDATE public.care_documents SET status = 'superseded', updated_at = now()
     WHERE id = _d.supersedes_id AND status = 'submitted';
  END IF;

  UPDATE public.care_work_items
     SET status = 'completed', outcome = 'Care plan issued', completed_at = now()
   WHERE client_id = _d.client_id AND kind = 'prepare_plan' AND status IN ('open','blocked');

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_d.client_id, 'care_plan_issued',
          jsonb_build_object('document_id', _document_id, 'version', _d.version), auth.uid());

  PERFORM public.care_refresh_stage(_d.client_id);
  RETURN jsonb_build_object('ok', true, 'document_id', _document_id, 'version', _d.version);
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_assessment_accept(_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _w public.care_assessment_work%ROWTYPE; _plan uuid; _self boolean;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'Not allowed to review assessments';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assessment is not on record'; END IF;

  IF _w.review_decision = 'accepted' THEN
    SELECT id INTO _plan FROM public.care_documents
     WHERE client_id = _w.client_id AND kind = 'care_plan' AND status IN ('draft','submitted')
     ORDER BY created_at LIMIT 1;
    RETURN jsonb_build_object('ok', true, 'already', true, 'care_plan_id', _plan);
  END IF;
  IF _w.status <> 'submitted' THEN RAISE EXCEPTION 'That assessment has not been sent for review'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.mu_people p
                  WHERE p.id = _w.assessor_person_id AND p.auth_user_id = auth.uid())
    INTO _self;
  IF _self THEN RAISE EXCEPTION 'The assessor cannot review their own assessment'; END IF;

  UPDATE public.care_assessment_work
     SET review_decision = 'accepted', reviewed_by = auth.uid(), reviewed_at = now(),
         review_reason = NULL, updated_at = now()
   WHERE id = _id;

  UPDATE public.care_work_items
     SET status = 'completed', outcome = 'Assessment accepted', completed_at = now(), completed_by = auth.uid()
   WHERE client_id = _w.client_id AND kind = 'clinical_review' AND status IN ('open','blocked');

  PERFORM private.care_work_add(
    _w.client_id, 'prepare_plan', 'Prepare the care plan', 'assessment_accepted:' || _id::text,
    'The assessment has been accepted and the plan can be written.', 'high', false,
    public.care_working_due(now(), 3), 'clinical', NULL, 'assessment_accepted');

  PERFORM private.care_work_add(
    _w.client_id, 'agree_package', 'Agree the care package', 'assessment_accepted:' || _id::text,
    'Set out what is proposed and agree it with the family.', 'high', false,
    public.care_working_due(now(), 3), 'care', NULL, 'assessment_accepted');

  _plan := private.care_plan_draft(_w.client_id, _w.document_id);

  PERFORM private.care_notify_record(
    'assessment_accepted', _w.client_id,
    'assessment_accepted:' || _id::text,
    'Assessment accepted: plan and package work has opened',
    NULL, 'care_assessment_work', _id);

  PERFORM private.care_assessment_log(_id, 'accepted',
    jsonb_build_object('document_id', _w.document_id, 'care_plan_id', _plan));

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_w.client_id, 'assessment_accepted',
          jsonb_build_object('assessment_id', _id, 'care_plan_id', _plan), auth.uid());

  PERFORM public.care_refresh_stage(_w.client_id);
  RETURN jsonb_build_object('ok', true, 'care_plan_id', _plan);
END;
$function$;

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
     reissue_reason, authored_by_person_id)
  VALUES (_source.client_id, 'assessment', _source.form_definition_id, 'draft',
          _source.responses, _source.id, btrim(_reason), _w.assessor_person_id)
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

CREATE OR REPLACE FUNCTION public.care_assessment_record(_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _d public.care_documents%ROWTYPE;
  _pre jsonb; _definition jsonb; _definition_version integer; _author text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to read this assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assessment is not on record'; END IF;

  SELECT * INTO _d FROM public.care_documents
   WHERE client_id = _w.client_id AND kind = 'assessment' AND status IN ('submitted','superseded')
   ORDER BY version DESC NULLS LAST, submitted_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT d.responses, f.definition, f.version INTO _pre, _definition, _definition_version
    FROM public.care_documents d
    JOIN public.form_definitions f ON f.id = d.form_definition_id
   WHERE d.id = _w.source_document_id;

  SELECT p.full_name INTO _author FROM public.mu_people p
   WHERE p.id = COALESCE(_d.authored_by_person_id, _w.assessor_person_id);

  RETURN jsonb_build_object(
    'document', to_jsonb(_d),
    'author', _author,
    'source_document_id', _w.source_document_id,
    'pre_assessment', COALESCE(_pre, '{}'::jsonb),
    'pre_assessment_definition', COALESCE(_definition, '{}'::jsonb),
    'pre_assessment_version', _definition_version,
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