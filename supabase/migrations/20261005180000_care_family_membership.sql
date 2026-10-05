-- Care and family, step 7 of docs/care-platform/care-family-model.md.
-- Runs after 20261005170000_care_homes.sql. Safe to run twice.
--
-- A family member is just a member: one row per person per family. What a
-- person does (receives care, asked, is a contact, next of kin, emergency
-- contact, pays) is read from the care records, where it is kept, so it can
-- never disagree with them.

-- ---------------------------------------------------------------- reading roles
-- The care records in a family.
create or replace function private.care_family_clients(_group uuid)
returns setof uuid
language sql
stable
set search_path to 'public', 'private'
as $$
  select rr.client_id
    from public.care_request_recipients rr
    join public.care_requests q on q.id = rr.request_id
   where q.group_id = _group
  union
  select g.origin_client_id from public.care_groups g
   where g.id = _group and g.origin_client_id is not null
$$;

-- What a person does in a family, from the care records.
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
    case when exists (select 1 from public.client_commercial cm
                       where cm.client_id in (select private.care_family_clients(_group))
                         and cm.payer_person_id = _person)
         then 'payer' end
  ], null)
$$;

-- ---------------------------------------------------------------- one row per person
-- Everyone the care records name is a member (two families had none).
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public'
               and table_name = 'care_group_members' and column_name = 'role') then
    alter table public.care_group_members alter column role set default 'other';
  end if;
end $$;

insert into public.care_group_members (group_id, person_id)
select distinct g.id, x.person_id
  from public.care_groups g
  cross join lateral (
    select c.person_id from public.clients c
     where c.id in (select private.care_family_clients(g.id))
    union
    select cc.person_id from public.client_contacts cc
     where cc.client_id in (select private.care_family_clients(g.id))
    union
    select q.enquirer_person_id from public.care_requests q
     where q.group_id = g.id and q.enquirer_person_id is not null
  ) x
 where not exists (select 1 from public.care_group_members m
                    where m.group_id = g.id and m.person_id = x.person_id);

-- Duplicates (one row per role) collapse to the earliest, keeping any notes.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public'
               and table_name = 'care_group_members' and column_name = 'role') then
    update public.care_group_members keep
       set notes = nullif(concat_ws(E'\n', (
             select string_agg(distinct m.notes, E'\n') from public.care_group_members m
              where m.group_id = keep.group_id and m.person_id = keep.person_id and m.notes is not null)), '')
     where keep.id in (select distinct on (group_id, person_id) id from public.care_group_members
                        order by group_id, person_id, created_at, id);
    delete from public.care_group_members m
     where m.id not in (select distinct on (group_id, person_id) id from public.care_group_members
                         order by group_id, person_id, created_at, id);
    alter table public.care_group_members drop constraint if exists care_group_members_unique;
    alter table public.care_group_members drop constraint if exists care_group_members_role_check;
    alter table public.care_group_members drop column role;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'care_group_members_one_per_person') then
    alter table public.care_group_members
      add constraint care_group_members_one_per_person unique (group_id, person_id);
  end if;
end $$;

-- ---------------------------------------------------------------- staying a member
-- A contact added to a care record joins that record's family.
create or replace function private.care_contact_joins_family()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
begin
  insert into public.care_group_members (group_id, person_id, created_by)
  select distinct q.group_id, new.person_id, auth.uid()
    from public.care_request_recipients rr join public.care_requests q on q.id = rr.request_id
   where rr.client_id = new.client_id
  on conflict (group_id, person_id) do nothing;
  return new;
end;
$$;
drop trigger if exists care_contact_joins_family on public.client_contacts;
create trigger care_contact_joins_family after insert or update of person_id on public.client_contacts
for each row execute function private.care_contact_joins_family();

-- An enquirer joins the request's family.
create or replace function private.care_enquirer_joins_family()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
begin
  if new.enquirer_person_id is not null then
    insert into public.care_group_members (group_id, person_id, created_by)
    values (new.group_id, new.enquirer_person_id, auth.uid())
    on conflict (group_id, person_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists care_enquirer_joins_family on public.care_requests;
create trigger care_enquirer_joins_family after insert or update of enquirer_person_id, group_id on public.care_requests
for each row execute function private.care_enquirer_joins_family();

-- ---------------------------------------------------------------- writers without roles
create or replace function private.care_group_sync_recipient(_recipient_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  _rr public.care_request_recipients%rowtype;
  _group uuid;
  _enquirer uuid;
  _contact public.client_contacts%rowtype;
  _raw text;
  _code text;
  _inverse text;
begin
  select * into _rr from public.care_request_recipients where id = _recipient_id;
  if not found then return; end if;

  select r.group_id, r.enquirer_person_id into _group, _enquirer
    from public.care_requests r where r.id = _rr.request_id;
  if _group is null then return; end if;

  insert into public.care_group_members (group_id, person_id, created_by)
  select _group, p, auth.uid() from unnest(array[_rr.person_id, _enquirer]) p where p is not null
  on conflict (group_id, person_id) do nothing;

  insert into public.care_group_members (group_id, person_id, created_by)
  select distinct _group, cc.person_id, auth.uid() from public.client_contacts cc where cc.client_id = _rr.client_id
  on conflict (group_id, person_id) do nothing;

  select * into _contact from public.client_contacts
   where client_id = _rr.client_id and person_id is not null
   order by is_primary desc nulls last, created_at
   limit 1;

  if _contact.person_id is not null and _rr.person_id is not null
     and _contact.person_id <> _rr.person_id then
    _raw := nullif(coalesce(nullif(_contact.relationship, ''), _contact.relationship_other), '');
    _code := private.care_contact_relationship_code(_contact.relationship_code, _raw);
    select inverse_code into _inverse from public.care_group_relationship_terms where code = _code;

    insert into public.care_person_relationships
      (group_id, from_person_id, to_person_id, relationship_code, other_label, created_by)
    values (_group, _contact.person_id, _rr.person_id, _code,
            case when _code = 'other' then _raw else null end, auth.uid())
    on conflict (from_person_id, to_person_id, relationship_code) do nothing;

    if _inverse is not null then
      insert into public.care_person_relationships
        (group_id, from_person_id, to_person_id, relationship_code, other_label, created_by)
      values (_group, _rr.person_id, _contact.person_id, _inverse, null, auth.uid())
      on conflict (from_person_id, to_person_id, relationship_code) do nothing;
    end if;
  end if;
end;
$function$;

create or replace function public.care_recipient_create(_request_id uuid, _full_name text, _person_id uuid default null::uuid, _preferred_name text default null::text, _date_of_birth date default null::date, _age_years integer default null::integer, _sex_code text default null::text, _address_line text default null::text, _landmark text default null::text, _state_code text default null::text, _lga_code text default null::text, _email text default null::text, _phone text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare _group uuid; _person uuid; _client uuid; _recipient uuid; _next integer;
begin
  perform private.care_group_admin_guard();
  select group_id into _group from public.care_requests where id = _request_id;
  if _group is null then raise exception 'Care request not found'; end if;
  if coalesce(btrim(_full_name), '') = '' then raise exception 'A recipient needs a name'; end if;

  _person := _person_id;
  if _person is null then
    _person := public.care_person_create(_full_name, _preferred_name, _email, _phone);
  elsif not exists (select 1 from public.care_people where id = _person) then
    raise exception 'Person not found';
  end if;

  -- An existing recipient for this person on this request is reused.
  select rr.id, rr.client_id into _recipient, _client
    from public.care_request_recipients rr
   where rr.request_id = _request_id and rr.person_id = _person;

  if _recipient is null then
    insert into public.clients
      (full_name, preferred_name, date_of_birth, age_years, sex_code,
       address_line, landmark, state_code, lga_code, stage)
    values (btrim(_full_name), nullif(btrim(coalesce(_preferred_name, '')), ''),
            _date_of_birth, _age_years, _sex_code,
            _address_line, _landmark, _state_code, _lga_code, 'new')
    returning id into _client;

    select coalesce(max(display_order), 0) + 1 into _next
      from public.care_request_recipients where request_id = _request_id;

    insert into public.care_request_recipients
      (request_id, client_id, person_id, display_order, created_by)
    values (_request_id, _client, _person, _next, auth.uid())
    returning id into _recipient;
  end if;

  insert into public.care_group_members (group_id, person_id, created_by)
  values (_group, _person, auth.uid())
  on conflict (group_id, person_id) do nothing;

  return jsonb_build_object('recipient_id', _recipient, 'client_id', _client, 'person_id', _person);
end;
$function$;

-- The role argument stays so existing callers keep working; it is ignored.
create or replace function public.care_recipient_person_link(_recipient_id uuid, _person_id uuid, _role text default null::text)
returns void
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare _group uuid; _existing uuid;
begin
  perform private.care_group_admin_guard();
  select r.group_id, rr.person_id into _group, _existing
    from public.care_request_recipients rr
    join public.care_requests r on r.id = rr.request_id
   where rr.id = _recipient_id;
  if _group is null then raise exception 'Recipient not found'; end if;
  if not exists (select 1 from public.care_people where id = _person_id) then
    raise exception 'Person not found';
  end if;
  if _existing is not null and _existing <> _person_id then
    raise exception 'This recipient is already a different person. Records are never merged.';
  end if;

  update public.care_request_recipients set person_id = _person_id where id = _recipient_id;

  insert into public.care_group_members (group_id, person_id, created_by)
  values (_group, _person_id, auth.uid())
  on conflict (group_id, person_id) do nothing;
end;
$function$;

drop function if exists public.care_group_member_set(uuid, uuid, text, text);
create or replace function public.care_group_member_add(_group_id uuid, _person_id uuid, _notes text default null::text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare _id uuid;
begin
  perform private.care_group_admin_guard();
  insert into public.care_group_members (group_id, person_id, notes, created_by)
  values (_group_id, _person_id, _notes, auth.uid())
  on conflict (group_id, person_id) do update set notes = coalesce(excluded.notes, public.care_group_members.notes)
  returning id into _id;
  return _id;
end;
$function$;
revoke all on function public.care_group_member_add(uuid, uuid, text) from public, anon;
grant execute on function public.care_group_member_add(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------- readers
-- Members carry the roles read from the care records.
create or replace function public.care_group_overview(_group_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'private'
as $function$
declare _out jsonb;
begin
  if not private.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'Not allowed to read care groups';
  end if;

  select jsonb_build_object(
    'group', to_jsonb(g),
    'members', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.id, 'roles', to_jsonb(private.care_person_roles(g.id, m.person_id)),
        'person_id', m.person_id,
        'full_name', p.full_name, 'email', p.email, 'phone', p.phone) order by m.created_at)
      from public.care_group_members m join public.care_people p on p.id = m.person_id
      where m.group_id = g.id), '[]'::jsonb),
    'relationships', coalesce((select jsonb_agg(jsonb_build_object(
        'id', rel.id, 'from_person_id', rel.from_person_id, 'to_person_id', rel.to_person_id,
        'relationship_code', rel.relationship_code, 'other_label', rel.other_label) order by rel.created_at)
      from public.care_person_relationships rel where rel.group_id = g.id), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'status', r.status, 'source', r.source,
        'enquirer_person_id', r.enquirer_person_id, 'created_at', r.created_at,
        'recipients', coalesce((select jsonb_agg(jsonb_build_object(
            'id', rr.id, 'client_id', rr.client_id, 'person_id', rr.person_id,
            'full_name', c.full_name, 'display_order', rr.display_order,
            'address_line', c.address_line) order by rr.display_order)
          from public.care_request_recipients rr join public.clients c on c.id = rr.client_id
          where rr.request_id = r.id), '[]'::jsonb),
        'services', coalesce((select jsonb_agg(jsonb_build_object(
            'id', si.id, 'service_id', si.service_id, 'service_name', s.name, 'service_slug', s.slug,
            'state', si.state, 'is_shared', si.is_shared, 'reason', si.reason,
            'recipients', coalesce((select jsonb_agg(jsonb_build_object(
                'request_recipient_id', sir.request_recipient_id,
                'needs_clinical_resolution', sir.needs_clinical_resolution,
                'conflict_reason', sir.conflict_reason))
              from public.care_service_intention_recipients sir
              where sir.intention_id = si.id), '[]'::jsonb)) order by si.created_at)
          from public.care_service_intentions si join public.services s on s.id = si.service_id
          where si.request_id = r.id), '[]'::jsonb)
      ) order by r.created_at)
      from public.care_requests r where r.group_id = g.id), '[]'::jsonb),
    'visits', coalesce((select jsonb_agg(jsonb_build_object(
        'id', v.id, 'appointment_at', v.appointment_at, 'location_kind', v.location_kind,
        'status', v.status, 'assessor_person_id', v.assessor_person_id,
        'work_ids', coalesce((select jsonb_agg(w.id) from public.care_assessment_work w
                              where w.visit_id = v.id), '[]'::jsonb)) order by v.appointment_at)
      from public.care_assessment_visits v where v.group_id = g.id), '[]'::jsonb)
  ) into _out
  from public.care_groups g where g.id = _group_id;

  if _out is null then raise exception 'Care group not found'; end if;
  return _out;
end;
$function$;

create or replace function public.care_client_links(_client_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'private'
as $function$
declare _group uuid; _out jsonb;
begin
  perform private.care_group_admin_guard();

  select r.group_id into _group
    from public.care_request_recipients rr
    join public.care_requests r on r.id = rr.request_id
   where rr.client_id = _client_id
   order by r.created_at limit 1;
  if _group is null then
    select id into _group from public.care_groups where origin_client_id = _client_id;
  end if;
  if _group is null then
    return jsonb_build_object('household', null, 'people', '[]'::jsonb);
  end if;

  select jsonb_build_object(
    'household', (select jsonb_build_object('id', g.id, 'display_name', g.display_name, 'status', g.status)
                    from public.care_groups g where g.id = _group),
    'people', coalesce((
      select jsonb_agg(person order by person ->> 'full_name')
      from (
        select jsonb_build_object(
          'person_id', p.id,
          'full_name', p.full_name,
          'email', p.email,
          'phone', p.phone,
          'roles', to_jsonb(private.care_person_roles(_group, p.id)),
          'client_id', (select c.id from public.clients c
                         where c.person_id = p.id and c.id in (select private.care_family_clients(_group))
                         order by c.created_at limit 1),
          'relationships', (select coalesce(jsonb_agg(jsonb_build_object(
                                'id', rel.id, 'to_person_id', rel.to_person_id,
                                'code', rel.relationship_code, 'other_label', rel.other_label,
                                'label', t.label,
                                'to_name', tp.full_name)), '[]'::jsonb)
                              from public.care_person_relationships rel
                              join public.care_people tp on tp.id = rel.to_person_id
                              left join public.care_group_relationship_terms t on t.code = rel.relationship_code
                             where rel.from_person_id = p.id)
        ) as person
        from public.care_people p
        where p.id in (select m.person_id from public.care_group_members m where m.group_id = _group)
      ) people
    ), '[]'::jsonb)
  ) into _out;

  return _out;
end;
$function$;
