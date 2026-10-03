REVOKE EXECUTE ON FUNCTION public.mu_readiness_items(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mu_set_application_stage(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mu_offer_interview_slots(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mu_book_interview_slot(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mu_applications_for_person(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mu_my_applications() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.mu_readiness_items(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_set_application_stage(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_offer_interview_slots(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_book_interview_slot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_applications_for_person(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_my_applications() TO authenticated;