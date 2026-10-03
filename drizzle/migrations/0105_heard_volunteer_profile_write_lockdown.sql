REVOKE INSERT, UPDATE ON public.heard_volunteer_profiles FROM authenticated;
DROP POLICY IF EXISTS "Volunteers can create own Heard profile" ON public.heard_volunteer_profiles;
DROP POLICY IF EXISTS "Volunteers can update own Heard profile" ON public.heard_volunteer_profiles;