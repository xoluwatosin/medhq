
-- 1. Candidate facets
CREATE TABLE public.mu_profile_facets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  facet_type text NOT NULL,
  code text NOT NULL,
  source text NOT NULL DEFAULT 'parsed',
  confidence numeric NOT NULL DEFAULT 0.5,
  evidence text,
  document_id uuid REFERENCES public.mu_documents(id) ON DELETE SET NULL,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, facet_type, code)
);
CREATE INDEX mu_profile_facets_person_idx ON public.mu_profile_facets(person_id);
CREATE INDEX mu_profile_facets_code_idx ON public.mu_profile_facets(facet_type, code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_profile_facets TO authenticated;
GRANT ALL ON public.mu_profile_facets TO service_role;
ALTER TABLE public.mu_profile_facets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage profile facets" ON public.mu_profile_facets
  FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Candidates view own facets" ON public.mu_profile_facets
  FOR SELECT TO authenticated USING (person_id = public.mu_my_person_id());

-- 2. Opportunity requirement facets
CREATE TABLE public.matchmaker_opportunity_facets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid NOT NULL REFERENCES public.matchmaker_opportunities(id) ON DELETE CASCADE,
  facet_type text NOT NULL,
  code text NOT NULL,
  requirement text NOT NULL DEFAULT 'desirable',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, facet_type, code)
);
CREATE INDEX mmo_facets_opportunity_idx ON public.matchmaker_opportunity_facets(opportunity_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.matchmaker_opportunity_facets TO authenticated;
GRANT ALL ON public.matchmaker_opportunity_facets TO service_role;
ALTER TABLE public.matchmaker_opportunity_facets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage opportunity facets" ON public.matchmaker_opportunity_facets
  FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- 3. Opportunity-level hard constraints
ALTER TABLE public.matchmaker_opportunities
  ADD COLUMN IF NOT EXISTS match_professions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS match_min_years integer,
  ADD COLUMN IF NOT EXISTS match_states text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS match_lgas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS match_requires_licence boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS match_requires_right_to_work boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requirements_parsed_at timestamptz,
  ADD COLUMN IF NOT EXISTS requirements_model text;

-- 4. Tunable weights
CREATE TABLE public.mu_match_weights (
  key text NOT NULL PRIMARY KEY,
  weight numeric NOT NULL DEFAULT 1,
  label text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_match_weights TO authenticated;
GRANT ALL ON public.mu_match_weights TO service_role;
ALTER TABLE public.mu_match_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage match weights" ON public.mu_match_weights
  FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.mu_match_weights (key, weight, label) VALUES
  ('required_facets', 40, 'Required facets matched'),
  ('desirable_facets', 20, 'Desirable facets matched'),
  ('experience_fit', 15, 'Experience above the minimum'),
  ('location_fit', 10, 'Location proximity'),
  ('document_completeness', 10, 'Documents on file'),
  ('recency', 5, 'Recent activity'),
  ('verified_bonus', 10, 'Verified facets premium');

-- 5. Shortlists
CREATE TABLE public.mu_shortlists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid NOT NULL REFERENCES public.matchmaker_opportunities(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_name text,
  score numeric,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  status text NOT NULL DEFAULT 'shortlisted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, person_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_shortlists TO authenticated;
GRANT ALL ON public.mu_shortlists TO service_role;
ALTER TABLE public.mu_shortlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage shortlists" ON public.mu_shortlists
  FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- 6. Cached rationales
CREATE TABLE public.mu_match_rationales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid NOT NULL REFERENCES public.matchmaker_opportunities(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  model text,
  rationale text NOT NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, person_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_match_rationales TO authenticated;
GRANT ALL ON public.mu_match_rationales TO service_role;
ALTER TABLE public.mu_match_rationales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage match rationales" ON public.mu_match_rationales
  FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- 7. updated_at triggers
CREATE TRIGGER mu_profile_facets_updated BEFORE UPDATE ON public.mu_profile_facets
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();
CREATE TRIGGER mmo_facets_updated BEFORE UPDATE ON public.matchmaker_opportunity_facets
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();
CREATE TRIGGER mu_shortlists_updated BEFORE UPDATE ON public.mu_shortlists
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();
CREATE TRIGGER mu_match_rationales_updated BEFORE UPDATE ON public.mu_match_rationales
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- 8. Deterministic matching function
CREATE OR REPLACE FUNCTION public.mu_match_candidates(_opportunity_id uuid, _limit integer DEFAULT 50, _include_blocked boolean DEFAULT false)
RETURNS TABLE(
  person_id uuid,
  full_name text,
  profession text,
  years_experience integer,
  state text,
  lga text,
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
AS $$
DECLARE
  o public.matchmaker_opportunities%ROWTYPE;
  w jsonb;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT * INTO o FROM public.matchmaker_opportunities WHERE id = _opportunity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found'; END IF;

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
      b.id,
      b.full_name,
      b.profession,
      b.years_experience,
      b.state,
      b.lga,
      b.doc_count,
      b.verified_doc_count,
      b.last_activity_at,
      rc.n_required,
      rc.n_desirable,
      coalesce(array_agg(DISTINCT f.code) FILTER (WHERE r.requirement = 'required'  AND f.code IS NOT NULL), '{}') AS hit_required,
      coalesce(array_agg(DISTINCT f.code) FILTER (WHERE r.requirement = 'desirable' AND f.code IS NOT NULL), '{}') AS hit_desirable,
      coalesce(array_agg(DISTINCT r.code) FILTER (WHERE r.requirement = 'required'  AND f.code IS NULL), '{}')     AS miss_required,
      count(DISTINCT f.code) FILTER (WHERE f.source = 'verified') AS verified_facets,
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
          CASE WHEN o.match_requires_licence
                AND coalesce(btrim(coalesce(b.license_number, '')), '') = ''
               THEN 'No licence number on record' END,
          CASE WHEN o.match_requires_licence
                AND b.license_expiry IS NOT NULL AND b.license_expiry < current_date
               THEN 'Licence expired' END,
          CASE WHEN o.match_requires_right_to_work AND coalesce(b.right_to_work, false) = false
               THEN 'Right to work not confirmed' END
        ]) x WHERE x IS NOT NULL
      ) AS blocked
    FROM base b
    CROSS JOIN req_counts rc
    LEFT JOIN req r ON true
    LEFT JOIN public.mu_profile_facets f
           ON f.person_id = b.id AND f.facet_type = r.facet_type AND f.code = r.code
    GROUP BY b.id, b.full_name, b.profession, b.years_experience, b.state, b.lga,
             b.doc_count, b.verified_doc_count, b.last_activity_at, b.license_number,
             b.license_expiry, b.right_to_work, rc.n_required, rc.n_desirable
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
      , 2) AS total,
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
        'recent', s.last_activity_at > now() - interval '90 days'
      ) AS bd
    FROM scored s
  )
  SELECT f.id, f.full_name, f.profession, f.years_experience, f.state, f.lga,
         f.total, f.bd, f.blocked, f.hit_required, f.hit_desirable, f.miss_required
    FROM final f
   WHERE _include_blocked OR cardinality(f.blocked) = 0
   ORDER BY cardinality(f.blocked) ASC, f.total DESC, f.last_activity_at DESC
   LIMIT least(coalesce(_limit, 50), 200);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_match_candidates(uuid, integer, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mu_match_candidates(uuid, integer, boolean) TO authenticated, service_role;
