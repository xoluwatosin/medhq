
-- Extend join_applications with structured columns
ALTER TABLE public.join_applications
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS role_other text,
  ADD COLUMN IF NOT EXISTS qualification text,
  ADD COLUMN IF NOT EXISTS qualification_other text,
  ADD COLUMN IF NOT EXISTS years_experience integer,
  ADD COLUMN IF NOT EXISTS licensing_body text,
  ADD COLUMN IF NOT EXISTS licensing_body_other text,
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS license_expiry date,
  ADD COLUMN IF NOT EXISTS license_to_practice text,
  ADD COLUMN IF NOT EXISTS nysc_status text,
  ADD COLUMN IF NOT EXISTS right_to_work boolean,
  ADD COLUMN IF NOT EXISTS background_check_consent boolean,
  ADD COLUMN IF NOT EXISTS criminal_record boolean,
  ADD COLUMN IF NOT EXISTS criminal_record_details text,
  ADD COLUMN IF NOT EXISTS drug_test_consent boolean,
  ADD COLUMN IF NOT EXISTS emergency_med_interest text,
  ADD COLUMN IF NOT EXISTS training_commitment boolean,
  ADD COLUMN IF NOT EXISTS lives_in_lagos boolean,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS lga_primary text,
  ADD COLUMN IF NOT EXISTS lgas_willing_to_commute text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS has_transport boolean,
  ADD COLUMN IF NOT EXISTS languages jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS availability text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS start_window text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS cv_url text,
  ADD COLUMN IF NOT EXISTS declaration_accepted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS declaration_accepted_at timestamptz;

-- Make legacy 'experience' nullable so wizard can submit without it (we mirror years_experience into it)
ALTER TABLE public.join_applications ALTER COLUMN experience DROP NOT NULL;

-- Validation trigger: declaration + CV required; criminal_record_details required if criminal_record = true
CREATE OR REPLACE FUNCTION public.validate_join_application()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only enforce on rows submitted via the new wizard (have first_name set)
  IF NEW.first_name IS NOT NULL THEN
    IF NEW.cv_url IS NULL OR length(trim(NEW.cv_url)) = 0 THEN
      RAISE EXCEPTION 'CV is required';
    END IF;
    IF NEW.declaration_accepted IS NOT TRUE THEN
      RAISE EXCEPTION 'Declaration must be accepted';
    END IF;
    IF NEW.criminal_record IS TRUE AND (NEW.criminal_record_details IS NULL OR length(trim(NEW.criminal_record_details)) = 0) THEN
      RAISE EXCEPTION 'Criminal record details are required when criminal_record is true';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_join_application_trigger ON public.join_applications;
CREATE TRIGGER validate_join_application_trigger
BEFORE INSERT OR UPDATE ON public.join_applications
FOR EACH ROW EXECUTE FUNCTION public.validate_join_application();

-- Create private applications bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('applications', 'applications', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public can upload to applications/cvs/*, only admins can read
CREATE POLICY "Anyone can upload application CVs"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'applications' AND (storage.foldername(name))[1] = 'cvs');

CREATE POLICY "Admins can read application files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'applications' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete application files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'applications' AND has_role(auth.uid(), 'admin'::app_role));
