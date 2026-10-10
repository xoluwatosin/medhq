-- Build step 3 (database): schedule and visits.
--   care_home_pins        map coordinates and access notes for a client's home.
--   care_roster_patterns  recurring patterns per care episode (weekdays, start,
--                         length), each with a worker or left open, and a flag
--                         for the client's primary carer.
--   care_visits           one scheduled visit or shift, generated from a
--                         pattern or created once, with check-in and check-out
--                         time and location compared with the expected place.
--   care_visit_events     append-only events from the worker's device, replayed
--                         idempotently by client event id.
-- (docs/care-platform/apps-and-operations-plan.md, sections 5, 6 and 8; build
-- order step 3; delivery-architecture.md section 3, visit event.)
--
-- Location levels 1 and 2 only: location is taken at check-in and check-out
-- and nowhere else. A distant or missing location is flagged, never blocked.
-- Overdue checkouts and visits not started are reported by care_visit_alerts.
--
-- Schedulers are care coordinators and clinical staff. A worker sees and acts
-- on only their own visits, and only while the care-worker rule holds.
-- Additive: new tables and functions, plus a visit reference and an episode
-- check on the delivery records from 7.5E (which hold no rows yet).

-- ---------------------------------------------------------------- pins
CREATE TABLE IF NOT EXISTS public.care_home_pins (
  home_id uuid PRIMARY KEY REFERENCES public.care_homes(id) ON DELETE CASCADE,
  lat numeric(9,6) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng numeric(9,6) NOT NULL CHECK (lng BETWEEN -180 AND 180),
  access_notes text CHECK (access_notes IS NULL OR length(access_notes) <= 1000),
  set_by uuid,
  set_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- patterns
CREATE TABLE IF NOT EXISTS public.care_roster_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.care_episodes(id) ON DELETE RESTRICT,
  person_id uuid REFERENCES public.mu_people(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  kind text NOT NULL DEFAULT 'visit' CHECK (kind IN ('visit','shift','day_24h')),
  weekdays smallint[] NOT NULL
    CHECK (cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[]),
  start_time time NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 15 AND 1440),
  valid_from date NOT NULL,
  valid_until date,
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  ended_at timestamptz,
  ended_by uuid,
  end_reason text,
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CHECK (NOT is_primary OR person_id IS NOT NULL),
  CHECK ((status = 'ended') = (ended_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS care_roster_patterns_episode_idx ON public.care_roster_patterns(episode_id, status);

-- ---------------------------------------------------------------- visits
CREATE TABLE IF NOT EXISTS public.care_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.care_episodes(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL,
  pattern_id uuid REFERENCES public.care_roster_patterns(id) ON DELETE RESTRICT,
  person_id uuid REFERENCES public.mu_people(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('visit','shift','day_24h')),
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','in_progress','completed','missed','cancelled')),
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  -- Where the visit is expected, copied when the visit is made.
  expected_address text,
  expected_landmark text,
  expected_lat numeric(9,6),
  expected_lng numeric(9,6),
  check_in_at timestamptz,
  check_in_lat numeric(9,6),
  check_in_lng numeric(9,6),
  check_in_accuracy_m integer,
  check_in_distance_m integer,
  check_out_at timestamptz,
  check_out_lat numeric(9,6),
  check_out_lng numeric(9,6),
  check_out_accuracy_m integer,
  check_out_distance_m integer,
  check_out_note text CHECK (check_out_note IS NULL OR length(check_out_note) <= 2000),
  location_flags text[] NOT NULL DEFAULT '{}',
  closed_at timestamptz,
  closed_by uuid,
  close_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CHECK (scheduled_end > scheduled_start),
  CHECK (status NOT IN ('in_progress','completed') OR (person_id IS NOT NULL AND check_in_at IS NOT NULL)),
  CHECK ((status = 'completed') = (check_out_at IS NOT NULL)),
  CHECK ((status IN ('missed','cancelled')) = (closed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS care_visits_episode_idx ON public.care_visits(episode_id, scheduled_start);
CREATE INDEX IF NOT EXISTS care_visits_person_idx ON public.care_visits(person_id, scheduled_start)
  WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS care_visits_open_idx ON public.care_visits(scheduled_start)
  WHERE status IN ('scheduled','in_progress');
-- Generating twice never makes a second visit for the same slot.
CREATE UNIQUE INDEX IF NOT EXISTS care_visits_pattern_slot_idx
  ON public.care_visits(pattern_id, scheduled_start) WHERE pattern_id IS NOT NULL;

-- ---------------------------------------------------------------- events
CREATE TABLE IF NOT EXISTS public.care_visit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.care_visits(id) ON DELETE RESTRICT,
  client_event_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind ~ '^[a-z][a-z0-9_]{1,63}$'),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  UNIQUE (visit_id, client_event_id)
);

-- Staff read directly; workers read through their functions. No direct writes.
REVOKE ALL ON public.care_home_pins, public.care_roster_patterns, public.care_visits,
  public.care_visit_events FROM anon, authenticated;
GRANT SELECT ON public.care_home_pins, public.care_roster_patterns, public.care_visits,
  public.care_visit_events TO authenticated;
GRANT ALL ON public.care_home_pins, public.care_roster_patterns, public.care_visits,
  public.care_visit_events TO service_role;
ALTER TABLE public.care_home_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_roster_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_visit_events ENABLE ROW LEVEL SECURITY;

DO $policies$
DECLARE _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['care_home_pins','care_roster_patterns','care_visits','care_visit_events'] LOOP
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

-- Events are never edited or deleted.
CREATE OR REPLACE FUNCTION private.care_append_only_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'private'
AS $$
BEGIN
  RAISE EXCEPTION 'Visit events are never edited or deleted';
END;
$$;
REVOKE ALL ON FUNCTION private.care_append_only_guard() FROM public, anon, authenticated;

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'care_visit_events_guard'
                  AND tgrelid = 'public.care_visit_events'::regclass) THEN
    CREATE TRIGGER care_visit_events_guard BEFORE UPDATE OR DELETE ON public.care_visit_events
      FOR EACH ROW EXECUTE FUNCTION private.care_append_only_guard();
  END IF;
END
$guard$;

-- ---------------------------------------------------------------- delivery records link
-- Observations, interventions and goal evidence may name a visit; it must be a
-- real visit on the same episode.
DO $visitfk$
DECLARE _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['care_observations','care_interventions','care_goal_evidence'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = _t || '_visit_fkey') THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (visit_id)
                        REFERENCES public.care_visits(id) ON DELETE RESTRICT', _t, _t || '_visit_fkey');
    END IF;
  END LOOP;
END
$visitfk$;

CREATE OR REPLACE FUNCTION private.care_record_visit_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NEW.visit_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.care_visits WHERE id = NEW.visit_id AND episode_id = NEW.episode_id) THEN
    RAISE EXCEPTION 'That visit is not part of this care episode';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.care_record_visit_check() FROM public, anon, authenticated;

DO $visitchk$
DECLARE _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['care_observations','care_interventions','care_goal_evidence'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = _t || '_visit_check'
                    AND tgrelid = ('public.' || _t)::regclass) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON public.%I
                        FOR EACH ROW EXECUTE FUNCTION private.care_record_visit_check()',
                     _t || '_visit_check', _t);
    END IF;
  END LOOP;
END
$visitchk$;

-- ---------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION private.care_schedule_ok()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$ SELECT private.care_clinical_ok() OR private.care_ops_ok() $$;

-- Straight-line distance in metres.
CREATE OR REPLACE FUNCTION private.care_distance_m(_lat1 numeric, _lng1 numeric, _lat2 numeric, _lng2 numeric)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'private'
AS $$
  SELECT CASE WHEN _lat1 IS NULL OR _lng1 IS NULL OR _lat2 IS NULL OR _lng2 IS NULL THEN NULL
    ELSE round(2 * 6371000 * asin(sqrt(
           power(sin(radians((_lat2 - _lat1)::float8) / 2), 2)
           + cos(radians(_lat1::float8)) * cos(radians(_lat2::float8))
             * power(sin(radians((_lng2 - _lng1)::float8) / 2), 2))))::integer END
$$;

-- Where a client's visits happen: their home, with its pin when one is set.
CREATE OR REPLACE FUNCTION private.care_client_place(_client_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT jsonb_build_object(
           'address', COALESCE(h.address_line, c.address_line),
           'landmark', COALESCE(h.landmark, c.landmark),
           'lat', p.lat, 'lng', p.lng, 'access_notes', p.access_notes)
    FROM public.clients c
    LEFT JOIN public.care_homes h ON h.id = c.home_id
    LEFT JOIN public.care_home_pins p ON p.home_id = h.id
   WHERE c.id = _client_id
$$;

-- A worker can take a visit when they may use the app, are assigned to the
-- episode on that date, and are not already booked at that time.
CREATE OR REPLACE FUNCTION private.care_visit_person_check(
  _episode_id uuid, _person_id uuid, _start timestamptz, _end timestamptz, _except uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _day date := (_start AT TIME ZONE 'Africa/Lagos')::date;
BEGIN
  IF NOT private.care_worker_ok(_person_id) THEN
    RETURN 'This person cannot use the workforce app as a care worker';
  END IF;
  IF NOT EXISTS (
       SELECT 1 FROM public.care_delivery_assignments a
        WHERE a.episode_id = _episode_id AND a.person_id = _person_id
          AND a.status IN ('planned','active')
          AND a.effective_from <= _day AND (a.effective_to IS NULL OR a.effective_to >= _day)) THEN
    RETURN 'This person is not assigned to this care on that date';
  END IF;
  IF EXISTS (
       SELECT 1 FROM public.care_visits v
        WHERE v.person_id = _person_id AND v.status IN ('scheduled','in_progress')
          AND v.id IS DISTINCT FROM _except
          AND v.scheduled_start < _end AND v.scheduled_end > _start) THEN
    RETURN 'This person already has a visit at that time';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.care_visit_json(_v public.care_visits)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT jsonb_build_object(
    'id', _v.id, 'episode_id', _v.episode_id, 'kind', _v.kind,
    'scheduled_start', _v.scheduled_start, 'scheduled_end', _v.scheduled_end,
    'status', _v.status, 'notes', _v.notes,
    'client_name', COALESCE(NULLIF(c.preferred_name, ''), NULLIF(c.first_name, ''), c.full_name),
    'service_code', e.service_code,
    'address', _v.expected_address, 'landmark', _v.expected_landmark,
    'lat', _v.expected_lat, 'lng', _v.expected_lng, 'access_notes', p.access_notes,
    'check_in_at', _v.check_in_at, 'check_out_at', _v.check_out_at,
    'location_flags', to_jsonb(_v.location_flags))
    FROM public.care_episodes e
    JOIN public.clients c ON c.id = e.client_id
    LEFT JOIN public.care_home_pins p ON p.home_id = c.home_id
   WHERE e.id = _v.episode_id
$$;

REVOKE ALL ON FUNCTION private.care_schedule_ok() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.care_distance_m(numeric, numeric, numeric, numeric) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.care_client_place(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.care_visit_person_check(uuid, uuid, timestamptz, timestamptz, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.care_visit_json(public.care_visits) FROM public, anon, authenticated;

-- ---------------------------------------------------------------- scheduling
CREATE OR REPLACE FUNCTION public.care_home_pin_set(_home_id uuid, _lat numeric, _lng numeric, _access_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NOT private.care_schedule_ok() THEN
    RAISE EXCEPTION 'You do not have permission to change the schedule';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.care_homes WHERE id = _home_id) THEN
    RAISE EXCEPTION 'That home does not exist';
  END IF;
  INSERT INTO public.care_home_pins (home_id, lat, lng, access_notes, set_by)
  VALUES (_home_id, _lat, _lng, NULLIF(btrim(COALESCE(_access_notes, '')), ''), auth.uid())
  ON CONFLICT (home_id) DO UPDATE
    SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, access_notes = EXCLUDED.access_notes,
        set_by = EXCLUDED.set_by, set_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.care_roster_pattern_create(_episode_id uuid, _pattern jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  _p jsonb := _pattern;
  _k text;
  _person uuid := NULLIF(_pattern->>'person_id', '')::uuid;
  _primary boolean := COALESCE((_pattern->>'is_primary')::boolean, false);
  _from date := COALESCE(NULLIF(_pattern->>'valid_from', '')::date, current_date);
  _id uuid;
BEGIN
  IF NOT private.care_schedule_ok() THEN
    RAISE EXCEPTION 'You do not have permission to change the schedule';
  END IF;
  IF _p IS NULL OR jsonb_typeof(_p) <> 'object' THEN RAISE EXCEPTION 'A pattern must be an object'; END IF;
  FOR _k IN SELECT jsonb_object_keys(_p) LOOP
    IF NOT _k = ANY (ARRAY['person_id','is_primary','kind','weekdays','start_time','duration_minutes',
                           'valid_from','valid_until','notes']) THEN
      RAISE EXCEPTION 'Unknown pattern field: %', _k;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.care_episodes WHERE id = _episode_id AND status IN ('planned','active','paused')) THEN
    RAISE EXCEPTION 'That care episode is not running';
  END IF;
  IF jsonb_typeof(_p->'weekdays') IS DISTINCT FROM 'array' OR jsonb_array_length(_p->'weekdays') = 0 THEN
    RAISE EXCEPTION 'Choose the days, as numbers from 1 (Monday) to 7 (Sunday)';
  END IF;
  IF NULLIF(_p->>'start_time', '') IS NULL OR NULLIF(_p->>'duration_minutes', '') IS NULL THEN
    RAISE EXCEPTION 'A pattern needs a start time and a length';
  END IF;
  IF _person IS NOT NULL THEN
    IF NOT private.care_worker_ok(_person) THEN
      RAISE EXCEPTION 'This person cannot use the workforce app as a care worker';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.care_delivery_assignments
                    WHERE episode_id = _episode_id AND person_id = _person AND status IN ('planned','active')) THEN
      RAISE EXCEPTION 'This person is not assigned to this care';
    END IF;
  END IF;
  -- One primary carer per episode.
  IF _primary AND EXISTS (SELECT 1 FROM public.care_roster_patterns
                           WHERE episode_id = _episode_id AND status = 'active' AND is_primary
                             AND person_id IS DISTINCT FROM _person) THEN
    RAISE EXCEPTION 'This care already has a different primary carer';
  END IF;

  INSERT INTO public.care_roster_patterns (episode_id, person_id, is_primary, kind, weekdays, start_time,
    duration_minutes, valid_from, valid_until, notes, created_by)
  VALUES (_episode_id, _person, _primary, COALESCE(NULLIF(_p->>'kind', ''), 'visit'),
    ARRAY(SELECT DISTINCT (x)::smallint FROM jsonb_array_elements_text(_p->'weekdays') x ORDER BY 1),
    (_p->>'start_time')::time, (_p->>'duration_minutes')::integer, _from,
    NULLIF(_p->>'valid_until', '')::date, NULLIF(btrim(COALESCE(_p->>'notes', '')), ''), auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Ending a pattern cancels its visits that have not started.
CREATE OR REPLACE FUNCTION public.care_roster_pattern_end(_pattern_id uuid, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _n integer;
BEGIN
  IF NOT private.care_schedule_ok() THEN
    RAISE EXCEPTION 'You do not have permission to change the schedule';
  END IF;
  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN RAISE EXCEPTION 'Give a reason'; END IF;
  UPDATE public.care_roster_patterns
     SET status = 'ended', ended_at = now(), ended_by = auth.uid(), end_reason = btrim(_reason)
   WHERE id = _pattern_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'That pattern is not active'; END IF;
  UPDATE public.care_visits
     SET status = 'cancelled', closed_at = now(), closed_by = auth.uid(),
         close_reason = 'Pattern ended: ' || btrim(_reason)
   WHERE pattern_id = _pattern_id AND status = 'scheduled' AND scheduled_start > now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

-- Makes the visits for an episode's active patterns up to a date (at most
-- 62 days ahead), in Lagos time. Safe to run again: existing slots are kept.
-- A slot whose worker is unavailable is created open, for a coordinator to fill.
CREATE OR REPLACE FUNCTION public.care_visits_generate(_episode_id uuid, _until date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  _e public.care_episodes%ROWTYPE;
  _place jsonb;
  _p public.care_roster_patterns%ROWTYPE;
  _day date;
  _start timestamptz;
  _end timestamptz;
  _who uuid;
  _id uuid;
  _made integer := 0;
  _open integer := 0;
  _stop date;
BEGIN
  IF NOT private.care_schedule_ok() THEN
    RAISE EXCEPTION 'You do not have permission to change the schedule';
  END IF;
  SELECT * INTO _e FROM public.care_episodes WHERE id = _episode_id;
  IF NOT FOUND OR _e.status NOT IN ('planned','active') THEN
    RAISE EXCEPTION 'That care episode is not running';
  END IF;
  IF _until IS NULL OR _until > current_date + 62 THEN
    RAISE EXCEPTION 'Visits can be made up to 62 days ahead';
  END IF;
  _place := private.care_client_place(_e.client_id);

  FOR _p IN SELECT * FROM public.care_roster_patterns
             WHERE episode_id = _episode_id AND status = 'active' ORDER BY created_at LOOP
    _stop := LEAST(_until, COALESCE(_p.valid_until, _until));
    _day := GREATEST(_p.valid_from, (now() AT TIME ZONE 'Africa/Lagos')::date);
    WHILE _day <= _stop LOOP
      IF extract(isodow FROM _day)::smallint = ANY (_p.weekdays) THEN
        _start := (_day + _p.start_time) AT TIME ZONE 'Africa/Lagos';
        _end := _start + make_interval(mins => _p.duration_minutes);
        IF _start > now() AND NOT EXISTS (
             SELECT 1 FROM public.care_visits WHERE pattern_id = _p.id AND scheduled_start = _start) THEN
          _who := CASE WHEN _p.person_id IS NOT NULL
                        AND private.care_visit_person_check(_episode_id, _p.person_id, _start, _end, NULL) IS NULL
                       THEN _p.person_id END;
          INSERT INTO public.care_visits (episode_id, client_id, pattern_id, person_id, kind,
            scheduled_start, scheduled_end, expected_address, expected_landmark, expected_lat, expected_lng,
            created_by)
          VALUES (_episode_id, _e.client_id, _p.id, _who, _p.kind, _start, _end,
            _place->>'address', _place->>'landmark', (_place->>'lat')::numeric, (_place->>'lng')::numeric,
            auth.uid())
          ON CONFLICT DO NOTHING
          RETURNING id INTO _id;
          IF _id IS NOT NULL THEN
            _made := _made + 1;
            IF _who IS NULL THEN _open := _open + 1; END IF;
          END IF;
          _id := NULL;
        END IF;
      END IF;
      _day := _day + 1;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('created', _made, 'open', _open);
END;
$$;

-- A one-off visit: {"kind", "scheduled_start", "duration_minutes", "person_id", "notes"}.
CREATE OR REPLACE FUNCTION public.care_visit_create(_episode_id uuid, _visit jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  _e public.care_episodes%ROWTYPE;
  _k text;
  _start timestamptz;
  _end timestamptz;
  _person uuid := NULLIF(_visit->>'person_id', '')::uuid;
  _why text;
  _place jsonb;
  _id uuid;
BEGIN
  IF NOT private.care_schedule_ok() THEN
    RAISE EXCEPTION 'You do not have permission to change the schedule';
  END IF;
  IF _visit IS NULL OR jsonb_typeof(_visit) <> 'object' THEN RAISE EXCEPTION 'A visit must be an object'; END IF;
  FOR _k IN SELECT jsonb_object_keys(_visit) LOOP
    IF NOT _k = ANY (ARRAY['kind','scheduled_start','duration_minutes','person_id','notes']) THEN
      RAISE EXCEPTION 'Unknown visit field: %', _k;
    END IF;
  END LOOP;
  SELECT * INTO _e FROM public.care_episodes WHERE id = _episode_id;
  IF NOT FOUND OR _e.status NOT IN ('planned','active') THEN
    RAISE EXCEPTION 'That care episode is not running';
  END IF;
  _start := NULLIF(_visit->>'scheduled_start', '')::timestamptz;
  IF _start IS NULL OR _start < now() - interval '1 hour' THEN
    RAISE EXCEPTION 'A visit needs a start time that has not passed';
  END IF;
  IF COALESCE((_visit->>'duration_minutes')::integer, 0) NOT BETWEEN 15 AND 1440 THEN
    RAISE EXCEPTION 'A visit lasts between 15 minutes and 24 hours';
  END IF;
  _end := _start + make_interval(mins => (_visit->>'duration_minutes')::integer);
  IF _person IS NOT NULL THEN
    _why := private.care_visit_person_check(_episode_id, _person, _start, _end, NULL);
    IF _why IS NOT NULL THEN RAISE EXCEPTION '%', _why; END IF;
  END IF;
  _place := private.care_client_place(_e.client_id);
  INSERT INTO public.care_visits (episode_id, client_id, person_id, kind, scheduled_start, scheduled_end,
    notes, expected_address, expected_landmark, expected_lat, expected_lng, created_by)
  VALUES (_episode_id, _e.client_id, _person, COALESCE(NULLIF(_visit->>'kind', ''), 'visit'), _start, _end,
    NULLIF(btrim(COALESCE(_visit->>'notes', '')), ''),
    _place->>'address', _place->>'landmark', (_place->>'lat')::numeric, (_place->>'lng')::numeric, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Assign or unassign (null) a worker on a visit that has not started.
CREATE OR REPLACE FUNCTION public.care_visit_assign(_visit_id uuid, _person_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _v public.care_visits%ROWTYPE; _why text;
BEGIN
  IF NOT private.care_schedule_ok() THEN
    RAISE EXCEPTION 'You do not have permission to change the schedule';
  END IF;
  SELECT * INTO _v FROM public.care_visits WHERE id = _visit_id FOR UPDATE;
  IF NOT FOUND OR _v.status <> 'scheduled' THEN RAISE EXCEPTION 'That visit can no longer be changed'; END IF;
  IF _person_id IS NOT NULL THEN
    _why := private.care_visit_person_check(_v.episode_id, _person_id, _v.scheduled_start, _v.scheduled_end, _v.id);
    IF _why IS NOT NULL THEN RAISE EXCEPTION '%', _why; END IF;
  END IF;
  UPDATE public.care_visits SET person_id = _person_id WHERE id = _visit_id;
END;
$$;

-- Close a visit that will not happen: cancelled before it, or missed after it.
CREATE OR REPLACE FUNCTION public.care_visit_close(_visit_id uuid, _outcome text, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _v public.care_visits%ROWTYPE;
BEGIN
  IF NOT private.care_schedule_ok() THEN
    RAISE EXCEPTION 'You do not have permission to change the schedule';
  END IF;
  IF _outcome NOT IN ('cancelled','missed') THEN RAISE EXCEPTION 'Close a visit as cancelled or missed'; END IF;
  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN RAISE EXCEPTION 'Give a reason'; END IF;
  SELECT * INTO _v FROM public.care_visits WHERE id = _visit_id FOR UPDATE;
  IF NOT FOUND OR _v.status <> 'scheduled' THEN RAISE EXCEPTION 'That visit can no longer be changed'; END IF;
  IF _outcome = 'missed' AND _v.scheduled_start > now() THEN
    RAISE EXCEPTION 'A visit can be marked missed only after its start time';
  END IF;
  UPDATE public.care_visits
     SET status = _outcome, closed_at = now(), closed_by = auth.uid(), close_reason = btrim(_reason)
   WHERE id = _visit_id;
END;
$$;

-- ---------------------------------------------------------------- worker
-- The caller's own visits from a date, for a number of days (at most 31).
CREATE OR REPLACE FUNCTION public.care_my_visits(_from date DEFAULT NULL, _days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  _me uuid := public.mu_my_person_id();
  _start timestamptz := (COALESCE(_from, (now() AT TIME ZONE 'Africa/Lagos')::date)::timestamp) AT TIME ZONE 'Africa/Lagos';
  _n integer := LEAST(GREATEST(COALESCE(_days, 7), 1), 31);
BEGIN
  IF _me IS NULL OR NOT private.care_worker_ok(_me) THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(private.care_visit_json(v) ORDER BY v.scheduled_start)
      FROM public.care_visits v
     WHERE v.person_id = _me AND v.status <> 'cancelled'
       AND v.scheduled_end > _start AND v.scheduled_start < _start + make_interval(days => _n)), '[]'::jsonb);
END;
$$;

-- Records one event from the worker's device. Returns false when this event
-- was already received (a replay), true when it is new.
CREATE OR REPLACE FUNCTION private.care_visit_event_add(_visit_id uuid, _client_event_id uuid, _kind text,
                                                        _payload jsonb, _occurred_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _id uuid;
BEGIN
  IF _client_event_id IS NULL THEN RAISE EXCEPTION 'An event needs its device event id'; END IF;
  INSERT INTO public.care_visit_events (visit_id, client_event_id, kind, payload, occurred_at, actor_user_id)
  VALUES (_visit_id, _client_event_id, _kind, COALESCE(_payload, '{}'::jsonb),
          LEAST(COALESCE(_occurred_at, now()), now()), auth.uid())
  ON CONFLICT (visit_id, client_event_id) DO NOTHING
  RETURNING id INTO _id;
  RETURN _id IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.care_visit_event_add(uuid, uuid, text, jsonb, timestamptz) FROM public, anon, authenticated;

-- The worker's own open visit, locked, or an error.
CREATE OR REPLACE FUNCTION private.care_visit_mine(_visit_id uuid)
RETURNS public.care_visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _me uuid := public.mu_my_person_id(); _v public.care_visits%ROWTYPE;
BEGIN
  IF _me IS NULL OR NOT private.care_worker_ok(_me) THEN
    RAISE EXCEPTION 'You cannot use the workforce app as a care worker';
  END IF;
  SELECT * INTO _v FROM public.care_visits WHERE id = _visit_id FOR UPDATE;
  IF NOT FOUND OR _v.person_id IS DISTINCT FROM _me THEN
    RAISE EXCEPTION 'That visit is not yours';
  END IF;
  RETURN _v;
END;
$$;
REVOKE ALL ON FUNCTION private.care_visit_mine(uuid) FROM public, anon, authenticated;

-- Check in. Location is optional; without it, or far from the home, the visit
-- is flagged, not blocked. Opens an hour before the start, closes at the end.
CREATE OR REPLACE FUNCTION public.care_visit_check_in(_visit_id uuid, _client_event_id uuid,
  _lat numeric DEFAULT NULL, _lng numeric DEFAULT NULL, _accuracy_m integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _v public.care_visits%ROWTYPE; _d integer; _flags text[] := '{}';
BEGIN
  _v := private.care_visit_mine(_visit_id);
  IF EXISTS (SELECT 1 FROM public.care_visit_events WHERE visit_id = _visit_id
              AND client_event_id = _client_event_id AND kind = 'check_in') THEN
    RETURN private.care_visit_json(_v);  -- replay of a check-in already received
  END IF;
  IF _v.status <> 'scheduled' THEN RAISE EXCEPTION 'This visit has already started or closed'; END IF;
  IF now() < _v.scheduled_start - interval '1 hour' THEN
    RAISE EXCEPTION 'Check-in opens an hour before the visit';
  END IF;
  IF now() > _v.scheduled_end THEN
    RAISE EXCEPTION 'This visit has ended; ask the coordinator';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.care_episodes WHERE id = _v.episode_id AND status = 'active') THEN
    RAISE EXCEPTION 'This care is not active';
  END IF;
  IF (_lat IS NULL) <> (_lng IS NULL) OR _lat NOT BETWEEN -90 AND 90 OR _lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'That location is not valid';
  END IF;

  _d := private.care_distance_m(_lat, _lng, _v.expected_lat, _v.expected_lng);
  IF _lat IS NULL THEN _flags := _flags || 'no_location_at_check_in'::text; END IF;
  IF _v.expected_lat IS NULL THEN _flags := _flags || 'no_home_pin'::text; END IF;
  IF _d IS NOT NULL AND _d - LEAST(COALESCE(_accuracy_m, 0), 200) > 300 THEN
    _flags := _flags || 'far_at_check_in'::text;
  END IF;

  UPDATE public.care_visits
     SET status = 'in_progress', check_in_at = now(), check_in_lat = _lat, check_in_lng = _lng,
         check_in_accuracy_m = _accuracy_m, check_in_distance_m = _d,
         location_flags = ARRAY(SELECT DISTINCT f FROM unnest(location_flags || _flags) f ORDER BY 1)
   WHERE id = _visit_id
  RETURNING * INTO _v;
  PERFORM private.care_visit_event_add(_visit_id, _client_event_id, 'check_in',
    jsonb_build_object('lat', _lat, 'lng', _lng, 'accuracy_m', _accuracy_m, 'distance_m', _d,
                       'flags', to_jsonb(_flags)), now());
  RETURN private.care_visit_json(_v);
END;
$$;

CREATE OR REPLACE FUNCTION public.care_visit_check_out(_visit_id uuid, _client_event_id uuid,
  _lat numeric DEFAULT NULL, _lng numeric DEFAULT NULL, _accuracy_m integer DEFAULT NULL, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _v public.care_visits%ROWTYPE; _d integer; _flags text[] := '{}';
BEGIN
  _v := private.care_visit_mine(_visit_id);
  IF EXISTS (SELECT 1 FROM public.care_visit_events WHERE visit_id = _visit_id
              AND client_event_id = _client_event_id AND kind = 'check_out') THEN
    RETURN private.care_visit_json(_v);
  END IF;
  IF _v.status <> 'in_progress' THEN RAISE EXCEPTION 'This visit is not in progress'; END IF;
  IF (_lat IS NULL) <> (_lng IS NULL) OR _lat NOT BETWEEN -90 AND 90 OR _lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'That location is not valid';
  END IF;
  IF length(COALESCE(_note, '')) > 2000 THEN RAISE EXCEPTION 'The note is too long'; END IF;

  _d := private.care_distance_m(_lat, _lng, _v.expected_lat, _v.expected_lng);
  IF _lat IS NULL THEN _flags := _flags || 'no_location_at_check_out'::text; END IF;
  IF _d IS NOT NULL AND _d - LEAST(COALESCE(_accuracy_m, 0), 200) > 300 THEN
    _flags := _flags || 'far_at_check_out'::text;
  END IF;

  UPDATE public.care_visits
     SET status = 'completed', check_out_at = now(), check_out_lat = _lat, check_out_lng = _lng,
         check_out_accuracy_m = _accuracy_m, check_out_distance_m = _d,
         check_out_note = NULLIF(btrim(COALESCE(_note, '')), ''),
         location_flags = ARRAY(SELECT DISTINCT f FROM unnest(location_flags || _flags) f ORDER BY 1)
   WHERE id = _visit_id
  RETURNING * INTO _v;
  PERFORM private.care_visit_event_add(_visit_id, _client_event_id, 'check_out',
    jsonb_build_object('lat', _lat, 'lng', _lng, 'accuracy_m', _accuracy_m, 'distance_m', _d,
                       'flags', to_jsonb(_flags)), now());
  RETURN private.care_visit_json(_v);
END;
$$;

-- ---------------------------------------------------------------- alerts
-- For coordinators and clinical staff: visits needing attention now.
--   overdue_checkout  in progress, 15 minutes past its end;
--   not_started       scheduled, 15 minutes past its start;
--   unassigned        scheduled in the next 48 hours with no worker;
--   location          started or finished today with a location flag.
CREATE OR REPLACE FUNCTION public.care_visit_alerts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _today timestamptz := ((now() AT TIME ZONE 'Africa/Lagos')::date::timestamp) AT TIME ZONE 'Africa/Lagos';
BEGIN
  IF NOT private.care_schedule_ok() THEN RETURN NULL; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(a ORDER BY a->>'kind', a->>'scheduled_start') FROM (
      SELECT private.care_visit_json(v) || jsonb_build_object(
               'kind', CASE
                 WHEN v.status = 'in_progress' AND now() > v.scheduled_end + interval '15 minutes' THEN 'overdue_checkout'
                 WHEN v.status = 'scheduled' AND now() > v.scheduled_start + interval '15 minutes' THEN 'not_started'
                 WHEN v.status = 'scheduled' AND v.person_id IS NULL THEN 'unassigned'
                 ELSE 'location' END,
               'person_id', v.person_id,
               'person_name', (SELECT full_name FROM public.mu_people WHERE id = v.person_id)) AS a
        FROM public.care_visits v
       WHERE (v.status = 'in_progress' AND now() > v.scheduled_end + interval '15 minutes')
          OR (v.status = 'scheduled' AND now() > v.scheduled_start + interval '15 minutes')
          OR (v.status = 'scheduled' AND v.person_id IS NULL AND v.scheduled_start < now() + interval '48 hours')
          OR (v.check_in_at >= _today AND v.location_flags && ARRAY['far_at_check_in','far_at_check_out',
                'no_location_at_check_in','no_location_at_check_out'])) x), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.care_home_pin_set(uuid, numeric, numeric, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_roster_pattern_create(uuid, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_roster_pattern_end(uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_visits_generate(uuid, date) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_visit_create(uuid, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_visit_assign(uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_visit_close(uuid, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_my_visits(date, integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_visit_check_in(uuid, uuid, numeric, numeric, integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_visit_check_out(uuid, uuid, numeric, numeric, integer, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_visit_alerts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.care_home_pin_set(uuid, numeric, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_roster_pattern_create(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_roster_pattern_end(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_visits_generate(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_visit_create(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_visit_assign(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_visit_close(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_my_visits(date, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_visit_check_in(uuid, uuid, numeric, numeric, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_visit_check_out(uuid, uuid, numeric, numeric, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_visit_alerts() TO authenticated, service_role;
