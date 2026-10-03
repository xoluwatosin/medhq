ALTER TABLE public.matchmaker_applications
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS landing_path text;

CREATE INDEX IF NOT EXISTS matchmaker_applications_utm_source_idx ON public.matchmaker_applications (utm_source);
CREATE INDEX IF NOT EXISTS matchmaker_applications_utm_campaign_idx ON public.matchmaker_applications (utm_campaign);