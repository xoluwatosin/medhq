-- Each document in the pack can be signed on its own.
ALTER TABLE public.mu_contracts
  ADD COLUMN IF NOT EXISTS annex_signatures jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.mu_contract_public_row(_row mu_contracts)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
    'annex_acknowledgements', COALESCE(_row.annex_acknowledgements, '{}'::jsonb),
    'annex_signatures', COALESCE(_row.annex_signatures, '{}'::jsonb),
    'required_annexes', to_jsonb(public.mu_contract_required_annexes(_row)),
    'pdf_path', _row.pdf_path
  );
$function$;

-- Sign one document in the pack.
CREATE OR REPLACE FUNCTION public.mu_contract_sign_annex(
  _contract_id uuid,
  _code text,
  _signed_name text,
  _method text DEFAULT 'typed',
  _signature_image text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _row public.mu_contracts; _me uuid; _name text;
BEGIN
  _me := public.mu_my_person_id();
  SELECT * INTO _row FROM public.mu_contracts WHERE id = _contract_id AND person_id = _me FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF _row.status <> 'issued' THEN RAISE EXCEPTION 'This contract is no longer open for signing'; END IF;
  IF NOT (_code = ANY (public.mu_contract_required_annexes(_row))) THEN
    RAISE EXCEPTION 'That document does not need signing';
  END IF;
  IF COALESCE(btrim(_signed_name), '') = '' THEN RAISE EXCEPTION 'A name is required'; END IF;
  IF _method NOT IN ('typed','drawn') THEN RAISE EXCEPTION 'The signature method is not valid'; END IF;
  IF _method = 'drawn' AND COALESCE(_signature_image, '') = '' THEN
    RAISE EXCEPTION 'A drawn signature is required';
  END IF;

  SELECT full_name INTO _name FROM public.mu_people WHERE id = _me;

  UPDATE public.mu_contracts SET
    annex_signatures = COALESCE(annex_signatures, '{}'::jsonb)
      || jsonb_build_object(_code, jsonb_build_object(
           'at', now(), 'name', btrim(_signed_name), 'method', _method, 'image', _signature_image)),
    annex_acknowledgements = COALESCE(annex_acknowledgements, '{}'::jsonb)
      || jsonb_build_object(_code, jsonb_build_object('at', now(), 'name', COALESCE(_name, btrim(_signed_name)))),
    updated_at = now()
  WHERE id = _contract_id;

  PERFORM public.mu_contract_log(_contract_id, 'signed_annex',
    'Signed ' || _code || ' as ' || btrim(_signed_name),
    jsonb_build_object('code', _code, 'method', _method), btrim(_signed_name), NULL, NULL, 'person');

  SELECT * INTO _row FROM public.mu_contracts WHERE id = _contract_id;
  RETURN public.mu_contract_public_row(_row);
END;
$function$;

-- Undo a signature on one document, while the pack is still open.
CREATE OR REPLACE FUNCTION public.mu_contract_unsign_annex(_contract_id uuid, _code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _row public.mu_contracts; _me uuid;
BEGIN
  _me := public.mu_my_person_id();
  SELECT * INTO _row FROM public.mu_contracts WHERE id = _contract_id AND person_id = _me FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF _row.status <> 'issued' THEN RAISE EXCEPTION 'This contract is no longer open for signing'; END IF;

  UPDATE public.mu_contracts SET
    annex_signatures = COALESCE(annex_signatures, '{}'::jsonb) - _code,
    annex_acknowledgements = COALESCE(annex_acknowledgements, '{}'::jsonb) - _code,
    updated_at = now()
  WHERE id = _contract_id;

  SELECT * INTO _row FROM public.mu_contracts WHERE id = _contract_id;
  RETURN public.mu_contract_public_row(_row);
END;
$function$;

-- The letter cannot be signed until every document that needs a signature has one.
CREATE OR REPLACE FUNCTION public.mu_contract_sign_in_portal(_contract_id uuid, _signed_name text, _method text, _signature_image text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF NOT (COALESCE(_row.annex_signatures, '{}'::jsonb) ? _code)
       AND NOT (COALESCE(_row.annex_acknowledgements, '{}'::jsonb) ? _code) THEN
      RAISE EXCEPTION 'Please sign every document in the pack first';
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
$function$;

GRANT EXECUTE ON FUNCTION public.mu_contract_sign_annex(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_contract_unsign_annex(uuid, text) TO authenticated;
