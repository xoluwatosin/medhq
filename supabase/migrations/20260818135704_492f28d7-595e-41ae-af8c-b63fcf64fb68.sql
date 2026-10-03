REVOKE EXECUTE ON FUNCTION public.mu_parsed_vs_held(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mu_parsed_vs_held(uuid) TO authenticated, service_role;