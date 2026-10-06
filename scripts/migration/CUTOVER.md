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
    - `supabase/migrations/20261005170000_care_homes.sql` (homes: care records under one roof share one address; the family holds none). Its NOTICE lines say which addresses moved
    - `supabase/migrations/20261005180000_care_family_membership.sql` (one member row per person per family; roles read from the care records)
    - `supabase/migrations/20261005190000_care_person_matching.sql` (care duplicates: matching, "different people" answers, the merge)
    - `supabase/migrations/20261005200000_care_link_scope.sql` (a link opens one care record; its person comes from its contact)
    - `supabase/migrations/20261005210000_care_payers.sql` (payers: people or organisations, with shares; drops `client_commercial.payer_person_id`)
    - `supabase/migrations/20261005220000_mu_document_proves_credential.sql` (accepting a document settles the credentials it proves; returning it takes the evidence back. Its NOTICE line says how many credentials were settled from documents already accepted)
    - `supabase/migrations/20261005230000_mu_readiness_summary_documents.sql` (adds a missing-documents count to the readiness summary, so the Talent pool can nudge "Documents in, review them". Before it runs, the nudge simply does not show)
    - any later file in `supabase/migrations/` dated after 20261003231023
    Check with: `select proname from pg_proc where proname = 'mu_merge_people';` (one row), `select count(*) from information_schema.tables where table_name ilike 'heard%';` (0) `select count(*) from clients where person_id is null;` (0) and `select count(*) from clients where home_id is null and coalesce(address_line, state_code, lga_code) is not null;` (0).
6b. Deploy every edge function from this branch: `npx supabase functions deploy --project-ref zeqiewxlqcmbgvytnahl`. Fifteen functions and the shared code they import (`_shared`) changed after the snapshot (among them care-portal-accept, send-enquiry-reply, send-campaign, send-form-notification, parse-cv, parse-document), so deploy them all rather than picking. Then delete the ones the repo no longer has, if the new project still lists them: `npx supabase functions delete mcp --project-ref zeqiewxlqcmbgvytnahl`, and the same for `heard-submit` and `send-heard-signup` (Heard has moved).
7. Set the edge function secrets from the newly generated values (the `format(...)` query from the migration notes), then confirm the digests match the fingerprints in `private.job_keys`.
8. Copy storage files from the old buckets (`applications`, `care-uploads`, `blog-images`, `creator-uploads`). Delete the `database_export_*` bucket.
9. Point DNS for medicconnect.co at the new host.
10. Activate the jobs: `select cron.alter_job(jobid, active := true) from cron.job;`
11. Smoke test: contact form email, candidate sign-in, pre-assessment link, contract signing, an invoice.

## After cutover

- Set `project_id` in `supabase/config.toml` to `zeqiewxlqcmbgvytnahl` (it still names the old project).
- Take the schema baseline for the single migration trail (`docs/platform-architecture.md`, D2). Not before: the restore replaces the schema.

Held until the cutover is verified: Heard on its own domain and Supabase project, and the account-model addendum for one sign-in across roles.

## Cutover log (6 October 2026)

Done without a fresh export: the new database kept the 3 October snapshot, and the changes since were copied across by primary key.

- Old site in maintenance; its 14 scheduled jobs paused.
- All 13 post-snapshot migrations applied (NOTICE: 10 test care records removed, 4 kept; 0 credentials settled). Runbook checks pass.
- Every edge function deployed; `mcp` and the Heard functions removed. `RELINK_RUN_KEY` left unset on purpose: the only caller sends `MU_LINK_SWEEP_KEY`, which notify-relink also accepts.
- Rows changed after the snapshot copied: 5 logins (password hashes verified identical), 1 identity, 1 profile, 2 people, 5 documents, 2 references, 3 verifications, 2 work preferences, 7 availability rows, 10 parsed fields, 29 profile facets, 22 activity rows. Not copied (machine logs): mu_cv_parses, metrics_audit_findings, 2 admin_alerts, 26 campaign_events, and the midnight parse-retry touches on 7 people.
- Storage: 1,043 files (applications 981, blog-images 24, creator-uploads 38) copied through a temporary signed-link pair; counts, bytes and a name:size fingerprint match per bucket. Both temporary functions retired.
- Production deployment on Vercel; www.medicconnect.co primary, medicconnect.co redirects to it (308).
- New project's 12 scheduled jobs switched on; first runs succeeded and the functions accepted the job keys.

Clean-up, done 6 October:
- `public.cutover_files` and `private.cutover_upsert` dropped; `cutover-copy-files` deleted; the empty `database_export_03_10_26` bucket deleted. Buckets left: applications, blog-images, care-uploads, creator-uploads. `care-uploads` is empty on both projects (the old bucket held no files).
- Vercel production branch set to `claude/stoic-clarke-xwp2ql` (Settings > Environments > Production > Branch Tracking), so pushes to it go live.
- Smoke test passed: admin sign-in works on medicconnect.co, and table counts match the old project apart from the removed test care records and machine logs.
