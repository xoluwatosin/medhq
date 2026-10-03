DROP FUNCTION IF EXISTS public.heard_bootstrap_volunteer();
CREATE OR REPLACE FUNCTION public.heard_bootstrap_volunteer(p_role text DEFAULT NULL, p_first_name text DEFAULT NULL, p_last_name text DEFAULT NULL)
RETURNS public.heard_volunteer_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_meta jsonb;
  v_email text;
  v_role text;
  v_first text;
  v_last text;
  v_display text;
  v_profile public.heard_volunteer_profiles;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT raw_user_meta_data, email INTO v_meta, v_email FROM auth.users WHERE id = v_uid AND email_confirmed_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'email_not_verified'; END IF;

  SELECT * INTO v_profile FROM public.heard_volunteer_profiles WHERE user_id = v_uid;
  IF NOT FOUND THEN
    v_role := coalesce(nullif(trim(p_role),''), v_meta->>'heard_role_interest');
    IF coalesce(v_role,'') NOT IN ('peer_listener','social_media_volunteer','professional') THEN
      RAISE EXCEPTION 'role_selection_required';
    END IF;
    v_display := trim(coalesce(v_meta->>'display_name', v_meta->>'full_name', v_meta->>'name', ''));
    v_first := coalesce(nullif(trim(p_first_name),''), nullif(trim(v_meta->>'heard_first_name'),''), nullif(split_part(v_display,' ',1),''), 'Volunteer');
    v_last := coalesce(nullif(trim(p_last_name),''), nullif(trim(v_meta->>'heard_last_name'),''), nullif(trim(substr(v_display, length(split_part(v_display,' ',1)) + 2)),''), '-');
    INSERT INTO public.heard_volunteer_profiles (user_id, first_name, last_name, role_interest, email)
    VALUES (v_uid, left(v_first,100), left(v_last,100), v_role, v_email)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO v_profile FROM public.heard_volunteer_profiles WHERE user_id = v_uid;
  ELSIF v_profile.email IS DISTINCT FROM v_email THEN
    UPDATE public.heard_volunteer_profiles SET email = v_email WHERE id = v_profile.id RETURNING * INTO v_profile;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.heard_volunteer_applications WHERE profile_id = v_profile.id) THEN
    INSERT INTO public.heard_volunteer_applications (profile_id, user_id, role)
    VALUES (v_profile.id, v_uid, v_profile.role_interest)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN v_profile;
END;
$$;
REVOKE ALL ON FUNCTION public.heard_bootstrap_volunteer(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.heard_bootstrap_volunteer(text,text,text) TO authenticated;