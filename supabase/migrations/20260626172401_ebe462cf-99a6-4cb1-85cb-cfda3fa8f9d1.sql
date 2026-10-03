
ALTER TABLE public.campaign_events
  ADD COLUMN IF NOT EXISTS resend_email_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign ON public.campaign_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_events_resend_id ON public.campaign_events(resend_email_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_events_dedupe
  ON public.campaign_events(campaign_id, recipient_email, event_type)
  WHERE event_type IN ('opened','clicked','bounced','complained','unsubscribed','delivered');

-- Allow service role inserts from webhook (already implicit, but keep policies tidy)
DROP POLICY IF EXISTS "Service role can manage campaign events" ON public.campaign_events;
CREATE POLICY "Service role can manage campaign events"
  ON public.campaign_events FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Suppression list
CREATE TABLE IF NOT EXISTS public.email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  reason text NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_suppressions TO authenticated;
GRANT ALL ON public.email_suppressions TO service_role;

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read suppressions" ON public.email_suppressions;
CREATE POLICY "Admins read suppressions"
  ON public.email_suppressions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role manages suppressions" ON public.email_suppressions;
CREATE POLICY "Service role manages suppressions"
  ON public.email_suppressions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
