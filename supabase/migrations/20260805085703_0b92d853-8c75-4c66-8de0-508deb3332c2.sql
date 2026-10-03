CREATE OR REPLACE FUNCTION public.mu_resolve_person(_name text, _email text, _phone text, _position text, _years integer, _state text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  ek text := public.mu_norm_email(_email);
  pk text := public.mu_norm_phone(_phone);
  pid uuid;
BEGIN
  IF ek IS NOT NULL THEN
    SELECT id INTO pid FROM public.mu_people WHERE email_key = ek LIMIT 1;
  END IF;
  IF pid IS NULL AND pk IS NOT NULL THEN
    SELECT id INTO pid FROM public.mu_people WHERE phone_key = pk ORDER BY created_at LIMIT 1;
  END IF;

  IF pid IS NULL THEN
    INSERT INTO public.mu_people (full_name, email, phone, current_position, years_experience, state)
    VALUES (coalesce(btrim(_name), ''), _email, _phone, _position, _years, _state)
    RETURNING id INTO pid;
  ELSE
    -- latest application wins for identity and self-stated details
    UPDATE public.mu_people SET
      full_name        = coalesce(NULLIF(btrim(coalesce(_name,'')), ''), full_name),
      email            = coalesce(NULLIF(btrim(coalesce(_email,'')), ''), email),
      phone            = coalesce(NULLIF(btrim(coalesce(_phone,'')), ''), phone),
      current_position = coalesce(NULLIF(btrim(coalesce(_position,'')), ''), current_position),
      years_experience = coalesce(_years, years_experience),
      state            = coalesce(NULLIF(btrim(coalesce(_state,'')), ''), state),
      last_activity_at = now()
    WHERE id = pid;
  END IF;

  INSERT INTO public.mu_merge_candidates (person_a, person_b, reason, score)
  SELECT LEAST(pid, p.id), GREATEST(pid, p.id), 'Same name, different contact details', 0.6
  FROM public.mu_people p
  WHERE p.id <> pid
    AND coalesce(btrim(_name), '') <> ''
    AND lower(p.full_name) = lower(btrim(_name))
  ON CONFLICT DO NOTHING;

  RETURN pid;
END;
$fn$;