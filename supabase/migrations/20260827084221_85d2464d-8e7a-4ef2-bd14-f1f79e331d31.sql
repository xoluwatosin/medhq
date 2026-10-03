-- 1. Campaign truthfulness -------------------------------------------------
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS tracking_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS total_sent integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.campaigns.tracking_enabled IS
  'False for campaigns sent before open/click tracking was switched on. The dashboard shows "not tracked" rather than a misleading zero.';

CREATE OR REPLACE FUNCTION public.campaign_sync_stats(_campaign_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.campaigns c
     SET total_sent      = s.sent,
         total_delivered = s.delivered,
         total_opened    = s.opened,
         total_clicked   = s.clicked,
         total_bounced   = s.bounced
    FROM (
      SELECT count(DISTINCT recipient_email) FILTER (WHERE event_type = 'sent')      AS sent,
             count(DISTINCT recipient_email) FILTER (WHERE event_type = 'delivered') AS delivered,
             count(DISTINCT recipient_email) FILTER (WHERE event_type = 'opened')    AS opened,
             count(DISTINCT recipient_email) FILTER (WHERE event_type = 'clicked')   AS clicked,
             count(DISTINCT recipient_email) FILTER (WHERE event_type IN ('bounced', 'complained')) AS bounced
        FROM public.campaign_events
       WHERE campaign_id = _campaign_id
    ) s
   WHERE c.id = _campaign_id;
$$;

REVOKE ALL ON FUNCTION public.campaign_sync_stats(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.campaign_sync_stats(uuid) TO service_role, authenticated;

-- 2. Invites and candidate records stay in step -----------------------------
CREATE OR REPLACE FUNCTION public.claim_invites_link_person()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.person_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT p.id INTO NEW.person_id
      FROM public.mu_people p
     WHERE lower(p.email) = lower(NEW.email)
     ORDER BY p.created_at
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS claim_invites_link_person ON public.claim_invites;
CREATE TRIGGER claim_invites_link_person
  BEFORE INSERT OR UPDATE ON public.claim_invites
  FOR EACH ROW EXECUTE FUNCTION public.claim_invites_link_person();

CREATE OR REPLACE FUNCTION public.claim_invites_stamp_invited()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.person_id IS NOT NULL AND NEW.sent_at IS NOT NULL THEN
    UPDATE public.mu_people
       SET invited_at = least(coalesce(invited_at, NEW.sent_at), NEW.sent_at)
     WHERE id = NEW.person_id
       AND (invited_at IS NULL OR invited_at > NEW.sent_at);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS claim_invites_stamp_invited ON public.claim_invites;
CREATE TRIGGER claim_invites_stamp_invited
  AFTER INSERT OR UPDATE OF sent_at, person_id ON public.claim_invites
  FOR EACH ROW EXECUTE FUNCTION public.claim_invites_stamp_invited();

CREATE OR REPLACE FUNCTION public.mu_people_claim_writeback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- A new record adopts any invite already sent to that address.
  IF TG_OP = 'INSERT' AND NEW.email IS NOT NULL THEN
    UPDATE public.claim_invites
       SET person_id = NEW.id
     WHERE person_id IS NULL AND lower(email) = lower(NEW.email);
  END IF;

  IF NEW.claimed_at IS NOT NULL THEN
    UPDATE public.claim_invites
       SET claimed_at = coalesce(claimed_at, NEW.claimed_at)
     WHERE claimed_at IS NULL
       AND (person_id = NEW.id
            OR (NEW.email IS NOT NULL AND lower(email) = lower(NEW.email)));
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS mu_people_claim_writeback ON public.mu_people;
CREATE TRIGGER mu_people_claim_writeback
  AFTER INSERT OR UPDATE OF claimed_at, email ON public.mu_people
  FOR EACH ROW EXECUTE FUNCTION public.mu_people_claim_writeback();

-- 3. Sign-up failures are recorded, not guessed at ---------------------------
CREATE TABLE IF NOT EXISTS public.signup_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  reason text NOT NULL,
  detail text,
  track text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.signup_failures TO authenticated;
GRANT INSERT ON public.signup_failures TO anon, authenticated;
GRANT ALL ON public.signup_failures TO service_role;

ALTER TABLE public.signup_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read sign-up failures"
  ON public.signup_failures FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can record a sign-up failure"
  ON public.signup_failures FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS signup_failures_created_idx ON public.signup_failures (created_at DESC);