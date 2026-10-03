-- Pool-level placement readiness. The per-person rules already live in
-- public.mu_readiness_items; this only aggregates them so the Talent Pool can
-- show "needs completion" without asking the database once per person.
CREATE OR REPLACE FUNCTION public.mu_readiness_summary()
RETURNS TABLE(person_id uuid, candidate_items integer, office_items integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT p.id,
         count(*) FILTER (WHERE r.owner = 'candidate')::int,
         count(*) FILTER (WHERE r.owner = 'office')::int
    FROM public.mu_people p
    LEFT JOIN LATERAL public.mu_readiness_items(p.id) r ON true
   GROUP BY p.id
$$;

GRANT EXECUTE ON FUNCTION public.mu_readiness_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_readiness_summary() TO service_role;