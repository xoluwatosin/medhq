-- The assessment document is clinical content. It is created when the assigned
-- assessor opens the visit, never when a coordinator books or assigns one.
--
-- Medic Connect has no published clinical assessment questionnaire. What is
-- published here is a framework only: it records that an assessment document
-- confirms or amends the returned pre-assessment and carries the assessor's own
-- written account. No clinical questions are invented.

INSERT INTO public.form_definitions (kind, version, status, definition, published_at)
SELECT 'assessment', 1, 'published', jsonb_build_object(
  'kind', 'assessment',
  'version', 1,
  'framework', true,
  'source', 'Medic Connect Care assessment framework v1',
  'note', 'Structural framework only. Medic Connect has not published a clinical assessment question set. The assessor confirms or amends the returned pre-assessment and writes their own account.',
  'sections', jsonb_build_array(
    jsonb_build_object(
      'id', 'pre_assessment_review',
      'title', 'Pre-assessment review',
      'mode', 'confirm_amend',
      'fields', jsonb_build_array()
    ),
    jsonb_build_object(
      'id', 'assessor_account',
      'title', 'Assessor account',
      'mode', 'narrative',
      'fields', jsonb_build_array(
        jsonb_build_object(
          'id', 'note',
          'type', 'textarea',
          'asked', 'The assessor''s own written account of the visit',
          'record', 'Assessor account',
          'required', false
        )
      )
    )
  )
), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.form_definitions WHERE kind = 'assessment'
);

-- The document helper now refuses to file clinical content without provenance.
CREATE OR REPLACE FUNCTION private.care_assessment_document(_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
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

  IF _definition IS NULL THEN
    RAISE EXCEPTION 'The assessment framework has not been published yet';
  END IF;

  INSERT INTO public.care_documents (client_id, kind, form_definition_id, status, responses, authored_by_person_id)
  VALUES (_w.client_id, 'assessment', _definition, 'draft', '{}'::jsonb, _w.assessor_person_id)
  RETURNING id INTO _doc;

  UPDATE public.care_assessment_work SET document_id = _doc, updated_at = now() WHERE id = _id;
  RETURN _doc;
END;
$function$;

-- Booking a visit is administration. No clinical document is created.
CREATE OR REPLACE FUNCTION public.care_assessment_schedule(_client_id uuid, _appointment_at timestamp with time zone, _appointment_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _location_kind text DEFAULT 'home'::text, _notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
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

  PERFORM private.care_assessment_log(_id, 'scheduled',
    jsonb_build_object('appointment_at', _appointment_at, 'location_kind', _location_kind));
  PERFORM private.care_work_apply(_client_id, 'assessment_scheduled', _id);
  RETURN _id;
END;
$function$;

-- Assigning an assessor is administration too. Where a draft document already
-- exists, because the assessment was opened and then reassigned, authorship
-- follows the new assessor.
CREATE OR REPLACE FUNCTION public.care_assessment_assign(_id uuid, _assessor_person_id uuid, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _auth uuid;
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

  IF _w.document_id IS NOT NULL THEN
    UPDATE public.care_documents
       SET authored_by_person_id = _assessor_person_id, updated_at = now()
     WHERE id = _w.document_id AND status = 'draft';
  END IF;

  PERFORM private.care_assessment_log(_id, CASE WHEN _w.assessor_person_id IS NULL THEN 'assigned' ELSE 'reassigned' END,
    jsonb_build_object('from', _w.assessor_person_id, 'to', _assessor_person_id, 'reason', _reason));

  UPDATE public.care_work_items
     SET assignee_user_id = _auth, updated_at = now()
   WHERE client_id = _w.client_id AND kind = 'conduct' AND status IN ('open','blocked');

  PERFORM private.care_work_apply(_w.client_id, 'assessor_assigned', _id);
END;
$function$;

-- Opening the visit is where the clinical document begins, and only then.
CREATE OR REPLACE FUNCTION public.care_assessment_start(_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _doc uuid;
BEGIN
  IF NOT public.care_is_assigned_assessor(_id) THEN
    RAISE EXCEPTION 'Only the assigned assessor can open this assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id;
  IF _w.status = 'submitted' THEN RETURN _w.document_id; END IF;
  IF _w.status = 'cancelled' THEN RAISE EXCEPTION 'That visit has been cancelled'; END IF;

  IF _w.document_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.form_definitions WHERE kind = 'assessment' AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'The assessment framework has not been published yet';
  END IF;

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
$function$;