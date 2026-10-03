-- Talent -> Workforce lifecycle foundation.
-- One person, one account. Employment is a state on the same mu_people row,
-- never a copied record, and it never grants a capability by itself.

ALTER TABLE public.mu_people
  ADD COLUMN IF NOT EXISTS lifecycle_state text
  GENERATED ALWAYS AS (
    CASE WHEN is_staff IS TRUE AND COALESCE(staff_status, 'none') IN ('pending', 'active', 'on_notice')
         THEN 'workforce' ELSE 'talent' END
  ) STORED;

CREATE INDEX IF NOT EXISTS mu_people_lifecycle_state_idx ON public.mu_people (lifecycle_state);

-- What currently stops somebody leaving Workforce. Only facts the system holds.
CREATE OR REPLACE FUNCTION public.mu_workforce_blockers(_person_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _assignments integer;
  _assessments integer;
  _contracts integer;
BEGIN
  SELECT count(*) INTO _assignments
    FROM public.care_assignments a
   WHERE a.person_id = _person_id
     AND (a.ends_on IS NULL OR a.ends_on >= current_date);

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
$function$;

-- The canonical transition into Workforce. Explicit admin action at the
-- existing business milestone: a signed contract.
CREATE OR REPLACE FUNCTION public.mu_become_workforce(_person_id uuid, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  actor text;
  signed boolean;
  already boolean;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.mu_people WHERE id = _person_id) THEN
    RAISE EXCEPTION 'That person is not on our books';
  END IF;

  SELECT lifecycle_state = 'workforce' INTO already FROM public.mu_people WHERE id = _person_id;
  IF already THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'person_id', _person_id);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.mu_contracts c
     WHERE c.person_id = _person_id AND c.status IN ('signed', 'active')
       AND c.deleted_at IS NULL
  ) INTO signed;

  IF NOT signed THEN
    RAISE EXCEPTION 'A signed contract is required before someone joins the workforce';
  END IF;

  SELECT display_name INTO actor FROM public.admin_permissions WHERE user_id = auth.uid();

  UPDATE public.mu_people
     SET is_staff = true,
         staff_status = COALESCE(NULLIF(_payload->>'staff_status', ''), 'active'),
         job_title = COALESCE(NULLIF(_payload->>'job_title', ''), job_title),
         department = COALESCE(NULLIF(_payload->>'department', ''), department),
         employment_type = COALESCE(NULLIF(_payload->>'employment_type', ''), employment_type),
         staff_start_date = COALESCE(NULLIF(_payload->>'staff_start_date', '')::date, staff_start_date, current_date),
         staff_end_date = NULL,
         work_email = COALESCE(NULLIF(_payload->>'work_email', ''), work_email)
   WHERE id = _person_id;

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (_person_id, auth.uid(), actor, 'became_staff', _payload);

  RETURN jsonb_build_object('ok', true, 'changed', true, 'person_id', _person_id);
END;
$function$;

-- The canonical way back to Talent. Nothing is cancelled or reassigned here.
CREATE OR REPLACE FUNCTION public.mu_return_to_talent(_person_id uuid, _reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  actor text;
  b jsonb;
  problems text[] := ARRAY[]::text[];
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.mu_people WHERE id = _person_id) THEN
    RAISE EXCEPTION 'That person is not on our books';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.mu_people WHERE id = _person_id AND lifecycle_state = 'workforce') THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'person_id', _person_id);
  END IF;

  b := public.mu_workforce_blockers(_person_id);

  IF (b->>'assignments')::int > 0 THEN
    problems := problems || 'This person still has care work assigned. Reassign or close that work before returning them to Talent.';
  END IF;
  IF (b->>'assessments')::int > 0 THEN
    problems := problems || 'This person still has assessment visits assigned. Reassign those visits before returning them to Talent.';
  END IF;
  IF (b->>'contracts')::int > 0 THEN
    problems := problems || 'This person still has a live contract. End or withdraw the contract before returning them to Talent.';
  END IF;

  IF array_length(problems, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(problems, ' ');
  END IF;

  SELECT display_name INTO actor FROM public.admin_permissions WHERE user_id = auth.uid();

  -- Employment closes. Professional capabilities go with it; authored work,
  -- applications, documents and history are untouched.
  UPDATE public.mu_capabilities
     SET revoked_at = now(), revoked_by = auth.uid()
   WHERE person_id = _person_id AND revoked_at IS NULL;

  UPDATE public.mu_people
     SET is_staff = false,
         staff_status = 'exited',
         staff_end_date = COALESCE(staff_end_date, current_date)
   WHERE id = _person_id;

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (_person_id, auth.uid(), actor, 'returned_to_talent',
          jsonb_build_object('reason', NULLIF(btrim(COALESCE(_reason, '')), '')));

  RETURN jsonb_build_object('ok', true, 'changed', true, 'person_id', _person_id);
END;
$function$;

-- One login, one person, two operating modes.
CREATE OR REPLACE FUNCTION public.mu_portal_mode()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT jsonb_build_object(
              'person_id', p.id,
              'full_name', p.full_name,
              'mode', CASE WHEN p.lifecycle_state = 'workforce' THEN 'workforce' ELSE 'talent' END,
              'staff_status', p.staff_status,
              'assessor', public.care_assessor_eligible(p.id))
       FROM public.mu_people p
      WHERE p.auth_user_id = auth.uid()
      LIMIT 1),
    jsonb_build_object('person_id', NULL, 'mode', 'none'));
$function$;

REVOKE ALL ON FUNCTION public.mu_workforce_blockers(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.mu_become_workforce(uuid, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.mu_return_to_talent(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mu_workforce_blockers(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mu_become_workforce(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mu_return_to_talent(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mu_portal_mode() TO authenticated, service_role;