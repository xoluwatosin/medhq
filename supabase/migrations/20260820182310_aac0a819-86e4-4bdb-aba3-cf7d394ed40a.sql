-- 1. Contract document columns
ALTER TABLE public.mu_contracts
  ADD COLUMN IF NOT EXISTS fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS clauses jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS annexes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS issued_clauses jsonb,
  ADD COLUMN IF NOT EXISTS issued_fields jsonb,
  ADD COLUMN IF NOT EXISTS issued_hash text,
  ADD COLUMN IF NOT EXISTS is_clinical boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sign_token text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_image text,
  ADD COLUMN IF NOT EXISTS signed_ip text,
  ADD COLUMN IF NOT EXISTS signed_user_agent text,
  ADD COLUMN IF NOT EXISTS countersigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS countersigned_by uuid,
  ADD COLUMN IF NOT EXISTS countersigned_name text,
  ADD COLUMN IF NOT EXISTS countersignature_image text,
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS supersedes_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS mu_contracts_sign_token_idx ON public.mu_contracts (sign_token) WHERE sign_token IS NOT NULL;

-- 2. Clause library
CREATE TABLE IF NOT EXISTS public.mu_contract_clause_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  heading text NOT NULL,
  body text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  section text NOT NULL DEFAULT 'main',
  locked boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_contract_clause_library TO authenticated;
GRANT ALL ON public.mu_contract_clause_library TO service_role;
ALTER TABLE public.mu_contract_clause_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage clause library" ON public.mu_contract_clause_library
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER mu_contract_clause_library_touch
  BEFORE UPDATE ON public.mu_contract_clause_library
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- 3. Contract events (audit trail)
CREATE TABLE IF NOT EXISTS public.mu_contract_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.mu_contracts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid,
  actor_name text,
  actor_role text,
  detail text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mu_contract_events_contract_idx ON public.mu_contract_events (contract_id, created_at DESC);

GRANT SELECT ON public.mu_contract_events TO authenticated;
GRANT ALL ON public.mu_contract_events TO service_role;
ALTER TABLE public.mu_contract_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read contract events" ON public.mu_contract_events
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "People read their own contract events" ON public.mu_contract_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mu_contracts c
    WHERE c.id = mu_contract_events.contract_id AND c.person_id = public.mu_my_person_id()
  ));

-- 4. Event logger
CREATE OR REPLACE FUNCTION public.mu_contract_log(
  _contract_id uuid, _event_type text, _detail text DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb, _actor_name text DEFAULT NULL,
  _ip text DEFAULT NULL, _user_agent text DEFAULT NULL, _actor_role text DEFAULT 'admin'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.mu_contract_events (contract_id, event_type, actor_id, actor_name, actor_role, detail, payload, ip, user_agent)
  VALUES (_contract_id, _event_type, auth.uid(), _actor_name, _actor_role, _detail, COALESCE(_payload, '{}'::jsonb), _ip, _user_agent)
  RETURNING id INTO _id;
  RETURN _id;
END; $$;

-- 5. Create from library
CREATE OR REPLACE FUNCTION public.mu_contract_create_from_library(
  _person_id uuid, _payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _clauses jsonb;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'key', key, 'heading', heading, 'body', body, 'section', section, 'locked', locked
  ) ORDER BY sort_order), '[]'::jsonb)
  INTO _clauses
  FROM public.mu_contract_clause_library WHERE active;

  INSERT INTO public.mu_contracts (
    person_id, contract_type, job_title, department, start_date, notice_period,
    pay_amount, pay_currency, pay_frequency, working_pattern, location,
    status, fields, clauses, is_clinical, created_by, created_by_name
  ) VALUES (
    _person_id,
    COALESCE(_payload->>'contract_type', 'full_time'),
    _payload->>'job_title',
    _payload->>'department',
    NULLIF(_payload->>'start_date','')::date,
    _payload->>'notice_period',
    NULLIF(_payload->>'pay_amount','')::numeric,
    COALESCE(_payload->>'pay_currency', 'NGN'),
    COALESCE(_payload->>'pay_frequency', 'monthly'),
    _payload->>'working_pattern',
    _payload->>'location',
    'draft',
    COALESCE(_payload->'fields', '{}'::jsonb),
    _clauses,
    COALESCE((_payload->>'is_clinical')::boolean, false),
    auth.uid(),
    _payload->>'created_by_name'
  ) RETURNING id INTO _id;

  PERFORM public.mu_contract_log(_id, 'created', 'Contract drafted from the clause library', '{}'::jsonb, _payload->>'created_by_name');
  RETURN _id;
END; $$;

-- 6. Save draft
CREATE OR REPLACE FUNCTION public.mu_contract_save_draft(
  _contract_id uuid, _payload jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _status text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  SELECT status INTO _status FROM public.mu_contracts WHERE id = _contract_id;
  IF _status IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF _status <> 'draft' THEN RAISE EXCEPTION 'Only a draft can be edited'; END IF;

  UPDATE public.mu_contracts SET
    job_title = COALESCE(_payload->>'job_title', job_title),
    department = COALESCE(_payload->>'department', department),
    contract_type = COALESCE(_payload->>'contract_type', contract_type),
    start_date = COALESCE(NULLIF(_payload->>'start_date','')::date, start_date),
    end_date = COALESCE(NULLIF(_payload->>'end_date','')::date, end_date),
    notice_period = COALESCE(_payload->>'notice_period', notice_period),
    pay_amount = COALESCE(NULLIF(_payload->>'pay_amount','')::numeric, pay_amount),
    pay_currency = COALESCE(_payload->>'pay_currency', pay_currency),
    pay_frequency = COALESCE(_payload->>'pay_frequency', pay_frequency),
    working_pattern = COALESCE(_payload->>'working_pattern', working_pattern),
    location = COALESCE(_payload->>'location', location),
    notes = COALESCE(_payload->>'notes', notes),
    is_clinical = COALESCE((_payload->>'is_clinical')::boolean, is_clinical),
    fields = COALESCE(_payload->'fields', fields),
    clauses = COALESCE(_payload->'clauses', clauses),
    annexes = COALESCE(_payload->'annexes', annexes),
    updated_at = now()
  WHERE id = _contract_id;

  PERFORM public.mu_contract_log(_contract_id, 'edited', COALESCE(_payload->>'change_note', 'Draft updated'), '{}'::jsonb, _payload->>'actor_name');
END; $$;

-- 7. Issue: freeze wording, mint token
CREATE OR REPLACE FUNCTION public.mu_contract_issue(
  _contract_id uuid, _actor_name text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _token text; _row public.mu_contracts;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  SELECT * INTO _row FROM public.mu_contracts WHERE id = _contract_id;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF _row.status NOT IN ('draft','issued') THEN RAISE EXCEPTION 'This contract has moved beyond issue'; END IF;

  _token := encode(gen_random_bytes(32), 'hex');

  UPDATE public.mu_contracts SET
    status = 'issued',
    issued_at = COALESCE(issued_at, now()),
    issued_by = auth.uid(),
    issued_by_name = COALESCE(_actor_name, issued_by_name),
    issued_clauses = clauses,
    issued_fields = fields,
    issued_hash = encode(digest(clauses::text || fields::text, 'sha256'), 'hex'),
    sign_token = _token,
    token_expires_at = now() + interval '30 days',
    updated_at = now()
  WHERE id = _contract_id;

  PERFORM public.mu_contract_log(_contract_id, 'issued', 'Contract issued and wording frozen', '{}'::jsonb, _actor_name);
  RETURN _token;
END; $$;

-- 8. Sign (signed-in route; the public route goes through the edge function)
CREATE OR REPLACE FUNCTION public.mu_contract_sign(
  _contract_id uuid, _signed_name text, _method text DEFAULT 'typed',
  _signature_image text DEFAULT NULL, _user_agent text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.mu_contracts;
BEGIN
  SELECT * INTO _row FROM public.mu_contracts WHERE id = _contract_id;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF _row.person_id <> public.mu_my_person_id() THEN
    RAISE EXCEPTION 'Only the person named on the contract can sign it';
  END IF;
  IF _row.status <> 'issued' THEN RAISE EXCEPTION 'This contract is not awaiting signature'; END IF;
  IF COALESCE(btrim(_signed_name), '') = '' THEN RAISE EXCEPTION 'A name is required'; END IF;

  UPDATE public.mu_contracts SET
    status = 'signed',
    signed_at = now(),
    signed_name = btrim(_signed_name),
    signature_method = _method,
    signature_image = _signature_image,
    signed_user_agent = _user_agent,
    sign_token = NULL,
    updated_at = now()
  WHERE id = _contract_id;

  PERFORM public.mu_contract_log(
    _contract_id, 'signed', 'Signed in the portal',
    jsonb_build_object('method', _method, 'hash', _row.issued_hash),
    btrim(_signed_name), NULL, _user_agent, 'person'
  );
END; $$;

-- 9. Countersign
CREATE OR REPLACE FUNCTION public.mu_contract_countersign(
  _contract_id uuid, _name text, _signature_image text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  UPDATE public.mu_contracts SET
    countersigned_at = now(),
    countersigned_by = auth.uid(),
    countersigned_name = _name,
    countersignature_image = _signature_image,
    status = CASE WHEN status = 'signed' THEN 'active' ELSE status END,
    updated_at = now()
  WHERE id = _contract_id;
  PERFORM public.mu_contract_log(_contract_id, 'countersigned', 'Countersigned for Medic Connect Limited', '{}'::jsonb, _name);
END; $$;

-- 10. Void
CREATE OR REPLACE FUNCTION public.mu_contract_void(
  _contract_id uuid, _reason text DEFAULT NULL, _actor_name text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  UPDATE public.mu_contracts SET
    status = 'withdrawn', withdrawn_at = now(), sign_token = NULL,
    notes = COALESCE(_reason, notes), updated_at = now()
  WHERE id = _contract_id;
  PERFORM public.mu_contract_log(_contract_id, 'voided', COALESCE(_reason, 'Contract withdrawn'), '{}'::jsonb, _actor_name);
END; $$;

-- 11. Seed the clause library from the reference document
INSERT INTO public.mu_contract_clause_library (key, heading, body, sort_order, section, locked) VALUES
('position', 'Position',
'<p>Your role will be that of {{job_title}}, and you will report directly to the {{reports_to}}. Your primary responsibilities will include {{primary_responsibilities}}. Please review this summary of terms and conditions for your anticipated employment with us.</p><h3>Conditions of Employment Offer</h3><p>Your employment offer is contingent upon the fulfilment of the following conditions:</p><ol><li><strong>Acceptance of Offer.</strong> This offer of employment must be accepted within {{acceptance_window}} from the date of this document.</li><li><strong>Accuracy of Information.</strong> The information you have provided to the Company must be accurate and complete. Any material inaccuracies or omissions in the information provided may result in the withdrawal of the offer or termination of your employment, if discovered at a later stage.</li><li><strong>No Conflicting Obligations.</strong> You must not have any existing obligations to a former employer that would directly or indirectly restrict or prevent you from fully performing your duties with the Company.</li><li><strong>Termination for Non-Compliance.</strong> Should any of the above conditions not be met during your employment, and subject to the applicable labour laws in Nigeria, the Company reserves the right to terminate your employment immediately, without notice or severance compensation.</li></ol>', 10, 'main', false),
('job_description', 'Job Description',
'<p>{{job_description_groups}}</p><p class="muted">The scope of this role might change depending on business needs</p>', 20, 'main', false),
('commencement', 'Commencement Date',
'<p>{{clause_commencement}}</p>', 30, 'main', false),
('salary', 'Salary / Compensation / Benefits',
'<p>Your basic salary will be {{salary_figure}} ({{salary_words}}) per month, payable in arrears on or before the last day of each month.</p><p>In addition to your basic salary, you will be eligible for a performance bonus, which will be determined by management, based on your overall effectiveness in performing job duties, including but not limited to:</p><ol><li>Timeliness and accuracy of administrative support.</li><li>Ability to manage and prioritise tasks effectively.</li><li>Quality of communication and interaction with internal and external stakeholders.</li><li>Completion of assigned goals or objectives related to business operations.</li></ol><p>The performance bonus will be awarded annually or at the end of the performance review period, subject to management evaluation.</p><p>You are also eligible to this benefit:</p><ol><li><strong>Commitment to Growth:</strong> The Company is committed to supporting the continuous professional growth and development of its employees.</li><li><strong>Training and Courses:</strong> The Company will provide opportunities for professional development, including access to relevant training programmes, seminars, workshops and conferences, as deemed appropriate for your role.</li><li><strong>Performance and Development Reviews:</strong> Regular performance reviews will be conducted to assess your progress, provide feedback and identify any additional professional development needs.</li><li><strong>Conditions:</strong> Any professional development activities supported by the Company are subject to the training being aligned with your role, your remaining employed with the Company for a specified period after completion, and the Company approving the programme.</li></ol>', 40, 'main', false),
('working_hours', 'Working Hours',
'<ol><li><strong>Basis of engagement:</strong> This is a {{employment_basis}} position, and you are expected to dedicate the necessary time and effort to perform your duties effectively.</li><li><strong>Working Hours:</strong> You are required to work {{weekly_hours}} per week.</li><li><strong>Work Arrangement:</strong> The position is based on a {{work_model}} work model. Specific details regarding your in-office and remote workdays will be communicated by your supervisor and may be subject to change based on operational needs and company policies. You must be available during agreed working hours and respond to communications within a reasonable timeframe.</li></ol>', 50, 'main', false),
('confidentiality', 'Confidentiality and Non-Disclosure',
'<p>In your role, you will have access to confidential information regarding the company operations, strategies and clients. You are expected to maintain confidentiality and not disclose any proprietary information to unauthorised persons, both during and after your employment with us.</p><ol><li><strong>Breach of Confidentiality:</strong> Any violation of this confidentiality clause may result in disciplinary action, including termination of employment and potential legal action for damages.</li><li><strong>Personal Devices:</strong> Employees are prohibited from storing Confidential Information on personal devices without prior written approval from the Company.</li><li><strong>Forensic Audits:</strong> The employee consents to forensic audits of company devices and accounts to ensure compliance with confidentiality obligations.</li><li><strong>Confidentiality Obligation:</strong> The employee agrees to maintain the confidentiality of all Confidential Information during employment and for five (5) years following termination.</li><li><strong>Definition of Confidential Information:</strong> Confidential Information includes business strategies, financial data, client lists, marketing plans, proprietary technologies, trade secrets, any Intellectual Property developed during employment, and any other non-public information concerning the Company.</li><li><strong>Return of Company Materials:</strong> Upon termination of employment, the Employee must return all Company property, including electronic files, documents, passwords and any copies of Confidential Information.</li></ol>', 60, 'main', false),
('termination', 'Termination of Employment',
'<p>Either party may terminate this employment agreement with {{notice_period}} written notice or payment in lieu of notice. Termination may occur for cause as per the provisions of Nigerian labour laws.</p>', 70, 'main', false),
('disciplinary', 'Disciplinary Rules',
'<p>In the event of actions or behaviour that can be deemed Gross Misconduct and in accordance with local law, the Firm reserves the right to invoke disciplinary action, the outcome of which could include summary dismissal without notice.</p><p>The following actions constitute Gross Misconduct, leading to immediate dismissal without notice or severance:</p><ol><li>Fraud, theft, dishonesty or misrepresentation.</li><li>Sexual harassment, discrimination or workplace violence.</li><li>Breach of confidentiality or unauthorised disclosure of Company data.</li><li>Failure to report to work for three (3) consecutive days without prior notice.</li><li>Any act that brings the Company into disrepute.</li></ol>', 80, 'main', false),
('absenteeism', 'Absenteeism and Disciplinary Action',
'<ol><li><strong>No Pay for Absence:</strong> If the Employee fails to report to work without prior notice or a valid reason (No Call, No Show), the Employee will not be paid for the period of absence.</li><li><strong>First Offence, Written Warning:</strong> Upon the first occurrence of a No Call, No Show, the Employee will receive a written warning.</li><li><strong>Second Offence, Termination:</strong> If the Employee commits a second No Call, No Show offence, their employment will be terminated immediately.</li></ol>', 90, 'main', false),
('governing_law', 'Governing Law',
'<p>Your employment contract is governed by the laws of Nigeria, including any applicable collective agreements, and is subject to the provisions of the Labour Act of Nigeria and relevant regulations.</p><p>In the event of a dispute, both parties agree to first pursue mediation or arbitration before resorting to litigation.</p><p>Should the dispute remain unresolved, the National Industrial Court of Nigeria (NICN) will have exclusive jurisdiction over any employment related matters.</p>', 100, 'main', false),
('interpretation', 'Interpretation, Amendment and Enforcement',
'<p>This letter supersedes and replaces any prior agreements, representations or understandings (whether written, oral, implied or otherwise) between you and the Company and constitutes the complete agreement between you and the Company regarding the subject matter set forth herein. This letter cum agreement may not be amended or modified, except by an express written agreement signed by both you and a duly authorised officer of the Company.</p>', 110, 'main', false),
('additional_amendments', 'Amendments',
'<ol><li>Either party may propose amendments, which must be mutually agreed upon in writing.</li><li>A 7 day notice period for proposing amendments.</li><li>Urgent regulatory or legal compliance amendments may be implemented immediately with written notification to the Employee.</li></ol>', 200, 'additional', false),
('additional_qualifications', 'Qualification and Professional Membership Checks',
'<ol><li>Certain roles may require specific qualifications or professional membership.</li><li>Medic Connect will seek confirmation through certificates or renewal notices and may verify with the granting body.</li><li>Checks will be performed at appointment and upon membership renewal.</li><li>Falsification of qualifications may result in dismissal.</li></ol>', 210, 'additional', false),
('additional_ip', 'Intellectual Property and Confidentiality',
'<ol><li><strong>Intellectual Property Ownership.</strong> Intellectual Property, including inventions, discoveries, designs, trademarks, copyrights, trade secrets and other works created during employment that relates to the Company business or anticipated business shall be the sole property of the Company. The Employee waives all moral rights to any such Intellectual Property. Pre-existing Intellectual Property belonging to the Employee must be disclosed in writing before employment.</li><li><strong>Assistance in IP Protection.</strong> The Employee agrees to provide all necessary assistance, including signing documents and taking actions required to register, enforce or exploit the Intellectual Property in the Company name, even after employment ends.</li><li><strong>Survival and Enforcement.</strong> This clause survives employment termination for five (5) years, except for trade secrets, which survive indefinitely.</li></ol>', 220, 'additional', false),
('additional_deductions', 'Deductions from Salary',
'<ol><li>The company reserves the right to deduct overpayments or monies owed from salary during or upon termination of employment.</li></ol><p><strong>Primary place of work:</strong> {{primary_place_of_work}}</p>', 230, 'additional', false)
ON CONFLICT (key) DO NOTHING;