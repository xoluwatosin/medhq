-- Care routes, holds with an end date, and locum assessors.
--
-- 1. A hold can carry an end date; when it passes, the client comes off hold
--    by itself. Holding and ending care also wrote to a column that does not
--    exist (care_activity.actor), so both failed; the activity now goes to
--    actor_id.
-- 2. Each client takes a route into care: standard (a care needs assessment at
--    home first), urgent start, one-off, or staffing only. A service can make
--    the home assessment required; otherwise staff are asked. Before care
--    starts on any route, a short set of preliminary information is recorded.
-- 3. An assessor no longer has to be Workforce staff: anyone with a sign-in who
--    holds the assessor capability can be assigned, so verified locums from the
--    candidate pool can assess. What each assessor is paid is recorded per
--    assessment, and payment can be marked only once the assessment is
--    accepted. A clinical reviewer who carried out the assessment can accept it
--    without the review checklist.

-- 1. Holds ------------------------------------------------------------------

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS paused_until timestamptz;

CREATE OR REPLACE FUNCTION public.care_client_lifecycle(_client_id uuid, _action text, _reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _c public.clients%ROWTYPE;
BEGIN
  PERFORM private.care_group_admin_guard();
  SELECT * INTO _c FROM public.clients WHERE id = _client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Care record not found'; END IF;

  IF _action = 'hold' THEN
    IF COALESCE(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'Record why this client is on hold'; END IF;
    UPDATE public.clients SET paused_at = now(), paused_reason = btrim(_reason), paused_until = NULL,
           updated_at = now()
     WHERE id = _client_id;
  ELSIF _action = 'resume' THEN
    UPDATE public.clients SET paused_at = NULL, paused_reason = NULL, paused_until = NULL, updated_at = now()
     WHERE id = _client_id;
  ELSIF _action = 'close' THEN
    IF COALESCE(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'Record why care has ended'; END IF;
    UPDATE public.clients SET closed_at = now(), closed_reason = btrim(_reason), updated_at = now()
     WHERE id = _client_id;
  ELSIF _action = 'reopen' THEN
    UPDATE public.clients SET closed_at = NULL, closed_reason = NULL, archived_at = NULL,
           archived_by = NULL, updated_at = now()
     WHERE id = _client_id;
  ELSIF _action = 'archive' THEN
    IF _c.closed_at IS NULL THEN RAISE EXCEPTION 'End care before archiving this file'; END IF;
    UPDATE public.clients SET archived_at = now(), archived_by = auth.uid(), updated_at = now()
     WHERE id = _client_id;
  ELSIF _action = 'restore' THEN
    UPDATE public.clients SET archived_at = NULL, archived_by = NULL, updated_at = now()
     WHERE id = _client_id;
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_client_id, 'lifecycle_' || _action,
          jsonb_build_object('reason', NULLIF(btrim(COALESCE(_reason, '')), '')), auth.uid());

  PERFORM public.care_refresh_stage(_client_id);

  SELECT * INTO _c FROM public.clients WHERE id = _client_id;
  RETURN jsonb_build_object('stage', _c.stage, 'closed_at', _c.closed_at,
    'paused_at', _c.paused_at, 'paused_until', _c.paused_until, 'archived_at', _c.archived_at);
END;
$function$;

-- Sets or clears when a hold ends. The client must already be on hold.
CREATE OR REPLACE FUNCTION public.care_client_hold_until(_client_id uuid, _until timestamptz)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  PERFORM private.care_group_admin_guard();
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = _client_id AND paused_at IS NOT NULL) THEN
    RAISE EXCEPTION 'This client is not on hold';
  END IF;
  IF _until IS NOT NULL AND _until <= now() THEN
    RAISE EXCEPTION 'The end of the hold must be in the future';
  END IF;
  UPDATE public.clients SET paused_until = _until, updated_at = now() WHERE id = _client_id;
  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_client_id, 'hold_until_set', jsonb_build_object('until', _until), auth.uid());
END;
$function$;

REVOKE ALL ON FUNCTION public.care_client_hold_until(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.care_client_hold_until(uuid, timestamptz) TO authenticated;

-- Takes clients off hold once their hold has ended. Run by the scheduler.
CREATE OR REPLACE FUNCTION private.care_resume_ended_holds()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _id uuid; _n integer := 0;
BEGIN
  FOR _id IN
    SELECT id FROM public.clients
     WHERE paused_at IS NOT NULL AND paused_until IS NOT NULL AND paused_until <= now()
  LOOP
    UPDATE public.clients SET paused_at = NULL, paused_reason = NULL, paused_until = NULL, updated_at = now()
     WHERE id = _id;
    INSERT INTO public.care_activity (client_id, action, detail, actor_id)
    VALUES (_id, 'lifecycle_resume', jsonb_build_object('automatic', true), NULL);
    PERFORM public.care_refresh_stage(_id);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END;
$function$;

REVOKE ALL ON FUNCTION private.care_resume_ended_holds() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'care-resume-ended-holds';
SELECT cron.schedule('care-resume-ended-holds', '*/15 * * * *', $$select private.care_resume_ended_holds();$$);

-- 2. Routes and preliminary information ------------------------------------

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS home_assessment text NOT NULL DEFAULT 'ask';
DO $$ BEGIN
  ALTER TABLE public.services ADD CONSTRAINT services_home_assessment_check
    CHECK (home_assessment IN ('required','ask'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMENT ON COLUMN public.services.home_assessment IS
  'required: every client of this service has a care needs assessment at home. ask: staff decide per client.';

UPDATE public.services SET home_assessment = 'required'
 WHERE slug IN ('nanny_childcare','newborn','additional_needs','paediatric','clinical_home_care','post_surgical');

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS care_route text,
  ADD COLUMN IF NOT EXISTS care_starts_at text,
  ADD COLUMN IF NOT EXISTS preliminary jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS route_set_by uuid,
  ADD COLUMN IF NOT EXISTS route_set_at timestamptz;
DO $$ BEGIN
  ALTER TABLE public.clients ADD CONSTRAINT clients_care_route_check
    CHECK (care_route IS NULL OR care_route IN ('standard','urgent','one_off','staffing'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.clients ADD CONSTRAINT clients_care_starts_at_check
    CHECK (care_starts_at IS NULL OR care_starts_at IN ('home','hospital'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMENT ON COLUMN public.clients.care_route IS
  'standard: care needs assessment at home before care. urgent, one_off, staffing: preliminary information is enough to start.';

CREATE OR REPLACE FUNCTION public.care_client_route_set(_client_id uuid, _route text, _starts_at text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  PERFORM private.care_group_admin_guard();
  IF _route NOT IN ('standard','urgent','one_off','staffing') THEN RAISE EXCEPTION 'Unknown route'; END IF;
  IF _starts_at IS NOT NULL AND _starts_at NOT IN ('home','hospital') THEN
    RAISE EXCEPTION 'Care starts either at home or in hospital';
  END IF;
  UPDATE public.clients
     SET care_route = _route, care_starts_at = _starts_at,
         route_set_by = auth.uid(), route_set_at = now(), updated_at = now()
   WHERE id = _client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Care record not found'; END IF;
  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_client_id, 'route_set', jsonb_build_object('route', _route, 'starts_at', _starts_at), auth.uid());
END;
$function$;

REVOKE ALL ON FUNCTION public.care_client_route_set(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.care_client_route_set(uuid, text, text) TO authenticated;

-- The preliminary information is a fixed set of keys, each free text or a
-- yes/no for consent. Saving merges what is sent; an empty value clears a key.
CREATE OR REPLACE FUNCTION public.care_client_preliminary_save(_client_id uuid, _data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _allowed text[] := ARRAY['where','allergies','medicines','risks','emergency_contact','consent'];
  _key text; _value jsonb; _next jsonb;
BEGIN
  PERFORM private.care_group_admin_guard();
  IF jsonb_typeof(_data) <> 'object' THEN RAISE EXCEPTION 'Send the information as an object'; END IF;
  SELECT preliminary INTO _next FROM public.clients WHERE id = _client_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Care record not found'; END IF;
  FOR _key, _value IN SELECT key, value FROM jsonb_each(_data) LOOP
    IF NOT _key = ANY(_allowed) THEN RAISE EXCEPTION 'Unknown item: %', _key; END IF;
    IF _value IS NULL OR _value = 'null'::jsonb OR (jsonb_typeof(_value) = 'string' AND btrim(_value #>> '{}') = '') THEN
      _next := _next - _key;
    ELSIF _key = 'consent' AND jsonb_typeof(_value) <> 'boolean' THEN
      RAISE EXCEPTION 'Consent is yes or no';
    ELSIF _key <> 'consent' AND jsonb_typeof(_value) <> 'string' THEN
      RAISE EXCEPTION 'Each item is text';
    ELSE
      _next := _next || jsonb_build_object(_key, _value);
    END IF;
  END LOOP;
  UPDATE public.clients SET preliminary = _next, updated_at = now() WHERE id = _client_id;
  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_client_id, 'preliminary_saved', jsonb_build_object('items', (SELECT jsonb_agg(k) FROM jsonb_object_keys(_data) k)), auth.uid());
  RETURN _next;
END;
$function$;

REVOKE ALL ON FUNCTION public.care_client_preliminary_save(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.care_client_preliminary_save(uuid, jsonb) TO authenticated;

-- 3. Assessors ----------------------------------------------------------------

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
       AND (p.is_staff IS NOT TRUE OR p.staff_status = 'active')
  );
$function$;

CREATE OR REPLACE FUNCTION public.care_assessor_capability_set(_person_id uuid, _active boolean, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _live integer;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to change capabilities';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mu_people WHERE id = _person_id) THEN
    RAISE EXCEPTION 'That person is not on record';
  END IF;

  IF _active THEN
    IF NOT EXISTS (SELECT 1 FROM public.mu_people WHERE id = _person_id AND auth_user_id IS NOT NULL) THEN
      RAISE EXCEPTION 'This person needs a sign-in before they can become a Clinical Assessor';
    END IF;
    IF EXISTS (SELECT 1 FROM public.mu_people
                WHERE id = _person_id AND is_staff IS TRUE AND staff_status <> 'active') THEN
      RAISE EXCEPTION 'This staff member is not active';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.mu_capabilities
       WHERE person_id = _person_id AND capability = 'assessor' AND revoked_at IS NULL)
    THEN
      INSERT INTO public.mu_capabilities (person_id, capability, granted_by, granted_at, reason)
      VALUES (_person_id, 'assessor', auth.uid(), now(), NULLIF(btrim(COALESCE(_reason, '')), ''));
    END IF;
  ELSE
    _live := public.care_assessor_live_assessments(_person_id);
    IF _live > 0 THEN
      RAISE EXCEPTION 'Clinical Assessor cannot be removed while % active assessment(s) are assigned to them. Reassign those visits first.', _live;
    END IF;

    UPDATE public.mu_capabilities
       SET revoked_at = now(), revoked_by = auth.uid(),
           reason = COALESCE(NULLIF(btrim(COALESCE(_reason, '')), ''), reason)
     WHERE person_id = _person_id AND capability = 'assessor' AND revoked_at IS NULL;
  END IF;
END;
$function$;

ALTER TABLE public.care_assessment_work
  ADD COLUMN IF NOT EXISTS assessor_fee_naira integer,
  ADD COLUMN IF NOT EXISTS assessor_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS assessor_paid_by uuid;
DO $$ BEGIN
  ALTER TABLE public.care_assessment_work ADD CONSTRAINT care_assessment_work_assessor_fee_check
    CHECK (assessor_fee_naira IS NULL OR assessor_fee_naira >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Records what the assessor is paid for this assessment, and whether it has
-- been paid. Paying needs an accepted assessment and an amount.
CREATE OR REPLACE FUNCTION public.care_assessment_assessor_pay(_id uuid, _fee_naira integer, _paid boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _w public.care_assessment_work%ROWTYPE;
BEGIN
  IF NOT private.care_ops_ok() THEN RAISE EXCEPTION 'Not allowed to record assessor pay'; END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assessment is not on record'; END IF;
  IF _fee_naira IS NOT NULL AND _fee_naira < 0 THEN RAISE EXCEPTION 'The amount cannot be negative'; END IF;
  IF _paid THEN
    IF _w.review_decision IS DISTINCT FROM 'accepted' THEN
      RAISE EXCEPTION 'Pay the assessor once the assessment has been accepted';
    END IF;
    IF COALESCE(_fee_naira, _w.assessor_fee_naira) IS NULL THEN
      RAISE EXCEPTION 'Enter what the assessor is paid';
    END IF;
  END IF;
  UPDATE public.care_assessment_work
     SET assessor_fee_naira = COALESCE(_fee_naira, assessor_fee_naira),
         assessor_paid_at = CASE WHEN _paid THEN COALESCE(assessor_paid_at, now()) ELSE NULL END,
         assessor_paid_by = CASE WHEN _paid THEN COALESCE(assessor_paid_by, auth.uid()) ELSE NULL END,
         updated_at = now()
   WHERE id = _id
  RETURNING * INTO _w;
  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_w.client_id, 'assessor_pay_set',
          jsonb_build_object('assessment_id', _id, 'fee_naira', _w.assessor_fee_naira, 'paid', _paid), auth.uid());
  RETURN jsonb_build_object('fee_naira', _w.assessor_fee_naira, 'paid_at', _w.assessor_paid_at);
END;
$function$;

REVOKE ALL ON FUNCTION public.care_assessment_assessor_pay(uuid, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.care_assessment_assessor_pay(uuid, integer, boolean) TO authenticated;

-- A clinical reviewer who carried out the assessment accepts it directly: the
-- review checklist is for checking someone else's work.
CREATE OR REPLACE FUNCTION public.care_assessment_accept(_id uuid, _notes text DEFAULT NULL::text)
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

  SELECT EXISTS (SELECT 1 FROM public.mu_people p
                  WHERE p.id = _w.assessor_person_id AND p.auth_user_id = auth.uid())
    INTO _self;

  IF NOT _self THEN
    _problem := private.care_review_checklist_problem(_r.checklist);
    IF _problem IS NOT NULL THEN RAISE EXCEPTION '%', _problem; END IF;
  END IF;

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
    jsonb_build_object('document_id', _w.document_id, 'care_plan_id', _plan, 'review_id', _r.id,
                       'self_assessed', _self));

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_w.client_id, 'assessment_accepted',
          jsonb_build_object('assessment_id', _id, 'care_plan_id', _plan, 'self_assessed', _self), auth.uid());

  PERFORM public.care_refresh_stage(_w.client_id);
  RETURN jsonb_build_object('ok', true, 'care_plan_id', _plan, 'review_id', _r.id);
END;
$function$;
