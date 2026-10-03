ALTER TABLE public.heard_volunteer_profiles
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS country_code varchar(2),
  ADD COLUMN IF NOT EXISTS subdivision_code varchar(6),
  ADD COLUMN IF NOT EXISTS subdivision_name text,
  ADD COLUMN IF NOT EXISTS lga text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS languages jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS adjustments text,
  ADD COLUMN IF NOT EXISTS adjustments_discuss_privately boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.heard_volunteer_profiles.application_status IS 'DEPRECATED: application stage now lives on heard_volunteer_applications.status';

CREATE TABLE public.heard_volunteer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.heard_volunteer_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('peer_listener','social_media_volunteer','professional')),
  status text NOT NULL DEFAULT 'application_started' CHECK (status IN ('application_started','submitted','under_review','accepted','rejected','withdrawn')),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX heard_volunteer_applications_one_open
  ON public.heard_volunteer_applications (profile_id) WHERE status IN ('application_started','submitted','under_review');
CREATE INDEX heard_volunteer_applications_user ON public.heard_volunteer_applications (user_id);

GRANT SELECT ON public.heard_volunteer_applications TO authenticated;
GRANT ALL ON public.heard_volunteer_applications TO service_role;
ALTER TABLE public.heard_volunteer_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Volunteers can read own Heard applications" ON public.heard_volunteer_applications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Heard admins can read volunteer applications" ON public.heard_volunteer_applications
  FOR SELECT TO authenticated USING (private.heard_can('heard_volunteers_manage'));

CREATE TRIGGER heard_volunteer_applications_updated_at BEFORE UPDATE ON public.heard_volunteer_applications
  FOR EACH ROW EXECUTE FUNCTION public.heard_set_volunteer_profile_updated_at();

CREATE OR REPLACE FUNCTION public.heard_bootstrap_volunteer()
RETURNS public.heard_volunteer_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_meta jsonb;
  v_email text;
  v_profile public.heard_volunteer_profiles;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT raw_user_meta_data, email INTO v_meta, v_email FROM auth.users WHERE id = v_uid AND email_confirmed_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'email_not_verified'; END IF;

  SELECT * INTO v_profile FROM public.heard_volunteer_profiles WHERE user_id = v_uid;
  IF NOT FOUND THEN
    IF coalesce(v_meta->>'heard_role_interest','') NOT IN ('peer_listener','social_media_volunteer','professional')
       OR coalesce(trim(v_meta->>'heard_first_name'),'') = '' OR coalesce(trim(v_meta->>'heard_last_name'),'') = '' THEN
      RAISE EXCEPTION 'no_volunteer_details';
    END IF;
    INSERT INTO public.heard_volunteer_profiles (user_id, first_name, last_name, role_interest, email)
    VALUES (v_uid, left(trim(v_meta->>'heard_first_name'),100), left(trim(v_meta->>'heard_last_name'),100), v_meta->>'heard_role_interest', v_email)
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

CREATE OR REPLACE FUNCTION public.heard_update_volunteer_profile(
  p_first_name text, p_last_name text, p_preferred_name text, p_phone text,
  p_country_code text, p_subdivision_code text, p_subdivision_name text,
  p_lga text, p_city text, p_timezone text, p_languages jsonb,
  p_adjustments text, p_adjustments_discuss_privately boolean
) RETURNS public.heard_volunteer_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_profile public.heard_volunteer_profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF char_length(trim(coalesce(p_first_name,''))) NOT BETWEEN 1 AND 100
    OR char_length(trim(coalesce(p_last_name,''))) NOT BETWEEN 1 AND 100
    OR char_length(coalesce(p_preferred_name,'')) > 100
    OR coalesce(p_phone,'') !~ '^\+[1-9][0-9]{6,14}$'
    OR coalesce(p_country_code,'') !~ '^[A-Z]{2}$'
    OR coalesce(p_subdivision_code,'') !~ ('^' || p_country_code || '-[A-Z0-9]{1,3}$')
    OR char_length(trim(coalesce(p_subdivision_name,''))) NOT BETWEEN 1 AND 120
    OR char_length(coalesce(p_lga,'')) > 120
    OR char_length(coalesce(p_city,'')) > 120
    OR char_length(coalesce(p_timezone,'')) NOT BETWEEN 3 AND 64
    OR jsonb_typeof(p_languages) <> 'array' OR jsonb_array_length(p_languages) NOT BETWEEN 1 AND 20
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_languages) l
               WHERE char_length(coalesce(l->>'language','')) NOT BETWEEN 1 AND 80
                  OR coalesce(l->>'proficiency','') NOT IN ('native','fluent','conversational','basic'))
    OR char_length(coalesce(p_adjustments,'')) > 2000 THEN
    RAISE EXCEPTION 'invalid_details';
  END IF;
  UPDATE public.heard_volunteer_profiles SET
    first_name = trim(p_first_name), last_name = trim(p_last_name),
    preferred_name = nullif(trim(p_preferred_name),''), phone = p_phone,
    country_code = p_country_code, subdivision_code = p_subdivision_code, subdivision_name = trim(p_subdivision_name),
    lga = CASE WHEN p_country_code = 'NG' THEN nullif(trim(p_lga),'') END,
    city = nullif(trim(p_city),''), timezone = p_timezone, languages = p_languages,
    adjustments = nullif(trim(p_adjustments),''), adjustments_discuss_privately = coalesce(p_adjustments_discuss_privately,false)
  WHERE user_id = auth.uid()
  RETURNING * INTO v_profile;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_profile'; END IF;
  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.heard_bootstrap_volunteer() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.heard_update_volunteer_profile(text,text,text,text,text,text,text,text,text,text,jsonb,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.heard_bootstrap_volunteer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.heard_update_volunteer_profile(text,text,text,text,text,text,text,text,text,text,jsonb,text,boolean) TO authenticated;