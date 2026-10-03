CREATE OR REPLACE FUNCTION public.mu_contract_create_from_library(
  _person_id uuid, _payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _clauses jsonb; _offer_id uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  _offer_id := NULLIF(_payload->>'offer_id', '')::uuid;
  IF _offer_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.mu_offers
      WHERE id = _offer_id AND person_id = _person_id AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'The accepted offer does not belong to this person';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.mu_contracts
      WHERE offer_id = _offer_id AND deleted_at IS NULL AND status <> 'withdrawn'
    ) THEN
      RAISE EXCEPTION 'A contract already exists for this accepted offer';
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'key', key, 'heading', heading, 'body', body, 'section', section, 'locked', locked
  ) ORDER BY sort_order), '[]'::jsonb)
  INTO _clauses
  FROM public.mu_contract_clause_library WHERE active;

  INSERT INTO public.mu_contracts (
    person_id, offer_id, contract_type, job_title, department, start_date, notice_period,
    pay_amount, pay_currency, pay_frequency, working_pattern, location,
    status, fields, clauses, is_clinical, created_by, created_by_name
  ) VALUES (
    _person_id,
    _offer_id,
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

  PERFORM public.mu_contract_log(_id, 'created', 'Contract drafted from the clause library', jsonb_build_object('offer_id', _offer_id), _payload->>'created_by_name');
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.mu_contract_create_from_template(
  _person_id uuid, _template_id uuid, _payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _id uuid;
  _t public.mu_contract_templates;
  _fields jsonb;
  _offer_id uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  SELECT * INTO _t FROM public.mu_contract_templates WHERE id = _template_id;
  IF _t.id IS NULL THEN RAISE EXCEPTION 'Template not found'; END IF;

  _offer_id := NULLIF(_payload->>'offer_id', '')::uuid;
  IF _offer_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.mu_offers
      WHERE id = _offer_id AND person_id = _person_id AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'The accepted offer does not belong to this person';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.mu_contracts
      WHERE offer_id = _offer_id AND deleted_at IS NULL AND status <> 'withdrawn'
    ) THEN
      RAISE EXCEPTION 'A contract already exists for this accepted offer';
    END IF;
  END IF;

  _fields := COALESCE(_t.fields, '{}'::jsonb) || COALESCE(_payload->'fields', '{}'::jsonb);

  INSERT INTO public.mu_contracts (
    person_id, offer_id, template_id, contract_type, job_title, department, start_date, notice_period,
    pay_amount, pay_currency, pay_frequency, working_pattern, location,
    status, fields, clauses, annexes, is_clinical, created_by, created_by_name
  ) VALUES (
    _person_id,
    _offer_id,
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
    jsonb_build_object('template_id', _t.id, 'offer_id', _offer_id), _payload->>'created_by_name'
  );
  RETURN _id;
END; $$;