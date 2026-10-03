CREATE OR REPLACE FUNCTION public.mu_match_opportunities_for_person(
  _person_id uuid,
  _limit integer DEFAULT 50,
  _include_blocked boolean DEFAULT false
)
RETURNS TABLE(
  opportunity_id uuid,
  title text,
  location text,
  score numeric,
  breakdown jsonb,
  blockers text[],
  matched_required text[],
  matched_desirable text[],
  missing_required text[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p public.mu_people%ROWTYPE;
  w jsonb;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT * INTO p FROM public.mu_people WHERE id = _person_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Person not found'; END IF;

  SELECT coalesce(jsonb_object_agg(key, weight), '{}'::jsonb) INTO w FROM public.mu_match_weights;

  RETURN QUERY
  WITH person_row AS (
    SELECT * FROM public.mu_people WHERE id = _person_id
  ),
  person_facets AS (
    SELECT facet_type, code, source
      FROM public.mu_profile_facets
     WHERE person_id = _person_id
  ),
  opp_base AS (
    SELECT o.*,
      (SELECT count(*) FROM public.mu_documents d WHERE d.person_id = _person_id AND NOT d.rejected) AS person_doc_count,
      (SELECT count(*) FROM public.mu_documents d WHERE d.person_id = _person_id AND d.verified)     AS person_verified_doc_count
    FROM public.matchmaker_opportunities o
    WHERE o.status IN ('open', 'draft')
  ),
  req AS (
    SELECT f.opportunity_id AS opp_id, f.facet_type, f.code, f.requirement
      FROM public.matchmaker_opportunity_facets f
     WHERE EXISTS (SELECT 1 FROM opp_base ob WHERE ob.id = f.opportunity_id)
  ),
  req_counts AS (
    SELECT opp_id,
      count(*) FILTER (WHERE requirement = 'required')  AS n_required,
      count(*) FILTER (WHERE requirement = 'desirable') AS n_desirable
    FROM req
    GROUP BY opp_id
  ),
  scored AS (
    SELECT
      ob.id,
      ob.title,
      ob.location,
      ob.updated_at,
      ob.match_professions,
      ob.match_min_years,
      ob.match_states,
      ob.match_lgas,
      ob.match_requires_licence,
      ob.match_requires_right_to_work,
      ob.person_doc_count,
      ob.person_verified_doc_count,
      rc.n_required,
      rc.n_desirable,
      coalesce(array_agg(DISTINCT f.code) FILTER (WHERE f.code IS NOT NULL AND r.requirement = 'required'), '{}') AS hit_required,
      coalesce(array_agg(DISTINCT f.code) FILTER (WHERE f.code IS NOT NULL AND r.requirement = 'desirable'), '{}') AS hit_desirable,
      coalesce(array_agg(DISTINCT r.code) FILTER (WHERE f.code IS NULL AND r.requirement = 'required'), '{}') AS miss_required,
      count(DISTINCT f.code) FILTER (WHERE f.source = 'verified') AS verified_facets,
      ARRAY(
        SELECT x FROM unnest(ARRAY[
          CASE WHEN cardinality(ob.match_professions) > 0
                AND (pr.profession IS NULL OR NOT (pr.profession = ANY (ob.match_professions)))
               THEN 'Profession does not match' END,
          CASE WHEN ob.match_min_years IS NOT NULL
                AND coalesce(pr.years_experience, -1) < ob.match_min_years
               THEN 'Below minimum years of experience' END,
          CASE WHEN cardinality(ob.match_states) > 0
                AND (pr.state IS NULL OR NOT (pr.state = ANY (ob.match_states)))
               THEN 'Outside the required state' END,
          CASE WHEN ob.match_requires_licence
                AND coalesce(btrim(coalesce(pr.license_number, '')), '') = ''
               THEN 'No licence number on record' END,
          CASE WHEN ob.match_requires_licence
                AND pr.license_expiry IS NOT NULL AND pr.license_expiry < current_date
               THEN 'Licence expired' END,
          CASE WHEN ob.match_requires_right_to_work AND coalesce(pr.right_to_work, false) = false
               THEN 'Right to work not confirmed' END
        ]) x WHERE x IS NOT NULL
      ) AS blocked
    FROM opp_base ob
    LEFT JOIN req_counts rc ON rc.opp_id = ob.id
    LEFT JOIN req r ON r.opp_id = ob.id
    LEFT JOIN person_facets f ON f.facet_type = r.facet_type AND f.code = r.code
    CROSS JOIN person_row pr
    GROUP BY ob.id, ob.title, ob.location, ob.updated_at, ob.match_professions, ob.match_min_years, ob.match_states,
             ob.match_lgas, ob.match_requires_licence, ob.match_requires_right_to_work,
             ob.person_doc_count, ob.person_verified_doc_count, rc.n_required, rc.n_desirable,
             pr.profession, pr.years_experience, pr.state, pr.license_number, pr.license_expiry, pr.right_to_work
  ),
  final AS (
    SELECT s.*,
      round(
        (CASE WHEN s.n_required > 0
              THEN (cardinality(s.hit_required)::numeric / s.n_required) * coalesce((w->>'required_facets')::numeric, 40)
              ELSE coalesce((w->>'required_facets')::numeric, 40) * 0.5 END)
      + (CASE WHEN s.n_desirable > 0
              THEN (cardinality(s.hit_desirable)::numeric / s.n_desirable) * coalesce((w->>'desirable_facets')::numeric, 20)
              ELSE 0 END)
      + (least(coalesce(pr.years_experience, 0) - coalesce(s.match_min_years, 0), 5)::numeric / 5)
        * coalesce((w->>'experience_fit')::numeric, 15) * (CASE WHEN coalesce(pr.years_experience, 0) > coalesce(s.match_min_years, 0) THEN 1 ELSE 0 END)
      + (CASE
           WHEN cardinality(s.match_lgas) > 0 AND pr.lga = ANY (s.match_lgas) THEN coalesce((w->>'location_fit')::numeric, 10)
           WHEN cardinality(s.match_states) > 0 AND pr.state = ANY (s.match_states) THEN coalesce((w->>'location_fit')::numeric, 10) * 0.6
           WHEN cardinality(s.match_states) = 0 AND cardinality(s.match_lgas) = 0 THEN coalesce((w->>'location_fit')::numeric, 10) * 0.5
           ELSE 0 END)
      + (least(s.person_doc_count, 3)::numeric / 3) * coalesce((w->>'document_completeness')::numeric, 10)
      + (CASE WHEN pr.last_activity_at > now() - interval '90 days' THEN coalesce((w->>'recency')::numeric, 5) ELSE 0 END)
      + (CASE WHEN s.verified_facets > 0 THEN coalesce((w->>'verified_bonus')::numeric, 10) ELSE 0 END)
      , 2) AS total,
      jsonb_build_object(
        'required_matched', cardinality(s.hit_required),
        'required_total', s.n_required,
        'desirable_matched', cardinality(s.hit_desirable),
        'desirable_total', s.n_desirable,
        'years_experience', pr.years_experience,
        'min_years', s.match_min_years,
        'person_state', pr.state,
        'person_lga', pr.lga,
        'documents', s.person_doc_count,
        'verified_documents', s.person_verified_doc_count,
        'verified_facets', s.verified_facets,
        'recent', pr.last_activity_at > now() - interval '90 days'
      ) AS bd
    FROM scored s CROSS JOIN person_row pr
  )
  SELECT f.id, f.title, f.location, f.total, f.bd, f.blocked, f.hit_required, f.hit_desirable, f.miss_required
    FROM final f
   WHERE _include_blocked OR cardinality(f.blocked) = 0
   ORDER BY cardinality(f.blocked) ASC, f.total DESC, f.updated_at DESC NULLS LAST
   LIMIT least(coalesce(_limit, 50), 200);
END;
$function$;
