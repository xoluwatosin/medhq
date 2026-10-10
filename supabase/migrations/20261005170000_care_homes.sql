-- Care and family, step 6 of docs/care-platform/care-family-model.md.
-- Runs after 20261005160000_care_family_steps_2_to_5.sql. Safe to run twice.
--
-- A family is the people who arrange care together; it has no address.
-- A home is an address. A family can have several homes (a son in London,
-- his mother in Lagos; parents living apart), and care records under one
-- roof share one home, so the address is entered once.
--
-- The care record's address columns stay, as a mirror of its home, so every
-- form, link and function that reads or writes them keeps working:
--   - writing a care record's address writes its home, and every other care
--     record in that home follows;
--   - pointing a care record at another home takes that home's address;
--   - the family and request-recipient addresses stop being separate stores.

create table if not exists public.care_homes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.care_groups(id) on delete set null,
  address_line text,
  landmark text,
  state_code text,
  lga_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.care_homes enable row level security;
drop policy if exists "Admins read care homes" on public.care_homes;
create policy "Admins read care homes" on public.care_homes
  for select to authenticated using (private.has_role(auth.uid(), 'admin'::app_role));
create index if not exists care_homes_group_id_idx on public.care_homes(group_id);

alter table public.clients add column if not exists home_id uuid references public.care_homes(id) on delete set null;
create index if not exists clients_home_id_idx on public.clients(home_id);

-- ---------------------------------------------------------------- sync
-- A home's address changed: every other care record in it follows.
create or replace function private.care_home_mirror()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
begin
  if (new.address_line, new.landmark, new.state_code, new.lga_code)
     is not distinct from (old.address_line, old.landmark, old.state_code, old.lga_code) then
    return new;
  end if;
  perform set_config('mc.home_mirror', 'on', true);
  update public.clients
     set address_line = new.address_line, landmark = new.landmark,
         state_code = new.state_code, lga_code = new.lga_code
   where home_id = new.id
     and id::text is distinct from nullif(current_setting('mc.home_origin', true), '');
  perform set_config('mc.home_mirror', '', true);
  return new;
end;
$$;
drop trigger if exists care_home_mirror on public.care_homes;
create trigger care_home_mirror after update on public.care_homes
for each row execute function private.care_home_mirror();

-- A care record's address or home changed.
create or replace function private.care_client_home_sync()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare
  _home public.care_homes%rowtype;
  _has_address boolean := coalesce(new.address_line, new.landmark, new.state_code, new.lga_code) is not null;
begin
  -- Being updated by its home: nothing more to do.
  if current_setting('mc.home_mirror', true) = 'on' then return new; end if;

  if tg_op = 'UPDATE' and new.home_id is distinct from old.home_id then
    if new.home_id is not null then
      -- Joined another home: take its address.
      select * into _home from public.care_homes where id = new.home_id;
      new.address_line := _home.address_line; new.landmark := _home.landmark;
      new.state_code := _home.state_code; new.lga_code := _home.lga_code;
      return new;
    end if;
    -- Left a home: a new one of its own, starting from the same address.
    if _has_address then
      insert into public.care_homes (group_id, address_line, landmark, state_code, lga_code)
      select group_id, new.address_line, new.landmark, new.state_code, new.lga_code
        from public.care_homes where id = old.home_id
      returning id into new.home_id;
      if new.home_id is null then
        insert into public.care_homes (address_line, landmark, state_code, lga_code)
        values (new.address_line, new.landmark, new.state_code, new.lga_code)
        returning id into new.home_id;
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' and new.home_id is not null then
    select * into _home from public.care_homes where id = new.home_id;
    new.address_line := _home.address_line; new.landmark := _home.landmark;
    new.state_code := _home.state_code; new.lga_code := _home.lga_code;
    return new;
  end if;

  if tg_op = 'UPDATE'
     and (new.address_line, new.landmark, new.state_code, new.lga_code)
         is not distinct from (old.address_line, old.landmark, old.state_code, old.lga_code) then
    return new;
  end if;

  if new.home_id is null then
    if _has_address then
      insert into public.care_homes (address_line, landmark, state_code, lga_code)
      values (new.address_line, new.landmark, new.state_code, new.lga_code)
      returning id into new.home_id;
    end if;
  else
    perform set_config('mc.home_origin', new.id::text, true);
    update public.care_homes
       set address_line = new.address_line, landmark = new.landmark,
           state_code = new.state_code, lga_code = new.lga_code, updated_at = now()
     where id = new.home_id;
    perform set_config('mc.home_origin', '', true);
  end if;
  return new;
end;
$$;

-- A request recipient's address is the care record's address. Anything
-- written to the recipient row goes to a care record that has none, and the
-- recipient row is left empty. The home joins the request's family.
create or replace function private.care_recipient_address_to_home()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
begin
  if coalesce(new.address_line, new.landmark, new.state_code, new.lga_code) is not null then
    update public.clients
       set address_line = new.address_line, landmark = new.landmark,
           state_code = new.state_code, lga_code = new.lga_code
     where id = new.client_id
       and coalesce(address_line, landmark, state_code, lga_code) is null;
    new.address_line := null; new.landmark := null; new.state_code := null; new.lga_code := null;
  end if;
  update public.care_homes h
     set group_id = q.group_id
    from public.clients c, public.care_requests q
   where c.id = new.client_id and h.id = c.home_id and q.id = new.request_id and h.group_id is null;
  return new;
end;
$$;

-- A family holds no address. Values written by older functions are dropped;
-- the care records hold them.
create or replace function private.care_group_no_address()
returns trigger
language plpgsql
set search_path to 'public', 'private'
as $$
begin
  new.address_line := null; new.landmark := null; new.state_code := null; new.lga_code := null;
  return new;
end;
$$;

-- ---------------------------------------------------------------- backfill
drop trigger if exists care_client_home_sync on public.clients;
drop trigger if exists care_recipient_address_to_home on public.care_request_recipients;
drop trigger if exists care_group_no_address on public.care_groups;

-- 1. Recipient and family addresses move to care records that have none.
--    Listed, so staff can see what moved.
do $$
declare r record;
begin
  for r in
    select c.id, c.enquiry_number, rr.address_line, rr.landmark, rr.state_code, rr.lga_code, 'request' as src
      from public.care_request_recipients rr join public.clients c on c.id = rr.client_id
     where coalesce(rr.address_line, rr.landmark, rr.state_code, rr.lga_code) is not null
    union all
    select c.id, c.enquiry_number, g.address_line, g.landmark, g.state_code, g.lga_code, 'family'
      from public.care_groups g
      join public.care_requests q on q.group_id = g.id
      join public.care_request_recipients rr on rr.request_id = q.id
      join public.clients c on c.id = rr.client_id
     where coalesce(g.address_line, g.landmark, g.state_code, g.lga_code) is not null
  loop
    if exists (select 1 from public.clients where id = r.id
               and coalesce(address_line, landmark, state_code, lga_code) is null) then
      update public.clients
         set address_line = r.address_line, landmark = r.landmark,
             state_code = r.state_code, lga_code = r.lga_code
       where id = r.id;
      raise notice '% had no address; took the % address.', r.enquiry_number, r.src;
    elsif exists (select 1 from public.clients where id = r.id
                  and (address_line, landmark, state_code, lga_code)
                      is distinct from (r.address_line, r.landmark, r.state_code, r.lga_code)) then
      raise notice '% keeps its own address; the % address differed and was dropped: %, %, %.',
        r.enquiry_number, r.src, r.address_line, r.state_code, r.lga_code;
    end if;
  end loop;
end $$;

update public.care_request_recipients
   set address_line = null, landmark = null, state_code = null, lga_code = null
 where coalesce(address_line, landmark, state_code, lga_code) is not null;
update public.care_groups
   set address_line = null, landmark = null, state_code = null, lga_code = null
 where coalesce(address_line, landmark, state_code, lga_code) is not null;


-- 2. A home for every care record with an address. Records in the same
--    family at the same address share one.
do $$
declare r record; _home uuid; _group uuid;
begin
  for r in
    select c.* from public.clients c
     where c.home_id is null and coalesce(c.address_line, c.landmark, c.state_code, c.lga_code) is not null
     order by c.created_at
  loop
    select q.group_id into _group
      from public.care_request_recipients rr join public.care_requests q on q.id = rr.request_id
     where rr.client_id = r.id order by q.created_at limit 1;

    _home := null;
    if _group is not null then
      select h.id into _home from public.care_homes h
       where h.group_id = _group
         and lower(btrim(coalesce(h.address_line, ''))) = lower(btrim(coalesce(r.address_line, '')))
         and h.state_code is not distinct from r.state_code
         and h.lga_code is not distinct from r.lga_code
       limit 1;
    end if;
    if _home is null then
      insert into public.care_homes (group_id, address_line, landmark, state_code, lga_code)
      values (_group, r.address_line, r.landmark, r.state_code, r.lga_code)
      returning id into _home;
    end if;
    update public.clients set home_id = _home where id = r.id;
  end loop;
end $$;

-- Triggers last, so the backfill above is not caught by them. They are
-- dropped first so a second run's backfill is not caught either.
drop trigger if exists care_client_home_sync on public.clients;
create trigger care_client_home_sync
before insert or update of address_line, landmark, state_code, lga_code, home_id on public.clients
for each row execute function private.care_client_home_sync();

drop trigger if exists care_recipient_address_to_home on public.care_request_recipients;
create trigger care_recipient_address_to_home
before insert or update of address_line, landmark, state_code, lga_code on public.care_request_recipients
for each row execute function private.care_recipient_address_to_home();

drop trigger if exists care_group_no_address on public.care_groups;
create trigger care_group_no_address
before insert or update of address_line, landmark, state_code, lga_code on public.care_groups
for each row execute function private.care_group_no_address();

-- ---------------------------------------------------------------- staff actions
-- Who lives in this care record's home, and which care records in the same
-- family could share it.
create or replace function public.care_home_overview(_client_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'private'
as $$
declare _home uuid;
begin
  perform private.care_group_admin_guard();
  select home_id into _home from public.clients where id = _client_id;
  return jsonb_build_object(
    'home_id', _home,
    'housemates', coalesce((
      select jsonb_agg(jsonb_build_object('client_id', c.id, 'full_name', c.full_name,
                                          'enquiry_number', c.enquiry_number) order by c.created_at)
        from public.clients c
       where _home is not null and c.home_id = _home and c.id <> _client_id), '[]'::jsonb),
    'family', coalesce((
      select jsonb_agg(jsonb_build_object('client_id', c.id, 'full_name', c.full_name,
                                          'enquiry_number', c.enquiry_number,
                                          'address_line', c.address_line,
                                          'has_address', coalesce(c.address_line, c.state_code, c.lga_code) is not null)
                       order by c.created_at)
        from public.clients c
       where c.id <> _client_id
         and c.home_id is distinct from _home
         and c.archived_at is null
         and exists (
           select 1
             from public.care_request_recipients a
             join public.care_requests qa on qa.id = a.request_id
             join public.care_requests qb on qb.group_id = qa.group_id
             join public.care_request_recipients b on b.request_id = qb.id
            where a.client_id = _client_id and b.client_id = c.id)), '[]'::jsonb)
  );
end;
$$;

-- This care record lives with another one.
create or replace function public.care_home_share(_client_id uuid, _with_client_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare _home uuid; _old uuid; _name text;
begin
  perform private.care_group_admin_guard();
  if _client_id = _with_client_id then raise exception 'Choose a different care record'; end if;
  select home_id, full_name into _home, _name from public.clients where id = _with_client_id;
  if not found then raise exception 'Care record not found'; end if;
  if _home is null then
    raise exception '% has no address yet. Add it there first.', _name;
  end if;
  select home_id into _old from public.clients where id = _client_id;
  update public.clients set home_id = _home, updated_at = now() where id = _client_id;
  delete from public.care_homes h
   where h.id = _old and not exists (select 1 from public.clients where home_id = h.id);
  return _home;
end;
$$;

-- This care record moves out to a home of its own, starting from the same
-- address until staff change it. Alone in its home already: nothing to do.
create or replace function public.care_home_separate(_client_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare _home uuid; _old uuid;
begin
  perform private.care_group_admin_guard();
  select home_id into _old from public.clients where id = _client_id;
  if _old is null or not exists (select 1 from public.clients where home_id = _old and id <> _client_id) then
    return _old;
  end if;
  update public.clients set home_id = null, updated_at = now() where id = _client_id
  returning home_id into _home;
  return _home;
end;
$$;

revoke all on function public.care_home_overview(uuid) from public, anon;
revoke all on function public.care_home_share(uuid, uuid) from public, anon;
revoke all on function public.care_home_separate(uuid) from public, anon;
grant execute on function public.care_home_overview(uuid) to authenticated;
grant execute on function public.care_home_share(uuid, uuid) to authenticated;
grant execute on function public.care_home_separate(uuid) to authenticated;
