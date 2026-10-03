-- Contract templates, an annex library, and issuing to many at once.
--
-- A role you hire several people into is one contract written once. A template
-- holds the wording, the shared terms and the annex set. Each annex becomes a
-- record of its own: either a document edited in the app, or a file attached
-- once and reused. What a person signs is still frozen on their own contract,
-- so a template moving on never touches a contract already issued.

-- 1. The annex library.
CREATE TABLE IF NOT EXISTS public.mu_contract_annex_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'document',      -- 'document' or 'file'
  body text NOT NULL DEFAULT '',              -- the wording, when it is a document
  note text,
  file_path text,
  file_name text,
  requires_signature boolean NOT NULL DEFAULT false,
  clinical_only boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_contract_annex_library TO authenticated;
GRANT ALL ON public.mu_contract_annex_library TO service_role;
ALTER TABLE public.mu_contract_annex_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage the annex library" ON public.mu_contract_annex_library;
CREATE POLICY "Admins manage the annex library" ON public.mu_contract_annex_library
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS mu_contract_annex_library_touch ON public.mu_contract_annex_library;
CREATE TRIGGER mu_contract_annex_library_touch
  BEFORE UPDATE ON public.mu_contract_annex_library
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- The six standard annexes, so the library is never empty on day one.
-- If admins edited the annex library while this draft was still pending, carry
-- those edits out of the temporary settings store and into the proper table.
INSERT INTO public.mu_contract_annex_library (
  code, title, kind, body, note, file_path, file_name,
  requires_signature, clinical_only, sort_order, active
)
SELECT DISTINCT ON (item->>'code')
  item->>'code',
  item->>'title',
  COALESCE(item->>'kind', 'document'),
  COALESCE(item->>'body', ''),
  NULLIF(item->>'note', ''),
  NULLIF(item->>'file_path', ''),
  NULLIF(item->>'file_name', ''),
  COALESCE((item->>'requires_signature')::boolean, false),
  COALESCE((item->>'clinical_only')::boolean, false),
  COALESCE((item->>'sort_order')::integer, 0),
  COALESCE((item->>'active')::boolean, true)
FROM public.admin_settings s
CROSS JOIN jsonb_array_elements(s.value) item
WHERE s.key = 'contract_annex_library'
  AND jsonb_typeof(s.value) = 'array'
  AND COALESCE(item->>'code', '') <> ''
  AND COALESCE(item->>'title', '') <> ''
ORDER BY item->>'code', COALESCE((item->>'sort_order')::integer, 0)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  body = EXCLUDED.body,
  note = EXCLUDED.note,
  file_path = EXCLUDED.file_path,
  file_name = EXCLUDED.file_name,
  requires_signature = EXCLUDED.requires_signature,
  clinical_only = EXCLUDED.clinical_only,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active;

INSERT INTO public.mu_contract_annex_library (code, title, kind, requires_signature, clinical_only, sort_order)
VALUES
  ('Annex A', 'Job description', 'document', false, false, 10),
  ('Annex B', 'Code of conduct', 'document', true, false, 20),
  ('Annex C', 'Disciplinary and grievance procedure', 'document', false, false, 30),
  ('Annex D', 'Confidentiality undertaking', 'document', true, false, 40),
  ('Annex E', 'Data protection notice', 'document', false, false, 50),
  ('Annex F', 'Scope of practice, clinical roles only', 'document', false, true, 60)
ON CONFLICT (code) DO NOTHING;

-- 2. Contract templates.
--
-- fields        the values that are the same for everybody on this role
-- field_rules   per field: 'fixed', 'prefill' or 'ask'. Anything marked 'ask'
--               must be answered before that person's contract can be issued.
-- clauses       the wording, copied from the clause library when created
-- annexes       the annex set this role carries, by code, with overrides
CREATE TABLE IF NOT EXISTS public.mu_contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  contract_type text NOT NULL DEFAULT 'full_time',
  job_title text,
  department text,
  is_clinical boolean NOT NULL DEFAULT false,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  field_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  clauses jsonb NOT NULL DEFAULT '[]'::jsonb,
  annexes jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_contract_templates TO authenticated;
GRANT ALL ON public.mu_contract_templates TO service_role;
ALTER TABLE public.mu_contract_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage contract templates" ON public.mu_contract_templates;
CREATE POLICY "Admins manage contract templates" ON public.mu_contract_templates
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS mu_contract_templates_touch ON public.mu_contract_templates;
CREATE TRIGGER mu_contract_templates_touch
  BEFORE UPDATE ON public.mu_contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- 3. A contract remembers the template it came from, and freezes its annexes
--    at issue alongside its clauses.
ALTER TABLE public.mu_contracts
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.mu_contract_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issued_annexes jsonb;

CREATE INDEX IF NOT EXISTS mu_contracts_template_idx ON public.mu_contracts (template_id);

-- 4. Create a contract from a template.
--    The template supplies the wording, the shared terms and the annex set.
--    The payload supplies this person's own values and wins over the template.
CREATE OR REPLACE FUNCTION public.mu_contract_create_from_template(
  _person_id uuid, _template_id uuid, _payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _t public.mu_contract_templates; _fields jsonb;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  SELECT * INTO _t FROM public.mu_contract_templates WHERE id = _template_id;
  IF _t.id IS NULL THEN RAISE EXCEPTION 'Template not found'; END IF;

  _fields := COALESCE(_t.fields, '{}'::jsonb) || COALESCE(_payload->'fields', '{}'::jsonb);

  INSERT INTO public.mu_contracts (
    person_id, template_id, contract_type, job_title, department, start_date, notice_period,
    pay_amount, pay_currency, pay_frequency, working_pattern, location,
    status, fields, clauses, annexes, is_clinical, created_by, created_by_name
  ) VALUES (
    _person_id,
    _t.id,
    COALESCE(_payload->>'contract_type', _t.contract_type, 'full_time'),
    COALESCE(_payload->>'job_title', _t.job_title, _fields->>'job_title'),
    COALESCE(_payload->>'department', _t.department),
    NULLIF(_payload->>'start_date','')::date,
    COALESCE(_payload->>'notice_period', _fields->>'notice_period'),
    NULLIF(_payload->>'pay_amount','')::numeric,
    COALESCE(_payload->>'pay_currency', 'NGN'),
    COALESCE(_payload->>'pay_frequency', 'monthly'),
    COALESCE(_payload->>'working_pattern', _fields->>'work_model'),
    COALESCE(_payload->>'location', _fields->>'primary_place_of_work'),
    'draft',
    _fields,
    COALESCE(_t.clauses, '[]'::jsonb),
    COALESCE(_t.annexes, '[]'::jsonb),
    COALESCE((_payload->>'is_clinical')::boolean, _t.is_clinical, false),
    auth.uid(),
    _payload->>'created_by_name'
  ) RETURNING id INTO _id;

  PERFORM public.mu_contract_log(
    _id, 'created', 'Contract drafted from the template ' || _t.name,
    jsonb_build_object('template_id', _t.id), _payload->>'created_by_name'
  );
  RETURN _id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.mu_contract_create_from_template(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_contract_create_from_template(uuid, uuid, jsonb) TO authenticated;

-- 5. Issue now freezes the annexes too, so the pack that was signed can be
--    reproduced exactly, wording and annexes together.
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
    issued_annexes = annexes,
    issued_hash = encode(digest(clauses::text || fields::text || annexes::text, 'sha256'), 'hex'),
    sign_token = _token,
    token_expires_at = now() + interval '30 days',
    updated_at = now()
  WHERE id = _contract_id;

  PERFORM public.mu_contract_log(_contract_id, 'issued', 'Contract issued and wording frozen', '{}'::jsonb, _actor_name);
  RETURN _token;
END; $$;
