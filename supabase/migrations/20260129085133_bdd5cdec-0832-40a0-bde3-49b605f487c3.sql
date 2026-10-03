-- Add explicit SELECT policy to deny all reads on contact_submissions
CREATE POLICY "No public read access to contact submissions"
ON public.contact_submissions
FOR SELECT
USING (false);

-- Add explicit SELECT policy to deny all reads on join_applications  
CREATE POLICY "No public read access to join applications"
ON public.join_applications
FOR SELECT
USING (false);