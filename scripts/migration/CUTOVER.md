# Cutover from Lovable Cloud

Old project: `eylgffhvyuykafxydrul` (Lovable Cloud). New project: `zeqiewxlqcmbgvytnahl` (`medic-connect-hq`).

The new database holds a snapshot taken at 21:01 UTC on 3 October 2026. Anything written to the live site after that exists only in the old project, so cutover takes a fresh export and restores again.

## Before cutover

- [ ] `scripts/migration/fetch-lovable-assets.sh`, then commit `public/email-kit` and `public/fonts`. Must run while medicconnect.co is still on Lovable.
- [ ] Redeploy `notify-relink` (now `verify_jwt = false`).
- [ ] Delete the deployed `mcp` function: `npx supabase functions delete mcp --project-ref zeqiewxlqcmbgvytnahl`.
- [ ] Decide on the 14 logins with no profile (10 confirmed bare sign-ups, 3 unconfirmed with a pending claim invite, 1 unconfirmed from August).
- [ ] Frontend deployed to the new host with the new `VITE_SUPABASE_*` values, checked on a preview URL. Add that URL to `EXTRA_ALLOWED_ORIGINS` while testing.
- [ ] Auth settings on the new project: Site URL, redirect URLs, email templates, leaked-password protection.
- [ ] Old project, if it can be reached: delete its `mcp` function and apply the lockdown in `post-restore.sql` section 2.

## Cutover, in this order

1. Put the old site into maintenance, or accept that writes after the export are lost.
2. **Stop the old project's cron jobs.** Otherwise both projects send the same nudges, relink notices and alerts.
3. Export from Lovable Cloud (Cloud → Overview → Advanced settings → Export project data).
4. Reset the new database (Dashboard → Database → Settings → Reset, or a fresh project). The restore script expects an empty database.
5. `restore.sh` then `apply-acls.sh` with the new export.
6. `post-restore.sql`, then the migrations in `supabase/migrations` dated after the export, starting with `20261003233000_system_health_and_alerts.sql` (System health). Its scheduled jobs stay paused with the rest.
7. Set the edge function secrets from the newly generated values (the `format(...)` query from the migration notes), then confirm the digests match the fingerprints in `private.job_keys`.
8. Copy storage files from the old buckets (`applications`, `care-uploads`, `blog-images`, `creator-uploads`). Delete the `database_export_*` bucket.
9. Point DNS for medicconnect.co at the new host.
10. Activate the jobs: `select cron.alter_job(jobid, active := true) from cron.job;`
11. Smoke test: contact form email, candidate sign-in, pre-assessment link, contract signing, an invoice. Then open Admin → System health and press **Check now**: every area should be green or explain itself, and **Send test alert** on Alert keys should reach hello@medicconnect.co.

## After cutover

Held until the cutover is verified: Heard on its own domain and Supabase project, and the account-model addendum for one sign-in across roles.
