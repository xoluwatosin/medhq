-- SEO / content governance foundation.
-- Operational truth stays in services, service_fees and blog_posts. These tables
-- only reference them; they never restate them.

CREATE OR REPLACE FUNCTION private.seo_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.seo_can_write()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT private.has_role(auth.uid(), 'admin'::app_role);
$$;

-- 1. Page registry ----------------------------------------------------------
CREATE TABLE public.seo_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL UNIQUE,
  path text NOT NULL UNIQUE CHECK (path LIKE '/%'),
  page_type text NOT NULL CHECK (page_type IN ('service','hub','editorial','comparison','pricing','trust','location','b2b','talent','job_collection','other')),
  estate text NOT NULL,
  audience text[] NOT NULL DEFAULT '{}',
  search_intent text,
  primary_query text,
  secondary_queries text[] NOT NULL DEFAULT '{}',
  title text,
  h1 text,
  meta_description text,
  page_promise text,
  primary_cta_code text,
  secondary_cta_code text,
  canonical_path text,
  schema_types text[] NOT NULL DEFAULT '{}',
  priority integer,
  index_state text NOT NULL DEFAULT 'candidate' CHECK (index_state IN ('candidate','draft','review','indexable','noindex','retired')),
  publication_state text NOT NULL DEFAULT 'planned' CHECK (publication_state IN ('planned','in_progress','ready','published','archived')),
  evidence_state text NOT NULL DEFAULT 'missing' CHECK (evidence_state IN ('missing','partial','sufficient','stale')),
  clinical_review_required boolean NOT NULL DEFAULT false,
  clinical_reviewed_at timestamptz,
  clinical_reviewed_by uuid,
  factual_reviewed_at timestamptz,
  factual_reviewed_by uuid,
  last_published_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Canonical modules ------------------------------------------------------
CREATE TABLE public.seo_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code text NOT NULL UNIQUE,
  name text NOT NULL,
  module_type text NOT NULL CHECK (module_type IN ('trust','assessment','clinical_scope','escalation','pricing_logic','coverage','care_reporting','medication','staffing_model','postnatal','safeguarding','b2b_compliance','talent_feed','diaspora_coordination','event_scoping','programme_delivery','other')),
  summary text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_domain text,
  review_state text NOT NULL DEFAULT 'draft' CHECK (review_state IN ('draft','review','approved','retired')),
  effective_from timestamptz,
  review_due_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.seo_module_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.seo_modules(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  change_note text NOT NULL,
  review_state text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, version)
);

-- 3. Composition ------------------------------------------------------------
CREATE TABLE public.seo_page_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.seo_pages(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.seo_modules(id) ON DELETE RESTRICT,
  section_key text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  required boolean NOT NULL DEFAULT true,
  local_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, module_id, section_key)
);

-- local_context may never restate a governed fact.
CREATE OR REPLACE FUNCTION private.seo_guard_local_context()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private, pg_temp
AS $$
DECLARE
  reserved text[] := ARRAY['price','prices','pricing','amount','fee','fees','accreditation','insurance','professional_scope','scope','credential','credentials','credential_requirements','coverage','safeguarding','safeguarding_standards','response_time','response_times'];
  k text;
BEGIN
  FOREACH k IN ARRAY reserved LOOP
    IF NEW.local_context ? k THEN
      RAISE EXCEPTION 'local_context may not override the governed fact "%"', k;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER seo_page_modules_guard
BEFORE INSERT OR UPDATE ON public.seo_page_modules
FOR EACH ROW EXECUTE FUNCTION private.seo_guard_local_context();

-- 4. Claims -----------------------------------------------------------------
CREATE TABLE public.seo_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_code text NOT NULL UNIQUE,
  claim_type text NOT NULL CHECK (claim_type IN ('accreditation','insurance','membership','service_scope','coverage','response_time','workforce_count','availability','pricing','credential_process','partner','operating_fact','other')),
  subject_type text,
  subject_id uuid,
  claim_text text NOT NULL,
  structured_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_type text,
  evidence_reference text,
  evidence_url text,
  evidence_as_of timestamptz,
  valid_from timestamptz,
  valid_until timestamptz,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','review','approved','stale','retired')),
  risk_level text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high')),
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.seo_page_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.seo_pages(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES public.seo_claims(id) ON DELETE RESTRICT,
  usage_key text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, claim_id, usage_key)
);

-- Deterministic staleness: an approved claim past its validity is stale.
CREATE OR REPLACE FUNCTION public.seo_claim_effective_state(p_state text, p_valid_from timestamptz, p_valid_until timestamptz)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_state <> 'approved' THEN p_state
    WHEN p_valid_until IS NOT NULL AND p_valid_until < now() THEN 'stale'
    WHEN p_valid_from IS NOT NULL AND p_valid_from > now() THEN 'draft'
    ELSE 'approved'
  END;
$$;

-- 5. Markets ----------------------------------------------------------------
CREATE TABLE public.seo_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL DEFAULT 'NG',
  state_name text,
  city_name text,
  lga_name text,
  market_key text NOT NULL UNIQUE,
  market_state text NOT NULL DEFAULT 'research' CHECK (market_state IN ('research','building_coverage','available','established','suspended','not_published')),
  demand_state text NOT NULL DEFAULT 'unknown' CHECK (demand_state IN ('unknown','weak','moderate','strong')),
  safety_state text NOT NULL DEFAULT 'review' CHECK (safety_state IN ('review','serviceable','restricted','suspended')),
  notes text,
  evidence_as_of timestamptz,
  last_reviewed_at timestamptz,
  last_reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.seo_page_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.seo_pages(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.seo_markets(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  local_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, market_id)
);

-- 6. References to operational records --------------------------------------
CREATE TABLE public.seo_page_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.seo_pages(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  relationship text NOT NULL DEFAULT 'primary' CHECK (relationship IN ('primary','secondary','related','excluded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, service_id, relationship)
);

CREATE TABLE public.seo_fee_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid REFERENCES public.seo_pages(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.seo_modules(id) ON DELETE CASCADE,
  service_fee_id uuid NOT NULL REFERENCES public.service_fees(id) ON DELETE RESTRICT,
  usage_key text NOT NULL DEFAULT 'primary',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seo_fee_refs_owner CHECK (page_id IS NOT NULL OR module_id IS NOT NULL)
);

CREATE UNIQUE INDEX seo_fee_refs_page_unique ON public.seo_fee_refs (page_id, service_fee_id, usage_key) WHERE page_id IS NOT NULL;
CREATE UNIQUE INDEX seo_fee_refs_module_unique ON public.seo_fee_refs (module_id, service_fee_id, usage_key) WHERE module_id IS NOT NULL;

-- 7. Publication gate -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seo_page_blockers(p_page_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  page public.seo_pages%ROWTYPE;
  blockers text[] := '{}';
  n integer;
BEGIN
  SELECT * INTO page FROM public.seo_pages WHERE id = p_page_id;
  IF NOT FOUND THEN
    RETURN ARRAY['Page not found'];
  END IF;

  IF page.publication_state NOT IN ('ready','published') THEN
    blockers := blockers || 'Publication not ready';
  END IF;

  IF page.evidence_state <> 'sufficient' THEN
    blockers := blockers || 'Missing evidence';
  END IF;

  IF page.clinical_review_required AND (page.clinical_reviewed_at IS NULL OR page.clinical_reviewed_by IS NULL) THEN
    blockers := blockers || 'Clinical review required';
  END IF;

  SELECT count(*) INTO n
  FROM public.seo_page_claims pc
  JOIN public.seo_claims c ON c.id = pc.claim_id
  WHERE pc.page_id = p_page_id
    AND pc.required
    AND public.seo_claim_effective_state(c.state, c.valid_from, c.valid_until) <> 'approved';
  IF n > 0 THEN
    blockers := blockers || 'Required claim stale or unapproved';
  END IF;

  SELECT count(*) INTO n
  FROM public.seo_page_modules pm
  JOIN public.seo_modules m ON m.id = pm.module_id
  WHERE pm.page_id = p_page_id AND pm.required AND m.review_state <> 'approved';
  IF n > 0 THEN
    blockers := blockers || 'Required module not approved';
  END IF;

  IF page.page_type = 'location' THEN
    SELECT count(*) INTO n FROM public.seo_page_markets WHERE page_id = p_page_id;
    IF n = 0 THEN
      blockers := blockers || 'Market not serviceable';
    ELSE
      SELECT count(*) INTO n
      FROM public.seo_page_markets pmk
      JOIN public.seo_markets mk ON mk.id = pmk.market_id
      WHERE pmk.page_id = p_page_id
        AND mk.market_state IN ('available','established')
        AND mk.safety_state = 'serviceable'
        AND pmk.local_evidence <> '{}'::jsonb;
      IF n = 0 THEN
        blockers := blockers || 'Market not serviceable';
      END IF;
    END IF;
  END IF;

  RETURN blockers;
END;
$$;

CREATE OR REPLACE FUNCTION private.seo_pages_index_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private, pg_temp
AS $$
DECLARE
  blockers text[];
BEGIN
  IF NEW.index_state = 'indexable' THEN
    blockers := public.seo_page_blockers(NEW.id);
    IF array_length(blockers, 1) > 0 THEN
      RAISE EXCEPTION 'Page cannot become indexable: %', array_to_string(blockers, '; ');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- AFTER-constraint timing so related rows written in the same statement count.
CREATE CONSTRAINT TRIGGER seo_pages_index_guard
AFTER INSERT OR UPDATE ON public.seo_pages
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION private.seo_pages_index_guard();

CREATE OR REPLACE FUNCTION public.seo_page_set_index_state(p_page_id uuid, p_state text)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  blockers text[];
BEGIN
  IF NOT private.seo_can_write() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF p_state NOT IN ('candidate','draft','review','indexable','noindex','retired') THEN
    RAISE EXCEPTION 'Unknown index state %', p_state;
  END IF;

  IF p_state = 'indexable' THEN
    blockers := public.seo_page_blockers(p_page_id);
    IF array_length(blockers, 1) > 0 THEN
      RETURN blockers;
    END IF;
  END IF;

  UPDATE public.seo_pages
  SET index_state = p_state,
      last_published_at = CASE WHEN p_state = 'indexable' THEN now() ELSE last_published_at END
  WHERE id = p_page_id;

  RETURN '{}'::text[];
END;
$$;

-- 8. Module revision mechanism ----------------------------------------------
CREATE OR REPLACE FUNCTION private.seo_modules_revision_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF OLD.review_state = 'approved'
     AND (NEW.content IS DISTINCT FROM OLD.content OR NEW.summary IS DISTINCT FROM OLD.summary)
     AND coalesce(current_setting('seo.revising', true), '') <> 'on' THEN
    RAISE EXCEPTION 'An approved module must be changed through seo_module_save with a change note';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER seo_modules_revision_guard
BEFORE UPDATE ON public.seo_modules
FOR EACH ROW EXECUTE FUNCTION private.seo_modules_revision_guard();

CREATE OR REPLACE FUNCTION public.seo_module_save(
  p_module_id uuid,
  p_content jsonb,
  p_summary text,
  p_review_state text,
  p_change_note text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  current public.seo_modules%ROWTYPE;
  next_version integer;
BEGIN
  IF NOT private.seo_can_write() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF p_change_note IS NULL OR btrim(p_change_note) = '' THEN
    RAISE EXCEPTION 'A change note is required';
  END IF;

  SELECT * INTO current FROM public.seo_modules WHERE id = p_module_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Module not found';
  END IF;

  SELECT coalesce(max(version), 0) + 1 INTO next_version
  FROM public.seo_module_revisions WHERE module_id = p_module_id;

  INSERT INTO public.seo_module_revisions (module_id, version, content, summary, change_note, review_state, created_by)
  VALUES (p_module_id, next_version, current.content, current.summary, p_change_note, current.review_state, auth.uid());

  PERFORM set_config('seo.revising', 'on', true);
  UPDATE public.seo_modules
  SET content = coalesce(p_content, content),
      summary = coalesce(p_summary, summary),
      review_state = coalesce(p_review_state, review_state),
      approved_at = CASE WHEN coalesce(p_review_state, review_state) = 'approved' THEN coalesce(approved_at, now()) ELSE approved_at END,
      approved_by = CASE WHEN coalesce(p_review_state, review_state) = 'approved' THEN coalesce(approved_by, auth.uid()) ELSE approved_by END
  WHERE id = p_module_id;
  PERFORM set_config('seo.revising', 'off', true);

  RETURN p_module_id;
END;
$$;

-- Deterministic sweep: approved claims past validity become stale.
CREATE OR REPLACE FUNCTION public.seo_claims_refresh_stale()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  changed integer;
BEGIN
  IF NOT private.seo_can_write() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  UPDATE public.seo_claims
  SET state = 'stale'
  WHERE state = 'approved' AND valid_until IS NOT NULL AND valid_until < now();
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

-- 9. Timestamps -------------------------------------------------------------
CREATE TRIGGER seo_pages_touch BEFORE UPDATE ON public.seo_pages FOR EACH ROW EXECUTE FUNCTION private.seo_touch();
CREATE TRIGGER seo_modules_touch BEFORE UPDATE ON public.seo_modules FOR EACH ROW EXECUTE FUNCTION private.seo_touch();
CREATE TRIGGER seo_claims_touch BEFORE UPDATE ON public.seo_claims FOR EACH ROW EXECUTE FUNCTION private.seo_touch();
CREATE TRIGGER seo_markets_touch BEFORE UPDATE ON public.seo_markets FOR EACH ROW EXECUTE FUNCTION private.seo_touch();

-- 10. Grants and RLS --------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_pages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_modules TO authenticated;
GRANT SELECT, INSERT ON public.seo_module_revisions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_page_modules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_claims TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_page_claims TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_markets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_page_markets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_page_services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_fee_refs TO authenticated;
GRANT ALL ON public.seo_pages, public.seo_modules, public.seo_module_revisions, public.seo_page_modules,
  public.seo_claims, public.seo_page_claims, public.seo_markets, public.seo_page_markets,
  public.seo_page_services, public.seo_fee_refs TO service_role;

ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_module_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_page_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_page_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_page_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_page_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_fee_refs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage seo pages" ON public.seo_pages FOR ALL TO authenticated
  USING (private.seo_can_write()) WITH CHECK (private.seo_can_write());
CREATE POLICY "Admins manage seo modules" ON public.seo_modules FOR ALL TO authenticated
  USING (private.seo_can_write()) WITH CHECK (private.seo_can_write());
CREATE POLICY "Admins read seo module revisions" ON public.seo_module_revisions FOR SELECT TO authenticated
  USING (private.seo_can_write());
CREATE POLICY "Admins manage seo page modules" ON public.seo_page_modules FOR ALL TO authenticated
  USING (private.seo_can_write()) WITH CHECK (private.seo_can_write());
CREATE POLICY "Admins manage seo claims" ON public.seo_claims FOR ALL TO authenticated
  USING (private.seo_can_write()) WITH CHECK (private.seo_can_write());
CREATE POLICY "Admins manage seo page claims" ON public.seo_page_claims FOR ALL TO authenticated
  USING (private.seo_can_write()) WITH CHECK (private.seo_can_write());
CREATE POLICY "Admins manage seo markets" ON public.seo_markets FOR ALL TO authenticated
  USING (private.seo_can_write()) WITH CHECK (private.seo_can_write());
CREATE POLICY "Admins manage seo page markets" ON public.seo_page_markets FOR ALL TO authenticated
  USING (private.seo_can_write()) WITH CHECK (private.seo_can_write());
CREATE POLICY "Admins manage seo page services" ON public.seo_page_services FOR ALL TO authenticated
  USING (private.seo_can_write()) WITH CHECK (private.seo_can_write());
CREATE POLICY "Admins manage seo fee refs" ON public.seo_fee_refs FOR ALL TO authenticated
  USING (private.seo_can_write()) WITH CHECK (private.seo_can_write());

REVOKE ALL ON FUNCTION public.seo_page_set_index_state(uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.seo_module_save(uuid, jsonb, text, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.seo_claims_refresh_stale() FROM public, anon;
REVOKE ALL ON FUNCTION public.seo_page_blockers(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.seo_page_set_index_state(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seo_module_save(uuid, jsonb, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seo_claims_refresh_stale() TO authenticated;
GRANT EXECUTE ON FUNCTION public.seo_page_blockers(uuid) TO authenticated;

CREATE INDEX seo_pages_index_state_idx ON public.seo_pages (index_state);
CREATE INDEX seo_pages_publication_state_idx ON public.seo_pages (publication_state);
CREATE INDEX seo_page_claims_page_idx ON public.seo_page_claims (page_id);
CREATE INDEX seo_page_modules_page_idx ON public.seo_page_modules (page_id);
