ALTER TABLE public.campaign_events ALTER COLUMN campaign_id DROP NOT NULL;
ALTER TABLE public.campaign_events ADD COLUMN IF NOT EXISTS template text;
ALTER TABLE public.campaign_events ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.mu_people(id) ON DELETE SET NULL;
ALTER TABLE public.campaign_events ADD COLUMN IF NOT EXISTS link_url text;
CREATE INDEX IF NOT EXISTS campaign_events_recipient_idx ON public.campaign_events (recipient_email);
CREATE INDEX IF NOT EXISTS campaign_events_template_idx ON public.campaign_events (template);
CREATE INDEX IF NOT EXISTS campaign_events_person_idx ON public.campaign_events (person_id);
CREATE INDEX IF NOT EXISTS campaign_events_created_idx ON public.campaign_events (created_at DESC);