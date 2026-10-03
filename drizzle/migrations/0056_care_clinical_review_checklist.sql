-- The clinical review checklist.
--
-- A reviewer's decision is not a single button. Twelve checks are recorded
-- with the review, they are kept with the assessment, and an assessment
-- cannot be accepted while a check is undecided or not met.
ALTER TABLE public.care_assessment_work
  ADD COLUMN IF NOT EXISTS review_checklist jsonb;

CREATE OR REPLACE FUNCTION private.care_review_checklist_items()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'identity_and_consent',
    'capacity_and_participation',
    'carried_evidence_decided',
    'clinical_history_complete',
    'medicines_and_allergies_safe',
    'daily_living_and_mobility',
    'nutrition_hydration_continence',
    'skin_wounds_and_pain',
    'risks_and_safeguarding',
    'escalation_and_monitoring',
    'recommendation_supported',
    'suitable_to_proceed'
  ]::text[];
$$;

-- Either every check is decided and none is unmet, or the reason is returned.
CREATE OR REPLACE FUNCTION private.care_review_checklist_problem(_checklist jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _item text;
  _decision text;
BEGIN
  IF _checklist IS NULL OR jsonb_typeof(_checklist) <> 'object' THEN
    RETURN 'Complete the review checklist before deciding';
  END IF;
  FOREACH _item IN ARRAY private.care_review_checklist_items() LOOP
    _decision := _checklist #>> ARRAY[_item, 'decision'];
    IF _decision IS NULL THEN
      RETURN 'Complete the review checklist before deciding';
    END IF;
    IF _decision NOT IN ('met', 'not_met', 'not_applicable') THEN
      RETURN 'That checklist decision could not be recorded';
    END IF;
    IF _decision = 'not_met' THEN
      RETURN 'A check that is not met has to be returned to the assessor, not accepted';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- Recording the checklist. Kept separate from the decision, so a reviewer's
-- work is never lost, and only a reviewer with clinical authority may write it.
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
  IF NOT public.care_can_review_clinically() THEN
    RAISE EXCEPTION 'Only clinical staff can review an assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assessment could not be found'; END IF;
  IF _w.status <> 'submitted' THEN RAISE EXCEPTION 'That assessment is not awaiting review'; END IF;
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

REVOKE ALL ON FUNCTION public.care_review_checklist_save(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.care_review_checklist_save(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_review_checklist_save(uuid, jsonb) TO service_role;