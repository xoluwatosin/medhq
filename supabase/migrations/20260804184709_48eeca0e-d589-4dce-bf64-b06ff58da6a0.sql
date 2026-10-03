-- 1. Calendar tables (ported from Hero Hub, keyed to mu_people rather than auth.users)
CREATE TABLE public.mu_availability_days (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  slot_date date NOT NULL,
  blocks jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, slot_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_availability_days TO authenticated;
GRANT ALL ON public.mu_availability_days TO service_role;
ALTER TABLE public.mu_availability_days ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mu_availability_recurrence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  blocks jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, weekday)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_availability_recurrence TO authenticated;
GRANT ALL ON public.mu_availability_recurrence TO service_role;
ALTER TABLE public.mu_availability_recurrence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Candidates manage own availability days"
  ON public.mu_availability_days FOR ALL TO authenticated
  USING (person_id = public.mu_my_person_id())
  WITH CHECK (person_id = public.mu_my_person_id());
CREATE POLICY "Admins read availability days"
  ON public.mu_availability_days FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Candidates manage own availability recurrence"
  ON public.mu_availability_recurrence FOR ALL TO authenticated
  USING (person_id = public.mu_my_person_id())
  WITH CHECK (person_id = public.mu_my_person_id());
CREATE POLICY "Admins read availability recurrence"
  ON public.mu_availability_recurrence FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX mu_availability_days_person_date_idx ON public.mu_availability_days (person_id, slot_date);
CREATE INDEX mu_availability_recurrence_person_idx ON public.mu_availability_recurrence (person_id) WHERE active;

-- 2. Freshness: a calendar updated six weeks ago is not information.
ALTER TABLE public.mu_people ADD COLUMN IF NOT EXISTS last_availability_update timestamptz;
COMMENT ON COLUMN public.mu_people.availability IS
  'DEPRECATED. Coarse self-declared list from application answers; empty on every row. The calendar tables mu_availability_days / mu_availability_recurrence are the single source of truth. Do not read or write this column.';

CREATE OR REPLACE FUNCTION public.mu_touch_availability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid;
BEGIN
  pid := coalesce(NEW.person_id, OLD.person_id);
  NEW.updated_at := now();
  UPDATE public.mu_people SET last_availability_update = now() WHERE id = pid;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.mu_touch_availability_del()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.mu_people SET last_availability_update = now() WHERE id = OLD.person_id;
  RETURN OLD;
END $$;

CREATE TRIGGER mu_availability_days_touch
  BEFORE INSERT OR UPDATE ON public.mu_availability_days
  FOR EACH ROW EXECUTE FUNCTION public.mu_touch_availability();
CREATE TRIGGER mu_availability_days_touch_del
  AFTER DELETE ON public.mu_availability_days
  FOR EACH ROW EXECUTE FUNCTION public.mu_touch_availability_del();
CREATE TRIGGER mu_availability_recurrence_touch
  BEFORE INSERT OR UPDATE ON public.mu_availability_recurrence
  FOR EACH ROW EXECUTE FUNCTION public.mu_touch_availability();
CREATE TRIGGER mu_availability_recurrence_touch_del
  AFTER DELETE ON public.mu_availability_recurrence
  FOR EACH ROW EXECUTE FUNCTION public.mu_touch_availability_del();

-- 3. Opportunity side: same enum shape as the licence floor, defaulting to none.
ALTER TABLE public.matchmaker_opportunities
  ADD COLUMN IF NOT EXISTS min_availability_evidence text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS availability_from date,
  ADD COLUMN IF NOT EXISTS availability_to date;
ALTER TABLE public.matchmaker_opportunities
  DROP CONSTRAINT IF EXISTS matchmaker_opportunities_min_availability_evidence_check;
ALTER TABLE public.matchmaker_opportunities
  ADD CONSTRAINT matchmaker_opportunities_min_availability_evidence_check
  CHECK (min_availability_evidence IN ('none','known','available'));

-- 4. Resolver. Explicit day wins, else the active weekday template.
--    Three states, exactly like credentials: available / unavailable / unknown.
CREATE OR REPLACE FUNCTION public.mu_availability_state(_person_id uuid, _from date, _to date)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (SELECT generate_series(_from, _to, interval '1 day')::date AS day),
  resolved AS (
    SELECT d.day,
      COALESCE(
        (SELECT a.blocks FROM public.mu_availability_days a
          WHERE a.person_id = _person_id AND a.slot_date = d.day),
        (SELECT r.blocks FROM public.mu_availability_recurrence r
          WHERE r.person_id = _person_id AND r.active
            AND r.weekday = ((EXTRACT(isodow FROM d.day)::int) - 1))
      ) AS blocks
    FROM d
  ),
  flags AS (
    SELECT
      count(*) FILTER (WHERE blocks IS NOT NULL) AS touched,
      count(*) FILTER (
        WHERE blocks IS NOT NULL AND EXISTS (
          SELECT 1 FROM jsonb_each(blocks) kv
           WHERE jsonb_typeof(kv.value) = 'array' AND jsonb_array_length(kv.value) > 0
        )
      ) AS free_days
    FROM resolved
  )
  SELECT CASE WHEN touched = 0 THEN 'unknown'
              WHEN free_days > 0 THEN 'available'
              ELSE 'unavailable' END
    FROM flags;
$$;
REVOKE EXECUTE ON FUNCTION public.mu_availability_state(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_availability_state(uuid, date, date) TO authenticated, service_role;

-- 5. Matcher weight
INSERT INTO public.mu_match_weights(key, weight, label)
VALUES ('availability_fit', 10, 'Availability in the requested window')
ON CONFLICT (key) DO NOTHING;