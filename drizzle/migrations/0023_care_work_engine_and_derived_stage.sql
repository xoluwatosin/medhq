-- Tranche 5: one authoritative work record, one working calendar, one ranking,
-- and a Care stage that is derived from facts rather than chosen by hand.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_reason text;

COMMENT ON COLUMN public.clients.stage IS
  'Cached projection of public.care_derive_stage(id). Never written by staff and never read as truth.';

-- 1. The working calendar. Configurable, because Care does not work weekends.
CREATE TABLE IF NOT EXISTS public.care_working_hours (
  weekday smallint PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
  is_working boolean NOT NULL DEFAULT true,
  opens time NOT NULL DEFAULT '08:00',
  closes time NOT NULL DEFAULT '18:00'
);
GRANT SELECT ON public.care_working_hours TO authenticated;
GRANT ALL ON public.care_working_hours TO service_role;
ALTER TABLE public.care_working_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage working hours" ON public.care_working_hours FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.care_working_hours (weekday, is_working, opens, closes) VALUES
  (0, false, '08:00', '18:00'),
  (1, true,  '08:00', '18:00'),
  (2, true,  '08:00', '18:00'),
  (3, true,  '08:00', '18:00'),
  (4, true,  '08:00', '18:00'),
  (5, true,  '08:00', '18:00'),
  (6, false, '09:00', '13:00')
ON CONFLICT (weekday) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.care_public_holidays (
  holiday_on date PRIMARY KEY,
  name text NOT NULL
);
GRANT SELECT ON public.care_public_holidays TO authenticated;
GRANT ALL ON public.care_public_holidays TO service_role;
ALTER TABLE public.care_public_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage public holidays" ON public.care_public_holidays FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.care_public_holidays (holiday_on, name) VALUES
  ('2026-01-01', 'New Year''s Day'),
  ('2026-05-01', 'Workers'' Day'),
  ('2026-06-12', 'Democracy Day'),
  ('2026-10-01', 'Independence Day'),
  ('2026-12-25', 'Christmas Day'),
  ('2026-12-26', 'Boxing Day'),
  ('2027-01-01', 'New Year''s Day'),
  ('2027-05-01', 'Workers'' Day'),
  ('2027-06-12', 'Democracy Day'),
  ('2027-10-01', 'Independence Day'),
  ('2027-12-25', 'Christmas Day'),
  ('2027-12-26', 'Boxing Day')
ON CONFLICT (holiday_on) DO NOTHING;

CREATE OR REPLACE FUNCTION public.care_working_due(_from timestamptz, _days integer)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE _day date := (_from AT TIME ZONE 'Africa/Lagos')::date; _left integer := GREATEST(_days, 0); _opens time;
BEGIN
  LOOP
    _day := _day + 1;
    IF EXISTS (SELECT 1 FROM public.care_working_hours w
                WHERE w.weekday = EXTRACT(dow FROM _day)::smallint AND w.is_working)
       AND NOT EXISTS (SELECT 1 FROM public.care_public_holidays h WHERE h.holiday_on = _day)
    THEN
      _left := _left - 1;
      EXIT WHEN _left <= 0;
    END IF;
    EXIT WHEN _day > (_from AT TIME ZONE 'Africa/Lagos')::date + 60;
  END LOOP;
  SELECT closes INTO _opens FROM public.care_working_hours
   WHERE weekday = EXTRACT(dow FROM _day)::smallint;
  RETURN ((_day + COALESCE(_opens, '18:00'::time)) AT TIME ZONE 'Africa/Lagos');
END;
$$;
GRANT EXECUTE ON FUNCTION public.care_working_due(timestamptz, integer) TO authenticated, service_role;

-- 2. The work record itself. Operational, not a ticketing system.
CREATE TABLE IF NOT EXISTS public.care_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  enquiry_id uuid REFERENCES public.contact_submissions(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.care_documents(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN (
    'callback','send_pre_assessment','chase','book','assign','conduct','clinical_review',
    'prepare_plan','agree_package','staff_package','issue_contract','first_visit_check',
    'review_due','invoice_due','chase_payment','resolve_escalation','other'
  )),
  title text NOT NULL,
  detail text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','blocked','completed','cancelled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent','high','normal')),
  is_blocker boolean NOT NULL DEFAULT false,
  assignee_user_id uuid,
  team text,
  due_at timestamptz,
  blocked_by uuid REFERENCES public.care_work_items(id) ON DELETE SET NULL,
  source_key text NOT NULL,
  source_event text,
  outcome text,
  cancel_reason text,
  reopen_reason text,
  created_by uuid,
  completed_by uuid,
  cancelled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

-- Replay, retry and a repeated rule evaluation all resolve to one live item.
CREATE UNIQUE INDEX IF NOT EXISTS care_work_items_live_source
  ON public.care_work_items (client_id, kind, source_key)
  WHERE status IN ('open','blocked');
CREATE INDEX IF NOT EXISTS care_work_items_client ON public.care_work_items (client_id, status);
CREATE INDEX IF NOT EXISTS care_work_items_due ON public.care_work_items (due_at) WHERE status IN ('open','blocked');

GRANT SELECT, INSERT, UPDATE ON public.care_work_items TO authenticated;
GRANT ALL ON public.care_work_items TO service_role;
ALTER TABLE public.care_work_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage care work" ON public.care_work_items FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER care_work_items_touch
  BEFORE UPDATE ON public.care_work_items
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- 3. Creating work. Internal callers (rules, triggers) use the private form.
CREATE OR REPLACE FUNCTION private.care_work_add(
  _client_id uuid, _kind text, _title text, _source_key text,
  _detail text DEFAULT NULL, _priority text DEFAULT 'normal', _is_blocker boolean DEFAULT false,
  _due_at timestamptz DEFAULT NULL, _team text DEFAULT NULL, _assignee_user_id uuid DEFAULT NULL,
  _source_event text DEFAULT NULL, _document_id uuid DEFAULT NULL, _enquiry_id uuid DEFAULT NULL,
  _blocked_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.care_work_items (
    client_id, kind, title, detail, priority, is_blocker, due_at, team, assignee_user_id,
    source_key, source_event, document_id, enquiry_id, blocked_by,
    status, created_by
  ) VALUES (
    _client_id, _kind, _title, _detail, COALESCE(_priority, 'normal'), COALESCE(_is_blocker, false),
    _due_at, _team, _assignee_user_id, _source_key, _source_event, _document_id, _enquiry_id, _blocked_by,
    CASE WHEN _blocked_by IS NULL THEN 'open' ELSE 'blocked' END, auth.uid()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO _id;

  IF _id IS NULL THEN
    SELECT id INTO _id FROM public.care_work_items
     WHERE client_id = _client_id AND kind = _kind AND source_key = _source_key
       AND status IN ('open','blocked')
     LIMIT 1;
  END IF;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_work_create(
  _client_id uuid, _kind text, _title text, _source_key text,
  _detail text DEFAULT NULL, _priority text DEFAULT 'normal', _is_blocker boolean DEFAULT false,
  _due_at timestamptz DEFAULT NULL, _team text DEFAULT NULL, _assignee_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role)
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Not allowed to create work';
  END IF;
  RETURN private.care_work_add(
    _client_id, _kind, _title, _source_key, _detail, _priority, _is_blocker,
    _due_at, _team, _assignee_user_id, 'manual'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.care_work_create(uuid, text, text, text, text, text, boolean, timestamptz, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.care_work_create(uuid, text, text, text, text, text, boolean, timestamptz, text, uuid) TO authenticated, service_role;
