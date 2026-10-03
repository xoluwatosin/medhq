-- Canonical Care stages, derived from facts that exist, and the work rules
-- the assessment workflow creates.

-- Row counts are integers. This corrects the capture loop.
CREATE OR REPLACE FUNCTION public.care_assessment_capture(_id uuid, _events jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _event jsonb;
  _accepted text[] := ARRAY[]::text[];
  _responses jsonb;
  _rows integer;
BEGIN
  IF NOT public.care_is_assigned_assessor(_id) THEN
    RAISE EXCEPTION 'Only the assigned assessor can record this assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id;
  IF _w.status = 'submitted' THEN RAISE EXCEPTION 'This assessment has already been sent'; END IF;
  IF _w.document_id IS NULL THEN RAISE EXCEPTION 'This assessment has not been opened yet'; END IF;
  IF jsonb_typeof(_events) <> 'array' THEN RAISE EXCEPTION 'Nothing to record'; END IF;

  SELECT responses INTO _responses FROM public.care_documents WHERE id = _w.document_id FOR UPDATE;

  FOR _event IN SELECT * FROM jsonb_array_elements(_events) LOOP
    IF COALESCE(_event ->> 'client_event_id', '') = '' OR COALESCE(_event ->> 'field_id', '') = '' THEN
      CONTINUE;
    END IF;
    INSERT INTO public.care_assessment_capture_events
      (assessment_id, client_event_id, field_id, value, captured_at, author_person_id)
    VALUES (
      _id,
      _event ->> 'client_event_id',
      _event ->> 'field_id',
      _event -> 'value',
      COALESCE((_event ->> 'captured_at')::timestamptz, now()),
      _w.assessor_person_id
    )
    ON CONFLICT (assessment_id, client_event_id) DO NOTHING;
    GET DIAGNOSTICS _rows = ROW_COUNT;
    IF _rows > 0 THEN
      _responses := COALESCE(_responses, '{}'::jsonb) || jsonb_build_object(_event ->> 'field_id', _event -> 'value');
    END IF;
    _accepted := _accepted || (_event ->> 'client_event_id');
  END LOOP;

  UPDATE public.care_documents
     SET responses = _responses, updated_at = now()
   WHERE id = _w.document_id;

  UPDATE public.care_assessment_work SET updated_at = now() WHERE id = _id;
  RETURN jsonb_build_object('ok', true, 'accepted', to_jsonb(_accepted), 'document_id', _w.document_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.care_work_event(_client_id uuid, _event text, _ref uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _appointment timestamptz;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role)
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Not allowed to record Care work';
  END IF;

  IF _event = 'client_created' THEN
    PERFORM private.care_work_add(
      _client_id, 'callback', 'Call the enquirer back', 'client_created',
      'Confirm what is needed and whether to proceed.', 'high', false,
      public.care_working_due(now(), 1), 'care', NULL, _event, NULL, _ref);

  ELSIF _event = 'proceeding' THEN
    PERFORM private.care_work_add(
      _client_id, 'send_pre_assessment', 'Send the pre-assessment link', 'proceeding',
      'The family answers a few questions before the visit.', 'high', false,
      public.care_working_due(now(), 1), 'care', NULL, _event);

  ELSIF _event = 'pre_assessment_sent' THEN
    UPDATE public.care_work_items
       SET status = 'completed', outcome = 'Link sent', completed_at = now()
     WHERE client_id = _client_id AND kind = 'send_pre_assessment' AND status IN ('open','blocked');
    PERFORM private.care_work_add(
      _client_id, 'chase', 'Chase the pre-assessment answers', 'pre_assessment_sent:' || COALESCE(_ref::text, 'link'),
      'The link has gone out and nothing has come back yet.', 'normal', false,
      public.care_working_due(now(), 3), 'care', NULL, _event);

  ELSIF _event = 'pre_assessment_submitted' THEN
    UPDATE public.care_work_items
       SET status = 'completed', outcome = 'Answers returned', completed_at = now()
     WHERE client_id = _client_id AND kind IN ('chase','send_pre_assessment') AND status IN ('open','blocked');
    PERFORM private.care_work_add(
      _client_id, 'book', 'Book the assessment visit', 'pre_assessment_submitted:' || COALESCE(_ref::text, 'doc'),
      'The answers are in and the visit can be arranged.', 'high', false,
      public.care_working_due(now(), 2), 'care', NULL, _event, _ref);

  ELSIF _event = 'assessment_scheduled' THEN
    SELECT appointment_at INTO _appointment FROM public.care_assessment_work WHERE id = _ref;
    UPDATE public.care_work_items
       SET status = 'completed', outcome = 'Visit arranged', completed_at = now()
     WHERE client_id = _client_id AND kind = 'book' AND status IN ('open','blocked');

    IF NOT EXISTS (
      SELECT 1 FROM public.care_assessment_work
       WHERE id = _ref AND assessor_person_id IS NOT NULL
    ) THEN
      PERFORM private.care_work_add(
        _client_id, 'assign', 'Assign an assessor', 'assessment_scheduled:' || COALESCE(_ref::text, 'visit'),
        'The visit is arranged and nobody is assigned to carry it out.', 'high', true,
        public.care_working_due(now(), 1), 'care', NULL, _event);
    END IF;

    PERFORM private.care_work_add(
      _client_id, 'conduct', 'Carry out the assessment visit', 'assessment_visit:' || COALESCE(_ref::text, 'visit'),
      'The assessor visits and records the assessment.', 'normal', false,
      _appointment, 'care', NULL, _event);
    UPDATE public.care_work_items
       SET due_at = _appointment, updated_at = now()
     WHERE client_id = _client_id AND kind = 'conduct' AND status IN ('open','blocked');

  ELSIF _event = 'assessor_assigned' THEN
    UPDATE public.care_work_items
       SET status = 'completed', outcome = 'Assessor assigned', completed_at = now()
     WHERE client_id = _client_id AND kind = 'assign' AND status IN ('open','blocked');

  ELSIF _event = 'assessment_cancelled' THEN
    UPDATE public.care_work_items
       SET status = 'cancelled', cancel_reason = 'The assessment was cancelled', cancelled_at = now()
     WHERE client_id = _client_id AND kind IN ('assign','conduct') AND status IN ('open','blocked');
    PERFORM private.care_work_add(
      _client_id, 'book', 'Book the assessment visit', 'assessment_cancelled:' || COALESCE(_ref::text, 'visit'),
      'The arranged visit was cancelled and needs rearranging.', 'high', false,
      public.care_working_due(now(), 2), 'care', NULL, _event);

  ELSIF _event = 'assessment_submitted' THEN
    UPDATE public.care_work_items
       SET status = 'completed', outcome = 'Assessment sent', completed_at = now()
     WHERE client_id = _client_id AND kind IN ('conduct','assign') AND status IN ('open','blocked');
    PERFORM private.care_work_add(
      _client_id, 'clinical_review', 'Review the assessment', 'assessment_submitted:' || COALESCE(_ref::text, 'assessment'),
      'The assessor has sent the assessment for clinical review.', 'high', false,
      public.care_working_due(now(), 2), 'clinical', NULL, _event);
  END IF;

  PERFORM public.care_refresh_stage(_client_id);
END;
$$;

-- Canonical stages only. Historical values stay readable on old records but
-- are never produced again.
CREATE OR REPLACE FUNCTION public.care_derive_stage(_client_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE _c public.clients%ROWTYPE;
BEGIN
  SELECT * INTO _c FROM public.clients WHERE id = _client_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF _c.closed_at IS NOT NULL THEN RETURN 'closed'; END IF;
  IF _c.paused_at IS NOT NULL THEN RETURN 'paused'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_assignments a
              WHERE a.client_id = _client_id AND a.role IN ('named_caregiver','supervising_nurse','care_worker','nurse')
                AND (a.starts_on IS NULL OR a.starts_on <= current_date)
                AND (a.ends_on IS NULL OR a.ends_on >= current_date))
  THEN RETURN 'care_running'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_documents d
              WHERE d.client_id = _client_id AND d.kind = 'care_plan' AND d.status = 'submitted')
  THEN RETURN 'care_setup'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_documents d
              WHERE d.client_id = _client_id AND d.kind = 'care_plan' AND d.status = 'draft')
  THEN RETURN 'care_plan_preparation'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_documents d
              WHERE d.client_id = _client_id AND d.kind = 'assessment' AND d.status = 'submitted')
  THEN RETURN 'clinical_review'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_assessment_work w
              WHERE w.client_id = _client_id AND w.status = 'in_progress')
  THEN RETURN 'assessment_in_progress'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_documents d
              WHERE d.client_id = _client_id AND d.kind = 'assessment' AND d.status = 'draft')
  THEN RETURN 'assessment_in_progress'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_assessment_work w
              WHERE w.client_id = _client_id AND w.status IN ('requested','scheduled')
                AND w.appointment_at IS NOT NULL)
  THEN RETURN 'assessment_booked'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_documents d
              WHERE d.client_id = _client_id AND d.kind = 'pre_assessment' AND d.status = 'submitted')
  THEN RETURN 'pre_assessment_received'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_access_tokens t
              WHERE t.client_id = _client_id AND t.purpose = 'pre_assessment' AND t.revoked_at IS NULL)
  THEN RETURN 'awaiting_pre_assessment'; END IF;

  RETURN 'enquiry';
END;
$$;

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_stage_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_stage_check CHECK (stage IS NULL OR stage IN (
  'enquiry','awaiting_pre_assessment','pre_assessment_received','assessment_booked',
  'assessment_in_progress','clinical_review','care_plan_preparation','care_setup',
  'care_running','paused','closed',
  -- historical, readable but never produced again
  'callback_due','pre_assessment_sent','responses_returned','assessment_complete',
  'plan_preparation','plan_issued','new','contacted','won'
));

DROP TRIGGER IF EXISTS care_assessment_work_stage ON public.care_assessment_work;
CREATE TRIGGER care_assessment_work_stage
AFTER INSERT OR UPDATE ON public.care_assessment_work
FOR EACH ROW EXECUTE FUNCTION private.care_stage_touch();