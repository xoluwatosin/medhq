REVOKE EXECUTE ON FUNCTION public.mu_create_contract(uuid, jsonb) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.mu_issue_contract(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.mu_sign_contract(uuid, text, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.mu_set_contract_status(uuid, text, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.mu_convert_to_staff(uuid, jsonb) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.mu_staff_list() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.mu_document_status(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mu_document_status(uuid) TO authenticated;