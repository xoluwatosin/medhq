-- The checklist is written by the same authority that decides the review, and
-- an assessment cannot be accepted until every check is decided and met.
CREATE OR REPLACE FUNCTION public.care_review_checklist_save(_id uuid, _checklist jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _item text;
  _decision text;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'Not allowed to review assessments';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assessment is not on record'; END IF;
  IF _w.status <> 'submitted' THEN RAISE EXCEPTION 'That assessment has not been sent for review'; END IF;
  IF _w.review_decision IS NOT NULL THEN
    RAISE EXCEPTION 'That assessment has already been reviewed';
  END IF;
  IF jsonb_typeof(COALESCE(_checklist, 'null'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'That checklist could not be recorded';
  END IF;

  FOR _item IN SELECT jsonb_object_keys(_checklist) LOOP
    IF NOT (_item = ANY(private.care_review_checklist_items())) THEN
      RAISE EXCEPTION 'That is not a check on this review';
    END IF;
    _decision := _checklist #>> ARRAY[_item, 'decision'];
    IF _decision IS NOT NULL AND _decision NOT IN ('met', 'not_met', 'not_applicable') THEN
      RAISE EXCEPTION 'That checklist decision could not be recorded';
    END IF;
    IF length(COALESCE(_checklist #>> ARRAY[_item, 'note'], '')) > 4000 THEN
      RAISE EXCEPTION 'That note is too long';
    END IF;
  END LOOP;

  UPDATE public.care_assessment_work
     SET review_checklist = _checklist, updated_at = now()
   WHERE id = _id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.care_assessment_accept(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _w public.care_assessment_work%ROWTYPE; _plan uuid; _self boolean; _problem text;
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

  _problem := private.care_review_checklist_problem(_w.review_checklist);
  IF _problem IS NOT NULL THEN RAISE EXCEPTION '%', _problem; END IF;

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
$$;