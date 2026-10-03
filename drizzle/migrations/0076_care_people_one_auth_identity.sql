CREATE UNIQUE INDEX IF NOT EXISTS care_people_auth_user_id_unique
  ON public.care_people (auth_user_id)
  WHERE auth_user_id IS NOT NULL;