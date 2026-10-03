alter table public.followup_queue alter column person_id drop not null;

create unique index if not exists followup_queue_email_reason_uniq
  on public.followup_queue (lower(email), reason);

create or replace function private.followup_queue_sweep()
returns integer
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  v_n integer;
begin
  with silent as (
    select j.person_id, lower(j.email) as email,
           case when j.claimed_at is null then 'invited_no_account' else 'claimed_no_activity' end as reason
    from private.analytics_candidate_journey j
    where j.invited_at is not null
      and j.invited_at < now() - interval '48 hours'
      and j.email is not null
      and (
        j.claimed_at is null
        or (j.first_profile_save_at is null and j.documents = 0 and j.preferences_at is null)
      )
    union
    select null::uuid, lower(ci.email), 'invited_no_account'
    from public.claim_invites ci
    where ci.person_id is null
      and ci.email is not null
      and coalesce(ci.invited_at, ci.created_at) < now() - interval '48 hours'
      and not exists (
        select 1 from auth.users u where lower(u.email) = lower(ci.email)
      )
  ), ins as (
    insert into public.followup_queue (person_id, email, reason)
    select person_id, email, reason from silent
    on conflict do nothing
    returning id
  )
  select count(*) into v_n from ins;
  return v_n;
end;
$function$;

create or replace function private.followup_queue_dispatch()
returns integer
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  v_ids uuid[];
  v_key text;
begin
  select array_agg(id) into v_ids from (
    select id from public.followup_queue
    where status = 'pending'
      and queued_at < now() - interval '12 hours'
    order by queued_at
    limit 200
  ) q;

  if v_ids is null or array_length(v_ids, 1) = 0 then
    return 0;
  end if;

  select value into v_key from private.job_keys where name = 'followup_run_key';
  if v_key is null then return 0; end if;

  perform net.http_post(
    url := 'https://eylgffhvyuykafxydrul.supabase.co/functions/v1/send-followup-nudge',
    headers := jsonb_build_object('Content-Type','application/json','x-run-key', v_key),
    body := jsonb_build_object('ids', to_jsonb(v_ids))
  );

  return array_length(v_ids, 1);
end;
$function$;