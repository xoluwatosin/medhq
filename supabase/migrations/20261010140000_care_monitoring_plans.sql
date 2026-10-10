-- Pass 7.5D: monitoring plans. What should be observed during ongoing care, for
-- one care episode: the observation type, why, how often, by whom, the method
-- and unit, an individual target or a reference to a governed rule, dates,
-- family visibility, whether family may self-enter, and a reference to the
-- escalation configuration. No clinical threshold is written here.
-- (docs/care-platform/delivery-architecture.md, sections 3, 5 and 11.)
--
-- Writes only through these functions, by clinical staff (care_clinical).
-- An item is never edited in place: a revision stops it and creates a
-- successor that points back. Additive: new tables and functions only.

-- ---------------------------------------------------------------- plans
CREATE TABLE IF NOT EXISTS public.care_monitoring_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.care_episodes(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  review_due date,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  ended_at timestamptz,
  ended_by uuid,
  end_reason text,
  CHECK ((status = 'ended') = (ended_at IS NOT NULL))
);
-- One open plan per episode.
CREATE UNIQUE INDEX IF NOT EXISTS care_monitoring_plans_open_idx
  ON public.care_monitoring_plans(episode_id) WHERE status = 'active';

-- ---------------------------------------------------------------- items
CREATE TABLE IF NOT EXISTS public.care_monitoring_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.care_monitoring_plans(id) ON DELETE RESTRICT,
  observation_type text NOT NULL CHECK (observation_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  purpose text,
  frequency text NOT NULL
    CHECK (frequency IN ('each_visit','daily','weekly','as_needed','once')),
  times_per_period integer CHECK (times_per_period IS NULL OR times_per_period BETWEEN 1 AND 48),
  timing text,
  responsible_capability text NOT NULL DEFAULT 'care_worker'
    CHECK (responsible_capability IN ('care_worker','nurse','clinical_lead','family')),
  method text,
  unit text,
  target jsonb CHECK (target IS NULL OR jsonb_typeof(target) = 'object'),
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  review_date date,
  visibility text NOT NULL DEFAULT 'care_team'
    CHECK (visibility IN ('family','care_team','professional','safeguarding')),
  self_entry_permitted boolean NOT NULL DEFAULT false,
  escalation_ref text CHECK (escalation_ref IS NULL OR escalation_ref ~ '^[a-z][a-z0-9_.:-]{1,99}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','stopped')),
  supersedes_id uuid REFERENCES public.care_monitoring_items(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  stopped_at timestamptz,
  stopped_by uuid,
  stop_reason text,
  CHECK (end_date IS NULL OR end_date >= start_date),
  CHECK (times_per_period IS NULL OR frequency IN ('daily','weekly')),
  CHECK (NOT self_entry_permitted OR visibility = 'family'),
  CHECK ((status = 'stopped') = (stopped_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS care_monitoring_items_plan_idx
  ON public.care_monitoring_items(plan_id, status);
-- A revision has exactly one successor.
CREATE UNIQUE INDEX IF NOT EXISTS care_monitoring_items_successor_idx
  ON public.care_monitoring_items(supersedes_id) WHERE supersedes_id IS NOT NULL;

-- Staff read the tables directly; everyone else reads through
-- care_monitoring_read. No one writes directly.
REVOKE ALL ON public.care_monitoring_plans, public.care_monitoring_items FROM anon, authenticated;
GRANT SELECT ON public.care_monitoring_plans, public.care_monitoring_items TO authenticated;
GRANT ALL ON public.care_monitoring_plans, public.care_monitoring_items TO service_role;
ALTER TABLE public.care_monitoring_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_monitoring_items ENABLE ROW LEVEL SECURITY;

-- Created only when missing, so the file can be applied twice without a DROP.
DO $policies$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                  AND tablename = 'care_monitoring_plans' AND policyname = 'Care staff read monitoring plans') THEN
    CREATE POLICY "Care staff read monitoring plans" ON public.care_monitoring_plans
      FOR SELECT TO authenticated
      USING (private.care_clinical_ok() OR private.care_ops_ok());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                  AND tablename = 'care_monitoring_items' AND policyname = 'Care staff read monitoring items') THEN
    CREATE POLICY "Care staff read monitoring items" ON public.care_monitoring_items
      FOR SELECT TO authenticated
      USING (private.care_clinical_ok() OR private.care_ops_ok());
  END IF;
END
$policies$;

-- ---------------------------------------------------------------- helpers
-- Validates an item payload and returns it normalised. Raises on anything wrong.
CREATE OR REPLACE FUNCTION private.care_monitoring_item_clean(_item jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'private'
AS $$
DECLARE
  _known text[] := ARRAY['observation_type','purpose','frequency','times_per_period','timing',
    'responsible_capability','method','unit','target','start_date','end_date','review_date',
    'visibility','self_entry_permitted','escalation_ref'];
  _k text;
BEGIN
  IF _item IS NULL OR jsonb_typeof(_item) <> 'object' THEN
    RAISE EXCEPTION 'A monitoring item must be an object';
  END IF;
  FOR _k IN SELECT jsonb_object_keys(_item) LOOP
    IF NOT _k = ANY (_known) THEN
      RAISE EXCEPTION 'Unknown monitoring item field: %', _k;
    END IF;
  END LOOP;
  IF COALESCE(btrim(_item->>'observation_type'), '') = '' THEN
    RAISE EXCEPTION 'A monitoring item needs an observation type';
  END IF;
  IF COALESCE(btrim(_item->>'frequency'), '') = '' THEN
    RAISE EXCEPTION 'A monitoring item needs a frequency';
  END IF;
  IF _item ? 'target' AND jsonb_typeof(_item->'target') NOT IN ('object','null') THEN
    RAISE EXCEPTION 'A monitoring target must be an object, such as {"min": 90, "max": 140} or {"rule": "code"}';
  END IF;
  RETURN _item;
END;
$$;

CREATE OR REPLACE FUNCTION private.care_monitoring_item_insert(_plan_id uuid, _item jsonb, _supersedes uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _i jsonb := private.care_monitoring_item_clean(_item); _id uuid;
BEGIN
  INSERT INTO public.care_monitoring_items (
    plan_id, observation_type, purpose, frequency, times_per_period, timing,
    responsible_capability, method, unit, target, start_date, end_date, review_date,
    visibility, self_entry_permitted, escalation_ref, supersedes_id, created_by)
  VALUES (
    _plan_id,
    lower(btrim(_i->>'observation_type')),
    NULLIF(btrim(_i->>'purpose'), ''),
    btrim(_i->>'frequency'),
    (_i->>'times_per_period')::integer,
    NULLIF(btrim(_i->>'timing'), ''),
    COALESCE(NULLIF(btrim(_i->>'responsible_capability'), ''), 'care_worker'),
    NULLIF(btrim(_i->>'method'), ''),
    NULLIF(btrim(_i->>'unit'), ''),
    NULLIF(_i->'target', 'null'::jsonb),
    COALESCE((_i->>'start_date')::date, current_date),
    (_i->>'end_date')::date,
    (_i->>'review_date')::date,
    COALESCE(NULLIF(btrim(_i->>'visibility'), ''), 'care_team'),
    COALESCE((_i->>'self_entry_permitted')::boolean, false),
    NULLIF(btrim(_i->>'escalation_ref'), ''),
    _supersedes,
    auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- An item can change only while its plan is open on a running episode.
CREATE OR REPLACE FUNCTION private.care_monitoring_plan_open(_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.care_monitoring_plans p
      JOIN public.care_episodes e ON e.id = p.episode_id
     WHERE p.id = _plan_id AND p.status = 'active'
       AND e.status IN ('planned','active','paused'))
  THEN
    RAISE EXCEPTION 'That monitoring plan is not open';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.care_monitoring_item_clean(jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.care_monitoring_item_insert(uuid, jsonb, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.care_monitoring_plan_open(uuid) FROM public, anon, authenticated;

-- ---------------------------------------------------------------- writes
CREATE OR REPLACE FUNCTION public.care_monitoring_plan_create(_episode_id uuid, _title text, _review_due date DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _id uuid;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'You do not have permission to change monitoring plans';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.care_episodes
                  WHERE id = _episode_id AND status IN ('planned','active','paused')) THEN
    RAISE EXCEPTION 'That care episode is not running';
  END IF;
  IF EXISTS (SELECT 1 FROM public.care_monitoring_plans
              WHERE episode_id = _episode_id AND status = 'active') THEN
    RAISE EXCEPTION 'This care episode already has an open monitoring plan';
  END IF;
  INSERT INTO public.care_monitoring_plans (episode_id, title, review_due, created_by)
  VALUES (_episode_id, btrim(COALESCE(_title, '')), _review_due, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_monitoring_plan_end(_plan_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'You do not have permission to change monitoring plans';
  END IF;
  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Give a reason for ending the monitoring plan';
  END IF;
  UPDATE public.care_monitoring_items
     SET status = 'stopped', stopped_at = now(), stopped_by = auth.uid(),
         stop_reason = 'Plan ended: ' || btrim(_reason)
   WHERE plan_id = _plan_id AND status = 'active';
  UPDATE public.care_monitoring_plans
     SET status = 'ended', ended_at = now(), ended_by = auth.uid(), end_reason = btrim(_reason)
   WHERE id = _plan_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'That monitoring plan is not open'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_monitoring_item_add(_plan_id uuid, _item jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'You do not have permission to change monitoring plans';
  END IF;
  PERFORM private.care_monitoring_plan_open(_plan_id);
  RETURN private.care_monitoring_item_insert(_plan_id, _item, NULL);
END;
$$;

-- A change is a new item that supersedes the old one; the old one is stopped.
CREATE OR REPLACE FUNCTION public.care_monitoring_item_revise(_item_id uuid, _item jsonb, _reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _old public.care_monitoring_items%ROWTYPE; _new uuid;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'You do not have permission to change monitoring plans';
  END IF;
  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Give a reason for the change';
  END IF;
  SELECT * INTO _old FROM public.care_monitoring_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND OR _old.status <> 'active' THEN
    RAISE EXCEPTION 'That monitoring item is not active';
  END IF;
  PERFORM private.care_monitoring_plan_open(_old.plan_id);

  UPDATE public.care_monitoring_items
     SET status = 'stopped', stopped_at = now(), stopped_by = auth.uid(),
         stop_reason = 'Revised: ' || btrim(_reason)
   WHERE id = _item_id;
  _new := private.care_monitoring_item_insert(_old.plan_id, _item, _item_id);
  RETURN _new;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_monitoring_item_stop(_item_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'You do not have permission to change monitoring plans';
  END IF;
  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Give a reason for stopping this item';
  END IF;
  UPDATE public.care_monitoring_items
     SET status = 'stopped', stopped_at = now(), stopped_by = auth.uid(), stop_reason = btrim(_reason)
   WHERE id = _item_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'That monitoring item is not active'; END IF;
END;
$$;

-- ---------------------------------------------------------------- reads
-- The open plan for an episode and its active items, filtered by who is asking:
--   clinical staff and care coordinators: every item;
--   a care worker with a live assignment on the episode and app access: items
--     visible to the family or the care team;
--   a family member holding the clinical scope for the client: family items only.
-- Anyone else gets null. Professional and safeguarding items stay with staff.
CREATE OR REPLACE FUNCTION public.care_monitoring_read(_episode_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  _e public.care_episodes%ROWTYPE;
  _levels text[];
  _plan public.care_monitoring_plans%ROWTYPE;
  _me uuid := public.mu_my_person_id();
BEGIN
  SELECT * INTO _e FROM public.care_episodes WHERE id = _episode_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF private.care_clinical_ok() OR private.care_ops_ok() THEN
    _levels := ARRAY['family','care_team','professional','safeguarding'];
  ELSIF _me IS NOT NULL AND private.care_worker_ok(_me) AND EXISTS (
          SELECT 1 FROM public.care_delivery_assignments a
           WHERE a.episode_id = _episode_id AND a.person_id = _me
             AND a.status IN ('planned','active')) THEN
    _levels := ARRAY['family','care_team'];
  ELSIF private.care_has_scope(_e.client_id, 'clinical') THEN
    _levels := ARRAY['family'];
  ELSE
    RETURN NULL;
  END IF;

  SELECT * INTO _plan FROM public.care_monitoring_plans
   WHERE episode_id = _episode_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('episode_id', _episode_id, 'plan', NULL, 'items', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'episode_id', _episode_id,
    'plan', jsonb_build_object('id', _plan.id, 'title', _plan.title, 'review_due', _plan.review_due,
                               'created_at', _plan.created_at),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', i.id, 'observation_type', i.observation_type, 'purpose', i.purpose,
               'frequency', i.frequency, 'times_per_period', i.times_per_period, 'timing', i.timing,
               'responsible_capability', i.responsible_capability, 'method', i.method, 'unit', i.unit,
               'target', i.target, 'start_date', i.start_date, 'end_date', i.end_date,
               'review_date', i.review_date, 'visibility', i.visibility,
               'self_entry_permitted', i.self_entry_permitted, 'escalation_ref', i.escalation_ref,
               'supersedes_id', i.supersedes_id)
             ORDER BY i.observation_type, i.created_at)
        FROM public.care_monitoring_items i
       WHERE i.plan_id = _plan.id AND i.status = 'active'
         AND i.visibility = ANY (_levels)), '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.care_monitoring_plan_create(uuid, text, date) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_monitoring_plan_end(uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_monitoring_item_add(uuid, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_monitoring_item_revise(uuid, jsonb, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_monitoring_item_stop(uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_monitoring_read(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.care_monitoring_plan_create(uuid, text, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_monitoring_plan_end(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_monitoring_item_add(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_monitoring_item_revise(uuid, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_monitoring_item_stop(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_monitoring_read(uuid) TO authenticated, service_role;
