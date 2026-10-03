
CREATE OR REPLACE FUNCTION public.mu_resolve_person(_name text, _email text, _phone text, _position text, _years integer, _state text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    UPDATE public.mu_people SET
      full_name        = CASE WHEN coalesce(full_name,'') = '' THEN coalesce(btrim(_name), '') ELSE full_name END,
      email            = coalesce(email, _email),
      phone            = coalesce(phone, _phone),
      -- latest application wins for self-stated role / experience / location
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
$function$;

-- Backfill: use the most recent application's stated role per person
WITH latest AS (
  SELECT DISTINCT ON (person_id) person_id,
         NULLIF(btrim(coalesce(role_other, role)), '') AS pos,
         years_experience, state
  FROM public.join_applications
  WHERE person_id IS NOT NULL
  ORDER BY person_id, created_at DESC
)
UPDATE public.mu_people p
SET current_position = coalesce(l.pos, p.current_position),
    years_experience = coalesce(l.years_experience, p.years_experience),
    state = coalesce(NULLIF(btrim(coalesce(l.state,'')),''), p.state)
FROM latest l
WHERE p.id = l.person_id
  AND l.pos IS DISTINCT FROM p.current_position;

-- Drop stale pending profession claims that were derived from the old stated role
DELETE FROM public.mu_parsed_fields
WHERE field = 'profession'
  AND status = 'pending'
  AND evidence ILIKE 'Mapped from stated role%';
