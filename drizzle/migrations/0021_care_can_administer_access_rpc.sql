-- The edge functions need to ask the same question the database asks:
-- may this person administer care access? One answer, one place.
CREATE OR REPLACE FUNCTION public.care_can_administer_access(_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.care_can_admin_access(COALESCE(_user_id, auth.uid()))
$$;
REVOKE ALL ON FUNCTION public.care_can_administer_access(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.care_can_administer_access(uuid) TO authenticated, service_role;