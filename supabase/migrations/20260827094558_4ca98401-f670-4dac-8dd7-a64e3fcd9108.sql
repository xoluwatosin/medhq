-- Key metadata so admins can see when a run key was last rotated.
alter table private.job_keys
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists rotated_at timestamptz not null default now(),
  add column if not exists rotated_by uuid,
  add column if not exists fingerprint text;

update private.job_keys
set fingerprint = left(encode(extensions.digest(value, 'sha256'), 'hex'), 12)
where fingerprint is null;

-- Audit trail for every request or rotation of an internal run key.
create table if not exists public.job_key_audit (
  id uuid primary key default gen_random_uuid(),
  key_name text not null,
  action text not null,
  actor_id uuid,
  actor_email text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select on public.job_key_audit to authenticated;
grant all on public.job_key_audit to service_role;

alter table public.job_key_audit enable row level security;

drop policy if exists "Admins read key audit" on public.job_key_audit;
create policy "Admins read key audit"
  on public.job_key_audit for select to authenticated
  using (private.has_role(auth.uid(), 'admin'));

create index if not exists job_key_audit_created_idx on public.job_key_audit (created_at desc);

-- Status: never reveals a value, only presence, age and a short fingerprint.
create or replace function public.admin_job_keys()
returns table (name text, present boolean, rotated_at timestamptz, created_at timestamptz, fingerprint text)
language plpgsql
stable
security definer
set search_path = public, private, extensions
as $$
begin
  if not private.has_role(auth.uid(), 'admin') then
    raise exception 'Not permitted.';
  end if;
  return query
    select k.name, (k.value is not null and length(k.value) > 0), k.rotated_at, k.created_at, k.fingerprint
    from private.job_keys k
    order by k.name;
end;
$$;

revoke all on function public.admin_job_keys() from public, anon;
grant execute on function public.admin_job_keys() to authenticated;

-- Rotation: mints a new random value in the database and records who did it.
create or replace function public.admin_job_key_rotate(p_name text)
returns table (name text, rotated_at timestamptz, fingerprint text)
language plpgsql
volatile
security definer
set search_path = public, private, extensions
as $$
declare
  v_value text;
  v_fp text;
  v_email text;
begin
  if not private.has_role(auth.uid(), 'admin') then
    raise exception 'Not permitted.';
  end if;
  if p_name not in ('admin_alert_key', 'followup_run_key', 'mu_link_sweep_key') then
    raise exception 'Unknown key.';
  end if;

  v_value := encode(extensions.gen_random_bytes(32), 'hex');
  v_fp := left(encode(extensions.digest(v_value, 'sha256'), 'hex'), 12);
  select u.email into v_email from auth.users u where u.id = auth.uid();

  insert into private.job_keys (name, value, fingerprint, rotated_at, rotated_by)
  values (p_name, v_value, v_fp, now(), auth.uid())
  on conflict (name) do update
    set value = excluded.value,
        fingerprint = excluded.fingerprint,
        rotated_at = now(),
        rotated_by = auth.uid();

  insert into public.job_key_audit (key_name, action, actor_id, actor_email, detail)
  values (p_name, 'rotated', auth.uid(), v_email, jsonb_build_object('fingerprint', v_fp));

  return query
    select p_name, now()::timestamptz, v_fp;
end;
$$;

revoke all on function public.admin_job_key_rotate(text) from public, anon;
grant execute on function public.admin_job_key_rotate(text) to authenticated;

-- Records a viewing/verification event without exposing the value.
create or replace function public.admin_job_key_log(p_name text, p_action text, p_detail jsonb default '{}'::jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public, private
as $$
declare
  v_email text;
begin
  if not private.has_role(auth.uid(), 'admin') then
    raise exception 'Not permitted.';
  end if;
  select u.email into v_email from auth.users u where u.id = auth.uid();
  insert into public.job_key_audit (key_name, action, actor_id, actor_email, detail)
  values (p_name, p_action, auth.uid(), v_email, coalesce(p_detail, '{}'::jsonb));
end;
$$;

revoke all on function public.admin_job_key_log(text, text, jsonb) from public, anon;
grant execute on function public.admin_job_key_log(text, text, jsonb) to authenticated;

-- Lets edge functions validate a presented run key without exposing the store.
create or replace function public.job_key_check(p_name text, p_value text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1 from private.job_keys k
    where k.name = p_name and k.value = p_value and length(coalesce(p_value, '')) > 0
  );
$$;

revoke all on function public.job_key_check(text, text) from public, anon, authenticated;
grant execute on function public.job_key_check(text, text) to service_role;

-- Returns the stored run key to trusted server-side callers only.
create or replace function public.job_key_value(p_name text)
returns text
language sql
stable
security definer
set search_path = public, private
as $$
  select k.value from private.job_keys k where k.name = p_name;
$$;

revoke all on function public.job_key_value(text) from public, anon, authenticated;
grant execute on function public.job_key_value(text) to service_role;