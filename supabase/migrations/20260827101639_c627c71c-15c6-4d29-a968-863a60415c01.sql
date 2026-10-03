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
      and ci.claimed_at is null
      and coalesce(ci.sent_at, ci.created_at) < now() - interval '48 hours'
      and not exists (select 1 from auth.users u where lower(u.email) = lower(ci.email))
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