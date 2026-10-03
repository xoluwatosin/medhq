-- 1. Staff fields on the person record
ALTER TABLE public.mu_people
  ADD COLUMN IF NOT EXISTS is_staff boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS staff_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS staff_start_date date,
  ADD COLUMN IF NOT EXISTS staff_end_date date,
  ADD COLUMN IF NOT EXISTS reports_to uuid,
  ADD COLUMN IF NOT EXISTS work_email text;

CREATE INDEX IF NOT EXISTS mu_people_is_staff_idx ON public.mu_people (is_staff) WHERE is_staff;

-- 2. Contracts
CREATE TABLE IF NOT EXISTS public.mu_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  contract_type text NOT NULL DEFAULT 'full_time',
  job_title text,
  department text,
  start_date date,
  end_date date,
  probation_end date,
  notice_period text,
  pay_amount numeric,
  pay_currency text NOT NULL DEFAULT 'NGN',
  pay_frequency text NOT NULL DEFAULT 'monthly',
  working_pattern text,
  location text,
  document_id uuid REFERENCES public.mu_documents(id) ON DELETE SET NULL,
  document_url text,
  status text NOT NULL DEFAULT 'draft',
  signature_method text,
  signed_name text,
  issued_at timestamptz,
  signed_at timestamptz,
  ended_at timestamptz,
  withdrawn_at timestamptz,
  notes text,
  created_by uuid,
  created_by_name text,
  issued_by uuid,
  issued_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_contracts TO authenticated;
GRANT ALL ON public.mu_contracts TO service_role;
ALTER TABLE public.mu_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage contracts" ON public.mu_contracts
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "People read their own contracts" ON public.mu_contracts
  FOR SELECT TO authenticated
  USING (person_id = public.mu_my_person_id());

CREATE INDEX IF NOT EXISTS mu_contracts_person_idx ON public.mu_contracts (person_id, created_at DESC);

-- 3. Emergency contacts
CREATE TABLE IF NOT EXISTS public.mu_staff_emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text,
  phone text,
  email text,
  address text,
  is_next_of_kin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_staff_emergency_contacts TO authenticated;
GRANT ALL ON public.mu_staff_emergency_contacts TO service_role;
ALTER TABLE public.mu_staff_emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage emergency contacts" ON public.mu_staff_emergency_contacts
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "People manage their own emergency contacts" ON public.mu_staff_emergency_contacts
  FOR ALL TO authenticated
  USING (person_id = public.mu_my_person_id())
  WITH CHECK (person_id = public.mu_my_person_id());

CREATE TRIGGER mu_contracts_touch BEFORE UPDATE ON public.mu_contracts
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();
CREATE TRIGGER mu_staff_emergency_touch BEFORE UPDATE ON public.mu_staff_emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- 4. Staff document types and requirements
INSERT INTO public.mu_document_types (code, label, helper, evidences, expected_fields, expires, sort_order, active)
VALUES
  ('signed_contract', 'Signed contract', 'The employment contract, signed by both sides.', ARRAY['employment'], ARRAY[]::text[], false, 140, true),
  ('bank_details', 'Bank details', 'Account name, number and bank for payroll.', ARRAY[]::text[], ARRAY[]::text[], false, 150, true),
  ('tax_id', 'Tax identification', 'Tax identification number document.', ARRAY[]::text[], ARRAY[]::text[], false, 160, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.mu_required_documents (doc_type, label, helper, rule, sort_order, active)
VALUES
  ('Contract', 'Signed contract', 'Your signed employment contract.', 'staff_only', 20, true),
  ('BankDetails', 'Bank details', 'Payroll account details.', 'staff_only', 21, true),
  ('TaxID', 'Tax identification', 'Your tax identification document.', 'staff_only', 22, true),
  ('BackgroundCheck', 'Background check', 'Police or background clearance.', 'staff_only', 23, true)
ON CONFLICT (doc_type) DO NOTHING;

-- 5. Document status becomes staff aware
CREATE OR REPLACE FUNCTION public.mu_document_status(_person_id uuid)
RETURNS TABLE (
  doc_type text, label text, helper text, required boolean, status text,
  document_id uuid, document_label text, document_url text, expires_at date,
  review_reason text, reviewed_at timestamptz, source_note text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  prof text;
  staff boolean;
BEGIN
  SELECT p.profession, p.is_staff INTO prof, staff FROM public.mu_people p WHERE p.id = _person_id;
  staff := COALESCE(staff, false);

  RETURN QUERY
  WITH req AS (
    SELECT r.doc_type, r.label, r.helper, r.sort_order,
           (r.rule = 'always'
             OR (r.rule = 'licensed_only' AND public.mu_expects_licence(prof))
             OR (r.rule = 'staff_only' AND staff)) AS required
      FROM public.mu_required_documents r
     WHERE r.active
       AND (r.rule <> 'staff_only' OR staff)
  ),
  best AS (
    SELECT DISTINCT ON (d.doc_type)
           d.doc_type, d.id, d.label, d.url, d.expires_at, d.review_reason,
           d.reviewed_at, d.source_note, d.review_outcome
      FROM public.mu_documents d
     WHERE d.person_id = _person_id
     ORDER BY d.doc_type,
              CASE d.review_outcome WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
              d.created_at DESC
  )
  SELECT req.doc_type, req.label, req.helper, req.required,
         CASE
           WHEN b.id IS NULL THEN 'missing'
           WHEN b.review_outcome = 'accepted' AND b.expires_at IS NOT NULL AND b.expires_at < current_date THEN 'expired'
           WHEN b.review_outcome = 'accepted' THEN 'accepted'
           WHEN b.review_outcome = 'rejected' THEN 'rejected'
           ELSE 'pending'
         END,
         b.id, b.label, b.url, b.expires_at, b.review_reason, b.reviewed_at, b.source_note
    FROM req LEFT JOIN best b ON b.doc_type = req.doc_type
   ORDER BY req.sort_order;
END;
$fn$;

-- 6. Contract actions
CREATE OR REPLACE FUNCTION public.mu_create_contract(_person_id uuid, _payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  new_id uuid;
  actor text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  SELECT display_name INTO actor FROM public.admin_permissions WHERE user_id = auth.uid();

  INSERT INTO public.mu_contracts (
    person_id, contract_type, job_title, department, start_date, end_date, probation_end,
    notice_period, pay_amount, pay_currency, pay_frequency, working_pattern, location,
    document_url, notes, created_by, created_by_name
  ) VALUES (
    _person_id,
    COALESCE(_payload->>'contract_type', 'full_time'),
    NULLIF(_payload->>'job_title', ''),
    NULLIF(_payload->>'department', ''),
    NULLIF(_payload->>'start_date', '')::date,
    NULLIF(_payload->>'end_date', '')::date,
    NULLIF(_payload->>'probation_end', '')::date,
    NULLIF(_payload->>'notice_period', ''),
    NULLIF(_payload->>'pay_amount', '')::numeric,
    COALESCE(NULLIF(_payload->>'pay_currency', ''), 'NGN'),
    COALESCE(NULLIF(_payload->>'pay_frequency', ''), 'monthly'),
    NULLIF(_payload->>'working_pattern', ''),
    NULLIF(_payload->>'location', ''),
    NULLIF(_payload->>'document_url', ''),
    NULLIF(_payload->>'notes', ''),
    auth.uid(), actor
  ) RETURNING id INTO new_id;

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (_person_id, auth.uid(), actor, 'contract_created', jsonb_build_object('contract_id', new_id));

  RETURN new_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.mu_issue_contract(_contract_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  actor text;
  pid uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  SELECT display_name INTO actor FROM public.admin_permissions WHERE user_id = auth.uid();

  UPDATE public.mu_contracts
     SET status = 'issued', issued_at = now(), issued_by = auth.uid(), issued_by_name = actor
   WHERE id = _contract_id AND status = 'draft'
   RETURNING person_id INTO pid;

  IF pid IS NULL THEN
    RAISE EXCEPTION 'Contract is not a draft';
  END IF;

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (pid, auth.uid(), actor, 'contract_issued', jsonb_build_object('contract_id', _contract_id));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.mu_sign_contract(_contract_id uuid, _signed_name text, _method text DEFAULT 'typed')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  pid uuid;
  mine uuid;
BEGIN
  SELECT person_id INTO pid FROM public.mu_contracts WHERE id = _contract_id;
  mine := public.mu_my_person_id();
  IF pid IS NULL THEN
    RAISE EXCEPTION 'Contract not found';
  END IF;
  IF NOT (private.has_role(auth.uid(), 'admin'::app_role) OR pid = mine) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.mu_contracts
     SET status = 'signed', signed_at = now(),
         signed_name = COALESCE(NULLIF(_signed_name, ''), signed_name),
         signature_method = COALESCE(_method, 'typed')
   WHERE id = _contract_id AND status IN ('issued', 'draft');

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (pid, auth.uid(), _signed_name, 'contract_signed', jsonb_build_object('contract_id', _contract_id));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.mu_set_contract_status(_contract_id uuid, _status text, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  actor text;
  pid uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF _status NOT IN ('draft', 'issued', 'signed', 'active', 'ended', 'withdrawn') THEN
    RAISE EXCEPTION 'Unknown contract state';
  END IF;
  SELECT display_name INTO actor FROM public.admin_permissions WHERE user_id = auth.uid();

  UPDATE public.mu_contracts
     SET status = _status,
         ended_at = CASE WHEN _status = 'ended' THEN now() ELSE ended_at END,
         withdrawn_at = CASE WHEN _status = 'withdrawn' THEN now() ELSE withdrawn_at END,
         notes = COALESCE(NULLIF(_note, ''), notes)
   WHERE id = _contract_id
   RETURNING person_id INTO pid;

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (pid, auth.uid(), actor, 'contract_' || _status, jsonb_build_object('contract_id', _contract_id));
END;
$fn$;

-- 7. Convert a hired person into staff
CREATE OR REPLACE FUNCTION public.mu_convert_to_staff(_person_id uuid, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  actor text;
  signed boolean;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.mu_contracts c
     WHERE c.person_id = _person_id AND c.status IN ('signed', 'active')
  ) INTO signed;

  IF NOT signed THEN
    RAISE EXCEPTION 'A signed contract is required before someone becomes staff';
  END IF;

  SELECT display_name INTO actor FROM public.admin_permissions WHERE user_id = auth.uid();

  UPDATE public.mu_people
     SET is_staff = true,
         staff_status = COALESCE(NULLIF(_payload->>'staff_status', ''), 'active'),
         job_title = COALESCE(NULLIF(_payload->>'job_title', ''), job_title),
         department = COALESCE(NULLIF(_payload->>'department', ''), department),
         employment_type = COALESCE(NULLIF(_payload->>'employment_type', ''), employment_type),
         staff_start_date = COALESCE(NULLIF(_payload->>'staff_start_date', '')::date, staff_start_date),
         work_email = COALESCE(NULLIF(_payload->>'work_email', ''), work_email)
   WHERE id = _person_id;

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (_person_id, auth.uid(), actor, 'became_staff', _payload);
END;
$fn$;

-- 8. Staff list for the workforce board
CREATE OR REPLACE FUNCTION public.mu_staff_list()
RETURNS TABLE (
  id uuid, full_name text, email text, work_email text, phone text,
  job_title text, department text, employment_type text, staff_status text,
  staff_start_date date, auth_user_id uuid,
  contract_status text, contract_id uuid,
  docs_required integer, docs_accepted integer, docs_missing integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT p.id, p.full_name, p.email, p.work_email, p.phone,
         p.job_title, p.department, p.employment_type, p.staff_status,
         p.staff_start_date, p.auth_user_id,
         c.status, c.id,
         COALESCE(d.req, 0)::int, COALESCE(d.ok, 0)::int, COALESCE(d.req, 0)::int - COALESCE(d.ok, 0)::int
    FROM public.mu_people p
    LEFT JOIN LATERAL (
      SELECT mc.id, mc.status FROM public.mu_contracts mc
       WHERE mc.person_id = p.id
       ORDER BY CASE mc.status WHEN 'active' THEN 0 WHEN 'signed' THEN 1 WHEN 'issued' THEN 2 WHEN 'draft' THEN 3 ELSE 4 END,
                mc.created_at DESC
       LIMIT 1
    ) c ON true
    LEFT JOIN LATERAL (
      SELECT count(*) FILTER (WHERE s.required) AS req,
             count(*) FILTER (WHERE s.required AND s.status = 'accepted') AS ok
        FROM public.mu_document_status(p.id) s
    ) d ON true
   WHERE p.is_staff
   ORDER BY p.full_name;
$fn$;

GRANT EXECUTE ON FUNCTION public.mu_create_contract(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_issue_contract(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_sign_contract(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_set_contract_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_convert_to_staff(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_staff_list() TO authenticated;