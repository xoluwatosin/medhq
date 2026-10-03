REVOKE ALL ON FUNCTION public.mu_promote_parsed_fields(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_promote_parsed_fields(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mu_settle_parsed_fields(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_settle_parsed_fields(uuid, numeric) TO authenticated, service_role;