-- A proper offer.
--
-- An offer was a title, a place and a loose rate note. That is a message, not
-- an offer. Terms now travel with it as structured data: pay, hours, basis,
-- who they report to, duties, what we provide, probation and notice. The
-- candidate reads the same terms in their portal that we wrote in the
-- composer, and the contract that follows is built from them.

ALTER TABLE public.mu_offers
  ADD COLUMN IF NOT EXISTS terms jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Sending an offer carries the terms through unchanged.
CREATE OR REPLACE FUNCTION public.mu_send_offer(_payload jsonb, _shifts jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  oid uuid;
  who text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  SELECT coalesce(display_name, email) INTO who FROM public.admin_permissions WHERE user_id = auth.uid();

  INSERT INTO public.mu_offers (
    person_id, opportunity_id, kind, title, location, rate_note, message,
    pattern, start_date, status, expires_at, sent_at, created_by, created_by_name, terms
  ) VALUES (
    (_payload->>'person_id')::uuid,
    NULLIF(_payload->>'opportunity_id','')::uuid,
    coalesce(_payload->>'kind','shift'),
    coalesce(_payload->>'title','Work offer'),
    NULLIF(_payload->>'location',''),
    NULLIF(_payload->>'rate_note',''),
    NULLIF(_payload->>'message',''),
    NULLIF(_payload->>'pattern',''),
    NULLIF(_payload->>'start_date','')::date,
    'sent',
    NULLIF(_payload->>'expires_at','')::timestamptz,
    now(), auth.uid(), who,
    coalesce(_payload->'terms', '{}'::jsonb)
  ) RETURNING id INTO oid;

  INSERT INTO public.mu_offer_shifts (offer_id, slot_date, start_hour, end_hour, location)
  SELECT oid,
         (s->>'slot_date')::date,
         coalesce((s->>'start_hour')::int, 8),
         coalesce((s->>'end_hour')::int, 20),
         NULLIF(s->>'location','')
  FROM jsonb_array_elements(coalesce(_shifts, '[]'::jsonb)) AS s;

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES ((_payload->>'person_id')::uuid, auth.uid(), who, 'offer_sent',
          jsonb_build_object('offer_id', oid, 'kind', coalesce(_payload->>'kind','shift'),
                             'title', coalesce(_payload->>'title','Work offer')));

  RETURN jsonb_build_object('ok', true, 'offer_id', oid);
END;
$function$;

-- The candidate reads the same terms we wrote.
DROP FUNCTION IF EXISTS public.mu_my_offers();

CREATE FUNCTION public.mu_my_offers()
RETURNS TABLE(
  id uuid, kind text, title text, location text, rate_note text, message text, pattern text,
  start_date date, status text, expires_at timestamptz, created_at timestamptz,
  responded_at timestamptz, decline_reason text, terms jsonb, shifts jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT o.id, o.kind, o.title, o.location, o.rate_note, o.message, o.pattern,
         o.start_date, o.status, o.expires_at, o.created_at, o.responded_at, o.decline_reason,
         coalesce(o.terms, '{}'::jsonb),
         coalesce((
           SELECT jsonb_agg(jsonb_build_object('slot_date', s.slot_date, 'start_hour', s.start_hour,
                                               'end_hour', s.end_hour, 'location', s.location)
                            ORDER BY s.slot_date)
           FROM public.mu_offer_shifts s WHERE s.offer_id = o.id
         ), '[]'::jsonb)
  FROM public.mu_offers o
  WHERE o.person_id = public.mu_my_person_id() AND o.status <> 'draft'
  ORDER BY o.created_at DESC
$function$;

GRANT EXECUTE ON FUNCTION public.mu_my_offers() TO authenticated;
