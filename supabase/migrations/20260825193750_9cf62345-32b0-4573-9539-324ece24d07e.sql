ALTER TABLE public.mu_people
  ADD COLUMN IF NOT EXISTS address_line text,
  ADD COLUMN IF NOT EXISTS address_landmark text,
  ADD COLUMN IF NOT EXISTS address_area text,
  ADD COLUMN IF NOT EXISTS address_source text,
  ADD COLUMN IF NOT EXISTS address_captured_at timestamptz;