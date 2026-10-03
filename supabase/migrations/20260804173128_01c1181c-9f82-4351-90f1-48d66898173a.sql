-- 1. CREDENTIAL LADDER -------------------------------------------------------

CREATE TABLE public.mu_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  credential_type text NOT NULL CHECK (credential_type IN ('licence','right_to_work','nysc','qualification','id')),
  claim text CHECK (claim IN ('yes','no')),
  claim_source text CHECK (claim_source IN ('form','cv_parsed','admin_entered')),
  claim_at timestamptz,
  evidence_document_id uuid REFERENCES public.mu_documents(id) ON DELETE SET NULL,
  evidence_at timestamptz,
  verified_by uuid,
  verified_at timestamptz,
  verification_method text CHECK (verification_method IN ('document_review','register_check','employer_reference')),
  verification_outcome text CHECK (verification_outcome IN ('pass','fail')),
  expires_at date,
  reference text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, credential_type)
);

CREATE INDEX mu_credentials_person_idx ON public.mu_credentials(person_id);

GRANT SELECT ON public.mu_credentials TO authenticated;
GRANT INSERT, DELETE ON public.mu_credentials TO authenticated;
-- column level: nobody but service_role / the admin RPC may write verification columns
GRANT UPDATE (claim, claim_source, claim_at, evidence_document_id, evidence_at, expires_at, reference, note, updated_at)
  ON public.mu_credentials TO authenticated;
GRANT ALL ON public.mu_credentials TO service_role;

ALTER TABLE public.mu_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage credentials" ON public.mu_credentials
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "People read their own credentials" ON public.mu_credentials
  FOR SELECT TO authenticated
  USING (person_id = public.mu_my_person_id());

CREATE TRIGGER mu_credentials_updated_at BEFORE UPDATE ON public.mu_credentials
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- 2. DERIVED STATE — never stored ---------------------------------------------

CREATE OR REPLACE FUNCTION public.mu_credential_state(
  _claim text, _evidence_document_id uuid, _verification_outcome text, _expires_at date
) RETURNS text
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _verification_outcome = 'fail' THEN 'rejected'
    WHEN _verification_outcome = 'pass' AND _expires_at IS NOT NULL AND _expires_at < current_date THEN 'expired'
    WHEN _verification_outcome = 'pass' THEN 'verified'
    WHEN _evidence_document_id IS NOT NULL THEN 'documented'
    WHEN _claim = 'no'  THEN 'declined'
    WHEN _claim = 'yes' THEN 'self_declared'
    ELSE 'unknown'
  END
$$;

-- ordinal ladder: negative states are disqualifying, unknown is simply absent
CREATE OR REPLACE FUNCTION public.mu_evidence_rank(_state text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _state
    WHEN 'verified' THEN 3
    WHEN 'documented' THEN 2
    WHEN 'self_declared' THEN 1
    WHEN 'unknown' THEN 0
    WHEN 'none' THEN 0
    ELSE -1
  END
$$;

CREATE OR REPLACE VIEW public.mu_credentials_v
WITH (security_invoker = true) AS
  SELECT c.*,
    public.mu_credential_state(c.claim, c.evidence_document_id, c.verification_outcome, c.expires_at) AS state,
    public.mu_evidence_rank(
      public.mu_credential_state(c.claim, c.evidence_document_id, c.verification_outcome, c.expires_at)
    ) AS state_rank
  FROM public.mu_credentials c;

GRANT SELECT ON public.mu_credentials_v TO authenticated, service_role;

-- 3. GUARD: no promotion job or client may forge a verification ----------------

CREATE OR REPLACE FUNCTION public.mu_credentials_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_admin boolean := auth.uid() IS NOT NULL AND private.has_role(auth.uid(), 'admin'::app_role);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT is_admin THEN
      NEW.verified_by := NULL; NEW.verified_at := NULL;
      NEW.verification_method := NULL; NEW.verification_outcome := NULL;
    END IF;
    IF NEW.claim IS NOT NULL AND NEW.claim_at IS NULL THEN NEW.claim_at := now(); END IF;
    IF NEW.evidence_document_id IS NOT NULL AND NEW.evidence_at IS NULL THEN NEW.evidence_at := now(); END IF;
    RETURN NEW;
  END IF;

  IF NOT is_admin THEN
    NEW.verified_by := OLD.verified_by; NEW.verified_at := OLD.verified_at;
    NEW.verification_method := OLD.verification_method; NEW.verification_outcome := OLD.verification_outcome;
  END IF;

  -- rule (b): state advances only on NEW evidence. Re-parsing or re-promoting
  -- can never reset or downgrade an existing claim or an existing review.
  IF NEW.claim IS DISTINCT FROM OLD.claim THEN NEW.claim_at := now(); END IF;
  IF NEW.evidence_document_id IS DISTINCT FROM OLD.evidence_document_id THEN
    NEW.evidence_at := CASE WHEN NEW.evidence_document_id IS NULL THEN NULL ELSE now() END;
    -- new document invalidates the previous review; it must be looked at again
    IF NOT is_admin THEN
      NEW.verification_outcome := NULL; NEW.verified_by := NULL;
      NEW.verified_at := NULL; NEW.verification_method := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mu_credentials_guard BEFORE INSERT OR UPDATE ON public.mu_credentials
  FOR EACH ROW EXECUTE FUNCTION public.mu_credentials_guard();

-- rule (d): every state change lands on the activity trail
CREATE OR REPLACE FUNCTION public.mu_credentials_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE before_state text; after_state text;
BEGIN
  after_state := public.mu_credential_state(NEW.claim, NEW.evidence_document_id, NEW.verification_outcome, NEW.expires_at);
  before_state := CASE WHEN TG_OP = 'INSERT' THEN 'unknown'
    ELSE public.mu_credential_state(OLD.claim, OLD.evidence_document_id, OLD.verification_outcome, OLD.expires_at) END;
  IF before_state IS DISTINCT FROM after_state THEN
    INSERT INTO public.mu_activity (person_id, actor_id, action, detail)
    VALUES (NEW.person_id, auth.uid(), 'credential_state_change',
      jsonb_build_object('credential_type', NEW.credential_type, 'from', before_state, 'to', after_state,
        'claim_source', NEW.claim_source, 'method', NEW.verification_method, 'document_id', NEW.evidence_document_id));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mu_credentials_audit AFTER INSERT OR UPDATE ON public.mu_credentials
  FOR EACH ROW EXECUTE FUNCTION public.mu_credentials_audit();

-- the ONLY path to verified
CREATE OR REPLACE FUNCTION public.mu_verify_credential(
  _person_id uuid, _credential_type text, _outcome text,
  _method text DEFAULT 'document_review', _document_id uuid DEFAULT NULL,
  _expires_at date DEFAULT NULL, _note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row public.mu_credentials%ROWTYPE;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF _outcome NOT IN ('pass','fail') THEN RAISE EXCEPTION 'Outcome must be pass or fail'; END IF;

  INSERT INTO public.mu_credentials AS c (person_id, credential_type, evidence_document_id, expires_at, note,
    verified_by, verified_at, verification_method, verification_outcome)
  VALUES (_person_id, _credential_type, _document_id, _expires_at, _note,
    auth.uid(), now(), _method, _outcome)
  ON CONFLICT (person_id, credential_type) DO UPDATE SET
    evidence_document_id = coalesce(EXCLUDED.evidence_document_id, c.evidence_document_id),
    expires_at = coalesce(EXCLUDED.expires_at, c.expires_at),
    note = coalesce(EXCLUDED.note, c.note),
    verified_by = auth.uid(), verified_at = now(),
    verification_method = _method, verification_outcome = _outcome
  RETURNING * INTO row;

  RETURN jsonb_build_object('credential_type', row.credential_type,
    'state', public.mu_credential_state(row.claim, row.evidence_document_id, row.verification_outcome, row.expires_at));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mu_verify_credential(uuid,text,text,text,uuid,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_verify_credential(uuid,text,text,text,uuid,date,text) TO authenticated;

-- 4. MIGRATE EXISTING ANSWERS: claims, not confirmations -----------------------

INSERT INTO public.mu_credentials (person_id, credential_type, claim, claim_source, claim_at)
SELECT id, 'licence',
       CASE WHEN licence_status = 'confirmed' THEN 'yes' WHEN licence_status = 'absent' THEN 'no' END,
       'form', coalesce(updated_at, created_at)
  FROM public.mu_people WHERE licence_status IN ('confirmed','absent')
ON CONFLICT DO NOTHING;

INSERT INTO public.mu_credentials (person_id, credential_type, claim, claim_source, claim_at)
SELECT id, 'right_to_work',
       CASE WHEN right_to_work_status = 'confirmed' THEN 'yes' WHEN right_to_work_status = 'absent' THEN 'no' END,
       'form', coalesce(updated_at, created_at)
  FROM public.mu_people WHERE right_to_work_status IN ('confirmed','absent')
ON CONFLICT DO NOTHING;

INSERT INTO public.mu_credentials (person_id, credential_type, claim, claim_source, claim_at)
SELECT id, 'nysc',
       CASE WHEN nysc_status ILIKE 'yes%' OR nysc_status ILIKE '%completed%' OR nysc_status ILIKE '%exempt%' THEN 'yes'
            WHEN nysc_status ILIKE 'no%' THEN 'no' END,
       'form', coalesce(updated_at, created_at)
  FROM public.mu_people WHERE coalesce(btrim(nysc_status), '') <> ''
ON CONFLICT DO NOTHING;

-- 5. READINESS + COMPLETENESS ARE TWO DIFFERENT NUMBERS ------------------------

CREATE OR REPLACE FUNCTION public.mu_deployment_readiness(_person_id uuid, _types text[] DEFAULT ARRAY['licence','right_to_work'])
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT round(100.0 * count(*) FILTER (
           WHERE public.mu_evidence_rank(
             public.mu_credential_state(c.claim, c.evidence_document_id, c.verification_outcome, c.expires_at)) >= 2
         )::numeric / greatest(cardinality(_types), 1), 0)
    FROM unnest(_types) t
    LEFT JOIN public.mu_credentials c ON c.person_id = _person_id AND c.credential_type = t
$$;

-- profile completeness no longer counts a yes/no answer as a held credential
CREATE OR REPLACE FUNCTION public.mu_profile_completeness(_person_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT round(100.0 * (
      (coalesce(btrim(coalesce(p.profession,'')),'') <> '')::int
    + (coalesce(btrim(coalesce(p.state,'')),'') <> '')::int
    + (coalesce(btrim(coalesce(p.lga,'')),'') <> '')::int
    + (p.years_experience IS NOT NULL)::int
    + (coalesce(btrim(coalesce(p.licensing_body,'')),'') <> '')::int
    + (EXISTS (SELECT 1 FROM public.mu_credentials c WHERE c.person_id = p.id AND c.credential_type = 'licence' AND c.claim IS NOT NULL))::int
    + (EXISTS (SELECT 1 FROM public.mu_credentials c WHERE c.person_id = p.id AND c.credential_type = 'right_to_work' AND c.claim IS NOT NULL))::int
    + (EXISTS (SELECT 1 FROM public.mu_documents d WHERE d.person_id = p.id AND NOT d.rejected))::int
  ) / 8.0, 0)
  FROM public.mu_people p WHERE p.id = _person_id
$$;

-- 6. OPPORTUNITIES ASK FOR A TIER, NOT A TICK ----------------------------------

ALTER TABLE public.matchmaker_opportunities
  ADD COLUMN min_licence_evidence text NOT NULL DEFAULT 'none'
    CHECK (min_licence_evidence IN ('none','self_declared','documented','verified')),
  ADD COLUMN min_right_to_work_evidence text NOT NULL DEFAULT 'none'
    CHECK (min_right_to_work_evidence IN ('none','self_declared','documented','verified'));

UPDATE public.matchmaker_opportunities
   SET min_licence_evidence = CASE WHEN match_requires_licence THEN 'self_declared' ELSE 'none' END,
       min_right_to_work_evidence = CASE WHEN match_requires_right_to_work THEN 'self_declared' ELSE 'none' END;

-- 7. MATCHER: tiers, and clinical facets scored apart from preferences ---------

CREATE OR REPLACE FUNCTION public.mu_match_candidates(_opportunity_id uuid, _limit integer DEFAULT 50, _include_blocked boolean DEFAULT false)
 RETURNS TABLE(person_id uuid, full_name text, profession text, years_experience integer, state text, lga text,
   score numeric, breakdown jsonb, blockers text[], matched_required text[], matched_desirable text[], missing_required text[])
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  o public.matchmaker_opportunities%ROWTYPE;
  w jsonb;
  n_clinical int; n_pref int;
  lic_floor int; rtw_floor int;
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

  IF cardinality(o.match_professions) = 0 THEN missing := missing || 'match_professions'::text; END IF;
  IF cardinality(o.match_states) = 0 AND cardinality(o.match_lgas) = 0 THEN missing := missing || 'match_states/match_lgas'::text; END IF;
  IF o.match_min_years IS NULL THEN missing := missing || 'match_min_years'::text; END IF;
  IF n_clinical = 0 THEN missing := missing || 'clinical requirement facets'::text; END IF;

  IF cardinality(o.match_professions) = 0
     AND cardinality(o.match_states) = 0 AND cardinality(o.match_lgas) = 0
     AND o.match_min_years IS NULL
     AND o.min_licence_evidence = 'none' AND o.min_right_to_work_evidence = 'none'
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
      coalesce((SELECT state FROM cred WHERE cred.person_id = p.id AND credential_type = 'licence'), 'unknown')       AS lic_state,
      coalesce((SELECT state FROM cred WHERE cred.person_id = p.id AND credential_type = 'right_to_work'), 'unknown') AS rtw_state
    FROM public.mu_people p
  ),
  scored AS (
    SELECT
      b.id, b.full_name, b.profession, b.years_experience, b.state, b.lga,
      b.doc_count, b.verified_doc_count, b.last_activity_at,
      b.lic_state, b.rtw_state, b.licensing_body,
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
               THEN 'Right to work evidence is ' || b.rtw_state || ', below the required ' || o.min_right_to_work_evidence END
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
      -- credentials score by tier: verified 1.0, documented 0.7, self_declared 0.4, unknown 0
      + (CASE WHEN lic_floor > 0 THEN 10 * (CASE s.lic_state WHEN 'verified' THEN 1.0 WHEN 'documented' THEN 0.7 WHEN 'self_declared' THEN 0.4 ELSE 0 END) ELSE 0 END)
      + (CASE WHEN rtw_floor > 0 THEN 5 * (CASE s.rtw_state WHEN 'verified' THEN 1.0 WHEN 'documented' THEN 0.7 WHEN 'self_declared' THEN 0.4 ELSE 0 END) ELSE 0 END)
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

-- 8. VERIFICATION QUEUE, RANKED BY SHORTLIST PRESSURE --------------------------

CREATE OR REPLACE FUNCTION public.mu_verification_queue(_limit integer DEFAULT 100)
RETURNS TABLE(person_id uuid, full_name text, credential_type text, state text,
  evidence_document_id uuid, document_label text, document_url text, claim_source text,
  on_active_shortlist boolean, shortlist_count integer, evidence_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  WITH sl AS (
    SELECT s.person_id, count(*)::int AS n
      FROM public.mu_shortlists s
      JOIN public.matchmaker_opportunities op ON op.id = s.opportunity_id AND op.status IN ('open','draft')
     GROUP BY s.person_id
  )
  SELECT c.person_id, p.full_name, c.credential_type,
         public.mu_credential_state(c.claim, c.evidence_document_id, c.verification_outcome, c.expires_at),
         c.evidence_document_id, d.label, d.url, c.claim_source,
         coalesce(sl.n, 0) > 0, coalesce(sl.n, 0), c.evidence_at
    FROM public.mu_credentials c
    JOIN public.mu_people p ON p.id = c.person_id
    LEFT JOIN public.mu_documents d ON d.id = c.evidence_document_id
    LEFT JOIN sl ON sl.person_id = c.person_id
   WHERE public.mu_credential_state(c.claim, c.evidence_document_id, c.verification_outcome, c.expires_at)
         IN ('documented','expired')
   ORDER BY coalesce(sl.n, 0) DESC, c.evidence_at ASC NULLS LAST
   LIMIT least(coalesce(_limit, 100), 500);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mu_verification_queue(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_verification_queue(integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mu_credential_state(text,uuid,text,date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mu_deployment_readiness(uuid,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_credential_state(text,uuid,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_deployment_readiness(uuid,text[]) TO authenticated;