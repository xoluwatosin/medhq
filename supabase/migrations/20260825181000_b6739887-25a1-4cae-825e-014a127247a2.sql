CREATE OR REPLACE FUNCTION public.mu_contract_sign_by_token(
  _token text,
  _signed_name text,
  _method text DEFAULT 'typed',
  _signature_image text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.mu_contracts;
BEGIN
  SELECT * INTO _row
  FROM public.mu_contracts
  WHERE sign_token = _token
  FOR UPDATE;

  IF _row.id IS NULL THEN RAISE EXCEPTION 'This link is no longer valid'; END IF;
  IF _row.status <> 'issued' THEN RAISE EXCEPTION 'This contract is not awaiting a signature'; END IF;
  IF _row.token_expires_at IS NOT NULL AND _row.token_expires_at < now() THEN
    RAISE EXCEPTION 'This link has expired';
  END IF;
  IF COALESCE(btrim(_signed_name), '') = '' THEN RAISE EXCEPTION 'A name is required'; END IF;
  IF _method NOT IN ('typed', 'drawn') THEN RAISE EXCEPTION 'The signature method is not valid'; END IF;
  IF _method = 'drawn' AND COALESCE(_signature_image, '') = '' THEN
    RAISE EXCEPTION 'A drawn signature is required';
  END IF;

  UPDATE public.mu_contracts SET
    status = 'signed',
    signed_at = now(),
    signed_name = btrim(_signed_name),
    signature_method = _method,
    signature_image = _signature_image,
    signed_ip = _ip,
    signed_user_agent = _user_agent,
    sign_token = NULL,
    updated_at = now()
  WHERE id = _row.id;

  PERFORM public.mu_contract_log(
    _row.id, 'signed',
    'Signed through the emailed link, ' || CASE WHEN _method = 'drawn' THEN 'drawn signature' ELSE 'typed name' END,
    jsonb_build_object('method', _method, 'hash', _row.issued_hash),
    btrim(_signed_name), _ip, _user_agent, 'person'
  );

  RETURN _row.id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.mu_contract_sign_by_token(text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mu_contract_sign_by_token(text, text, text, text, text, text) TO service_role;