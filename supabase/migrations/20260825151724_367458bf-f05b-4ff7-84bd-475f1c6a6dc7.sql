-- Care stage two: the client record and the referral pipeline.
--
-- The care schema is not exposed to the Data API. Every read and write goes
-- through SECURITY DEFINER functions in public, each of which re-checks the
-- caller's care permission (or admin role) before touching a row.

-- ---------------------------------------------------------------------------
-- Access helper used by every function and policy below.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_can(_permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
  SELECT private.has_role(auth.uid(), 'admin'::public.app_role)
      OR care.has_permission(_permission);
$function$;

REVOKE ALL ON FUNCTION public.care_can(text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_can(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS care.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  client_name text NOT NULL,
  preferred_name text,
  date_of_birth date,
  sex text,
  phone text,
  email text,
  address_line text,
  lga text,
  state text,
  landmark text,
  stage text NOT NULL DEFAULT 'enquiry',
  stage_note text,
  closed_reason text,
  service_interest text,
  care_needs text,
  urgency text,
  funding_note text,
  source text,
  gp_name text,
  gp_phone text,
  allergies text,
  conditions text,
  mobility_note text,
  dietary_note text,
  language_preference text,
  religion_preference text,
  pets_note text,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS care.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES care.clients(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship text,
  phone text,
  email text,
  is_next_of_kin boolean NOT NULL DEFAULT false,
  is_emergency boolean NOT NULL DEFAULT false,
  is_payer boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS care.client_stage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES care.clients(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  note text,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS care.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES care.clients(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'office',
  source_reference text,
  contact_name text,
  contact_relationship text,
  contact_phone text,
  contact_email text,
  summary text,
  stage text NOT NULL DEFAULT 'new',
  next_step text,
  next_step_due date,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS care.audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  client_id uuid,
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_clients_stage ON care.clients(stage);
CREATE INDEX IF NOT EXISTS idx_care_client_contacts_client ON care.client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_care_stage_events_client ON care.client_stage_events(client_id);
CREATE INDEX IF NOT EXISTS idx_care_referrals_stage ON care.referrals(stage);
CREATE INDEX IF NOT EXISTS idx_care_audit_client ON care.audit(client_id, created_at DESC);

-- The care schema is not on the Data API. Only the definer functions below
-- touch these tables, so no direct grants to authenticated.
GRANT ALL ON care.clients, care.client_contacts, care.client_stage_events,
  care.referrals, care.audit TO service_role;

ALTER TABLE care.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.client_stage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.audit ENABLE ROW LEVEL SECURITY;

-- No permissive policies: direct access is denied to everyone but the
-- SECURITY DEFINER functions and service_role.

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_log(
  _entity text,
  _action text,
  _client_id uuid DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _detail jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
BEGIN
  INSERT INTO care.audit (actor_user_id, actor_email, client_id, entity, entity_id, action, detail)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    _client_id, _entity, _entity_id, _action, coalesce(_detail, '{}'::jsonb)
  );
END; $function$;

CREATE OR REPLACE FUNCTION public.care_audit_list(_client_id uuid DEFAULT NULL, _limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid, actor_email text, client_id uuid, entity text, entity_id uuid,
  action text, detail jsonb, created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
BEGIN
  IF NOT public.care_can('care.view_clients') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  RETURN QUERY
  SELECT a.id, a.actor_email, a.client_id, a.entity, a.entity_id, a.action, a.detail, a.created_at
    FROM care.audit a
   WHERE _client_id IS NULL OR a.client_id = _client_id
   ORDER BY a.created_at DESC
   LIMIT greatest(1, least(coalesce(_limit, 100), 500));
END; $function$;

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION care.next_client_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  n integer;
BEGIN
  SELECT count(*) + 1 INTO n FROM care.clients;
  RETURN 'MC-' || to_char(now(), 'YY') || '-' || lpad(n::text, 4, '0');
END; $function$;

CREATE OR REPLACE FUNCTION public.care_client_list(
  _search text DEFAULT NULL,
  _stage text DEFAULT NULL,
  _limit integer DEFAULT 200
) RETURNS TABLE (
  id uuid, reference text, client_name text, phone text, lga text, state text,
  service_interest text, urgency text, stage text, next_step text,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
BEGIN
  IF NOT public.care_can('care.view_clients') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  RETURN QUERY
  SELECT c.id, c.reference, c.client_name, c.phone, c.lga, c.state,
         c.service_interest, c.urgency, c.stage,
         (SELECT r.next_step FROM care.referrals r
           WHERE r.client_id = c.id ORDER BY r.updated_at DESC LIMIT 1),
         c.created_at, c.updated_at
    FROM care.clients c
   WHERE (_stage IS NULL OR c.stage = _stage)
     AND (
       _search IS NULL OR _search = '' OR
       c.client_name ILIKE '%' || _search || '%' OR
       c.reference ILIKE '%' || _search || '%' OR
       coalesce(c.phone, '') ILIKE '%' || _search || '%' OR
       EXISTS (
         SELECT 1 FROM care.client_contacts cc
          WHERE cc.client_id = c.id
            AND (cc.full_name ILIKE '%' || _search || '%'
              OR coalesce(cc.phone, '') ILIKE '%' || _search || '%')
       )
     )
   ORDER BY c.updated_at DESC
   LIMIT greatest(1, least(coalesce(_limit, 200), 500));
END; $function$;

CREATE OR REPLACE FUNCTION public.care_client_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.care_can('care.view_clients') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  SELECT coalesce(jsonb_object_agg(stage, n), '{}'::jsonb) INTO result
    FROM (SELECT stage, count(*) AS n FROM care.clients GROUP BY stage) s;
  RETURN result;
END; $function$;

CREATE OR REPLACE FUNCTION public.care_client_get(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.care_can('care.view_clients') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  SELECT to_jsonb(c)
      || jsonb_build_object(
           'contacts', coalesce((
             SELECT jsonb_agg(to_jsonb(cc) ORDER BY cc.is_next_of_kin DESC, cc.created_at)
               FROM care.client_contacts cc WHERE cc.client_id = c.id), '[]'::jsonb),
           'stage_history', coalesce((
             SELECT jsonb_agg(to_jsonb(se) ORDER BY se.created_at DESC)
               FROM care.client_stage_events se WHERE se.client_id = c.id), '[]'::jsonb),
           'referral', (
             SELECT to_jsonb(r) FROM care.referrals r
              WHERE r.client_id = c.id ORDER BY r.updated_at DESC LIMIT 1)
         )
    INTO result
    FROM care.clients c
   WHERE c.id = _id;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  PERFORM public.care_log('client', 'open', _id, _id, '{}'::jsonb);
  RETURN result;
END; $function$;

CREATE OR REPLACE FUNCTION public.care_client_create(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  new_id uuid;
BEGIN
  IF NOT public.care_can('care.edit_clients') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF coalesce(trim(_payload->>'client_name'), '') = '' THEN
    RAISE EXCEPTION 'A client name is required';
  END IF;

  INSERT INTO care.clients (
    reference, client_name, preferred_name, date_of_birth, sex, phone, email,
    address_line, lga, state, landmark, service_interest, care_needs, urgency,
    funding_note, source, created_by, owner_user_id
  ) VALUES (
    care.next_client_reference(),
    trim(_payload->>'client_name'),
    nullif(_payload->>'preferred_name', ''),
    nullif(_payload->>'date_of_birth', '')::date,
    nullif(_payload->>'sex', ''),
    nullif(_payload->>'phone', ''),
    nullif(_payload->>'email', ''),
    nullif(_payload->>'address_line', ''),
    nullif(_payload->>'lga', ''),
    nullif(_payload->>'state', ''),
    nullif(_payload->>'landmark', ''),
    nullif(_payload->>'service_interest', ''),
    nullif(_payload->>'care_needs', ''),
    nullif(_payload->>'urgency', ''),
    nullif(_payload->>'funding_note', ''),
    nullif(_payload->>'source', ''),
    auth.uid(), auth.uid()
  ) RETURNING id INTO new_id;

  IF coalesce(trim(_payload->>'enquirer_name'), '') <> '' THEN
    INSERT INTO care.client_contacts (client_id, full_name, relationship, phone, email, is_next_of_kin)
    VALUES (
      new_id,
      trim(_payload->>'enquirer_name'),
      nullif(_payload->>'enquirer_relationship', ''),
      nullif(_payload->>'enquirer_phone', ''),
      nullif(_payload->>'enquirer_email', ''),
      true
    );
  END IF;

  INSERT INTO care.referrals (client_id, source, contact_name, contact_relationship,
    contact_phone, contact_email, summary, stage, owner_user_id)
  VALUES (
    new_id,
    coalesce(nullif(_payload->>'source', ''), 'office'),
    nullif(_payload->>'enquirer_name', ''),
    nullif(_payload->>'enquirer_relationship', ''),
    nullif(_payload->>'enquirer_phone', ''),
    nullif(_payload->>'enquirer_email', ''),
    nullif(_payload->>'care_needs', ''),
    'new',
    auth.uid()
  );

  INSERT INTO care.client_stage_events (client_id, from_stage, to_stage, note, actor_user_id)
  VALUES (new_id, NULL, 'enquiry', 'Enquiry logged', auth.uid());

  PERFORM public.care_log('client', 'create', new_id, new_id, '{}'::jsonb);
  RETURN public.care_client_get(new_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.care_client_update(_id uuid, _payload jsonb, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
BEGIN
  IF NOT public.care_can('care.edit_clients') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  UPDATE care.clients c SET
    client_name = coalesce(nullif(_payload->>'client_name', ''), c.client_name),
    preferred_name = coalesce(_payload->>'preferred_name', c.preferred_name),
    date_of_birth = coalesce(nullif(_payload->>'date_of_birth', '')::date, c.date_of_birth),
    sex = coalesce(_payload->>'sex', c.sex),
    phone = coalesce(_payload->>'phone', c.phone),
    email = coalesce(_payload->>'email', c.email),
    address_line = coalesce(_payload->>'address_line', c.address_line),
    lga = coalesce(_payload->>'lga', c.lga),
    state = coalesce(_payload->>'state', c.state),
    landmark = coalesce(_payload->>'landmark', c.landmark),
    service_interest = coalesce(_payload->>'service_interest', c.service_interest),
    care_needs = coalesce(_payload->>'care_needs', c.care_needs),
    urgency = coalesce(_payload->>'urgency', c.urgency),
    funding_note = coalesce(_payload->>'funding_note', c.funding_note),
    source = coalesce(_payload->>'source', c.source),
    gp_name = coalesce(_payload->>'gp_name', c.gp_name),
    gp_phone = coalesce(_payload->>'gp_phone', c.gp_phone),
    allergies = coalesce(_payload->>'allergies', c.allergies),
    conditions = coalesce(_payload->>'conditions', c.conditions),
    mobility_note = coalesce(_payload->>'mobility_note', c.mobility_note),
    dietary_note = coalesce(_payload->>'dietary_note', c.dietary_note),
    language_preference = coalesce(_payload->>'language_preference', c.language_preference),
    religion_preference = coalesce(_payload->>'religion_preference', c.religion_preference),
    pets_note = coalesce(_payload->>'pets_note', c.pets_note),
    updated_at = now()
  WHERE c.id = _id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  PERFORM public.care_log('client', 'update', _id, _id,
    jsonb_build_object('reason', _reason, 'fields', (SELECT jsonb_agg(k) FROM jsonb_object_keys(_payload) k)));
  RETURN public.care_client_get(_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.care_client_set_stage(_id uuid, _stage text, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  old_stage text;
BEGIN
  IF NOT public.care_can('care.manage_referrals') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF _stage NOT IN ('enquiry','assessment_booked','assessment_done','care_planned','active','on_hold','closed') THEN
    RAISE EXCEPTION 'Unknown stage';
  END IF;

  SELECT stage INTO old_stage FROM care.clients WHERE id = _id;
  IF old_stage IS NULL THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  UPDATE care.clients
     SET stage = _stage,
         stage_note = _note,
         closed_reason = CASE WHEN _stage = 'closed' THEN _note ELSE closed_reason END,
         updated_at = now()
   WHERE id = _id;

  INSERT INTO care.client_stage_events (client_id, from_stage, to_stage, note, actor_user_id)
  VALUES (_id, old_stage, _stage, _note, auth.uid());

  UPDATE care.referrals
     SET stage = CASE WHEN _stage IN ('active','closed') THEN 'closed' ELSE 'working' END,
         updated_at = now()
   WHERE client_id = _id;

  PERFORM public.care_log('client', 'stage', _id, _id, jsonb_build_object('from', old_stage, 'to', _stage));
  RETURN public.care_client_get(_id);
END; $function$;

-- ---------------------------------------------------------------------------
-- Contacts and referral next step
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_contact_save(_client_id uuid, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  cid uuid;
BEGIN
  IF NOT public.care_can('care.edit_clients') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF coalesce(trim(_payload->>'full_name'), '') = '' THEN
    RAISE EXCEPTION 'A contact name is required';
  END IF;

  IF nullif(_payload->>'id', '') IS NOT NULL THEN
    cid := (_payload->>'id')::uuid;
    UPDATE care.client_contacts SET
      full_name = trim(_payload->>'full_name'),
      relationship = nullif(_payload->>'relationship', ''),
      phone = nullif(_payload->>'phone', ''),
      email = nullif(_payload->>'email', ''),
      is_next_of_kin = coalesce((_payload->>'is_next_of_kin')::boolean, is_next_of_kin),
      is_emergency = coalesce((_payload->>'is_emergency')::boolean, is_emergency),
      is_payer = coalesce((_payload->>'is_payer')::boolean, is_payer),
      note = nullif(_payload->>'note', '')
    WHERE id = cid AND client_id = _client_id;
  ELSE
    INSERT INTO care.client_contacts (client_id, full_name, relationship, phone, email,
      is_next_of_kin, is_emergency, is_payer, note)
    VALUES (_client_id, trim(_payload->>'full_name'),
      nullif(_payload->>'relationship', ''), nullif(_payload->>'phone', ''),
      nullif(_payload->>'email', ''),
      coalesce((_payload->>'is_next_of_kin')::boolean, false),
      coalesce((_payload->>'is_emergency')::boolean, false),
      coalesce((_payload->>'is_payer')::boolean, false),
      nullif(_payload->>'note', ''))
    RETURNING id INTO cid;
  END IF;

  PERFORM public.care_log('contact', 'save', _client_id, cid, '{}'::jsonb);
  RETURN public.care_client_get(_client_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.care_contact_delete(_client_id uuid, _contact_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
BEGIN
  IF NOT public.care_can('care.edit_clients') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  DELETE FROM care.client_contacts WHERE id = _contact_id AND client_id = _client_id;
  PERFORM public.care_log('contact', 'delete', _client_id, _contact_id, '{}'::jsonb);
  RETURN public.care_client_get(_client_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.care_referral_set_next_step(
  _client_id uuid, _next_step text, _due date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
BEGIN
  IF NOT public.care_can('care.manage_referrals') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  UPDATE care.referrals
     SET next_step = nullif(_next_step, ''),
         next_step_due = _due,
         owner_user_id = coalesce(owner_user_id, auth.uid()),
         updated_at = now()
   WHERE client_id = _client_id;

  IF NOT FOUND THEN
    INSERT INTO care.referrals (client_id, source, next_step, next_step_due, owner_user_id, stage)
    VALUES (_client_id, 'office', nullif(_next_step, ''), _due, auth.uid(), 'working');
  END IF;

  PERFORM public.care_log('referral', 'next_step', _client_id, NULL,
    jsonb_build_object('next_step', _next_step, 'due', _due));
  RETURN public.care_client_get(_client_id);
END; $function$;

-- ---------------------------------------------------------------------------
-- Permission management wrappers (care schema is off the Data API).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_access_catalogue()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  RETURN jsonb_build_object(
    'permissions', coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.category, p.name) FROM care.permissions p), '[]'::jsonb),
    'bundles', coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.sort_order) FROM care.permission_bundles b), '[]'::jsonb),
    'bundle_permissions', coalesce((SELECT jsonb_agg(to_jsonb(bp)) FROM care.bundle_permissions bp), '[]'::jsonb)
  );
END; $function$;

CREATE OR REPLACE FUNCTION public.care_person_access(_person_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  RETURN jsonb_build_object(
    'permissions', coalesce((SELECT jsonb_agg(permission_name) FROM care.person_permissions WHERE person_id = _person_id), '[]'::jsonb),
    'bundles', coalesce((SELECT jsonb_agg(bundle_key) FROM care.person_bundles WHERE person_id = _person_id), '[]'::jsonb),
    'staff', (SELECT to_jsonb(s) FROM care.care_staff s WHERE s.person_id = _person_id),
    'compliance', (SELECT to_jsonb(c) FROM care.care_staff_compliance c WHERE c.person_id = _person_id)
  );
END; $function$;

CREATE OR REPLACE FUNCTION public.care_person_set_access(
  _person_id uuid, _bundles text[], _permissions text[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  DELETE FROM care.person_bundles WHERE person_id = _person_id
    AND bundle_key <> ALL (coalesce(_bundles, '{}'::text[]));
  INSERT INTO care.person_bundles (person_id, bundle_key, granted_by)
  SELECT _person_id, b, auth.uid() FROM unnest(coalesce(_bundles, '{}'::text[])) b
  ON CONFLICT (person_id, bundle_key) DO NOTHING;

  DELETE FROM care.person_permissions WHERE person_id = _person_id
    AND permission_name <> ALL (coalesce(_permissions, '{}'::text[]));
  INSERT INTO care.person_permissions (person_id, permission_name, granted_by)
  SELECT _person_id, p, auth.uid() FROM unnest(coalesce(_permissions, '{}'::text[])) p
  ON CONFLICT (person_id, permission_name) DO NOTHING;

  PERFORM public.care_log('access', 'set', NULL, _person_id,
    jsonb_build_object('bundles', _bundles, 'permissions', _permissions));
  RETURN public.care_person_access(_person_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.care_staff_save(_person_id uuid, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  INSERT INTO care.care_staff (person_id, employee_no, hired_at, can_be_rostered, role_summary, updated_at)
  VALUES (
    _person_id,
    nullif(_payload->>'employee_no', ''),
    nullif(_payload->>'hired_at', '')::date,
    coalesce((_payload->>'can_be_rostered')::boolean, false),
    nullif(_payload->>'role_summary', ''),
    now()
  )
  ON CONFLICT (person_id) DO UPDATE SET
    employee_no = EXCLUDED.employee_no,
    hired_at = EXCLUDED.hired_at,
    can_be_rostered = EXCLUDED.can_be_rostered,
    role_summary = EXCLUDED.role_summary,
    updated_at = now();

  PERFORM care.refresh_compliance(_person_id);
  RETURN public.care_person_access(_person_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.care_refresh_compliance(_person_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  PERFORM care.refresh_compliance(_person_id);
  RETURN public.care_person_access(_person_id);
END; $function$;

-- ---------------------------------------------------------------------------
-- Who am I, in care terms.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.care_me()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  pid uuid;
  is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('is_admin', false, 'person_id', NULL, 'permissions', '[]'::jsonb);
  END IF;
  is_admin := private.has_role(auth.uid(), 'admin'::public.app_role);
  pid := public.mu_my_person_id();

  RETURN jsonb_build_object(
    'is_admin', is_admin,
    'person_id', pid,
    'email', (SELECT email FROM auth.users WHERE id = auth.uid()),
    'permissions', CASE
      WHEN is_admin THEN coalesce((SELECT jsonb_agg(name) FROM care.permissions), '[]'::jsonb)
      ELSE coalesce((
        SELECT jsonb_agg(DISTINCT n) FROM (
          SELECT permission_name AS n FROM care.person_permissions WHERE person_id = pid
          UNION
          SELECT bp.permission_name FROM care.person_bundles pb
            JOIN care.bundle_permissions bp ON bp.bundle_key = pb.bundle_key
           WHERE pb.person_id = pid
        ) x), '[]'::jsonb)
    END
  );
END; $function$;

-- Execution grants
REVOKE ALL ON FUNCTION public.care_log(text, text, uuid, uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.care_log(text, text, uuid, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_audit_list(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_client_list(text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_client_counts() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_client_get(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_client_create(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_client_update(uuid, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_client_set_stage(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_contact_save(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_contact_delete(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_referral_set_next_step(uuid, text, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_access_catalogue() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_person_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_person_set_access(uuid, text[], text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_staff_save(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_refresh_compliance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_me() TO authenticated, service_role;
