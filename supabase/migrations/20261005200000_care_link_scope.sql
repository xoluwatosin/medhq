-- Care and family, step 9 of docs/care-platform/care-family-model.md.
-- Runs after 20261005190000_care_person_matching.sql. Safe to run twice.
--
-- A link opens one thing. A form link belongs to one care record and one
-- request; everything else it carries must agree with that, so a link can
-- never reach another record's contact, request, document or session:
--   - the contact must be on the link's care record, and the person is
--     always the contact's person (derived, never typed);
--   - the request recipient must be the link's care record, and its request
--     is the link's request (derived);
--   - a request must cover the link's care record;
--   - a document must be the link's care record's;
--   - a session must be the link's request's (its request is derived).
-- Every live link was checked on 5 October 2026 and already agrees.
--
-- Deriving the person also fixes a gap: links issued from admin never
-- recorded the person, so whoever filled one in was never given the portal
-- access the form save intends for an arranging contact. Only links from
-- the public request form did.
--
-- Removing the derived columns altogether needs the six link edge functions
-- rewritten to read through the link's care record and session; that waits
-- until after cutover, when they can be tested against the live project.

create or replace function private.care_token_scope()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare _client uuid; _request uuid; _person uuid;
begin
  if new.contact_id is not null then
    select client_id, person_id into _client, _person from public.client_contacts where id = new.contact_id;
    if _client is distinct from new.client_id then
      raise exception 'This link is for one care record; its contact belongs to another.';
    end if;
    new.person_id := _person;
  end if;

  if new.request_recipient_id is not null then
    select client_id, request_id into _client, _request
      from public.care_request_recipients where id = new.request_recipient_id;
    if _client is distinct from new.client_id then
      raise exception 'This link is for one care record; its request recipient is another.';
    end if;
    if new.request_id is not null and new.request_id <> _request then
      raise exception 'This link names two different care requests.';
    end if;
    new.request_id := _request;
  end if;

  if new.session_id is not null then
    select request_id into _request from public.care_questionnaire_sessions where id = new.session_id;
    if new.request_id is not null and new.request_id is distinct from _request then
      raise exception 'This link''s form session belongs to another care request.';
    end if;
    new.request_id := _request;
  end if;

  if new.request_id is not null and not exists (
    select 1 from public.care_request_recipients
     where request_id = new.request_id and client_id = new.client_id) then
    raise exception 'This link''s care request does not cover its care record.';
  end if;

  if new.document_id is not null and not exists (
    select 1 from public.care_documents where id = new.document_id and client_id = new.client_id) then
    raise exception 'This link''s document belongs to another care record.';
  end if;

  return new;
end;
$$;

drop trigger if exists care_token_scope on public.care_access_tokens;
create trigger care_token_scope
before insert or update of client_id, contact_id, person_id, request_id, request_recipient_id, session_id, document_id
on public.care_access_tokens
for each row execute function private.care_token_scope();

-- A contact's person changing (a merge, a correction) carries its links along.
create or replace function private.care_contact_person_to_links()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
begin
  update public.care_access_tokens set person_id = new.person_id
   where contact_id = new.id and person_id is distinct from new.person_id;
  return new;
end;
$$;
drop trigger if exists care_contact_person_to_links on public.client_contacts;
create trigger care_contact_person_to_links after update of person_id on public.client_contacts
for each row execute function private.care_contact_person_to_links();

-- Existing links take their contact's person.
update public.care_access_tokens t
   set person_id = cc.person_id
  from public.client_contacts cc
 where cc.id = t.contact_id and t.person_id is distinct from cc.person_id;

-- What a link opens, in words staff can check before sending it.
create or replace function public.care_link_scope(_token_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'private'
as $$
declare t public.care_access_tokens%rowtype; _out jsonb;
begin
  perform private.care_group_admin_guard();
  select * into t from public.care_access_tokens where id = _token_id;
  if not found then raise exception 'Link not found'; end if;

  select jsonb_build_object(
    'kind', case when t.purpose = 'document_view' then 'document'
                 when t.scope = 'top_up' then 'top_up' else 'form' end,
    'sent_to', (select jsonb_build_object(
                  'full_name', cc.full_name,
                  'relationship', case when cc.relationship_code = 'other' then coalesce(cc.relationship_other, 'Other')
                                       else coalesce(rt.label, cc.relationship) end)
                  from public.client_contacts cc
                  left join public.care_relationship_terms rt on rt.code = cc.relationship_code
                 where cc.id = t.contact_id),
    'covers', coalesce((
      select jsonb_agg(c.full_name order by rr.display_order)
        from public.care_request_recipients rr join public.clients c on c.id = rr.client_id
       where case
               when t.request_recipient_id is not null then rr.id = t.request_recipient_id
               when t.request_id is not null then rr.request_id = t.request_id
               else false
             end), (select jsonb_build_array(full_name) from public.clients where id = t.client_id)),
    'gives_portal_access', t.person_id is not null and not t.suppress_auto_grant
                           and t.filler_type in ('client', 'parent', 'family_member')
  ) into _out;
  return _out;
end;
$$;

revoke all on function public.care_link_scope(uuid) from public, anon;
grant execute on function public.care_link_scope(uuid) to authenticated;
