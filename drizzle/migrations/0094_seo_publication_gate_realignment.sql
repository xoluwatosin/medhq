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
  quotes_pricing boolean;
BEGIN
  SELECT * INTO page FROM public.seo_pages WHERE id = p_page_id;
  IF NOT FOUND THEN
    RETURN ARRAY['Page not found'];
  END IF;

  IF page.publication_state NOT IN ('ready','published') THEN
    blockers := blockers || 'Publication not ready'::text;
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
    blockers := blockers || 'Required claim not approved'::text;
  END IF;

  SELECT count(*) INTO n
  FROM public.seo_page_modules pm
  JOIN public.seo_modules m ON m.id = pm.module_id
  WHERE pm.page_id = p_page_id AND pm.required AND m.review_state <> 'approved';
  IF n > 0 THEN
    blockers := blockers || 'Required module not approved'::text;
  END IF;

  SELECT count(*) INTO n FROM public.seo_page_markets WHERE page_id = p_page_id;
  IF page.page_type = 'location' OR n > 0 THEN
    SELECT count(*) INTO n
    FROM public.seo_page_markets pmk
    JOIN public.seo_markets mk ON mk.id = pmk.market_id
    WHERE pmk.page_id = p_page_id
      AND mk.market_state IN ('available','established')
      AND mk.safety_state = 'serviceable';
    IF n = 0 THEN
      blockers := blockers || 'Market not serviceable'::text;
    END IF;
  END IF;

  quotes_pricing := page.page_type = 'pricing'
    OR EXISTS (
      SELECT 1 FROM public.seo_page_claims pc JOIN public.seo_claims c ON c.id = pc.claim_id
      WHERE pc.page_id = p_page_id AND pc.required AND c.claim_type = 'pricing')
    OR EXISTS (
      SELECT 1 FROM public.seo_page_modules pm JOIN public.seo_modules m ON m.id = pm.module_id
      WHERE pm.page_id = p_page_id AND pm.required AND m.module_type = 'pricing_logic');

  IF quotes_pricing THEN
    SELECT count(*) INTO n
    FROM public.seo_fee_refs fr
    JOIN public.service_fees sf ON sf.id = fr.service_fee_id
    WHERE sf.state IN ('set','on_request')
      AND (
        fr.page_id = p_page_id
        OR fr.module_id IN (SELECT module_id FROM public.seo_page_modules WHERE page_id = p_page_id AND required)
      );
    IF n = 0 THEN
      blockers := blockers || 'Pricing not governed'::text;
    END IF;
  END IF;

  RETURN blockers;
END;
$$;