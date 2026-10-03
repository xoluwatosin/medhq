ALTER TABLE public.mu_cv_parses
  ADD COLUMN IF NOT EXISTS extraction jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS not_found text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS chunks integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS text_chars integer;

CREATE INDEX IF NOT EXISTS mu_cv_parses_extraction_gin ON public.mu_cv_parses USING gin (extraction);
CREATE INDEX IF NOT EXISTS mu_cv_parses_person_created ON public.mu_cv_parses (person_id, created_at DESC);

-- The dated things a sweep can chase, pulled out of the blob for querying.
CREATE OR REPLACE VIEW public.mu_cv_expiries AS
  SELECT p.id AS parse_id,
         p.person_id,
         p.document_id,
         p.created_at,
         'certification'::text AS kind,
         c->>'name' AS name,
         c->>'issuer' AS issuer,
         nullif(c->>'expires_at', '')::date AS expires_at,
         (c->>'confidence')::numeric AS confidence,
         c->>'evidence' AS evidence
    FROM public.mu_cv_parses p
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(p.extraction->'certifications', '[]'::jsonb)) c
   WHERE nullif(c->>'expires_at', '') IS NOT NULL
  UNION ALL
  SELECT p.id, p.person_id, p.document_id, p.created_at,
         'licence',
         p.extraction->'licensing'->>'licence_number',
         p.extraction->'licensing'->>'licensing_body',
         nullif(p.extraction->'licensing'->>'expiry_date', '')::date,
         (p.extraction->'licensing'->>'confidence')::numeric,
         p.extraction->'licensing'->>'evidence'
    FROM public.mu_cv_parses p
   WHERE nullif(p.extraction->'licensing'->>'expiry_date', '') IS NOT NULL;

GRANT SELECT ON public.mu_cv_expiries TO authenticated;
GRANT ALL ON public.mu_cv_expiries TO service_role;