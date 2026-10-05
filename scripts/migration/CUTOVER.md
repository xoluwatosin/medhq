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
6a. Re-apply every repo migration written after the 3 October snapshot, in filename order. The restore wipes them. Each is safe to run twice.
    - `supabase/migrations/20261004180000_add_clinical_research_enquiry_line.sql` (never applied anywhere yet)
    - `supabase/migrations/20261005090000_mu_merge_people.sql` (the Duplicates merge; Merge fails without it)
    - `supabase/migrations/20261005090500_approval_notes.sql` (send-back reasons on Approvals)
    - `supabase/migrations/20261005120000_remove_heard.sql` (Heard has moved; the export brings its tables back)
    - `supabase/migrations/20261005150000_remove_test_care_records.sql` (the 10 test care records staff marked on 5 October; keyed on enquiry number; aborts if any of the 4 kept records would go)
    - `supabase/migrations/20261005160000_care_family_steps_2_to_5.sql` (every care record gets a person; relationships the clinical way round; drops the unused contact authority columns). Read its NOTICE lines: any listed record needs staff to check the relationship
    - any later file in `supabase/migrations/` dated after 20261003231023
    Check with: `select proname from pg_proc where proname = 'mu_merge_people';` (one row), `select count(*) from information_schema.tables where table_name ilike 'heard%';` (0) and `select count(*) from clients where person_id is null;` (0).
7. Set the edge function secrets from the newly generated values (the `format(...)` query from the migration notes), then confirm the digests match the fingerprints in `private.job_keys`.
8. Copy storage files from the old buckets (`applications`, `care-uploads`, `blog-images`, `creator-uploads`). Delete the `database_export_*` bucket.
9. Point DNS for medicconnect.co at the new host.
10. Activate the jobs: `select cron.alter_job(jobid, active := true) from cron.job;`
11. Smoke test: contact form email, candidate sign-in, pre-assessment link, contract signing, an invoice.

## After cutover

- Set `project_id` in `supabase/config.toml` to `zeqiewxlqcmbgvytnahl` (it still names the old project).
- Take the schema baseline for the single migration trail (`docs/platform-architecture.md`, D2). Not before: the restore replaces the schema.

Held until the cutover is verified: Heard on its own domain and Supabase project, and the account-model addendum for one sign-in across roles.
