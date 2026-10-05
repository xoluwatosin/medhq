-- The Talent pool nudges staff when a person's documents are all in and only
-- wait for a decision. That needs one more number per person: how many
-- required documents are still missing, rejected or expired (the candidate's
-- document items). Office items are already only documents awaiting a
-- decision. Safe to run twice.

drop function if exists public.mu_readiness_summary();

create function public.mu_readiness_summary()
returns table(person_id uuid, candidate_items integer, office_items integer, documents_missing integer)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select p.id,
         count(*) filter (where r.owner = 'candidate')::int,
         count(*) filter (where r.owner = 'office')::int,
         count(*) filter (where r.owner = 'candidate' and r.code like 'document\_%')::int
    from public.mu_people p
    left join lateral public.mu_readiness_items(p.id) r on true
   group by p.id
$$;

revoke execute on function public.mu_readiness_summary() from public, anon;
grant execute on function public.mu_readiness_summary() to authenticated;
grant execute on function public.mu_readiness_summary() to service_role;
