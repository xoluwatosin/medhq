CREATE OR REPLACE FUNCTION private.care_work_apply(_client_id uuid, _event text, _ref uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _appointment timestamptz;
BEGIN
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

CREATE OR REPLACE FUNCTION public.care_work_event(_client_id uuid, _event text, _ref uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role)
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Not allowed to record Care work';
  END IF;
  PERFORM private.care_work_apply(_client_id, _event, _ref);
END;
$$;

CREATE OR REPLACE FUNCTION private.care_assessment_document(_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _definition uuid;
  _doc uuid;
BEGIN
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF _w.document_id IS NOT NULL THEN RETURN _w.document_id; END IF;

  SELECT id INTO _definition FROM public.form_definitions
   WHERE kind = 'assessment' AND status = 'published'
   ORDER BY version DESC LIMIT 1;

  INSERT INTO public.care_documents (client_id, kind, form_definition_id, status, responses, authored_by_person_id)
  VALUES (_w.client_id, 'assessment', _definition, 'draft', '{}'::jsonb, _w.assessor_person_id)
  RETURNING id INTO _doc;

  UPDATE public.care_assessment_work SET document_id = _doc, updated_at = now() WHERE id = _id;
  RETURN _doc;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_assessment_schedule(
  _client_id uuid,
  _appointment_at timestamptz,
  _appointment_ends_at timestamptz DEFAULT NULL,
  _location_kind text DEFAULT 'home',
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _id uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to arrange an assessment';
  END IF;
  IF _appointment_at IS NULL THEN RAISE EXCEPTION 'An appointment time is required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.care_documents
     WHERE client_id = _client_id AND kind = 'pre_assessment' AND status = 'submitted'
  ) THEN
    RAISE EXCEPTION 'The pre-assessment has not come back yet';
  END IF;

  SELECT id INTO _id FROM public.care_assessment_work
   WHERE client_id = _client_id AND status IN ('requested','scheduled','in_progress');

  IF _id IS NULL THEN
    INSERT INTO public.care_assessment_work
      (client_id, status, appointment_at, appointment_ends_at, location_kind, notes, requested_by)
    VALUES (_client_id, 'scheduled', _appointment_at, _appointment_ends_at,
            COALESCE(_location_kind, 'home'), _notes, auth.uid())
    RETURNING id INTO _id;
  ELSE
    UPDATE public.care_assessment_work
       SET status = CASE WHEN status = 'in_progress' THEN status ELSE 'scheduled' END,
           appointment_at = _appointment_at,
           appointment_ends_at = _appointment_ends_at,
           location_kind = COALESCE(_location_kind, location_kind),
           notes = COALESCE(_notes, notes),
           updated_at = now()
     WHERE id = _id;
  END IF;

  PERFORM private.care_assessment_document(_id);
  PERFORM private.care_assessment_log(_id, 'scheduled',
    jsonb_build_object('appointment_at', _appointment_at, 'location_kind', _location_kind));
  PERFORM private.care_work_apply(_client_id, 'assessment_scheduled', _id);
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_assessment_assign(_id uuid, _assessor_person_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _auth uuid;
  _doc uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to assign an assessor';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment not found'; END IF;
  IF _w.status IN ('submitted','cancelled') THEN
    RAISE EXCEPTION 'That assessment can no longer be reassigned';
  END IF;
  IF NOT public.mu_has_capability(_assessor_person_id, 'assessor') THEN
    RAISE EXCEPTION 'That person is not an approved assessor';
  END IF;

  SELECT auth_user_id INTO _auth FROM public.mu_people WHERE id = _assessor_person_id;

  UPDATE public.care_assessment_work
     SET assessor_person_id = _assessor_person_id,
         assigned_at = now(),
         assigned_by = auth.uid(),
         status = CASE WHEN status = 'in_progress' THEN 'scheduled' ELSE status END,
         updated_at = now()
   WHERE id = _id;

  _doc := private.care_assessment_document(_id);
  IF _doc IS NOT NULL THEN
    UPDATE public.care_documents
       SET authored_by_person_id = _assessor_person_id, updated_at = now()
     WHERE id = _doc AND status = 'draft';
  END IF;

  PERFORM private.care_assessment_log(_id, CASE WHEN _w.assessor_person_id IS NULL THEN 'assigned' ELSE 'reassigned' END,
    jsonb_build_object('from', _w.assessor_person_id, 'to', _assessor_person_id, 'reason', _reason));

  UPDATE public.care_work_items
     SET assignee_user_id = _auth, updated_at = now()
   WHERE client_id = _w.client_id AND kind = 'conduct' AND status IN ('open','blocked');

  PERFORM private.care_work_apply(_w.client_id, 'assessor_assigned', _id);
END;
$$;

CREATE OR REPLACE FUNCTION public.care_assessment_reschedule(
  _id uuid, _appointment_at timestamptz, _appointment_ends_at timestamptz DEFAULT NULL, _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _w public.care_assessment_work%ROWTYPE;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to change an assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment not found'; END IF;
  IF _w.status IN ('submitted','cancelled') THEN
    RAISE EXCEPTION 'That assessment can no longer be moved';
  END IF;

  UPDATE public.care_assessment_work
     SET appointment_at = _appointment_at,
         appointment_ends_at = _appointment_ends_at,
         updated_at = now()
   WHERE id = _id;

  PERFORM private.care_assessment_log(_id, 'rescheduled', jsonb_build_object(
    'from', _w.appointment_at, 'to', _appointment_at, 'reason', _reason));
  PERFORM private.care_work_apply(_w.client_id, 'assessment_scheduled', _id);
END;
$$;

CREATE OR REPLACE FUNCTION public.care_assessment_cancel(_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _w public.care_assessment_work%ROWTYPE;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to cancel an assessment';
  END IF;
  IF COALESCE(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'Give a reason'; END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment not found'; END IF;
  IF _w.status = 'submitted' THEN RAISE EXCEPTION 'A submitted assessment cannot be cancelled'; END IF;

  UPDATE public.care_assessment_work
     SET status = 'cancelled', cancelled_at = now(), cancel_reason = _reason, updated_at = now()
   WHERE id = _id;

  PERFORM private.care_assessment_log(_id, 'cancelled', jsonb_build_object('reason', _reason));
  PERFORM private.care_work_apply(_w.client_id, 'assessment_cancelled', _id);
END;
$$;

CREATE OR REPLACE FUNCTION public.care_assessment_start(_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _doc uuid;
BEGIN
  IF NOT public.care_is_assigned_assessor(_id) THEN
    RAISE EXCEPTION 'Only the assigned assessor can open this assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id;
  IF _w.status = 'submitted' THEN RETURN _w.document_id; END IF;

  _doc := private.care_assessment_document(_id);

  UPDATE public.care_assessment_work
     SET status = 'in_progress', started_at = COALESCE(started_at, now()), updated_at = now()
   WHERE id = _id;

  IF _w.started_at IS NULL THEN
    PERFORM private.care_assessment_log(_id, 'started', jsonb_build_object('document_id', _doc));
  END IF;
  PERFORM private.care_work_apply(_w.client_id, 'assessment_started', _id);
  RETURN _doc;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_assessment_submit(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _responses jsonb;
BEGIN
  IF NOT public.care_is_assigned_assessor(_id) THEN
    RAISE EXCEPTION 'Only the assigned assessor can send this assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF _w.status = 'submitted' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'document_id', _w.document_id);
  END IF;
  IF _w.document_id IS NULL THEN RAISE EXCEPTION 'There is nothing to send yet'; END IF;

  SELECT responses INTO _responses FROM public.care_documents WHERE id = _w.document_id;

  UPDATE public.care_documents
     SET status = 'submitted', version = 1, submitted_at = now(),
         content_hash = md5(COALESCE(_responses, '{}'::jsonb)::text), updated_at = now()
   WHERE id = _w.document_id;

  UPDATE public.care_assessment_work
     SET status = 'submitted', submitted_at = now(), updated_at = now()
   WHERE id = _id;

  PERFORM private.care_assessment_log(_id, 'submitted', jsonb_build_object('document_id', _w.document_id));
  PERFORM private.care_work_apply(_w.client_id, 'assessment_submitted', _id);
  RETURN jsonb_build_object('ok', true, 'document_id', _w.document_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.care_assessment_brief(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _client public.clients%ROWTYPE;
  _pre jsonb;
  _definition jsonb;
  _draft jsonb;
BEGIN
  IF NOT public.care_is_assigned_assessor(_id) THEN
    RAISE EXCEPTION 'Not your assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id;
  SELECT * INTO _client FROM public.clients WHERE id = _w.client_id;

  SELECT d.responses INTO _pre
    FROM public.care_documents d
   WHERE d.client_id = _w.client_id AND d.kind = 'pre_assessment' AND d.status = 'submitted'
   ORDER BY d.submitted_at DESC NULLS LAST LIMIT 1;

  SELECT f.definition INTO _definition
    FROM public.care_documents d
    JOIN public.form_definitions f ON f.id = d.form_definition_id
   WHERE d.client_id = _w.client_id AND d.kind = 'pre_assessment' AND d.status = 'submitted'
   ORDER BY d.submitted_at DESC NULLS LAST LIMIT 1;

  SELECT responses INTO _draft FROM public.care_documents WHERE id = _w.document_id;

  RETURN jsonb_build_object(
    'assessment', to_jsonb(_w),
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
    'pre_assessment_definition', COALESCE(_definition, '{}'::jsonb),
    'responses', COALESCE(_draft, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.care_assessment_brief(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.care_assessment_brief(uuid) TO authenticated, service_role;