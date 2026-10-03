-- 1. Governed public-pricing attributes on the existing operational fee record.
ALTER TABLE public.service_fees
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS public_label text,
  ADD COLUMN IF NOT EXISTS billing_unit text,
  ADD COLUMN IF NOT EXISTS price_treatment text NOT NULL DEFAULT 'quote',
  ADD COLUMN IF NOT EXISTS public_visibility text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS effective_from date;

ALTER TABLE public.service_fees DROP CONSTRAINT IF EXISTS service_fees_fee_type_check;
ALTER TABLE public.service_fees ADD CONSTRAINT service_fees_fee_type_check
  CHECK (fee_type IN ('monthly','placement','visit','assessment','session','consultation','shift','package'));

ALTER TABLE public.service_fees DROP CONSTRAINT IF EXISTS service_fees_price_treatment_check;
ALTER TABLE public.service_fees ADD CONSTRAINT service_fees_price_treatment_check
  CHECK (price_treatment IN ('fixed','from','quote'));

ALTER TABLE public.service_fees DROP CONSTRAINT IF EXISTS service_fees_public_visibility_check;
ALTER TABLE public.service_fees ADD CONSTRAINT service_fees_public_visibility_check
  CHECK (public_visibility IN ('internal','public'));

-- A publicly shown fee must carry an amount or be explicitly on request, and may never be a quote.
ALTER TABLE public.service_fees DROP CONSTRAINT IF EXISTS service_fees_public_complete_check;
ALTER TABLE public.service_fees ADD CONSTRAINT service_fees_public_complete_check
  CHECK (
    public_visibility = 'internal'
    OR (
      price_treatment IN ('fixed','from')
      AND billing_unit IS NOT NULL
      AND public_label IS NOT NULL
      AND (state = 'on_request' OR (state = 'set' AND amount_naira IS NOT NULL))
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS service_fees_sku_unique ON public.service_fees (sku) WHERE sku IS NOT NULL;

-- 2. Publication gate: clinical review is no longer a separate dependency, and a
-- quoted price must resolve to a current, publicly visible governed fee.
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
  quotes_pricing boolean;
BEGIN
  SELECT * INTO page FROM public.seo_pages WHERE id = p_page_id;
  IF NOT FOUND THEN
    RETURN ARRAY['Page not found'];
  END IF;

  IF page.publication_state NOT IN ('ready','published') THEN
    blockers := blockers || 'Publication not ready'::text;
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
      AND sf.public_visibility = 'public'
      AND sf.is_current
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

REVOKE ALL ON FUNCTION public.seo_page_blockers(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.seo_page_blockers(uuid) TO authenticated, service_role;

-- 3. Governed write path for public fee registration (admin only).
CREATE OR REPLACE FUNCTION public.seo_public_fee_save(
  p_service_slug text,
  p_sku text,
  p_fee_type text,
  p_public_label text,
  p_amount numeric,
  p_billing_unit text,
  p_price_treatment text,
  p_public_visibility text DEFAULT 'public',
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_service uuid;
  v_id uuid;
BEGIN
  IF NOT private.seo_can_write() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  SELECT id INTO v_service FROM public.services WHERE slug = p_service_slug;
  IF v_service IS NULL THEN
    RAISE EXCEPTION 'Unknown service %', p_service_slug;
  END IF;

  INSERT INTO public.service_fees (
    service_id, fee_type, label, public_label, amount_naira, state,
    billing_unit, price_treatment, public_visibility, sku, notes, is_current
  ) VALUES (
    v_service, p_fee_type, p_public_label, p_public_label, p_amount,
    CASE WHEN p_amount IS NULL THEN 'on_request' ELSE 'set' END,
    p_billing_unit, p_price_treatment, p_public_visibility, p_sku, p_notes, true
  )
  ON CONFLICT (sku) DO UPDATE SET
    service_id = EXCLUDED.service_id,
    fee_type = EXCLUDED.fee_type,
    label = EXCLUDED.label,
    public_label = EXCLUDED.public_label,
    amount_naira = EXCLUDED.amount_naira,
    state = EXCLUDED.state,
    billing_unit = EXCLUDED.billing_unit,
    price_treatment = EXCLUDED.price_treatment,
    public_visibility = EXCLUDED.public_visibility,
    notes = EXCLUDED.notes,
    is_current = true,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.seo_public_fee_save(text,text,text,text,numeric,text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.seo_public_fee_save(text,text,text,text,numeric,text,text,text,text) TO authenticated, service_role;