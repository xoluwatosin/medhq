CREATE TABLE IF NOT EXISTS public.mu_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id uuid NOT NULL,
  person_id uuid,
  channel text NOT NULL DEFAULT 'email',
  destination text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.mu_verifications TO service_role;
ALTER TABLE public.mu_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages verification codes"
  ON public.mu_verifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS mu_verifications_user_idx
  ON public.mu_verifications (auth_user_id, created_at DESC);

ALTER TABLE public.mu_people
  ADD COLUMN IF NOT EXISTS contact_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_source text;