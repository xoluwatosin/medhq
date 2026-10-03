REVOKE EXECUTE ON FUNCTION public.mu_contract_log(uuid, text, text, jsonb, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mu_contract_log(uuid, text, text, jsonb, text, text, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mu_contract_create_from_library(uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mu_contract_save_draft(uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mu_contract_issue(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mu_contract_sign(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mu_contract_countersign(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mu_contract_void(uuid, text, text) FROM PUBLIC, anon;