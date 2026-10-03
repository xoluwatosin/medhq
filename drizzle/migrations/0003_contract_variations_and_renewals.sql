-- Variation flow on the existing supersedes_id column, plus a renewals-due view.

CREATE INDEX IF NOT EXISTS mu_contracts_supersedes_idx
  ON public.mu_contracts (supersedes_id)
  WHERE supersedes_id IS NOT NULL;

-- Clone a signed or active contract into a fresh draft linked back to it.
CREATE OR REPLACE FUNCTION public.mu_contract_create_variation(
  _contract_id uuid,
  _actor_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _src public.mu_contracts%ROWTYPE;
  _new_id uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  SELECT * INTO _src FROM public.mu_contracts WHERE id = _contract_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract not found';
  END IF;
  IF _src.status NOT IN ('active', 'signed', 'ended') THEN
    RAISE EXCEPTION 'Only a signed or active contract can be varied';
  END IF;

  INSERT INTO public.mu_contracts (
    person_id, offer_id, contract_type, job_title, department,
    start_date, end_date, notice_period,
    pay_amount, pay_currency, pay_frequency, working_pattern, location,
    status, fields, clauses, annexes, is_clinical,
    template_id, supersedes_id, created_by_name
  )
  VALUES (
    _src.person_id, _src.offer_id, _src.contract_type, _src.job_title, _src.department,
    _src.start_date, _src.end_date, _src.notice_period,
    _src.pay_amount, _src.pay_currency, _src.pay_frequency, _src.working_pattern, _src.location,
    'draft',
    COALESCE(_src.issued_fields, _src.fields),
    COALESCE(_src.issued_clauses, _src.clauses),
    COALESCE(_src.issued_annexes, _src.annexes),
    _src.is_clinical,
    _src.template_id, _src.id, _actor_name
  )
  RETURNING id INTO _new_id;

  PERFORM public.mu_contract_log(_new_id, 'created', 'Variation drafted from the earlier contract.', '{}'::jsonb, _actor_name);
  PERFORM public.mu_contract_log(_contract_id, 'edited', 'A variation was drafted from this contract.', '{}'::jsonb, _actor_name);

  RETURN _new_id;
END;
$$;

-- Contracts whose end date falls inside the renewal window with no live variation yet.
CREATE OR REPLACE FUNCTION public.mu_contracts_renewals_due(_days integer DEFAULT 30)
RETURNS SETOF public.mu_contracts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.*
  FROM public.mu_contracts c
  WHERE private.has_role(auth.uid(), 'admin'::public.app_role)
    AND c.status = 'active'
    AND c.end_date IS NOT NULL
    AND c.end_date >= CURRENT_DATE
    AND c.end_date <= CURRENT_DATE + make_interval(days => _days)
    AND NOT EXISTS (
      SELECT 1 FROM public.mu_contracts v
      WHERE v.supersedes_id = c.id
        AND v.status <> 'withdrawn'
    )
  ORDER BY c.end_date ASC;
$$;