-- Assessment scheduling, assessor assignment and offline capture.
--
-- Workflow lives here. Clinical content stays in care_documents. The two never
-- mix: rescheduling a visit does not touch what an assessor wrote.

CREATE TABLE IF NOT EXISTS public.mu_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  capability text NOT NULL CHECK (capability IN ('assessor','care_worker')),
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid,
  reason text
);
CREATE UNIQUE INDEX IF NOT EXISTS mu_capabilities_live_idx
  ON public.mu_capabilities (person_id, capability) WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.mu_capabilities TO authenticated;
GRANT ALL ON public.mu_capabilities TO service_role;
ALTER TABLE public.mu_capabilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage capabilities" ON public.mu_capabilities;
CREATE POLICY "Admins manage capabilities" ON public.mu_capabilities
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.mu_has_capability(_person_id uuid, _capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mu_capabilities
     WHERE person_id = _person_id AND capability = _capability AND revoked_at IS NULL
  );
$$;
GRANT EXECUTE ON FUNCTION public.mu_has_capability(uuid, text) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.care_assessment_work (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','scheduled','in_progress','submitted','cancelled')),
  appointment_at timestamptz,
  appointment_ends_at timestamptz,
  location_kind text NOT NULL DEFAULT 'home' CHECK (location_kind IN ('home','clinic','virtual')),
  notes text,
  assessor_person_id uuid REFERENCES public.mu_people(id) ON DELETE RESTRICT,
  assigned_at timestamptz,
  assigned_by uuid,
  document_id uuid REFERENCES public.care_documents(id) ON DELETE SET NULL,
  requested_by uuid,
  started_at timestamptz,
  submitted_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS care_assessment_work_live_idx
  ON public.care_assessment_work (client_id)
  WHERE status IN ('requested','scheduled','in_progress');
CREATE INDEX IF NOT EXISTS care_assessment_work_assessor_idx
  ON public.care_assessment_work (assessor_person_id) WHERE status <> 'cancelled';

CREATE TABLE IF NOT EXISTS public.care_assessment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.care_assessment_work(id) ON DELETE CASCADE,
  event text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_assessment_events_idx
  ON public.care_assessment_events (assessment_id, created_at DESC);

-- Append-only capture, keyed by an identifier the device generated, so the
-- same answer arriving twice is stored once.
CREATE TABLE IF NOT EXISTS public.care_assessment_capture_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.care_assessment_work(id) ON DELETE CASCADE,
  client_event_id text NOT NULL,
  field_id text NOT NULL,
  value jsonb,
  captured_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz NOT NULL DEFAULT now(),
  author_person_id uuid REFERENCES public.mu_people(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS care_assessment_capture_once_idx
  ON public.care_assessment_capture_events (assessment_id, client_event_id);

GRANT SELECT ON public.care_assessment_work TO authenticated;
GRANT SELECT ON public.care_assessment_events TO authenticated;
GRANT SELECT ON public.care_assessment_capture_events TO authenticated;
GRANT ALL ON public.care_assessment_work TO service_role;
GRANT ALL ON public.care_assessment_events TO service_role;
GRANT ALL ON public.care_assessment_capture_events TO service_role;

ALTER TABLE public.care_assessment_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_assessment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_assessment_capture_events ENABLE ROW LEVEL SECURITY;

-- True where the signed-in person is the assessor currently assigned.
CREATE OR REPLACE FUNCTION public.care_is_assigned_assessor(_assessment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.care_assessment_work w
      JOIN public.mu_people p ON p.id = w.assessor_person_id
     WHERE w.id = _assessment_id
       AND p.auth_user_id = auth.uid()
       AND w.status IN ('scheduled','in_progress','submitted')
  );
$$;
GRANT EXECUTE ON FUNCTION public.care_is_assigned_assessor(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins read assessment work" ON public.care_assessment_work;
CREATE POLICY "Admins read assessment work" ON public.care_assessment_work
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Assessors read their own assessment" ON public.care_assessment_work;
CREATE POLICY "Assessors read their own assessment" ON public.care_assessment_work
  FOR SELECT TO authenticated USING (public.care_is_assigned_assessor(id));

DROP POLICY IF EXISTS "Admins read assessment history" ON public.care_assessment_events;
CREATE POLICY "Admins read assessment history" ON public.care_assessment_events
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins read capture" ON public.care_assessment_capture_events;
CREATE POLICY "Admins read capture" ON public.care_assessment_capture_events
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Assessors read their own capture" ON public.care_assessment_capture_events;
CREATE POLICY "Assessors read their own capture" ON public.care_assessment_capture_events
  FOR SELECT TO authenticated USING (public.care_is_assigned_assessor(assessment_id));

-- The assessment document itself, readable by the assessor writing it.
DROP POLICY IF EXISTS "Assessors read their assessment document" ON public.care_documents;
CREATE POLICY "Assessors read their assessment document" ON public.care_documents
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.care_assessment_work w
       WHERE w.document_id = public.care_documents.id
         AND public.care_is_assigned_assessor(w.id)
    )
  );

CREATE OR REPLACE FUNCTION private.care_assessment_log(_id uuid, _event text, _detail jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
  INSERT INTO public.care_assessment_events (assessment_id, event, detail, actor_id)
  VALUES (_id, _event, COALESCE(_detail, '{}'::jsonb), auth.uid());
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

  PERFORM private.care_assessment_log(_id, 'scheduled',
    jsonb_build_object('appointment_at', _appointment_at, 'location_kind', _location_kind));
  PERFORM public.care_work_event(_client_id, 'assessment_scheduled', _id);
  RETURN _id;
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
  PERFORM public.care_work_event(_w.client_id, 'assessment_scheduled', _id);
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
  PERFORM public.care_work_event(_w.client_id, 'assessment_cancelled', _id);
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

  PERFORM private.care_assessment_log(_id, CASE WHEN _w.assessor_person_id IS NULL THEN 'assigned' ELSE 'reassigned' END,
    jsonb_build_object('from', _w.assessor_person_id, 'to', _assessor_person_id, 'reason', _reason));

  UPDATE public.care_work_items
     SET assignee_user_id = _auth, updated_at = now()
   WHERE client_id = _w.client_id AND kind = 'conduct' AND status IN ('open','blocked');

  PERFORM public.care_work_event(_w.client_id, 'assessor_assigned', _id);
END;
$$;

-- The assessor's own actions. Nobody else may author, whatever their role.
CREATE OR REPLACE FUNCTION public.care_assessment_start(_id uuid)
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
  IF NOT public.care_is_assigned_assessor(_id) THEN
    RAISE EXCEPTION 'Only the assigned assessor can open this assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id;
  IF _w.status = 'submitted' THEN RETURN _w.document_id; END IF;

  IF _w.document_id IS NOT NULL THEN
    UPDATE public.care_assessment_work
       SET status = 'in_progress', started_at = COALESCE(started_at, now()), updated_at = now()
     WHERE id = _id;
    RETURN _w.document_id;
  END IF;

  SELECT id INTO _definition FROM public.form_definitions
   WHERE kind = 'assessment' AND status = 'published'
   ORDER BY version DESC LIMIT 1;

  INSERT INTO public.care_documents (client_id, kind, form_definition_id, status, responses, authored_by_person_id)
  VALUES (_w.client_id, 'assessment', _definition, 'draft', '{}'::jsonb, _w.assessor_person_id)
  RETURNING id INTO _doc;

  UPDATE public.care_assessment_work
     SET document_id = _doc, status = 'in_progress', started_at = COALESCE(started_at, now()), updated_at = now()
   WHERE id = _id;

  PERFORM private.care_assessment_log(_id, 'started', jsonb_build_object('document_id', _doc));
  PERFORM public.care_work_event(_w.client_id, 'assessment_started', _id);
  RETURN _doc;
END;
$$;

-- Offline capture arriving in a batch. Each event carries the identifier the
-- device gave it, so a replayed queue changes nothing.
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
  _inserted boolean;
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
    _inserted := false;
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
    GET DIAGNOSTICS _inserted = ROW_COUNT;
    IF _inserted THEN
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
  PERFORM public.care_work_event(_w.client_id, 'assessment_submitted', _id);
  RETURN jsonb_build_object('ok', true, 'document_id', _w.document_id);
END;
$$;

REVOKE ALL ON FUNCTION public.care_assessment_schedule(uuid, timestamptz, timestamptz, text, text) FROM public;
REVOKE ALL ON FUNCTION public.care_assessment_reschedule(uuid, timestamptz, timestamptz, text) FROM public;
REVOKE ALL ON FUNCTION public.care_assessment_cancel(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.care_assessment_assign(uuid, uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.care_assessment_start(uuid) FROM public;
REVOKE ALL ON FUNCTION public.care_assessment_capture(uuid, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.care_assessment_submit(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.care_assessment_schedule(uuid, timestamptz, timestamptz, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_assessment_reschedule(uuid, timestamptz, timestamptz, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_assessment_cancel(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_assessment_assign(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_assessment_start(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_assessment_capture(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_assessment_submit(uuid) TO authenticated, service_role;