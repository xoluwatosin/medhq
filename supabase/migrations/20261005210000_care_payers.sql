-- Care and family, step 10 of docs/care-platform/care-family-model.md
-- (section 3.1). Runs after 20261005200000_care_link_scope.sql. Safe to run
-- twice.
--
-- A payer is a person or an organisation (an employer, HMO or insurer,
-- church or mosque, NGO, government body). A care record can have several
-- payers, each with a share; the shares add up to 100. The usual case is one
-- payer at 100.
--
-- Paying gives no access by itself. An organisation's billing contact can be
-- given finance access on the care record's Access tab, backed by a finance
-- reason, like anyone else. Invoices keep a copy of who they were raised to,
-- so a change of payer never rewrites an old invoice.

-- ---------------------------------------------------------------- organisations
create table if not exists public.care_organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  kind text not null default 'other'
    check (kind in ('employer', 'hmo_insurer', 'faith', 'ngo', 'government', 'other')),
  billing_email text,
  billing_phone text,
  billing_address text,
  notes text,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.care_organisations enable row level security;
drop policy if exists "Admins read care organisations" on public.care_organisations;
create policy "Admins read care organisations" on public.care_organisations
  for select to authenticated using (private.has_role(auth.uid(), 'admin'::app_role));

create table if not exists public.care_organisation_people (
  organisation_id uuid not null references public.care_organisations(id) on delete cascade,
  person_id uuid not null references public.care_people(id) on delete cascade,
  role text not null default 'billing_contact' check (role in ('billing_contact', 'approver', 'other')),
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (organisation_id, person_id)
);
alter table public.care_organisation_people enable row level security;
drop policy if exists "Admins read care organisation people" on public.care_organisation_people;
create policy "Admins read care organisation people" on public.care_organisation_people
  for select to authenticated using (private.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------- payers
create table if not exists public.care_payers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  person_id uuid references public.care_people(id) on delete cascade,
  organisation_id uuid references public.care_organisations(id) on delete restrict,
  share_percent numeric(5,2) not null default 100 check (share_percent > 0 and share_percent <= 100),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint care_payers_one_kind check (num_nonnulls(person_id, organisation_id) = 1)
);
create unique index if not exists care_payers_person_once on public.care_payers(client_id, person_id) where person_id is not null;
create unique index if not exists care_payers_organisation_once on public.care_payers(client_id, organisation_id) where organisation_id is not null;
create index if not exists care_payers_client_idx on public.care_payers(client_id);
alter table public.care_payers enable row level security;
drop policy if exists "Admins read care payers" on public.care_payers;
create policy "Admins read care payers" on public.care_payers
  for select to authenticated using (private.has_role(auth.uid(), 'admin'::app_role));

-- Shares add up to the whole, checked when the transaction ends so a change
-- of several payers can be made in steps.
create or replace function private.care_payer_shares_check()
returns trigger
language plpgsql
set search_path to 'public', 'private'
as $$
declare _client uuid := coalesce(new.client_id, old.client_id); _sum numeric;
begin
  select sum(share_percent) into _sum from public.care_payers where client_id = _client;
  if _sum is not null and _sum <> 100 then
    raise exception 'Payer shares on a care record must add up to 100 (they add up to %).', _sum;
  end if;
  return null;
end;
$$;
drop trigger if exists care_payer_shares_check on public.care_payers;
create constraint trigger care_payer_shares_check
after insert or update or delete on public.care_payers
deferrable initially deferred
for each row execute function private.care_payer_shares_check();

-- Two people merged (step 8) who both paid for one record become one payer
-- with both shares.
create or replace function private.care_payer_person_fold()
returns trigger
language plpgsql
set search_path to 'public', 'private'
as $$
begin
  if new.person_id is not null and exists (
    select 1 from public.care_payers where client_id = new.client_id and person_id = new.person_id and id <> new.id) then
    update public.care_payers set share_percent = least(100, share_percent + old.share_percent)
     where client_id = new.client_id and person_id = new.person_id and id <> new.id;
    -- This row keeps the merged person and goes with them when they are deleted.
    return null;
  end if;
  return new;
end;
$$;
drop trigger if exists care_payer_person_fold on public.care_payers;
create trigger care_payer_person_fold before update of person_id on public.care_payers
for each row execute function private.care_payer_person_fold();

-- The same for someone at an organisation.
create or replace function private.care_organisation_person_fold()
returns trigger
language plpgsql
set search_path to 'public', 'private'
as $$
begin
  if exists (select 1 from public.care_organisation_people
              where organisation_id = new.organisation_id and person_id = new.person_id) then
    return null;
  end if;
  return new;
end;
$$;
drop trigger if exists care_organisation_person_fold on public.care_organisation_people;
create trigger care_organisation_person_fold before update of person_id on public.care_organisation_people
for each row execute function private.care_organisation_person_fold();

-- The one payer recorded today moves across at 100.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public'
               and table_name = 'client_commercial' and column_name = 'payer_person_id') then
    insert into public.care_payers (client_id, person_id, share_percent)
    select cm.client_id, cm.payer_person_id, 100 from public.client_commercial cm
     where cm.payer_person_id is not null
       and not exists (select 1 from public.care_payers p where p.client_id = cm.client_id);
  end if;
end $$;

-- Invoices: who an invoice was raised to, and for what share.
alter table public.paystack_invoices add column if not exists payer_organisation_id uuid references public.care_organisations(id) on delete set null;
alter table public.paystack_invoices add column if not exists payer_share_percent numeric(5,2);

-- ---------------------------------------------------------------- staff actions
create or replace function public.care_organisation_save(
  _id uuid, _name text, _kind text default 'other', _billing_email text default null,
  _billing_phone text default null, _billing_address text default null, _notes text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare _out uuid;
begin
  if not private.care_can_admin_access(auth.uid()) then raise exception 'Not allowed to change organisations'; end if;
  if coalesce(btrim(_name), '') = '' then raise exception 'An organisation needs a name'; end if;
  if _id is null then
    insert into public.care_organisations (name, kind, billing_email, billing_phone, billing_address, notes, created_by)
    values (btrim(_name), coalesce(_kind, 'other'), nullif(lower(btrim(_billing_email)), ''),
            nullif(btrim(_billing_phone), ''), nullif(btrim(_billing_address), ''), nullif(btrim(_notes), ''), auth.uid())
    returning id into _out;
  else
    update public.care_organisations
       set name = btrim(_name), kind = coalesce(_kind, kind),
           billing_email = nullif(lower(btrim(_billing_email)), ''), billing_phone = nullif(btrim(_billing_phone), ''),
           billing_address = nullif(btrim(_billing_address), ''), notes = nullif(btrim(_notes), ''), updated_at = now()
     where id = _id
    returning id into _out;
    if _out is null then raise exception 'Organisation not found'; end if;
  end if;
  return _out;
end;
$$;

-- Someone at an organisation: an existing person, or a new one by name.
create or replace function public.care_organisation_person_add(
  _organisation_id uuid, _person_id uuid default null, _full_name text default null,
  _email text default null, _phone text default null, _role text default 'billing_contact')
returns uuid
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare _person uuid := _person_id;
begin
  if not private.care_can_admin_access(auth.uid()) then raise exception 'Not allowed to change organisations'; end if;
  if not exists (select 1 from public.care_organisations where id = _organisation_id) then
    raise exception 'Organisation not found';
  end if;
  if _person is null then
    if coalesce(btrim(_full_name), '') = '' then raise exception 'Give the person''s name'; end if;
    insert into public.care_people (full_name, email, phone, source, created_by)
    values (btrim(_full_name), nullif(lower(btrim(_email)), ''), nullif(btrim(_phone), ''), 'organisation', auth.uid())
    returning id into _person;
  end if;
  insert into public.care_organisation_people (organisation_id, person_id, role, created_by)
  values (_organisation_id, _person, coalesce(_role, 'billing_contact'), auth.uid())
  on conflict (organisation_id, person_id) do update set role = excluded.role;
  return _person;
end;
$$;

-- Replace a care record's payers in one step: [{person_id | organisation_id, share_percent}].
create or replace function public.care_payers_set(_client_id uuid, _payers jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare r jsonb;
begin
  if not private.care_can_admin_access(auth.uid()) then raise exception 'Not allowed to set the payer'; end if;
  if not exists (select 1 from public.clients where id = _client_id) then raise exception 'Care record not found'; end if;
  if jsonb_typeof(coalesce(_payers, '[]'::jsonb)) <> 'array' then raise exception 'Payers must be a list'; end if;

  delete from public.care_payers where client_id = _client_id;
  for r in select value from jsonb_array_elements(coalesce(_payers, '[]'::jsonb)) loop
    insert into public.care_payers (client_id, person_id, organisation_id, share_percent, created_by)
    values (_client_id, nullif(r ->> 'person_id', '')::uuid, nullif(r ->> 'organisation_id', '')::uuid,
            coalesce((r ->> 'share_percent')::numeric, 100), auth.uid());
  end loop;

  insert into public.care_activity (client_id, action, detail, actor_id)
  values (_client_id, 'payers_set', jsonb_build_object('payers', coalesce(_payers, '[]'::jsonb)), auth.uid());
end;
$$;

-- The single-person setter the Access tab uses: that person pays all of it.
create or replace function public.care_payer_set(_client_id uuid, _person_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
begin
  perform public.care_payers_set(_client_id,
    case when _person_id is null then '[]'::jsonb
         else jsonb_build_array(jsonb_build_object('person_id', _person_id, 'share_percent', 100)) end);
end;
$$;

-- Payers on a care record, with organisations' people, and the choices.
create or replace function public.care_payers_overview(_client_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'private'
as $$
begin
  if not private.care_can_admin_access(auth.uid()) then raise exception 'Not allowed to see payers'; end if;
  return jsonb_build_object(
    'payers', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', py.id, 'share_percent', py.share_percent,
          'person', case when py.person_id is null then null else
            (select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone)
               from public.care_people p where p.id = py.person_id) end,
          'organisation', case when py.organisation_id is null then null else
            (select jsonb_build_object('id', o.id, 'name', o.name, 'kind', o.kind,
                      'billing_email', o.billing_email, 'billing_phone', o.billing_phone,
                      'people', coalesce((select jsonb_agg(jsonb_build_object(
                                   'id', p.id, 'full_name', p.full_name, 'email', p.email, 'role', op.role))
                                 from public.care_organisation_people op join public.care_people p on p.id = op.person_id
                                where op.organisation_id = o.id), '[]'::jsonb))
               from public.care_organisations o where o.id = py.organisation_id) end)
        order by py.share_percent desc, py.created_at)
        from public.care_payers py where py.client_id = _client_id), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(distinct jsonb_build_object('id', p.id, 'full_name', p.full_name))
        from public.care_people p
       where p.id in (select person_id from public.client_contacts where client_id = _client_id
                      union select person_id from public.clients where id = _client_id)), '[]'::jsonb),
    'organisations', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'kind', o.kind) order by o.name)
        from public.care_organisations o where o.archived_at is null), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.care_organisation_save(uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.care_organisation_person_add(uuid, uuid, text, text, text, text) from public, anon;
revoke all on function public.care_payers_set(uuid, jsonb) from public, anon;
revoke all on function public.care_payers_overview(uuid) from public, anon;
grant execute on function public.care_organisation_save(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.care_organisation_person_add(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.care_payers_set(uuid, jsonb) to authenticated;
grant execute on function public.care_payers_overview(uuid) to authenticated;

-- ---------------------------------------------------------------- readers
-- The Access tab lists direct payers and the people of paying organisations,
-- so either can be given finance access.
create or replace function public.care_access_overview(_client_id uuid)
returns table(person_id uuid, person_name text, email text, phone text, contact_id uuid, relationship text,
              is_primary boolean, is_payer boolean, grant_id uuid, grant_state text, journey_scope boolean,
              clinical_scope boolean, finance_scope boolean, grant_reason text, granted_at timestamptz,
              revoked_reason text, clinical_basis_id uuid, finance_basis_id uuid, bases jsonb, invitation jsonb)
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
begin
  if not private.care_can_admin_access(auth.uid()) then
    raise exception 'Not allowed to see access for this client';
  end if;

  return query
  with payer_people as (
    select py.person_id as pid from public.care_payers py
     where py.client_id = _client_id and py.person_id is not null
    union
    select op.person_id from public.care_payers py
      join public.care_organisation_people op on op.organisation_id = py.organisation_id
     where py.client_id = _client_id
  ), people as (
    select cc.person_id as pid from public.client_contacts cc
      where cc.client_id = _client_id and cc.person_id is not null
    union
    select g.person_id from public.care_access_grants g where g.client_id = _client_id
    union
    select b.person_id from public.care_access_bases b where b.client_id = _client_id
    union
    select pp.pid from payer_people pp
  )
  select
    p.id,
    coalesce(nullif(p.preferred_name, ''), p.full_name),
    p.email,
    p.phone,
    cc.id,
    coalesce(cc.relationship,
      (select o.name from public.care_payers py
         join public.care_organisation_people op on op.organisation_id = py.organisation_id
         join public.care_organisations o on o.id = py.organisation_id
        where py.client_id = _client_id and op.person_id = p.id limit 1)),
    coalesce(cc.is_primary, false),
    exists (select 1 from payer_people pp where pp.pid = p.id),
    g.id,
    g.state,
    coalesce(g.journey_scope, false),
    coalesce(g.clinical_scope, false),
    coalesce(g.finance_scope, false),
    g.grant_reason,
    g.granted_at,
    g.revoked_reason,
    g.clinical_basis_id,
    g.finance_basis_id,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'basis_kind', b.basis_kind, 'evidence_note', b.evidence_note,
        'evidence_sighted', b.evidence_sighted, 'recorded_at', b.recorded_at,
        'withdrawn_at', b.withdrawn_at, 'withdrawn_reason', b.withdrawn_reason
      ) order by b.recorded_at desc)
      from public.care_access_bases b
      where b.client_id = _client_id and b.person_id = p.id
    ), '[]'::jsonb),
    (
      select jsonb_build_object(
        'id', i.id, 'expires_at', i.expires_at, 'accepted_at', i.accepted_at,
        'first_opened_at', i.first_opened_at, 'revoked_at', i.revoked_at,
        'destination', i.destination, 'created_at', i.created_at,
        'delivery_status', n.status, 'delivery_error', n.provider_error,
        'delivery_attempts', n.attempt_count, 'notification_id', n.id
      )
      from public.care_portal_invitations i
      left join public.care_notifications n
        on n.related_table = 'care_portal_invitations' and n.related_id = i.id
      where i.client_id = _client_id and i.person_id = p.id
      order by i.created_at desc, n.created_at desc
      limit 1
    )
  from people pl
  join public.care_people p on p.id = pl.pid
  left join lateral (
    select c.id, c.relationship, c.is_primary from public.client_contacts c
      where c.client_id = _client_id and c.person_id = p.id
      order by c.is_primary desc, c.created_at limit 1
  ) cc on true
  left join public.care_access_grants g
    on g.client_id = _client_id and g.person_id = p.id
  order by coalesce(cc.is_primary, false) desc, coalesce(nullif(p.preferred_name, ''), p.full_name);
end;
$function$;

-- Family roles (step 7) read payers from the new table.
create or replace function private.care_person_roles(_group uuid, _person uuid)
returns text[]
language sql
stable
set search_path to 'public', 'private'
as $$
  select array_remove(array[
    case when exists (select 1 from public.clients c
                       where c.id in (select private.care_family_clients(_group)) and c.person_id = _person)
         then 'care_recipient' end,
    case when exists (select 1 from public.care_requests q
                       where q.group_id = _group and q.enquirer_person_id = _person)
         then 'enquirer' end,
    case when exists (select 1 from public.client_contacts cc join public.clients c on c.id = cc.client_id
                       where c.id in (select private.care_family_clients(_group))
                         and cc.person_id = _person and c.person_id <> _person)
         then 'contact' end,
    case when exists (select 1 from public.client_contacts cc
                       where cc.client_id in (select private.care_family_clients(_group))
                         and cc.person_id = _person and cc.is_next_of_kin)
         then 'next_of_kin' end,
    case when exists (select 1 from public.client_contacts cc
                       where cc.client_id in (select private.care_family_clients(_group))
                         and cc.person_id = _person and cc.is_emergency_contact)
         then 'emergency_contact' end,
    case when exists (select 1 from public.care_payers py
                       where py.client_id in (select private.care_family_clients(_group))
                         and py.person_id = _person)
         then 'payer' end
  ], null)
$$;

-- Nothing reads the old single payer any more.
alter table public.client_commercial drop column if exists payer_person_id;
