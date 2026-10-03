-- Controlled Care reference domains, held once in the database so the server
-- can refuse a value the interface would never have offered.
CREATE TABLE IF NOT EXISTS public.care_states (
  code text PRIMARY KEY,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_lgas (
  code text PRIMARY KEY,
  state_code text NOT NULL REFERENCES public.care_states(code) ON DELETE RESTRICT,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_lgas_state_idx ON public.care_lgas (state_code);

CREATE TABLE IF NOT EXISTS public.care_sex_terms (
  code text PRIMARY KEY,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.care_relationship_terms (
  code text PRIMARY KEY,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

GRANT SELECT ON public.care_states TO anon, authenticated;
GRANT SELECT ON public.care_lgas TO anon, authenticated;
GRANT SELECT ON public.care_sex_terms TO anon, authenticated;
GRANT SELECT ON public.care_relationship_terms TO anon, authenticated;
GRANT ALL ON public.care_states TO service_role;
GRANT ALL ON public.care_lgas TO service_role;
GRANT ALL ON public.care_sex_terms TO service_role;
GRANT ALL ON public.care_relationship_terms TO service_role;

ALTER TABLE public.care_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_lgas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_sex_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_relationship_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reference geography is readable" ON public.care_states;
CREATE POLICY "Reference geography is readable" ON public.care_states FOR SELECT USING (true);
DROP POLICY IF EXISTS "Reference geography is readable" ON public.care_lgas;
CREATE POLICY "Reference geography is readable" ON public.care_lgas FOR SELECT USING (true);
DROP POLICY IF EXISTS "Reference terms are readable" ON public.care_sex_terms;
CREATE POLICY "Reference terms are readable" ON public.care_sex_terms FOR SELECT USING (true);
DROP POLICY IF EXISTS "Reference terms are readable" ON public.care_relationship_terms;
CREATE POLICY "Reference terms are readable" ON public.care_relationship_terms FOR SELECT USING (true);

INSERT INTO public.care_sex_terms (code, label) VALUES
  ('female', 'Female'), ('male', 'Male'), ('intersex', 'Intersex'), ('not_stated', 'Not stated')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label;

-- The relationship list Care already holds, as stable codes.
INSERT INTO public.care_relationship_terms (code, label)
SELECT lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9]+', '_', 'g'), '^_+|_+$', '', 'g')), name
FROM (VALUES
  ('Aunt'), ('Brother'), ('Brother-in-law'), ('Case manager'), ('Cousin'), ('Daughter'),
  ('Daughter-in-law'), ('Employer'), ('Family friend'), ('Father'), ('Father-in-law'),
  ('Friend'), ('Granddaughter'), ('Grandfather'), ('Grandmother'), ('Grandson'),
  ('Guardian'), ('Husband'), ('Mother'), ('Mother-in-law'), ('Neighbour'), ('Nephew'),
  ('Niece'), ('Nurse'), ('Partner'), ('Referring doctor'), ('Sister'), ('Sister-in-law'),
  ('Son'), ('Son-in-law'), ('Spouse'), ('Stepdaughter'), ('Stepfather'), ('Stepmother'),
  ('Stepson'), ('Uncle'), ('Wife'), ('Other')
) AS t(name)
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label;