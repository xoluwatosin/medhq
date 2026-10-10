-- Care and family, step 8 of docs/care-platform/care-family-model.md.
-- Runs after 20261005180000_care_family_membership.sql. Safe to run twice.
--
-- The same human entered twice. Matches are worked out when asked for, from
-- every care person whatever route created them (request form, enquiry,
-- admin), so no route can skip the check:
--   - the same email;
--   - the same phone or WhatsApp number (last 10 digits, so 0803... and
--     +234 803... agree);
--   - the same name and date of birth on a care record (a service user often
--     has no phone or email of their own).
-- Nothing merges on its own: families share emails and phones. Staff answer
-- "same person" (merge) or "different people" (remembered). People already
-- recorded as related, or as a contact on the other's care record, are known
-- to be different and never offered.

-- ---------------------------------------------------------------- keys
create or replace function private.care_phone_key(_phone text)
returns text
language sql
immutable
as $$
  select case when length(d) >= 7 then right(d, 10) end
    from (select regexp_replace(coalesce(_phone, ''), '\D', '', 'g') as d) x
$$;

create or replace function private.care_name_key(_name text)
returns text
language sql
immutable
as $$
  select nullif(btrim(regexp_replace(regexp_replace(lower(coalesce(_name, '')), '[^[:alnum:][:space:]]', '', 'g'), '\s+', ' ', 'g')), '')
$$;

-- ---------------------------------------------------------------- decisions
create table if not exists public.care_person_match_dismissals (
  person_a uuid not null references public.care_people(id) on delete cascade,
  person_b uuid not null references public.care_people(id) on delete cascade,
  decided_by uuid,
  decided_at timestamptz not null default now(),
  primary key (person_a, person_b),
  check (person_a < person_b)
);
alter table public.care_person_match_dismissals enable row level security;
drop policy if exists "Admins read care match decisions" on public.care_person_match_dismissals;
create policy "Admins read care match decisions" on public.care_person_match_dismissals
  for select to authenticated using (private.has_role(auth.uid(), 'admin'::app_role));

create table if not exists public.care_person_merges (
  id uuid primary key default gen_random_uuid(),
  kept_person_id uuid references public.care_people(id) on delete set null,
  merged_person jsonb not null,
  rows_moved integer not null default 0,
  families_combined integer not null default 0,
  merged_by uuid,
  merged_at timestamptz not null default now()
);
alter table public.care_person_merges enable row level security;
drop policy if exists "Admins read care merges" on public.care_person_merges;
create policy "Admins read care merges" on public.care_person_merges
  for select to authenticated using (private.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------- finding matches
create or replace function private.care_person_match_pairs()
returns table (person_a uuid, person_b uuid, matched_on text[])
language sql
stable
set search_path to 'public', 'private'
as $$
  with sig as (
    select p.id as person_id, 'email'::text as kind, lower(btrim(p.email)) as val
      from public.care_people p where nullif(btrim(p.email), '') is not null
    union
    select p.id, 'phone', private.care_phone_key(p.phone)
      from public.care_people p where private.care_phone_key(p.phone) is not null
    union
    select p.id, 'phone', private.care_phone_key(p.whatsapp)
      from public.care_people p where private.care_phone_key(p.whatsapp) is not null
    union
    select c.person_id, 'name_and_birth', private.care_name_key(c.full_name) || '|' || c.date_of_birth::text
      from public.clients c
     where c.date_of_birth is not null and private.care_name_key(c.full_name) is not null
  )
  select a.person_id, b.person_id, array_agg(distinct a.kind order by a.kind)
    from sig a
    join sig b on b.kind = a.kind and b.val = a.val and a.person_id < b.person_id
   where not exists (select 1 from public.care_person_match_dismissals d
                      where d.person_a = a.person_id and d.person_b = b.person_id)
     and not exists (select 1 from public.care_person_relationships r
                      where (r.from_person_id = a.person_id and r.to_person_id = b.person_id)
                         or (r.from_person_id = b.person_id and r.to_person_id = a.person_id))
     and not exists (select 1 from public.client_contacts cc join public.clients c on c.id = cc.client_id
                      where (cc.person_id = a.person_id and c.person_id = b.person_id)
                         or (cc.person_id = b.person_id and c.person_id = a.person_id))
   group by a.person_id, b.person_id
$$;

create or replace function private.care_person_card(_person uuid)
returns jsonb
language sql
stable
set search_path to 'public', 'private'
as $$
  select jsonb_build_object(
    'id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone,
    'whatsapp', p.whatsapp, 'created_at', p.created_at, 'source', p.source,
    'has_sign_in', p.auth_user_id is not null,
    'care_records', coalesce((select jsonb_agg(jsonb_build_object(
        'client_id', c.id, 'full_name', c.full_name, 'enquiry_number', c.enquiry_number,
        'date_of_birth', c.date_of_birth) order by c.created_at)
      from public.clients c where c.person_id = p.id), '[]'::jsonb),
    'contact_for', coalesce((select jsonb_agg(distinct jsonb_build_object(
        'client_id', c.id, 'full_name', c.full_name, 'enquiry_number', c.enquiry_number))
      from public.client_contacts cc join public.clients c on c.id = cc.client_id
     where cc.person_id = p.id and c.person_id <> p.id), '[]'::jsonb),
    'families', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'display_name', g.display_name))
      from public.care_groups g
     where g.id in (select m.group_id from public.care_group_members m where m.person_id = p.id)), '[]'::jsonb)
  )
  from public.care_people p where p.id = _person
$$;

-- Every open match, or only those touching one care record (its service user
-- and its contacts).
create or replace function public.care_person_matches(_client_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'private'
as $$
begin
  perform private.care_group_admin_guard();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'person_a', private.care_person_card(m.person_a),
             'person_b', private.care_person_card(m.person_b),
             'matched_on', to_jsonb(m.matched_on))
           order by m.person_a, m.person_b)
      from private.care_person_match_pairs() m
     where _client_id is null
        or exists (select 1 from (
             select c.person_id from public.clients c where c.id = _client_id
             union select cc.person_id from public.client_contacts cc where cc.client_id = _client_id) x
           where x.person_id in (m.person_a, m.person_b))
  ), '[]'::jsonb);
end;
$$;

create or replace function public.care_person_match_dismiss(_person_a uuid, _person_b uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
begin
  perform private.care_group_admin_guard();
  if _person_a = _person_b then raise exception 'Choose two different people'; end if;
  insert into public.care_person_match_dismissals (person_a, person_b, decided_by)
  values (least(_person_a, _person_b), greatest(_person_a, _person_b), auth.uid())
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------- merging
-- Point every single-column foreign key at _table from one row to another.
create or replace function private.care_repoint(_table regclass, _from uuid, _to uuid)
returns integer
language plpgsql
set search_path to 'public', 'private'
as $$
declare r record; n integer; total integer := 0;
begin
  for r in
    select con.conrelid::regclass as tbl, att.attname as col
      from pg_constraint con
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
     where con.contype = 'f' and con.confrelid = _table and array_length(con.conkey, 1) = 1
  loop
    execute format('update %s set %I = $1 where %I = $2', r.tbl, r.col, r.col) using _to, _from;
    get diagnostics n = row_count;
    total := total + n;
  end loop;
  return total;
end;
$$;

-- Fold one family into another.
create or replace function private.care_family_combine(_keep uuid, _drop uuid)
returns integer
language plpgsql
set search_path to 'public', 'private'
as $$
declare n integer; _origin uuid;
begin
  if _keep = _drop then return 0; end if;
  update public.care_group_members k
     set notes = nullif(concat_ws(E'\n', k.notes, d.notes), '')
    from public.care_group_members d
   where k.group_id = _keep and d.group_id = _drop and d.person_id = k.person_id;
  delete from public.care_group_members d
   where d.group_id = _drop
     and exists (select 1 from public.care_group_members k where k.group_id = _keep and k.person_id = d.person_id);
  select origin_client_id into _origin from public.care_groups where id = _drop;
  update public.care_groups set origin_client_id = null where id = _drop;
  update public.care_groups set origin_client_id = coalesce(origin_client_id, _origin) where id = _keep;
  n := private.care_repoint('public.care_groups'::regclass, _drop, _keep);
  delete from public.care_groups where id = _drop;
  return n;
end;
$$;

create or replace function public.care_people_merge(_keep uuid, _drop uuid, _combine_families boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare
  k public.care_people%rowtype;
  d public.care_people%rowtype;
  _moved integer := 0;
  _n integer;
  _families integer := 0;
  _keep_family uuid;
  _g uuid;
  r record;
begin
  perform private.care_group_admin_guard();
  if _keep = _drop then raise exception 'Choose two different people'; end if;
  select * into k from public.care_people where id = _keep for update;
  if not found then raise exception 'The person to keep was not found'; end if;
  select * into d from public.care_people where id = _drop for update;
  if not found then raise exception 'The person to merge was not found'; end if;

  if k.auth_user_id is not null and d.auth_user_id is not null and k.auth_user_id <> d.auth_user_id then
    raise exception 'Both people have their own sign-in. Ask which one they use, then remove the other before merging.';
  end if;
  if exists (select 1 from public.care_access_grants gd join public.care_access_grants gk
               on gk.client_id = gd.client_id and gk.person_id = _keep
              where gd.person_id = _drop) then
    raise exception 'Both people have access to the same care record. Withdraw one of the two before merging.';
  end if;

  -- Family membership and relationships that would clash.
  update public.care_group_members km
     set notes = nullif(concat_ws(E'\n', km.notes, dm.notes), '')
    from public.care_group_members dm
   where km.person_id = _keep and dm.person_id = _drop and dm.group_id = km.group_id;
  delete from public.care_group_members dm
   where dm.person_id = _drop
     and exists (select 1 from public.care_group_members km where km.person_id = _keep and km.group_id = dm.group_id);
  delete from public.care_person_relationships
   where (from_person_id = _keep and to_person_id = _drop) or (from_person_id = _drop and to_person_id = _keep);
  delete from public.care_person_relationships rd
   where rd.from_person_id = _drop
     and exists (select 1 from public.care_person_relationships rk
                  where rk.from_person_id = _keep and rk.to_person_id = rd.to_person_id
                    and rk.relationship_code = rd.relationship_code);
  delete from public.care_person_relationships rd
   where rd.to_person_id = _drop
     and exists (select 1 from public.care_person_relationships rk
                  where rk.to_person_id = _keep and rk.from_person_id = rd.from_person_id
                    and rk.relationship_code = rd.relationship_code);

  -- Two contact rows for the same human on one care record become one.
  for r in
    select dc.id as drop_contact, kc.id as keep_contact
      from public.client_contacts dc
      join public.client_contacts kc on kc.client_id = dc.client_id and kc.person_id = _keep
     where dc.person_id = _drop
  loop
    update public.client_contacts kc
       set is_primary = kc.is_primary or dc.is_primary,
           is_enquirer = kc.is_enquirer or dc.is_enquirer,
           is_next_of_kin = kc.is_next_of_kin or dc.is_next_of_kin,
           is_emergency_contact = kc.is_emergency_contact or dc.is_emergency_contact
      from public.client_contacts dc
     where kc.id = r.keep_contact and dc.id = r.drop_contact;
    _moved := _moved + private.care_repoint('public.client_contacts'::regclass, r.drop_contact, r.keep_contact);
    delete from public.client_contacts where id = r.drop_contact;
  end loop;

  -- Blanks on the kept person are filled from the other.
  update public.care_people set auth_user_id = null where id = _drop;
  update public.care_people
     set email = coalesce(nullif(email, ''), d.email),
         phone = coalesce(nullif(phone, ''), d.phone),
         whatsapp = coalesce(nullif(whatsapp, ''), d.whatsapp),
         country = coalesce(nullif(country, ''), d.country),
         preferred_name = coalesce(nullif(preferred_name, ''), d.preferred_name),
         first_name = coalesce(nullif(first_name, ''), d.first_name),
         last_name = coalesce(nullif(last_name, ''), d.last_name),
         auth_user_id = coalesce(auth_user_id, d.auth_user_id)
   where id = _keep;

  -- Earlier "different people" answers about the merged person no longer apply.
  delete from public.care_person_match_dismissals where _drop in (person_a, person_b);

  -- Membership first: moving contact rows makes the kept person join those
  -- families, which would then clash with the rows still to move.
  update public.care_group_members set person_id = _keep where person_id = _drop;
  get diagnostics _n = row_count;
  _moved := _moved + _n;
  _moved := _moved + private.care_repoint('public.care_people'::regclass, _drop, _keep);

  -- Their families become one, when asked: everything joins the kept
  -- person's first family.
  if _combine_families then
    select m.group_id into _keep_family from public.care_group_members m
      join public.care_groups g on g.id = m.group_id
     where m.person_id = _keep order by g.created_at limit 1;
    if _keep_family is not null then
      for _g in
        select distinct m.group_id from public.care_group_members m
         where m.person_id = _keep and m.group_id <> _keep_family
      loop
        _moved := _moved + private.care_family_combine(_keep_family, _g);
        _families := _families + 1;
      end loop;
    end if;
  end if;

  insert into public.care_person_merges (kept_person_id, merged_person, rows_moved, families_combined, merged_by)
  values (_keep, to_jsonb(d), _moved, _families, auth.uid());

  insert into public.care_activity (client_id, action, detail, actor_id)
  select distinct c.id, 'person_merged',
         jsonb_build_object('kept', k.full_name, 'merged', d.full_name, 'families_combined', _families),
         auth.uid()
    from public.clients c
   where c.person_id = _keep
      or c.id in (select client_id from public.client_contacts where person_id = _keep);

  delete from public.care_people where id = _drop;

  return jsonb_build_object('kept', _keep, 'rows_moved', _moved, 'families_combined', _families);
end;
$$;

revoke all on function public.care_person_matches(uuid) from public, anon;
revoke all on function public.care_person_match_dismiss(uuid, uuid) from public, anon;
revoke all on function public.care_people_merge(uuid, uuid, boolean) from public, anon;
grant execute on function public.care_person_matches(uuid) to authenticated;
grant execute on function public.care_person_match_dismiss(uuid, uuid) to authenticated;
grant execute on function public.care_people_merge(uuid, uuid, boolean) to authenticated;
