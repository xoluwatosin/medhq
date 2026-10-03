create or replace function private.metrics_audit_run()
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_run uuid := gen_random_uuid();
  v_bad integer := 0;
  v_key text;
begin
  -- 1. Campaign counters versus the raw delivery log.
  insert into public.metrics_audit_findings
    (run_id, check_key, metric, scope, scope_id, dashboard_value, source_value, delta, severity, note, detail)
  select v_run, 'campaign_counter', m.metric, c.title, c.id,
         m.stored, m.actual, m.stored - m.actual,
         case when m.stored = m.actual then 'ok' else 'mismatch' end,
         case when m.stored = m.actual
              then 'Counter agrees with the delivery log.'
              else 'The stored counter disagrees with the delivery log. Re-sync this campaign.' end,
         jsonb_build_object('status', c.status, 'tracking_enabled', coalesce(c.tracking_enabled, false))
  from public.campaigns c
  cross join lateral (
    select count(distinct lower(recipient_email)) filter (where event_type = 'sent')      as sent,
           count(distinct lower(recipient_email)) filter (where event_type = 'delivered') as delivered,
           count(distinct lower(recipient_email)) filter (where event_type = 'opened')    as opened,
           count(distinct lower(recipient_email)) filter (where event_type = 'clicked')   as clicked
    from public.campaign_events e where e.campaign_id = c.id
  ) ev
  cross join lateral (
    values ('sent', coalesce(c.total_sent, 0)::numeric, ev.sent::numeric),
           ('delivered', coalesce(c.total_delivered, 0)::numeric, ev.delivered::numeric),
           ('opened', coalesce(c.total_opened, 0)::numeric, ev.opened::numeric),
           ('clicked', coalesce(c.total_clicked, 0)::numeric, ev.clicked::numeric)
  ) as m(metric, stored, actual)
  where coalesce(c.archived, false) = false and c.status = 'sent';

  -- 2. "Not tracked" labelling truthfulness.
  insert into public.metrics_audit_findings
    (run_id, check_key, metric, scope, scope_id, dashboard_value, source_value, severity, note, detail)
  select v_run, 'tracking_label', 'not_tracked_label', c.title, c.id,
         case when coalesce(c.tracking_enabled, false) then 1 else 0 end,
         case when ev.engagement > 0 then 1 else 0 end,
         case
           when not coalesce(c.tracking_enabled, false) and ev.engagement > 0 then 'mismatch'
           when coalesce(c.tracking_enabled, false) and ev.delivered > 0 and ev.engagement = 0
                and c.sent_at < now() - interval '48 hours' then 'warning'
           else 'ok'
         end,
         case
           when not coalesce(c.tracking_enabled, false) and ev.engagement > 0
             then 'Marked "Not tracked" but opens or clicks were recorded. Turn tracking on for this campaign.'
           when coalesce(c.tracking_enabled, false) and ev.delivered > 0 and ev.engagement = 0
                and c.sent_at < now() - interval '48 hours'
             then 'Marked as tracked but no opens or clicks in over 48 hours. The label may be wrong.'
           else 'Tracking label matches the recorded behaviour.'
         end,
         jsonb_build_object('delivered', ev.delivered, 'engagement_events', ev.engagement)
  from public.campaigns c
  cross join lateral (
    select count(distinct lower(recipient_email)) filter (where event_type = 'delivered') as delivered,
           count(*) filter (where event_type in ('opened', 'clicked')) as engagement
    from public.campaign_events e where e.campaign_id = c.id
  ) ev
  where coalesce(c.archived, false) = false and c.status = 'sent';

  -- 3. Invite dates: people marked invited versus invite records.
  insert into public.metrics_audit_findings
    (run_id, check_key, metric, scope, dashboard_value, source_value, delta, severity, note, detail)
  select v_run, 'invited_at', s.metric, 'global', s.dash, s.src, s.dash - s.src,
         case when s.dash = s.src then 'ok' else 'mismatch' end, s.note, '{}'::jsonb
  from (
    select 'people_invited'::text as metric,
           (select count(*) from public.mu_people where invited_at is not null)::numeric as dash,
           (select count(distinct p.id) from public.mu_people p
              join public.claim_invites ci on lower(ci.email) = lower(p.email)
             where p.invited_at is not null)::numeric as src,
           'Every person carrying an invite date should have a matching invite record.'::text as note
    union all
    select 'linked_invites_without_date',
           0::numeric,
           (select count(*) from public.claim_invites ci
              join public.mu_people p on p.id = ci.person_id
             where p.invited_at is null)::numeric,
           'Invite records linked to a person whose invite date is missing.'
    union all
    select 'invited_without_invite_row',
           0::numeric,
           (select count(*) from public.mu_people p
             where p.invited_at is not null
               and not exists (select 1 from public.claim_invites ci where lower(ci.email) = lower(p.email)))::numeric,
           'People marked as invited with no invite record behind the figure.'
  ) s;

  -- 4. Journey rollup versus live records, and rollup freshness.
  insert into public.metrics_audit_findings
    (run_id, check_key, metric, scope, dashboard_value, source_value, delta, severity, note, detail)
  select v_run, 'rollup', 'invited_people', 'global',
         (select count(*) from private.analytics_candidate_journey where invited_at is not null)::numeric,
         (select count(*) from public.mu_people where invited_at is not null)::numeric,
         (select count(*) from private.analytics_candidate_journey where invited_at is not null)::numeric
           - (select count(*) from public.mu_people where invited_at is not null)::numeric,
         case when (select count(*) from private.analytics_candidate_journey where invited_at is not null)
                 = (select count(*) from public.mu_people where invited_at is not null)
              then 'ok' else 'mismatch' end,
         'The Intelligence funnel should count the same invited people as the records.', '{}'::jsonb;

  insert into public.metrics_audit_findings
    (run_id, check_key, metric, scope, dashboard_value, source_value, severity, note, detail)
  select v_run, 'rollup', 'minutes_since_refresh', 'global', null,
         round(extract(epoch from (now() - coalesce(max(refreshed_at), now() - interval '1 day'))) / 60.0),
         case when max(refreshed_at) is null or max(refreshed_at) < now() - interval '90 minutes'
              then 'warning' else 'ok' end,
         'The Intelligence figures refresh every fifteen minutes.', '{}'::jsonb
  from private.analytics_candidate_journey;

  select count(*) into v_bad from public.metrics_audit_findings
   where run_id = v_run and severity = 'mismatch';

  if v_bad > 0 and not exists (
    select 1 from public.admin_alerts
     where kind = 'metrics_mismatch' and resolved_at is null and created_at > now() - interval '12 hours'
  ) then
    insert into public.admin_alerts (kind, title, detail)
    values ('metrics_mismatch',
            'Dashboard figures disagree with the records',
            jsonb_build_object('run_id', v_run, 'mismatches', v_bad));
    select value into v_key from private.job_keys where name = 'admin_alert_key';
    if v_key is not null then
      perform net.http_post(
        url := 'https://eylgffhvyuykafxydrul.supabase.co/functions/v1/send-admin-alert',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-run-key', v_key),
        body := '{}'::jsonb
      );
    end if;
  end if;

  delete from public.metrics_audit_findings where created_at < now() - interval '90 days';
  return v_run;
end;
$$;

create or replace function public.admin_metrics_audit_run()
returns setof public.metrics_audit_findings
language plpgsql
security definer
set search_path = public, private
as $$
declare v_run uuid;
begin
  if not private.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Not permitted';
  end if;
  v_run := private.metrics_audit_run();
  return query select * from public.metrics_audit_findings f where f.run_id = v_run
    order by (f.severity = 'mismatch') desc, (f.severity = 'warning') desc, f.check_key, f.scope, f.metric;
end;
$$;
revoke all on function public.admin_metrics_audit_run() from public, anon;
grant execute on function public.admin_metrics_audit_run() to authenticated;

create or replace function public.admin_metrics_audit_latest()
returns setof public.metrics_audit_findings
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
  select * from public.metrics_audit_findings f
   where f.run_id = (select run_id from public.metrics_audit_findings order by created_at desc limit 1)
   order by (f.severity = 'mismatch') desc, (f.severity = 'warning') desc, f.check_key, f.scope, f.metric;
end;
$$;
revoke all on function public.admin_metrics_audit_latest() from public, anon;
grant execute on function public.admin_metrics_audit_latest() to authenticated;

revoke all on function private.metrics_audit_run() from public, anon, authenticated;

select cron.unschedule('metrics-audit') where exists (select 1 from cron.job where jobname = 'metrics-audit');
select cron.schedule('metrics-audit', '45 8 * * *', $cron$ select private.metrics_audit_run(); $cron$);