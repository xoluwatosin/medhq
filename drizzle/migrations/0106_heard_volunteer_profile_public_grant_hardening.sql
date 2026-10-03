REVOKE ALL ON public.heard_volunteer_profiles FROM PUBLIC;
REVOKE ALL ON public.heard_volunteer_profiles FROM anon;
GRANT SELECT ON public.heard_volunteer_profiles TO authenticated;
GRANT ALL ON public.heard_volunteer_profiles TO service_role;