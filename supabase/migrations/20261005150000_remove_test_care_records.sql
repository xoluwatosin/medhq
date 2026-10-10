-- Remove the care records staff identified as tests on 5 October 2026.
-- Keyed on enquiry numbers, which survive the cutover restore, so this runs
-- the same before or after it. Safe to run twice.
--
-- Tests: MC-2609-0001, 0043, 0053, 0069, 0070, 0072, 0073, 0074, 0084, 0087.
-- Kept, and checked at the end: MC-2609-0018, 0019, 0071, 0082.
--
-- Removes each test care record with everything that hangs off it, the
-- households and requests that held only test records, and the people who
-- appear nowhere else. Website enquiries are kept; their link to the
-- deleted care record is cleared. Files in the care-uploads bucket are not
-- touched here.
do $$
declare
  test_numbers text[] := array['MC-2609-0001','MC-2609-0043','MC-2609-0053','MC-2609-0069','MC-2609-0070',
                               'MC-2609-0072','MC-2609-0073','MC-2609-0074','MC-2609-0084','MC-2609-0087'];
  keep_numbers text[] := array['MC-2609-0018','MC-2609-0019','MC-2609-0071','MC-2609-0082'];
  kept_before int;
  kept_after int;
  test_clients uuid[];
  test_groups uuid[];
  test_people uuid[];
begin
  select array_agg(id) into test_clients from public.clients where enquiry_number = any(test_numbers);
  if test_clients is null then
    raise notice 'No test care records found; nothing to do.';
    return;
  end if;
  select count(*) into kept_before from public.clients where enquiry_number = any(keep_numbers);

  -- Households that hold only test records (by request, or created for one).
  select array_agg(distinct g.id) into test_groups
  from public.care_groups g
  where (g.origin_client_id = any(test_clients)
         or exists (select 1 from public.care_requests q join public.care_request_recipients r on r.request_id = q.id
                    where q.group_id = g.id and r.client_id = any(test_clients)))
    and not exists (select 1 from public.care_requests q join public.care_request_recipients r on r.request_id = q.id
                    where q.group_id = g.id and r.client_id is not null and not (r.client_id = any(test_clients)));

  -- Everyone attached to those records or households.
  select array_agg(distinct pid) into test_people from (
    select person_id pid from public.client_contacts where client_id = any(test_clients)
    union select r.person_id from public.care_request_recipients r where r.client_id = any(test_clients)
    union select q.enquirer_person_id from public.care_requests q where q.group_id = any(coalesce(test_groups, '{}'))
    union select m.person_id from public.care_group_members m where m.group_id = any(coalesce(test_groups, '{}'))
  ) x where pid is not null;

  -- Rows that block a delete rather than following it.
  update public.care_proposals set supersedes_id = null where client_id = any(test_clients);
  delete from public.care_proposals where client_id = any(test_clients);
  delete from public.care_quotes where client_id = any(test_clients);
  delete from public.care_delivery_assignments where episode_id in (select id from public.care_episodes where client_id = any(test_clients));
  delete from public.care_portal_invitations where client_id = any(test_clients);
  delete from public.care_access_grants where client_id = any(test_clients);
  delete from public.care_access_bases where client_id = any(test_clients);
  delete from public.care_upload_files where client_id = any(test_clients);
  delete from public.care_questionnaire_session_recipients where client_id = any(test_clients);

  -- Keep the website enquiry, drop its link to the test record.
  update public.contact_submissions set care_client_id = null where care_client_id = any(test_clients);

  -- The care records; documents, contacts, work, activity and the rest follow.
  delete from public.clients where id = any(test_clients);

  -- Households, with their requests, members and relationships.
  delete from public.care_groups where id = any(coalesce(test_groups, '{}'));

  -- People who now appear nowhere.
  delete from public.care_people p
  where p.id = any(coalesce(test_people, '{}'))
    and not exists (select 1 from public.client_contacts c where c.person_id = p.id)
    and not exists (select 1 from public.care_request_recipients r where r.person_id = p.id)
    and not exists (select 1 from public.care_requests q where q.enquirer_person_id = p.id)
    and not exists (select 1 from public.care_group_members m where m.person_id = p.id)
    and not exists (select 1 from public.care_access_grants g where g.person_id = p.id)
    and not exists (select 1 from public.care_access_bases b where b.person_id = p.id)
    and not exists (select 1 from public.care_questionnaire_sessions s where s.respondent_person_id = p.id)
    and not exists (select 1 from public.care_proposal_responses s where s.person_id = p.id);

  select count(*) into kept_after from public.clients where enquiry_number = any(keep_numbers);
  if kept_after <> kept_before then
    raise exception 'A kept care record would be removed (% before, % after). Nothing was changed.', kept_before, kept_after;
  end if;
  raise notice 'Removed % test care records; % kept records untouched.', array_length(test_clients, 1), kept_after;
end $$;
