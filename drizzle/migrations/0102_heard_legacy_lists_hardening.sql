-- Bring the two original Heard lists into the Heard security model.
-- Additive only. No existing row is altered or removed.

-- 1. Governed purpose for the waitlist -----------------------------------
ALTER TABLE public.heard_waitlist
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'phone_line';

CREATE UNIQUE INDEX IF NOT EXISTS heard_waitlist_email_purpose_key
  ON public.heard_waitlist (lower(email), purpose);

-- 2. Close the public write paths ----------------------------------------
DROP POLICY IF EXISTS "Anyone can sign up as a Heard volunteer" ON public.heard_volunteers;
DROP POLICY IF EXISTS "Anyone can join Heard waitlist" ON public.heard_waitlist;

REVOKE ALL ON public.heard_volunteers FROM anon;
REVOKE ALL ON public.heard_waitlist FROM anon;
GRANT ALL ON public.heard_volunteers TO service_role;
GRANT ALL ON public.heard_waitlist TO service_role;

-- 3. Controlled submission functions --------------------------------------
CREATE OR REPLACE FUNCTION public.heard_submit_volunteer(
  _first_name text,
  _last_name text,
  _email text,
  _state text,
  _role_interest text,
  _motivation text DEFAULT NULL,
  _time_commitment text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := nullif(lower(btrim(_email)), '');
  v_id uuid;
BEGIN
  IF nullif(btrim(_first_name), '') IS NULL
     OR nullif(btrim(_last_name), '') IS NULL
     OR v_email IS NULL
     OR nullif(btrim(_state), '') IS NULL
     OR nullif(btrim(_role_interest), '') IS NULL THEN
    RAISE EXCEPTION 'Missing required volunteer details';
  END IF;

  -- Repeat interest while the earlier sign-up is still unreviewed refreshes
  -- that sign-up. Once reviewed, a later application is recorded separately.
  UPDATE public.heard_volunteers
     SET first_name = left(btrim(_first_name), 100),
         last_name = left(btrim(_last_name), 100),
         state = left(btrim(_state), 80),
         role_interest = left(btrim(_role_interest), 60),
         motivation = nullif(left(btrim(_motivation), 1000), ''),
         time_commitment = nullif(left(btrim(_time_commitment), 40), ''),
         updated_at = now()
   WHERE lower(email) = v_email
     AND status = 'new'
   RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.heard_volunteers (
    first_name, last_name, email, state, role_interest, motivation, time_commitment
  ) VALUES (
    left(btrim(_first_name), 100),
    left(btrim(_last_name), 100),
    v_email,
    left(btrim(_state), 80),
    left(btrim(_role_interest), 60),
    nullif(left(btrim(_motivation), 1000), ''),
    nullif(left(btrim(_time_commitment), 40), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.heard_submit_volunteer(text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heard_submit_volunteer(text, text, text, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.heard_join_waitlist(
  _email text,
  _source text DEFAULT NULL,
  _purpose text DEFAULT 'phone_line'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := nullif(lower(btrim(_email)), '');
  v_purpose text := coalesce(nullif(btrim(_purpose), ''), 'phone_line');
  v_id uuid;
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'An email address is required';
  END IF;

  SELECT id INTO v_id
    FROM public.heard_waitlist
   WHERE lower(email) = v_email AND purpose = v_purpose
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.heard_waitlist
       SET source = coalesce(nullif(btrim(_source), ''), source)
     WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.heard_waitlist (email, source, purpose)
  VALUES (v_email, nullif(btrim(_source), ''), v_purpose)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.heard_join_waitlist(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heard_join_waitlist(text, text, text) TO service_role;