REVOKE ALL ON FUNCTION public.campaign_sync_stats(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_sync_stats(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.claim_invites_link_person() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_invites_stamp_invited() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.mu_people_claim_writeback() FROM public, anon, authenticated;