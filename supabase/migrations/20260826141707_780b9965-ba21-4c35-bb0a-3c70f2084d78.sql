DROP POLICY IF EXISTS "Candidates can answer their own queried fields" ON public.mu_parsed_fields;
CREATE POLICY "Candidates can answer their own queried fields"
ON public.mu_parsed_fields
FOR UPDATE
TO authenticated
USING (person_id = mu_my_person_id())
WITH CHECK (person_id = mu_my_person_id() AND status = 'candidate_updated'::text);