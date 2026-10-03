ALTER TABLE public.mu_people
  ADD COLUMN IF NOT EXISTS track text,
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS course_of_study text,
  ADD COLUMN IF NOT EXISTS year_of_study text,
  ADD COLUMN IF NOT EXISTS expected_graduation text;

CREATE INDEX IF NOT EXISTS mu_people_track_idx ON public.mu_people (track);

CREATE OR REPLACE FUNCTION public.mu_self_register(
  p_full_name text,
  p_phone text,
  p_track text,
  p_institution text DEFAULT NULL,
  p_course_of_study text DEFAULT NULL,
  p_year_of_study text DEFAULT NULL,
  p_expected_graduation text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_person uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF p_track NOT IN ('clinical', 'support', 'non_clinical', 'student') THEN
    RAISE EXCEPTION 'Unknown track';
  END IF;

  SELECT lower(trim(email)) INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'No email on the account';
  END IF;

  SELECT id INTO v_person FROM public.mu_people WHERE auth_user_id = v_uid LIMIT 1;

  IF v_person IS NULL THEN
    SELECT id INTO v_person
      FROM public.mu_people
     WHERE email_key = public.mu_norm_email(v_email)
       AND auth_user_id IS NULL
     ORDER BY created_at
     LIMIT 1;
  END IF;

  IF v_person IS NULL THEN
    INSERT INTO public.mu_people (full_name, email, phone, track, status, claimed_at, auth_user_id)
    VALUES (nullif(trim(p_full_name), ''), v_email, nullif(trim(p_phone), ''), p_track, 'active', now(), v_uid)
    RETURNING id INTO v_person;
  ELSE
    UPDATE public.mu_people
       SET auth_user_id = v_uid,
           claimed_at = COALESCE(claimed_at, now()),
           full_name = COALESCE(nullif(trim(p_full_name), ''), full_name),
           phone = COALESCE(nullif(trim(p_phone), ''), phone),
           track = COALESCE(track, p_track),
           updated_at = now()
     WHERE id = v_person;
  END IF;

  UPDATE public.mu_people
     SET track = COALESCE(track, p_track),
         institution = COALESCE(nullif(trim(p_institution), ''), institution),
         course_of_study = COALESCE(nullif(trim(p_course_of_study), ''), course_of_study),
         year_of_study = COALESCE(nullif(trim(p_year_of_study), ''), year_of_study),
         expected_graduation = COALESCE(nullif(trim(p_expected_graduation), ''), expected_graduation),
         updated_at = now()
   WHERE id = v_person;

  RETURN v_person;
END;
$$;

REVOKE ALL ON FUNCTION public.mu_self_register(text, text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.mu_self_register(text, text, text, text, text, text, text) TO authenticated;