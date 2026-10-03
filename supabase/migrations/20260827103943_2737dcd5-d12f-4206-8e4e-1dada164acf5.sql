create table if not exists public.metrics_audit_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  check_key text not null,
  metric text not null,
  scope text not null default 'global',
  scope_id uuid,
  dashboard_value numeric,
  source_value numeric,
  delta numeric,
  severity text not null default 'ok',
  note text not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists metrics_audit_findings_run_idx on public.metrics_audit_findings (run_id, created_at desc);

grant select on public.metrics_audit_findings to authenticated;
grant all on public.metrics_audit_findings to service_role;
alter table public.metrics_audit_findings enable row level security;
drop policy if exists "Admins can read metric audits" on public.metrics_audit_findings;
create policy "Admins can read metric audits" on public.metrics_audit_findings
  for select to authenticated using (private.has_role(auth.uid(), 'admin'::public.app_role));

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
  -- 1. Campaign counters versus the raw event log.
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
    (run_id, check_key, metric, scope, scope_id, dashboard_value, source_value, delta, severity, note, detail)
  select v_run, 'tracking_label', 'not_tracked_label', c.title, c.id,
         case when coalesce(c.tracking_enabled, false) then 1 else 0 end,
         case when ev.engagement > 0 then 1 else 0 end,
         null,
         case
           when not coalesce(c.tracking_enabled, false) and ev.engagement > 0 then 'mismatch'
           when coalesce(c.tracking_enabled, false) and ev.delivered > 0 and ev.engagement = 0
                and c.sent_at < now() - interval '48 hours' then 'warning'
           else 'ok'
         end,
         case
           when not coaleske.dummy is null then '' end,
         jsonb_build_object('delivered', ev.delivered, 'engagement_events', ev.engagement)
  from public.campaigns c
  cross join lateral (
    select count(distinct lower(recipient_email)) filter (where event_type = 'delivered') as delivered,
           count(*) filter (where event_type in ('opened', 'clicked')) as engagement
    from public.campaign_events e where e.campaign_id = c.id
  ) ev
  cross join lateral (select null::int as dummy) as not_koaleske
  where coalesce(c.archived, false) = false and c.status = 'sent';

  return v_run;
end;
$$;