CREATE OR REPLACE FUNCTION public.heard_register_volunteer_profile(
  p_first_name text,
  p_last_name text,
  p_role_interest text
)
RETURNS public.heard_volunteer_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.heard_volunteer_profiles;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF char_length(trim(p_first_name)) NOT BETWEEN 1 AND 100
     OR char_length(trim(p_last_name)) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'First name and last name are required';
  END IF;
  IF p_role_interest NOT IN ('peer_listener', 'social_media_volunteer', 'professional') THEN
    RAISE EXCEPTION 'Invalid volunteer role';
  END IF;

  INSERT INTO public.heard_volunteer_profiles (
    user_id, first_name, last_name, role_interest, application_status
  ) VALUES (
    v_user_id, trim(p_first_name), trim(p_last_name), p_role_interest, 'account_created'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role_interest = EXCLUDED.role_interest,
    updated_at = now()
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;
REVOKE ALL ON FUNCTION public.heard_register_volunteer_profile(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heard_register_volunteer_profile(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heard_register_volunteer_profile(text, text, text) TO service_role;