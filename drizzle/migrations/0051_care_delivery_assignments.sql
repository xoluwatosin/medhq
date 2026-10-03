-- Pass 7.5C: delivery assignment on the episode, and the legacy care_assignments
-- table put beyond use before it ever holds a record. Assessor assignment stays
-- on care_assessment_work.assessor_person_id. An assignment is a duty to deliver
-- care; it is never portal access, never work-item ownership, never a grant.

CREATE TABLE public.care_delivery_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.care_episodes(id) ON DELETE RESTRICT,
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE RESTRICT,
  capability_code text NOT NULL,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','active','ended','cancelled')),
  effective_from date NOT NULL,
  effective_to date,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid,
  ended_at timestamptz,
  ended_by uuid,
  end_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_delivery_assignments_episode_idx
  ON public.care_delivery_assignments(episode_id, status);
CREATE INDEX care_delivery_assignments_person_idx
  ON public.care_delivery_assignments(person_id, status);

GRANT SELECT ON public.care_delivery_assignments TO authenticated;
GRANT ALL ON public.care_delivery_assignments TO service_role;
ALTER TABLE public.care_delivery_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read delivery assignments" ON public.care_delivery_assignments
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

COMMENT ON TABLE public.care_delivery_assignments IS
  'Who delivers this episode, under which capability, for what period. Not assessor assignment, not work-item ownership, not portal access. The package relationship is added in Tranche 8.';

-- The capability vocabulary is the one that already exists on mu_capabilities.
CREATE OR REPLACE FUNCTION private.care_delivery_capability_ok(_code text)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public','private' AS $$
  SELECT _code IN ('care_worker')
$$;

CREATE OR REPLACE FUNCTION public.care_assignment_plan(
  _episode_id uuid, _person_id uuid, _capability_code text,
  _effective_from date DEFAULT NULL, _effective_to date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _e public.care_episodes%ROWTYPE; _id uuid;
BEGIN
  IF NOT private.care_ops_ok() THEN
    RAISE EXCEPTION 'You do not have permission to assign care';
  END IF;

  SELECT * INTO _e FROM public.care_episodes WHERE id = _episode_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That care episode could not be found'; END IF;
  IF _e.status NOT IN ('planned','active','paused') THEN
    RAISE EXCEPTION 'A % care episode cannot take a new assignment', _e.status;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.mu_people WHERE id = _person_id) THEN
    RAISE EXCEPTION 'That person could not be found';
  END IF;
  IF NOT private.care_delivery_capability_ok(_capability_code) THEN
    RAISE EXCEPTION 'That is not a care delivery capability';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mu_capabilities
                  WHERE person_id = _person_id AND capability = _capability_code
                    AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'That person does not hold the capability for this assignment';
  END IF;

  INSERT INTO public.care_delivery_assignments
    (episode_id, person_id, capability_code, status, effective_from, effective_to, assigned_by)
  VALUES (_episode_id, _person_id, _capability_code, 'planned',
          COALESCE(_effective_from, current_date), _effective_to, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_assignment_activate(_assignment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _a public.care_delivery_assignments%ROWTYPE;
BEGIN
  IF NOT private.care_ops_ok() THEN
    RAISE EXCEPTION 'You do not have permission to assign care';
  END IF;
  SELECT * INTO _a FROM public.care_delivery_assignments WHERE id = _assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assignment could not be found'; END IF;
  IF _a.status = 'active' THEN RETURN; END IF;
  IF _a.status <> 'planned' THEN
    RAISE EXCEPTION 'A % assignment cannot be started', _a.status;
  END IF;
  UPDATE public.care_delivery_assignments SET status = 'active' WHERE id = _assignment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_assignment_end(
  _assignment_id uuid, _reason text, _effective_to date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _a public.care_delivery_assignments%ROWTYPE;
BEGIN
  IF NOT private.care_ops_ok() THEN
    RAISE EXCEPTION 'You do not have permission to change an assignment';
  END IF;
  IF COALESCE(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'Ending an assignment needs a reason';
  END IF;
  SELECT * INTO _a FROM public.care_delivery_assignments WHERE id = _assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assignment could not be found'; END IF;
  IF _a.status <> 'active' THEN
    RAISE EXCEPTION 'Only an active assignment can be ended';
  END IF;

  UPDATE public.care_delivery_assignments
     SET status = 'ended', ended_at = now(), ended_by = auth.uid(),
         end_reason = _reason,
         effective_to = COALESCE(_effective_to, effective_to, current_date)
   WHERE id = _assignment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_assignment_cancel(_assignment_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _a public.care_delivery_assignments%ROWTYPE;
BEGIN
  IF NOT private.care_ops_ok() THEN
    RAISE EXCEPTION 'You do not have permission to change an assignment';
  END IF;
  IF COALESCE(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'Cancelling an assignment needs a reason';
  END IF;
  SELECT * INTO _a FROM public.care_delivery_assignments WHERE id = _assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assignment could not be found'; END IF;
  IF _a.status <> 'planned' THEN
    RAISE EXCEPTION 'Only a planned assignment can be cancelled';
  END IF;

  UPDATE public.care_delivery_assignments
     SET status = 'cancelled', ended_at = now(), ended_by = auth.uid(), end_reason = _reason
   WHERE id = _assignment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_assignment_plan(uuid, uuid, text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_assignment_activate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_assignment_end(uuid, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_assignment_cancel(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION private.care_delivery_capability_ok(text) FROM public;

-- --------------------------------------------------- lifecycle on the new table
-- Same stage behaviour as before; staffing now comes from a live delivery
-- assignment on a live episode. Ended, cancelled and assessor work never count.
CREATE OR REPLACE FUNCTION public.care_derive_stage(_client_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE _c public.clients%ROWTYPE;
BEGIN
  SELECT * INTO _c FROM public.clients WHERE id = _client_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF _c.closed_at IS NOT NULL THEN RETURN 'closed'; END IF;
  IF _c.paused_at IS NOT NULL THEN RETURN 'paused'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_delivery_assignments a
               JOIN public.care_episodes e ON e.id = a.episode_id
              WHERE e.client_id = _client_id
                AND e.status IN ('planned','active')
                AND a.status IN ('planned','active')
                AND a.effective_from <= current_date
                AND (a.effective_to IS NULL OR a.effective_to >= current_date))
  THEN RETURN 'care_running'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_documents d
              WHERE d.client_id = _client_id AND d.kind = 'care_plan' AND d.status = 'submitted')
  THEN RETURN 'care_setup'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_documents d
              WHERE d.client_id = _client_id AND d.kind = 'care_plan' AND d.status = 'draft')
  THEN RETURN 'care_plan_preparation'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_assessment_work w
              WHERE w.client_id = _client_id AND w.status = 'submitted'
                AND w.review_decision IS NULL)
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
$$;

CREATE OR REPLACE FUNCTION public.mu_workforce_blockers(_person_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _assignments integer;
  _assessments integer;
  _contracts integer;
BEGIN
  SELECT count(*) INTO _assignments
    FROM public.care_delivery_assignments a
   WHERE a.person_id = _person_id
     AND a.status IN ('planned','active')
     AND (a.effective_to IS NULL OR a.effective_to >= current_date);

  SELECT public.care_assessor_live_assessments(_person_id) INTO _assessments;

  SELECT count(*) INTO _contracts
    FROM public.mu_contracts c
   WHERE c.person_id = _person_id
     AND c.status IN ('issued', 'signed', 'active')
     AND c.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'assignments', COALESCE(_assignments, 0),
    'assessments', COALESCE(_assessments, 0),
    'contracts', COALESCE(_contracts, 0)
  );
END;
$$;

-- ------------------------------------------------------------- legacy table
REVOKE INSERT, UPDATE, DELETE ON public.care_assignments FROM authenticated;
DROP POLICY IF EXISTS "Admins manage care assignments" ON public.care_assignments;
DROP POLICY IF EXISTS "Admins read care assignments" ON public.care_assignments;
CREATE POLICY "Admins read care assignments" ON public.care_assignments
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

COMMENT ON TABLE public.care_assignments IS
  'Deprecated in Pass 7.5C and never used in production. Superseded by care_delivery_assignments; read only, and dropped once the rewritten lifecycle functions are proven.';