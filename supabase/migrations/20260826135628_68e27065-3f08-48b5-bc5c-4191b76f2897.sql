-- 1. Remove duplicate 'sent'/'failed' rows, keeping the earliest per recipient/campaign
DELETE FROM public.campaign_events a
USING public.campaign_events b
WHERE a.event_type IN ('sent','failed','delayed','suppressed')
  AND a.id > b.id
  AND a.event_type = b.event_type
  AND a.recipient_email = b.recipient_email
  AND a.campaign_id IS NOT DISTINCT FROM b.campaign_id
  AND a.template IS NOT DISTINCT FROM b.template;

-- 2. Widen the dedupe index so 'sent' can never double-count again
DROP INDEX IF EXISTS uq_campaign_events_dedupe;
CREATE UNIQUE INDEX uq_campaign_events_dedupe
  ON public.campaign_events (campaign_id, recipient_email, event_type)
  WHERE campaign_id IS NOT NULL
    AND event_type = ANY (ARRAY['sent','delivered','opened','clicked','bounced','complained','unsubscribed','failed','delayed','suppressed']);

-- 3. Recompute every campaign's counters from the event table (no row cap)
UPDATE public.campaigns c SET
  total_delivered = s.delivered,
  total_opened    = s.opened,
  total_clicked   = s.clicked,
  total_bounced   = s.bounced
FROM (
  SELECT campaign_id,
    count(DISTINCT recipient_email) FILTER (WHERE event_type='delivered') delivered,
    count(DISTINCT recipient_email) FILTER (WHERE event_type='opened')    opened,
    count(DISTINCT recipient_email) FILTER (WHERE event_type='clicked')   clicked,
    count(DISTINCT recipient_email) FILTER (WHERE event_type='bounced')   bounced
  FROM public.campaign_events WHERE campaign_id IS NOT NULL GROUP BY campaign_id
) s
WHERE c.id = s.campaign_id;