-- System health and alerts (docs/administration/system-management.md, section A).
--
-- One catalogue of health checks, run every five minutes. A failing check opens
-- one alert per problem in admin_alerts, keeps it fresh while the problem lasts
-- and resolves it automatically when the problem clears. Alerts that are due an
-- email are claimed by send-admin-alert, which also sends the 07:45 daily digest.
--
-- Scheduled jobs are created here and also listed in
-- scripts/migration/post-restore.sql, which rebuilds every job at cutover.

-- ============ Alerts: severity, de-duplication, acknowledgement ============

alter table public.admin_alerts
  add column if not exists severity text not null default 'warning',
  add column if not exists source text not null default 'intake',
  add column if not exists area text,
  add column if not exists dedupe_key text,
  add column if not exists summary text,
  add column if not exists link text,
  add column if not exists occurrences integer not null default 1,
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid,
  add column if not exists resolved_by uuid,
  add column if not exists resolution_note text,
  add column if not exists email_count integer not null default 0,
  add column if not exists last_emailed_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'admin_alerts_severity_check') then
    alter table public.admin_alerts
      add constraint admin_alerts_severity_check check (severity in ('info', 'warning', 'critical'));
  end if;
end $$;

-- Intake alerts emailed before this migration count as emailed once.
update public.admin_alerts set email_count = 1, last_emailed_at = emailed_at
 where emailed_at is not null and email_count = 0;

create unique index if not exists admin_alerts_open_dedupe_idx
  on public.admin_alerts (dedupe_key) where resolved_at is null and dedupe_key is not null;
create index if not exists admin_alerts_open_idx
  on public.admin_alerts (severity, created_at desc) where resolved_at is null;

-- The live screen and the header bell update as alerts change.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_alerts') then
    alter publication supabase_realtime add table public.admin_alerts;
  end if;
end $$;

create or replace function private.ops_severity_rank(_s text)
returns integer
language sql
immutable
as $$
  select case _s when 'critical' then 3 when 'warning' then 2 when 'info' then 1 else 0 end
$$;

-- ============ Signals written by edge functions ============

-- Unhandled errors and 5xx responses, recorded by _shared/ops-log.ts.
-- Function name, status and a short message only: never request payloads.
create table if not exists public.ops_function_errors (
  id uuid primary key default gen_random_uuid(),
  function_name text not null,
  status integer not null,
  message text,
  occurred_at timestamptz not null default now()
);
create index if not exists ops_function_errors_recent_idx
  on public.ops_function_errors (function_name, occurred_at desc);
alter table public.ops_function_errors enable row level security;
grant all on public.ops_function_errors to service_role;

-- Results from the ops-probe function: can we reach each outside service.
create table if not exists public.ops_probe_results (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  status text not null check (status in ('up', 'degraded', 'down', 'not_configured')),
  latency_ms integer,
  message text,
  checked_at timestamptz not null default now()
);
create index if not exists ops_probe_results_recent_idx
  on public.ops_probe_results (service, checked_at desc);
alter table public.ops_probe_results enable row level security;
grant all on public.ops_probe_results to service_role;

-- Every alert email and digest, sent or failed.
create table if not exists public.ops_email_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('alerts', 'digest')),
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  alert_ids uuid[] not null default '{}',
  recipients text[] not null default '{}',
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists ops_email_log_recent_idx on public.ops_email_log (kind, created_at desc);
alter table public.ops_email_log enable row level security;
grant all on public.ops_email_log to service_role;

-- ============ The check catalogue ============

create table if not exists public.ops_checks (
  key text primary key,
  label text not null,
  area text not null check (area in ('care', 'talent', 'email', 'payments', 'jobs', 'services', 'functions')),
  description text not null,
  fn text not null,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  last_run_at timestamptz,
  last_status text,
  last_error text
);
alter table public.ops_checks enable row level security;
grant all on public.ops_checks to service_role;

-- What each check found on its latest run, green results included.
create table if not exists public.ops_check_results (
  check_key text not null references public.ops_checks(key) on delete cascade,
  subkey text not null,
  status text not null check (status in ('ok', 'info', 'warning', 'critical')),
  title text not null,
  summary text,
  detail jsonb not null default '{}'::jsonb,
  link text,
  observed_at timestamptz not null default now(),
  primary key (check_key, subkey)
);
alter table public.ops_check_results enable row level security;
grant all on public.ops_check_results to service_role;

-- How often a cron schedule should fire, for the patterns used here.
-- Null when the pattern is not one we can read; those jobs are not checked for lateness.
create or replace function private.ops_cron_interval(_schedule text)
returns interval
language plpgsql
immutable
as $$
declare
  f text[] := regexp_split_to_array(trim(_schedule), '\s+');
begin
  if array_length(f, 1) <> 5 then return null; end if;
  if f[1] ~ '^\*/\d+$' and f[2] = '*' and f[3] = '*' and f[4] = '*' and f[5] = '*' then
    return make_interval(mins => substr(f[1], 3)::int);
  end if;
  if f[1] = '*' and f[2] = '*' and f[3] = '*' and f[4] = '*' and f[5] = '*' then
    return interval '1 minute';
  end if;
  if f[1] ~ '^\d+$' and f[2] = '*' and f[3] = '*' and f[4] = '*' and f[5] = '*' then
    return interval '1 hour';
  end if;
  if f[1] ~ '^\d+$' and f[2] ~ '^\*/\d+$' and f[3] = '*' and f[4] = '*' and f[5] = '*' then
    return make_interval(hours => substr(f[2], 3)::int);
  end if;
  if f[1] ~ '^\d+$' and f[2] ~ '^\d+$' and f[3] = '*' and f[4] = '*' and f[5] = '*' then
    return interval '1 day';
  end if;
  if f[1] ~ '^\d+$' and f[2] ~ '^\d+$' and f[3] = '*' and f[4] = '*' and f[5] ~ '^\d$' then
    return interval '7 days';
  end if;
  return null;
end;
$$;

-- "2 hours", "15 minutes", "3 days": for summaries people read.
create or replace function private.ops_human_interval(_i interval)
returns text
language sql
immutable
as $$
  select case
    when _i is null then 'unknown'
    when _i >= interval '2 days' then floor(extract(epoch from _i) / 86400)::int || ' days'
    when _i >= interval '1 day' then '1 day'
    when _i >= interval '2 hours' then floor(extract(epoch from _i) / 3600)::int || ' hours'
    when _i >= interval '1 hour' then '1 hour'
    when _i >= interval '2 minutes' then floor(extract(epoch from _i) / 60)::int || ' minutes'
    else '1 minute'
  end
$$;

-- What each care notification kind is called on screen and in email.
create or replace function private.ops_notification_label(_kind text)
returns text
language sql
immutable
as $$
  select case _kind
    when 'pre_assessment_link' then 'Pre-assessment link'
    when 'portal_invitation' then 'Portal invitation'
    when 'account_setup' then 'Account set-up email'
    when 'assessment_returned' then 'Assessment returned notice'
    when 'assessment_accepted' then 'Assessment accepted notice'
    else initcap(replace(_kind, '_', ' '))
  end
$$;

-- ---- Check: scheduled jobs ----
create or replace function private.ops_check_scheduled_jobs(_cfg jsonb)
returns table (subkey text, status text, title text, summary text, detail jsonb, link text)
language plpgsql
security definer
set search_path = public, private, cron
as $$
#variable_conflict use_column
declare
  j record;
  v_failures integer;
  v_last record;
  v_every interval;
  v_late interval;
  v_crit_failures integer := coalesce((_cfg->>'consecutive_failures_critical')::int, 3);
  v_late_warn numeric := coalesce((_cfg->>'late_warning_multiple')::numeric, 2);
  v_late_crit numeric := coalesce((_cfg->>'late_critical_multiple')::numeric, 4);
begin
  for j in select jobid, jobname, schedule, active from cron.job order by jobname loop
    select d.status, d.start_time, d.end_time, d.return_message
      into v_last
      from cron.job_run_details d
     where d.jobid = j.jobid
     order by d.start_time desc nulls last
     limit 1;

    -- Failures in a row, newest first, stopping at the first success.
    select count(*) into v_failures
      from (
        select d.status,
               bool_or(d.status = 'succeeded') over (order by d.start_time desc rows between unbounded preceding and current row) as seen_ok
          from cron.job_run_details d
         where d.jobid = j.jobid and d.status in ('succeeded', 'failed')
         order by d.start_time desc
         limit 50
      ) x
     where x.status = 'failed' and not x.seen_ok;

    v_every := private.ops_cron_interval(j.schedule);
    v_late := case when v_every is not null and v_last.start_time is not null
                   then now() - v_last.start_time - v_every end;

    subkey := j.jobname;
    link := null;
    detail := jsonb_build_object(
      'schedule', j.schedule, 'active', j.active,
      'last_status', v_last.status, 'last_started', v_last.start_time,
      'last_message', left(v_last.return_message, 300), 'consecutive_failures', v_failures);

    if not j.active then
      status := 'warning';
      title := 'Scheduled job paused: ' || j.jobname;
      summary := 'This job is switched off and will not run until it is activated.';
    elsif v_failures >= v_crit_failures then
      status := 'critical';
      title := 'Scheduled job failing: ' || j.jobname;
      summary := format('The last %s runs failed. Latest error: %s', v_failures, coalesce(left(v_last.return_message, 200), 'none recorded'));
    elsif v_failures > 0 then
      status := 'warning';
      title := 'Scheduled job failed: ' || j.jobname;
      summary := 'The latest run failed: ' || coalesce(left(v_last.return_message, 200), 'no error recorded');
    elsif v_every is not null and v_last.start_time is not null
          and now() - v_last.start_time > v_every * v_late_crit then
      status := 'critical';
      title := 'Scheduled job not running: ' || j.jobname;
      summary := format('Last ran %s ago; it should run every %s.', private.ops_human_interval(now() - v_last.start_time), private.ops_human_interval(v_every));
    elsif v_every is not null and v_last.start_time is not null
          and now() - v_last.start_time > v_every * v_late_warn then
      status := 'warning';
      title := 'Scheduled job running late: ' || j.jobname;
      summary := format('Last ran %s ago; it should run every %s.', private.ops_human_interval(now() - v_last.start_time), private.ops_human_interval(v_every));
    else
      status := 'ok';
      title := j.jobname;
      summary := case when v_last.start_time is null then 'No runs recorded yet.'
                      else 'Last run ' || v_last.status || '.' end;
    end if;
    return next;
  end loop;
end;
$$;

-- ---- Check: care notifications ----
create or replace function private.ops_check_care_notifications(_cfg jsonb)
returns table (subkey text, status text, title text, summary text, detail jsonb, link text)
language plpgsql
security definer
set search_path = public, private
as $$
#variable_conflict use_column
declare
  n record;
  v_any boolean := false;
  v_stuck_minutes integer := coalesce((_cfg->>'stuck_minutes')::int, 15);
  v_lookback interval := make_interval(days => coalesce((_cfg->>'lookback_days')::int, 14));
  v_critical text[] := coalesce(
    (select array_agg(value) from jsonb_array_elements_text(_cfg->'critical_kinds')),
    array['pre_assessment_link', 'portal_invitation']);
  v_stuck integer;
  v_oldest timestamptz;
begin
  -- Failed sends with no later successful send of the same kind to the same client.
  for n in
    select cn.*, c.full_name as client_name
      from public.care_notifications cn
      left join public.clients c on c.id = cn.client_id
     where cn.status = 'failed'
       and coalesce(cn.failed_at, cn.updated_at) > now() - v_lookback
       and not exists (
         select 1 from public.care_notifications later
          where later.kind = cn.kind
            and later.client_id is not distinct from cn.client_id
            and later.status = 'sent'
            and later.created_at > cn.created_at)
     order by cn.created_at
  loop
    v_any := true;
    subkey := 'failed:' || n.id;
    status := case when n.kind = any(v_critical) then 'critical' else 'warning' end;
    title := format('%s not delivered%s', private.ops_notification_label(n.kind),
                    case when n.client_name is not null then ' to ' || n.client_name else '' end);
    summary := coalesce('Provider said: ' || left(n.provider_error, 200) || '.', 'The send failed.')
               || ' Resend it from the client record.';
    detail := jsonb_build_object('notification_id', n.id, 'kind', n.kind, 'channel', n.channel,
                                 'attempts', n.attempt_count, 'failed_at', n.failed_at);
    link := case when n.client_id is not null then '/admin/clients/' || n.client_id end;
    return next;
  end loop;

  select count(*), min(coalesce(last_attempt_at, queued_at))
    into v_stuck, v_oldest
    from public.care_notifications
   where (status = 'sending' and coalesce(last_attempt_at, queued_at) < now() - make_interval(mins => v_stuck_minutes))
      or (status = 'queued' and queued_at < now() - make_interval(mins => v_stuck_minutes));

  if v_stuck > 0 then
    v_any := true;
    subkey := 'stuck';
    status := 'warning';
    title := format('%s care notification%s stuck', v_stuck, case when v_stuck = 1 then '' else 's' end);
    summary := format('Queued or sending for more than %s minutes; oldest since %s.', v_stuck_minutes,
                      to_char(v_oldest at time zone 'Africa/Lagos', 'DD Mon HH24:MI'));
    detail := jsonb_build_object('count', v_stuck, 'oldest', v_oldest);
    link := '/admin/care/requests';
    return next;
  end if;

  if not v_any then
    subkey := 'all'; status := 'ok'; title := 'Care notifications';
    summary := 'Every recent notification was delivered.'; detail := '{}'::jsonb; link := null;
    return next;
  end if;
end;
$$;

-- ---- Check: email delivery ----
create or replace function private.ops_check_email_delivery(_cfg jsonb)
returns table (subkey text, status text, title text, summary text, detail jsonb, link text)
language plpgsql
security definer
set search_path = public, private
as $$
#variable_conflict use_column
declare
  v_sent integer; v_bounced integer; v_complained integer; v_failed integer;
  v_rate numeric;
  v_last timestamptz; v_week integer;
  v_rate_warn numeric := coalesce((_cfg->>'bounce_rate_warning')::numeric, 0.05);
  v_min_sent integer := coalesce((_cfg->>'min_sent')::int, 20);
  v_quiet_hours integer := coalesce((_cfg->>'quiet_hours')::int, 48);
begin
  select count(*) filter (where event_type in ('sent', 'delivered')),
         count(*) filter (where event_type = 'bounced'),
         count(*) filter (where event_type = 'complained'),
         count(*) filter (where event_type = 'failed')
    into v_sent, v_bounced, v_complained, v_failed
    from public.campaign_events
   where created_at > now() - interval '24 hours';

  v_rate := case when v_sent + v_bounced > 0 then v_bounced::numeric / (v_sent + v_bounced) else 0 end;

  subkey := 'bounces';
  detail := jsonb_build_object('sent', v_sent, 'bounced', v_bounced, 'failed', v_failed, 'rate', round(v_rate, 3));
  link := '/admin/campaigns';
  if v_sent + v_bounced >= v_min_sent and v_rate > v_rate_warn then
    status := 'warning';
    title := format('Email bounce rate %s%%', round(v_rate * 100, 1));
    summary := format('%s of %s emails bounced in the last 24 hours. A high rate can get the domain blocked.',
                      v_bounced, v_sent + v_bounced);
  elsif v_failed > 0 then
    status := 'warning';
    title := format('%s email%s failed to send', v_failed, case when v_failed = 1 then '' else 's' end);
    summary := 'Resend reported sends that failed in the last 24 hours.';
  else
    status := 'ok'; title := 'Email bounces';
    summary := format('%s bounced of %s in the last 24 hours.', v_bounced, v_sent + v_bounced);
  end if;
  return next;

  subkey := 'complaints';
  detail := jsonb_build_object('complained', v_complained);
  if v_complained > 0 then
    status := 'critical';
    title := format('%s spam complaint%s', v_complained, case when v_complained = 1 then '' else 's' end);
    summary := 'Someone marked an email as spam in the last 24 hours. The address has been suppressed.';
  else
    status := 'ok'; title := 'Spam complaints'; summary := 'None in the last 24 hours.';
  end if;
  return next;

  -- Delivery tracking has gone quiet after a normal week: the webhook is probably broken.
  select max(created_at), count(*) filter (where created_at > now() - interval '7 days')
    into v_last, v_week
    from public.campaign_events
   where created_at > now() - interval '8 days';
  subkey := 'tracking';
  detail := jsonb_build_object('last_event', v_last, 'events_last_week', v_week);
  link := null;
  if v_week >= 20 and v_last < now() - make_interval(hours => v_quiet_hours) then
    status := 'warning';
    title := 'Email delivery tracking has gone quiet';
    summary := format('No delivery events from Resend since %s. Check the Resend webhook.',
                      to_char(v_last at time zone 'Africa/Lagos', 'DD Mon HH24:MI'));
  else
    status := 'ok'; title := 'Delivery tracking'; summary := 'Resend events are arriving.';
  end if;
  return next;
end;
$$;

-- ---- Check: CV and document reading ----
create or replace function private.ops_check_parsing(_cfg jsonb)
returns table (subkey text, status text, title text, summary text, detail jsonb, link text)
language plpgsql
security definer
set search_path = public, private
as $$
#variable_conflict use_column
declare
  v_waiting integer; v_oldest timestamptz; v_gave_up integer;
  v_docs integer; v_doc_oldest timestamptz;
  v_count_warn integer := coalesce((_cfg->>'waiting_warning')::int, 25);
  v_age_warn interval := make_interval(mins => coalesce((_cfg->>'oldest_warning_minutes')::int, 60));
  v_age_crit interval := make_interval(mins => coalesce((_cfg->>'oldest_critical_minutes')::int, 360));
begin
  select count(*) filter (where coalesce(p.parse_status, 'not_parsed') in ('not_parsed', 'queued') and p.parse_attempts < 3),
         min(coalesce(p.parse_last_attempt_at, p.created_at))
           filter (where coalesce(p.parse_status, 'not_parsed') in ('not_parsed', 'queued') and p.parse_attempts < 3),
         count(*) filter (where p.parse_status = 'failed' and p.parse_attempts >= 3)
    into v_waiting, v_oldest, v_gave_up
    from public.mu_people p
   where exists (select 1 from public.mu_documents d where d.person_id = p.id and d.doc_type = 'CV');

  subkey := 'cv';
  link := '/admin/match-universe/intake';
  detail := jsonb_build_object('waiting', v_waiting, 'oldest', v_oldest, 'gave_up', v_gave_up);
  if v_waiting > 0 and now() - v_oldest > v_age_crit then
    status := 'critical';
    title := 'CV reading has stalled';
    summary := format('%s CV%s waiting; the oldest since %s.', v_waiting, case when v_waiting = 1 then '' else 's' end, to_char(v_oldest at time zone 'Africa/Lagos', 'DD Mon HH24:MI'));
  elsif v_waiting >= v_count_warn or (v_waiting > 0 and now() - v_oldest > v_age_warn) then
    status := 'warning';
    title := format('%s CV%s waiting to be read', v_waiting, case when v_waiting = 1 then '' else 's' end);
    summary := format('The oldest has waited since %s.', to_char(v_oldest at time zone 'Africa/Lagos', 'DD Mon HH24:MI'));
  elsif v_gave_up > 0 then
    status := 'info';
    title := format('%s CV%s could not be read', v_gave_up, case when v_gave_up = 1 then '' else 's' end);
    summary := 'Three attempts failed. These need reading by hand.';
  else
    status := 'ok'; title := 'CV reading';
    summary := case when v_waiting = 0 then 'Nothing waiting.' else v_waiting || ' waiting, within normal time.' end;
  end if;
  return next;

  select count(*), min(created_at)
    into v_docs, v_doc_oldest
    from public.mu_documents
   where classified_at is null and rejected = false and coalesce(doc_kind, 'other') <> 'cv';

  subkey := 'documents';
  link := '/admin/match-universe/verification';
  detail := jsonb_build_object('waiting', v_docs, 'oldest', v_doc_oldest);
  if v_docs > 0 and now() - v_doc_oldest > v_age_crit then
    status := 'critical';
    title := 'Document reading has stalled';
    summary := format('%s document%s waiting; the oldest since %s.', v_docs, case when v_docs = 1 then '' else 's' end, to_char(v_doc_oldest at time zone 'Africa/Lagos', 'DD Mon HH24:MI'));
  elsif v_docs >= v_count_warn or (v_docs > 0 and now() - v_doc_oldest > v_age_warn) then
    status := 'warning';
    title := format('%s document%s waiting to be read', v_docs, case when v_docs = 1 then '' else 's' end);
    summary := format('The oldest has waited since %s.', to_char(v_doc_oldest at time zone 'Africa/Lagos', 'DD Mon HH24:MI'));
  else
    status := 'ok'; title := 'Document reading';
    summary := case when v_docs = 0 then 'Nothing waiting.' else v_docs || ' waiting, within normal time.' end;
  end if;
  return next;
end;
$$;

-- ---- Check: candidate follow-up queue ----
create or replace function private.ops_check_followup_queue(_cfg jsonb)
returns table (subkey text, status text, title text, summary text, detail jsonb, link text)
language plpgsql
security definer
set search_path = public, private
as $$
#variable_conflict use_column
declare
  v_overdue integer; v_oldest timestamptz;
  v_hours integer := coalesce((_cfg->>'overdue_hours')::int, 26);
begin
  select count(*), min(queued_at) into v_overdue, v_oldest
    from public.followup_queue
   where status = 'pending' and queued_at < now() - make_interval(hours => v_hours);

  subkey := 'pending';
  link := '/admin/intelligence';
  detail := jsonb_build_object('overdue', v_overdue, 'oldest', v_oldest);
  if v_overdue > 0 then
    status := 'warning';
    title := format('%s follow-up nudge%s not sent', v_overdue, case when v_overdue = 1 then '' else 's' end);
    summary := format('Queued for more than %s hours. The daily dispatch may not have run.', v_hours);
  else
    status := 'ok'; title := 'Candidate follow-ups'; summary := 'Nudges are going out on schedule.';
  end if;
  return next;
end;
$$;

-- ---- Check: edge function errors ----
create or replace function private.ops_check_function_errors(_cfg jsonb)
returns table (subkey text, status text, title text, summary text, detail jsonb, link text)
language plpgsql
security definer
set search_path = public, private
as $$
#variable_conflict use_column
declare
  r record;
  v_any boolean := false;
  v_window interval := make_interval(mins => coalesce((_cfg->>'window_minutes')::int, 15));
  v_threshold integer := coalesce((_cfg->>'warning_count')::int, 5);
  v_critical_window interval := make_interval(mins => coalesce((_cfg->>'critical_window_minutes')::int, 60));
  v_critical text[] := coalesce(
    (select array_agg(value) from jsonb_array_elements_text(_cfg->'critical_functions')),
    array['paystack-invoice-webhook', 'paystack-invoice', 'care-token-send', 'care-portal-invite', 'contract-sign']);
begin
  for r in
    select e.function_name,
           count(*) filter (where e.occurred_at > now() - v_window) as recent,
           count(*) as in_hour,
           max(e.occurred_at) as last_at,
           (array_agg(e.message order by e.occurred_at desc))[1] as last_message
      from public.ops_function_errors e
     where e.occurred_at > now() - greatest(v_window, v_critical_window)
     group by e.function_name
     order by e.function_name
  loop
    if r.function_name = any(v_critical) then
      status := 'critical';
    elsif r.recent >= v_threshold then
      status := 'warning';
    else
      continue;
    end if;
    v_any := true;
    subkey := r.function_name;
    title := 'Errors in ' || r.function_name;
    summary := format('%s error%s in the last hour. Latest: %s', r.in_hour, case when r.in_hour = 1 then '' else 's' end,
                      coalesce(left(r.last_message, 200), 'no message'));
    detail := jsonb_build_object('last_hour', r.in_hour, 'recent', r.recent, 'last_at', r.last_at);
    link := null;
    return next;
  end loop;

  if not v_any then
    subkey := 'all'; status := 'ok'; title := 'Back-end functions';
    summary := 'No error pattern in the last hour.'; detail := '{}'::jsonb; link := null;
    return next;
  end if;
end;
$$;

-- ---- Check: outside services ----
create or replace function private.ops_check_external_services(_cfg jsonb)
returns table (subkey text, status text, title text, summary text, detail jsonb, link text)
language plpgsql
security definer
set search_path = public, private
as $$
#variable_conflict use_column
declare
  r record;
  v_label text;
  v_stale interval := make_interval(mins => coalesce((_cfg->>'stale_minutes')::int, 90));
begin
  for r in
    select s.service, p.status as probe_status, p.latency_ms, p.message, p.checked_at
      from (values ('resend'), ('paystack'), ('anthropic'), ('google_maps')) as s(service)
      left join lateral (
        select * from public.ops_probe_results x
         where x.service = s.service order by x.checked_at desc limit 1) p on true
  loop
    v_label := case r.service when 'resend' then 'Resend (email)' when 'paystack' then 'Paystack (payments)'
                              when 'anthropic' then 'Anthropic (document reading)' when 'google_maps' then 'Google Maps (addresses)' end;
    subkey := r.service;
    link := null;
    detail := jsonb_build_object('latency_ms', r.latency_ms, 'checked_at', r.checked_at, 'message', r.message);
    if r.checked_at is null then
      status := 'info'; title := v_label || ': not checked yet';
      summary := 'The service check has not reported yet.';
    elsif r.checked_at < now() - v_stale then
      status := 'warning'; title := v_label || ': no recent check';
      summary := format('Last checked %s. The service check job may have stopped.',
                        to_char(r.checked_at at time zone 'Africa/Lagos', 'DD Mon HH24:MI'));
    elsif r.probe_status = 'down' then
      status := 'critical'; title := v_label || ' is unreachable';
      summary := coalesce(r.message, 'The service did not answer.');
    elsif r.probe_status = 'degraded' then
      status := 'warning'; title := v_label || ' is slow or limited';
      summary := coalesce(r.message, 'Slow response.');
    elsif r.probe_status = 'not_configured' then
      status := 'info'; title := v_label || ': no key set';
      summary := 'Features that rely on this service will not work until its key is set.';
    else
      status := 'ok'; title := v_label;
      summary := format('Answered in %s ms.', r.latency_ms);
    end if;
    return next;
  end loop;
end;
$$;

revoke all on function
  private.ops_check_scheduled_jobs(jsonb),
  private.ops_check_care_notifications(jsonb),
  private.ops_check_email_delivery(jsonb),
  private.ops_check_parsing(jsonb),
  private.ops_check_followup_queue(jsonb),
  private.ops_check_function_errors(jsonb),
  private.ops_check_external_services(jsonb)
from public, anon, authenticated;

insert into public.ops_checks (key, label, area, description, fn, config, sort_order) values
  ('scheduled_jobs', 'Scheduled jobs', 'jobs',
   'Every cron job: paused, failing, or not running as often as its schedule says.',
   'ops_check_scheduled_jobs',
   '{"consecutive_failures_critical": 3, "late_warning_multiple": 2, "late_critical_multiple": 4}', 10),
  ('care_notifications', 'Care notifications', 'care',
   'Pre-assessment links, portal invitations and other care messages that failed or are stuck.',
   'ops_check_care_notifications',
   '{"stuck_minutes": 15, "lookback_days": 14, "critical_kinds": ["pre_assessment_link", "portal_invitation"]}', 20),
  ('email_delivery', 'Email delivery', 'email',
   'Bounces, spam complaints and whether delivery tracking from Resend is still arriving.',
   'ops_check_email_delivery',
   '{"bounce_rate_warning": 0.05, "min_sent": 20, "quiet_hours": 48}', 30),
  ('parsing', 'CV and document reading', 'talent',
   'The queues that read candidate CVs and documents.',
   'ops_check_parsing',
   '{"waiting_warning": 25, "oldest_warning_minutes": 60, "oldest_critical_minutes": 360}', 40),
  ('followup_queue', 'Candidate follow-ups', 'talent',
   'Nudges to invited candidates who have gone quiet.',
   'ops_check_followup_queue',
   '{"overdue_hours": 26}', 50),
  ('function_errors', 'Back-end functions', 'functions',
   'Errors from edge functions. Any error in payments, care links, portal invitations or contract signing is critical.',
   'ops_check_function_errors',
   '{"window_minutes": 15, "warning_count": 5, "critical_window_minutes": 60, "critical_functions": ["paystack-invoice-webhook", "paystack-invoice", "care-token-send", "care-portal-invite", "contract-sign"]}', 60),
  ('external_services', 'Outside services', 'services',
   'Whether Resend, Paystack, Anthropic and Google Maps answer with our keys.',
   'ops_check_external_services',
   '{"stale_minutes": 90}', 70)
on conflict (key) do update
  set label = excluded.label, area = excluded.area, description = excluded.description,
      fn = excluded.fn, sort_order = excluded.sort_order;

-- ============ Running the checks ============

-- Alerts that should go out by email now. Critical: at once, again after 30
-- minutes, then hourly, five emails at most, until acknowledged. Warnings: at
-- most one batch an hour, or straight away alongside a critical. Info: digest only.
create or replace function private.ops_alerts_due()
returns setof public.admin_alerts
language sql
stable
security definer
set search_path = public, private
as $$
  with critical_due as (
    select a.* from public.admin_alerts a
     where a.resolved_at is null and a.acknowledged_at is null and a.severity = 'critical' and a.kind <> 'test'
       and (a.email_count = 0
            or (a.email_count < 5
                and a.last_emailed_at < now() - case when a.email_count = 1 then interval '30 minutes' else interval '60 minutes' end))
  ), last_batch as (
    select max(created_at) as at from public.ops_email_log where kind = 'alerts' and status = 'sent'
  )
  select * from critical_due
  union all
  select a.* from public.admin_alerts a
   where a.resolved_at is null and a.acknowledged_at is null and a.severity = 'warning' and a.email_count = 0 and a.kind <> 'test'
     and (exists (select 1 from critical_due)
          or coalesce((select at from last_batch), '-infinity') < now() - interval '59 minutes')
$$;
revoke all on function private.ops_alerts_due() from public, anon, authenticated;

-- Calls one of our edge functions from the database, authorised by the alert key.
create or replace function private.ops_call_function(_name text, _body jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_url text;
  v_key text;
begin
  select value into v_url from private.app_config where key = 'functions_url';
  select value into v_key from private.job_keys where name = 'admin_alert_key';
  if v_url is null or v_key is null then
    raise warning 'ops_call_function: functions_url or admin_alert_key is not configured';
    return;
  end if;
  perform net.http_post(
    url := v_url || '/' || _name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-run-key', v_key),
    body := _body);
end;
$$;
revoke all on function private.ops_call_function(text, jsonb) from public, anon, authenticated;

create or replace function private.ops_run_checks()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  c record;
  r record;
  v_run_at timestamptz := clock_timestamp();
  v_failing text[];
  v_worst text;
  v_dedupe text;
  v_open integer;
begin
  for c in select * from public.ops_checks where enabled order by sort_order, key loop
    v_failing := '{}';
    v_worst := 'ok';
    begin
      for r in execute format('select * from private.%I($1)', c.fn) using c.config loop
        insert into public.ops_check_results (check_key, subkey, status, title, summary, detail, link, observed_at)
        values (c.key, r.subkey, r.status, r.title, r.summary, coalesce(r.detail, '{}'::jsonb), r.link, v_run_at)
        on conflict (check_key, subkey) do update
          set status = excluded.status, title = excluded.title, summary = excluded.summary,
              detail = excluded.detail, link = excluded.link, observed_at = excluded.observed_at;

        if private.ops_severity_rank(r.status) > private.ops_severity_rank(v_worst) then
          v_worst := r.status;
        end if;

        if r.status <> 'ok' then
          v_dedupe := c.key || ':' || r.subkey;
          v_failing := v_failing || v_dedupe;
          insert into public.admin_alerts (kind, title, detail, severity, source, area, dedupe_key, summary, link)
          values (c.key, r.title, coalesce(r.detail, '{}'::jsonb), r.status, 'ops', c.area, v_dedupe, r.summary, r.link)
          on conflict (dedupe_key) where resolved_at is null and dedupe_key is not null do update
            set title = excluded.title,
                summary = excluded.summary,
                detail = excluded.detail,
                link = excluded.link,
                last_seen_at = now(),
                occurrences = public.admin_alerts.occurrences + 1,
                -- Escalating to critical re-arms the emails, even if a warning was acknowledged.
                acknowledged_at = case when private.ops_severity_rank(excluded.severity) > private.ops_severity_rank(public.admin_alerts.severity)
                                       then null else public.admin_alerts.acknowledged_at end,
                acknowledged_by = case when private.ops_severity_rank(excluded.severity) > private.ops_severity_rank(public.admin_alerts.severity)
                                       then null else public.admin_alerts.acknowledged_by end,
                email_count = case when private.ops_severity_rank(excluded.severity) > private.ops_severity_rank(public.admin_alerts.severity)
                                   then 0 else public.admin_alerts.email_count end,
                severity = excluded.severity;
        end if;
      end loop;

      delete from public.ops_check_results where check_key = c.key and observed_at < v_run_at;

      update public.admin_alerts
         set resolved_at = now(), resolution_note = 'Cleared automatically'
       where source = 'ops' and kind = c.key and resolved_at is null
         and not (dedupe_key = any(v_failing));

      update public.ops_checks set last_run_at = now(), last_status = v_worst, last_error = null where key = c.key;
    exception when others then
      update public.ops_checks set last_run_at = now(), last_status = 'error', last_error = left(sqlerrm, 500) where key = c.key;
      insert into public.admin_alerts (kind, title, detail, severity, source, area, dedupe_key, summary)
      values (c.key, 'Health check broken: ' || c.label, jsonb_build_object('error', left(sqlerrm, 500)),
              'warning', 'ops', c.area, c.key || ':check_error', 'The check itself failed to run: ' || left(sqlerrm, 200))
      on conflict (dedupe_key) where resolved_at is null and dedupe_key is not null do update
        set last_seen_at = now(), occurrences = public.admin_alerts.occurrences + 1, detail = excluded.detail;
    end;

    -- A check that ran cleanly clears its own "broken" alert.
    if (select last_error from public.ops_checks where key = c.key) is null then
      update public.admin_alerts set resolved_at = now(), resolution_note = 'Cleared automatically'
       where dedupe_key = c.key || ':check_error' and resolved_at is null;
    end if;
  end loop;

  -- Housekeeping.
  delete from public.ops_function_errors where occurred_at < now() - interval '30 days';
  delete from public.ops_probe_results where checked_at < now() - interval '7 days';
  delete from public.ops_email_log where created_at < now() - interval '90 days';

  if exists (select 1 from private.ops_alerts_due()) then
    perform private.ops_call_function('send-admin-alert', '{"mode": "alerts"}'::jsonb);
  end if;

  select count(*) into v_open from public.admin_alerts where resolved_at is null;
  return v_open;
end;
$$;
revoke all on function private.ops_run_checks() from public, anon, authenticated;

-- ============ Email: claim, report, digest (service role only) ============

create or replace function public.ops_claim_alert_email(_recipients text[])
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_ids uuid[];
  v_log uuid;
  v_alerts jsonb;
begin
  -- One sender at a time: a second caller waits, then finds nothing due.
  perform pg_advisory_xact_lock(hashtext('ops_alert_email'));

  select array_agg(id) into v_ids from private.ops_alerts_due();
  if v_ids is null then
    return jsonb_build_object('log_id', null, 'alerts', '[]'::jsonb);
  end if;

  insert into public.ops_email_log (kind, alert_ids, recipients)
  values ('alerts', v_ids, coalesce(_recipients, '{}')) returning id into v_log;

  update public.admin_alerts
     set email_count = email_count + 1,
         last_emailed_at = now(),
         emailed_at = coalesce(emailed_at, now())
   where id = any(v_ids);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'severity', a.severity, 'area', a.area, 'title', a.title,
           'summary', coalesce(a.summary, a.detail->>'reason'), 'link', a.link,
           'created_at', a.created_at, 'email_count', a.email_count)
         order by private.ops_severity_rank(a.severity) desc, a.created_at), '[]'::jsonb)
    into v_alerts
    from public.admin_alerts a where a.id = any(v_ids);

  return jsonb_build_object('log_id', v_log, 'alerts', v_alerts);
end;
$$;

create or replace function public.ops_finish_email(_log_id uuid, _ok boolean, _error text default null)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_log public.ops_email_log;
begin
  update public.ops_email_log
     set status = case when _ok then 'sent' else 'failed' end, error = left(_error, 1000), finished_at = now()
   where id = _log_id
  returning * into v_log;

  -- A failed send gives the alerts back, so the next run tries again.
  if not _ok and v_log.kind = 'alerts' then
    update public.admin_alerts
       set email_count = greatest(email_count - 1, 0),
           last_emailed_at = case when email_count <= 1 then null else last_emailed_at - interval '1 hour' end,
           emailed_at = case when email_count <= 1 then null else emailed_at end
     where id = any(v_log.alert_ids);
  end if;
end;
$$;

create or replace function public.ops_start_digest(_recipients text[])
returns uuid
language sql
security definer
set search_path = public, private
as $$
  insert into public.ops_email_log (kind, recipients) values ('digest', coalesce(_recipients, '{}')) returning id
$$;

-- Everything the 07:45 email says, in one document.
create or replace function public.ops_digest()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_from timestamptz := ((v_today - 1)::timestamp at time zone 'Africa/Lagos');
  v_to timestamptz := (v_today::timestamp at time zone 'Africa/Lagos');
  v_volumes jsonb := '{}'::jsonb;
  v_n integer;
begin
  -- Each count stands alone, so one missing table never sinks the digest.
  begin select count(*) into v_n from public.contact_submissions where created_at >= v_from and created_at < v_to;
        v_volumes := v_volumes || jsonb_build_object('enquiries', v_n); exception when others then null; end;
  begin select count(*) into v_n from public.care_requests where created_at >= v_from and created_at < v_to;
        v_volumes := v_volumes || jsonb_build_object('care_requests', v_n); exception when others then null; end;
  begin select count(*) into v_n from public.mu_people where created_at >= v_from and created_at < v_to;
        v_volumes := v_volumes || jsonb_build_object('candidates', v_n); exception when others then null; end;
  begin select count(*) into v_n from public.campaign_events where event_type = 'delivered' and created_at >= v_from and created_at < v_to;
        v_volumes := v_volumes || jsonb_build_object('emails_delivered', v_n); exception when others then null; end;
  begin select count(*) into v_n from public.invoices where status = 'paid' and updated_at >= v_from and updated_at < v_to;
        v_volumes := v_volumes || jsonb_build_object('invoices_paid', v_n); exception when others then null; end;
  begin select count(*) into v_n from public.care_notifications where status = 'sent' and sent_at >= v_from and sent_at < v_to;
        v_volumes := v_volumes || jsonb_build_object('care_messages_sent', v_n); exception when others then null; end;

  return jsonb_build_object(
    'date', v_today - 1,
    'overall', coalesce((
      select case max(private.ops_severity_rank(status)) when 3 then 'critical' when 2 then 'warning' when 1 then 'info' else 'ok' end
        from public.ops_check_results), 'ok'),
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object('area', area, 'status', status) order by area)
        from (select c.area,
                     case max(private.ops_severity_rank(r.status)) when 3 then 'critical' when 2 then 'warning' when 1 then 'info' else 'ok' end as status
                from public.ops_checks c left join public.ops_check_results r on r.check_key = c.key
               where c.enabled group by c.area) x), '[]'::jsonb),
    'open', coalesce((
      select jsonb_agg(jsonb_build_object(
               'severity', severity, 'title', title, 'summary', coalesce(summary, detail->>'reason'),
               'since', created_at, 'acknowledged', acknowledged_at is not null, 'link', link)
             order by private.ops_severity_rank(severity) desc, created_at)
        from public.admin_alerts where resolved_at is null), '[]'::jsonb),
    'cleared', coalesce((
      select jsonb_agg(jsonb_build_object('title', title, 'resolved_at', resolved_at, 'note', resolution_note) order by resolved_at)
        from public.admin_alerts where resolved_at >= now() - interval '24 hours'), '[]'::jsonb),
    'volumes', v_volumes,
    'awaiting', jsonb_build_object(
      'approvals', (select count(*) from public.blog_posts where approval_status = 'pending')
                 + (select count(*) from public.campaigns where approval_status = 'pending'),
      'new_enquiries', (select count(*) from public.contact_submissions where archived = false and status = 'new'))
  );
end;
$$;

revoke all on function
  public.ops_claim_alert_email(text[]),
  public.ops_finish_email(uuid, boolean, text),
  public.ops_start_digest(text[]),
  public.ops_digest()
from public, anon, authenticated;
grant execute on function
  public.ops_claim_alert_email(text[]),
  public.ops_finish_email(uuid, boolean, text),
  public.ops_start_digest(text[]),
  public.ops_digest()
to service_role;

-- ============ The live screen (system_health permission) ============

create or replace function public.ops_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, cron
as $$
declare
  v_jobs jsonb := '[]'::jsonb;
begin
  if not private.has_admin_permission(auth.uid(), 'system_health') then
    raise exception 'not_permitted' using errcode = '42501';
  end if;

  begin
    select coalesce(jsonb_agg(jsonb_build_object(
             'name', j.jobname, 'schedule', j.schedule, 'active', j.active,
             'runs', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'status', d.status, 'started', d.start_time, 'ended', d.end_time,
                        'message', left(d.return_message, 300)) order by d.start_time desc)
                 from (select * from cron.job_run_details d0 where d0.jobid = j.jobid
                        order by d0.start_time desc nulls last limit 5) d), '[]'::jsonb))
           order by j.jobname), '[]'::jsonb)
      into v_jobs
      from cron.job j;
  exception when others then
    v_jobs := '[]'::jsonb;
  end;

  return jsonb_build_object(
    'generated_at', now(),
    'checks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', c.key, 'label', c.label, 'area', c.area, 'description', c.description,
               'enabled', c.enabled, 'last_run_at', c.last_run_at, 'last_status', c.last_status, 'last_error', c.last_error,
               'results', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'subkey', r.subkey, 'status', r.status, 'title', r.title, 'summary', r.summary,
                          'detail', r.detail, 'link', r.link, 'observed_at', r.observed_at)
                        order by private.ops_severity_rank(r.status) desc, r.subkey)
                   from public.ops_check_results r where r.check_key = c.key), '[]'::jsonb))
             order by c.sort_order, c.key)
        from public.ops_checks c), '[]'::jsonb),
    'alerts', coalesce((
      select jsonb_agg(to_jsonb(a) order by private.ops_severity_rank(a.severity) desc, a.created_at desc)
        from public.admin_alerts a where a.resolved_at is null), '[]'::jsonb),
    'recently_resolved', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.resolved_at desc)
        from (select * from public.admin_alerts where resolved_at > now() - interval '24 hours'
               order by resolved_at desc limit 25) a), '[]'::jsonb),
    'jobs', v_jobs,
    'function_errors', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.occurred_at desc)
        from (select * from public.ops_function_errors order by occurred_at desc limit 50) e), '[]'::jsonb),
    'emails', coalesce((
      select jsonb_agg(jsonb_build_object('kind', l.kind, 'status', l.status, 'alerts', coalesce(array_length(l.alert_ids, 1), 0),
                                          'error', l.error, 'created_at', l.created_at) order by l.created_at desc)
        from (select * from public.ops_email_log order by created_at desc limit 10) l), '[]'::jsonb)
  );
end;
$$;

create or replace function public.ops_alert_acknowledge(_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.has_admin_permission(auth.uid(), 'system_health') then
    raise exception 'not_permitted' using errcode = '42501';
  end if;
  update public.admin_alerts
     set acknowledged_at = now(), acknowledged_by = auth.uid()
   where id = _id and resolved_at is null and acknowledged_at is null;
end;
$$;

create or replace function public.ops_alert_resolve(_id uuid, _note text default null)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.has_admin_permission(auth.uid(), 'system_health') then
    raise exception 'not_permitted' using errcode = '42501';
  end if;
  update public.admin_alerts
     set resolved_at = now(), resolved_by = auth.uid(), resolution_note = coalesce(nullif(trim(_note), ''), 'Resolved by hand')
   where id = _id and resolved_at is null;
end;
$$;

-- "Check now" on the screen. Same run as the five-minute job.
create or replace function public.ops_run_checks_now()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.has_admin_permission(auth.uid(), 'system_health') then
    raise exception 'not_permitted' using errcode = '42501';
  end if;
  return private.ops_run_checks();
end;
$$;

revoke all on function
  public.ops_overview(), public.ops_alert_acknowledge(uuid), public.ops_alert_resolve(uuid, text), public.ops_run_checks_now()
from public, anon;
grant execute on function
  public.ops_overview(), public.ops_alert_acknowledge(uuid), public.ops_alert_resolve(uuid, text), public.ops_run_checks_now()
to authenticated;

-- ============ Schedules ============

-- While a cutover has the other jobs paused (post-restore.sql creates them
-- paused until go-live), these start paused too, so the new project cannot
-- email alerts before it is live. Go-live activates every job together.
do $$
declare
  v_active boolean;
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in ('ops-run-checks', 'ops-probe', 'ops-daily-digest');
    v_active := not exists (select 1 from cron.job where not active);
    perform cron.alter_job(cron.schedule('ops-run-checks', '*/5 * * * *', 'select private.ops_run_checks();'), active := v_active);
    perform cron.alter_job(cron.schedule('ops-probe', '*/30 * * * *', $c$select private.ops_call_function('ops-probe');$c$), active := v_active);
    -- 06:45 UTC is 07:45 in Lagos, which keeps no daylight saving.
    perform cron.alter_job(cron.schedule('ops-daily-digest', '45 6 * * *',
      $c$select private.ops_call_function('send-admin-alert', '{"mode": "digest"}'::jsonb);$c$), active := v_active);
  end if;
end $$;
