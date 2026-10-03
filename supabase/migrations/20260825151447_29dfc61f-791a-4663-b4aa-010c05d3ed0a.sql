-- Care management foundation.
-- Single-tenant: no organisation scoping. Identity comes from auth.users and
-- the public.mu_people layer, not duplicated here.

CREATE SCHEMA IF NOT EXISTS care;

-- 1. Permission registry. One ability per row.
CREATE TABLE care.permissions (
  name text PRIMARY KEY,
  category text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Bundles are named shortcuts for a set of permissions.
CREATE TABLE care.permission_bundles (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE care.bundle_permissions (
  bundle_key text NOT NULL REFERENCES care.permission_bundles(key) ON DELETE CASCADE,
  permission_name text NOT NULL REFERENCES care.permissions(name) ON DELETE CASCADE,
  PRIMARY KEY (bundle_key, permission_name)
);

-- 3. Grants to a person. Direct permission wins even if no bundle is held.
CREATE TABLE care.person_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  permission_name text NOT NULL REFERENCES care.permissions(name) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, permission_name)
);

CREATE TABLE care.person_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  bundle_key text NOT NULL REFERENCES care.permission_bundles(key) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, bundle_key)
);

-- 4. Who is active in the care system and may be rostered.
CREATE TABLE care.care_staff (
  person_id uuid PRIMARY KEY REFERENCES public.mu_people(id) ON DELETE CASCADE,
  employee_no text UNIQUE,
  hired_at date,
  can_be_rostered boolean NOT NULL DEFAULT false,
  role_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Compliance snapshot refreshed from Match Universe at roster time.
CREATE TABLE care.care_staff_compliance (
  person_id uuid PRIMARY KEY REFERENCES public.mu_people(id) ON DELETE CASCADE,
  is_clear boolean NOT NULL DEFAULT false,
  clear_until date,
  blocked_reason text,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_person_permissions_person ON care.person_permissions(person_id);
CREATE INDEX idx_person_bundles_person ON care.person_bundles(person_id);

-- Grants and RLS
GRANT USAGE ON SCHEMA care TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA care TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA care TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA care TO authenticated, service_role;

ALTER TABLE care.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.permission_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.bundle_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.person_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.person_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.care_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE care.care_staff_compliance ENABLE ROW LEVEL SECURITY;

-- Only admins manage the registry and bundles.
CREATE POLICY "Admins manage permission registry" ON care.permissions
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage bundles" ON care.permission_bundles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage bundle permissions" ON care.bundle_permissions
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- A person reads their own grants; admins manage all grants.
CREATE POLICY "Admins manage person permissions" ON care.person_permissions
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "People read own permissions" ON care.person_permissions
  FOR SELECT TO authenticated
  USING (person_id = public.mu_my_person_id());

CREATE POLICY "Admins manage person bundles" ON care.person_bundles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "People read own bundles" ON care.person_bundles
  FOR SELECT TO authenticated
  USING (person_id = public.mu_my_person_id());

CREATE POLICY "Admins manage care staff" ON care.care_staff
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Staff read own care record" ON care.care_staff
  FOR SELECT TO authenticated
  USING (person_id = public.mu_my_person_id());

CREATE POLICY "Admins manage compliance cache" ON care.care_staff_compliance
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Staff read own compliance" ON care.care_staff_compliance
  FOR SELECT TO authenticated
  USING (person_id = public.mu_my_person_id());

-- Helper: does the current user hold a care permission, either directly or via a bundle?
CREATE OR REPLACE FUNCTION care.has_permission(_permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM care.person_permissions
    WHERE person_id = public.mu_my_person_id() AND permission_name = _permission
  )
  OR EXISTS (
    SELECT 1 FROM care.person_bundles pb
    JOIN care.bundle_permissions bp ON bp.bundle_key = pb.bundle_key
    WHERE pb.person_id = public.mu_my_person_id() AND bp.permission_name = _permission
  );
$function$;

-- Helper: is this person rosterable today, based on Match Universe compliance?
CREATE OR REPLACE FUNCTION care.can_roster(_person_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  staff_rec care.care_staff%ROWTYPE;
  comp care.care_staff_compliance%ROWTYPE;
BEGIN
  SELECT * INTO staff_rec FROM care.care_staff WHERE person_id = _person_id;
  IF staff_rec.person_id IS NULL OR NOT staff_rec.can_be_rostered THEN
    RETURN false;
  END IF;

  SELECT * INTO comp FROM care.care_staff_compliance WHERE person_id = _person_id;
  IF comp.person_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN comp.is_clear AND (comp.clear_until IS NULL OR comp.clear_until >= current_date);
END; $function$;

-- Helper: refresh the compliance cache for one person from Match Universe state.
CREATE OR REPLACE FUNCTION care.refresh_compliance(_person_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'care'
AS $function$
DECLARE
  p public.mu_people%ROWTYPE;
  v_state text;
  n_bad int;
  earliest_expiry date;
  blocked text;
BEGIN
  SELECT * INTO p FROM public.mu_people WHERE id = _person_id;
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'Person not found';
  END IF;

  SELECT verification_state INTO v_state FROM public.mu_readiness_v WHERE person_id = _person_id;

  SELECT count(*) FILTER (WHERE status IN ('rejected', 'expired')),
         min(expires_at) FILTER (WHERE status = 'accepted' AND expires_at IS NOT NULL)
    INTO n_bad, earliest_expiry
    FROM public.mu_document_status(_person_id)
   WHERE required;

  IF n_bad > 0 THEN
    blocked := 'A required document is rejected or expired.';
  ELSIF v_state <> 'verified' THEN
    blocked := 'Verification state is ' || coalesce(v_state, 'unknown') || '.';
  END IF;

  INSERT INTO care.care_staff_compliance (person_id, is_clear, clear_until, blocked_reason, refreshed_at)
  VALUES (_person_id, blocked IS NULL, earliest_expiry, blocked, now())
  ON CONFLICT (person_id) DO UPDATE
    SET is_clear = EXCLUDED.is_clear,
        clear_until = EXCLUDED.clear_until,
        blocked_reason = EXCLUDED.blocked_reason,
        refreshed_at = EXCLUDED.refreshed_at;
END; $function$;

-- Seed the permission registry and bundles.
INSERT INTO care.permissions (name, category, description) VALUES
  ('care.view_clients', 'client', 'View the client list and records'),
  ('care.edit_clients', 'client', 'Create and edit client records'),
  ('care.manage_referrals', 'client', 'Own and move referrals through stages'),
  ('care.view_care_plans', 'plan', 'View care plans'),
  ('care.edit_care_plans', 'plan', 'Create and edit care plans'),
  ('care.approve_care_plans', 'plan', 'Approve care plans'),
  ('care.view_schedule', 'visit', 'View rosters and visits'),
  ('care.edit_schedule', 'visit', 'Build and change rosters'),
  ('care.clock_visits', 'visit', 'Clock in and out of visits'),
  ('care.view_medicines', 'medication', 'View prescriptions and medicine charts'),
  ('care.administer_medicines', 'medication', 'Record medicine administration'),
  ('care.witness_medicines', 'medication', 'Witness controlled drug administration'),
  ('care.view_incidents', 'incident', 'View incident records'),
  ('care.raise_incidents', 'incident', 'Raise and edit incidents'),
  ('care.investigate_incidents', 'incident', 'Investigate and close incidents'),
  ('care.view_finance', 'finance', 'View rate cards, invoices and payroll'),
  ('care.edit_finance', 'finance', 'Edit rate cards and approve billing'),
  ('care.manage_permissions', 'admin', 'Grant and revoke care permissions'),
  ('care.view_analytics', 'admin', 'View care reports and analytics')
ON CONFLICT (name) DO NOTHING;

INSERT INTO care.permission_bundles (key, label, description, sort_order) VALUES
  ('care_coordinator', 'Care coordinator', 'Owns referrals, clients and the care plan lifecycle', 10),
  ('registered_nurse', 'Registered nurse', 'Clinical oversight, medicines and incidents', 20),
  ('carer', 'Carer', 'Delivers visits and records care', 30),
  ('finance_user', 'Finance', 'Invoicing, payroll and rate cards', 40),
  ('care_admin', 'Care admin', 'Full access to care management', 50)
ON CONFLICT (key) DO NOTHING;

INSERT INTO care.bundle_permissions (bundle_key, permission_name) VALUES
  ('care_coordinator', 'care.view_clients'), ('care_coordinator', 'care.edit_clients'), ('care_coordinator', 'care.manage_referrals'),
  ('care_coordinator', 'care.view_care_plans'), ('care_coordinator', 'care.edit_care_plans'),
  ('care_coordinator', 'care.view_schedule'), ('care_coordinator', 'care.edit_schedule'),
  ('care_coordinator', 'care.view_incidents'), ('care_coordinator', 'care.raise_incidents'),
  ('registered_nurse', 'care.view_clients'), ('registered_nurse', 'care.view_care_plans'),
  ('registered_nurse', 'care.view_medicines'), ('registered_nurse', 'care.administer_medicines'), ('registered_nurse', 'care.witness_medicines'),
  ('registered_nurse', 'care.view_incidents'), ('registered_nurse', 'care.raise_incidents'), ('registered_nurse', 'care.investigate_incidents'),
  ('carer', 'care.view_clients'), ('carer', 'care.view_care_plans'), ('carer', 'care.clock_visits'),
  ('carer', 'care.view_medicines'), ('carer', 'care.administer_medicines'),
  ('carer', 'care.raise_incidents'),
  ('finance_user', 'care.view_finance'), ('finance_user', 'care.edit_finance'),
  ('care_admin', 'care.view_clients'), ('care_admin', 'care.edit_clients'), ('care_admin', 'care.manage_referrals'),
  ('care_admin', 'care.view_care_plans'), ('care_admin', 'care.edit_care_plans'), ('care_admin', 'care.approve_care_plans'),
  ('care_admin', 'care.view_schedule'), ('care_admin', 'care.edit_schedule'), ('care_admin', 'care.clock_visits'),
  ('care_admin', 'care.view_medicines'), ('care_admin', 'care.administer_medicines'), ('care_admin', 'care.witness_medicines'),
  ('care_admin', 'care.view_incidents'), ('care_admin', 'care.raise_incidents'), ('care_admin', 'care.investigate_incidents'),
  ('care_admin', 'care.view_finance'), ('care_admin', 'care.edit_finance'),
  ('care_admin', 'care.manage_permissions'), ('care_admin', 'care.view_analytics')
ON CONFLICT (bundle_key, permission_name) DO NOTHING;
