-- Switching an admin off now takes their access away, not just their screens.
--
-- Admin access had two halves that could disagree: the admin role in
-- user_roles, which every row-level rule and most functions check, and the
-- is_active switch on admin_permissions, which only the screens read. Someone
-- switched off kept the role, and with it the data behind the screens.
--
-- From here the switch drives the role: switching off removes it, switching
-- back on restores it. The admin check also asks for an active account, so the
-- two can never disagree again, whichever is checked.

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
     AND (_role <> 'admin'::app_role OR EXISTS (
       SELECT 1 FROM public.admin_permissions p
        WHERE p.user_id = _user_id AND COALESCE(p.is_active, true)
     ))
$function$;

CREATE OR REPLACE FUNCTION private.admin_permissions_sync_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  -- The super admin can never be switched off.
  IF private.is_super_admin(NEW.user_id) AND NEW.is_active IS FALSE THEN
    RAISE EXCEPTION 'The owner account cannot be switched off.';
  END IF;
  IF COALESCE(NEW.is_active, true) THEN
    -- Only for a sign-in that still exists; an old row with no account stays roleless.
    INSERT INTO public.user_roles (user_id, role)
    SELECT NEW.user_id, 'admin' WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.user_id)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'admin';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS admin_permissions_sync_role ON public.admin_permissions;
CREATE TRIGGER admin_permissions_sync_role
AFTER INSERT OR UPDATE OF is_active ON public.admin_permissions
FOR EACH ROW EXECUTE FUNCTION private.admin_permissions_sync_role();

-- Anyone already switched off loses the role they kept.
DELETE FROM public.user_roles r
 USING public.admin_permissions p
 WHERE p.user_id = r.user_id AND r.role = 'admin' AND p.is_active IS FALSE;
