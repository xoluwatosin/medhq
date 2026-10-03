CREATE OR REPLACE FUNCTION private.metrics_audit_reconcile()
RETURNS TABLE(action text, detail text, affected int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','private'
AS $$
DECLARE
  v_made int := 0;
  v_stamped int := 0;
  v_cleared int := 0;
BEGIN
  WITH missing AS (
    SELECT p.id, lower(p.email) AS email, p.invited_at, p.track
      FROM public.mu_people p
     WHERE p.invited_at IS NOT NULL
       AND p.email IS NOT NULL
       AND p.email <> ''
       AND NOT EXISTS (
         SELECT 1 FROM public.claim_invites ci WHERE lower(ci.email) = lower(p.email)
       )
  ), ins AS (
    INSERT INTO public.claim_invites (email, token, source, track, person_id, sent_at)
    SELECT m.email,
           replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
           'reconciled',
           m.track,
           m.id,
           m.invited_at
      FROM missing m
    RETURNING 1
  )
  SELECT count(*) INTO v_made FROM ins;

  WITH upd AS (
    UPDATE public.mu_people p
       SET invited_at = ci.sent_at
      FROM public.claim_invites ci
     WHERE ci.person_id = p.id
       AND p.invited_at IS NULL
       AND ci.sent_at IS NOT NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_stamped FROM upd;

  WITH cl AS (
    UPDATE public.mu_people p
       SET invited_at = NULL
     WHERE p.invited_at IS NOT NULL
       AND (p.email IS NULL OR p.email = '')
    RETURNING 1
  )
  SELECT count(*) INTO v_cleared FROM cl;

  INSERT INTO public.metrics_audit_findings
    (run_id, check_key, metric, scope, dashboard_value, source_value, delta, severity, note)
  VALUES
    (gen_random_uuid(), 'reconcile', 'invite_records_created', 'global', NULL, v_made, v_made, 'info',
     'Invite records written for people who carried an invite date without one.'),
    (gen_random_uuid(), 'reconcile', 'invite_dates_stamped', 'global', NULL, v_stamped, v_stamped, 'info',
     'Invite dates written for people whose invite record had no date on the profile.'),
    (gen_random_uuid(), 'reconcile', 'invite_dates_cleared', 'global', NULL, v_cleared, v_cleared, 'info',
     'Invite dates removed where there was no address to evidence a send.');

  RETURN QUERY
    SELECT 'invite_records_created'::text, 'Written for people carrying an invite date with no record.'::text, v_made
    UNION ALL SELECT 'invite_dates_stamped', 'Written where an invite record existed but the profile had no date.', v_stamped
    UNION ALL SELECT 'invite_dates_cleared', 'Removed where no address exists to evidence a send.', v_cleared;
END;
$$;