-- ============================================================
-- MedicConnect v1 — Slice 1: sealed clinical compartment
-- ============================================================

CREATE SCHEMA IF NOT EXISTS clinical;

-- Nothing outside the owner may touch this schema directly.
REVOKE ALL ON SCHEMA clinical FROM PUBLIC;
REVOKE ALL ON SCHEMA clinical FROM anon, authenticated;
GRANT USAGE ON SCHEMA clinical TO service_role;

-- ---------- staff register ----------
DO $$ BEGIN
  CREATE TYPE clinical.staff_role AS ENUM ('coordinator', 'nurse', 'clinical_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS clinical.clinical_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  display_name text,
  role clinical.staff_role NOT NULL DEFAULT 'coordinator',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON clinical.clinical_staff TO service_role;
ALTER TABLE clinical.clinical_staff ENABLE ROW LEVEL SECURITY;

-- ---------- audit log ----------
CREATE TABLE IF NOT EXISTS clinical.clinical_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  client_id uuid,
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinical_audit_client_idx ON clinical.clinical_audit (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS clinical_audit_actor_idx ON clinical.clinical_audit (actor_id, created_at DESC);

GRANT ALL ON clinical.clinical_audit TO service_role;
ALTER TABLE clinical.clinical_audit ENABLE ROW LEVEL SECURITY;

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION clinical.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = clinical, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clinical_staff_updated_at ON clinical.clinical_staff;
CREATE TRIGGER clinical_staff_updated_at
BEFORE UPDATE ON clinical.clinical_staff
FOR EACH ROW EXECUTE FUNCTION clinical.set_updated_at();

-- ============================================================
-- Public accessor surface (the ONLY way in from the app)
-- ============================================================

-- Is the caller an active clinical staff member?
CREATE OR REPLACE FUNCTION public.clinical_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = clinical, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM clinical.clinical_staff
    WHERE user_id = auth.uid() AND is_active
  );
$$;

-- Has the caller completed the authenticator-app step this session?
CREATE OR REPLACE FUNCTION public.clinical_has_aal2()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = clinical, public
AS $$
  SELECT coalesce((auth.jwt() ->> 'aal') = 'aal2', false);
$$;

-- Full gate: active staff AND stepped up.
CREATE OR REPLACE FUNCTION public.clinical_session_ok()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = clinical, public
AS $$
  SELECT public.clinical_is_staff() AND public.clinical_has_aal2();
$$;

-- What the client app asks on load. Never leaks anything to non-staff.
CREATE OR REPLACE FUNCTION public.clinical_me()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = clinical, public
AS $$
DECLARE
  s clinical.clinical_staff%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('is_staff', false, 'aal2', false);
  END IF;

  SELECT * INTO s FROM clinical.clinical_staff
   WHERE user_id = auth.uid() AND is_active;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_staff', false, 'aal2', false);
  END IF;

  RETURN jsonb_build_object(
    'is_staff', true,
    'aal2', public.clinical_has_aal2(),
    'role', s.role::text,
    'display_name', s.display_name,
    'email', s.email
  );
END;
$$;

-- Write an audit entry. Refuses unless the caller is through the gate.
CREATE OR REPLACE FUNCTION public.clinical_log(
  _entity text,
  _action text,
  _client_id uuid DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _detail jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = clinical, public
AS $$
DECLARE
  em text;
BEGIN
  IF NOT public.clinical_session_ok() THEN
    RAISE EXCEPTION 'Not authorised for the clinical area';
  END IF;

  SELECT email INTO em FROM clinical.clinical_staff WHERE user_id = auth.uid();

  INSERT INTO clinical.clinical_audit (actor_id, actor_email, client_id, entity, entity_id, action, detail)
  VALUES (auth.uid(), em, _client_id, _entity, _entity_id, _action, coalesce(_detail, '{}'::jsonb));
END;
$$;

-- Read the audit trail (staff only).
CREATE OR REPLACE FUNCTION public.clinical_audit_list(
  _client_id uuid DEFAULT NULL,
  _limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  actor_email text,
  client_id uuid,
  entity text,
  entity_id uuid,
  action text,
  detail jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = clinical, public
AS $$
BEGIN
  IF NOT public.clinical_session_ok() THEN
    RAISE EXCEPTION 'Not authorised for the clinical area';
  END IF;

  RETURN QUERY
  SELECT a.id, a.actor_email, a.client_id, a.entity, a.entity_id, a.action, a.detail, a.created_at
    FROM clinical.clinical_audit a
   WHERE (_client_id IS NULL OR a.client_id = _client_id)
   ORDER BY a.created_at DESC
   LIMIT least(coalesce(_limit, 100), 500);
END;
$$;

-- List the staff register (staff only).
CREATE OR REPLACE FUNCTION public.clinical_staff_list()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  display_name text,
  role text,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = clinical, public
AS $$
BEGIN
  IF NOT public.clinical_session_ok() THEN
    RAISE EXCEPTION 'Not authorised for the clinical area';
  END IF;

  RETURN QUERY
  SELECT s.id, s.user_id, s.email, s.display_name, s.role::text, s.is_active, s.created_at
    FROM clinical.clinical_staff s
   ORDER BY s.created_at;
END;
$$;

-- ---------- execute grants: authenticated only, never anon ----------
REVOKE ALL ON FUNCTION public.clinical_is_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clinical_has_aal2() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clinical_session_ok() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clinical_me() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clinical_log(text, text, uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clinical_audit_list(uuid, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clinical_staff_list() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.clinical_is_staff() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clinical_has_aal2() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clinical_session_ok() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clinical_me() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clinical_log(text, text, uuid, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clinical_audit_list(uuid, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clinical_staff_list() TO authenticated, service_role;

-- ---------- seed the first clinical staff member ----------
INSERT INTO clinical.clinical_staff (user_id, email, display_name, role, is_active)
SELECT u.id, u.email, coalesce(u.raw_user_meta_data ->> 'display_name', u.email), 'coordinator', true
  FROM auth.users u
 WHERE u.id = 'af2fac7f-86db-483f-831e-3cb38454a30c'
ON CONFLICT (user_id) DO NOTHING;