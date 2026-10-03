-- Tranche 4: controlled data, derived client facts, and two narrow corrections
-- to the notification dispatcher.

-- 0.1 / 0.2 An attempt is owned by exactly one caller, and an explicit staff
-- resend may attempt again even after a successful send.
CREATE OR REPLACE FUNCTION public.care_notification_attempt(_id uuid, _force boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _row public.care_notifications%ROWTYPE; _n integer;
BEGIN
  IF NOT private.care_access_caller_ok() THEN
    RAISE EXCEPTION 'Not allowed to send notifications';
  END IF;

  -- The row lock is the whole concurrency story: a second caller waits here,
  -- then sees the in-flight attempt and stops.
  SELECT * INTO _row FROM public.care_notifications WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That notification is not on record';
  END IF;
  IF _row.status = 'cancelled' THEN
    RAISE EXCEPTION 'That notification was stopped';
  END IF;
  IF _row.status = 'sending' AND _row.last_attempt_at > now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'That notification is already being sent';
  END IF;
  IF _row.status = 'sent' AND NOT COALESCE(_force, false) THEN
    RAISE EXCEPTION 'That notification has already been sent';
  END IF;
  IF _row.attempt_count >= 5 THEN
    RAISE EXCEPTION 'That notification has been attempted too many times';
  END IF;

  UPDATE public.care_notifications
    SET status = 'sending',
        attempt_count = attempt_count + 1,
        last_attempt_at = now(),
        provider_error = NULL
    WHERE id = _id
    RETURNING attempt_count INTO _n;
  RETURN _n;
END;
$$;
REVOKE ALL ON FUNCTION public.care_notification_attempt(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.care_notification_attempt(uuid, boolean) TO authenticated, service_role;

-- The one way a human value becomes a stable code. Mirrors src/lib/care-vocabularies.ts.
CREATE OR REPLACE FUNCTION private.care_slug(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(btrim(regexp_replace(lower(COALESCE(_value, '')), '[^a-z0-9]+', '_', 'g'), '_'), '')
$$;

-- Controlled columns. The old text columns stay readable; nothing new writes them.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS sex_code text,
  ADD COLUMN IF NOT EXISTS language_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS state_code text,
  ADD COLUMN IF NOT EXISTS lga_code text,
  ADD COLUMN IF NOT EXISTS date_of_birth_is_estimated boolean NOT NULL DEFAULT false;

ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS relationship_code text,
  ADD COLUMN IF NOT EXISTS relationship_other text;

UPDATE public.clients
   SET sex_code = private.care_slug(sex)
 WHERE sex_code IS NULL AND sex IS NOT NULL;

UPDATE public.clients
   SET state_code = private.care_slug(state)
 WHERE state_code IS NULL AND state IS NOT NULL;

UPDATE public.clients
   SET lga_code = private.care_slug(state) || '__' || private.care_slug(lga)
 WHERE lga_code IS NULL AND lga IS NOT NULL AND state IS NOT NULL;

UPDATE public.clients c
   SET language_codes = COALESCE((
         SELECT array_agg(private.care_slug(l) ORDER BY ord)
           FROM unnest(c.languages) WITH ORDINALITY AS t(l, ord)
          WHERE private.care_slug(l) IS NOT NULL
       ), '{}')
 WHERE c.languages IS NOT NULL AND cardinality(c.languages) > 0
   AND cardinality(c.language_codes) = 0;

UPDATE public.client_contacts
   SET relationship_code = private.care_slug(relationship)
 WHERE relationship_code IS NULL AND relationship IS NOT NULL;

-- Anything a person should look at rather than trust. Codes are deterministic,
-- but a code that was never a real term needs a human eye.
CREATE OR REPLACE VIEW public.care_controlled_value_review AS
  SELECT 'clients'::text AS source, 'sex'::text AS field, id AS record_id, sex AS original_value, sex_code AS code
    FROM public.clients WHERE sex IS NOT NULL
  UNION ALL
  SELECT 'clients', 'state', id, state, state_code FROM public.clients WHERE state IS NOT NULL
  UNION ALL
  SELECT 'clients', 'lga', id, lga, lga_code FROM public.clients WHERE lga IS NOT NULL
  UNION ALL
  SELECT 'clients', 'language', c.id, l, private.care_slug(l)
    FROM public.clients c, unnest(c.languages) AS l
  UNION ALL
  SELECT 'client_contacts', 'relationship', id, relationship, relationship_code
    FROM public.client_contacts WHERE relationship IS NOT NULL;

GRANT SELECT ON public.care_controlled_value_review TO authenticated;

-- Age is derived wherever it is read, never stored.
CREATE OR REPLACE FUNCTION public.care_age_years(_dob date)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
           WHEN _dob IS NULL THEN NULL
           ELSE GREATEST(0, date_part('year', age(current_date, _dob))::integer)
         END
$$;
GRANT EXECUTE ON FUNCTION public.care_age_years(date) TO authenticated, anon, service_role;

-- The address a family may set through a live pre-assessment link, and nothing
-- else on the client row. Token rules are enforced here, not by the caller.
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
DECLARE _token public.care_access_tokens%ROWTYPE;
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

  UPDATE public.clients
     SET address_line = COALESCE(NULLIF(btrim(COALESCE(_address_line, '')), ''), address_line),
         landmark     = COALESCE(NULLIF(btrim(COALESCE(_landmark, '')), ''), landmark),
         state_code   = COALESCE(NULLIF(btrim(COALESCE(_state_code, '')), ''), state_code),
         lga_code     = COALESCE(NULLIF(btrim(COALESCE(_lga_code, '')), ''), lga_code),
         updated_at   = now()
   WHERE id = _token.client_id;

  INSERT INTO public.care_access_log (token_id, client_id, action)
  VALUES (_token.id, _token.client_id, 'address_saved');

  RETURN _token.client_id;
END;
$$;
REVOKE ALL ON FUNCTION public.care_token_address_save(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_token_address_save(text, text, text, text, text) TO service_role;
