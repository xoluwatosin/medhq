REVOKE EXECUTE ON FUNCTION public.mu_promote_parsed_fields(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mu_promote_application_answers(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mu_scan_name_duplicates() FROM anon;
REVOKE EXECUTE ON FUNCTION public.mu_expire_documents() FROM anon, authenticated;
REVOKE ALL ON FUNCTION private.mu_parse_sweep(integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION private.mu_dispatch_parse(uuid) FROM anon, authenticated;