-- Gap helper: what is still missing on a person's profile
create or replace function private.followup_person_gaps(_person uuid)
returns text[]
language sql
stable
security definer
set search_path to 'public','private'
as $$
  select coalesce(
    (select array(select jsonb_array_elements_text(public.mu_candidate_gaps_row(p)))
       from public.mu_people p where p.id = _person),
    '{}'::text[])
$$;

revoke all on function private.followup_person_gaps(uuid) from public, anon, authenticated;

-- Reconcile: retire or retarget queued nudges that no longer reflect reality
create or replace function private.followup_queue_reconcile()
returns integer
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  v_n integer := 0;
  v_x integer;
begin
  -- 1. They have claimed an account: the "your invitation is waiting" nudge is wrong now.
  with claimed as (
    select q.id, q.person_id, q.email
    from public.followup_queue q
    where q.status = 'pending'
      and q.reason = 'invited_no_account'
      and (
        exists (select 1 from auth.users u where lower(u.email) = lower(q.email))
        or exists (select 1 from public.mu_people p
                    where p.id = q.person_id and p.auth_user_id is not null)
      )
  )
  update public.followup_queue q
     set status = 'resolved'
    from claimed c
   where q.id = c.id;
  get diagnostics v_x = row_count; v_n := v_n + v_x;

  -- 2. Claimed rows whose profile is now complete: nothing left to nudge for.
  update public.followup_queue q
     set status = 'resolved'
   where q.status = 'pending'
     and q.reason in ('claimed_no_activity', 'profile_gaps')
     and q.person_id is not null
     and coalesce(array_length(private.followup_person_gaps(q.person_id), 1), 0) = 0;
  get diagnostics v_x = row_count; v_n := v_n + v_x;

  -- 3. Claimed and started, but still incomplete: retarget to the gap nudge.
  update public.followup_queue q
     set reason = 'profile_gaps'
   where q.status = 'pending'
     and q.reason = 'claimed_no_activity'
     and q.person_id is not null
     and coalesce(array_length(private.followup_person_gaps(q.person_id), 1), 0) > 0
     and exists (
       select 1 from private.analytics_candidate_journey j
        where j.person_id = q.person_id
          and (j.first_profile_save_at is not null or j.documents > 0 or j.preferences_at is not null)
     )
     and not exists (
       select 1 from public.followup_queue q2
        where q2.reason = 'profile_gaps'
          and (q2.person_id = q.person_id or lower(q2.email) = lower(q.email))
     );
  get diagnostics v_x = row_count; v_n := v_n + v_x;

  return v_n;
end;
$function$;

revoke all on function private.followup_queue_reconcile() from public, anon, authenticated;

-- Sweep: reconcile first, then queue, including a gap-specific nudge for claimed candidates
create or replace function private.followup_queue_sweep()
returns integer
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  v_n integer;
begin
  perform private.followup_queue_reconcile();

  with silent as (
    -- invited, never claimed
    select j.person_id, lower(j.email) as email, 'invited_no_account'::text as reason
    from private.analytics_candidate_journey j
    where j.invited_at is not null
      and j.invited_at < now() - interval '48 hours'
      and j.email is not null
      and j.claimed_at is null
      and not exists (select 1 from auth.users u where lower(u.email) = lower(j.email))

    union

    -- claimed but never touched the profile
    select j.person_id, lower(j.email), 'claimed_no_activity'
    from private.analytics_candidate_journey j
    where j.claimed_at is not null
      and j.claimed_at < now() - interval '48 hours'
      and j.email is not null
      and j.first_profile_save_at is null and j.documents = 0 and j.preferences_at is null
      and coalesce(array_length(private.followup_person_gaps(j.person_id), 1), 0) > 0

    union

    -- claimed and started, but the profile is still short of something
    select j.person_id, lower(j.email), 'profile_gaps'
    from private.analytics_candidate_journey j
    where j.claimed_at is not null
      and j.email is not null
      and (j.first_profile_save_at is not null or j.documents > 0 or j.preferences_at is not null)
      and coalesce(array_length(private.followup_person_gaps(j.person_id), 1), 0) > 0

    union

    -- invite records with no person attached and no account
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
  ), rearm as (
    -- re-arm a nudge that was sent more than 21 days ago and still applies
    update public.followup_queue q
       set status = 'pending', queued_at = now(), sent_at = null
      from silent s
     where q.status = 'sent'
       and q.reason = s.reason
       and lower(q.email) = s.email
       and coalesce(q.sent_at, q.queued_at) < now() - interval '21 days'
    returning q.id
  )
  select (select count(*) from ins) + (select count(*) from rearm) into v_n;
  return v_n;
end;
$function$;

revoke all on function private.followup_queue_sweep() from public, anon, authenticated;

-- Reconcile immediately so the current backlog is accurate
select private.followup_queue_reconcile();
