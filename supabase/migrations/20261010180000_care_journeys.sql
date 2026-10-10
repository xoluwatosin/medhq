-- Build step 4 (second part): location levels 3 and 4.
--   care_journeys        a worker's trip to a visit, from "I'm on my way" until
--                        check-in (or until they stop it). Tracking happens only
--                        inside a journey: never off duty, never between trips.
--   care_journey_points  positions sent by the phone during a journey, deleted
--                        after 90 days by a nightly job. Check-in and check-out
--                        locations stay on the visit record.
--   care_live_map        for coordinators: everyone travelling now with their
--                        last position, visits in progress, open emergencies.
-- (docs/care-platform/apps-and-operations-plan.md, section 6; build order
-- step 4. Retention of 90 days set on 10 October 2026.)
--
-- Additive: new tables and functions, one change to check-in (it closes the
-- journey for that visit), and one nightly cron job when pg_cron is present.

CREATE TABLE IF NOT EXISTS public.care_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE RESTRICT,
  visit_id uuid NOT NULL REFERENCES public.care_visits(id) ON DELETE RESTRICT,
  client_event_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  end_reason text CHECK (end_reason IS NULL OR end_reason IN ('checked_in','stopped','visit_closed','timed_out')),
  last_lat numeric(9,6),
  last_lng numeric(9,6),
  last_accuracy_m integer,
  last_at timestamptz,
  UNIQUE (person_id, client_event_id),
  CHECK ((ended_at IS NULL) = (end_reason IS NULL))
);
-- One open journey per worker.
CREATE UNIQUE INDEX IF NOT EXISTS care_journeys_open_idx ON public.care_journeys(person_id) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS public.care_journey_points (
  journey_id uuid NOT NULL REFERENCES public.care_journeys(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL,
  lat numeric(9,6) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng numeric(9,6) NOT NULL CHECK (lng BETWEEN -180 AND 180),
  accuracy_m integer,
  speed_mps numeric(6,2),
  heading smallint,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (journey_id, recorded_at)
);
CREATE INDEX IF NOT EXISTS care_journey_points_age_idx ON public.care_journey_points(recorded_at);

REVOKE ALL ON public.care_journeys, public.care_journey_points FROM anon, authenticated;
GRANT SELECT ON public.care_journeys, public.care_journey_points TO authenticated;
GRANT ALL ON public.care_journeys, public.care_journey_points TO service_role;
ALTER TABLE public.care_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_journey_points ENABLE ROW LEVEL SECURITY;

DO $policies$
DECLARE _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['care_journeys','care_journey_points'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                    AND tablename = _t AND policyname = 'Care staff read schedule') THEN
      EXECUTE format(
        'CREATE POLICY "Care staff read schedule" ON public.%I FOR SELECT TO authenticated
           USING (private.care_clinical_ok()
                  OR (private.has_role(auth.uid(), ''admin''::app_role)
                      AND private.has_admin_permission(auth.uid(), ''care_coordinator'')))', _t);
    END IF;
  END LOOP;
END
$policies$;

-- ---------------------------------------------------------------- worker
-- "I'm on my way": opens a journey to one of the worker's own visits, from
-- three hours before it starts until it ends. A retried tap returns the same
-- journey. Starting a new journey closes any other the worker left open.
CREATE OR REPLACE FUNCTION public.care_journey_start(_visit_id uuid, _client_event_id uuid,
  _lat numeric DEFAULT NULL, _lng numeric DEFAULT NULL, _accuracy_m integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _me uuid := public.mu_my_person_id(); _v public.care_visits%ROWTYPE; _j public.care_journeys%ROWTYPE;
BEGIN
  IF _me IS NULL OR NOT private.care_worker_ok(_me) THEN
    RAISE EXCEPTION 'You cannot use the workforce app as a care worker';
  END IF;
  IF _client_event_id IS NULL THEN RAISE EXCEPTION 'A journey needs its device event id'; END IF;
  SELECT * INTO _j FROM public.care_journeys WHERE person_id = _me AND client_event_id = _client_event_id;
  IF FOUND THEN
    RETURN jsonb_build_object('id', _j.id, 'visit_id', _j.visit_id, 'started_at', _j.started_at, 'ended_at', _j.ended_at);
  END IF;
  SELECT * INTO _v FROM public.care_visits WHERE id = _visit_id;
  IF NOT FOUND OR _v.person_id IS DISTINCT FROM _me THEN RAISE EXCEPTION 'That visit is not yours'; END IF;
  IF _v.status <> 'scheduled' THEN RAISE EXCEPTION 'That visit has already started or closed'; END IF;
  IF now() < _v.scheduled_start - interval '3 hours' OR now() > _v.scheduled_end THEN
    RAISE EXCEPTION 'You can start the journey from three hours before the visit';
  END IF;

  UPDATE public.care_journeys SET ended_at = now(), end_reason = 'stopped'
   WHERE person_id = _me AND ended_at IS NULL;
  INSERT INTO public.care_journeys (person_id, visit_id, client_event_id, last_lat, last_lng, last_accuracy_m, last_at)
  VALUES (_me, _visit_id, _client_event_id,
          CASE WHEN _lat BETWEEN -90 AND 90 AND _lng BETWEEN -180 AND 180 THEN _lat END,
          CASE WHEN _lat BETWEEN -90 AND 90 AND _lng BETWEEN -180 AND 180 THEN _lng END,
          _accuracy_m, CASE WHEN _lat IS NOT NULL AND _lng IS NOT NULL THEN now() END)
  RETURNING * INTO _j;
  IF _j.last_lat IS NOT NULL THEN
    INSERT INTO public.care_journey_points (journey_id, recorded_at, lat, lng, accuracy_m)
    VALUES (_j.id, now(), _j.last_lat, _j.last_lng, _accuracy_m) ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('id', _j.id, 'visit_id', _j.visit_id, 'started_at', _j.started_at, 'ended_at', NULL);
END;
$$;

-- Positions from the phone, sent in batches: [{"at", "lat", "lng", "accuracy_m",
-- "speed_mps", "heading"}]. Only into the worker's own open journey; a point
-- sent twice is kept once; points from the future or before the journey are
-- dropped. Returns whether the journey is still open (the phone stops when not).
CREATE OR REPLACE FUNCTION public.care_journey_points_add(_journey_id uuid, _points jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _me uuid := public.mu_my_person_id(); _j public.care_journeys%ROWTYPE; _n integer; _last record;
BEGIN
  IF _me IS NULL OR NOT private.care_worker_ok(_me) THEN
    RAISE EXCEPTION 'You cannot use the workforce app as a care worker';
  END IF;
  SELECT * INTO _j FROM public.care_journeys WHERE id = _journey_id AND person_id = _me FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That journey is not yours'; END IF;
  IF _j.ended_at IS NOT NULL THEN
    RETURN jsonb_build_object('open', false, 'added', 0);
  END IF;
  -- A journey left running for six hours is closed; the phone stops.
  IF now() > _j.started_at + interval '6 hours' THEN
    UPDATE public.care_journeys SET ended_at = now(), end_reason = 'timed_out' WHERE id = _journey_id;
    RETURN jsonb_build_object('open', false, 'added', 0);
  END IF;
  IF _points IS NULL OR jsonb_typeof(_points) <> 'array' OR jsonb_array_length(_points) > 500 THEN
    RAISE EXCEPTION 'Send up to 500 points at a time';
  END IF;

  INSERT INTO public.care_journey_points (journey_id, recorded_at, lat, lng, accuracy_m, speed_mps, heading)
  SELECT _journey_id, (p->>'at')::timestamptz, (p->>'lat')::numeric, (p->>'lng')::numeric,
         NULLIF(p->>'accuracy_m', '')::numeric::integer, NULLIF(p->>'speed_mps', '')::numeric,
         NULLIF(p->>'heading', '')::numeric::smallint
    FROM jsonb_array_elements(_points) p
   WHERE (p->>'at')::timestamptz BETWEEN _j.started_at - interval '1 minute' AND now() + interval '1 minute'
     AND (p->>'lat')::numeric BETWEEN -90 AND 90 AND (p->>'lng')::numeric BETWEEN -180 AND 180
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS _n = ROW_COUNT;

  SELECT recorded_at, lat, lng, accuracy_m INTO _last FROM public.care_journey_points
   WHERE journey_id = _journey_id ORDER BY recorded_at DESC LIMIT 1;
  IF FOUND AND (_j.last_at IS NULL OR _last.recorded_at > _j.last_at) THEN
    UPDATE public.care_journeys SET last_lat = _last.lat, last_lng = _last.lng,
           last_accuracy_m = _last.accuracy_m, last_at = _last.recorded_at
     WHERE id = _journey_id;
  END IF;
  RETURN jsonb_build_object('open', true, 'added', _n);
END;
$$;

CREATE OR REPLACE FUNCTION public.care_journey_stop(_journey_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  UPDATE public.care_journeys SET ended_at = now(), end_reason = 'stopped'
   WHERE id = _journey_id AND person_id = public.mu_my_person_id() AND ended_at IS NULL;
END;
$$;

-- The caller's open journey, so a reopened app resumes sharing (or not).
CREATE OR REPLACE FUNCTION public.care_my_journey()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT jsonb_build_object('id', j.id, 'visit_id', j.visit_id, 'started_at', j.started_at, 'ended_at', j.ended_at)
    FROM public.care_journeys j
   WHERE j.person_id = public.mu_my_person_id() AND j.ended_at IS NULL
     AND j.started_at > now() - interval '6 hours'
$$;

-- Checking in, or the visit closing, ends the journey to it. A trigger keeps
-- this in one place without touching the check-in function.
CREATE OR REPLACE FUNCTION private.care_journey_close_on_visit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'scheduled' THEN
    UPDATE public.care_journeys
       SET ended_at = now(), end_reason = CASE WHEN NEW.status = 'in_progress' THEN 'checked_in' ELSE 'visit_closed' END
     WHERE visit_id = NEW.id AND ended_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.care_journey_close_on_visit() FROM public, anon, authenticated;

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'care_visits_close_journey'
                  AND tgrelid = 'public.care_visits'::regclass) THEN
    CREATE TRIGGER care_visits_close_journey AFTER UPDATE OF status ON public.care_visits
      FOR EACH ROW EXECUTE FUNCTION private.care_journey_close_on_visit();
  END IF;
END
$trg$;

-- ---------------------------------------------------------------- retention
CREATE OR REPLACE FUNCTION private.care_journey_points_purge()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _n integer;
BEGIN
  DELETE FROM public.care_journey_points WHERE recorded_at < now() - interval '90 days';
  GET DIAGNOSTICS _n = ROW_COUNT;
  -- Journeys keep their start and end; their last position goes with the route.
  UPDATE public.care_journeys SET last_lat = NULL, last_lng = NULL, last_accuracy_m = NULL
   WHERE started_at < now() - interval '90 days' AND last_lat IS NOT NULL;
  RETURN _n;
END;
$$;
REVOKE ALL ON FUNCTION private.care_journey_points_purge() FROM public, anon, authenticated;

DO $cron$
DECLARE _have boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = $1)' INTO _have USING 'care-journey-purge';
    IF NOT _have THEN
      PERFORM cron.schedule('care-journey-purge', '20 3 * * *', 'select private.care_journey_points_purge();');
    END IF;
  END IF;
END
$cron$;

-- ---------------------------------------------------------------- live map
-- For coordinators and clinical staff, now:
--   travelling  open journeys with the worker's last position and the home
--               they are heading to;
--   on_visit    visits in progress with where the worker checked in;
--   emergencies unresolved, with a location where the phone gave one.
CREATE OR REPLACE FUNCTION public.care_live_map()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NOT private.care_schedule_ok() THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'at', now(),
    'travelling', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'journey_id', j.id, 'person_id', j.person_id, 'person_name', p.full_name,
               'started_at', j.started_at, 'lat', j.last_lat, 'lng', j.last_lng,
               'accuracy_m', j.last_accuracy_m, 'last_at', j.last_at,
               'visit_id', v.id, 'scheduled_start', v.scheduled_start,
               'client_name', COALESCE(NULLIF(c.preferred_name, ''), NULLIF(c.first_name, ''), c.full_name),
               'address', v.expected_address, 'dest_lat', v.expected_lat, 'dest_lng', v.expected_lng)
             ORDER BY v.scheduled_start)
        FROM public.care_journeys j
        JOIN public.mu_people p ON p.id = j.person_id
        JOIN public.care_visits v ON v.id = j.visit_id
        JOIN public.clients c ON c.id = v.client_id
       WHERE j.ended_at IS NULL AND j.started_at > now() - interval '6 hours'), '[]'::jsonb),
    'on_visit', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'visit_id', v.id, 'person_id', v.person_id, 'person_name', p.full_name,
               'client_name', COALESCE(NULLIF(c.preferred_name, ''), NULLIF(c.first_name, ''), c.full_name),
               'address', v.expected_address, 'check_in_at', v.check_in_at, 'scheduled_end', v.scheduled_end,
               'lat', COALESCE(v.check_in_lat, v.expected_lat), 'lng', COALESCE(v.check_in_lng, v.expected_lng),
               'overdue', now() > v.scheduled_end + interval '15 minutes')
             ORDER BY v.scheduled_end)
        FROM public.care_visits v
        JOIN public.mu_people p ON p.id = v.person_id
        JOIN public.clients c ON c.id = v.client_id
       WHERE v.status = 'in_progress'), '[]'::jsonb),
    'emergencies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', a.id, 'person_name', p.full_name, 'raised_at', a.raised_at, 'status', a.status,
               'lat', a.lat, 'lng', a.lng, 'note', a.note) ORDER BY a.raised_at DESC)
        FROM public.care_worker_alerts a JOIN public.mu_people p ON p.id = a.person_id
       WHERE a.status <> 'resolved'), '[]'::jsonb));
END;
$$;

-- One journey's route, for a coordinator looking into a late arrival.
CREATE OR REPLACE FUNCTION public.care_journey_route(_journey_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NOT private.care_schedule_ok() THEN RETURN NULL; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('at', recorded_at, 'lat', lat, 'lng', lng, 'accuracy_m', accuracy_m)
                     ORDER BY recorded_at)
      FROM public.care_journey_points WHERE journey_id = _journey_id), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.care_journey_start(uuid, uuid, numeric, numeric, integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_journey_points_add(uuid, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_journey_stop(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_my_journey() FROM public, anon;
REVOKE ALL ON FUNCTION public.care_live_map() FROM public, anon;
REVOKE ALL ON FUNCTION public.care_journey_route(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.care_journey_start(uuid, uuid, numeric, numeric, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_journey_points_add(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_journey_stop(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_my_journey() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_live_map() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_journey_route(uuid) TO authenticated, service_role;
