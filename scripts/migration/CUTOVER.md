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
6. `post-restore.sql`.
7. Set the edge function secrets from the newly generated values (the `format(...)` query from the migration notes), then confirm the digests match the fingerprints in `private.job_keys`.
8. Copy storage files from the old buckets (`applications`, `care-uploads`, `blog-images`, `creator-uploads`). Delete the `database_export_*` bucket.
9. Point DNS for medicconnect.co at the `medhq` Vercel project, and heard.medicconnect.co at the `heard` Vercel project. Copy Heard's rows across first ("Moving Heard's data" in the [heard README](https://github.com/xoluwatosin/heard#moving-heards-data-from-medic-connect)). Set Supabase Auth Site URL and the `SITE_URL`/`PUBLIC_SITE_URL` secrets back to https://medicconnect.co and remove `EXTRA_ALLOWED_ORIGINS`.
10. Activate the jobs: `select cron.alter_job(jobid, active := true) from cron.job;`
11. Smoke test: contact form email, candidate sign-in, pre-assessment link, contract signing, an invoice.

## After cutover

- Drop the `heard_*` tables and functions from the Medic Connect database once Heard is live on its own project.
- The account-model addendum for one sign-in across roles.
