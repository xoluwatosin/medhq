ALTER TABLE public.matchmaker_opportunities
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'opportunity',
  ADD COLUMN IF NOT EXISTS brief text,
  ADD COLUMN IF NOT EXISTS request_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS client_notes text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS start_asap boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS criteria_edited_by_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_matched_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_match_count integer;

ALTER TABLE public.matchmaker_opportunities
  DROP CONSTRAINT IF EXISTS matchmaker_opportunities_kind_check;
ALTER TABLE public.matchmaker_opportunities
  ADD CONSTRAINT matchmaker_opportunities_kind_check CHECK (kind IN ('opportunity','request'));

ALTER TABLE public.matchmaker_opportunities
  DROP CONSTRAINT IF EXISTS matchmaker_opportunities_request_status_check;
ALTER TABLE public.matchmaker_opportunities
  ADD CONSTRAINT matchmaker_opportunities_request_status_check
  CHECK (request_status IN ('draft','ready','matched','closed'));

CREATE INDEX IF NOT EXISTS matchmaker_opportunities_kind_idx
  ON public.matchmaker_opportunities (kind, created_at DESC);

DROP POLICY IF EXISTS "Public can view open or closed opportunities" ON public.matchmaker_opportunities;
CREATE POLICY "Public can view open or closed opportunities"
  ON public.matchmaker_opportunities
  FOR SELECT
  TO public
  USING (kind = 'opportunity' AND status = ANY (ARRAY['open'::text, 'closed'::text]));