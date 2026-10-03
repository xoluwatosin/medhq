-- Tranche 6 lifecycle hardening.
--
-- Four things are made true here.
--   1. An assessment permanently knows which returned pre-assessment supplied
--      its carried evidence. A later pre-assessment never replaces it.
--   2. Cancelling a visit that was already opened abandons the draft clinical
--      document. Nothing is deleted and nobody's authorship is rewritten, but
--      the abandoned draft stops being the client's active lifecycle fact.
--   3. Reassignment is a clinical handover. Existing content keeps its author.
--   4. The database, not the screen, decides whether a captured field is a
--      legitimate part of this assessment.

ALTER TABLE public.care_assessment_work
  ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES public.care_documents(id);

ALTER TABLE public.care_assessment_capture_events
  ADD COLUMN IF NOT EXISTS client_seq bigint;

COMMENT ON COLUMN public.care_assessment_work.source_document_id IS
  'The exact submitted pre-assessment whose answers this assessment carries. Locked once set.';
COMMENT ON COLUMN public.care_assessment_capture_events.client_seq IS
  'Monotonic per-device sequence, so two edits to one field replay in the order they were made.';

-- Existing assessments keep reading what they have always read.
UPDATE public.care_assessment_work w
   SET source_document_id = (
         SELECT d.id FROM public.care_documents d
          WHERE d.client_id = w.client_id AND d.kind = 'pre_assessment' AND d.status = 'submitted'
          ORDER BY d.submitted_at DESC NULLS LAST LIMIT 1)
 WHERE w.source_document_id IS NULL;

-- ---------------------------------------------------------------- eligibility
-- Somebody may only be offered, or assigned, if they can actually sign in and
-- carry the visit out: an active Clinical Assessor capability, an active
-- workforce record, and a usable account.
CREATE OR REPLACE FUNCTION public.care_assessor_eligible(_person_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.mu_people p
      JOIN public.mu_capabilities c
        ON c.person_id = p.id AND c.capability = 'assessor' AND c.revoked_at IS NULL
     WHERE p.id = _person_id
       AND p.auth_user_id IS NOT NULL
       AND p.staff_status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.care_assessor_options()
 RETURNS TABLE(person_id uuid, full_name text, profession text, has_account boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT p.id, p.full_name, p.profession, true
    FROM public.mu_people p
   WHERE private.has_role(auth.uid(), 'admin'::app_role)
     AND public.care_assessor_eligible(p.id)
   ORDER BY p.full_name;
$function$;

-- --------------------------------------------------------- scheduling & source
CREATE OR REPLACE FUNCTION public.care_assessment_schedule(_client_id uuid, _appointment_at timestamp with time zone, _appointment_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _location_kind text DEFAULT 'home'::text, _notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _id uuid;
  _source uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to arrange an assessment';
  END IF;
  IF _appointment_at IS NULL THEN RAISE EXCEPTION 'An appointment time is required'; END IF;

  SELECT d.id INTO _source FROM public.care_documents d
   WHERE d.client_id = _client_id AND d.kind = 'pre_assessment' AND d.status = 'submitted'
   ORDER BY d.submitted_at DESC NULLS LAST LIMIT 1;
  IF _source IS NULL THEN RAISE EXCEPTION 'The pre-assessment has not come back yet'; END IF;

  SELECT id INTO _id FROM public.care_assessment_work
   WHERE client_id = _client_id AND status IN ('requested','scheduled','in_progress');

  IF _id IS NULL THEN
    INSERT INTO public.care_assessment_work
      (client_id, status, appointment_at, appointment_ends_at, location_kind, notes, requested_by, source_document_id)
    VALUES (_client_id, 'scheduled', _appointment_at, _appointment_ends_at,
            COALESCE(_location_kind, 'home'), _notes, auth.uid(), _source)
    RETURNING id INTO _id;
  ELSE
    UPDATE public.care_assessment_work
       SET status = CASE WHEN status = 'in_progress' THEN status ELSE 'scheduled' END,
           appointment_at = _appointment_at,
           appointment_ends_at = _appointment_ends_at,
           location_kind = COALESCE(_location_kind, location_kind),
           notes = COALESCE(_notes, notes),
           -- Locked. A newer pre-assessment never rewrites the evidence an
           -- assessment already carries.
           source_document_id = COALESCE(source_document_id, _source),
           updated_at = now()
     WHERE id = _id;
  END IF;

  PERFORM private.care_assessment_log(_id, 'scheduled',
    jsonb_build_object('appointment_at', _appointment_at, 'location_kind', _location_kind));
  PERFORM private.care_work_apply(_client_id, 'assessment_scheduled', _id);
  RETURN _id;
END;
$function$;

-- Moving a visit may change the time, the place and the assessor's notes. The
-- audit reason is its own field and is never confused with those notes.
CREATE OR REPLACE FUNCTION public.care_assessment_reschedule(_id uuid, _appointment_at timestamp with time zone, _appointment_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _reason text DEFAULT NULL::text, _location_kind text DEFAULT NULL::text, _notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _w public.care_assessment_work%ROWTYPE;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to change an assessment';
  END IF;
  IF _appointment_at IS NULL THEN RAISE EXCEPTION 'An appointment time is required'; END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment not found'; END IF;
  IF _w.status IN ('submitted','cancelled') THEN
    RAISE EXCEPTION 'That assessment can no longer be moved';
  END IF;

  UPDATE public.care_assessment_work
     SET appointment_at = _appointment_at,
         appointment_ends_at = _appointment_ends_at,
         location_kind = COALESCE(NULLIF(btrim(COALESCE(_location_kind, '')), ''), location_kind),
         notes = CASE WHEN _notes IS NULL THEN notes ELSE NULLIF(btrim(_notes), '') END,
         updated_at = now()
   WHERE id = _id;

  PERFORM private.care_assessment_log(_id, 'rescheduled', jsonb_build_object(
    'from', _w.appointment_at, 'to', _appointment_at, 'reason', _reason,
    'location_kind', COALESCE(_location_kind, _w.location_kind),
    'notes_changed', (_notes IS NOT NULL AND COALESCE(NULLIF(btrim(_notes), ''), '') IS DISTINCT FROM COALESCE(_w.notes, ''))));
  PERFORM private.care_work_apply(_w.client_id, 'assessment_scheduled', _id);
END;
$function$;

-- ----------------------------------------------------------------- assignment
-- Reassignment is a handover. The new assessor takes the visit on; what the
-- previous assessor already wrote keeps their name on it. Capture events carry
-- their own author, and document authorship is only set when the document is
-- created, never rewritten to suit a later assignment.
CREATE OR REPLACE FUNCTION public.care_assessment_assign(_id uuid, _assessor_person_id uuid, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _auth uuid;
  _handover boolean;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to assign an assessor';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment not found'; END IF;
  IF _w.status IN ('submitted','cancelled') THEN
    RAISE EXCEPTION 'That assessment can no longer be reassigned';
  END IF;
  IF NOT public.care_assessor_eligible(_assessor_person_id) THEN
    RAISE EXCEPTION 'That person is not an active Clinical Assessor with a usable account';
  END IF;
  IF _w.assessor_person_id = _assessor_person_id THEN RETURN; END IF;

  _handover := _w.document_id IS NOT NULL;
  IF _handover AND COALESCE(btrim(COALESCE(_reason, '')), '') = '' THEN
    RAISE EXCEPTION 'This assessment has been opened. Give a reason for the handover.';
  END IF;

  SELECT auth_user_id INTO _auth FROM public.mu_people WHERE id = _assessor_person_id;

  UPDATE public.care_assessment_work
     SET assessor_person_id = _assessor_person_id,
         assigned_at = now(),
         assigned_by = auth.uid(),
         updated_at = now()
   WHERE id = _id;

  PERFORM private.care_assessment_log(_id,
    CASE WHEN _w.assessor_person_id IS NULL THEN 'assigned' ELSE 'reassigned' END,
    jsonb_build_object('from', _w.assessor_person_id, 'to', _assessor_person_id,
                       'reason', _reason, 'handover', _handover,
                       'document_id', _w.document_id));

  UPDATE public.care_work_items
     SET assignee_user_id = _auth, updated_at = now()
   WHERE client_id = _w.client_id AND kind = 'conduct' AND status IN ('open','blocked');

  PERFORM private.care_work_apply(_w.client_id, 'assessor_assigned', _id);
END;
$function$;

-- --------------------------------------------------------------- cancellation
CREATE OR REPLACE FUNCTION public.care_assessment_cancel(_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
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

  -- Whatever the assessor wrote stays exactly as written, under their name.
  -- It simply stops being the live clinical fact about this client.
  IF _w.document_id IS NOT NULL THEN
    UPDATE public.care_documents
       SET status = 'abandoned', reissue_reason = _reason, updated_at = now()
     WHERE id = _w.document_id AND status = 'draft';
  END IF;

  PERFORM private.care_assessment_log(_id, 'cancelled',
    jsonb_build_object('reason', _reason, 'document_id', _w.document_id));
  PERFORM private.care_work_apply(_w.client_id, 'assessment_cancelled', _id);
END;
$function$;

-- A draft assessment only means "assessment in progress" while the visit it
-- belongs to is still live.
CREATE OR REPLACE FUNCTION public.care_derive_stage(_client_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
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
              JOIN public.care_assessment_work w ON w.document_id = d.id
              WHERE d.client_id = _client_id AND d.kind = 'assessment' AND d.status = 'draft'
                AND w.status IN ('requested','scheduled','in_progress'))
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
$function$;

-- ---------------------------------------------------------------------- brief
-- The brief reads the linked source pre-assessment, not simply the newest one.
CREATE OR REPLACE FUNCTION public.care_assessment_brief(_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
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

  SELECT d.responses, f.definition INTO _pre, _definition
    FROM public.care_documents d
    JOIN public.form_definitions f ON f.id = d.form_definition_id
   WHERE d.id = _w.source_document_id;

  SELECT responses INTO _draft FROM public.care_documents WHERE id = _w.document_id;

  RETURN jsonb_build_object(
    'assessment', to_jsonb(_w),
    'source_document_id', _w.source_document_id,
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
$function$;

-- ------------------------------------------------------------------- capture
-- The screen is not the guard. Every incoming field has to be a real part of
-- this assessment: a decision about an answer the family actually gave, or an
-- account of a section that actually exists.
CREATE OR REPLACE FUNCTION public.care_assessment_capture(_id uuid, _events jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _event jsonb;
  _accepted text[] := ARRAY[]::text[];
  _responses jsonb;
  _rows integer;
  _src_answers jsonb;
  _src_def jsonb;
  _field text;
  _key text;
  _value jsonb;
  _decision text;
  _fielddef jsonb;
BEGIN
  IF NOT public.care_is_assigned_assessor(_id) THEN
    RAISE EXCEPTION 'Only the assigned assessor can record this assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id;
  IF _w.status = 'submitted' THEN RAISE EXCEPTION 'This assessment has already been sent'; END IF;
  IF _w.status = 'cancelled' THEN RAISE EXCEPTION 'That visit has been cancelled'; END IF;
  IF _w.document_id IS NULL THEN RAISE EXCEPTION 'This assessment has not been opened yet'; END IF;
  IF jsonb_typeof(_events) <> 'array' THEN RAISE EXCEPTION 'Nothing to record'; END IF;

  SELECT d.responses, f.definition INTO _src_answers, _src_def
    FROM public.care_documents d
    JOIN public.form_definitions f ON f.id = d.form_definition_id
   WHERE d.id = _w.source_document_id;
  IF _src_def IS NULL THEN
    RAISE EXCEPTION 'This assessment is not linked to a returned pre-assessment';
  END IF;

  SELECT responses INTO _responses FROM public.care_documents WHERE id = _w.document_id FOR UPDATE;

  FOR _event IN
    SELECT e FROM jsonb_array_elements(_events) e
     ORDER BY COALESCE((e ->> 'client_seq')::bigint, 0),
              COALESCE((e ->> 'captured_at')::timestamptz, now())
  LOOP
    _field := COALESCE(_event ->> 'field_id', '');
    _value := _event -> 'value';
    IF COALESCE(_event ->> 'client_event_id', '') = '' OR _field = '' THEN
      RAISE EXCEPTION 'That answer could not be recorded';
    END IF;

    IF _field LIKE 'confirm.%' THEN
      _key := substr(_field, 9);
      SELECT fl INTO _fielddef
        FROM jsonb_array_elements(_src_def -> 'sections') s,
             jsonb_array_elements(s -> 'fields') fl
       WHERE fl ->> 'id' = _key
       LIMIT 1;
      IF _fielddef IS NULL OR COALESCE(_src_answers ->> _key, '') = '' THEN
        RAISE EXCEPTION 'That answer is not part of this assessment';
      END IF;
      IF jsonb_typeof(_value) <> 'object' THEN
        RAISE EXCEPTION 'That answer could not be recorded';
      END IF;
      _decision := _value ->> 'decision';
      IF _decision NOT IN ('confirmed','amended') THEN
        RAISE EXCEPTION 'That answer could not be recorded';
      END IF;
      IF _decision = 'amended' THEN
        IF jsonb_typeof(_value -> 'value') <> 'string' OR length(_value ->> 'value') > 4000 THEN
          RAISE EXCEPTION 'Say what is different, in words';
        END IF;
        -- A controlled answer stays controlled when it is amended.
        IF (_fielddef ->> 'type') = 'choice'
           AND jsonb_typeof(_fielddef -> 'options') = 'array'
           AND COALESCE(_value ->> 'value', '') <> ''
           AND NOT EXISTS (
             SELECT 1 FROM jsonb_array_elements(_fielddef -> 'options') o
              WHERE o ->> 'value' = _value ->> 'value' OR o ->> 'label' = _value ->> 'value')
        THEN
          RAISE EXCEPTION 'Choose one of the recorded options';
        END IF;
      END IF;

    ELSIF _field LIKE 'note.%' THEN
      _key := substr(_field, 6);
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(_src_def -> 'sections') s WHERE s ->> 'id' = _key)
      THEN
        RAISE EXCEPTION 'That part of the visit is not part of this assessment';
      END IF;
      IF _value IS NOT NULL AND jsonb_typeof(_value) NOT IN ('string','null') THEN
        RAISE EXCEPTION 'That answer could not be recorded';
      END IF;
      IF jsonb_typeof(_value) = 'string' AND length(_value #>> '{}') > 20000 THEN
        RAISE EXCEPTION 'That account is too long';
      END IF;

    ELSE
      RAISE EXCEPTION 'That answer is not part of this assessment';
    END IF;

    INSERT INTO public.care_assessment_capture_events
      (assessment_id, client_event_id, field_id, value, captured_at, author_person_id, client_seq)
    VALUES (
      _id,
      _event ->> 'client_event_id',
      _field,
      _value,
      COALESCE((_event ->> 'captured_at')::timestamptz, now()),
      _w.assessor_person_id,
      NULLIF(_event ->> 'client_seq', '')::bigint
    )
    ON CONFLICT (assessment_id, client_event_id) DO NOTHING;
    GET DIAGNOSTICS _rows = ROW_COUNT;
    IF _rows > 0 THEN
      _responses := COALESCE(_responses, '{}'::jsonb) || jsonb_build_object(_field, _value);
    END IF;
    _accepted := _accepted || (_event ->> 'client_event_id');
  END LOOP;

  UPDATE public.care_documents
     SET responses = _responses, updated_at = now()
   WHERE id = _w.document_id;

  UPDATE public.care_assessment_work SET updated_at = now() WHERE id = _id;
  RETURN jsonb_build_object('ok', true, 'accepted', to_jsonb(_accepted), 'document_id', _w.document_id);
END;
$function$;

-- -------------------------------------------------- domain-managed work items
-- Booking, assignment and the visit itself are facts about the assessment.
-- They are changed by changing the assessment, never by editing the task.
CREATE OR REPLACE FUNCTION public.care_work_domain_managed(_kind text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT _kind IN ('book','assign','conduct');
$function$;

CREATE OR REPLACE FUNCTION public.care_work_set(_id uuid, _assignee_user_id uuid DEFAULT NULL::uuid, _team text DEFAULT NULL::text, _due_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _kind text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to change work';
  END IF;
  SELECT kind INTO _kind FROM public.care_work_items WHERE id = _id;
  IF public.care_work_domain_managed(_kind) THEN
    RAISE EXCEPTION 'This task follows the assessment. Change the assessment instead.';
  END IF;
  UPDATE public.care_work_items
     SET assignee_user_id = COALESCE(_assignee_user_id, assignee_user_id),
         team = COALESCE(NULLIF(btrim(COALESCE(_team, '')), ''), team),
         due_at = COALESCE(_due_at, due_at)
   WHERE id = _id AND status IN ('open','blocked');
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_work_complete(_id uuid, _outcome text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _row public.care_work_items%ROWTYPE;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to complete work';
  END IF;
  SELECT * INTO _row FROM public.care_work_items WHERE id = _id;
  IF public.care_work_domain_managed(_row.kind) THEN
    RAISE EXCEPTION 'This task follows the assessment. Change the assessment instead.';
  END IF;
  UPDATE public.care_work_items
     SET status = 'completed', outcome = NULLIF(btrim(COALESCE(_outcome, '')), ''),
         completed_at = now(), completed_by = auth.uid()
   WHERE id = _id AND status IN ('open','blocked')
   RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'That work is already finished'; END IF;

  UPDATE public.care_work_items SET status = 'open'
   WHERE blocked_by = _id AND status = 'blocked';

  IF _row.kind = 'callback' AND COALESCE(_outcome, '') = 'proceeding' THEN
    PERFORM private.care_work_add(
      _row.client_id, 'send_pre_assessment', 'Send the pre-assessment link', 'proceeding',
      'The family answers a few questions before the visit.', 'high', false,
      public.care_working_due(now(), 1), 'care', NULL, 'callback_completed');
  END IF;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_row.client_id, 'work_completed',
          jsonb_build_object('work_id', _id, 'kind', _row.kind, 'outcome', _outcome), auth.uid());

  PERFORM public.care_refresh_stage(_row.client_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_work_cancel(_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _row public.care_work_items%ROWTYPE;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to cancel work';
  END IF;
  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Say why this work is being cancelled';
  END IF;
  SELECT * INTO _row FROM public.care_work_items WHERE id = _id;
  IF public.care_work_domain_managed(_row.kind) THEN
    RAISE EXCEPTION 'This task follows the assessment. Cancel the assessment instead.';
  END IF;
  UPDATE public.care_work_items
     SET status = 'cancelled', cancel_reason = btrim(_reason),
         cancelled_at = now(), cancelled_by = auth.uid()
   WHERE id = _id AND status IN ('open','blocked')
   RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'That work is already finished'; END IF;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_row.client_id, 'work_cancelled',
          jsonb_build_object('work_id', _id, 'kind', _row.kind, 'reason', _reason), auth.uid());
  PERFORM public.care_refresh_stage(_row.client_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_work_reopen(_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _row public.care_work_items%ROWTYPE;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to reopen work';
  END IF;
  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Say why this work is being reopened';
  END IF;
  SELECT * INTO _row FROM public.care_work_items WHERE id = _id;
  IF public.care_work_domain_managed(_row.kind) THEN
    RAISE EXCEPTION 'This task follows the assessment. Change the assessment instead.';
  END IF;
  UPDATE public.care_work_items
     SET status = 'open', reopen_reason = btrim(_reason)
   WHERE id = _id AND status IN ('completed','cancelled')
   RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'That work is already open'; END IF;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_row.client_id, 'work_reopened',
          jsonb_build_object('work_id', _id, 'kind', _row.kind, 'reason', _reason), auth.uid());
  PERFORM public.care_refresh_stage(_row.client_id);
END;
$function$;

-- ------------------------------------------------- Clinical Assessor capability
-- Granting and revoking from the Workforce record. Audited both ways.
CREATE OR REPLACE FUNCTION public.care_assessor_capability_set(_person_id uuid, _active boolean, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to change capabilities';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mu_people WHERE id = _person_id) THEN
    RAISE EXCEPTION 'That person is not on the workforce';
  END IF;

  IF _active THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.mu_capabilities
       WHERE person_id = _person_id AND capability = 'assessor' AND revoked_at IS NULL)
    THEN
      INSERT INTO public.mu_capabilities (person_id, capability, granted_by, granted_at, reason)
      VALUES (_person_id, 'assessor', auth.uid(), now(), NULLIF(btrim(COALESCE(_reason, '')), ''));
    END IF;
  ELSE
    UPDATE public.mu_capabilities
       SET revoked_at = now(), revoked_by = auth.uid(),
           reason = COALESCE(NULLIF(btrim(COALESCE(_reason, '')), ''), reason)
     WHERE person_id = _person_id AND capability = 'assessor' AND revoked_at IS NULL;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_assessor_capability(_person_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT jsonb_build_object(
    'active', EXISTS (
      SELECT 1 FROM public.mu_capabilities
       WHERE person_id = _person_id AND capability = 'assessor' AND revoked_at IS NULL),
    'eligible', public.care_assessor_eligible(_person_id),
    'has_account', EXISTS (
      SELECT 1 FROM public.mu_people WHERE id = _person_id AND auth_user_id IS NOT NULL),
    'staff_active', EXISTS (
      SELECT 1 FROM public.mu_people WHERE id = _person_id AND staff_status = 'active')
  )
  WHERE private.has_role(auth.uid(), 'admin'::app_role);
$function$;