-- Care and family, steps 2 to 5 of docs/care-platform/care-family-model.md.
-- Runs after 20261005150000_remove_test_care_records.sql. Safe to run twice.
--
-- 2. Every care record points at a person.
-- 3. A relationship is the contact's relationship to the service user (the
--    clinical convention), and the household view is built that way round.
-- 4. Every care request names its enquirer; contacts gain next-of-kin and
--    emergency-contact flags.
-- 5. Authority to act lives only in access bases; the unused contact
--    authority columns go.

-- ---------------------------------------------------------------- step 2
-- "Self" is a relationship the public form already writes when someone asks
-- for care for themselves, but it was never in the list, so that path was
-- refused. It joins the list here.
insert into public.care_relationship_terms (code, label, is_active)
values ('self', 'Self', true)
on conflict (code) do nothing;

alter table public.clients add column if not exists person_id uuid references public.care_people(id) on delete restrict;

-- a. The person the care request already names for this record.
update public.clients c
set person_id = r.person_id
from (
  select distinct on (client_id) client_id, person_id
  from public.care_request_recipients
  where person_id is not null
  order by client_id, created_at
) r
where c.person_id is null and r.client_id = c.id;

-- b. People who enquired for themselves: the enquirer contact carries the
--    same name as the care record and no relationship. One human, one row.
with self_contacts as (
  select distinct on (cc.client_id) cc.client_id, cc.person_id
  from public.client_contacts cc
  join public.clients c on c.id = cc.client_id
  where c.person_id is null
    and cc.is_enquirer
    and lower(btrim(cc.full_name)) = lower(btrim(c.full_name))
    and coalesce(nullif(lower(btrim(cc.relationship)), ''), 'self') = 'self'
  order by cc.client_id, cc.created_at
)
update public.clients c set person_id = s.person_id
from self_contacts s where c.id = s.client_id;

-- c. Everyone else gets a person made from the care record.
do $$
declare r record; new_person uuid;
begin
  for r in select id, full_name, first_name, last_name from public.clients where person_id is null loop
    insert into public.care_people (full_name, first_name, last_name, source)
    values (r.full_name, r.first_name, r.last_name, 'care_record')
    returning id into new_person;
    update public.clients set person_id = new_person where id = r.id;
  end loop;
end $$;

-- A contact who is the service user is recorded as Self.
update public.client_contacts cc
set relationship = 'Self', relationship_code = 'self'
from public.clients c
where c.id = cc.client_id and cc.person_id = c.person_id
  and cc.relationship_code is distinct from 'self';

alter table public.clients alter column person_id set not null;
create index if not exists clients_person_id_idx on public.clients(person_id);

-- ---------------------------------------------------------------- step 3
-- The contact's relationship word, as a household relationship code. Read
-- from the contact's controlled code, falling back to its label. Exact
-- matches, so "Grandmother" is never read as "Mother".
create or replace function private.care_contact_relationship_code(_code text, _raw text)
returns text
language sql
stable
set search_path to 'public', 'private'
as $$
  with term as (
    select coalesce(
      nullif(lower(btrim(_code)), ''),
      (select t.code from public.care_relationship_terms t where lower(t.label) = lower(btrim(coalesce(_raw, ''))) limit 1)
    ) as code
  )
  select case code
    when 'mother' then 'mother_of'
    when 'father' then 'father_of'
    when 'stepmother' then 'parent_or_guardian_of'
    when 'stepfather' then 'parent_or_guardian_of'
    when 'guardian' then 'parent_or_guardian_of'
    when 'son' then 'child_of'
    when 'daughter' then 'child_of'
    when 'stepson' then 'child_of'
    when 'stepdaughter' then 'child_of'
    when 'grandmother' then 'grandparent_of'
    when 'grandfather' then 'grandparent_of'
    when 'grandson' then 'grandchild_of'
    when 'granddaughter' then 'grandchild_of'
    when 'husband' then 'spouse_or_partner_of'
    when 'wife' then 'spouse_or_partner_of'
    when 'spouse' then 'spouse_or_partner_of'
    when 'partner' then 'spouse_or_partner_of'
    when 'brother' then 'sibling_of'
    when 'sister' then 'sibling_of'
    when 'friend' then 'friend_of'
    when 'family_friend' then 'friend_of'
    when 'neighbour' then 'friend_of'
    when 'case_manager' then 'professional_representative_of'
    when 'nurse' then 'professional_representative_of'
    when 'referring_doctor' then 'professional_representative_of'
    when 'employer' then 'professional_representative_of'
    when 'aunt' then 'relative_of' when 'uncle' then 'relative_of'
    when 'niece' then 'relative_of' when 'nephew' then 'relative_of'
    when 'cousin' then 'relative_of'
    when 'brother_in_law' then 'relative_of' when 'sister_in_law' then 'relative_of'
    when 'mother_in_law' then 'relative_of' when 'father_in_law' then 'relative_of'
    when 'son_in_law' then 'relative_of' when 'daughter_in_law' then 'relative_of'
    else 'other'
  end
  from term
$$;

-- Household sync, the clinical way round: the contact's relationship to the
-- service user is recorded from the contact to the service user, with the
-- inverse alongside.
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

  if _rr.person_id is not null then
    insert into public.care_group_members (group_id, person_id, role, created_by)
    values (_group, _rr.person_id, 'care_recipient', auth.uid())
    on conflict (group_id, person_id, role) do nothing;
  end if;

  if _enquirer is not null then
    insert into public.care_group_members (group_id, person_id, role, created_by)
    values (_group, _enquirer, 'enquirer', auth.uid())
    on conflict (group_id, person_id, role) do nothing;
  end if;

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

    insert into public.care_group_members (group_id, person_id, role, created_by)
    values (_group, _contact.person_id, 'contact', auth.uid())
    on conflict (group_id, person_id, role) do nothing;
  end if;
end;
$function$;

-- d. Request recipients that never named the person now do. The sync above
--    runs for each one filled, the clinical way round. A recipient naming a
--    different person from its care record is listed for a person to check.
update public.care_request_recipients r
set person_id = c.person_id
from public.clients c
where r.client_id = c.id and r.person_id is null;

do $$
declare r record;
begin
  for r in
    select c.enquiry_number, c.full_name
    from public.care_request_recipients rr join public.clients c on c.id = rr.client_id
    where rr.person_id <> c.person_id
  loop
    raise notice 'Check % (%): a care request names a different person for this record.', r.enquiry_number, r.full_name;
  end loop;
end $$;

-- From now on. Every intake path makes the care record first and names its
-- person on the request recipient straight after, so the column can stay
-- NOT NULL: a new record gets a placeholder person made from it, and the
-- first recipient row swaps in the person the intake named and removes the
-- placeholder. A record added by hand keeps the person made from it.
create or replace function private.care_client_person_fill()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
begin
  if new.person_id is null then
    insert into public.care_people (full_name, first_name, last_name, source)
    values (new.full_name, new.first_name, new.last_name, 'care_record')
    returning id into new.person_id;
  end if;
  return new;
end;
$$;
drop trigger if exists care_client_person_fill on public.clients;
create trigger care_client_person_fill before insert on public.clients
for each row execute function private.care_client_person_fill();

create or replace function private.care_recipient_person_fill()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare _current uuid; _source text;
begin
  select c.person_id, p.source into _current, _source
    from public.clients c join public.care_people p on p.id = c.person_id
   where c.id = new.client_id;

  if new.person_id is null then
    new.person_id := _current;
  elsif _current is distinct from new.person_id and _source = 'care_record'
        and not exists (select 1 from public.care_request_recipients where client_id = new.client_id) then
    -- The care record's placeholder gives way to the person the intake named.
    update public.clients set person_id = new.person_id where id = new.client_id;
    delete from public.care_people p
     where p.id = _current
       and not exists (select 1 from public.clients where person_id = p.id)
       and not exists (select 1 from public.client_contacts where person_id = p.id)
       and not exists (select 1 from public.care_request_recipients where person_id = p.id)
       and not exists (select 1 from public.care_group_members where person_id = p.id);
  elsif _current is distinct from new.person_id then
    raise exception 'This care record already belongs to another person';
  end if;
  return new;
end;
$$;
drop trigger if exists care_recipient_person_fill on public.care_request_recipients;
create trigger care_recipient_person_fill before insert on public.care_request_recipients
for each row execute function private.care_recipient_person_fill();

-- Answers given on the public form before this change described the service
-- user, not the contact. The one real household affected, confirmed by staff
-- on 5 October 2026: Oluwatobi Belewu is Oluwabukayomi Bolanle's mother.
update public.client_contacts cc
set relationship = 'Mother', relationship_code = 'mother'
from public.clients c
where c.id = cc.client_id and c.enquiry_number = 'MC-2609-0082'
  and cc.is_enquirer and lower(coalesce(cc.relationship, '')) = 'son';

-- Any other contact still holding a public-form answer needs a person to
-- check it; they are listed, never guessed.
do $$
declare r record;
begin
  for r in
    select c.enquiry_number, cc.full_name, cc.relationship
    from public.client_contacts cc join public.clients c on c.id = cc.client_id
    where cc.is_enquirer and cc.relationship_code is null
      and coalesce(lower(cc.relationship), 'self') not in ('self', '')
  loop
    raise notice 'Check the relationship on %: % is recorded as "%", which may describe the service user, not them.',
      r.enquiry_number, r.full_name, r.relationship;
  end loop;
end $$;

-- Rebuild the household relationships the sync makes (service user and
-- primary contact), the right way round.
delete from public.care_person_relationships pr
using public.care_request_recipients rr, public.client_contacts cc
where cc.client_id = rr.client_id and cc.person_id is not null and rr.person_id is not null
  and ((pr.from_person_id = rr.person_id and pr.to_person_id = cc.person_id)
    or (pr.from_person_id = cc.person_id and pr.to_person_id = rr.person_id));

do $$
declare r record;
begin
  for r in select id from public.care_request_recipients loop
    perform private.care_group_sync_recipient(r.id);
  end loop;
end $$;

-- ---------------------------------------------------------------- step 4
-- Every request names its enquirer: the enquirer contact on its care records.
update public.care_requests q
set enquirer_person_id = x.person_id
from (
  select distinct on (rr.request_id) rr.request_id, cc.person_id
  from public.care_request_recipients rr
  join public.client_contacts cc on cc.client_id = rr.client_id
  where cc.is_enquirer and cc.person_id is not null
  order by rr.request_id, cc.created_at
) x
where q.id = x.request_id and q.enquirer_person_id is null;

alter table public.client_contacts add column if not exists is_next_of_kin boolean not null default false;
alter table public.client_contacts add column if not exists is_emergency_contact boolean not null default false;

-- ---------------------------------------------------------------- step 5
-- Authority to act is recorded only as an access basis. The old contact
-- columns were never used (checked: no values, no readers).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'client_contacts' and column_name = 'may_act_for_client') then
    if exists (select 1 from public.client_contacts
               where may_act_for_client or authority_basis is not null or authority_evidence_sighted) then
      raise exception 'Contact authority fields hold values; move them to access bases before dropping.';
    end if;
    alter table public.client_contacts drop column may_act_for_client;
    alter table public.client_contacts drop column authority_basis;
    alter table public.client_contacts drop column authority_evidence_sighted;
  end if;
end $$;
