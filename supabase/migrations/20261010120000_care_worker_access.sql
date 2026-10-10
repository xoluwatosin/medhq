-- Workforce app access for field carers (apps plan, build order step 1).
--
-- A person can use the workforce app only when all three hold:
--   1. they are in the Workforce (lifecycle_state = 'workforce');
--   2. they are field staff (work_setting = 'field');
--   3. an admin has granted them the care_worker capability, not revoked.
-- They also need a sign-in. An assignment never grants access; it only decides
-- which care a carer sees. Leaving the Workforce already revokes every
-- capability (mu_return_to_talent), and moving to office work closes access
-- without touching the capability.
--
-- Additive: new functions, plus one new key ('care_worker') in mu_portal_mode.

-- The rule, in one place --------------------------------------------------
CREATE OR REPLACE FUNCTION private.care_worker_ok(_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.mu_people p
            WHERE p.id = _person_id
              AND p.lifecycle_state = 'workforce'
              AND p.work_setting = 'field'
              AND p.auth_user_id IS NOT NULL)
     AND EXISTS (
           SELECT 1 FROM public.mu_capabilities c
            WHERE c.person_id = _person_id
              AND c.capability = 'care_worker'
              AND c.revoked_at IS NULL)
$$;
REVOKE ALL ON FUNCTION private.care_worker_ok(uuid) FROM public, anon, authenticated;

-- Live delivery assignments that depend on the capability --------------------
CREATE OR REPLACE FUNCTION private.care_worker_live_assignments(_person_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT count(*)::integer FROM public.care_delivery_assignments
   WHERE person_id = _person_id
     AND capability_code = 'care_worker'
     AND status IN ('planned', 'active')
$$;
REVOKE ALL ON FUNCTION private.care_worker_live_assignments(uuid) FROM public, anon, authenticated;

-- What the admin panel shows ---------------------------------------------
CREATE OR REPLACE FUNCTION public.care_worker_capability(_person_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT jsonb_build_object(
    'active', EXISTS (
      SELECT 1 FROM public.mu_capabilities
       WHERE person_id = p.id AND capability = 'care_worker' AND revoked_at IS NULL),
    'has_account', p.auth_user_id IS NOT NULL,
    'workforce', p.lifecycle_state = 'workforce',
    'field', p.work_setting IS NOT DISTINCT FROM 'field',
    'app_access', private.care_worker_ok(p.id),
    'live_assignments', private.care_worker_live_assignments(p.id)
  )
    FROM public.mu_people p
   WHERE p.id = _person_id
     AND private.has_role(auth.uid(), 'admin'::app_role)
     AND private.admin_area_ok(ARRAY['workforce'])
$$;

-- Grant or revoke ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_worker_capability_set(_person_id uuid, _active boolean, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  _p public.mu_people%ROWTYPE;
  _live integer;
  _note text := NULLIF(btrim(COALESCE(_reason, '')), '');
  _actor text;
  _changed boolean := false;
BEGIN
  IF NOT (private.has_role(auth.uid(), 'admin'::app_role)
          AND private.admin_area_ok(ARRAY['workforce'])) THEN
    RAISE EXCEPTION 'Not allowed to change capabilities';
  END IF;

  SELECT * INTO _p FROM public.mu_people WHERE id = _person_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person is not on record';
  END IF;

  IF _active THEN
    IF _p.auth_user_id IS NULL THEN
      RAISE EXCEPTION 'This person needs a sign-in before they can use the workforce app';
    END IF;
    IF _p.lifecycle_state <> 'workforce' THEN
      RAISE EXCEPTION 'Move this person into the Workforce first';
    END IF;
    IF _p.work_setting IS DISTINCT FROM 'field' THEN
      RAISE EXCEPTION 'Only field staff can use the workforce app. Set their work setting to field first';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.mu_capabilities
       WHERE person_id = _person_id AND capability = 'care_worker' AND revoked_at IS NULL)
    THEN
      INSERT INTO public.mu_capabilities (person_id, capability, granted_by, granted_at, reason)
      VALUES (_person_id, 'care_worker', auth.uid(), now(), _note);
      _changed := true;
    END IF;
  ELSE
    _live := private.care_worker_live_assignments(_person_id);
    IF _live > 0 THEN
      RAISE EXCEPTION 'Care worker cannot be removed while % care assignment(s) are planned or active. End or reassign them first.', _live;
    END IF;

    UPDATE public.mu_capabilities
       SET revoked_at = now(), revoked_by = auth.uid(),
           reason = COALESCE(_note, reason)
     WHERE person_id = _person_id AND capability = 'care_worker' AND revoked_at IS NULL;
    _changed := FOUND;
  END IF;

  IF _changed THEN
    SELECT display_name INTO _actor FROM public.admin_permissions WHERE user_id = auth.uid();
    INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
    VALUES (_person_id, auth.uid(), _actor,
            CASE WHEN _active THEN 'care_worker_granted' ELSE 'care_worker_revoked' END,
            jsonb_build_object('reason', _note));
  END IF;
END;
$$;

-- The carer's own assignments, for the workforce app ------------------------
-- Only the signed-in carer's rows, and only while they pass the rule. No client
-- details yet: those arrive with visits, scoped to the visits they work.
CREATE OR REPLACE FUNCTION public.care_worker_my_assignments()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', a.id,
           'episode_id', a.episode_id,
           'status', a.status,
           'effective_from', a.effective_from,
           'effective_to', a.effective_to,
           'service_code', e.service_code,
           'episode_status', e.status)
           ORDER BY a.effective_from, a.id), '[]'::jsonb)
    FROM public.care_delivery_assignments a
    JOIN public.care_episodes e ON e.id = a.episode_id
   WHERE a.person_id = public.mu_my_person_id()
     AND a.capability_code = 'care_worker'
     AND a.status IN ('planned', 'active')
     AND private.care_worker_ok(a.person_id)
$$;

-- Portal mode gains one key -------------------------------------------------
CREATE OR REPLACE FUNCTION public.mu_portal_mode()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object(
              'person_id', p.id,
              'full_name', p.full_name,
              'mode', CASE WHEN p.lifecycle_state = 'workforce' THEN 'workforce' ELSE 'talent' END,
              'staff_status', p.staff_status,
              'assessor', public.care_assessor_eligible(p.id),
              'care_worker', private.care_worker_ok(p.id))
       FROM public.mu_people p
      WHERE p.auth_user_id = auth.uid()
      LIMIT 1),
    jsonb_build_object('person_id', NULL, 'mode', 'none'));
$$;

REVOKE ALL ON FUNCTION public.care_worker_capability(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_worker_capability_set(uuid, boolean, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_worker_my_assignments() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.care_worker_capability(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_worker_capability_set(uuid, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_worker_my_assignments() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mu_portal_mode() TO authenticated, service_role;
