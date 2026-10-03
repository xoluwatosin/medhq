-- Lock down SECURITY DEFINER functions that check nothing about the caller.
--
-- Found after the move off Lovable Cloud (the permissions are unchanged from
-- the old project). Each function below runs as its owner, does no auth check
-- of its own, and was executable by anon over /rest/v1/rpc. Every database
-- caller of these is itself SECURITY DEFINER, so revoking the client roles
-- does not affect internal calls.

-- Not called by any client. Service role (edge functions, cron) only.
revoke execute on function public.care_reconcile_stages() from public, anon, authenticated;
revoke execute on function public.care_refresh_stage(uuid) from public, anon, authenticated;
revoke execute on function public.care_assessor_eligible(uuid) from public, anon, authenticated;
revoke execute on function public.mu_document_reading_health() from public, anon, authenticated;
revoke execute on function public.mu_document_verdict(uuid) from public, anon, authenticated;
revoke execute on function public.mu_flag_profile_ambiguity(uuid) from public, anon, authenticated;
revoke execute on function public.mu_has_capability(uuid, text) from public, anon, authenticated;
-- Writes to any person's parsed fields.
revoke execute on function public.mu_query_field(uuid, text, text, text) from public, anon, authenticated;

-- Called by the signed-in candidate portal: keep authenticated, drop anon.
-- Follow-up: neither checks that _person_id is the caller's own record.
revoke execute on function public.mu_document_status(uuid) from public, anon;
revoke execute on function public.mu_system_blocks(uuid, date, date) from public, anon;
grant execute on function public.mu_document_status(uuid) to authenticated;
grant execute on function public.mu_system_blocks(uuid, date, date) to authenticated;

grant execute on function
  public.care_reconcile_stages(),
  public.care_refresh_stage(uuid),
  public.care_assessor_eligible(uuid),
  public.mu_document_reading_health(),
  public.mu_document_verdict(uuid),
  public.mu_flag_profile_ambiguity(uuid),
  public.mu_has_capability(uuid, text),
  public.mu_query_field(uuid, text, text, text),
  public.mu_document_status(uuid),
  public.mu_system_blocks(uuid, date, date)
to service_role;
