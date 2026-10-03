-- 1. syn_results: no access control at all.
ALTER TABLE public.syn_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.syn_results FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.syn_results FROM authenticated;
GRANT SELECT ON public.syn_results TO authenticated;
GRANT ALL ON public.syn_results TO service_role;
DROP POLICY IF EXISTS "Admins read internal test results" ON public.syn_results;
CREATE POLICY "Admins read internal test results" ON public.syn_results
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 2. Reference lists: replace USING (true) reads with staff-only reads.
DROP POLICY IF EXISTS "Languages are readable" ON public.care_languages;
CREATE POLICY "Admins read languages" ON public.care_languages
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
REVOKE SELECT ON public.care_languages FROM anon;

DROP POLICY IF EXISTS "Reference geography is readable" ON public.care_lgas;
CREATE POLICY "Admins read local government areas" ON public.care_lgas
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
REVOKE SELECT ON public.care_lgas FROM anon;

DROP POLICY IF EXISTS "Reference geography is readable" ON public.care_states;
CREATE POLICY "Admins read states" ON public.care_states
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
REVOKE SELECT ON public.care_states FROM anon;

DROP POLICY IF EXISTS "Reference terms are readable" ON public.care_sex_terms;
CREATE POLICY "Admins read sex terms" ON public.care_sex_terms
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
REVOKE SELECT ON public.care_sex_terms FROM anon;

DROP POLICY IF EXISTS "Reference terms are readable" ON public.care_relationship_terms;
CREATE POLICY "Admins read relationship terms" ON public.care_relationship_terms
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
REVOKE SELECT ON public.care_relationship_terms FROM anon;

DROP POLICY IF EXISTS "Signed in staff read relationship terms" ON public.care_group_relationship_terms;

DROP POLICY IF EXISTS "Signed in users can read awards" ON public.mu_awards;
CREATE POLICY "Admins read awards" ON public.mu_awards
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Signed in users can read document types" ON public.mu_document_types;
CREATE POLICY "Admins read document types" ON public.mu_document_types
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Signed in users can read institutions" ON public.mu_institutions;
CREATE POLICY "Admins read institutions" ON public.mu_institutions
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Signed in users can read the lexicon" ON public.mu_lexicon_phrases;
CREATE POLICY "Admins read the lexicon" ON public.mu_lexicon_phrases
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Signed in users can read the LGA index" ON public.mu_lga_index;
CREATE POLICY "Admins read the LGA index" ON public.mu_lga_index
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Signed in users can read licensing bodies" ON public.mu_licensing_bodies;
CREATE POLICY "Admins read licensing bodies" ON public.mu_licensing_bodies
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone signed in can read required documents" ON public.mu_required_documents;
CREATE POLICY "Admins read required documents" ON public.mu_required_documents
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Signed in users can read the training catalogue" ON public.mu_training_catalogue;
CREATE POLICY "Admins read the training catalogue" ON public.mu_training_catalogue
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 3. Public submission inserts: validate the row instead of accepting anything.
DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;
CREATE POLICY "Anyone can submit contact form" ON public.contact_submissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 5 AND 320
    AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    AND coalesce(length(name), 0) <= 200
    AND coalesce(length(first_name), 0) <= 100
    AND coalesce(length(last_name), 0) <= 100
    AND coalesce(length(phone), 0) <= 40
    AND coalesce(length(message), 0) <= 5000
    AND coalesce(length(service), 0) <= 200
    AND coalesce(length(service_line), 0) <= 200
    AND coalesce(length(city), 0) <= 120
    AND status = 'new' AND stage = 'new' AND archived = false
    AND owner IS NULL AND care_client_id IS NULL
    AND replied_at IS NULL AND last_sent_at IS NULL
  );

DROP POLICY IF EXISTS "Anyone can submit join application" ON public.join_applications;
CREATE POLICY "Anyone can submit join application" ON public.join_applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 5 AND 320
    AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    AND coalesce(length(name), 0) <= 200
    AND coalesce(length(first_name), 0) <= 100
    AND coalesce(length(last_name), 0) <= 100
    AND coalesce(length(phone), 0) <= 40
    AND coalesce(length(message), 0) <= 5000
    AND coalesce(length(experience), 0) <= 5000
    AND status = 'new' AND archived = false AND person_id IS NULL
  );

DROP POLICY IF EXISTS "Anyone can submit creator application" ON public.creator_applications;
CREATE POLICY "Anyone can submit creator application" ON public.creator_applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 5 AND 320
    AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    AND coalesce(length(name), 0) <= 200
    AND coalesce(length(phone), 0) <= 40
    AND coalesce(length(country), 0) <= 120
    AND coalesce(length(social_links), 0) <= 2000
    AND coalesce(length(portfolio_url), 0) <= 1000
    AND coalesce(length(rate_card_url), 0) <= 1000
    AND coalesce(length(message), 0) <= 5000
    AND status = 'new' AND archived = false
  );

DROP POLICY IF EXISTS "Anyone can submit an application" ON public.matchmaker_applications;
CREATE POLICY "Anyone can submit an application" ON public.matchmaker_applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    opportunity_id IS NOT NULL
    AND email IS NOT NULL
    AND length(email) BETWEEN 5 AND 320
    AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    AND coalesce(length(full_name), 0) <= 200
    AND coalesce(length(phone), 0) <= 40
    AND coalesce(length(current_position), 0) <= 200
    AND coalesce(length(cover_note), 0) <= 5000
    AND status = 'new' AND stage = 'applied'
    AND admin_notes IS NULL AND person_id IS NULL
    AND stage_by IS NULL AND stage_note IS NULL
  );

DROP POLICY IF EXISTS "Anyone can log a share event" ON public.matchmaker_share_events;
CREATE POLICY "Anyone can log a share event" ON public.matchmaker_share_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    opportunity_id IS NOT NULL
    AND channel IS NOT NULL
    AND length(channel) BETWEEN 1 AND 40
    AND channel ~ '^[a-z0-9_-]+$'
  );

DROP POLICY IF EXISTS "Anyone can record a sign-up failure" ON public.signup_failures;
CREATE POLICY "Anyone can record a sign-up failure" ON public.signup_failures
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    coalesce(length(email), 0) <= 320
    AND reason IS NOT NULL
    AND length(reason) BETWEEN 1 AND 200
    AND coalesce(length(detail), 0) <= 2000
    AND coalesce(length(track), 0) <= 60
  );

-- 4. Storage: constrain the anonymous matchmaker upload path and file name.
DROP POLICY IF EXISTS "Anyone can upload matchmaker documents" ON storage.objects;
CREATE POLICY "Anyone can upload matchmaker documents" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'applications'
    AND (storage.foldername(name))[1] = 'matchmakers'
    AND name ~ '^matchmakers/[0-9a-fA-F-]{36}/[A-Za-z0-9._-]{1,180}\.(pdf|doc|docx|jpg|jpeg|png|webp|PDF|DOC|DOCX|JPG|JPEG|PNG|WEBP)$'
  );