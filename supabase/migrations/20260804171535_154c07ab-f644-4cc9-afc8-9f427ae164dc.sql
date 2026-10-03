-- 1. Three-state credentials + completeness -----------------------------------
ALTER TABLE public.mu_people
  ADD COLUMN IF NOT EXISTS licence_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS right_to_work_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS nysc_status text;

DO $$ BEGIN
  ALTER TABLE public.mu_people ADD CONSTRAINT mu_people_licence_status_chk
    CHECK (licence_status IN ('confirmed','absent','unknown'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.mu_people ADD CONSTRAINT mu_people_rtw_status_chk
    CHECK (right_to_work_status IN ('confirmed','absent','unknown'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed from what is already known: a licence number on record is a confirmation.
UPDATE public.mu_people
   SET licence_status = 'confirmed'
 WHERE licence_status = 'unknown'
   AND coalesce(btrim(coalesce(license_number,'')),'') <> '';

UPDATE public.mu_people
   SET right_to_work_status = CASE WHEN right_to_work THEN 'confirmed' ELSE 'absent' END
 WHERE right_to_work_status = 'unknown' AND right_to_work IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mu_profile_completeness(_person_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT round(100.0 * (
      (coalesce(btrim(coalesce(p.profession,'')),'') <> '')::int
    + (coalesce(btrim(coalesce(p.state,'')),'') <> '')::int
    + (coalesce(btrim(coalesce(p.lga,'')),'') <> '')::int
    + (p.years_experience IS NOT NULL)::int
    + (coalesce(btrim(coalesce(p.licensing_body,'')),'') <> '')::int
    + (p.licence_status <> 'unknown')::int
    + (p.right_to_work_status <> 'unknown')::int
    + (EXISTS (SELECT 1 FROM public.mu_documents d WHERE d.person_id = p.id AND NOT d.rejected))::int
  ) / 8.0, 0)
  FROM public.mu_people p WHERE p.id = _person_id
$$;

REVOKE EXECUTE ON FUNCTION public.mu_profile_completeness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_profile_completeness(uuid) TO authenticated, service_role;

-- 2. Matcher: fix the array-literal crash, three-state credentials, completeness
CREATE OR REPLACE FUNCTION public.mu_match_candidates(_opportunity_id uuid, _limit integer DEFAULT 50, _include_blocked boolean DEFAULT false)
 RETURNS TABLE(person_id uuid, full_name text, profession text, years_experience integer, state text, lga text, score numeric, breakdown jsonb, blockers text[], matched_required text[], matched_desirable text[], missing_required text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o public.matchmaker_opportunities%ROWTYPE;
  w jsonb;
  n_facets int;
  missing text[] := '{}';
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT * INTO o FROM public.matchmaker_opportunities WHERE id = _opportunity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found'; END IF;

  SELECT count(*) INTO n_facets FROM public.matchmaker_opportunity_facets WHERE opportunity_id = _opportunity_id;

  IF cardinality(o.match_professions) = 0 THEN missing := missing || 'match_professions'::text; END IF;
  IF cardinality(o.match_states) = 0 AND cardinality(o.match_lgas) = 0 THEN missing := missing || 'match_states/match_lgas'::text; END IF;
  IF o.match_min_years IS NULL THEN missing := missing || 'match_min_years'::text; END IF;
  IF n_facets = 0 THEN missing := missing || 'requirement facets'::text; END IF;

  IF cardinality(o.match_professions) = 0
     AND cardinality(o.match_states) = 0
     AND cardinality(o.match_lgas) = 0
     AND o.match_min_years IS NULL
     AND NOT o.match_requires_licence
     AND NOT o.match_requires_right_to_work
     AND n_facets = 0 THEN
    RAISE EXCEPTION 'UNRANKABLE: opportunity % has no match criteria. Missing: %. Set criteria (or run requirement parsing) before ranking.',
      _opportunity_id, array_to_string(missing, ', ');
  END IF;

  SELECT coalesce(jsonb_object_agg(key, weight), '{}'::jsonb) INTO w FROM public.mu_match_weights;

  RETURN QUERY
  WITH req AS (
    SELECT facet_type, code, requirement
      FROM public.matchmaker_opportunity_facets
     WHERE opportunity_id = _opportunity_id
  ),
  req_counts AS (
    SELECT
      count(*) FILTER (WHERE requirement = 'required')  AS n_required,
      count(*) FILTER (WHERE requirement = 'desirable') AS n_desirable
    FROM req
  ),
  base AS (
    SELECT p.*,
      (SELECT count(*) FROM public.mu_documents d WHERE d.person_id = p.id AND NOT d.rejected) AS doc_count,
      (SELECT count(*) FROM public.mu_documents d WHERE d.person_id = p.id AND d.verified)     AS verified_doc_count
    FROM public.mu_people p
  ),
  scored AS (
    SELECT
      b.id, b.full_name, b.profession, b.years_experience, b.state, b.lga,
      b.doc_count, b.verified_doc_count, b.last_activity_at,
      b.licence_status, b.right_to_work_status, b.licensing_body,
      coalesce(b.profession_source, 'self_declared') AS profession_source,
      CASE WHEN b.promotion_provenance ? 'state' THEN 'parsed' ELSE 'self_declared' END AS state_source,
      CASE WHEN b.promotion_provenance ? 'lga' THEN 'parsed' ELSE 'self_declared' END AS lga_source,
      b.verification_state,
      round(100.0 * (
          (coalesce(btrim(coalesce(b.profession,'')),'') <> '')::int
        + (coalesce(btrim(coalesce(b.state,'')),'') <> '')::int
        + (coalesce(btrim(coalesce(b.lga,'')),'') <> '')::int
        + (b.years_experience IS NOT NULL)::int
        + (coalesce(btrim(coalesce(b.licensing_body,'')),'') <> '')::int
        + (b.licence_status <> 'unknown')::int
        + (b.right_to_work_status <> 'unknown')::int
        + (b.doc_count > 0)::int
      ) / 8.0, 0) AS completeness,
      rc.n_required, rc.n_desirable,
      coalesce(array_agg(DISTINCT f.code) FILTER (WHERE r.requirement = 'required'  AND f.code IS NOT NULL), '{}') AS hit_required,
      coalesce(array_agg(DISTINCT f.code) FILTER (WHERE r.requirement = 'desirable' AND f.code IS NOT NULL), '{}') AS hit_desirable,
      coalesce(array_agg(DISTINCT r.code) FILTER (WHERE r.requirement = 'required'  AND f.code IS NULL), '{}')     AS miss_required,
      count(DISTINCT f.code) FILTER (WHERE f.source = 'verified') AS verified_facets,
      count(DISTINCT f.code) FILTER (WHERE f.source = 'parsed')   AS parsed_facets,
      count(DISTINCT f.code) FILTER (WHERE f.source = 'claimed')  AS claimed_facets,
      ARRAY(
        SELECT x FROM unnest(ARRAY[
          CASE WHEN cardinality(o.match_professions) > 0
                AND (b.profession IS NULL OR NOT (b.profession = ANY (o.match_professions)))
               THEN 'Profession does not match' END,
          CASE WHEN o.match_min_years IS NOT NULL
                AND coalesce(b.years_experience, -1) < o.match_min_years
               THEN 'Below minimum years of experience' END,
          CASE WHEN cardinality(o.match_states) > 0
                AND (b.state IS NULL OR NOT (b.state = ANY (o.match_states)))
               THEN 'Outside the required state' END,
          -- three-state: only an explicit "no" blocks. Unknown is scored down, not excluded.
          CASE WHEN o.match_requires_licence AND b.licence_status = 'absent'
               THEN 'Candidate stated they hold no licence' END,
          CASE WHEN o.match_requires_licence
                AND b.license_expiry IS NOT NULL AND b.license_expiry < current_date
               THEN 'Licence expired' END,
          CASE WHEN o.match_requires_right_to_work AND b.right_to_work_status = 'absent'
               THEN 'Right to work stated as absent' END
        ]) x WHERE x IS NOT NULL
      ) AS blocked
    FROM base b
    CROSS JOIN req_counts rc
    LEFT JOIN req r ON true
    LEFT JOIN public.mu_profile_facets f
           ON f.person_id = b.id AND f.facet_type = r.facet_type AND f.code = r.code
    GROUP BY b.id, b.full_name, b.profession, b.years_experience, b.state, b.lga,
             b.doc_count, b.verified_doc_count, b.last_activity_at, b.license_number,
             b.license_expiry, b.licence_status, b.right_to_work_status, b.licensing_body,
             b.profession_source, b.promotion_provenance,
             b.verification_state, rc.n_required, rc.n_desirable
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
      + (least(coalesce(s.years_experience, 0) - coalesce(o.match_min_years, 0), 5)::numeric / 5)
        * coalesce((w->>'experience_fit')::numeric, 15) * (CASE WHEN coalesce(s.years_experience, 0) > coalesce(o.match_min_years, 0) THEN 1 ELSE 0 END)
      + (CASE
           WHEN cardinality(o.match_lgas) > 0 AND s.lga = ANY (o.match_lgas) THEN coalesce((w->>'location_fit')::numeric, 10)
           WHEN cardinality(o.match_states) > 0 AND s.state = ANY (o.match_states) THEN coalesce((w->>'location_fit')::numeric, 10) * 0.6
           WHEN cardinality(o.match_states) = 0 AND cardinality(o.match_lgas) = 0 THEN coalesce((w->>'location_fit')::numeric, 10) * 0.5
           ELSE 0 END)
      + (least(s.doc_count, 3)::numeric / 3) * coalesce((w->>'document_completeness')::numeric, 10)
      + (CASE WHEN s.last_activity_at > now() - interval '90 days' THEN coalesce((w->>'recency')::numeric, 5) ELSE 0 END)
      + (CASE WHEN s.verified_facets > 0 THEN coalesce((w->>'verified_bonus')::numeric, 10) ELSE 0 END)
      -- unknown credentials are a penalty, never an exclusion
      - (CASE WHEN o.match_requires_licence AND s.licence_status = 'unknown' THEN 8 ELSE 0 END)
      - (CASE WHEN o.match_requires_right_to_work AND s.right_to_work_status = 'unknown' THEN 5 ELSE 0 END)
      , 2)) AS total,
      jsonb_build_object(
        'required_matched', cardinality(s.hit_required),
        'required_total', s.n_required,
        'desirable_matched', cardinality(s.hit_desirable),
        'desirable_total', s.n_desirable,
        'years_experience', s.years_experience,
        'min_years', o.match_min_years,
        'state', s.state,
        'lga', s.lga,
        'documents', s.doc_count,
        'verified_documents', s.verified_doc_count,
        'verified_facets', s.verified_facets,
        'parsed_facets', s.parsed_facets,
        'claimed_facets', s.claimed_facets,
        'profession_source', s.profession_source,
        'state_source', s.state_source,
        'lga_source', s.lga_source,
        'licence_status', s.licence_status,
        'right_to_work_status', s.right_to_work_status,
        'completeness', s.completeness,
        'verification_state', s.verification_state,
        'criteria_used', jsonb_build_object(
          'professions', o.match_professions,
          'states', o.match_states,
          'lgas', o.match_lgas,
          'min_years', o.match_min_years,
          'requires_licence', o.match_requires_licence,
          'requires_right_to_work', o.match_requires_right_to_work,
          'facets', s.n_required + s.n_desirable
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

-- 3. Report wrapper: an empty shortlist is always explained ---------------------
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
  best_cov int := 0;
  reasons jsonb := '{}'::jsonb;
  passed int := 0;
  rows jsonb;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT * INTO o FROM public.matchmaker_opportunities WHERE id = _opportunity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found'; END IF;

  SELECT count(*) INTO pool FROM public.mu_people;
  SELECT count(*) INTO n_required FROM public.matchmaker_opportunity_facets
   WHERE opportunity_id = _opportunity_id AND requirement = 'required';

  CREATE TEMP TABLE IF NOT EXISTS _mm_all ON COMMIT DROP AS SELECT * FROM public.mu_match_candidates(_opportunity_id, 500, true) WITH NO DATA;
  DELETE FROM _mm_all;
  INSERT INTO _mm_all SELECT * FROM public.mu_match_candidates(_opportunity_id, 500, true);

  SELECT count(*) INTO passed FROM _mm_all WHERE cardinality(blockers) = 0;
  SELECT coalesce(max(cardinality(matched_required)), 0) INTO best_cov FROM _mm_all;

  SELECT coalesce(jsonb_object_agg(reason, n), '{}'::jsonb) INTO reasons
    FROM (SELECT unnest(blockers) AS reason, count(*) AS n FROM _mm_all GROUP BY 1) t;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.score DESC), '[]'::jsonb) INTO rows
    FROM (SELECT * FROM _mm_all WHERE cardinality(blockers) = 0
          ORDER BY score DESC LIMIT least(coalesce(_limit, 20), 100)) x;

  RETURN jsonb_build_object(
    'opportunity', jsonb_build_object('id', o.id, 'title', o.title, 'location', o.location, 'status', o.status),
    'pool_size', pool,
    'passed', passed,
    'required_facets', n_required,
    'best_required_coverage', best_cov,
    'exclusion_reasons', reasons,
    'candidates', rows
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mu_match_report(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_match_report(uuid, integer) TO authenticated, service_role;

-- 4. Promote application answers (self declared beats parsed) -------------------
CREATE OR REPLACE FUNCTION public.mu_promote_application_answers(_person_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  lga_n int := 0; lic_n int := 0; rtw_n int := 0; nysc_n int := 0;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  FOR r IN
    WITH answers AS (
      SELECT a.person_id, a.created_at, kv.key, btrim(kv.value #>> '{}') AS val
        FROM public.matchmaker_applications a,
             LATERAL jsonb_each(coalesce(a.question_answers, '{}'::jsonb)) kv
       WHERE a.person_id IS NOT NULL
         AND (_person_id IS NULL OR a.person_id = _person_id)
    ),
    picked AS (
      SELECT person_id,
             CASE
               WHEN key ILIKE '%your lga%' OR key ILIKE '%specify your lga%' THEN 'lga'
               WHEN key ILIKE '%licen%practice%' OR key ILIKE '%license to practice%' THEN 'licence'
               WHEN key ILIKE '%right to work%' THEN 'rtw'
               WHEN key ILIKE '%nysc%' THEN 'nysc'
             END AS field,
             val, created_at
        FROM answers
       WHERE coalesce(val,'') <> ''
    ),
    best AS (
      SELECT DISTINCT ON (person_id, field) person_id, field, val
        FROM picked WHERE field IS NOT NULL
       ORDER BY person_id, field, created_at DESC
    )
    SELECT person_id,
           max(val) FILTER (WHERE field = 'lga')     AS lga,
           max(val) FILTER (WHERE field = 'licence') AS licence,
           max(val) FILTER (WHERE field = 'rtw')     AS rtw,
           max(val) FILTER (WHERE field = 'nysc')    AS nysc
      FROM best GROUP BY person_id
  LOOP
    -- LGA: fill blanks only
    IF coalesce(btrim(coalesce(r.lga,'')),'') <> '' THEN
      UPDATE public.mu_people p
         SET lga = regexp_replace(r.lga, '\s+LGA$', '', 'i'),
             promotion_provenance = p.promotion_provenance || jsonb_build_object(
               'lga', jsonb_build_object('source','self_declared','origin','application_answer','promoted_at', now()))
       WHERE p.id = r.person_id AND coalesce(btrim(coalesce(p.lga,'')),'') = '';
      IF FOUND THEN lga_n := lga_n + 1; END IF;
    END IF;

    IF r.licence IS NOT NULL THEN
      UPDATE public.mu_people p
         SET licence_status = CASE WHEN r.licence ILIKE 'yes%' THEN 'confirmed'
                                   WHEN r.licence ILIKE 'no%'  THEN 'absent'
                                   ELSE p.licence_status END,
             promotion_provenance = p.promotion_provenance || jsonb_build_object(
               'licence_status', jsonb_build_object('source','self_declared','origin','application_answer','promoted_at', now()))
       WHERE p.id = r.person_id AND p.licence_status = 'unknown' AND (r.licence ILIKE 'yes%' OR r.licence ILIKE 'no%');
      IF FOUND THEN lic_n := lic_n + 1; END IF;
    END IF;

    IF r.rtw IS NOT NULL THEN
      UPDATE public.mu_people p
         SET right_to_work_status = CASE WHEN r.rtw ILIKE 'yes%' THEN 'confirmed'
                                         WHEN r.rtw ILIKE 'no%'  THEN 'absent'
                                         ELSE p.right_to_work_status END,
             right_to_work = CASE WHEN r.rtw ILIKE 'yes%' THEN true
                                  WHEN r.rtw ILIKE 'no%' THEN false ELSE p.right_to_work END,
             promotion_provenance = p.promotion_provenance || jsonb_build_object(
               'right_to_work', jsonb_build_object('source','self_declared','origin','application_answer','promoted_at', now()))
       WHERE p.id = r.person_id AND p.right_to_work_status = 'unknown' AND (r.rtw ILIKE 'yes%' OR r.rtw ILIKE 'no%');
      IF FOUND THEN rtw_n := rtw_n + 1; END IF;
    END IF;

    IF r.nysc IS NOT NULL THEN
      UPDATE public.mu_people p
         SET nysc_status = r.nysc
       WHERE p.id = r.person_id AND p.nysc_status IS NULL;
      IF FOUND THEN nysc_n := nysc_n + 1; END IF;
    END IF;
  END LOOP;

  -- Join application form columns carry the same answers for network applicants.
  UPDATE public.mu_people p
     SET lga = j.lga_primary
    FROM public.join_applications j
   WHERE j.person_id = p.id
     AND coalesce(btrim(coalesce(p.lga,'')),'') = ''
     AND coalesce(btrim(coalesce(j.lga_primary,'')),'') <> ''
     AND (_person_id IS NULL OR p.id = _person_id);

  UPDATE public.mu_people p
     SET right_to_work_status = CASE WHEN j.right_to_work THEN 'confirmed' ELSE 'absent' END,
         right_to_work = j.right_to_work
    FROM public.join_applications j
   WHERE j.person_id = p.id
     AND p.right_to_work_status = 'unknown'
     AND j.right_to_work IS NOT NULL
     AND (_person_id IS NULL OR p.id = _person_id);

  UPDATE public.mu_people p
     SET licence_status = CASE WHEN j.license_to_practice ILIKE 'yes%' THEN 'confirmed'
                               WHEN j.license_to_practice ILIKE 'no%'  THEN 'absent'
                               ELSE p.licence_status END
    FROM public.join_applications j
   WHERE j.person_id = p.id
     AND p.licence_status = 'unknown'
     AND j.license_to_practice IS NOT NULL
     AND (_person_id IS NULL OR p.id = _person_id);

  UPDATE public.mu_people p
     SET nysc_status = j.nysc_status
    FROM public.join_applications j
   WHERE j.person_id = p.id AND p.nysc_status IS NULL AND j.nysc_status IS NOT NULL
     AND (_person_id IS NULL OR p.id = _person_id);

  RETURN jsonb_build_object('lga', lga_n, 'licence_status', lic_n, 'right_to_work', rtw_n, 'nysc', nysc_n);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mu_promote_application_answers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_promote_application_answers(uuid) TO authenticated, service_role;