-- Contracts signed inside the candidate's own account.
ALTER TABLE public.mu_contracts
  ADD COLUMN IF NOT EXISTS annex_acknowledgements jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS signed_acknowledged_at timestamptz;

DROP FUNCTION IF EXISTS public.mu_contract_countersign(uuid, text, text);

-- The annexes on a contract that the person is asked to acknowledge.
CREATE OR REPLACE FUNCTION public.mu_contract_required_annexes(_contract public.mu_contracts)
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(a->>'code' ORDER BY a->>'code'), ARRAY[]::text[])
  FROM jsonb_array_elements(COALESCE(_contract.issued_annexes, _contract.annexes, '[]'::jsonb)) a
  WHERE COALESCE((a->>'requires_signature')::boolean, false)
    AND COALESCE((a->>'include')::boolean, true)
    AND (NOT COALESCE((a->>'clinical_only')::boolean, false) OR _contract.is_clinical);
$$;

-- Everything the portal needs about one contract, as one row.
CREATE OR REPLACE FUNCTION public.mu_contract_public_row(_row public.mu_contracts)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', _row.id,
    'status', _row.status,
    'job_title', _row.job_title,
    'start_date', _row.start_date,
    'issued_at', _row.issued_at,
    'fields', COALESCE(_row.issued_fields, _row.fields, '{}'::jsonb),
    'clauses', COALESCE(_row.issued_clauses, _row.clauses, '[]'::jsonb),
    'annexes', COALESCE(_row.issued_annexes, _row.annexes, '[]'::jsonb),
    'is_clinical', _row.is_clinical,
    'signed_name', _row.signed_name,
    'signed_at', _row.signed_at,
    'signature_image', _row.signature_image,
    'countersigned_name', _row.countersigned_name,
    'countersigned_at', _row.countersigned_at,
    'countersignature_image', _row.countersignature_image,
    'annex_acknowledgements', _row.annex_acknowledgements,
    'required_annexes', to_jsonb(public.mu_contract_required_annexes(_row)),
    'pdf_path', _row.pdf_path
  );
$$;

CREATE OR REPLACE FUNCTION public.mu_my_contracts()
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.mu_contract_public_row(c)
  FROM public.mu_contracts c
  WHERE c.person_id = public.mu_my_person_id()
    AND c.deleted_at IS NULL
    AND c.status IN ('issued','signed','active','ended')
  ORDER BY c.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.mu_my_contract(_contract_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.mu_contract_public_row(c)
  FROM public.mu_contracts c
  WHERE c.id = _contract_id
    AND c.person_id = public.mu_my_person_id()
    AND c.deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.mu_contract_acknowledge_annex(_contract_id uuid, _code text, _acknowledged boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.mu_contracts; _me uuid; _name text;
BEGIN
  _me := public.mu_my_person_id();
  SELECT * INTO _row FROM public.mu_contracts WHERE id = _contract_id AND person_id = _me FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF _row.status <> 'issued' THEN RAISE EXCEPTION 'This contract is no longer open for signing'; END IF;
  IF NOT (_code = ANY (public.mu_contract_required_annexes(_row))) THEN
    RAISE EXCEPTION 'That document does not need acknowledging';
  END IF;

  SELECT full_name INTO _name FROM public.mu_people WHERE id = _me;

  IF _acknowledged THEN
    UPDATE public.mu_contracts SET
      annex_acknowledgements = COALESCE(annex_acknowledgements, '{}'::jsonb)
        || jsonb_build_object(_code, jsonb_build_object('at', now(), 'name', _name)),
      updated_at = now()
    WHERE id = _contract_id;
    PERFORM public.mu_contract_log(_contract_id, 'acknowledged', 'Read and acknowledged ' || _code,
      jsonb_build_object('code', _code), _name, NULL, NULL, 'person');
  ELSE
    UPDATE public.mu_contracts SET
      annex_acknowledgements = COALESCE(annex_acknowledgements, '{}'::jsonb) - _code,
      updated_at = now()
    WHERE id = _contract_id;
  END IF;

  SELECT * INTO _row FROM public.mu_contracts WHERE id = _contract_id;
  RETURN public.mu_contract_public_row(_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.mu_contract_sign_in_portal(
  _contract_id uuid, _signed_name text, _method text, _signature_image text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.mu_contracts; _me uuid; _needed text[]; _code text;
BEGIN
  _me := public.mu_my_person_id();
  SELECT * INTO _row FROM public.mu_contracts WHERE id = _contract_id AND person_id = _me FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF _row.status <> 'issued' THEN RAISE EXCEPTION 'This contract is not awaiting your signature'; END IF;
  IF COALESCE(btrim(_signed_name), '') = '' THEN RAISE EXCEPTION 'A name is required'; END IF;
  IF _method NOT IN ('typed','drawn') THEN RAISE EXCEPTION 'The signature method is not valid'; END IF;
  IF _method = 'drawn' AND COALESCE(_signature_image, '') = '' THEN
    RAISE EXCEPTION 'A drawn signature is required';
  END IF;

  _needed := public.mu_contract_required_annexes(_row);
  FOREACH _code IN ARRAY _needed LOOP
    IF NOT (COALESCE(_row.annex_acknowledgements, '{}'::jsonb) ? _code) THEN
      RAISE EXCEPTION 'Please tick every document you are asked to acknowledge first';
    END IF;
  END LOOP;

  UPDATE public.mu_contracts SET
    status = 'signed',
    signed_at = now(),
    signed_acknowledged_at = now(),
    signed_name = btrim(_signed_name),
    signature_method = _method,
    signature_image = _signature_image,
    sign_token = NULL,
    token_expires_at = NULL,
    updated_at = now()
  WHERE id = _contract_id;

  PERFORM public.mu_contract_log(_contract_id, 'signed',
    'Signed in the candidate account by ' || btrim(_signed_name), '{}'::jsonb,
    btrim(_signed_name), NULL, NULL, 'person');

  SELECT * INTO _row FROM public.mu_contracts WHERE id = _contract_id;
  RETURN public.mu_contract_public_row(_row);
END;
$$;

-- Countersigning only happens once the person has signed.
CREATE FUNCTION public.mu_contract_countersign(_contract_id uuid, _name text, _signature_image text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.mu_contracts;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  SELECT * INTO _row FROM public.mu_contracts WHERE id = _contract_id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF _row.status <> 'signed' THEN
    RAISE EXCEPTION 'This contract cannot be countersigned until the person has signed it';
  END IF;
  IF COALESCE(btrim(_name), '') = '' THEN RAISE EXCEPTION 'A name is required'; END IF;

  UPDATE public.mu_contracts SET
    countersigned_at = now(),
    countersigned_by = auth.uid(),
    countersigned_name = btrim(_name),
    countersignature_image = _signature_image,
    status = 'active',
    updated_at = now()
  WHERE id = _contract_id;

  PERFORM public.mu_contract_log(_contract_id, 'countersigned',
    'Approved and countersigned for Medic Connect Limited', '{}'::jsonb, btrim(_name));

  SELECT * INTO _row FROM public.mu_contracts WHERE id = _contract_id;
  RETURN public.mu_contract_public_row(_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mu_my_contracts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_my_contract(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_contract_acknowledge_annex(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_contract_sign_in_portal(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_contract_countersign(uuid, text, text) TO authenticated;