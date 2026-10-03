CREATE POLICY "Admins can upload application files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'applications' AND private.has_role(auth.uid(), 'admin'::app_role));