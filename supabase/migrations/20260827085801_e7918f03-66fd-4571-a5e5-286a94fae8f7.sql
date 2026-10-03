
-- ============ Analytics rollups (private; read via security-definer RPCs) ============
create schema if not exists private;

create table if not exists private.analytics_candidate_journey (
  person_id uuid primary key,
  full_name text,
  email text,
  profession text,
  status text,
  verification_state text,
  invited_at timestamptz,
  claimed_at timestamptz,
  first_profile_save_at timestamptz,
  profile_saves integer not null default 0,
  preferences_at timestamptz,
  availability_at timestamptz,
  first_document_at timestamptz,
  documents integer not null default 0,
  questions_open integer not null default 0,
  verification_codes integer not null default 0,
  last_activity_at timestamptz,
  stuck_step text not null default 'not_invited',
  invite_to_claim_hours numeric,
  claim_to_first_save_hours numeric,
  refreshed_at timestamptz not null default now()
);

create table if not exists private.analytics_campaign_daily (
  campaign_id uuid not null,
  day date not null,
  event_type text not null,
  unique_recipients integer not null,
  primary key (campaign_id, day, event_type)
);

create table if not exists private.analytics_signup_failure_hourly (
  hour timestamptz not null,
  reason text not null,
  failures integer not null,
  primary key (hour, reason)
);

revoke all on private.analytics_candidate_journey from public, anon, authenticated;
revoke all on private.analytics_campaign_daily from public, anon, authenticated;
revoke all on private.analytics_signup_failure_hourly from public, anon, authenticated;

-- ============ Follow-up queue ============
create table if not exists public.followup_queue (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.mu_people(id) on delete cascade,
  email text not null,
  reason text not null default 'invited_silent',
  status text not null default 'pending',
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (person_id, reason)
);
grant select, update on public.followup_queue to authenticated;
grant all on public.followup_queue to service_role;
alter table public.followup_queue enable row level security;
create policy "Admins can review the follow-up queue" on public.followup_queue
  for select to authenticated using (private.has_role(auth.uid(), 'admin'::public.app_role));
create policy "Admins can hold or release queue entries" on public.followup_queue
  for update to authenticated using (private.has_role(auth.uid(), 'admin'::public.app_role))
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

-- ============ Admin alerts ============
create table if not exists public.admin_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  emailed_at timestamptz,
  resolved_at timestamptz
);
grant select, update on public.admin_alerts to authenticated;
grant all on public.admin_alerts to service_role;
alter table public.admin_alerts enable row level security;
create policy "Admins can read alerts" on public.admin_alerts
  for select to authenticated using (private.has_role(auth.uid(), 'admin'::public.app_role));
create policy "Admins can resolve alerts" on public.admin_alerts
  for update to authenticated using (private.has_role(auth.uid(), 'admin'::public.app_role))
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

-- ============ Refresh function ============
create or replace function private.analytics_refresh_all()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  -- Candidate journey: one row per person.
  delete from private.analytics_candidate_journey;
  insert into private.analytics_candidate_journey (
    person_id, full_name, email, profession, status, verification_state,
    invited_at, claimed_at,
    first_profile_save_at, profile_saves,
    preferences_at, availability_at,
    first_document_at, documents,
    questions_open, verification_codes, last_activity_at,
    stuck_step, invite_to_claim_hours, claim_to_first_save_hours, refreshed_at
  )
  select
    p.id, p.full_name, p.email, p.profession, p.status, p.verification_state,
    p.invited_at, p.claimed_at,
    saves.first_at, coalesce(saves.n, 0),
    prefs.pref_at,
    avail.av_at,
    docs.first_at, coalesce(docs.n, 0),
    coalesce(q.open_n, 0),
    coalesce(vc.n, 0),
    act.last_at,
    case
      when p.invited_at is null then 'not_invited'
      when p.claimed_at is null then 'awaiting_claim'
      when saves.first_at is null then 'awaiting_first_save'
      when prefs.pref_at is null then 'awaiting_preferences'
      when coalesce(docs.n, 0) = 0 then 'awaiting_documents'
      when coalesce(q.open_n, 0) > 0 then 'questions_outstanding'
      when p.verification_state <> 'verified' then 'awaiting_verification'
      else 'active'
    end,
    case when p.invited_at is not null and p.claimed_at is not null
      then round(extract(epoch from (p.claimed_at - p.invited_at)) / 3600.0, 1) end,
    case when p.claimed_at is not null and saves.first_at is not null
      then round(extract(epoch from (saves.first_at - p.claimed_at)) / 3600.0, 1) end,
    now()
  from public.mu_people p
  left join (
    select person_id, min(created_at) as first_at, count(*) as n
    from public.mu_activity where action = 'candidate_updated_profile'
    group by person_id
  ) saves on saves.person_id = p.id
  left join (
    select person_id, min(updated_at) as pref_at
    from public.mu_work_preferences group by person_id
  ) prefs on prefs.person_id = p.id
  left join (
    select person_id, max(updated_at) as av_at
    from public.mu_availability_recurrence group by person_id
  ) avail on avail.person_id = p.id
  left join (
    select person_id, min(created_at) as first_at, count(*) as n
    from public.mu_documents where superseded_at is null
    group by person_id
  ) docs on docs.person_id = p.id
  left join (
    select person_id, count(*) as open_n
    from public.mu_parsed_fields where status in ('pending', 'queried')
    group by person_id
  ) q on q.person_id = p.id
  left join (
    select person_id, count(*) as n
    from public.mu_verifications where person_id is not null
    group by person_id
  ) vc on vc.person_id = p.id
  left join (
    select person_id, max(created_at) as last_at
    from public.mu_activity group by person_id
  ) act on act.person_id = p.id;

  -- Campaign daily: distinct recipients per campaign/day/event.
  delete from private.analytics_campaign_daily;
  insert into private.analytics_campaign_daily (campaign_id, day, event_type, unique_recipients)
  select campaign_id, created_at::date, event_type, count(distinct lower(recipient_email))
  from public.campaign_events
  where campaign_id is not null
  group by 1, 2, 3;

  -- Sign-up failures per hour.
  delete from private.analytics_signup_failure_hourly;
  insert into private.analytics_signup_failure_hourly (hour, reason, failures)
  select date_trunc('hour', created_at), reason, count(*)
  from public.signup_failures
  group by 1, 2;
end;
$$;
revoke all on function private.analytics_refresh_all() from public, anon, authenticated;

-- ============ Alert check ============
insert into private.job_keys (name, value)
values ('admin_alert_key', 'c0a9f1c2d4e6b8a0f2e4d6c8b0a2f4e6d8c0b2a4f6e8d0c2')
on conflict (name) do nothing;

create or replace function private.analytics_check_alerts()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_new integer := 0;
  v_key text;
begin
  with spikes as (
    select reason, count(*) as n
    from public.signup_failures
    where created_at > now() - interval '1 hour'
    group by reason
    having count(*) >= 5
  ), ins as (
    insert into public.admin_alerts (kind, title, detail)
    select 'signup_failure_spike',
           'Sign-up failures: ' || s.reason,
           jsonb_build_object('reason', s.reason, 'failures_last_hour', s.n)
    from spikes s
    where not exists (
      select 1 from public.admin_alerts a
      where a.kind = 'signup_failure_spike'
        and a.detail->>'reason' = s.reason
        and a.resolved_at is null
        and a.created_at > now() - interval '6 hours'
    )
    returning id
  ), total_spike as (
    insert into public.admin_alerts (kind, title, detail)
    select 'signup_failure_spike',
           'Sign-up failures across all reasons',
           jsonb_build_object('reason', 'all', 'failures_last_hour',
             (select count(*) from public.signup_failures where created_at > now() - interval '1 hour'))
    where (select count(*) from public.signup_failures where created_at > now() - interval '1 hour') >= 10
      and not exists (
        select 1 from public.admin_alerts a
        where a.kind = 'signup_failure_spike' and a.detail->>'reason' = 'all'
          and a.resolved_at is null and a.created_at > now() - interval '6 hours')
    returning id
  )
  select (select count(*) from ins) + (select count(*) from total_spike) into v_new;

  if v_new > 0 then
    select value into v_key from private.job_keys where name = 'admin_alert_key';
    perform net.http_post(
      url := 'https://eylgffhvyuykafxydrul.supabase.co/functions/v1/send-admin-alert',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-run-key', v_key),
      body := '{}'::jsonb
    );
  end if;
  return v_new;
end;
$$;
revoke all on function private.analytics_check_alerts() from public, anon, authenticated;

-- ============ Follow-up queue sweep ============
create or replace function private.followup_queue_sweep()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_n integer;
begin
  with silent as (
    select j.person_id, j.email
    from private.analytics_candidate_journey j
    where j.invited_at is not null
      and j.invited_at < now() - interval '48 hours'
      and (
        j.claimed_at is null
        or (j.first_profile_save_at is null and j.documents = 0 and j.preferences_at is null)
      )
      and j.email is not null
  ), ins as (
    insert into public.followup_queue (person_id, email, reason)
    select person_id, email,
           case when (select claimed_at from private.analytics_candidate_journey j2 where j2.person_id = silent.person_id) is null
                then 'invited_no_account' else 'claimed_no_activity' end
    from silent
    on conflict (person_id, reason) do nothing
    returning id
  )
  select count(*) into v_n from ins;
  return v_n;
end;
$$;
revoke all on function private.followup_queue_sweep() from public, anon, authenticated;

-- ============ Admin RPCs ============
create or replace function public.analytics_refresh()
returns timestamptz
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Not permitted';
  end if;
  perform private.analytics_refresh_all();
  return now();
end;
$$;
revoke all on function public.analytics_refresh() from anon;

create or replace function public.analytics_last_refreshed()
returns timestamptz
language sql
stable
security definer
set search_path = public, private
as $$
  select case when private.has_role(auth.uid(), 'admin'::public.app_role)
    then (select max(refreshed_at) from private.analytics_candidate_journey) end;
$$;
revoke all on function public.analytics_last_refreshed() from anon;

create or replace function public.analytics_funnel()
returns table (stage text, people bigint)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if not private.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Not permitted';
  end if;
  return query
  select 'invited'::text, count(*) from private.analytics_candidate_journey where invited_at is not null
  union all select 'claimed', count(*) from private.analytics_candidate_journey where claimed_at is not null
  union all select 'first_save', count(*) from private.analytics_candidate_journey where first_profile_save_at is not null
  union all select 'preferences', count(*) from private.analytics_candidate_journey where preferences_at is not null
  union all select 'documents', count(*) from private.analytics_candidate_journey where documents > 0
  union all select 'questions_clear', count(*) from private.analytics_candidate_journey where claimed_at is not null and questions_open = 0
  union all select 'verified', count(*) from private.analytics_candidate_journey where verification_state = 'verified';
end;
$$;
revoke all on function public.analytics_funnel() from anon;

create or replace function public.analytics_stuck_breakdown()
returns table (stuck_step text, people bigint)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if not private.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Not permitted';
  end if;
  return query
  select j.stuck_step, count(*) from private.analytics_candidate_journey j
  group by j.stuck_step order by count(*) desc;
end;
$$;
revoke all on function public.analytics_stuck_breakdown() from anon;

create or replace function public.analytics_candidates(_step text default null)
returns setof private.analytics_candidate_journey
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if not private.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Not permitted';
  end if;
  return query
  select j.* from private.analytics_candidate_journey j
  where _step is null or j.stuck_step = _step
  order by j.last_activity_at desc nulls last;
end;
$$;
revoke all on function public.analytics_candidates(text) from anon;

create or replace function public.analytics_campaigns()
returns table (
  campaign_id uuid, title text, status text, sent_at timestamptz, tracking_enabled boolean,
  sent bigint, delivered bigint, opened bigint, clicked bigint, bounced bigint,
  complained bigint, claimed bigint
)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if not private.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Not permitted';
  end if;
  return query
  with ev as (
    select e.campaign_id, lower(e.recipient_email) as em, e.event_type
    from public.campaign_events e where e.campaign_id is not null
  ), agg as (
    select campaign_id,
      count(distinct em) filter (where event_type = 'sent') as sent,
      count(distinct em) filter (where event_type = 'delivered') as delivered,
      count(distinct em) filter (where event_type = 'opened') as opened,
      count(distinct em) filter (where event_type = 'clicked') as clicked,
      count(distinct em) filter (where event_type = 'bounced') as bounced,
      count(distinct em) filter (where event_type = 'complained') as complained
    from ev group by campaign_id
  ), cl as (
    select e.campaign_id, count(distinct ci.email) as claimed
    from (select distinct campaign_id, lower(recipient_email) as em from public.campaign_events where campaign_id is not null) e
    join public.claim_invites ci on lower(ci.email) = e.em and ci.claimed_at is not null
    group by e.campaign_id
  )
  select c.id, c.title, c.status, c.sent_at, coalesce(c.tracking_enabled, false),
         coalesce(a.sent, 0), coalesce(a.delivered, 0), coalesce(a.opened, 0),
         coalesce(a.clicked, 0), coalesce(a.bounced, 0), coalesce(a.complained, 0),
         coalesce(cl.claimed, 0)
  from public.campaigns c
  left join agg a on a.campaign_id = c.id
  left join cl on cl.campaign_id = c.id
  where coalesce(c.archived, false) = false
  order by c.sent_at desc nulls last;
end;
$$;
revoke all on function public.analytics_campaigns() from anon;

create or replace function public.analytics_acquisition()
returns table (source text, medium text, campaign text, signups bigint, enquiries bigint)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if not private.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Not permitted';
  end if;
  return query
  with j as (
    select coalesce(nullif(utm_source, ''), 'direct') as src,
           coalesce(nullif(utm_medium, ''), '') as med,
           coalesce(nullif(utm_campaign, ''), '') as cmp
    from public.join_applications
  ), c as (
    select coalesce(nullif(utm_source, ''), 'direct') as src,
           coalesce(nullif(utm_medium, ''), '') as med,
           coalesce(nullif(utm_campaign, ''), '') as cmp
    from public.contact_submissions
  ), keys as (
    select src, med, cmp from j union select src, med, cmp from c
  )
  select k.src, k.med, k.cmp,
    (select count(*) from j where j.src = k.src and j.med = k.med and j.cmp = k.cmp),
    (select count(*) from c where c.src = k.src and c.med = k.med and c.cmp = k.cmp)
  from keys k
  order by 4 + 5 desc;
end;
$$;
revoke all on function public.analytics_acquisition() from anon;

create or replace function public.analytics_signup_failure_summary()
returns table (reason text, failures bigint, last_seen timestamptz, distinct_people bigint)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if not private.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Not permitted';
  end if;
  return query
  select f.reason, count(*), max(f.created_at), count(distinct lower(f.email))
  from public.signup_failures f
  where f.created_at > now() - interval '30 days'
  group by f.reason order by count(*) desc;
end;
$$;
revoke all on function public.analytics_signup_failure_summary() from anon;

create or replace function public.analytics_invited_report()
returns table (
  email text, invited_at timestamptz, claimed_at timestamptz,
  state text, failure_reason text, failure_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if not private.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Not permitted';
  end if;
  return query
  with invites as (
    select lower(ci.email) as em, min(ci.sent_at) as first_invite, max(ci.claimed_at) as claimed
    from public.claim_invites ci where ci.sent_at is not null
    group by lower(ci.email)
  ), people as (
    select p.email_key as em, p.id, p.claimed_at,
           exists (select 1 from public.mu_activity a where a.person_id = p.id
                   and a.action in ('candidate_updated_profile', 'work_preferences_updated')) as has_activity
    from public.mu_people p
  ), fails as (
    select distinct on (lower(f.email)) lower(f.email) as em, f.reason, f.created_at
    from public.signup_failures f order by lower(f.email), f.created_at desc
  )
  select i.em, i.first_invite, coalesce(p.claimed_at, i.claimed),
    case
      when p.id is null then 'no_profile'
      when coalesce(p.claimed_at, i.claimed) is null then 'no_account'
      when not p.has_activity then 'account_no_activity'
      else 'active'
    end,
    f.reason, f.created_at
  from invites i
  left join people p on p.em = i.em
  left join fails f on f.em = i.em
  order by i.first_invite desc;
end;
$$;
revoke all on function public.analytics_invited_report() from anon;

-- ============ Schedules ============
select cron.unschedule('analytics-refresh') where exists (select 1 from cron.job where jobname = 'analytics-refresh');
select cron.schedule('analytics-refresh', '*/15 * * * *', $$select private.analytics_refresh_all(); select private.analytics_check_alerts();$$);

select cron.unschedule('followup-queue-sweep') where exists (select 1 from cron.job where jobname = 'followup-queue-sweep');
select cron.schedule('followup-queue-sweep', '0 9 * * *', $$select private.analytics_refresh_all(); select private.followup_queue_sweep();$$);

-- First build now.
select private.analytics_refresh_all();
select private.followup_queue_sweep();
