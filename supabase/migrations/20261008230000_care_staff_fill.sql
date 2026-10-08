-- Staff can fill in the pre-assessment with the family, on a call or in
-- person. The link they use records who they are, so the record shows the
-- form was filled in by staff, and it never gives anyone portal access.
ALTER TABLE public.care_access_tokens ADD COLUMN IF NOT EXISTS filled_by_staff uuid;
