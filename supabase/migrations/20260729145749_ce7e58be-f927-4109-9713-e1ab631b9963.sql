
ALTER TABLE public.mu_people
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS mu_people_auth_user_id_key ON public.mu_people(auth_user_id) WHERE auth_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mu_my_person_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.mu_people WHERE auth_user_id = auth.uid() LIMIT 1
$$;

GRANT SELECT, UPDATE ON public.mu_people TO authenticated;
GRANT SELECT, UPDATE, INSERT ON public.mu_parsed_fields TO authenticated;
GRANT SELECT, INSERT ON public.mu_documents TO authenticated;
GRANT ALL ON public.mu_people TO service_role;
GRANT ALL ON public.mu_parsed_fields TO service_role;
GRANT ALL ON public.mu_documents TO service_role;

DROP POLICY IF EXISTS "Candidates can view their own profile" ON public.mu_people;
CREATE POLICY "Candidates can view their own profile"
ON public.mu_people FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Candidates can update their own profile" ON public.mu_people;
CREATE POLICY "Candidates can update their own profile"
ON public.mu_people FOR UPDATE TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Candidates can view their own parsed fields" ON public.mu_parsed_fields;
CREATE POLICY "Candidates can view their own parsed fields"
ON public.mu_parsed_fields FOR SELECT TO authenticated
USING (person_id = public.mu_my_person_id());

DROP POLICY IF EXISTS "Candidates can answer their own queried fields" ON public.mu_parsed_fields;
CREATE POLICY "Candidates can answer their own queried fields"
ON public.mu_parsed_fields FOR UPDATE TO authenticated
USING (person_id = public.mu_my_person_id() AND status IN ('queried','rejected','candidate_updated'))
WITH CHECK (person_id = public.mu_my_person_id() AND status = 'candidate_updated');

DROP POLICY IF EXISTS "Candidates can supply missing fields" ON public.mu_parsed_fields;
CREATE POLICY "Candidates can supply missing fields"
ON public.mu_parsed_fields FOR INSERT TO authenticated
WITH CHECK (person_id = public.mu_my_person_id() AND status = 'candidate_updated');

DROP POLICY IF EXISTS "Candidates can view their own documents" ON public.mu_documents;
CREATE POLICY "Candidates can view their own documents"
ON public.mu_documents FOR SELECT TO authenticated
USING (person_id = public.mu_my_person_id());

DROP POLICY IF EXISTS "Candidates can upload their own documents" ON public.mu_documents;
CREATE POLICY "Candidates can upload their own documents"
ON public.mu_documents FOR INSERT TO authenticated
WITH CHECK (person_id = public.mu_my_person_id() AND verified = false AND rejected = false);

DROP POLICY IF EXISTS "Candidates can upload to their own folder" ON storage.objects;
CREATE POLICY "Candidates can upload to their own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'applications' AND (storage.foldername(name))[1] = 'candidate' AND (storage.foldername(name))[2] = auth.uid()::text);

DROP POLICY IF EXISTS "Candidates can read their own folder" ON storage.objects;
CREATE POLICY "Candidates can read their own folder"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'applications' AND (storage.foldername(name))[1] = 'candidate' AND (storage.foldername(name))[2] = auth.uid()::text);
