-- ============================================================
-- Offers, engagements and leave.
-- Availability stays the candidate's own answer; bookings and
-- leave are derived on top of it, never written over it.
-- ============================================================

-- 1. Hour helpers -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mu_block_hours(_keys text[])
RETURNS int[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _keys IS NULL OR array_length(_keys, 1) IS NULL
      THEN ARRAY(SELECT generate_series(0, 23))
    ELSE ARRAY(
      SELECT DISTINCT h FROM (
        SELECT unnest(
          CASE k
            WHEN 'morning'   THEN ARRAY[7,8,9,10,11,12]
            WHEN 'afternoon' THEN ARRAY[13,14,15,16,17,18]
            WHEN 'evening'   THEN ARRAY[19,20,21,22]
            WHEN 'night'     THEN ARRAY[23,0,1,2,3,4,5,6]
            ELSE ARRAY[]::int[]
          END
        ) AS h
        FROM unnest(_keys) AS k
      ) s ORDER BY h)
  END
$$;

CREATE OR REPLACE FUNCTION public.mu_hours_of(_blocks jsonb)
RETURNS int[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(
    ARRAY(
      SELECT DISTINCT v::int
      FROM jsonb_each(coalesce(_blocks, '{}'::jsonb)) AS e(key, value),
           jsonb_array_elements_text(
             CASE WHEN jsonb_typeof(e.value) = 'array' THEN e.value ELSE '[]'::jsonb END
           ) AS v
      ORDER BY 1
    ),
    ARRAY[]::int[]
  )
$$;

-- Hours covered by a shift that may run past midnight.
CREATE OR REPLACE FUNCTION public.mu_hour_span(_start int, _end int)
RETURNS int[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _start IS NULL OR _end IS NULL OR _start = _end
      THEN ARRAY(SELECT generate_series(0, 23))
    WHEN _end > _start
      THEN ARRAY(SELECT generate_series(_start, _end - 1))
    ELSE ARRAY(SELECT generate_series(_start, 23))
         || ARRAY(SELECT generate_series(0, _end - 1))
  END
$$;

-- 2. Offers -------------------------------------------------------------

CREATE TABLE public.mu_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.matchmaker_opportunities(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'shift' CHECK (kind IN ('shift', 'role')),
  title text NOT NULL,
  location text,
  rate_note text,
  message text,
  pattern text,
  start_date date,
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('draft','sent','viewed','accepted','declined','withdrawn','expired')),
  expires_at timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,
  decline_reason text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_offers TO authenticated;
GRANT ALL ON public.mu_offers TO service_role;
ALTER TABLE public.mu_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage offers" ON public.mu_offers
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Candidates read own offers" ON public.mu_offers
  FOR SELECT TO authenticated
  USING (person_id = public.mu_my_person_id() AND status <> 'draft');

CREATE INDEX mu_offers_person_idx ON public.mu_offers (person_id, status);
CREATE INDEX mu_offers_opportunity_idx ON public.mu_offers (opportunity_id);

CREATE TABLE public.mu_offer_shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id uuid NOT NULL REFERENCES public.mu_offers(id) ON DELETE CASCADE,
  slot_date date NOT NULL,
  start_hour int NOT NULL DEFAULT 8 CHECK (start_hour BETWEEN 0 AND 23),
  end_hour int NOT NULL DEFAULT 20 CHECK (end_hour BETWEEN 0 AND 23),
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_offer_shifts TO authenticated;
GRANT ALL ON public.mu_offer_shifts TO service_role;
ALTER TABLE public.mu_offer_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage offer shifts" ON public.mu_offer_shifts
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Candidates read own offer shifts" ON public.mu_offer_shifts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mu_offers o
    WHERE o.id = offer_id AND o.person_id = public.mu_my_person_id() AND o.status <> 'draft'
  ));

CREATE INDEX mu_offer_shifts_offer_idx ON public.mu_offer_shifts (offer_id, slot_date);

-- 3. Engagements --------------------------------------------------------

CREATE TABLE public.mu_engagements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.matchmaker_opportunities(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES public.mu_offers(id) ON DELETE SET NULL,
  title text NOT NULL,
  pattern text,
  location text,
  rate_note text,
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  notes text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_engagements TO authenticated;
GRANT ALL ON public.mu_engagements TO service_role;
ALTER TABLE public.mu_engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage engagements" ON public.mu_engagements
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Candidates read own engagements" ON public.mu_engagements
  FOR SELECT TO authenticated
  USING (person_id = public.mu_my_person_id());

CREATE INDEX mu_engagements_person_idx ON public.mu_engagements (person_id, status);

-- 4. Leave --------------------------------------------------------------

CREATE TABLE public.mu_leave_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  engagement_id uuid REFERENCES public.mu_engagements(id) ON DELETE SET NULL,
  from_date date NOT NULL,
  to_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','declined','withdrawn')),
  decision_note text,
  decided_by uuid,
  decided_by_name text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_leave_requests TO authenticated;
GRANT ALL ON public.mu_leave_requests TO service_role;
ALTER TABLE public.mu_leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage leave" ON public.mu_leave_requests
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Candidates read own leave" ON public.mu_leave_requests
  FOR SELECT TO authenticated
  USING (person_id = public.mu_my_person_id());

CREATE INDEX mu_leave_person_idx ON public.mu_leave_requests (person_id, status);

CREATE TRIGGER mu_offers_touch BEFORE UPDATE ON public.mu_offers
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();
CREATE TRIGGER mu_engagements_touch BEFORE UPDATE ON public.mu_engagements
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();
CREATE TRIGGER mu_leave_touch BEFORE UPDATE ON public.mu_leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- 5. System blocks: derived, never stored ------------------------------

CREATE OR REPLACE FUNCTION public.mu_system_blocks(_person_id uuid, _from date, _to date)
RETURNS TABLE(slot_date date, hours int[], reason text, label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.slot_date,
         public.mu_hour_span(s.start_hour, s.end_hour) AS hours,
         'booked'::text AS reason,
         o.title AS label
  FROM public.mu_offer_shifts s
  JOIN public.mu_offers o ON o.id = s.offer_id
  WHERE o.person_id = _person_id
    AND o.status = 'accepted'
    AND s.slot_date BETWEEN _from AND _to
  UNION ALL
  SELECT d::date,
         ARRAY(SELECT generate_series(0, 23)),
         'leave'::text,
         coalesce(l.reason, 'Approved leave')
  FROM public.mu_leave_requests l,
       LATERAL generate_series(greatest(l.from_date, _from), least(l.to_date, _to), interval '1 day') AS d
  WHERE l.person_id = _person_id
    AND l.status = 'approved'
    AND l.from_date <= _to AND l.to_date >= _from
$$;

REVOKE ALL ON FUNCTION public.mu_system_blocks(uuid, date, date) FROM anon;

-- 6. Who is free --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mu_available_people(
  _from date,
  _to date,
  _blocks text[] DEFAULT NULL,
  _profession text DEFAULT NULL,
  _state text DEFAULT NULL,
  _lga text DEFAULT NULL,
  _limit int DEFAULT 100
)
RETURNS TABLE(
  person_id uuid,
  full_name text,
  profession text,
  state text,
  lga text,
  years_experience int,
  verification_state text,
  availability text,
  free_days int,
  busy_days int,
  free_dates date[],
  last_availability_update timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  want int[] := public.mu_block_hours(_blocks);
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH people AS (
    SELECT p.* FROM public.mu_people p
    WHERE (_profession IS NULL OR p.profession = _profession)
      AND (_state IS NULL OR p.state = _state)
      AND (_lga IS NULL OR p.lga = _lga)
  ),
  dates AS (
    SELECT d::date AS slot_date FROM generate_series(_from, _to, interval '1 day') AS d
  ),
  resolved AS (
    SELECT pe.id AS pid,
           dt.slot_date,
           COALESCE(
             (SELECT public.mu_hours_of(ad.blocks) FROM public.mu_availability_days ad
               WHERE ad.person_id = pe.id AND ad.slot_date = dt.slot_date),
             (SELECT public.mu_hours_of(ar.blocks) FROM public.mu_availability_recurrence ar
               WHERE ar.person_id = pe.id AND ar.active
                 AND ar.weekday = (EXTRACT(isodow FROM dt.slot_date)::int - 1))
           ) AS said_hours,
           EXISTS (
             SELECT 1 FROM public.mu_availability_days ad2
              WHERE ad2.person_id = pe.id AND ad2.slot_date = dt.slot_date
           ) OR EXISTS (
             SELECT 1 FROM public.mu_availability_recurrence ar2
              WHERE ar2.person_id = pe.id AND ar2.active
                AND ar2.weekday = (EXTRACT(isodow FROM dt.slot_date)::int - 1)
           ) AS said,
           COALESCE(
             (SELECT array_agg(DISTINCT h)
                FROM public.mu_system_blocks(pe.id, dt.slot_date, dt.slot_date) sb,
                     LATERAL unnest(sb.hours) AS h),
             ARRAY[]::int[]
           ) AS blocked
    FROM people pe CROSS JOIN dates dt
  ),
  scored AS (
    SELECT r.pid,
           r.slot_date,
           r.said,
           EXISTS (
             SELECT 1 FROM unnest(COALESCE(r.said_hours, ARRAY[]::int[])) AS h
             WHERE h = ANY(want) AND NOT (h = ANY(r.blocked))
           ) AS free
    FROM resolved r
  ),
  agg AS (
    SELECT s.pid,
           count(*) FILTER (WHERE s.free) AS free_days,
           count(*) FILTER (WHERE s.said AND NOT s.free) AS busy_days,
           array_remove(array_agg(CASE WHEN s.free THEN s.slot_date END ORDER BY s.slot_date), NULL) AS free_dates
    FROM scored s GROUP BY s.pid
  )
  SELECT pe.id,
         pe.full_name,
         pe.profession,
         pe.state,
         pe.lga,
         pe.years_experience,
         pe.verification_state,
         CASE WHEN a.free_days > 0 THEN 'available'
              WHEN a.busy_days > 0 THEN 'unavailable'
              ELSE 'unknown' END AS availability,
         a.free_days::int,
         a.busy_days::int,
         a.free_dates,
         pe.last_availability_update
  FROM agg a
  JOIN public.mu_people pe ON pe.id = a.pid
  ORDER BY (a.free_days > 0) DESC,
           a.free_days DESC,
           (pe.last_availability_update IS NULL),
           pe.last_availability_update DESC NULLS LAST,
           pe.full_name
  LIMIT COALESCE(_limit, 100);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_available_people(date, date, text[], text, text, text, int) FROM anon;

-- 7. Freshness ----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mu_availability_freshness(_limit int DEFAULT 200)
RETURNS TABLE(
  person_id uuid,
  full_name text,
  email text,
  profession text,
  last_availability_update timestamptz,
  days_since int,
  claimed boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.email, p.profession, p.last_availability_update,
         CASE WHEN p.last_availability_update IS NULL THEN NULL
              ELSE EXTRACT(day FROM now() - p.last_availability_update)::int END,
         p.claimed_at IS NOT NULL
  FROM public.mu_people p
  WHERE p.last_availability_update IS NULL
     OR p.last_availability_update < now() - interval '14 days'
  ORDER BY (p.last_availability_update IS NOT NULL), p.last_availability_update
  LIMIT COALESCE(_limit, 200);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_availability_freshness(int) FROM anon;

-- 8. Offer lifecycle ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.mu_send_offer(_payload jsonb, _shifts jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    pattern, start_date, status, expires_at, sent_at, created_by, created_by_name
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
    now(), auth.uid(), who
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
$$;

REVOKE ALL ON FUNCTION public.mu_send_offer(jsonb, jsonb) FROM anon;

CREATE OR REPLACE FUNCTION public.mu_withdraw_offer(_offer_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; who text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  SELECT coalesce(display_name, email) INTO who FROM public.admin_permissions WHERE user_id = auth.uid();
  UPDATE public.mu_offers SET status = 'withdrawn', decline_reason = _reason, responded_at = now()
  WHERE id = _offer_id AND status IN ('draft','sent','viewed')
  RETURNING person_id INTO pid;
  IF pid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Offer cannot be withdrawn'); END IF;
  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (pid, auth.uid(), who, 'offer_withdrawn', jsonb_build_object('offer_id', _offer_id, 'reason', _reason));
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_withdraw_offer(uuid, text) FROM anon;

-- Candidate side. Accepting a role opens an engagement; accepting shifts
-- simply books them, and the blocks fall out of mu_system_blocks.
CREATE OR REPLACE FUNCTION public.mu_respond_offer(_offer_id uuid, _action text, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.mu_offers;
  me uuid := public.mu_my_person_id();
  eng uuid;
BEGIN
  SELECT * INTO o FROM public.mu_offers WHERE id = _offer_id;
  IF o.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Offer not found'); END IF;
  IF NOT (o.person_id = me OR private.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'not your offer';
  END IF;

  IF _action = 'view' THEN
    UPDATE public.mu_offers SET status = 'viewed', viewed_at = coalesce(viewed_at, now())
    WHERE id = _offer_id AND status = 'sent';
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF o.status NOT IN ('sent', 'viewed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This offer is no longer open');
  END IF;
  IF o.expires_at IS NOT NULL AND o.expires_at < now() THEN
    UPDATE public.mu_offers SET status = 'expired' WHERE id = _offer_id;
    RETURN jsonb_build_object('ok', false, 'error', 'This offer has expired');
  END IF;

  IF _action = 'accept' THEN
    UPDATE public.mu_offers SET status = 'accepted', responded_at = now() WHERE id = _offer_id;
    IF o.kind = 'role' THEN
      INSERT INTO public.mu_engagements (person_id, opportunity_id, offer_id, title, pattern, location, rate_note, start_date)
      VALUES (o.person_id, o.opportunity_id, o.id, o.title, o.pattern, o.location, o.rate_note,
              coalesce(o.start_date, current_date))
      RETURNING id INTO eng;
      UPDATE public.mu_people SET looking_status = 'placed' WHERE id = o.person_id;
    END IF;
    INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
    VALUES (o.person_id, auth.uid(), NULL, 'offer_accepted',
            jsonb_build_object('offer_id', _offer_id, 'engagement_id', eng, 'kind', o.kind));
    RETURN jsonb_build_object('ok', true, 'engagement_id', eng);
  ELSIF _action = 'decline' THEN
    UPDATE public.mu_offers SET status = 'declined', responded_at = now(), decline_reason = _reason
    WHERE id = _offer_id;
    INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
    VALUES (o.person_id, auth.uid(), NULL, 'offer_declined',
            jsonb_build_object('offer_id', _offer_id, 'reason', _reason));
    RETURN jsonb_build_object('ok', true);
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'Unknown action');
END;
$$;

REVOKE ALL ON FUNCTION public.mu_respond_offer(uuid, text, text) FROM anon;

CREATE OR REPLACE FUNCTION public.mu_my_offers()
RETURNS TABLE(
  id uuid, kind text, title text, location text, rate_note text, message text,
  pattern text, start_date date, status text, expires_at timestamptz,
  created_at timestamptz, responded_at timestamptz, decline_reason text,
  shifts jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.kind, o.title, o.location, o.rate_note, o.message, o.pattern,
         o.start_date, o.status, o.expires_at, o.created_at, o.responded_at, o.decline_reason,
         coalesce((
           SELECT jsonb_agg(jsonb_build_object('slot_date', s.slot_date, 'start_hour', s.start_hour,
                                               'end_hour', s.end_hour, 'location', s.location)
                            ORDER BY s.slot_date)
           FROM public.mu_offer_shifts s WHERE s.offer_id = o.id
         ), '[]'::jsonb)
  FROM public.mu_offers o
  WHERE o.person_id = public.mu_my_person_id() AND o.status <> 'draft'
  ORDER BY o.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.mu_my_offers() FROM anon;

-- 9. Leave lifecycle ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.mu_request_leave(_from date, _to date, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.mu_my_person_id(); eng uuid; lid uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'no profile'; END IF;
  IF _to < _from THEN RETURN jsonb_build_object('ok', false, 'error', 'End date is before the start date'); END IF;
  SELECT id INTO eng FROM public.mu_engagements WHERE person_id = me AND status = 'active' ORDER BY start_date DESC LIMIT 1;
  INSERT INTO public.mu_leave_requests (person_id, engagement_id, from_date, to_date, reason)
  VALUES (me, eng, _from, _to, _reason) RETURNING id INTO lid;
  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (me, auth.uid(), NULL, 'leave_requested',
          jsonb_build_object('leave_id', lid, 'from', _from, 'to', _to));
  RETURN jsonb_build_object('ok', true, 'leave_id', lid);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_request_leave(date, date, text) FROM anon;

CREATE OR REPLACE FUNCTION public.mu_decide_leave(_id uuid, _action text, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; who text; me uuid := public.mu_my_person_id();
BEGIN
  IF _action = 'withdraw' THEN
    UPDATE public.mu_leave_requests SET status = 'withdrawn'
    WHERE id = _id AND person_id = me AND status = 'requested'
    RETURNING person_id INTO pid;
    IF pid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Cannot withdraw'); END IF;
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'admin only'; END IF;
  IF _action NOT IN ('approve', 'decline') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown action');
  END IF;
  SELECT coalesce(display_name, email) INTO who FROM public.admin_permissions WHERE user_id = auth.uid();
  UPDATE public.mu_leave_requests
     SET status = CASE WHEN _action = 'approve' THEN 'approved' ELSE 'declined' END,
         decision_note = _note, decided_by = auth.uid(), decided_by_name = who, decided_at = now()
   WHERE id = _id AND status = 'requested'
  RETURNING person_id INTO pid;
  IF pid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Already decided'); END IF;
  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (pid, auth.uid(), who, 'leave_' || _action || 'd', jsonb_build_object('leave_id', _id, 'note', _note));
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_decide_leave(uuid, text, text) FROM anon;

-- 10. Workforce ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mu_workforce_list()
RETURNS TABLE(
  person_id uuid, full_name text, email text, phone text, profession text,
  engagement_id uuid, title text, pattern text, location text,
  start_date date, end_date date, status text,
  pending_leave int, upcoming_shifts int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'admin only'; END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.email, p.phone, p.profession,
         e.id, e.title, e.pattern, e.location, e.start_date, e.end_date, e.status,
         (SELECT count(*)::int FROM public.mu_leave_requests l
           WHERE l.person_id = p.id AND l.status = 'requested'),
         (SELECT count(*)::int FROM public.mu_offer_shifts s
            JOIN public.mu_offers o ON o.id = s.offer_id
           WHERE o.person_id = p.id AND o.status = 'accepted' AND s.slot_date >= current_date)
  FROM public.mu_engagements e
  JOIN public.mu_people p ON p.id = e.person_id
  ORDER BY (e.status = 'active') DESC, e.start_date DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.mu_workforce_list() FROM anon;

CREATE OR REPLACE FUNCTION public.mu_end_engagement(_id uuid, _end date DEFAULT current_date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; who text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT coalesce(display_name, email) INTO who FROM public.admin_permissions WHERE user_id = auth.uid();
  UPDATE public.mu_engagements SET status = 'ended', end_date = _end
   WHERE id = _id AND status = 'active' RETURNING person_id INTO pid;
  IF pid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not an active engagement'); END IF;
  UPDATE public.mu_people SET looking_status = 'open'
   WHERE id = pid AND NOT EXISTS (
     SELECT 1 FROM public.mu_engagements e2 WHERE e2.person_id = pid AND e2.status = 'active');
  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (pid, auth.uid(), who, 'engagement_ended', jsonb_build_object('engagement_id', _id, 'end_date', _end));
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_end_engagement(uuid, date) FROM anon;