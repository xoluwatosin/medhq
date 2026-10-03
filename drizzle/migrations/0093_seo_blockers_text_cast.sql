-- Blocker literals must be cast to text; an untyped literal is read as an array.
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
    blockers := blockers || 'Publication not ready'::text;
  END IF;

  IF page.evidence_state <> 'sufficient' THEN
    blockers := blockers || 'Missing evidence'::text;
  END IF;

  IF page.clinical_requirement = 'required'
     AND (page.clinical_reviewed_at IS NULL OR page.clinical_reviewed_by IS NULL) THEN
    blockers := blockers || 'Clinical review required'::text;
  END IF;

  SELECT count(*) INTO n
  FROM public.seo_page_modules pm
  JOIN public.seo_modules m ON m.id = pm.module_id
  WHERE pm.page_id = p_page_id AND pm.required AND m.requires_clinical_review
    AND (m.clinical_reviewed_at IS NULL OR m.clinical_reviewed_by IS NULL);
  IF n > 0 THEN
    blockers := blockers || 'Module clinical review required'::text;
  END IF;

  SELECT count(*) INTO n
  FROM public.seo_page_claims pc
  JOIN public.seo_claims c ON c.id = pc.claim_id
  WHERE pc.page_id = p_page_id AND pc.required AND c.requires_clinical_review
    AND (c.clinical_reviewed_at IS NULL OR c.clinical_reviewed_by IS NULL);
  IF n > 0 THEN
    blockers := blockers || 'Claim clinical review required'::text;
  END IF;

  IF page.clinical_requirement IS NULL THEN
    SELECT
      (SELECT count(*) FROM public.seo_page_modules pm JOIN public.seo_modules m ON m.id = pm.module_id
        WHERE pm.page_id = p_page_id AND pm.required AND m.requires_clinical_review)
      + (SELECT count(*) FROM public.seo_page_claims pc JOIN public.seo_claims c ON c.id = pc.claim_id
        WHERE pc.page_id = p_page_id AND pc.required AND c.requires_clinical_review)
      INTO clinical_components;
    IF clinical_components > 0 THEN
      blockers := blockers || 'Clinical review decision outstanding'::text;
    END IF;
  END IF;

  SELECT count(*) INTO n
  FROM public.seo_page_claims pc
  JOIN public.seo_claims c ON c.id = pc.claim_id
  WHERE pc.page_id = p_page_id
    AND pc.required
    AND public.seo_claim_effective_state(c.state, c.valid_from, c.valid_until) <> 'approved';
  IF n > 0 THEN
    blockers := blockers || 'Required claim stale or unapproved'::text;
  END IF;

  SELECT count(*) INTO n
  FROM public.seo_page_modules pm
  JOIN public.seo_modules m ON m.id = pm.module_id
  WHERE pm.page_id = p_page_id AND pm.required AND m.review_state <> 'approved';
  IF n > 0 THEN
    blockers := blockers || 'Required module not approved'::text;
  END IF;

  IF page.page_type = 'location' THEN
    SELECT count(*) INTO n FROM public.seo_page_markets WHERE page_id = p_page_id;
    IF n = 0 THEN
      blockers := blockers || 'Market not serviceable'::text;
    ELSE
      SELECT count(*) INTO n
      FROM public.seo_page_markets pmk
      JOIN public.seo_markets mk ON mk.id = pmk.market_id
      WHERE pmk.page_id = p_page_id
        AND mk.market_state IN ('available','established')
        AND mk.safety_state = 'serviceable'
        AND pmk.local_evidence <> '{}'::jsonb;
      IF n = 0 THEN
        blockers := blockers || 'Market not serviceable'::text;
      END IF;
    END IF;
  END IF;

  RETURN blockers;
END;
$$;
