-- Build step 4 (database, first part): the Today board, live alerts and the
-- emergency button. Location levels 3 and 4 (journey tracking, live map) are
-- a later part of step 4 and are not here.
--
--   care_worker_alerts       a worker's emergency button press: who, when,
--                            where (if the device gave a location), the visit
--                            if they were on one, and who acknowledged and
--                            resolved it. Raising one notifies every care
--                            coordinator at once (bell, then email if unread).
--   care_visit_alert_log     which visit alerts have already been sent, so an
--                            overdue checkout or a visit not started notifies
--                            coordinators once, not every five minutes.
--
-- Reads for coordinators and clinical staff:
--   care_schedule_episodes   running care with its schedule at a glance;
--   care_episode_schedule    one episode: place, assigned workers, patterns,
--                            visits for the next fortnight;
--   care_visits_board        one Lagos day: every visit, its alert, and open
--                            emergencies.
-- (docs/care-platform/apps-and-operations-plan.md, sections 4.3, 6 and 7;
-- build order step 4.)
--
-- Additive: new tables and functions, and one five-minute cron job when
-- pg_cron is present.

-- ---------------------------------------------------------------- emergencies
CREATE TABLE IF NOT EXISTS public.care_worker_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE RESTRICT,
  visit_id uuid REFERENCES public.care_visits(id) ON DELETE RESTRICT,
  client_event_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'emergency' CHECK (kind IN ('emergency')),
  raised_at timestamptz NOT NULL DEFAULT now(),
  lat numeric(9,6),
  lng numeric(9,6),
  accuracy_m integer,
  note text CHECK (note IS NULL OR length(note) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  UNIQUE (person_id, client_event_id),
  CHECK ((status = 'open') = (acknowledged_at IS NULL)),
  CHECK ((status = 'resolved') = (resolved_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS care_worker_alerts_open_idx ON public.care_worker_alerts(raised_at)
  WHERE status <> 'resolved';

CREATE TABLE IF NOT EXISTS public.care_visit_alert_log (
  visit_id uuid NOT NULL REFERENCES public.care_visits(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('overdue_checkout','not_started')),
  notified_at timestamptz NOT NULL DEFAULT now(),
  recipients integer NOT NULL DEFAULT 0,
  PRIMARY KEY (visit_id, kind)
);

REVOKE ALL ON public.care_worker_alerts, public.care_visit_alert_log FROM anon, authenticated;
GRANT SELECT ON public.care_worker_alerts, public.care_visit_alert_log TO authenticated;
GRANT ALL ON public.care_worker_alerts, public.care_visit_alert_log TO service_role;
ALTER TABLE public.care_worker_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_visit_alert_log ENABLE ROW LEVEL SECURITY;

DO $policies$
DECLARE _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['care_worker_alerts','care_visit_alert_log'] LOOP
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

-- ---------------------------------------------------------------- helpers
-- Everyone who runs the care schedule: active admins holding the coordinator
-- area (super admins hold every area).
CREATE OR REPLACE FUNCTION private.care_coordinator_users()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT DISTINCT ap.user_id
    FROM public.admin_permissions ap
    JOIN public.user_roles ur ON ur.user_id = ap.user_id AND ur.role = 'admin'::app_role
   WHERE COALESCE(ap.is_active, true)
     AND (ap.permissions ? 'care_coordinator' OR private.is_super_admin(ap.user_id))
$$;

-- Notifies every coordinator; returns how many were notified.
CREATE OR REPLACE FUNCTION private.care_notify_coordinators(_kind text, _title text, _body text,
                                                            _link text, _ref_table text, _ref_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _u uuid; _n integer := 0;
BEGIN
  FOR _u IN SELECT * FROM private.care_coordinator_users() LOOP
    PERFORM private.notify(_u, _kind, _title, _body, _link, _ref_table, _ref_id);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION private.care_coordinator_users() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.care_notify_coordinators(text, text, text, text, text, uuid) FROM public, anon, authenticated;

-- ---------------------------------------------------------------- emergency button
-- A field worker presses the emergency button. Works with or without a visit
-- and with or without a location. A retried press (same device event id)
-- returns the alert already raised and notifies no one again.
CREATE OR REPLACE FUNCTION public.care_worker_alert_raise(_client_event_id uuid, _visit_id uuid DEFAULT NULL,
  _lat numeric DEFAULT NULL, _lng numeric DEFAULT NULL, _accuracy_m integer DEFAULT NULL, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  _me uuid := public.mu_my_person_id();
  _a public.care_worker_alerts%ROWTYPE;
  _who text;
  _where text;
BEGIN
  IF _me IS NULL OR NOT private.care_worker_ok(_me) THEN
    RAISE EXCEPTION 'You cannot use the workforce app as a care worker';
  END IF;
  IF _client_event_id IS NULL THEN RAISE EXCEPTION 'An alert needs its device event id'; END IF;
  SELECT * INTO _a FROM public.care_worker_alerts WHERE person_id = _me AND client_event_id = _client_event_id;
  IF FOUND THEN
    RETURN jsonb_build_object('id', _a.id, 'status', _a.status, 'raised_at', _a.raised_at);
  END IF;
  IF _visit_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.care_visits WHERE id = _visit_id AND person_id = _me) THEN
    RAISE EXCEPTION 'That visit is not yours';
  END IF;
  IF (_lat IS NULL) <> (_lng IS NULL) OR _lat NOT BETWEEN -90 AND 90 OR _lng NOT BETWEEN -180 AND 180 THEN
    _lat := NULL; _lng := NULL;  -- a bad location never stops an emergency
  END IF;

  INSERT INTO public.care_worker_alerts (person_id, visit_id, client_event_id, lat, lng, accuracy_m, note)
  VALUES (_me, _visit_id, _client_event_id, _lat, _lng, _accuracy_m, NULLIF(left(btrim(COALESCE(_note, '')), 1000), ''))
  RETURNING * INTO _a;

  SELECT full_name INTO _who FROM public.mu_people WHERE id = _me;
  SELECT COALESCE(v.expected_address, 'their visit') INTO _where FROM public.care_visits v WHERE v.id = _visit_id;
  PERFORM private.care_notify_coordinators('care_emergency',
    'Emergency: ' || COALESCE(_who, 'a care worker') || ' pressed the emergency button',
    concat_ws('. ',
      CASE WHEN _visit_id IS NOT NULL THEN 'During a visit at ' || _where END,
      CASE WHEN _lat IS NOT NULL THEN 'Location ' || _lat || ', ' || _lng ELSE 'No location from the phone' END,
      _a.note),
    '/admin/care/today', 'care_worker_alerts', _a.id);
  RETURN jsonb_build_object('id', _a.id, 'status', _a.status, 'raised_at', _a.raised_at);
END;
$$;

-- The caller's latest emergency that is not yet resolved, or null.
CREATE OR REPLACE FUNCTION public.care_my_open_alert()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT jsonb_build_object('id', a.id, 'status', a.status, 'raised_at', a.raised_at,
                            'acknowledged_at', a.acknowledged_at)
    FROM public.care_worker_alerts a
   WHERE a.person_id = public.mu_my_person_id() AND a.status <> 'resolved'
   ORDER BY a.raised_at DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.care_worker_alert_update(_alert_id uuid, _status text, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _a public.care_worker_alerts%ROWTYPE;
BEGIN
  IF NOT private.care_schedule_ok() THEN
    RAISE EXCEPTION 'You do not have permission to handle care alerts';
  END IF;
  SELECT * INTO _a FROM public.care_worker_alerts WHERE id = _alert_id FOR UPDATE;
  IF NOT FOUND OR _a.status = 'resolved' THEN RAISE EXCEPTION 'That alert is already resolved'; END IF;
  IF _status = 'acknowledged' THEN
    IF _a.status <> 'open' THEN RAISE EXCEPTION 'That alert is already acknowledged'; END IF;
    UPDATE public.care_worker_alerts SET status = 'acknowledged', acknowledged_at = now(), acknowledged_by = auth.uid()
     WHERE id = _alert_id;
  ELSIF _status = 'resolved' THEN
    IF NULLIF(btrim(COALESCE(_note, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Say what happened before resolving the alert';
    END IF;
    UPDATE public.care_worker_alerts
       SET status = 'resolved', resolved_at = now(), resolved_by = auth.uid(), resolution_note = btrim(_note),
           acknowledged_at = COALESCE(acknowledged_at, now()), acknowledged_by = COALESCE(acknowledged_by, auth.uid())
     WHERE id = _alert_id;
  ELSE
    RAISE EXCEPTION 'An alert is acknowledged or resolved';
  END IF;
END;
$$;

-- ---------------------------------------------------------------- live alerts
-- Run every five minutes: tells coordinators, once per visit, about an overdue
-- checkout or a visit not started 15 minutes after its start.
CREATE OR REPLACE FUNCTION private.care_visit_alerts_notify()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _v record; _sent integer := 0; _n integer;
BEGIN
  FOR _v IN
    SELECT v.id, v.scheduled_start, v.scheduled_end, v.expected_address,
           CASE WHEN v.status = 'in_progress' THEN 'overdue_checkout' ELSE 'not_started' END AS kind,
           COALESCE(NULLIF(c.preferred_name, ''), NULLIF(c.first_name, ''), c.full_name) AS client_name,
           p.full_name AS person_name
      FROM public.care_visits v
      JOIN public.clients c ON c.id = v.client_id
      LEFT JOIN public.mu_people p ON p.id = v.person_id
     WHERE ((v.status = 'in_progress' AND now() > v.scheduled_end + interval '15 minutes')
         OR (v.status = 'scheduled' AND now() > v.scheduled_start + interval '15 minutes'))
       -- Only today's problems; older ones are already on the board.
       AND v.scheduled_end > now() - interval '12 hours'
       AND NOT EXISTS (SELECT 1 FROM public.care_visit_alert_log l
                        WHERE l.visit_id = v.id
                          AND l.kind = CASE WHEN v.status = 'in_progress' THEN 'overdue_checkout' ELSE 'not_started' END)
  LOOP
    _n := private.care_notify_coordinators('care_visit_' || _v.kind,
      CASE _v.kind
        WHEN 'overdue_checkout' THEN COALESCE(_v.person_name, 'A care worker') || ' has not checked out'
        ELSE 'Visit to ' || COALESCE(_v.client_name, 'a client') || ' has not started' END,
      CASE _v.kind
        WHEN 'overdue_checkout' THEN 'The visit to ' || COALESCE(_v.client_name, 'a client') || ' was due to end at '
                                     || to_char(_v.scheduled_end AT TIME ZONE 'Africa/Lagos', 'HH24:MI') || '.'
        ELSE 'It was due at ' || to_char(_v.scheduled_start AT TIME ZONE 'Africa/Lagos', 'HH24:MI')
             || COALESCE(' with ' || _v.person_name, ', with no one assigned') || '.' END,
      '/admin/care/today', 'care_visits', _v.id);
    INSERT INTO public.care_visit_alert_log (visit_id, kind, recipients) VALUES (_v.id, _v.kind, _n)
    ON CONFLICT DO NOTHING;
    _sent := _sent + 1;
  END LOOP;
  RETURN _sent;
END;
$$;
REVOKE ALL ON FUNCTION private.care_visit_alerts_notify() FROM public, anon, authenticated;

DO $cron$
DECLARE _have boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = $1)' INTO _have USING 'care-visit-alerts';
    IF NOT _have THEN
      PERFORM cron.schedule('care-visit-alerts', '*/5 * * * *', 'select private.care_visit_alerts_notify();');
    END IF;
  END IF;
END
$cron$;

-- ---------------------------------------------------------------- coordinator reads
CREATE OR REPLACE FUNCTION public.care_schedule_episodes()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NOT private.care_schedule_ok() THEN RETURN NULL; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(x ORDER BY x->>'client_name') FROM (
      SELECT jsonb_build_object(
        'episode_id', e.id, 'status', e.status, 'service_code', e.service_code,
        'client_id', e.client_id,
        'client_name', COALESCE(NULLIF(c.preferred_name, ''), NULLIF(c.first_name, ''), c.full_name),
        'primary_carer', (SELECT p.full_name FROM public.care_roster_patterns r JOIN public.mu_people p ON p.id = r.person_id
                           WHERE r.episode_id = e.id AND r.status = 'active' AND r.is_primary LIMIT 1),
        'patterns', (SELECT count(*) FROM public.care_roster_patterns r WHERE r.episode_id = e.id AND r.status = 'active'),
        'workers', (SELECT count(*) FROM public.care_delivery_assignments a
                     WHERE a.episode_id = e.id AND a.status IN ('planned','active')),
        'next_visit', (SELECT min(v.scheduled_start) FROM public.care_visits v
                        WHERE v.episode_id = e.id AND v.status = 'scheduled' AND v.scheduled_start > now()),
        'open_visits', (SELECT count(*) FROM public.care_visits v
                         WHERE v.episode_id = e.id AND v.status = 'scheduled' AND v.person_id IS NULL
                           AND v.scheduled_start > now()),
        'has_pin', EXISTS (SELECT 1 FROM public.care_home_pins hp WHERE hp.home_id = c.home_id)) AS x
        FROM public.care_episodes e
        JOIN public.clients c ON c.id = e.client_id
       WHERE e.status IN ('planned','active','paused')) s), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.care_episode_schedule(_episode_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _e public.care_episodes%ROWTYPE; _c public.clients%ROWTYPE;
BEGIN
  IF NOT private.care_schedule_ok() THEN RETURN NULL; END IF;
  SELECT * INTO _e FROM public.care_episodes WHERE id = _episode_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO _c FROM public.clients WHERE id = _e.client_id;
  RETURN jsonb_build_object(
    'episode_id', _e.id, 'status', _e.status, 'service_code', _e.service_code, 'client_id', _e.client_id,
    'client_name', COALESCE(NULLIF(_c.preferred_name, ''), NULLIF(_c.first_name, ''), _c.full_name),
    'home_id', _c.home_id,
    'place', private.care_client_place(_e.client_id),
    'workers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'person_id', a.person_id, 'name', p.full_name, 'assignment_status', a.status,
               'effective_from', a.effective_from, 'effective_to', a.effective_to,
               'app_access', private.care_worker_ok(a.person_id)) ORDER BY p.full_name)
        FROM public.care_delivery_assignments a JOIN public.mu_people p ON p.id = a.person_id
       WHERE a.episode_id = _e.id AND a.status IN ('planned','active')), '[]'::jsonb),
    'patterns', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', r.id, 'person_id', r.person_id, 'person_name', p.full_name, 'is_primary', r.is_primary,
               'kind', r.kind, 'weekdays', to_jsonb(r.weekdays), 'start_time', to_char(r.start_time, 'HH24:MI'),
               'duration_minutes', r.duration_minutes, 'valid_from', r.valid_from, 'valid_until', r.valid_until,
               'notes', r.notes) ORDER BY r.start_time)
        FROM public.care_roster_patterns r LEFT JOIN public.mu_people p ON p.id = r.person_id
       WHERE r.episode_id = _e.id AND r.status = 'active'), '[]'::jsonb),
    'visits', COALESCE((
      SELECT jsonb_agg(private.care_visit_json(v) || jsonb_build_object(
               'person_id', v.person_id, 'person_name', p.full_name, 'pattern_id', v.pattern_id)
             ORDER BY v.scheduled_start)
        FROM public.care_visits v LEFT JOIN public.mu_people p ON p.id = v.person_id
       WHERE v.episode_id = _e.id AND v.status IN ('scheduled','in_progress')
         AND v.scheduled_start < now() + interval '14 days'), '[]'::jsonb));
END;
$$;

-- One Lagos day: every visit on it, with its alert if any, plus every
-- emergency not yet resolved (whatever day it was raised).
CREATE OR REPLACE FUNCTION public.care_visits_board(_day date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  _d date := COALESCE(_day, (now() AT TIME ZONE 'Africa/Lagos')::date);
  _from timestamptz := (_d::timestamp) AT TIME ZONE 'Africa/Lagos';
  _to timestamptz := ((_d + 1)::timestamp) AT TIME ZONE 'Africa/Lagos';
BEGIN
  IF NOT private.care_schedule_ok() THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'day', _d,
    'emergencies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', a.id, 'status', a.status, 'raised_at', a.raised_at, 'person_id', a.person_id,
               'person_name', p.full_name, 'visit_id', a.visit_id, 'lat', a.lat, 'lng', a.lng,
               'accuracy_m', a.accuracy_m, 'note', a.note, 'acknowledged_at', a.acknowledged_at,
               'client_name', (SELECT COALESCE(NULLIF(c.preferred_name, ''), NULLIF(c.first_name, ''), c.full_name)
                                 FROM public.care_visits v JOIN public.clients c ON c.id = v.client_id
                                WHERE v.id = a.visit_id),
               'address', (SELECT v.expected_address FROM public.care_visits v WHERE v.id = a.visit_id))
             ORDER BY a.raised_at DESC)
        FROM public.care_worker_alerts a JOIN public.mu_people p ON p.id = a.person_id
       WHERE a.status <> 'resolved'), '[]'::jsonb),
    'visits', COALESCE((
      SELECT jsonb_agg(private.care_visit_json(v) || jsonb_build_object(
               'person_id', v.person_id, 'person_name', p.full_name,
               'check_in_distance_m', v.check_in_distance_m, 'check_out_distance_m', v.check_out_distance_m,
               'check_out_note', v.check_out_note, 'close_reason', v.close_reason,
               'alert', CASE
                 WHEN v.status = 'in_progress' AND now() > v.scheduled_end + interval '15 minutes' THEN 'overdue_checkout'
                 WHEN v.status = 'scheduled' AND now() > v.scheduled_start + interval '15 minutes' THEN 'not_started'
                 WHEN v.status = 'scheduled' AND v.person_id IS NULL THEN 'unassigned'
                 WHEN v.location_flags && ARRAY['far_at_check_in','far_at_check_out',
                        'no_location_at_check_in','no_location_at_check_out'] THEN 'location'
               END)
             ORDER BY v.scheduled_start)
        FROM public.care_visits v LEFT JOIN public.mu_people p ON p.id = v.person_id
       WHERE v.scheduled_start < _to AND v.scheduled_end > _from AND v.status <> 'cancelled'), '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.care_worker_alert_raise(uuid, uuid, numeric, numeric, integer, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_my_open_alert() FROM public, anon;
REVOKE ALL ON FUNCTION public.care_worker_alert_update(uuid, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_schedule_episodes() FROM public, anon;
REVOKE ALL ON FUNCTION public.care_episode_schedule(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_visits_board(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.care_worker_alert_raise(uuid, uuid, numeric, numeric, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_my_open_alert() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_worker_alert_update(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_schedule_episodes() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_episode_schedule(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_visits_board(date) TO authenticated, service_role;
