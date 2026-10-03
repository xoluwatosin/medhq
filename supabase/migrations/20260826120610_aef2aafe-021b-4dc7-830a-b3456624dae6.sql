DROP POLICY IF EXISTS "Candidates can answer their own queried fields" ON public.mu_parsed_fields;
CREATE POLICY "Candidates can answer their own queried fields"
ON public.mu_parsed_fields
FOR UPDATE
TO authenticated
USING (
  person_id = public.mu_my_person_id()
  AND status = ANY (ARRAY['queried'::text, 'rejected'::text, 'accepted'::text, 'candidate_updated'::text])
)
WITH CHECK (
  person_id = public.mu_my_person_id()
  AND status = 'candidate_updated'::text
);