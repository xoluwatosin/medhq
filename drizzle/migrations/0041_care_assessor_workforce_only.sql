CREATE OR REPLACE FUNCTION public.care_assessor_eligible(_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.mu_people p
      JOIN public.mu_capabilities c
        ON c.person_id = p.id AND c.capability = 'assessor' AND c.revoked_at IS NULL
     WHERE p.id = _person_id
       AND p.is_staff IS TRUE
       AND p.auth_user_id IS NOT NULL
       AND p.staff_status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.care_assessor_capability_set(_person_id uuid, _active boolean, _reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
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
    IF NOT EXISTS (
      SELECT 1 FROM public.mu_people
       WHERE id = _person_id
         AND is_staff IS TRUE
         AND staff_status = 'active'
         AND auth_user_id IS NOT NULL)
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
$$;

CREATE OR REPLACE FUNCTION public.care_assessor_capability(_person_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT jsonb_build_object(
    'active', EXISTS (
      SELECT 1 FROM public.mu_capabilities
       WHERE person_id = _person_id AND capability = 'assessor' AND revoked_at IS NULL),
    'eligible', public.care_assessor_eligible(_person_id),
    'has_account', EXISTS (
      SELECT 1 FROM public.mu_people WHERE id = _person_id AND auth_user_id IS NOT NULL),
    'staff_active', EXISTS (
      SELECT 1 FROM public.mu_people
       WHERE id = _person_id AND is_staff IS TRUE AND staff_status = 'active'),
    'live_assessments', public.care_assessor_live_assessments(_person_id)
  )
  WHERE private.has_role(auth.uid(), 'admin'::app_role);
$$;

REVOKE ALL ON FUNCTION public.care_assessor_live_assessments(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.care_assessor_live_assessments(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.care_assessor_live_assessments(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.care_assessor_live_assessments(uuid) TO service_role;