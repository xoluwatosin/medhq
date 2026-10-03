-- Permission helper following the existing private.has_role pattern
CREATE OR REPLACE FUNCTION private.has_admin_permission(_user_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.is_super_admin(_user_id)
     OR EXISTS (
       SELECT 1 FROM public.admin_permissions ap
       WHERE ap.user_id = _user_id
         AND COALESCE(ap.is_active, true)
         AND ap.permissions ? _perm
     )
$$;

-- services
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  client_facing boolean NOT NULL DEFAULT true,
  takes_pre_assessment boolean NOT NULL DEFAULT true,
  questionnaire_section text,
  client_group text,
  always_modules text[] NOT NULL DEFAULT '{}',
  conditional_modules text[] NOT NULL DEFAULT '{}',
  is_offered boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage services" ON public.services FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.services (slug, name, client_facing, client_group, sort_order) VALUES
  ('antenatal-care', 'Antenatal care at home', true, 'maternal', 1),
  ('postnatal-care-omugwo', 'Postnatal care and Omugwo', true, 'maternal', 2),
  ('post-surgical-care', 'Post-surgical care at home', true, 'adult', 3),
  ('eldercare-companion-care', 'Eldercare and companion care', true, 'adult', 4),
  ('clinical-home-care', 'Clinical home care', true, 'adult', 5),
  ('nanny-childcare', 'Nanny and childcare', true, 'child', 6),
  ('children-additional-needs', 'Children with additional needs', true, 'child', 7),
  ('paediatric-care', 'Paediatric care', true, 'child', 8),
  ('hospital-staffing', 'Hospital staffing', false, NULL, 9),
  ('hospital-support', 'Hospital support', false, NULL, 10),
  ('clinical-research', 'Clinical research', false, NULL, 11);

-- service_fees
CREATE TABLE public.service_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  fee_type text NOT NULL CHECK (fee_type IN ('monthly','placement','visit','assessment')),
  label text,
  amount_naira numeric,
  state text NOT NULL DEFAULT 'not_set' CHECK (state IN ('set','not_set','on_request')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_fees TO authenticated;
GRANT ALL ON public.service_fees TO service_role;
ALTER TABLE public.service_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage service fees" ON public.service_fees FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- budget_bands
CREATE TABLE public.budget_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  lower_naira numeric,
  upper_naira numeric,
  is_discuss boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_bands TO authenticated;
GRANT ALL ON public.budget_bands TO service_role;
ALTER TABLE public.budget_bands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage budget bands" ON public.budget_bands FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.budget_bands (label, lower_naira, upper_naira, is_discuss, sort_order) VALUES
  ('Under 200,000 a month', NULL, 200000, false, 1),
  ('200,000 to 350,000 a month', 200000, 350000, false, 2),
  ('350,000 to 500,000 a month', 350000, 500000, false, 3),
  ('500,000 to 750,000 a month', 500000, 750000, false, 4),
  ('750,000 to 1,000,000 a month', 750000, 1000000, false, 5),
  ('Over 1,000,000 a month', 1000000, NULL, false, 6),
  ('We are booking individual visits', NULL, NULL, false, 7),
  ('We would rather discuss this with you', NULL, NULL, true, 8);

-- clients
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_number text UNIQUE,
  full_name text NOT NULL,
  preferred_name text,
  date_of_birth date,
  age_years int,
  sex text,
  languages text[] NOT NULL DEFAULT '{}',
  address_line text,
  landmark text,
  lga text,
  state text NOT NULL DEFAULT 'Lagos',
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  client_group text,
  arranged_from_abroad boolean NOT NULL DEFAULT false,
  abroad_country text,
  stage text NOT NULL DEFAULT 'enquiry' CHECK (stage IN ('enquiry','callback_due','pre_assessment_sent','responses_returned','assessment_booked','assessment_complete','plan_issued','care_running','closed')),
  created_from_submission_id uuid,
  closed_at timestamptz,
  closed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage clients" ON public.clients FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- client_contacts
CREATE TABLE public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship text,
  phone text,
  whatsapp text,
  email text,
  country text,
  best_time_to_reach text,
  is_primary boolean NOT NULL DEFAULT false,
  is_enquirer boolean NOT NULL DEFAULT false,
  may_act_for_client boolean NOT NULL DEFAULT false,
  authority_basis text CHECK (authority_basis IN ('next_of_kin','power_of_attorney','court_order','parental_responsibility','none','not_established')),
  authority_evidence_sighted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_contacts_client_id_idx ON public.client_contacts(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contacts TO authenticated;
GRANT ALL ON public.client_contacts TO service_role;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage client contacts" ON public.client_contacts FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- client_commercial (coordinator only)
CREATE TABLE public.client_commercial (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  budget_band_id uuid REFERENCES public.budget_bands(id) ON DELETE SET NULL,
  wants_to_discuss_budget boolean NOT NULL DEFAULT false,
  referral_source text,
  assessment_fee_state text NOT NULL DEFAULT 'unpaid' CHECK (assessment_fee_state IN ('unpaid','paid','waived')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_commercial TO authenticated;
GRANT ALL ON public.client_commercial TO service_role;
ALTER TABLE public.client_commercial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Care coordinators manage client commercial" ON public.client_commercial FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) AND private.has_admin_permission(auth.uid(), 'care_coordinator'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) AND private.has_admin_permission(auth.uid(), 'care_coordinator'));

-- form_definitions
CREATE TABLE public.form_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('pre_assessment','assessment','care_plan')),
  version int NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  published_at timestamptz,
  published_by uuid,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_definitions TO authenticated;
GRANT ALL ON public.form_definitions TO service_role;
ALTER TABLE public.form_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage form definitions" ON public.form_definitions FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- care_documents
CREATE TABLE public.care_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('pre_assessment','assessment','care_plan')),
  form_definition_id uuid NOT NULL REFERENCES public.form_definitions(id),
  version int,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','superseded','abandoned')),
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  built_from_id uuid REFERENCES public.care_documents(id),
  supersedes_id uuid REFERENCES public.care_documents(id),
  reissue_reason text,
  authored_by_person_id uuid,
  authored_by_token_id uuid,
  submitted_at timestamptz,
  content_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_documents_single_author CHECK (
    authored_by_person_id IS NULL OR authored_by_token_id IS NULL
  )
);
CREATE INDEX care_documents_client_id_idx ON public.care_documents(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_documents TO authenticated;
GRANT ALL ON public.care_documents TO service_role;
ALTER TABLE public.care_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage care documents" ON public.care_documents FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- care_access_tokens
CREATE TABLE public.care_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  token_hash text UNIQUE NOT NULL,
  filler_type text NOT NULL CHECK (filler_type IN ('client','parent','family_member','referring_clinician')),
  purpose text NOT NULL DEFAULT 'pre_assessment' CHECK (purpose IN ('pre_assessment','document_view')),
  expires_at timestamptz,
  revoked_at timestamptz,
  first_opened_at timestamptz,
  submitted_at timestamptz,
  frozen_at timestamptz,
  delivery_method text CHECK (delivery_method IN ('email','whatsapp','copied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_access_tokens_client_id_idx ON public.care_access_tokens(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_access_tokens TO authenticated;
GRANT ALL ON public.care_access_tokens TO service_role;
ALTER TABLE public.care_access_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage care access tokens" ON public.care_access_tokens FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- care_access_log (append only)
CREATE TABLE public.care_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES public.care_access_tokens(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.care_documents(id) ON DELETE SET NULL,
  action text NOT NULL,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_access_log_client_id_idx ON public.care_access_log(client_id);
GRANT SELECT ON public.care_access_log TO authenticated;
GRANT ALL ON public.care_access_log TO service_role;
ALTER TABLE public.care_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read care access log" ON public.care_access_log FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- care_assignments
CREATE TABLE public.care_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('assessor','named_caregiver','supervising_nurse')),
  starts_on date,
  ends_on date,
  plan_version_id uuid REFERENCES public.care_documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_assignments_client_id_idx ON public.care_assignments(client_id);
CREATE INDEX care_assignments_person_id_idx ON public.care_assignments(person_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_assignments TO authenticated;
GRANT ALL ON public.care_assignments TO service_role;
ALTER TABLE public.care_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage care assignments" ON public.care_assignments FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));