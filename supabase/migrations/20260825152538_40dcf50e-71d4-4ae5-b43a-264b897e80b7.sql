-- Care delivery: assessment, plan, package, roster and the visit itself.
--
-- Same grammar as the rest of the care schema: nothing is on the Data API,
-- every read and write goes through a SECURITY DEFINER function in public that
-- re-checks care_can(...) first. Care plans are versioned and superseded,
-- never edited in place once published.

/* ------------------------------------------------------------- assessment */

CREATE TABLE IF NOT EXISTS care.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES care.clients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  scheduled_for timestamptz,
  completed_at timestamptz,
  assessor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  attendees text,
  summary text,
  risks text,
  equipment text,
  environment text,
  fee_status text NOT NULL DEFAULT 'due',
  fee_amount numeric(12,2) NOT NULL DEFAULT 35000,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS care.assessment_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES care.assessments(id) ON DELETE CASCADE,
  domain text NOT NULL,
  need text,
  support text,
  risk_level text NOT NULL DEFAULT 'none',
  sort_order integer NOT NULL DEFAULT 100,
  UNIQUE (assessment_id, domain)
);

/* -------------------------------------------------------------- care plan */

CREATE TABLE IF NOT EXISTS care.care_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES care.clients(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES care.assessments(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  summary text,
  what_matters text,
  review_due date,
  published_at timestamptz,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  superseded_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS care.plan_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES care.care_plans(id) ON DELETE CASCADE,
  goal text NOT NULL,
  measure text,
  sort_order integer NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS care.plan_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES care.care_plans(id) ON DELETE CASCADE,
  domain text NOT NULL DEFAULT 'personal_care',
  task text NOT NULL,
  detail text,
  frequency text NOT NULL DEFAULT 'every_visit',
  sort_order integer NOT NULL DEFAULT 100
);

/* ------------------------------------------------------- package and rota */

CREATE TABLE IF NOT EXISTS care.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES care.clients(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES care.care_plans(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'Care package',
  status text NOT NULL DEFAULT 'draft',
  arrangement text NOT NULL DEFAULT 'visiting',
  role_needed text,
  worker_sex_preference text,
  start_date date,
  end_date date,
  client_rate_hourly numeric(12,2),
  worker_rate_hourly numeric(12,2),
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS care.package_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES care.packages(id) ON DELETE CASCADE,
  weekday integer NOT NULL,
  start_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  carers integer NOT NULL DEFAULT 1,
  label text,
  sort_order integer NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS care.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES care.clients(id) ON DELETE CASCADE,
  package_id uuid REFERENCES care.packages(id) ON DELETE SET NULL,
  pattern_id uuid REFERENCES care.package_patterns(id) ON DELETE SET NULL,
  visit_date date NOT NULL,
  start_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  slot integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'unfilled',
  worker_person_id uuid REFERENCES public.mu_people(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  visit_note text,
  concern text,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pattern_id, visit_date, slot)
);

CREATE TABLE IF NOT EXISTS care.visit_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES care.visits(id) ON DELETE CASCADE,
  plan_task_id uuid REFERENCES care.plan_tasks(id) ON DELETE SET NULL,
  task text NOT NULL,
  domain text,
  done boolean NOT NULL DEFAULT false,
  not_done_reason text,
  sort_order integer NOT NULL DEFAULT 100
);

CREATE INDEX IF NOT EXISTS idx_care_assessments_client ON care.assessments(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_plans_client ON care.care_plans(client_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_care_packages_client ON care.packages(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_visits_date ON care.visits(visit_date, start_time);
CREATE INDEX IF NOT EXISTS idx_care_visits_client ON care.visits(client_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_care_visits_worker ON care.visits(worker_person_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_care_visit_tasks_visit ON care.visit_tasks(visit_id, sort_order);

GRANT ALL ON care.assessments, care.assessment_domains, care.care_plans,
  care.plan_goals, care.plan_tasks, care.packages, care.package_patterns,
  care.visits, care.visit_tasks TO service_role;

ALTER TABLE care.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.assessment_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.care_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.plan_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.plan_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.package_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.visit_tasks ENABLE ROW LEVEL SECURITY;

-- No permissive policies. The definer functions below are the only door.

/* ------------------------------------------------- enquiry becomes client */

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS care_client_id uuid;

CREATE INDEX IF NOT EXISTS contact_submissions_care_client_idx
  ON public.contact_submissions(care_client_id);

CREATE OR REPLACE FUNCTION public.care_client_from_enquiry(_enquiry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  e record;
  new_id uuid;
  needs text;
BEGIN
  IF NOT public.care_can('care.edit_clients') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  SELECT * INTO e FROM public.contact_submissions WHERE id = _enquiry_id;
  IF e IS NULL THEN
    RAISE EXCEPTION 'Enquiry not found';
  END IF;
  IF e.care_client_id IS NOT NULL THEN
    RETURN public.care_client_get(e.care_client_id);
  END IF;

  needs := coalesce(e.message, '');
  SELECT needs || coalesce(string_agg(chr(10) || k || ': ' || v, ''), '')
    INTO needs
    FROM jsonb_each_text(coalesce(e.answers, '{}'::jsonb)) AS t(k, v);

  INSERT INTO care.clients (
    reference, client_name, phone, email, lga, state,
    service_interest, care_needs, source, created_by, owner_user_id
  ) VALUES (
    care.next_client_reference(),
    coalesce(nullif(trim(e.name), ''), 'Unnamed enquiry'),
    nullif(e.phone, ''),
    nullif(e.email, ''),
    nullif(coalesce(e.answers->>'lga', ''), ''),
    nullif(coalesce(e.answers->>'state', e.city), ''),
    nullif(e.service_line, ''),
    nullif(needs, ''),
    coalesce(nullif(e.source, ''), 'enquiry_desk'),
    auth.uid(), auth.uid()
  ) RETURNING id INTO new_id;

  INSERT INTO care.client_contacts (client_id, full_name, phone, email, is_next_of_kin)
  VALUES (new_id, coalesce(nullif(trim(e.name), ''), 'Enquirer'),
          nullif(e.phone, ''), nullif(e.email, ''), true);

  INSERT INTO care.referrals (client_id, source, source_reference, contact_name,
    contact_phone, contact_email, summary, stage, owner_user_id)
  VALUES (new_id, 'enquiry_desk', _enquiry_id::text,
          nullif(trim(e.name), ''), nullif(e.phone, ''), nullif(e.email, ''),
          nullif(needs, ''), 'new', auth.uid());

  INSERT INTO care.client_stage_events (client_id, from_stage, to_stage, note, actor_user_id)
  VALUES (new_id, NULL, 'enquiry', 'Created from the enquiry desk', auth.uid());

  UPDATE public.contact_submissions
     SET care_client_id = new_id,
         stage = CASE WHEN stage IN ('new', 'contacted') THEN 'qualified' ELSE stage END
   WHERE id = _enquiry_id;

  PERFORM public.care_log('client', 'created_from_enquiry', new_id, new_id,
    jsonb_build_object('enquiry_id', _enquiry_id));

  RETURN public.care_client_get(new_id);
END; $function$;

REVOKE ALL ON FUNCTION public.care_client_from_enquiry(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.care_client_from_enquiry(uuid) TO authenticated, service_role;

/* ---------------------------------------------------------- assessment io */

CREATE OR REPLACE FUNCTION care.assessment_json(_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
  SELECT to_jsonb(a) || jsonb_build_object(
    'domains', coalesce((
      SELECT jsonb_agg(to_jsonb(d) ORDER BY d.sort_order, d.domain)
        FROM care.assessment_domains d WHERE d.assessment_id = a.id), '[]'::jsonb))
    FROM care.assessments a WHERE a.id = _id;
$function$;

CREATE OR REPLACE FUNCTION public.care_assessment_save(_client_id uuid, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  a_id uuid := nullif(_payload->>'id', '')::uuid;
  d jsonb;
BEGIN
  IF NOT public.care_can('care.edit_care_plans') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  IF a_id IS NULL THEN
    INSERT INTO care.assessments (client_id, scheduled_for, assessor_user_id, created_by)
    VALUES (_client_id, nullif(_payload->>'scheduled_for', '')::timestamptz, auth.uid(), auth.uid())
    RETURNING id INTO a_id;
  END IF;

  UPDATE care.assessments SET
    scheduled_for = coalesce(nullif(_payload->>'scheduled_for', '')::timestamptz, scheduled_for),
    attendees = coalesce(_payload->>'attendees', attendees),
    summary = coalesce(_payload->>'summary', summary),
    risks = coalesce(_payload->>'risks', risks),
    equipment = coalesce(_payload->>'equipment', equipment),
    environment = coalesce(_payload->>'environment', environment),
    fee_status = coalesce(nullif(_payload->>'fee_status', ''), fee_status),
    updated_at = now()
  WHERE id = a_id AND client_id = _client_id;

  IF jsonb_typeof(_payload->'domains') = 'array' THEN
    FOR d IN SELECT * FROM jsonb_array_elements(_payload->'domains') LOOP
      INSERT INTO care.assessment_domains (assessment_id, domain, need, support, risk_level, sort_order)
      VALUES (a_id, d->>'domain', nullif(d->>'need', ''), nullif(d->>'support', ''),
              coalesce(nullif(d->>'risk_level', ''), 'none'),
              coalesce((d->>'sort_order')::int, 100))
      ON CONFLICT (assessment_id, domain) DO UPDATE
        SET need = EXCLUDED.need,
            support = EXCLUDED.support,
            risk_level = EXCLUDED.risk_level,
            sort_order = EXCLUDED.sort_order;
    END LOOP;
  END IF;

  PERFORM public.care_log('assessment', 'save', _client_id, a_id, '{}'::jsonb);
  RETURN care.assessment_json(a_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.care_assessment_complete(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  c_id uuid;
BEGIN
  IF NOT public.care_can('care.edit_care_plans') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  UPDATE care.assessments
     SET status = 'complete', completed_at = now(), updated_at = now()
   WHERE id = _id
   RETURNING client_id INTO c_id;
  IF c_id IS NULL THEN
    RAISE EXCEPTION 'Assessment not found';
  END IF;

  UPDATE care.clients SET stage = 'assessment_done', updated_at = now()
   WHERE id = c_id AND stage IN ('enquiry', 'assessment_booked');

  PERFORM public.care_log('assessment', 'complete', c_id, _id, '{}'::jsonb);
  RETURN care.assessment_json(_id);
END; $function$;

REVOKE ALL ON FUNCTION public.care_assessment_save(uuid, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.care_assessment_complete(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.care_assessment_save(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_assessment_complete(uuid) TO authenticated, service_role;

/* ---------------------------------------------------------------- plan io */

CREATE OR REPLACE FUNCTION care.plan_json(_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
  SELECT to_jsonb(p) || jsonb_build_object(
    'goals', coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.sort_order)
                         FROM care.plan_goals g WHERE g.plan_id = p.id), '[]'::jsonb),
    'tasks', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.sort_order)
                         FROM care.plan_tasks t WHERE t.plan_id = p.id), '[]'::jsonb))
    FROM care.care_plans p WHERE p.id = _id;
$function$;

CREATE OR REPLACE FUNCTION public.care_plan_save(_client_id uuid, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  p_id uuid := nullif(_payload->>'id', '')::uuid;
  next_version integer;
  item jsonb;
  i integer := 0;
BEGIN
  IF NOT public.care_can('care.edit_care_plans') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  IF p_id IS NULL THEN
    SELECT coalesce(max(version), 0) + 1 INTO next_version
      FROM care.care_plans WHERE client_id = _client_id;
    INSERT INTO care.care_plans (client_id, assessment_id, version, created_by)
    VALUES (_client_id, nullif(_payload->>'assessment_id', '')::uuid, next_version, auth.uid())
    RETURNING id INTO p_id;
  END IF;

  IF EXISTS (SELECT 1 FROM care.care_plans WHERE id = p_id AND status <> 'draft') THEN
    RAISE EXCEPTION 'A published plan cannot be edited. Start a new version.';
  END IF;

  UPDATE care.care_plans SET
    summary = coalesce(_payload->>'summary', summary),
    what_matters = coalesce(_payload->>'what_matters', what_matters),
    review_due = coalesce(nullif(_payload->>'review_due', '')::date, review_due),
    updated_at = now()
  WHERE id = p_id AND client_id = _client_id;

  IF jsonb_typeof(_payload->'goals') = 'array' THEN
    DELETE FROM care.plan_goals WHERE plan_id = p_id;
    i := 0;
    FOR item IN SELECT * FROM jsonb_array_elements(_payload->'goals') LOOP
      i := i + 1;
      IF coalesce(trim(item->>'goal'), '') <> '' THEN
        INSERT INTO care.plan_goals (plan_id, goal, measure, sort_order)
        VALUES (p_id, trim(item->>'goal'), nullif(item->>'measure', ''), i * 10);
      END IF;
    END LOOP;
  END IF;

  IF jsonb_typeof(_payload->'tasks') = 'array' THEN
    DELETE FROM care.plan_tasks WHERE plan_id = p_id;
    i := 0;
    FOR item IN SELECT * FROM jsonb_array_elements(_payload->'tasks') LOOP
      i := i + 1;
      IF coalesce(trim(item->>'task'), '') <> '' THEN
        INSERT INTO care.plan_tasks (plan_id, domain, task, detail, frequency, sort_order)
        VALUES (p_id, coalesce(nullif(item->>'domain', ''), 'personal_care'),
                trim(item->>'task'), nullif(item->>'detail', ''),
                coalesce(nullif(item->>'frequency', ''), 'every_visit'), i * 10);
      END IF;
    END LOOP;
  END IF;

  PERFORM public.care_log('care_plan', 'save', _client_id, p_id, '{}'::jsonb);
  RETURN care.plan_json(p_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.care_plan_publish(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  c_id uuid;
BEGIN
  IF NOT public.care_can('care.approve_care_plans') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  SELECT client_id INTO c_id FROM care.care_plans WHERE id = _id;
  IF c_id IS NULL THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM care.plan_tasks WHERE plan_id = _id) THEN
    RAISE EXCEPTION 'A plan needs at least one task before it is published';
  END IF;

  UPDATE care.care_plans
     SET status = 'superseded', superseded_at = now(), updated_at = now()
   WHERE client_id = c_id AND status = 'published' AND id <> _id;

  UPDATE care.care_plans
     SET status = 'published', published_at = now(), published_by = auth.uid(), updated_at = now()
   WHERE id = _id;

  UPDATE care.clients SET stage = 'care_planned', updated_at = now()
   WHERE id = c_id AND stage IN ('enquiry', 'assessment_booked', 'assessment_done');

  PERFORM public.care_log('care_plan', 'publish', c_id, _id, '{}'::jsonb);
  RETURN care.plan_json(_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.care_plan_new_version(_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  live record;
  new_id uuid;
  next_version integer;
BEGIN
  IF NOT public.care_can('care.edit_care_plans') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  SELECT * INTO live FROM care.care_plans
   WHERE client_id = _client_id AND status = 'published'
   ORDER BY version DESC LIMIT 1;

  SELECT coalesce(max(version), 0) + 1 INTO next_version
    FROM care.care_plans WHERE client_id = _client_id;

  INSERT INTO care.care_plans (client_id, assessment_id, version, summary, what_matters, review_due, created_by)
  VALUES (_client_id, live.assessment_id, next_version, live.summary, live.what_matters, live.review_due, auth.uid())
  RETURNING id INTO new_id;

  IF live.id IS NOT NULL THEN
    INSERT INTO care.plan_goals (plan_id, goal, measure, sort_order)
      SELECT new_id, goal, measure, sort_order FROM care.plan_goals WHERE plan_id = live.id;
    INSERT INTO care.plan_tasks (plan_id, domain, task, detail, frequency, sort_order)
      SELECT new_id, domain, task, detail, frequency, sort_order FROM care.plan_tasks WHERE plan_id = live.id;
  END IF;

  PERFORM public.care_log('care_plan', 'new_version', _client_id, new_id, '{}'::jsonb);
  RETURN care.plan_json(new_id);
END; $function$;

REVOKE ALL ON FUNCTION public.care_plan_save(uuid, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.care_plan_publish(uuid) FROM public;
REVOKE ALL ON FUNCTION public.care_plan_new_version(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.care_plan_save(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_plan_publish(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_plan_new_version(uuid) TO authenticated, service_role;

/* ------------------------------------------------------------- package io */

CREATE OR REPLACE FUNCTION care.package_json(_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
  SELECT to_jsonb(p) || jsonb_build_object(
    'patterns', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.weekday, x.start_time)
                            FROM care.package_patterns x WHERE x.package_id = p.id), '[]'::jsonb))
    FROM care.packages p WHERE p.id = _id;
$function$;

CREATE OR REPLACE FUNCTION public.care_package_save(_client_id uuid, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  pk_id uuid := nullif(_payload->>'id', '')::uuid;
  item jsonb;
  i integer := 0;
BEGIN
  IF NOT public.care_can('care.edit_schedule') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  IF pk_id IS NULL THEN
    INSERT INTO care.packages (client_id, plan_id, created_by)
    VALUES (_client_id, nullif(_payload->>'plan_id', '')::uuid, auth.uid())
    RETURNING id INTO pk_id;
  END IF;

  UPDATE care.packages SET
    plan_id = coalesce(nullif(_payload->>'plan_id', '')::uuid, plan_id),
    name = coalesce(nullif(_payload->>'name', ''), name),
    status = coalesce(nullif(_payload->>'status', ''), status),
    arrangement = coalesce(nullif(_payload->>'arrangement', ''), arrangement),
    role_needed = coalesce(_payload->>'role_needed', role_needed),
    worker_sex_preference = coalesce(_payload->>'worker_sex_preference', worker_sex_preference),
    start_date = coalesce(nullif(_payload->>'start_date', '')::date, start_date),
    end_date = nullif(_payload->>'end_date', '')::date,
    client_rate_hourly = coalesce(nullif(_payload->>'client_rate_hourly', '')::numeric, client_rate_hourly),
    worker_rate_hourly = coalesce(nullif(_payload->>'worker_rate_hourly', '')::numeric, worker_rate_hourly),
    note = coalesce(_payload->>'note', note),
    updated_at = now()
  WHERE id = pk_id AND client_id = _client_id;

  IF jsonb_typeof(_payload->'patterns') = 'array' THEN
    DELETE FROM care.package_patterns x
     WHERE x.package_id = pk_id
       AND NOT EXISTS (SELECT 1 FROM care.visits v WHERE v.pattern_id = x.id);
    i := 0;
    FOR item IN SELECT * FROM jsonb_array_elements(_payload->'patterns') LOOP
      i := i + 1;
      IF nullif(item->>'id', '') IS NOT NULL THEN
        UPDATE care.package_patterns SET
          weekday = (item->>'weekday')::int,
          start_time = (item->>'start_time')::time,
          duration_minutes = coalesce((item->>'duration_minutes')::int, 60),
          carers = greatest(1, coalesce((item->>'carers')::int, 1)),
          label = nullif(item->>'label', ''),
          sort_order = i * 10
        WHERE id = (item->>'id')::uuid AND package_id = pk_id;
      ELSE
        INSERT INTO care.package_patterns (package_id, weekday, start_time, duration_minutes, carers, label, sort_order)
        VALUES (pk_id, (item->>'weekday')::int, (item->>'start_time')::time,
                coalesce((item->>'duration_minutes')::int, 60),
                greatest(1, coalesce((item->>'carers')::int, 1)),
                nullif(item->>'label', ''), i * 10);
      END IF;
    END LOOP;
  END IF;

  PERFORM public.care_log('package', 'save', _client_id, pk_id, '{}'::jsonb);
  RETURN care.package_json(pk_id);
END; $function$;

REVOKE ALL ON FUNCTION public.care_package_save(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.care_package_save(uuid, jsonb) TO authenticated, service_role;

/* -------------------------------------------------------- roster building */

CREATE OR REPLACE FUNCTION public.care_roster_generate(
  _package_id uuid,
  _from date,
  _to date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  pk record;
  pat record;
  d date;
  s integer;
  made integer := 0;
BEGIN
  IF NOT public.care_can('care.edit_schedule') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  SELECT * INTO pk FROM care.packages WHERE id = _package_id;
  IF pk IS NULL THEN
    RAISE EXCEPTION 'Package not found';
  END IF;
  IF _to < _from THEN
    RAISE EXCEPTION 'The end date comes before the start date';
  END IF;
  IF _to - _from > 120 THEN
    RAISE EXCEPTION 'Build the rota in stretches of up to four months';
  END IF;

  FOR pat IN SELECT * FROM care.package_patterns WHERE package_id = _package_id LOOP
    d := _from;
    WHILE d <= _to LOOP
      IF extract(dow FROM d)::int = pat.weekday
         AND (pk.start_date IS NULL OR d >= pk.start_date)
         AND (pk.end_date IS NULL OR d <= pk.end_date) THEN
        FOR s IN 1..pat.carers LOOP
          INSERT INTO care.visits (client_id, package_id, pattern_id, visit_date,
            start_time, duration_minutes, slot)
          VALUES (pk.client_id, pk.id, pat.id, d, pat.start_time, pat.duration_minutes, s)
          ON CONFLICT (pattern_id, visit_date, slot) DO NOTHING;
          IF FOUND THEN made := made + 1; END IF;
        END LOOP;
      END IF;
      d := d + 1;
    END LOOP;
  END LOOP;

  UPDATE care.packages SET status = 'active', updated_at = now()
   WHERE id = _package_id AND status = 'draft';
  UPDATE care.clients SET stage = 'active', updated_at = now()
   WHERE id = pk.client_id AND stage IN ('care_planned', 'assessment_done');

  PERFORM public.care_log('roster', 'generate', pk.client_id, _package_id,
    jsonb_build_object('from', _from, 'to', _to, 'created', made));
  RETURN jsonb_build_object('created', made);
END; $function$;

REVOKE ALL ON FUNCTION public.care_roster_generate(uuid, date, date) FROM public;
GRANT EXECUTE ON FUNCTION public.care_roster_generate(uuid, date, date) TO authenticated, service_role;

/* ---------------------------------------------------------------- visits  */

CREATE OR REPLACE FUNCTION public.care_visit_list(
  _from date,
  _to date,
  _client_id uuid DEFAULT NULL,
  _status text DEFAULT NULL
) RETURNS TABLE (
  id uuid, client_id uuid, client_name text, reference text,
  lga text, state text, visit_date date, start_time time,
  duration_minutes integer, slot integer, status text,
  worker_person_id uuid, worker_name text,
  checked_in_at timestamptz, checked_out_at timestamptz,
  package_name text, concern text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
BEGIN
  IF NOT public.care_can('care.view_schedule') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  RETURN QUERY
  SELECT v.id, v.client_id, c.client_name, c.reference, c.lga, c.state,
         v.visit_date, v.start_time, v.duration_minutes, v.slot, v.status,
         v.worker_person_id, p.full_name, v.checked_in_at, v.checked_out_at,
         pk.name, v.concern
    FROM care.visits v
    JOIN care.clients c ON c.id = v.client_id
    LEFT JOIN public.mu_people p ON p.id = v.worker_person_id
    LEFT JOIN care.packages pk ON pk.id = v.package_id
   WHERE v.visit_date BETWEEN _from AND _to
     AND (_client_id IS NULL OR v.client_id = _client_id)
     AND (_status IS NULL OR v.status = _status)
   ORDER BY v.visit_date, v.start_time, c.client_name;
END; $function$;

CREATE OR REPLACE FUNCTION public.care_visit_get(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  result jsonb;
  mine boolean;
BEGIN
  SELECT (v.worker_person_id IS NOT NULL AND v.worker_person_id = public.mu_my_person_id())
    INTO mine FROM care.visits v WHERE v.id = _id;

  IF NOT (public.care_can('care.view_schedule') OR coalesce(mine, false)) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  SELECT to_jsonb(v) || jsonb_build_object(
    'client_name', c.client_name,
    'reference', c.reference,
    'address_line', c.address_line,
    'lga', c.lga,
    'state', c.state,
    'landmark', c.landmark,
    'allergies', c.allergies,
    'conditions', c.conditions,
    'worker_name', (SELECT full_name FROM public.mu_people WHERE id = v.worker_person_id),
    'tasks', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.sort_order)
                         FROM care.visit_tasks t WHERE t.visit_id = v.id), '[]'::jsonb))
    INTO result
    FROM care.visits v JOIN care.clients c ON c.id = v.client_id
   WHERE v.id = _id;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Visit not found';
  END IF;
  RETURN result;
END; $function$;

CREATE OR REPLACE FUNCTION public.care_visit_assign(_id uuid, _person_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  v record;
  blocked text;
BEGIN
  IF NOT public.care_can('care.edit_schedule') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  SELECT * INTO v FROM care.visits WHERE id = _id;
  IF v IS NULL THEN
    RAISE EXCEPTION 'Visit not found';
  END IF;

  IF _person_id IS NULL THEN
    UPDATE care.visits
       SET worker_person_id = NULL, status = 'unfilled', assigned_at = NULL,
           assigned_by = NULL, updated_at = now()
     WHERE id = _id;
    PERFORM public.care_log('visit', 'unassign', v.client_id, _id, '{}'::jsonb);
    RETURN public.care_visit_get(_id);
  END IF;

  SELECT blocked_reason INTO blocked
    FROM care.care_staff_compliance WHERE person_id = _person_id AND is_clear = false;
  IF blocked IS NOT NULL THEN
    RAISE EXCEPTION 'That worker is not clear to be rostered: %', blocked;
  END IF;

  IF EXISTS (
    SELECT 1 FROM care.visits o
     WHERE o.worker_person_id = _person_id
       AND o.id <> _id
       AND o.visit_date = v.visit_date
       AND o.status NOT IN ('cancelled')
       AND (o.start_time, o.start_time + make_interval(mins => o.duration_minutes))
           OVERLAPS (v.start_time, v.start_time + make_interval(mins => v.duration_minutes))
  ) THEN
    RAISE EXCEPTION 'That worker is already on another visit at that time';
  END IF;

  UPDATE care.visits
     SET worker_person_id = _person_id, status = 'assigned',
         assigned_at = now(), assigned_by = auth.uid(), updated_at = now()
   WHERE id = _id;

  PERFORM public.care_log('visit', 'assign', v.client_id, _id,
    jsonb_build_object('person_id', _person_id));
  RETURN public.care_visit_get(_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.care_visit_candidates(_id uuid)
RETURNS TABLE (
  person_id uuid, full_name text, profession text, lga text, state text,
  same_area boolean, is_clear boolean, clash boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  v record;
  c record;
BEGIN
  IF NOT public.care_can('care.edit_schedule') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  SELECT * INTO v FROM care.visits WHERE id = _id;
  SELECT * INTO c FROM care.clients WHERE id = v.client_id;

  RETURN QUERY
  SELECT p.id, p.full_name, p.profession, p.lga, p.state,
         (lower(coalesce(p.lga, '')) = lower(coalesce(c.lga, '')) AND coalesce(c.lga, '') <> ''),
         coalesce(cs.is_clear, false),
         EXISTS (
           SELECT 1 FROM care.visits o
            WHERE o.worker_person_id = p.id
              AND o.visit_date = v.visit_date
              AND o.id <> v.id
              AND o.status <> 'cancelled'
              AND (o.start_time, o.start_time + make_interval(mins => o.duration_minutes))
                  OVERLAPS (v.start_time, v.start_time + make_interval(mins => v.duration_minutes))
         )
    FROM public.mu_people p
    LEFT JOIN care.care_staff_compliance cs ON cs.person_id = p.id
   WHERE coalesce(p.is_staff, false) = true
   ORDER BY (lower(coalesce(p.lga, '')) = lower(coalesce(c.lga, ''))) DESC,
            coalesce(cs.is_clear, false) DESC, p.full_name
   LIMIT 100;
END; $function$;

CREATE OR REPLACE FUNCTION public.care_visit_cancel(_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  c_id uuid;
BEGIN
  IF NOT public.care_can('care.edit_schedule') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF coalesce(trim(_reason), '') = '' THEN
    RAISE EXCEPTION 'Say why the visit is cancelled';
  END IF;
  UPDATE care.visits
     SET status = 'cancelled', cancel_reason = trim(_reason), updated_at = now()
   WHERE id = _id RETURNING client_id INTO c_id;
  PERFORM public.care_log('visit', 'cancel', c_id, _id, jsonb_build_object('reason', _reason));
  RETURN public.care_visit_get(_id);
END; $function$;

REVOKE ALL ON FUNCTION public.care_visit_list(date, date, uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.care_visit_get(uuid) FROM public;
REVOKE ALL ON FUNCTION public.care_visit_assign(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.care_visit_candidates(uuid) FROM public;
REVOKE ALL ON FUNCTION public.care_visit_cancel(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_visit_list(date, date, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_visit_get(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_visit_assign(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_visit_candidates(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_visit_cancel(uuid, text) TO authenticated, service_role;

/* ------------------------------------------------------ the worker's day  */

CREATE OR REPLACE FUNCTION public.care_my_visits(_from date, _to date)
RETURNS TABLE (
  id uuid, client_name text, address_line text, lga text, state text,
  visit_date date, start_time time, duration_minutes integer, status text,
  checked_in_at timestamptz, checked_out_at timestamptz, tasks_total integer,
  tasks_done integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  me uuid := public.mu_my_person_id();
BEGIN
  IF me IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT v.id, c.client_name, c.address_line, c.lga, c.state,
         v.visit_date, v.start_time, v.duration_minutes, v.status,
         v.checked_in_at, v.checked_out_at,
         (SELECT count(*)::int FROM care.visit_tasks t WHERE t.visit_id = v.id),
         (SELECT count(*)::int FROM care.visit_tasks t WHERE t.visit_id = v.id AND t.done)
    FROM care.visits v JOIN care.clients c ON c.id = v.client_id
   WHERE v.worker_person_id = me
     AND v.visit_date BETWEEN _from AND _to
     AND v.status <> 'cancelled'
   ORDER BY v.visit_date, v.start_time;
END; $function$;

CREATE OR REPLACE FUNCTION public.care_visit_check_in(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  v record;
  me uuid := public.mu_my_person_id();
BEGIN
  SELECT * INTO v FROM care.visits WHERE id = _id;
  IF v IS NULL THEN
    RAISE EXCEPTION 'Visit not found';
  END IF;
  IF NOT (v.worker_person_id = me OR public.care_can('care.edit_schedule')) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF v.checked_in_at IS NOT NULL THEN
    RETURN public.care_visit_get(_id);
  END IF;

  -- Lay the live plan's tasks onto the visit the first time it is opened.
  INSERT INTO care.visit_tasks (visit_id, plan_task_id, task, domain, sort_order)
  SELECT v.id, t.id, t.task, t.domain, t.sort_order
    FROM care.plan_tasks t
    JOIN care.care_plans p ON p.id = t.plan_id
   WHERE p.client_id = v.client_id AND p.status = 'published'
     AND NOT EXISTS (SELECT 1 FROM care.visit_tasks x WHERE x.visit_id = v.id);

  UPDATE care.visits
     SET checked_in_at = now(), status = 'in_progress', updated_at = now()
   WHERE id = _id;

  PERFORM public.care_log('visit', 'check_in', v.client_id, _id, '{}'::jsonb);
  RETURN public.care_visit_get(_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.care_visit_task_set(_task_id uuid, _done boolean, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  v record;
  me uuid := public.mu_my_person_id();
BEGIN
  SELECT vi.* INTO v FROM care.visit_tasks t JOIN care.visits vi ON vi.id = t.visit_id
   WHERE t.id = _task_id;
  IF v IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  IF NOT (v.worker_person_id = me OR public.care_can('care.edit_schedule')) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF _done = false AND coalesce(trim(_reason), '') = '' THEN
    RAISE EXCEPTION 'Say why this was not done';
  END IF;

  UPDATE care.visit_tasks
     SET done = _done, not_done_reason = CASE WHEN _done THEN NULL ELSE trim(_reason) END
   WHERE id = _task_id;
  RETURN public.care_visit_get(v.id);
END; $function$;

CREATE OR REPLACE FUNCTION public.care_visit_check_out(_id uuid, _note text, _concern text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  v record;
  me uuid := public.mu_my_person_id();
BEGIN
  SELECT * INTO v FROM care.visits WHERE id = _id;
  IF v IS NULL THEN
    RAISE EXCEPTION 'Visit not found';
  END IF;
  IF NOT (v.worker_person_id = me OR public.care_can('care.edit_schedule')) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF v.checked_in_at IS NULL THEN
    RAISE EXCEPTION 'Check in before you check out';
  END IF;
  IF coalesce(trim(_note), '') = '' THEN
    RAISE EXCEPTION 'Write a short note about the visit';
  END IF;
  IF EXISTS (SELECT 1 FROM care.visit_tasks t
              WHERE t.visit_id = _id AND t.done = false AND t.not_done_reason IS NULL) THEN
    RAISE EXCEPTION 'Every task needs a tick or a reason before you check out';
  END IF;

  UPDATE care.visits
     SET checked_out_at = now(), status = 'completed',
         visit_note = trim(_note), concern = nullif(trim(coalesce(_concern, '')), ''),
         updated_at = now()
   WHERE id = _id;

  PERFORM public.care_log('visit', 'check_out', v.client_id, _id,
    jsonb_build_object('concern', nullif(trim(coalesce(_concern, '')), '')));
  RETURN public.care_visit_get(_id);
END; $function$;

REVOKE ALL ON FUNCTION public.care_my_visits(date, date) FROM public;
REVOKE ALL ON FUNCTION public.care_visit_check_in(uuid) FROM public;
REVOKE ALL ON FUNCTION public.care_visit_task_set(uuid, boolean, text) FROM public;
REVOKE ALL ON FUNCTION public.care_visit_check_out(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_my_visits(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_visit_check_in(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_visit_task_set(uuid, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_visit_check_out(uuid, text, text) TO authenticated, service_role;

/* --------------------------------------------- one read for the care tabs */

CREATE OR REPLACE FUNCTION public.care_client_care_get(_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.care_can('care.view_care_plans') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  SELECT jsonb_build_object(
    'assessment', (SELECT care.assessment_json(a.id) FROM care.assessments a
                    WHERE a.client_id = _client_id ORDER BY a.created_at DESC LIMIT 1),
    'plan', (SELECT care.plan_json(p.id) FROM care.care_plans p
              WHERE p.client_id = _client_id
              ORDER BY (p.status = 'draft') DESC, p.version DESC LIMIT 1),
    'plan_versions', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'version', p.version,
               'status', p.status, 'published_at', p.published_at) ORDER BY p.version DESC)
        FROM care.care_plans p WHERE p.client_id = _client_id), '[]'::jsonb),
    'package', (SELECT care.package_json(pk.id) FROM care.packages pk
                 WHERE pk.client_id = _client_id ORDER BY pk.created_at DESC LIMIT 1),
    'upcoming', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', v.id, 'visit_date', v.visit_date, 'start_time', v.start_time,
               'duration_minutes', v.duration_minutes, 'status', v.status,
               'worker_name', (SELECT full_name FROM public.mu_people WHERE id = v.worker_person_id))
             ORDER BY v.visit_date, v.start_time)
        FROM care.visits v
       WHERE v.client_id = _client_id AND v.visit_date >= current_date
         AND v.status <> 'cancelled'), '[]'::jsonb),
    'recent', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', v.id, 'visit_date', v.visit_date, 'start_time', v.start_time,
               'status', v.status, 'visit_note', v.visit_note, 'concern', v.concern,
               'worker_name', (SELECT full_name FROM public.mu_people WHERE id = v.worker_person_id))
             ORDER BY v.visit_date DESC, v.start_time DESC)
        FROM (SELECT * FROM care.visits w
               WHERE w.client_id = _client_id AND w.visit_date < current_date
               ORDER BY w.visit_date DESC LIMIT 20) v), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END; $function$;

REVOKE ALL ON FUNCTION public.care_client_care_get(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.care_client_care_get(uuid) TO authenticated, service_role;