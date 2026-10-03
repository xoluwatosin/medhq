CREATE TABLE public.heard_volunteer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  first_name text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 100),
  last_name text NOT NULL CHECK (char_length(last_name) BETWEEN 1 AND 100),
  role_interest text NOT NULL CHECK (role_interest IN ('peer_listener', 'social_media_volunteer', 'professional')),
  application_status text NOT NULL DEFAULT 'account_created' CHECK (application_status IN ('account_created', 'questionnaire_available', 'submitted', 'under_review', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.heard_volunteer_profiles TO authenticated;
GRANT ALL ON public.heard_volunteer_profiles TO service_role;
ALTER TABLE public.heard_volunteer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Volunteers can read own Heard profile"
ON public.heard_volunteer_profiles FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "Volunteers can create own Heard profile"
ON public.heard_volunteer_profiles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND application_status = 'account_created');
CREATE POLICY "Volunteers can update own Heard profile"
ON public.heard_volunteer_profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
CREATE POLICY "Heard admins can read volunteer profiles"
ON public.heard_volunteer_profiles FOR SELECT TO authenticated
USING (private.heard_can('heard_volunteers_manage'));
CREATE POLICY "Heard admins can update volunteer profiles"
ON public.heard_volunteer_profiles FOR UPDATE TO authenticated
USING (private.heard_can('heard_volunteers_manage'))
WITH CHECK (private.heard_can('heard_volunteers_manage'));
CREATE OR REPLACE FUNCTION public.heard_set_volunteer_profile_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER heard_volunteer_profiles_updated_at
BEFORE UPDATE ON public.heard_volunteer_profiles
FOR EACH ROW EXECUTE FUNCTION public.heard_set_volunteer_profile_updated_at();