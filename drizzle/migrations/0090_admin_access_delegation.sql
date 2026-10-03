-- Who may manage other admins: the super admin, or an active admin holding the
-- explicit "admin_access" permission. SECURITY DEFINER so the check never
-- recurses through the policies on admin_permissions itself.
CREATE OR REPLACE FUNCTION private.can_manage_admin_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.is_super_admin(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.admin_permissions p
        WHERE p.user_id = _user_id
          AND COALESCE(p.is_active, true)
          AND p.permissions ? 'admin_access'
      );
$$;

CREATE TABLE public.admin_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  actor_email TEXT,
  target_user_id UUID,
  target_email TEXT,
  action TEXT NOT NULL,
  permissions_before JSONB NOT NULL DEFAULT '[]'::jsonb,
  permissions_after JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX admin_access_log_target_idx ON public.admin_access_log (target_user_id, created_at DESC);

GRANT SELECT, INSERT ON public.admin_access_log TO authenticated;
GRANT ALL ON public.admin_access_log TO service_role;

ALTER TABLE public.admin_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access managers read the access log"
ON public.admin_access_log FOR SELECT TO authenticated
USING (private.can_manage_admin_access(auth.uid()));

CREATE POLICY "Access managers write the access log"
ON public.admin_access_log FOR INSERT TO authenticated
WITH CHECK (private.can_manage_admin_access(auth.uid()) AND actor_user_id = auth.uid());

-- Delegates can see every admin and change anybody but themselves and the
-- super admin. Granting "admin_access" itself stays with the super admin and is
-- enforced in the edge function and the trigger below.
CREATE POLICY "Access managers read all admin permissions"
ON public.admin_permissions FOR SELECT TO authenticated
USING (private.can_manage_admin_access(auth.uid()));

CREATE POLICY "Access managers update other admins"
ON public.admin_permissions FOR UPDATE TO authenticated
USING (
  private.can_manage_admin_access(auth.uid())
  AND user_id <> auth.uid()
  AND NOT private.is_super_admin(user_id)
)
WITH CHECK (
  private.can_manage_admin_access(auth.uid())
  AND user_id <> auth.uid()
  AND NOT private.is_super_admin(user_id)
);

-- Only the super admin may hand out the right to manage access.
CREATE OR REPLACE FUNCTION public.admin_access_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT private.is_super_admin(auth.uid())
     AND COALESCE(NEW.permissions ? 'admin_access', false)
         IS DISTINCT FROM COALESCE(OLD.permissions ? 'admin_access', false)
  THEN
    RAISE EXCEPTION 'Only the super admin can change who manages admin access';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER admin_permissions_access_guard
BEFORE UPDATE ON public.admin_permissions
FOR EACH ROW EXECUTE FUNCTION public.admin_access_guard();