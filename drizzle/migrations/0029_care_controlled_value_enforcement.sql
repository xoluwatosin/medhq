-- Controlled values are enforced where they are written, not only where they
-- are offered. A code the interface would never show is refused here too.
CREATE OR REPLACE FUNCTION public.care_geo_check(_state_code text, _lga_code text)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE _lga_state text;
BEGIN
  IF _state_code IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.care_states WHERE code = _state_code AND is_active
  ) THEN
    RAISE EXCEPTION 'That is not a Nigerian state we hold: %', _state_code;
  END IF;

  IF _lga_code IS NOT NULL THEN
    SELECT state_code INTO _lga_state FROM public.care_lgas WHERE code = _lga_code AND is_active;
    IF _lga_state IS NULL THEN
      RAISE EXCEPTION 'That is not a local government area we hold: %', _lga_code;
    END IF;
    IF _state_code IS NULL OR _lga_state <> _state_code THEN
      RAISE EXCEPTION 'That local government area is not in the chosen state';
    END IF;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.care_geo_check(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.care_clients_controlled_values()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sex_code IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.care_sex_terms WHERE code = NEW.sex_code
  ) THEN
    RAISE EXCEPTION 'That is not a sex we hold: %', NEW.sex_code;
  END IF;
  PERFORM public.care_geo_check(NEW.state_code, NEW.lga_code);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_controlled_values ON public.clients;
CREATE TRIGGER clients_controlled_values
BEFORE INSERT OR UPDATE OF sex_code, state_code, lga_code ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.care_clients_controlled_values();

CREATE OR REPLACE FUNCTION public.care_contacts_controlled_values()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.relationship_code IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.care_relationship_terms WHERE code = NEW.relationship_code
  ) THEN
    RAISE EXCEPTION 'That is not a relationship we hold: %', NEW.relationship_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_contacts_controlled_values ON public.client_contacts;
CREATE TRIGGER client_contacts_controlled_values
BEFORE INSERT OR UPDATE OF relationship_code ON public.client_contacts
FOR EACH ROW EXECUTE FUNCTION public.care_contacts_controlled_values();

-- The token path writes the same controlled geography as staff do.
CREATE OR REPLACE FUNCTION public.care_token_address_save(
  _token_hash text,
  _address_line text DEFAULT NULL,
  _landmark text DEFAULT NULL,
  _state_code text DEFAULT NULL,
  _lga_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _token public.care_access_tokens%ROWTYPE;
  _client public.clients%ROWTYPE;
  _state text;
  _lga text;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Not allowed to save an address';
  END IF;

  SELECT * INTO _token FROM public.care_access_tokens WHERE token_hash = _token_hash;
  IF NOT FOUND THEN RAISE EXCEPTION 'This link is not valid'; END IF;
  IF _token.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'This link has been withdrawn'; END IF;
  IF _token.frozen_at IS NOT NULL THEN RAISE EXCEPTION 'This form has already been sent back to us'; END IF;
  IF _token.expires_at IS NOT NULL AND _token.expires_at < now() THEN
    RAISE EXCEPTION 'This link has expired';
  END IF;

  SELECT * INTO _client FROM public.clients WHERE id = _token.client_id;

  _state := COALESCE(NULLIF(btrim(COALESCE(_state_code, '')), ''), _client.state_code);
  _lga := NULLIF(btrim(COALESCE(_lga_code, '')), '');

  -- A new state clears a local government area that no longer belongs to it.
  IF _lga IS NULL THEN
    _lga := _client.lga_code;
  END IF;
  IF _lga IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.care_lgas WHERE code = _lga AND state_code IS NOT DISTINCT FROM _state
  ) THEN
    IF _lga_code IS NOT NULL AND btrim(_lga_code) <> '' THEN
      PERFORM public.care_geo_check(_state, _lga);
    END IF;
    _lga := NULL;
  END IF;

  PERFORM public.care_geo_check(_state, _lga);

  UPDATE public.clients
     SET address_line = COALESCE(NULLIF(btrim(COALESCE(_address_line, '')), ''), address_line),
         landmark     = COALESCE(NULLIF(btrim(COALESCE(_landmark, '')), ''), landmark),
         state_code   = _state,
         lga_code     = _lga,
         updated_at   = now()
   WHERE id = _token.client_id;

  INSERT INTO public.care_access_log (token_id, client_id, action)
  VALUES (_token.id, _token.client_id, 'address_saved');

  RETURN _token.client_id;
END;
$$;
REVOKE ALL ON FUNCTION public.care_token_address_save(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_token_address_save(text, text, text, text, text) TO service_role;