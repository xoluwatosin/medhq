CREATE OR REPLACE FUNCTION public.mu_match_report(_opportunity_id uuid, _limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  o public.matchmaker_opportunities%ROWTYPE;
  pool int;
  n_required int;
  result jsonb;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT * INTO o FROM public.matchmaker_opportunities WHERE id = _opportunity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found'; END IF;

  SELECT count(*) INTO pool FROM public.mu_people;
  SELECT count(*) INTO n_required FROM public.matchmaker_opportunity_facets
   WHERE opportunity_id = _opportunity_id AND requirement = 'required';

  WITH allc AS (
    SELECT * FROM public.mu_match_candidates(_opportunity_id, 500, true)
  ),
  reasons AS (
    SELECT coalesce(jsonb_object_agg(reason, n), '{}'::jsonb) AS j
      FROM (SELECT unnest(blockers) AS reason, count(*) AS n FROM allc GROUP BY 1) t
  ),
  top AS (
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.score DESC), '[]'::jsonb) AS j
      FROM (SELECT * FROM allc WHERE cardinality(blockers) = 0
             ORDER BY score DESC LIMIT least(coalesce(_limit, 20), 100)) x
  )
  SELECT jsonb_build_object(
    'opportunity', jsonb_build_object('id', o.id, 'title', o.title, 'location', o.location, 'status', o.status),
    'pool_size', pool,
    'considered', (SELECT count(*) FROM allc),
    'passed', (SELECT count(*) FROM allc WHERE cardinality(blockers) = 0),
    'required_facets', n_required,
    'best_required_coverage', (SELECT coalesce(max(cardinality(matched_required)), 0) FROM allc),
    'exclusion_reasons', (SELECT j FROM reasons),
    'candidates', (SELECT j FROM top)
  ) INTO result;

  RETURN result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mu_match_report(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_match_report(uuid, integer) TO authenticated, service_role;