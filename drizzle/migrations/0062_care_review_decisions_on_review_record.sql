-- Accept and return are recorded against the review of the exact version judged.
DROP FUNCTION IF EXISTS public.care_assessment_accept(uuid);

CREATE FUNCTION public.care_assessment_accept(_id uuid, _notes text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _r public.care_assessment_reviews;
  _plan uuid; _self boolean; _problem text;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'Not allowed to review assessments';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assessment is not on record'; END IF;

  IF _w.review_decision = 'accepted' THEN
    SELECT id INTO _plan FROM public.care_documents
     WHERE kind = 'care_plan' AND built_from_id = _w.document_id
     ORDER BY created_at LIMIT 1;
    RETURN jsonb_build_object('ok', true, 'already', true, 'care_plan_id', _plan);
  END IF;
  IF _w.status <> 'submitted' THEN RAISE EXCEPTION 'That assessment has not been sent for review'; END IF;

  PERFORM private.care_review_open(_id, _w.document_id, _w.client_id);
  SELECT * INTO _r FROM private.care_review_current(_id);
  IF _r.id IS NULL THEN RAISE EXCEPTION 'There is no review open on this assessment'; END IF;
  IF _r.status <> 'open' THEN RAISE EXCEPTION 'That assessment has already been reviewed'; END IF;

  _problem := private.care_review_checklist_problem(_r.checklist);
  IF _problem IS NOT NULL THEN RAISE EXCEPTION '%', _problem; END IF;

  SELECT EXISTS (SELECT 1 FROM public.mu_people p
                  WHERE p.id = _w.assessor_person_id AND p.auth_user_id = auth.uid())
    INTO _self;
  IF _self THEN RAISE EXCEPTION 'The assessor cannot review their own assessment'; END IF;

  UPDATE public.care_assessment_reviews
     SET status = 'accepted', decision = 'accepted', reviewer_user_id = auth.uid(),
         decision_notes = NULLIF(btrim(COALESCE(_notes, '')), ''),
         completed_at = now(), updated_at = now()
   WHERE id = _r.id;

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
    jsonb_build_object('document_id', _w.document_id, 'care_plan_id', _plan, 'review_id', _r.id));

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_w.client_id, 'assessment_accepted',
          jsonb_build_object('assessment_id', _id, 'care_plan_id', _plan), auth.uid());

  PERFORM public.care_refresh_stage(_w.client_id);
  RETURN jsonb_build_object('ok', true, 'care_plan_id', _plan, 'review_id', _r.id);
END;
$function$;

REVOKE ALL ON FUNCTION public.care_assessment_accept(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.care_assessment_accept(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.care_assessment_return(uuid, text);

CREATE FUNCTION public.care_assessment_return(
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
     reissue_reason, authored_by_person_id, assessment_work_id, resolved_modules)
  VALUES (_source.client_id, 'assessment', _source.form_definition_id, 'draft',
          _source.responses, _source.id, btrim(_reason), _w.assessor_person_id,
          _id, _source.resolved_modules)
  RETURNING id INTO _next;

  UPDATE public.care_assessment_reviews
     SET status = 'returned', decision = 'returned', reviewer_user_id = auth.uid(),
         decision_reason = btrim(_reason),
         return_category = NULLIF(btrim(COALESCE(_category, '')), ''),
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
                       'reason', btrim(_reason), 'priority', _priority, 'review_id', _r.id));

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_w.client_id, 'assessment_returned',
          jsonb_build_object('assessment_id', _id, 'reason', btrim(_reason)), auth.uid());

  PERFORM public.care_refresh_stage(_w.client_id);
  RETURN jsonb_build_object('ok', true, 'document_id', _next, 'review_id', _r.id);
END;
$function$;

REVOKE ALL ON FUNCTION public.care_assessment_return(uuid, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.care_assessment_return(uuid, text, text, text, text) TO authenticated;
