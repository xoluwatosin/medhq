CREATE OR REPLACE FUNCTION public.mu_match_candidates(_opportunity_id uuid, _limit integer DEFAULT 50, _include_blocked boolean DEFAULT false)
 RETURNS TABLE(person_id uuid, full_name text, profession text, years_experience integer, state text, lga text, score numeric, breakdown jsonb, blockers text[], matched_required text[], matched_desirable text[], missing_required text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o public.matchmaker_opportunities%ROWTYPE;
  w jsonb;
  n_clinical int; n_pref int;
  lic_floor int; rtw_floor int;
  avail_floor text;
  win_from date; win_to date;
  missing text[] := '{}';
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT * INTO o FROM public.matchmaker_opportunities WHERE id = _opportunity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found'; END IF;

  SELECT count(*) FILTER (WHERE facet_type IN ('skill','specialty','setting')),
         count(*) FILTER (WHERE facet_type IN ('seniority','availability','language'))
    INTO n_clinical, n_pref
    FROM public.matchmaker_opportunity_facets WHERE opportunity_id = _opportunity_id;

  lic_floor := public.mu_evidence_rank(o.min_licence_evidence);
  rtw_floor := public.mu_evidence_rank(o.min_right_to_work_evidence);
  avail_floor := coalesce(o.min_availability_evidence, 'none');
  win_from := coalesce(o.availability_from, current_date);
  win_to   := coalesce(o.availability_to, current_date + 27);

  IF cardinality(o.match_professions) = 0 THEN missing := missing || 'match_professions'::text; END IF;
  IF cardinality(o.match_states) = 0 AND cardinality(o.match_lgas) = 0 THEN missing := missing || 'match_states/match_lgas'::text; END IF;
  IF o.match_min_years IS NULL THEN missing := missing || 'match_min_years'::text; END IF;
  IF n_clinical = 0 THEN missing := missing || 'clinical requirement facets'::text; END IF;

  IF cardinality(o.match_professions) = 0
     AND cardinality(o.match_states) = 0 AND cardinality(o.match_lgas) = 0
     AND o.match_min_years IS NULL
     AND o.min_licence_evidence = 'none' AND o.min_right_to_work_evidence = 'none'
     AND avail_floor = 'none'
     AND n_clinical + n_pref = 0 THEN
    RAISE EXCEPTION 'UNRANKABLE: opportunity % has no match criteria. Missing: %. Set criteria (or run requirement parsing) before ranking.',
      _opportunity_id, array_to_string(missing, ', ');
  END IF;

  SELECT coalesce(jsonb_object_agg(key, weight), '{}'::jsonb) INTO w FROM public.mu_match_weights;

  RETURN QUERY
  WITH req AS (
    SELECT facet_type, code, requirement,
           (facet_type IN ('skill','specialty','setting')) AS is_clinical
      FROM public.matchmaker_opportunity_facets WHERE opportunity_id = _opportunity_id
  ),
  req_counts AS (
    SELECT count(*) FILTER (WHERE is_clinical AND requirement = 'required')      AS n_required,
           count(*) FILTER (WHERE is_clinical AND requirement = 'desirable')     AS n_desirable,
           count(*) FILTER (WHERE NOT is_clinical)                               AS n_preference
      FROM req
  ),
  cred AS (
    SELECT c.person_id, c.credential_type,
           public.mu_credential_state(c.claim, c.evidence_document_id, c.verification_outcome, c.expires_at) AS state
      FROM public.mu_credentials c
  ),
  base AS (
    SELECT p.*,
      (SELECT count(*) FROM public.mu_documents d WHERE d.person_id = p.id AND NOT d.rejected) AS doc_count,
      (SELECT count(*) FROM public.mu_documents d WHERE d.person_id = p.id AND d.verified)     AS verified_doc_count,
      coalesce((SELECT cred.state FROM cred WHERE cred.person_id = p.id AND credential_type = 'licence'), 'unknown')       AS lic_state,
      coalesce((SELECT cred.state FROM cred WHERE cred.person_id = p.id AND credential_type = 'right_to_work'), 'unknown') AS rtw_state,
      public.mu_availability_state(p.id, win_from, win_to) AS avail_state,
      (p.last_availability_update IS NOT NULL AND p.last_availability_update > now() - interval '14 days') AS avail_fresh
    FROM public.mu_people p
  ),
  scored AS (
    SELECT
      b.id, b.full_name, b.profession, b.years_experience, b.state, b.lga,
      b.doc_count, b.verified_doc_count, b.last_activity_at,
      b.lic_state, b.rtw_state, b.licensing_body,
      b.avail_state, b.avail_fresh, b.last_availability_update,
      public.mu_evidence_rank(b.lic_state) AS lic_rank,
      public.mu_evidence_rank(b.rtw_state) AS rtw_rank,
      coalesce(b.profession_source, 'self_declared') AS profession_source,
      CASE WHEN b.promotion_provenance ? 'state' THEN 'parsed' ELSE 'self_declared' END AS state_source,
      CASE WHEN b.promotion_provenance ? 'lga' THEN 'parsed' ELSE 'self_declared' END AS lga_source,
      b.verification_state,
      public.mu_profile_completeness(b.id)  AS completeness,
      public.mu_deployment_readiness(b.id)  AS readiness,
      rc.n_required, rc.n_desirable, rc.n_preference,
      coalesce(array_agg(DISTINCT f.code) FILTER (WHERE r.is_clinical AND r.requirement = 'required'  AND f.code IS NOT NULL), '{}') AS hit_required,
      coalesce(array_agg(DISTINCT f.code) FILTER (WHERE r.is_clinical AND r.requirement = 'desirable' AND f.code IS NOT NULL), '{}') AS hit_desirable,
      coalesce(array_agg(DISTINCT r.code) FILTER (WHERE r.is_clinical AND r.requirement = 'required'  AND f.code IS NULL), '{}')     AS miss_required,
      coalesce(array_agg(DISTINCT f.code) FILTER (WHERE NOT r.is_clinical AND f.code IS NOT NULL), '{}') AS hit_preference,
      coalesce(array_agg(DISTINCT r.code) FILTER (WHERE NOT r.is_clinical AND f.code IS NULL), '{}')     AS miss_preference,
      count(DISTINCT f.code) FILTER (WHERE f.source = 'verified') AS verified_facets,
      count(DISTINCT f.code) FILTER (WHERE f.source = 'parsed')   AS parsed_facets,
      count(DISTINCT f.code) FILTER (WHERE f.source = 'claimed')  AS claimed_facets,
      ARRAY(
        SELECT x FROM unnest(ARRAY[
          CASE WHEN cardinality(o.match_professions) > 0
                AND (b.profession IS NULL OR NOT (b.profession = ANY (o.match_professions)))
               THEN 'Profession does not match' END,
          CASE WHEN o.match_min_years IS NOT NULL AND coalesce(b.years_experience, -1) < o.match_min_years
               THEN 'Below minimum years of experience' END,
          CASE WHEN cardinality(o.match_states) > 0
                AND (b.state IS NULL OR NOT (b.state = ANY (o.match_states)))
               THEN 'Outside the required state' END,
          CASE WHEN lic_floor > 0 AND public.mu_evidence_rank(b.lic_state) < 0
               THEN 'Licence ' || b.lic_state END,
          CASE WHEN lic_floor > 0 AND b.lic_state <> 'unknown'
                AND public.mu_evidence_rank(b.lic_state) >= 0
                AND public.mu_evidence_rank(b.lic_state) < lic_floor
               THEN 'Licence evidence is ' || b.lic_state || ', below the required ' || o.min_licence_evidence END,
          CASE WHEN rtw_floor > 0 AND public.mu_evidence_rank(b.rtw_state) < 0
               THEN 'Right to work ' || b.rtw_state END,
          CASE WHEN rtw_floor > 0 AND b.rtw_state <> 'unknown'
                AND public.mu_evidence_rank(b.rtw_state) >= 0
                AND public.mu_evidence_rank(b.rtw_state) < rtw_floor
               THEN 'Right to work evidence is ' || b.rtw_state || ', below the required ' || o.min_right_to_work_evidence END,
          -- Availability can only ever block on a positive statement of being
          -- booked. 'unknown' is silence, and silence never excludes.
          CASE WHEN avail_floor = 'available' AND b.avail_state = 'unavailable'
               THEN 'Calendar says unavailable between ' || win_from || ' and ' || win_to END
        ]) x WHERE x IS NOT NULL
      ) AS blocked
    FROM base b
    CROSS JOIN req_counts rc
    LEFT JOIN req r ON true
    LEFT JOIN public.mu_profile_facets f
           ON f.person_id = b.id AND f.facet_type = r.facet_type AND f.code = r.code
    GROUP BY b.id, b.full_name, b.profession, b.years_experience, b.state, b.lga,
             b.doc_count, b.verified_doc_count, b.last_activity_at,
             b.lic_state, b.rtw_state, b.licensing_body,
             b.avail_state, b.avail_fresh, b.last_availability_update,
             b.profession_source, b.promotion_provenance, b.verification_state,
             rc.n_required, rc.n_desirable, rc.n_preference
  ),
  final AS (
    SELECT s.*,
      greatest(0, round(
        (CASE WHEN s.n_required > 0
              THEN (cardinality(s.hit_required)::numeric / s.n_required) * coalesce((w->>'required_facets')::numeric, 40)
              ELSE coalesce((w->>'required_facets')::numeric, 40) * 0.5 END)
      + (CASE WHEN s.n_desirable > 0
              THEN (cardinality(s.hit_desirable)::numeric / s.n_desirable) * coalesce((w->>'desirable_facets')::numeric, 20)
              ELSE 0 END)
      + (CASE WHEN s.n_preference > 0
              THEN (cardinality(s.hit_preference)::numeric / s.n_preference) * 8 ELSE 0 END)
      + (least(coalesce(s.years_experience, 0) - coalesce(o.match_min_years, 0), 5)::numeric / 5)
        * coalesce((w->>'experience_fit')::numeric, 15)
        * (CASE WHEN coalesce(s.years_experience, 0) > coalesce(o.match_min_years, 0) THEN 1 ELSE 0 END)
      + (CASE
           WHEN cardinality(o.match_lgas) > 0 AND s.lga = ANY (o.match_lgas) THEN coalesce((w->>'location_fit')::numeric, 10)
           WHEN cardinality(o.match_states) > 0 AND s.state = ANY (o.match_states) THEN coalesce((w->>'location_fit')::numeric, 10) * 0.6
           WHEN cardinality(o.match_states) = 0 AND cardinality(o.match_lgas) = 0 THEN coalesce((w->>'location_fit')::numeric, 10) * 0.5
           ELSE 0 END)
      + (least(s.doc_count, 3)::numeric / 3) * coalesce((w->>'document_completeness')::numeric, 10)
      + (CASE WHEN s.last_activity_at > now() - interval '90 days' THEN coalesce((w->>'recency')::numeric, 5) ELSE 0 END)
      + (CASE WHEN s.verified_facets > 0 THEN coalesce((w->>'verified_bonus')::numeric, 10) ELSE 0 END)
      + (CASE WHEN lic_floor > 0 THEN 10 * (CASE s.lic_state WHEN 'verified' THEN 1.0 WHEN 'documented' THEN 0.7 WHEN 'self_declared' THEN 0.4 ELSE 0 END) ELSE 0 END)
      + (CASE WHEN rtw_floor > 0 THEN 5 * (CASE s.rtw_state WHEN 'verified' THEN 1.0 WHEN 'documented' THEN 0.7 WHEN 'self_declared' THEN 0.4 ELSE 0 END) ELSE 0 END)
      -- Availability scores like a credential tier: stated free scores full,
      -- silence scores a fraction, stated booked scores nothing. A calendar
      -- older than 14 days is discounted rather than trusted.
      + (CASE WHEN avail_floor <> 'none'
              THEN coalesce((w->>'availability_fit')::numeric, 10)
                   * (CASE s.avail_state WHEN 'available' THEN 1.0 WHEN 'unknown' THEN 0.25 ELSE 0 END)
                   * (CASE WHEN s.avail_state = 'available' AND NOT s.avail_fresh THEN 0.6 ELSE 1 END)
              ELSE 0 END)
      , 2)) AS total,
      jsonb_build_object(
        'required_matched', cardinality(s.hit_required),
        'required_total', s.n_required,
        'desirable_matched', cardinality(s.hit_desirable),
        'desirable_total', s.n_desirable,
        'preference_matched', cardinality(s.hit_preference),
        'preference_total', s.n_preference,
        'preference_missing', s.miss_preference,
        'years_experience', s.years_experience,
        'min_years', o.match_min_years,
        'state', s.state, 'lga', s.lga,
        'documents', s.doc_count,
        'verified_documents', s.verified_doc_count,
        'verified_facets', s.verified_facets,
        'parsed_facets', s.parsed_facets,
        'claimed_facets', s.claimed_facets,
        'profession_source', s.profession_source,
        'state_source', s.state_source,
        'lga_source', s.lga_source,
        'credentials', jsonb_build_object(
          'licence', jsonb_build_object('state', s.lic_state, 'required_floor', o.min_licence_evidence),
          'right_to_work', jsonb_build_object('state', s.rtw_state, 'required_floor', o.min_right_to_work_evidence)
        ),
        'availability', jsonb_build_object(
          'state', s.avail_state,
          'required_floor', avail_floor,
          'window_from', win_from,
          'window_to', win_to,
          'last_update', s.last_availability_update,
          'updated_within_14_days', s.avail_fresh
        ),
        'profile_completeness', s.completeness,
        'deployment_readiness', s.readiness,
        'verification_state', s.verification_state,
        'criteria_used', jsonb_build_object(
          'professions', o.match_professions,
          'states', o.match_states,
          'lgas', o.match_lgas,
          'min_years', o.match_min_years,
          'min_licence_evidence', o.min_licence_evidence,
          'min_right_to_work_evidence', o.min_right_to_work_evidence,
          'min_availability_evidence', avail_floor,
          'availability_window', jsonb_build_object('from', win_from, 'to', win_to),
          'clinical_facets', s.n_required + s.n_desirable,
          'preference_facets', s.n_preference
        ),
        'recent', s.last_activity_at > now() - interval '90 days'
      ) AS bd
    FROM scored s
  )
  SELECT f.id, f.full_name, f.profession, f.years_experience, f.state, f.lga,
         f.total, f.bd, f.blocked, f.hit_required, f.hit_desirable, f.miss_required
    FROM final f
   WHERE _include_blocked OR cardinality(f.blocked) = 0
   ORDER BY cardinality(f.blocked) ASC, f.total DESC, f.last_activity_at DESC
   LIMIT least(coalesce(_limit, 50), 500);
END;
$function$;

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
  pool_with_calendar int;
  pool_fresh int;
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
  SELECT count(*) FILTER (WHERE last_availability_update IS NOT NULL),
         count(*) FILTER (WHERE last_availability_update > now() - interval '14 days')
    INTO pool_with_calendar, pool_fresh
    FROM public.mu_people;

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
  ),
  avail AS (
    SELECT
      count(*) FILTER (WHERE cardinality(blockers) = 0) AS shortlisted,
      count(*) FILTER (WHERE cardinality(blockers) = 0
                         AND breakdown->'availability'->>'state' = 'available') AS shortlist_available,
      count(*) FILTER (WHERE cardinality(blockers) = 0
                         AND breakdown->'availability'->>'state' = 'unknown') AS shortlist_unknown,
      count(*) FILTER (WHERE cardinality(blockers) = 0
                         AND (breakdown->'availability'->>'updated_within_14_days')::boolean) AS shortlist_fresh
      FROM allc
  )
  SELECT jsonb_build_object(
    'opportunity', jsonb_build_object('id', o.id, 'title', o.title, 'location', o.location, 'status', o.status),
    'pool_size', pool,
    'considered', (SELECT count(*) FROM allc),
    'passed', (SELECT count(*) FROM allc WHERE cardinality(blockers) = 0),
    'required_facets', n_required,
    'best_required_coverage', (SELECT coalesce(max(cardinality(matched_required)), 0) FROM allc),
    'exclusion_reasons', (SELECT j FROM reasons),
    'availability', jsonb_build_object(
      'window_from', coalesce(o.availability_from, current_date),
      'window_to', coalesce(o.availability_to, current_date + 27),
      'min_availability_evidence', coalesce(o.min_availability_evidence, 'none'),
      'pool_with_any_calendar', pool_with_calendar,
      'pool_updated_last_14_days', pool_fresh,
      'shortlist_available', (SELECT shortlist_available FROM avail),
      'shortlist_unknown', (SELECT shortlist_unknown FROM avail),
      'shortlist_updated_last_14_days', (SELECT shortlist_fresh FROM avail)
    ),
    'candidates', (SELECT j FROM top)
  ) INTO result;

  RETURN result;
END;
$function$;