create schema if not exists private;

create table if not exists private.job_keys (
  name text primary key,
  value text not null
);
revoke all on private.job_keys from public, anon, authenticated;

insert into private.job_keys (name, value)
values ('mu_link_sweep_key', 'cc820895f7976707cefff58512211fdaeebd9f639659a03f')
on conflict (name) do update set value = excluded.value;

create or replace function private.mu_link_orphan_accounts()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_ids uuid[] := '{}';
  v_all uuid[] := '{}';
  v_key text;
begin
  with pairs as (
    select u.id as uid, p.id as pid, lower(u.email) as em, u.created_at as signed_up
    from auth.users u
    join public.mu_people p
      on p.email_key = public.mu_norm_email(u.email)
     and p.auth_user_id is null
    where u.email_confirmed_at is not null
      and not exists (select 1 from public.mu_people x where x.auth_user_id = u.id)
  ), upd as (
    update public.mu_people p
       set auth_user_id = pairs.uid,
           claimed_at = coalesce(p.claimed_at, now()),
           updated_at = now()
      from pairs
     where p.id = pairs.pid
    returning p.id, pairs.uid, pairs.em, pairs.signed_up
  ), logged as (
    insert into public.mu_activity (person_id, actor_id, action, detail)
    select id, uid, 'account_claimed',
           jsonb_build_object('email', em, 'via', 'link_sweep')
    from upd
    returning person_id
  )
  select coalesce(array_agg(u.id), '{}'),
         coalesce(array_agg(u.id) filter (where u.signed_up < now() - interval '5 minutes'), '{}')
    into v_all, v_ids
    from upd u
   where (select count(*) from logged) >= 0;

  if array_length(v_ids, 1) > 0 then
    select value into v_key from private.job_keys where name = 'mu_link_sweep_key';
    perform net.http_post(
      url := 'https://eylgffhvyuykafxydrul.supabase.co/functions/v1/notify-relink',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-run-key', v_key),
      body := jsonb_build_object('person_ids', to_jsonb(v_ids))
    );
  end if;

  return coalesce(array_length(v_all, 1), 0);
end;
$$;

revoke all on function private.mu_link_orphan_accounts() from public, anon, authenticated;

select cron.unschedule('mu-link-orphan-accounts')
where exists (select 1 from cron.job where jobname = 'mu-link-orphan-accounts');

select cron.schedule('mu-link-orphan-accounts', '*/2 * * * *', $$select private.mu_link_orphan_accounts();$$);