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
    updated_at = now()
  WHERE id = _contract_id;

  PERFORM public.mu_contract_log(
    _contract_id, 'signed', 'Signed while signed in',
    jsonb_build_object('method', _method, 'hash', _row.issued_hash),
    btrim(_signed_name), NULL, _user_agent, 'person'
  );
END; $$;

REVOKE EXECUTE ON FUNCTION public.mu_contract_sign(uuid, text, text, text, text) FROM PUBLIC, anon;