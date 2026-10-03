-- Granting and removing the Clinical Assessor capability is a safety decision,
-- so the rules live in the database rather than in the Workforce screen.

CREATE OR REPLACE FUNCTION public.care_assessor_live_assessments(_person_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
  SELECT count(*)::integer
    FROM public.care_assessment_work w
   WHERE w.assessor_person_id = _person_id
     AND w.status IN ('requested', 'scheduled', 'in_progress');
$function$;

GRANT EXECUTE ON FUNCTION public.care_assessor_live_assessments(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.care_assessor_capability_set(_person_id uuid, _active boolean, _reason text DEFAULT NULL)
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
    RAISE EXCEPTION 'That person is not on the workforce';
  END IF;

  IF _active THEN
    -- The screen already refuses this, but the rule is enforced here so that a
    -- direct call cannot make an unreachable person assignable.
    IF NOT EXISTS (
      SELECT 1 FROM public.mu_people
       WHERE id = _person_id AND staff_status = 'active' AND auth_user_id IS NOT NULL)
    THEN
      RAISE EXCEPTION 'This person must be active Workforce with a sign-in before they can become a Clinical Assessor';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.mu_capabilities
       WHERE person_id = _person_id AND capability = 'assessor' AND revoked_at IS NULL)
    THEN
      INSERT INTO public.mu_capabilities (person_id, capability, granted_by, granted_at, reason)
      VALUES (_person_id, 'assessor', auth.uid(), now(), NULLIF(btrim(COALESCE(_reason, '')), ''));
    END IF;
  ELSE
    -- Removing the capability must never strand a visit that is still to happen.
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
      SELECT 1 FROM public.mu_people WHERE id = _person_id AND staff_status = 'active'),
    'live_assessments', public.care_assessor_live_assessments(_person_id)
  )
  WHERE private.has_role(auth.uid(), 'admin'::app_role);
$function$;
