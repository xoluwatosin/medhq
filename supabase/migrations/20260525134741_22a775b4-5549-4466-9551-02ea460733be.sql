
-- Tighten storage policies on public-facing upload buckets

-- 1. Restrict file size & MIME types at bucket level
UPDATE storage.buckets
SET file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
WHERE id = 'applications';

UPDATE storage.buckets
SET file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png','image/jpeg','image/webp'
    ]
WHERE id = 'creator-uploads';

-- 2. Replace permissive creator-uploads INSERT with path-scoped INSERT
DROP POLICY IF EXISTS "Anyone can upload creator files" ON storage.objects;

CREATE POLICY "Anyone can upload creator files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'creator-uploads'
  AND (storage.foldername(name))[1] IN ('portfolios','rate-cards')
);

-- 3. Admin management policies for creator-uploads
CREATE POLICY "Admins can delete creator uploads"
ON storage.objects
FOR DELETE
USING (bucket_id = 'creator-uploads' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update creator uploads"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'creator-uploads' AND has_role(auth.uid(), 'admin'::app_role));

-- 4. Admin update policy for applications bucket (delete already exists)
CREATE POLICY "Admins can update application files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'applications' AND has_role(auth.uid(), 'admin'::app_role));
