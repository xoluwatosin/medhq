-- Everything applied to the new project after restore.sh and apply-acls.sh.
-- Run once, in the SQL editor or with psql, after each restore:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f scripts/migration/post-restore.sql
-- Then set the edge function secrets from the new values (see CUTOVER.md).

-- 1. Point the database's own HTTP calls at the new project.
update private.app_config
   set value = 'https://zeqiewxlqcmbgvytnahl.supabase.co/functions/v1', updated_at = now()
 where key = 'functions_url';

do $$
declare r record;
begin
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosrc like '%eylgffhvyuykafxydrul%'
  loop
    execute replace(pg_get_functiondef(r.oid), 'eylgffhvyuykafxydrul', 'zeqiewxlqcmbgvytnahl');
  end loop;
end $$;

-- 2. Lock down unguarded SECURITY DEFINER functions.
--    Same statements as supabase/migrations/20261003230000_lock_down_unguarded_definer_functions.sql.
revoke execute on function public.care_reconcile_stages() from public, anon, authenticated;
revoke execute on function public.care_refresh_stage(uuid) from public, anon, authenticated;
revoke execute on function public.care_assessor_eligible(uuid) from public, anon, authenticated;
revoke execute on function public.mu_document_reading_health() from public, anon, authenticated;
revoke execute on function public.mu_document_verdict(uuid) from public, anon, authenticated;
revoke execute on function public.mu_flag_profile_ambiguity(uuid) from public, anon, authenticated;
revoke execute on function public.mu_has_capability(uuid, text) from public, anon, authenticated;
revoke execute on function public.mu_query_field(uuid, text, text, text) from public, anon, authenticated;
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

-- 3. New values for the scheduled-job secrets. Generated here, never printed.
update private.job_keys
   set value = encode(extensions.gen_random_bytes(24), 'hex'), rotated_at = now(), rotated_by = null
 where name in ('mu_link_sweep_key', 'admin_alert_key', 'followup_run_key');
update private.job_keys
   set fingerprint = left(encode(extensions.digest(value, 'sha256'), 'hex'), 12)
 where name in ('mu_link_sweep_key', 'admin_alert_key', 'followup_run_key');
update private.app_config
   set value = encode(extensions.gen_random_bytes(24), 'hex'), updated_at = now()
 where key = 'parse_cv_cron_secret';
insert into private.app_config (key, value, updated_at)
values ('cron_secret', encode(extensions.gen_random_bytes(24), 'hex'), now())
on conflict (key) do update set value = excluded.value, updated_at = now();

-- 4. Scheduled jobs, created paused. Secrets are read from private.app_config at run time.
--    Replaces any jobs already present, so this file can run on a database that has them.
select cron.unschedule(jobid) from cron.job;
do $$
declare j record;
begin
  for j in select * from (values
    ('publish-scheduled-posts', '*/5 * * * *', $c$
      select net.http_post(
        url := (select value from private.app_config where key = 'functions_url') || '/publish-scheduled-posts',
        headers := jsonb_build_object('Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select value from private.app_config where key = 'cron_secret')),
        body := '{}'::jsonb)
    $c$),
    ('parse-cv-sweep', '*/2 * * * *', $c$
      select net.http_post(
        url := (select value from private.app_config where key = 'functions_url') || '/parse-cv',
        headers := jsonb_build_object('Content-Type', 'application/json',
          'x-cron-secret', (select value from private.app_config where key = 'parse_cv_cron_secret')),
        body := '{"limit":10}'::jsonb)
    $c$),
    ('mu-expire-documents-nightly', '15 2 * * *', 'select public.mu_expire_documents();'),
    ('mu-parse-sweep-hourly', '5 * * * *', 'select private.mu_parse_sweep(25);'),
    ('mu-duplicate-scan-weekly', '30 2 * * 1', 'select public.mu_scan_name_duplicates();'),
    ('mu-reparse-pool', '*/5 * * * *', 'select private.mu_reparse_batch(20);'),
    ('mu-document-parse-sweep', '*/15 * * * *', 'select private.mu_sweep_document_parses(10);'),
    ('mu-link-orphan-accounts', '*/2 * * * *', 'select private.mu_link_orphan_accounts();'),
    ('analytics-refresh', '*/15 * * * *', 'select private.analytics_refresh_all(); select private.analytics_check_alerts();'),
    ('followup-queue-sweep', '0 9 * * *', 'select private.analytics_refresh_all(); select private.followup_queue_sweep();'),
    ('followup-queue-dispatch', '30 9 * * *', 'select private.followup_queue_dispatch();'),
    ('metrics-audit', '45 8 * * *', 'select private.metrics_audit_run();'),
    -- System health (supabase/migrations/20261003233000_system_health_and_alerts.sql).
    ('ops-run-checks', '*/5 * * * *', 'select private.ops_run_checks();'),
    ('ops-probe', '*/30 * * * *', $c$select private.ops_call_function('ops-probe');$c$),
    ('ops-daily-digest', '45 6 * * *', $c$select private.ops_call_function('send-admin-alert', '{"mode": "digest"}'::jsonb);$c$)
  ) as t(name, schedule, command)
  loop
    perform cron.alter_job(cron.schedule(j.name, j.schedule, j.command), active := false);
  end loop;
end $$;
