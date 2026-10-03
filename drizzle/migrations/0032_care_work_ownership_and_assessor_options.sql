-- Work ownership a coordinator can actually change, and the list of people
-- who may be assigned an assessment.
CREATE OR REPLACE FUNCTION public.care_work_assign(_id uuid, _assignee_user_id uuid DEFAULT NULL, _team text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to change work';
  END IF;
  IF _assignee_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.admin_permissions WHERE user_id = _assignee_user_id AND is_active
  ) THEN
    RAISE EXCEPTION 'That is not an active member of staff';
  END IF;
  UPDATE public.care_work_items
     SET assignee_user_id = _assignee_user_id,
         team = NULLIF(btrim(COALESCE(_team, '')), ''),
         updated_at = now()
   WHERE id = _id AND status IN ('open','blocked');
END;
$$;
REVOKE ALL ON FUNCTION public.care_work_assign(uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_work_assign(uuid, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.care_assessor_options()
RETURNS TABLE (person_id uuid, full_name text, profession text, has_account boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT p.id, p.full_name, p.profession, p.auth_user_id IS NOT NULL
    FROM public.mu_people p
    JOIN public.mu_capabilities c ON c.person_id = p.id AND c.capability = 'assessor' AND c.revoked_at IS NULL
   WHERE private.has_role(auth.uid(), 'admin'::app_role)
   ORDER BY p.full_name;
$$;
REVOKE ALL ON FUNCTION public.care_assessor_options() FROM public;
GRANT EXECUTE ON FUNCTION public.care_assessor_options() TO authenticated, service_role;