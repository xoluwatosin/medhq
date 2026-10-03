ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS preheader text,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'marketing';