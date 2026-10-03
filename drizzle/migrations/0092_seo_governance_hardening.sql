-- SEO governance hardening.
-- Corrects volatility, privileges, fee-reference ownership, clinical-review
-- inheritance and the fact that an indexable page was never re-checked once a
-- dependency later became invalid.

-- 1. Claim state depends on now(): it is STABLE, not IMMUTABLE ---------------
CREATE OR REPLACE FUNCTION public.seo_claim_effective_state(p_state text, p_valid_from timestamptz, p_valid_until timestamptz)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_state <> 'approved' THEN p_state
    WHEN p_valid_until IS NOT NULL AND p_valid_until < now() THEN 'stale'
    WHEN p_valid_from IS NOT NULL AND p_valid_from > now() THEN 'draft'
    ELSE 'approved'
  END;
$$;

-- 2. Fee references belong to exactly one owner -----------------------------
ALTER TABLE public.seo_fee_refs DROP CONSTRAINT IF EXISTS seo_fee_refs_owner;
ALTER TABLE public.seo_fee_refs
  ADD CONSTRAINT seo_fee_refs_owner CHECK ((page_id IS NOT NULL) <> (module_id IS NOT NULL));

-- 3. Clinical review is derived from governed content ------------------------
ALTER TABLE public.seo_modules
  ADD COLUMN IF NOT EXISTS requires_clinical_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clinical_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS clinical_reviewed_by uuid;

ALTER TABLE public.seo_claims
  ADD COLUMN IF NOT EXISTS requires_clinical_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clinical_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS clinical_reviewed_by uuid;

-- Tri-state: NULL means the editorial decision has not been taken yet.
ALTER TABLE public.seo_pages
  ADD COLUMN IF NOT EXISTS clinical_requirement text
    CHECK (clinical_requirement IN ('required', 'not_required'));

COMMENT ON COLUMN public.seo_pages.clinical_review_required IS
  'Deprecated. Seeded by page category and not an editorial decision. Use clinical_requirement.';
COMMENT ON COLUMN public.seo_pages.clinical_requirement IS
  'required | not_required | NULL (not yet determined).';

-- 4. Corrected publication gate ---------------------------------------------
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
  clinical_components integer;
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

  -- Page-level clinical requirement, when it has been explicitly set.
  IF page.clinical_requirement = 'required'
     AND (page.clinical_reviewed_at IS NULL OR page.clinical_reviewed_by IS NULL) THEN
    blockers := blockers || 'Clinical review required';
  END IF;

  -- Inherited from required modules.
  SELECT count(*) INTO n
  FROM public.seo_page_modules pm
  JOIN public.seo_modules m ON m.id = pm.module_id
  WHERE pm.page_id = p_page_id AND pm.required AND m.requires_clinical_review
    AND (m.clinical_reviewed_at IS NULL OR m.clinical_reviewed_by IS NULL);
  IF n > 0 THEN
    blockers := blockers || 'Module clinical review required';
  END IF;

  -- Inherited from required claims.
  SELECT count(*) INTO n
  FROM public.seo_page_claims pc
  JOIN public.seo_claims c ON c.id = pc.claim_id
  WHERE pc.page_id = p_page_id AND pc.required AND c.requires_clinical_review
    AND (c.clinical_reviewed_at IS NULL OR c.clinical_reviewed_by IS NULL);
  IF n > 0 THEN
    blockers := blockers || 'Claim clinical review required';
  END IF;

  -- Clinical material attached while the page decision is still undetermined.
  IF page.clinical_requirement IS NULL THEN
    SELECT
      (SELECT count(*) FROM public.seo_page_modules pm JOIN public.seo_modules m ON m.id = pm.module_id
        WHERE pm.page_id = p_page_id AND pm.required AND m.requires_clinical_review)
      + (SELECT count(*) FROM public.seo_page_claims pc JOIN public.seo_claims c ON c.id = pc.claim_id
        WHERE pc.page_id = p_page_id AND pc.required AND c.requires_clinical_review)
      INTO clinical_components;
    IF clinical_components > 0 THEN
      blockers := blockers || 'Clinical review decision outstanding';
    END IF;
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

CREATE OR REPLACE FUNCTION public.seo_page_publishable(p_page_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT coalesce(array_length(public.seo_page_blockers(p_page_id), 1), 0) = 0;
$$;

-- 5. An indexable page may not survive a dependency going bad -----------------
CREATE OR REPLACE FUNCTION private.seo_withdraw_if_blocked(p_page_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  blockers text[];
BEGIN
  IF p_page_id IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.seo_pages WHERE id = p_page_id AND index_state = 'indexable') THEN
    RETURN;
  END IF;
  blockers := public.seo_page_blockers(p_page_id);
  IF coalesce(array_length(blockers, 1), 0) > 0 THEN
    UPDATE public.seo_pages
    SET index_state = 'noindex',
        notes = left(coalesce(notes || E'\n', '')
          || 'Withdrawn from indexing on ' || to_char(now(), 'YYYY-MM-DD') || ': '
          || array_to_string(blockers, '; '), 4000)
    WHERE id = p_page_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.seo_recheck_from_claim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT page_id FROM public.seo_page_claims
            WHERE claim_id = coalesce(NEW.id, OLD.id) LOOP
    PERFORM private.seo_withdraw_if_blocked(r.page_id);
  END LOOP;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION private.seo_recheck_from_module()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT page_id FROM public.seo_page_modules
            WHERE module_id = coalesce(NEW.id, OLD.id) LOOP
    PERFORM private.seo_withdraw_if_blocked(r.page_id);
  END LOOP;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION private.seo_recheck_from_market()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT page_id FROM public.seo_page_markets
            WHERE market_id = coalesce(NEW.id, OLD.id) LOOP
    PERFORM private.seo_withdraw_if_blocked(r.page_id);
  END LOOP;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION private.seo_recheck_from_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
BEGIN
  PERFORM private.seo_withdraw_if_blocked(coalesce(NEW.page_id, OLD.page_id));
  RETURN NULL;
END; $$;

CREATE TRIGGER seo_claims_recheck AFTER INSERT OR UPDATE OR DELETE ON public.seo_claims
  FOR EACH ROW EXECUTE FUNCTION private.seo_recheck_from_claim();
CREATE TRIGGER seo_modules_recheck AFTER INSERT OR UPDATE OR DELETE ON public.seo_modules
  FOR EACH ROW EXECUTE FUNCTION private.seo_recheck_from_module();
CREATE TRIGGER seo_markets_recheck AFTER INSERT OR UPDATE OR DELETE ON public.seo_markets
  FOR EACH ROW EXECUTE FUNCTION private.seo_recheck_from_market();
CREATE TRIGGER seo_page_claims_recheck AFTER INSERT OR UPDATE OR DELETE ON public.seo_page_claims
  FOR EACH ROW EXECUTE FUNCTION private.seo_recheck_from_link();
CREATE TRIGGER seo_page_modules_recheck AFTER INSERT OR UPDATE OR DELETE ON public.seo_page_modules
  FOR EACH ROW EXECUTE FUNCTION private.seo_recheck_from_link();
CREATE TRIGGER seo_page_markets_recheck AFTER INSERT OR UPDATE OR DELETE ON public.seo_page_markets
  FOR EACH ROW EXECUTE FUNCTION private.seo_recheck_from_link();

-- The only safe source for public rendering and sitemap generation.
CREATE OR REPLACE VIEW public.seo_indexable_pages
WITH (security_invoker = on) AS
  SELECT p.id, p.page_key, p.path, p.page_type, p.title, p.meta_description,
         p.canonical_path, p.priority, p.last_published_at
  FROM public.seo_pages p
  WHERE p.index_state = 'indexable'
    AND public.seo_page_publishable(p.id);

-- 6. Approved modules lose their approval when governed content changes -------
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
  next_state text;
  substantive boolean;
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

  substantive := (p_content IS NOT NULL AND p_content IS DISTINCT FROM current.content);
  next_state := coalesce(p_review_state, current.review_state);

  -- Governed content cannot change while silently keeping an old approval.
  IF substantive AND current.review_state = 'approved' AND coalesce(p_review_state, '') <> 'approved' THEN
    next_state := 'review';
  END IF;

  PERFORM set_config('seo.revising', 'on', true);
  UPDATE public.seo_modules
  SET content = coalesce(p_content, content),
      summary = coalesce(p_summary, summary),
      review_state = next_state,
      approved_at = CASE
        WHEN next_state <> 'approved' THEN NULL
        WHEN substantive THEN now()
        ELSE coalesce(approved_at, now()) END,
      approved_by = CASE
        WHEN next_state <> 'approved' THEN NULL
        WHEN substantive THEN auth.uid()
        ELSE coalesce(approved_by, auth.uid()) END
  WHERE id = p_module_id;
  PERFORM set_config('seo.revising', 'off', true);

  RETURN p_module_id;
END;
$$;

-- 7. Least privilege: no direct writes for ordinary authenticated users -------
REVOKE INSERT, UPDATE, DELETE ON
  public.seo_pages, public.seo_modules, public.seo_module_revisions, public.seo_page_modules,
  public.seo_claims, public.seo_page_claims, public.seo_markets, public.seo_page_markets,
  public.seo_page_services, public.seo_fee_refs
FROM authenticated;

REVOKE ALL ON
  public.seo_pages, public.seo_modules, public.seo_module_revisions, public.seo_page_modules,
  public.seo_claims, public.seo_page_claims, public.seo_markets, public.seo_page_markets,
  public.seo_page_services, public.seo_fee_refs
FROM anon;

GRANT SELECT ON public.seo_indexable_pages TO authenticated;
GRANT SELECT ON public.seo_indexable_pages TO service_role;

-- 8. Admin write path: SECURITY DEFINER functions behind the admin check ------
CREATE OR REPLACE FUNCTION public.seo_page_create(
  p_page_key text, p_path text, p_page_type text, p_estate text, p_title text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp
AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT private.seo_can_write() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  INSERT INTO public.seo_pages (page_key, path, page_type, estate, title)
  VALUES (btrim(p_page_key), btrim(p_path), p_page_type, coalesce(nullif(btrim(p_estate), ''), 'families'), nullif(btrim(coalesce(p_title, '')), ''))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.seo_page_save(p_page_id uuid, p_patch jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF NOT private.seo_can_write() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE public.seo_pages SET
    title = CASE WHEN p_patch ? 'title' THEN nullif(p_patch->>'title', '') ELSE title END,
    h1 = CASE WHEN p_patch ? 'h1' THEN nullif(p_patch->>'h1', '') ELSE h1 END,
    meta_description = CASE WHEN p_patch ? 'meta_description' THEN nullif(p_patch->>'meta_description', '') ELSE meta_description END,
    page_promise = CASE WHEN p_patch ? 'page_promise' THEN nullif(p_patch->>'page_promise', '') ELSE page_promise END,
    primary_query = CASE WHEN p_patch ? 'primary_query' THEN nullif(p_patch->>'primary_query', '') ELSE primary_query END,
    canonical_path = CASE WHEN p_patch ? 'canonical_path' THEN nullif(p_patch->>'canonical_path', '') ELSE canonical_path END,
    notes = CASE WHEN p_patch ? 'notes' THEN nullif(p_patch->>'notes', '') ELSE notes END,
    publication_state = CASE WHEN p_patch ? 'publication_state' THEN p_patch->>'publication_state' ELSE publication_state END,
    evidence_state = CASE WHEN p_patch ? 'evidence_state' THEN p_patch->>'evidence_state' ELSE evidence_state END,
    clinical_requirement = CASE WHEN p_patch ? 'clinical_requirement' THEN nullif(p_patch->>'clinical_requirement', '') ELSE clinical_requirement END,
    clinical_reviewed_at = CASE
      WHEN p_patch ? 'clinical_reviewed' AND (p_patch->>'clinical_reviewed')::boolean THEN now()
      WHEN p_patch ? 'clinical_reviewed' THEN NULL
      ELSE clinical_reviewed_at END,
    clinical_reviewed_by = CASE
      WHEN p_patch ? 'clinical_reviewed' AND (p_patch->>'clinical_reviewed')::boolean THEN auth.uid()
      WHEN p_patch ? 'clinical_reviewed' THEN NULL
      ELSE clinical_reviewed_by END
  WHERE id = p_page_id;

  PERFORM private.seo_withdraw_if_blocked(p_page_id);
  RETURN p_page_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.seo_claim_save(p_claim_id uuid, p_patch jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp
AS $$
DECLARE target uuid;
BEGIN
  IF NOT private.seo_can_write() THEN RAISE EXCEPTION 'Not authorised'; END IF;

  IF p_claim_id IS NULL THEN
    INSERT INTO public.seo_claims (claim_code, claim_type, claim_text)
    VALUES (btrim(p_patch->>'claim_code'), coalesce(p_patch->>'claim_type', 'operating_fact'), btrim(p_patch->>'claim_text'))
    RETURNING id INTO target;
  ELSE
    target := p_claim_id;
  END IF;

  UPDATE public.seo_claims SET
    claim_code = CASE WHEN p_patch ? 'claim_code' THEN btrim(p_patch->>'claim_code') ELSE claim_code END,
    claim_type = CASE WHEN p_patch ? 'claim_type' THEN p_patch->>'claim_type' ELSE claim_type END,
    claim_text = CASE WHEN p_patch ? 'claim_text' THEN btrim(p_patch->>'claim_text') ELSE claim_text END,
    evidence_type = CASE WHEN p_patch ? 'evidence_type' THEN nullif(p_patch->>'evidence_type', '') ELSE evidence_type END,
    evidence_reference = CASE WHEN p_patch ? 'evidence_reference' THEN nullif(p_patch->>'evidence_reference', '') ELSE evidence_reference END,
    evidence_url = CASE WHEN p_patch ? 'evidence_url' THEN nullif(p_patch->>'evidence_url', '') ELSE evidence_url END,
    evidence_as_of = CASE WHEN p_patch ? 'evidence_as_of' THEN nullif(p_patch->>'evidence_as_of', '')::timestamptz ELSE evidence_as_of END,
    valid_from = CASE WHEN p_patch ? 'valid_from' THEN nullif(p_patch->>'valid_from', '')::timestamptz ELSE valid_from END,
    valid_until = CASE WHEN p_patch ? 'valid_until' THEN nullif(p_patch->>'valid_until', '')::timestamptz ELSE valid_until END,
    state = CASE WHEN p_patch ? 'state' THEN p_patch->>'state' ELSE state END,
    risk_level = CASE WHEN p_patch ? 'risk_level' THEN p_patch->>'risk_level' ELSE risk_level END,
    requires_clinical_review = CASE WHEN p_patch ? 'requires_clinical_review' THEN (p_patch->>'requires_clinical_review')::boolean ELSE requires_clinical_review END,
    clinical_reviewed_at = CASE
      WHEN p_patch ? 'clinical_reviewed' AND (p_patch->>'clinical_reviewed')::boolean THEN now()
      WHEN p_patch ? 'clinical_reviewed' THEN NULL
      ELSE clinical_reviewed_at END,
    clinical_reviewed_by = CASE
      WHEN p_patch ? 'clinical_reviewed' AND (p_patch->>'clinical_reviewed')::boolean THEN auth.uid()
      WHEN p_patch ? 'clinical_reviewed' THEN NULL
      ELSE clinical_reviewed_by END,
    approved_at = CASE WHEN coalesce(p_patch->>'state', state) = 'approved' THEN coalesce(approved_at, now()) ELSE NULL END,
    approved_by = CASE WHEN coalesce(p_patch->>'state', state) = 'approved' THEN coalesce(approved_by, auth.uid()) ELSE NULL END
  WHERE id = target;

  RETURN target;
END;
$$;

CREATE OR REPLACE FUNCTION public.seo_market_save(p_market_id uuid, p_patch jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp
AS $$
DECLARE target uuid;
BEGIN
  IF NOT private.seo_can_write() THEN RAISE EXCEPTION 'Not authorised'; END IF;

  IF p_market_id IS NULL THEN
    INSERT INTO public.seo_markets (market_key) VALUES (btrim(p_patch->>'market_key')) RETURNING id INTO target;
  ELSE
    target := p_market_id;
  END IF;

  UPDATE public.seo_markets SET
    market_key = CASE WHEN p_patch ? 'market_key' THEN btrim(p_patch->>'market_key') ELSE market_key END,
    country_code = CASE WHEN p_patch ? 'country_code' THEN coalesce(nullif(btrim(p_patch->>'country_code'), ''), 'NG') ELSE country_code END,
    state_name = CASE WHEN p_patch ? 'state_name' THEN nullif(p_patch->>'state_name', '') ELSE state_name END,
    city_name = CASE WHEN p_patch ? 'city_name' THEN nullif(p_patch->>'city_name', '') ELSE city_name END,
    lga_name = CASE WHEN p_patch ? 'lga_name' THEN nullif(p_patch->>'lga_name', '') ELSE lga_name END,
    market_state = CASE WHEN p_patch ? 'market_state' THEN p_patch->>'market_state' ELSE market_state END,
    demand_state = CASE WHEN p_patch ? 'demand_state' THEN p_patch->>'demand_state' ELSE demand_state END,
    safety_state = CASE WHEN p_patch ? 'safety_state' THEN p_patch->>'safety_state' ELSE safety_state END,
    evidence_as_of = CASE WHEN p_patch ? 'evidence_as_of' THEN nullif(p_patch->>'evidence_as_of', '')::timestamptz ELSE evidence_as_of END,
    notes = CASE WHEN p_patch ? 'notes' THEN nullif(p_patch->>'notes', '') ELSE notes END,
    last_reviewed_at = now(),
    last_reviewed_by = auth.uid()
  WHERE id = target;

  RETURN target;
END;
$$;

CREATE OR REPLACE FUNCTION public.seo_page_link(
  p_kind text, p_page_id uuid, p_target_id uuid, p_key text, p_required boolean
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp
AS $$
DECLARE link_id uuid;
BEGIN
  IF NOT private.seo_can_write() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF p_kind = 'module' THEN
    INSERT INTO public.seo_page_modules (page_id, module_id, section_key, required)
    VALUES (p_page_id, p_target_id, coalesce(p_key, 'body'), coalesce(p_required, true))
    RETURNING id INTO link_id;
  ELSIF p_kind = 'claim' THEN
    INSERT INTO public.seo_page_claims (page_id, claim_id, usage_key, required)
    VALUES (p_page_id, p_target_id, coalesce(p_key, 'primary'), coalesce(p_required, true))
    RETURNING id INTO link_id;
  ELSIF p_kind = 'market' THEN
    INSERT INTO public.seo_page_markets (page_id, market_id, is_primary)
    VALUES (p_page_id, p_target_id, coalesce(p_required, false))
    RETURNING id INTO link_id;
  ELSIF p_kind = 'service' THEN
    INSERT INTO public.seo_page_services (page_id, service_id, relationship)
    VALUES (p_page_id, p_target_id, coalesce(p_key, 'primary'))
    RETURNING id INTO link_id;
  ELSE
    RAISE EXCEPTION 'Unknown link kind %', p_kind;
  END IF;
  RETURN link_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.seo_page_unlink(p_kind text, p_link_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF NOT private.seo_can_write() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF p_kind = 'module' THEN DELETE FROM public.seo_page_modules WHERE id = p_link_id;
  ELSIF p_kind = 'claim' THEN DELETE FROM public.seo_page_claims WHERE id = p_link_id;
  ELSIF p_kind = 'market' THEN DELETE FROM public.seo_page_markets WHERE id = p_link_id;
  ELSIF p_kind = 'service' THEN DELETE FROM public.seo_page_services WHERE id = p_link_id;
  ELSIF p_kind = 'fee' THEN DELETE FROM public.seo_fee_refs WHERE id = p_link_id;
  ELSE RAISE EXCEPTION 'Unknown link kind %', p_kind;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.seo_fee_ref_add(
  p_page_id uuid, p_module_id uuid, p_service_fee_id uuid, p_usage_key text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp
AS $$
DECLARE ref_id uuid;
BEGIN
  IF NOT private.seo_can_write() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  INSERT INTO public.seo_fee_refs (page_id, module_id, service_fee_id, usage_key)
  VALUES (p_page_id, p_module_id, p_service_fee_id, coalesce(p_usage_key, 'primary'))
  RETURNING id INTO ref_id;
  RETURN ref_id;
END;
$$;

REVOKE ALL ON FUNCTION public.seo_page_create(text, text, text, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.seo_page_save(uuid, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.seo_claim_save(uuid, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.seo_market_save(uuid, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.seo_page_link(text, uuid, uuid, text, boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.seo_page_unlink(text, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.seo_fee_ref_add(uuid, uuid, uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.seo_page_publishable(uuid) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.seo_page_create(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seo_page_save(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seo_claim_save(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seo_market_save(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seo_page_link(text, uuid, uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seo_page_unlink(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seo_fee_ref_add(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seo_page_publishable(uuid) TO authenticated;
