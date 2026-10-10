-- Pass 7.5E: what actually happens during care, for one care episode.
--   care_observations     a time-specific fact: a reading, a symptom, a finding,
--                         an observed state ("more confused than usual").
--   care_interventions    something done to or for the person (a dressing, a
--                         feed, oxygen started), linked to the observation before
--                         it; the follow-up observation links back to it.
--   care_goal_evidence    evidence towards an existing care plan goal. No
--                         percentages and no progress score.
-- (docs/care-platform/delivery-architecture.md, sections 3, 5, 11 and 12.)
--
-- Records are never edited or deleted. A correction is a successor row that
-- points at the record it corrects; "entered in error" is a successor too.
-- A record can raise a care flag, which the existing flag trigger turns into
-- a work item for the care team.
--
-- Writers, all through these functions: clinical staff; a care worker with app
-- access and an active assignment on the episode; and, for observations only,
-- a family member with the clinical scope against a monitoring item that
-- permits self-entry. Additive: new tables and functions only.

-- ---------------------------------------------------------------- observations
CREATE TABLE IF NOT EXISTS public.care_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.care_episodes(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL,
  visit_id uuid,                       -- care_visits arrives later; no reference yet
  monitoring_item_id uuid REFERENCES public.care_monitoring_items(id) ON DELETE RESTRICT,
  observation_type text NOT NULL CHECK (observation_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  observed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  performer_user_id uuid,
  performer_person_id uuid,
  performer_capability text NOT NULL CHECK (performer_capability IN ('care_worker','clinical','family')),
  source text NOT NULL CHECK (source IN ('manual','device','import','family_self_entry')),
  value jsonb NOT NULL CHECK (jsonb_typeof(value) = 'object'),
  unit text,
  qualifiers jsonb CHECK (qualifiers IS NULL OR jsonb_typeof(qualifiers) = 'object'),
  note text CHECK (note IS NULL OR length(note) <= 4000),
  visibility text NOT NULL CHECK (visibility IN ('family','care_team','professional','safeguarding')),
  status text NOT NULL DEFAULT 'final' CHECK (status IN ('final','entered_in_error')),
  corrects_id uuid REFERENCES public.care_observations(id) ON DELETE RESTRICT,
  correction_reason text,
  after_intervention_id uuid,          -- reference added below, once interventions exist
  flag_id uuid REFERENCES public.care_flags(id) ON DELETE SET NULL,
  CHECK ((corrects_id IS NULL) = (correction_reason IS NULL)),
  CHECK (status = 'final' OR corrects_id IS NOT NULL),
  CHECK (source <> 'family_self_entry' OR (performer_capability = 'family' AND visibility = 'family'))
);

-- ---------------------------------------------------------------- interventions
CREATE TABLE IF NOT EXISTS public.care_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.care_episodes(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL,
  visit_id uuid,
  intervention_type text NOT NULL CHECK (intervention_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  performed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  performer_user_id uuid,
  performer_person_id uuid,
  performer_capability text NOT NULL CHECK (performer_capability IN ('care_worker','clinical')),
  detail jsonb CHECK (detail IS NULL OR jsonb_typeof(detail) = 'object'),
  outcome text CHECK (outcome IS NULL OR outcome IN ('completed','partial','declined','not_possible')),
  note text CHECK (note IS NULL OR length(note) <= 4000),
  before_observation_id uuid REFERENCES public.care_observations(id) ON DELETE RESTRICT,
  visibility text NOT NULL CHECK (visibility IN ('family','care_team','professional','safeguarding')),
  status text NOT NULL DEFAULT 'final' CHECK (status IN ('final','entered_in_error')),
  corrects_id uuid REFERENCES public.care_interventions(id) ON DELETE RESTRICT,
  correction_reason text,
  flag_id uuid REFERENCES public.care_flags(id) ON DELETE SET NULL,
  CHECK ((corrects_id IS NULL) = (correction_reason IS NULL)),
  CHECK (status = 'final' OR corrects_id IS NOT NULL)
);

DO $fk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'care_observations_after_intervention_fkey') THEN
    ALTER TABLE public.care_observations ADD CONSTRAINT care_observations_after_intervention_fkey
      FOREIGN KEY (after_intervention_id) REFERENCES public.care_interventions(id) ON DELETE RESTRICT;
  END IF;
END
$fk$;

-- ---------------------------------------------------------------- goal evidence
CREATE TABLE IF NOT EXISTS public.care_goal_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.care_episodes(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL,
  visit_id uuid,
  goal_id uuid NOT NULL REFERENCES public.care_plan_goals(id) ON DELETE RESTRICT,
  observed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  performer_user_id uuid,
  performer_person_id uuid,
  performer_capability text NOT NULL CHECK (performer_capability IN ('care_worker','clinical')),
  evidence_type text NOT NULL CHECK (evidence_type IN ('observed','reported','measured')),
  support_level text CHECK (support_level IS NULL OR support_level IN
    ('independent','prompted','partial_assistance','full_assistance','not_attempted')),
  frequency integer CHECK (frequency IS NULL OR frequency BETWEEN 0 AND 1000),
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 0 AND 1440),
  opportunity_count integer CHECK (opportunity_count IS NULL OR opportunity_count BETWEEN 0 AND 1000),
  note text CHECK (note IS NULL OR length(note) <= 4000),
  visibility text NOT NULL CHECK (visibility IN ('family','care_team','professional','safeguarding')),
  status text NOT NULL DEFAULT 'final' CHECK (status IN ('final','entered_in_error')),
  corrects_id uuid REFERENCES public.care_goal_evidence(id) ON DELETE RESTRICT,
  correction_reason text,
  flag_id uuid REFERENCES public.care_flags(id) ON DELETE SET NULL,
  CHECK ((corrects_id IS NULL) = (correction_reason IS NULL)),
  CHECK (status = 'final' OR corrects_id IS NOT NULL),
  CHECK (frequency IS NULL OR opportunity_count IS NULL OR frequency <= opportunity_count)
);

CREATE INDEX IF NOT EXISTS care_observations_episode_idx ON public.care_observations(episode_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS care_interventions_episode_idx ON public.care_interventions(episode_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS care_goal_evidence_episode_idx ON public.care_goal_evidence(episode_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS care_goal_evidence_goal_idx ON public.care_goal_evidence(goal_id, observed_at DESC);
-- A record is corrected at most once; the successor is the one to correct next.
CREATE UNIQUE INDEX IF NOT EXISTS care_observations_successor_idx
  ON public.care_observations(corrects_id) WHERE corrects_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS care_interventions_successor_idx
  ON public.care_interventions(corrects_id) WHERE corrects_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS care_goal_evidence_successor_idx
  ON public.care_goal_evidence(corrects_id) WHERE corrects_id IS NOT NULL;

-- Staff read the tables directly (history included); everyone else reads
-- through care_delivery_read. No one writes directly.
REVOKE ALL ON public.care_observations, public.care_interventions, public.care_goal_evidence FROM anon, authenticated;
GRANT SELECT ON public.care_observations, public.care_interventions, public.care_goal_evidence TO authenticated;
GRANT ALL ON public.care_observations, public.care_interventions, public.care_goal_evidence TO service_role;
ALTER TABLE public.care_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_goal_evidence ENABLE ROW LEVEL SECURITY;

-- Policies use only functions the authenticated role can execute. Created only
-- when missing, so the file can be applied twice without a DROP.
DO $policies$
DECLARE _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['care_observations','care_interventions','care_goal_evidence'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                    AND tablename = _t AND policyname = 'Care staff read delivery records') THEN
      EXECUTE format(
        'CREATE POLICY "Care staff read delivery records" ON public.%I FOR SELECT TO authenticated
           USING (private.care_clinical_ok()
                  OR (private.has_role(auth.uid(), ''admin''::app_role)
                      AND private.has_admin_permission(auth.uid(), ''care_coordinator'')))', _t);
    END IF;
  END LOOP;
END
$policies$;

-- ---------------------------------------------------------------- immutability
-- Nothing is edited or deleted. The one change allowed is the flag link
-- clearing itself when a flag is removed (ON DELETE SET NULL).
CREATE OR REPLACE FUNCTION private.care_delivery_record_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Care records are never deleted; record a correction instead';
  END IF;
  IF (to_jsonb(NEW) - 'flag_id') IS DISTINCT FROM (to_jsonb(OLD) - 'flag_id')
     OR (NEW.flag_id IS NOT NULL AND NEW.flag_id IS DISTINCT FROM OLD.flag_id) THEN
    RAISE EXCEPTION 'Care records are never edited; record a correction instead';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.care_delivery_record_guard() FROM public, anon, authenticated;

DO $triggers$
DECLARE _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['care_observations','care_interventions','care_goal_evidence'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = _t || '_guard'
                    AND tgrelid = ('public.' || _t)::regclass) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I
                        FOR EACH ROW EXECUTE FUNCTION private.care_delivery_record_guard()',
                     _t || '_guard', _t);
    END IF;
  END LOOP;
END
$triggers$;

-- ---------------------------------------------------------------- helpers
-- Who is recording for this episode, or an error. Returns
-- {capability, person_id}. Coordinators read but do not record.
CREATE OR REPLACE FUNCTION private.care_delivery_actor(_episode_id uuid, _allow_family boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _e public.care_episodes%ROWTYPE; _me uuid := public.mu_my_person_id();
BEGIN
  SELECT * INTO _e FROM public.care_episodes WHERE id = _episode_id;
  IF NOT FOUND OR _e.status NOT IN ('active','paused') THEN
    RAISE EXCEPTION 'That care episode is not running';
  END IF;
  IF private.care_clinical_ok() THEN
    RETURN jsonb_build_object('capability', 'clinical', 'person_id', _me);
  END IF;
  IF _me IS NOT NULL AND private.care_worker_ok(_me) AND EXISTS (
       SELECT 1 FROM public.care_delivery_assignments a
        WHERE a.episode_id = _episode_id AND a.person_id = _me AND a.status = 'active') THEN
    RETURN jsonb_build_object('capability', 'care_worker', 'person_id', _me);
  END IF;
  IF _allow_family AND private.care_has_scope(_e.client_id, 'clinical') THEN
    RETURN jsonb_build_object('capability', 'family', 'person_id', NULL);
  END IF;
  RAISE EXCEPTION 'You cannot record care for this episode';
END;
$$;

-- Which visibility levels the caller may read for this episode, or null.
-- The same tiers as care_monitoring_read.
CREATE OR REPLACE FUNCTION private.care_delivery_levels(_episode_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _client uuid; _me uuid := public.mu_my_person_id();
BEGIN
  SELECT client_id INTO _client FROM public.care_episodes WHERE id = _episode_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF private.care_clinical_ok() OR private.care_ops_ok() THEN
    RETURN ARRAY['family','care_team','professional','safeguarding'];
  END IF;
  IF _me IS NOT NULL AND private.care_worker_ok(_me) AND EXISTS (
       SELECT 1 FROM public.care_delivery_assignments a
        WHERE a.episode_id = _episode_id AND a.person_id = _me
          AND a.status IN ('planned','active')) THEN
    RETURN ARRAY['family','care_team'];
  END IF;
  IF private.care_has_scope(_client, 'clinical') THEN
    RETURN ARRAY['family'];
  END IF;
  RETURN NULL;
END;
$$;

-- Rejects unknown fields, so a typo never silently drops data.
CREATE OR REPLACE FUNCTION private.care_delivery_keys(_payload jsonb, _known text[], _what text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'private'
AS $$
DECLARE _k text;
BEGIN
  IF _payload IS NULL OR jsonb_typeof(_payload) <> 'object' THEN
    RAISE EXCEPTION 'A % must be an object', _what;
  END IF;
  FOR _k IN SELECT jsonb_object_keys(_payload) LOOP
    IF NOT _k = ANY (_known) THEN
      RAISE EXCEPTION 'Unknown % field: %', _what, _k;
    END IF;
  END LOOP;
END;
$$;

-- An optional escalation: {"severity": "review"|"urgent", "detail": "..."}.
-- Raises a care flag (which makes a work item) and returns its id.
CREATE OR REPLACE FUNCTION private.care_delivery_escalate(_client_id uuid, _esc jsonb, _visibility text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _id uuid; _detail text;
BEGIN
  IF _esc IS NULL OR _esc = 'null'::jsonb THEN RETURN NULL; END IF;
  PERFORM private.care_delivery_keys(_esc, ARRAY['severity','detail'], 'escalation');
  IF COALESCE(_esc->>'severity', '') NOT IN ('review','urgent') THEN
    RAISE EXCEPTION 'An escalation needs a severity of review or urgent';
  END IF;
  _detail := NULLIF(btrim(COALESCE(_esc->>'detail', '')), '');
  IF _detail IS NULL OR length(_detail) > 2000 THEN
    RAISE EXCEPTION 'Say what the concern is (up to 2000 characters)';
  END IF;
  INSERT INTO public.care_flags (client_id, kind, severity, detail, raised_by)
  VALUES (_client_id,
          CASE WHEN _visibility = 'safeguarding' THEN 'safeguarding' ELSE 'clinical_review' END,
          _esc->>'severity', _detail, 'care_delivery')
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Clinical staff may correct anything; anyone else only their own records,
-- and only while they can still record for the episode.
CREATE OR REPLACE FUNCTION private.care_delivery_may_correct(_actor jsonb, _performer uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF _actor->>'capability' <> 'clinical' AND _performer IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the person who recorded this, or clinical staff, can correct it';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.care_delivery_reason(_reason text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Give a reason for the correction';
  END IF;
  RETURN btrim(_reason);
END;
$$;

CREATE OR REPLACE FUNCTION private.care_delivery_when(_at text)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'private'
AS $$
DECLARE _t timestamptz := COALESCE(NULLIF(_at, '')::timestamptz, now());
BEGIN
  IF _t > now() + interval '10 minutes' THEN
    RAISE EXCEPTION 'A care record cannot be in the future';
  END IF;
  RETURN _t;
END;
$$;

-- Inserts one observation from a payload. Used for new records and corrections.
CREATE OR REPLACE FUNCTION private.care_observation_insert(
  _episode_id uuid, _o jsonb, _actor jsonb, _corrects uuid, _reason text, _status text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  _e public.care_episodes%ROWTYPE;
  _item public.care_monitoring_items%ROWTYPE;
  _type text := lower(NULLIF(btrim(COALESCE(_o->>'observation_type', '')), ''));
  _vis text := NULLIF(btrim(COALESCE(_o->>'visibility', '')), '');
  _source text := COALESCE(NULLIF(btrim(COALESCE(_o->>'source', '')), ''), 'manual');
  _cap text := _actor->>'capability';
  _after uuid := NULLIF(_o->>'after_intervention_id', '')::uuid;
  _id uuid;
BEGIN
  PERFORM private.care_delivery_keys(_o, ARRAY['observation_type','monitoring_item_id','visit_id',
    'after_intervention_id','observed_at','source','value','unit','qualifiers','note','visibility',
    'escalate'], 'observation');
  SELECT * INTO _e FROM public.care_episodes WHERE id = _episode_id;

  IF NULLIF(_o->>'monitoring_item_id', '') IS NOT NULL THEN
    SELECT i.* INTO _item FROM public.care_monitoring_items i
      JOIN public.care_monitoring_plans p ON p.id = i.plan_id
     WHERE i.id = (_o->>'monitoring_item_id')::uuid AND p.episode_id = _episode_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That monitoring item is not part of this care episode';
    END IF;
    IF _corrects IS NULL AND _item.status <> 'active' THEN
      RAISE EXCEPTION 'That monitoring item has stopped';
    END IF;
    _type := COALESCE(_type, _item.observation_type);
    IF _type <> _item.observation_type THEN
      RAISE EXCEPTION 'This monitoring item is for %, not %', _item.observation_type, _type;
    END IF;
    _vis := COALESCE(_vis, _item.visibility);
  END IF;
  IF _type IS NULL THEN RAISE EXCEPTION 'An observation needs a type'; END IF;

  IF _cap = 'family' THEN
    IF _item.id IS NULL OR NOT _item.self_entry_permitted THEN
      RAISE EXCEPTION 'Family entries must be for a monitoring item that allows them';
    END IF;
    _vis := 'family';
    _source := 'family_self_entry';
  ELSIF _source NOT IN ('manual','device','import') THEN
    RAISE EXCEPTION 'Source must be manual, device or import';
  END IF;

  IF _o->'value' IS NULL OR jsonb_typeof(_o->'value') <> 'object' OR _o->'value' = '{}'::jsonb THEN
    RAISE EXCEPTION 'An observation needs a value, such as {"systolic": 120, "diastolic": 80} or {"text": "..."}';
  END IF;
  IF _o ? 'qualifiers' AND jsonb_typeof(_o->'qualifiers') NOT IN ('object','null') THEN
    RAISE EXCEPTION 'Qualifiers must be an object';
  END IF;
  IF _after IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.care_interventions WHERE id = _after AND episode_id = _episode_id) THEN
    RAISE EXCEPTION 'That intervention is not part of this care episode';
  END IF;
  _vis := COALESCE(_vis, 'care_team');

  INSERT INTO public.care_observations (
    episode_id, client_id, visit_id, monitoring_item_id, observation_type, observed_at,
    performer_user_id, performer_person_id, performer_capability, source, value, unit,
    qualifiers, note, visibility, status, corrects_id, correction_reason,
    after_intervention_id, flag_id)
  VALUES (
    _episode_id, _e.client_id, NULLIF(_o->>'visit_id', '')::uuid, _item.id, _type,
    private.care_delivery_when(_o->>'observed_at'),
    auth.uid(), NULLIF(_actor->>'person_id', '')::uuid, _cap, _source, _o->'value',
    NULLIF(btrim(COALESCE(_o->>'unit', '')), ''), NULLIF(_o->'qualifiers', 'null'::jsonb),
    NULLIF(btrim(COALESCE(_o->>'note', '')), ''), _vis, _status, _corrects, _reason, _after,
    private.care_delivery_escalate(_e.client_id, _o->'escalate', _vis))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION private.care_intervention_insert(
  _episode_id uuid, _i jsonb, _actor jsonb, _corrects uuid, _reason text, _status text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  _client uuid;
  _type text := lower(NULLIF(btrim(COALESCE(_i->>'intervention_type', '')), ''));
  _vis text := COALESCE(NULLIF(btrim(COALESCE(_i->>'visibility', '')), ''), 'care_team');
  _before uuid := NULLIF(_i->>'before_observation_id', '')::uuid;
  _id uuid;
BEGIN
  PERFORM private.care_delivery_keys(_i, ARRAY['intervention_type','visit_id','performed_at',
    'detail','outcome','note','before_observation_id','visibility','escalate'], 'intervention');
  SELECT client_id INTO _client FROM public.care_episodes WHERE id = _episode_id;
  IF _type IS NULL THEN RAISE EXCEPTION 'An intervention needs a type'; END IF;
  IF _i ? 'detail' AND jsonb_typeof(_i->'detail') NOT IN ('object','null') THEN
    RAISE EXCEPTION 'Intervention detail must be an object';
  END IF;
  IF _before IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.care_observations WHERE id = _before AND episode_id = _episode_id) THEN
    RAISE EXCEPTION 'That observation is not part of this care episode';
  END IF;

  INSERT INTO public.care_interventions (
    episode_id, client_id, visit_id, intervention_type, performed_at, performer_user_id,
    performer_person_id, performer_capability, detail, outcome, note, before_observation_id,
    visibility, status, corrects_id, correction_reason, flag_id)
  VALUES (
    _episode_id, _client, NULLIF(_i->>'visit_id', '')::uuid, _type,
    private.care_delivery_when(_i->>'performed_at'), auth.uid(),
    NULLIF(_actor->>'person_id', '')::uuid, _actor->>'capability',
    NULLIF(_i->'detail', 'null'::jsonb), NULLIF(btrim(COALESCE(_i->>'outcome', '')), ''),
    NULLIF(btrim(COALESCE(_i->>'note', '')), ''), _before, _vis, _status, _corrects, _reason,
    private.care_delivery_escalate(_client, _i->'escalate', _vis))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION private.care_goal_evidence_insert(
  _episode_id uuid, _g jsonb, _actor jsonb, _corrects uuid, _reason text, _status text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  _client uuid;
  _goal uuid := NULLIF(_g->>'goal_id', '')::uuid;
  _vis text := COALESCE(NULLIF(btrim(COALESCE(_g->>'visibility', '')), ''), 'care_team');
  _id uuid;
BEGIN
  PERFORM private.care_delivery_keys(_g, ARRAY['goal_id','visit_id','observed_at','evidence_type',
    'support_level','frequency','duration_minutes','opportunity_count','note','visibility',
    'escalate'], 'goal evidence');
  SELECT client_id INTO _client FROM public.care_episodes WHERE id = _episode_id;
  IF _goal IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.care_plan_goals WHERE id = _goal AND client_id = _client) THEN
    RAISE EXCEPTION 'That goal is not in this client''s care plan';
  END IF;

  INSERT INTO public.care_goal_evidence (
    episode_id, client_id, visit_id, goal_id, observed_at, performer_user_id, performer_person_id,
    performer_capability, evidence_type, support_level, frequency, duration_minutes,
    opportunity_count, note, visibility, status, corrects_id, correction_reason, flag_id)
  VALUES (
    _episode_id, _client, NULLIF(_g->>'visit_id', '')::uuid, _goal,
    private.care_delivery_when(_g->>'observed_at'), auth.uid(),
    NULLIF(_actor->>'person_id', '')::uuid, _actor->>'capability',
    COALESCE(NULLIF(btrim(COALESCE(_g->>'evidence_type', '')), ''), 'observed'),
    NULLIF(btrim(COALESCE(_g->>'support_level', '')), ''),
    (_g->>'frequency')::integer, (_g->>'duration_minutes')::integer,
    (_g->>'opportunity_count')::integer,
    NULLIF(btrim(COALESCE(_g->>'note', '')), ''), _vis, _status, _corrects, _reason,
    private.care_delivery_escalate(_client, _g->'escalate', _vis))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION private.care_delivery_actor(uuid, boolean) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.care_delivery_levels(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.care_delivery_keys(jsonb, text[], text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.care_delivery_escalate(uuid, jsonb, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.care_delivery_may_correct(jsonb, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.care_delivery_reason(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.care_delivery_when(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.care_observation_insert(uuid, jsonb, jsonb, uuid, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.care_intervention_insert(uuid, jsonb, jsonb, uuid, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.care_goal_evidence_insert(uuid, jsonb, jsonb, uuid, text, text) FROM public, anon, authenticated;

-- ---------------------------------------------------------------- writes
CREATE OR REPLACE FUNCTION public.care_observation_record(_episode_id uuid, _observation jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  RETURN private.care_observation_insert(_episode_id, _observation,
    private.care_delivery_actor(_episode_id, true), NULL, NULL, 'final');
END;
$$;

CREATE OR REPLACE FUNCTION public.care_intervention_record(_episode_id uuid, _intervention jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  RETURN private.care_intervention_insert(_episode_id, _intervention,
    private.care_delivery_actor(_episode_id, false), NULL, NULL, 'final');
END;
$$;

CREATE OR REPLACE FUNCTION public.care_goal_evidence_record(_episode_id uuid, _evidence jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  RETURN private.care_goal_evidence_insert(_episode_id, _evidence,
    private.care_delivery_actor(_episode_id, false), NULL, NULL, 'final');
END;
$$;

-- A correction is a new record carrying the original's fields overlaid with the
-- changes. With no changes (null), the successor marks the original entered in
-- error. The original row is never touched.
CREATE OR REPLACE FUNCTION public.care_observation_correct(_id uuid, _changes jsonb, _reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _old public.care_observations%ROWTYPE; _actor jsonb; _r text := private.care_delivery_reason(_reason);
BEGIN
  SELECT * INTO _old FROM public.care_observations WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That observation does not exist'; END IF;
  IF EXISTS (SELECT 1 FROM public.care_observations WHERE corrects_id = _id) THEN
    RAISE EXCEPTION 'That observation has already been corrected; correct the latest version';
  END IF;
  IF _old.status <> 'final' THEN RAISE EXCEPTION 'That observation was entered in error'; END IF;
  _actor := private.care_delivery_actor(_old.episode_id, true);
  PERFORM private.care_delivery_may_correct(_actor, _old.performer_user_id);
  IF _changes ? 'monitoring_item_id' OR _changes ? 'observation_type' THEN
    RAISE EXCEPTION 'A correction cannot change what was observed; record a new observation';
  END IF;
  RETURN private.care_observation_insert(_old.episode_id,
    jsonb_strip_nulls(jsonb_build_object(
      'observation_type', _old.observation_type, 'monitoring_item_id', _old.monitoring_item_id,
      'visit_id', _old.visit_id, 'after_intervention_id', _old.after_intervention_id,
      'observed_at', _old.observed_at, 'source', _old.source, 'value', _old.value,
      'unit', _old.unit, 'qualifiers', _old.qualifiers, 'note', _old.note,
      'visibility', _old.visibility))
      || COALESCE(_changes, '{}'::jsonb),
    _actor, _id, _r, CASE WHEN _changes IS NULL THEN 'entered_in_error' ELSE 'final' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.care_intervention_correct(_id uuid, _changes jsonb, _reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _old public.care_interventions%ROWTYPE; _actor jsonb; _r text := private.care_delivery_reason(_reason);
BEGIN
  SELECT * INTO _old FROM public.care_interventions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That intervention does not exist'; END IF;
  IF EXISTS (SELECT 1 FROM public.care_interventions WHERE corrects_id = _id) THEN
    RAISE EXCEPTION 'That intervention has already been corrected; correct the latest version';
  END IF;
  IF _old.status <> 'final' THEN RAISE EXCEPTION 'That intervention was entered in error'; END IF;
  _actor := private.care_delivery_actor(_old.episode_id, false);
  PERFORM private.care_delivery_may_correct(_actor, _old.performer_user_id);
  IF _changes ? 'intervention_type' THEN
    RAISE EXCEPTION 'A correction cannot change what was done; record a new intervention';
  END IF;
  RETURN private.care_intervention_insert(_old.episode_id,
    jsonb_strip_nulls(jsonb_build_object(
      'intervention_type', _old.intervention_type, 'visit_id', _old.visit_id,
      'performed_at', _old.performed_at, 'detail', _old.detail, 'outcome', _old.outcome,
      'note', _old.note, 'before_observation_id', _old.before_observation_id,
      'visibility', _old.visibility))
      || COALESCE(_changes, '{}'::jsonb),
    _actor, _id, _r, CASE WHEN _changes IS NULL THEN 'entered_in_error' ELSE 'final' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.care_goal_evidence_correct(_id uuid, _changes jsonb, _reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE _old public.care_goal_evidence%ROWTYPE; _actor jsonb; _r text := private.care_delivery_reason(_reason);
BEGIN
  SELECT * INTO _old FROM public.care_goal_evidence WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That goal evidence does not exist'; END IF;
  IF EXISTS (SELECT 1 FROM public.care_goal_evidence WHERE corrects_id = _id) THEN
    RAISE EXCEPTION 'That goal evidence has already been corrected; correct the latest version';
  END IF;
  IF _old.status <> 'final' THEN RAISE EXCEPTION 'That goal evidence was entered in error'; END IF;
  _actor := private.care_delivery_actor(_old.episode_id, false);
  PERFORM private.care_delivery_may_correct(_actor, _old.performer_user_id);
  IF _changes ? 'goal_id' THEN
    RAISE EXCEPTION 'A correction cannot move evidence to another goal; record new evidence';
  END IF;
  RETURN private.care_goal_evidence_insert(_old.episode_id,
    jsonb_strip_nulls(jsonb_build_object(
      'goal_id', _old.goal_id, 'visit_id', _old.visit_id, 'observed_at', _old.observed_at,
      'evidence_type', _old.evidence_type, 'support_level', _old.support_level,
      'frequency', _old.frequency, 'duration_minutes', _old.duration_minutes,
      'opportunity_count', _old.opportunity_count, 'note', _old.note,
      'visibility', _old.visibility))
      || COALESCE(_changes, '{}'::jsonb),
    _actor, _id, _r, CASE WHEN _changes IS NULL THEN 'entered_in_error' ELSE 'final' END);
END;
$$;

-- ---------------------------------------------------------------- reads
-- The current version of each record for an episode, newest first, filtered by
-- who is asking (see care_delivery_levels). Superseded versions are left out;
-- staff see entered-in-error markers, others do not. Staff read history from
-- the tables directly. Anyone without access gets null.
CREATE OR REPLACE FUNCTION public.care_delivery_read(_episode_id uuid, _since timestamptz DEFAULT NULL,
                                                     _limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  _levels text[] := private.care_delivery_levels(_episode_id);
  _staff boolean;
  _n integer := LEAST(GREATEST(COALESCE(_limit, 200), 1), 1000);
BEGIN
  IF _levels IS NULL THEN RETURN NULL; END IF;
  _staff := 'professional' = ANY (_levels);

  RETURN jsonb_build_object(
    'episode_id', _episode_id,
    'observations', COALESCE((
      SELECT jsonb_agg(r ORDER BY (r->>'observed_at')::timestamptz DESC) FROM (
        SELECT jsonb_build_object(
                 'id', o.id, 'observation_type', o.observation_type,
                 'monitoring_item_id', o.monitoring_item_id, 'visit_id', o.visit_id,
                 'observed_at', o.observed_at, 'recorded_at', o.recorded_at,
                 'performer_capability', o.performer_capability, 'source', o.source,
                 'value', o.value, 'unit', o.unit, 'qualifiers', o.qualifiers, 'note', o.note,
                 'visibility', o.visibility, 'status', o.status, 'corrects_id', o.corrects_id,
                 'after_intervention_id', o.after_intervention_id,
                 'flag_id', CASE WHEN _staff THEN o.flag_id END) AS r
          FROM public.care_observations o
         WHERE o.episode_id = _episode_id AND o.visibility = ANY (_levels)
           AND (_staff OR o.status = 'final')
           AND (_since IS NULL OR o.observed_at >= _since)
           AND NOT EXISTS (SELECT 1 FROM public.care_observations s WHERE s.corrects_id = o.id)
         ORDER BY o.observed_at DESC LIMIT _n) x), '[]'::jsonb),
    'interventions', COALESCE((
      SELECT jsonb_agg(r ORDER BY (r->>'performed_at')::timestamptz DESC) FROM (
        SELECT jsonb_build_object(
                 'id', i.id, 'intervention_type', i.intervention_type, 'visit_id', i.visit_id,
                 'performed_at', i.performed_at, 'recorded_at', i.recorded_at,
                 'performer_capability', i.performer_capability, 'detail', i.detail,
                 'outcome', i.outcome, 'note', i.note,
                 'before_observation_id', i.before_observation_id,
                 'visibility', i.visibility, 'status', i.status, 'corrects_id', i.corrects_id,
                 'flag_id', CASE WHEN _staff THEN i.flag_id END) AS r
          FROM public.care_interventions i
         WHERE i.episode_id = _episode_id AND i.visibility = ANY (_levels)
           AND (_staff OR i.status = 'final')
           AND (_since IS NULL OR i.performed_at >= _since)
           AND NOT EXISTS (SELECT 1 FROM public.care_interventions s WHERE s.corrects_id = i.id)
         ORDER BY i.performed_at DESC LIMIT _n) x), '[]'::jsonb),
    'goal_evidence', COALESCE((
      SELECT jsonb_agg(r ORDER BY (r->>'observed_at')::timestamptz DESC) FROM (
        SELECT jsonb_build_object(
                 'id', g.id, 'goal_id', g.goal_id, 'goal_title', pg.title, 'visit_id', g.visit_id,
                 'observed_at', g.observed_at, 'recorded_at', g.recorded_at,
                 'performer_capability', g.performer_capability, 'evidence_type', g.evidence_type,
                 'support_level', g.support_level, 'frequency', g.frequency,
                 'duration_minutes', g.duration_minutes, 'opportunity_count', g.opportunity_count,
                 'note', g.note, 'visibility', g.visibility, 'status', g.status,
                 'corrects_id', g.corrects_id,
                 'flag_id', CASE WHEN _staff THEN g.flag_id END) AS r
          FROM public.care_goal_evidence g
          JOIN public.care_plan_goals pg ON pg.id = g.goal_id
         WHERE g.episode_id = _episode_id AND g.visibility = ANY (_levels)
           AND (_staff OR g.status = 'final')
           AND (_since IS NULL OR g.observed_at >= _since)
           AND NOT EXISTS (SELECT 1 FROM public.care_goal_evidence s WHERE s.corrects_id = g.id)
         ORDER BY g.observed_at DESC LIMIT _n) x), '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.care_observation_record(uuid, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_intervention_record(uuid, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_goal_evidence_record(uuid, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_observation_correct(uuid, jsonb, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_intervention_correct(uuid, jsonb, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_goal_evidence_correct(uuid, jsonb, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.care_delivery_read(uuid, timestamptz, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.care_observation_record(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_intervention_record(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_goal_evidence_record(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_observation_correct(uuid, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_intervention_correct(uuid, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_goal_evidence_correct(uuid, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_delivery_read(uuid, timestamptz, integer) TO authenticated, service_role;
