-- 1. Verification refresh helper with the shape the callers expect.
CREATE OR REPLACE FUNCTION public.mu_derive_verification(_person_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE s text;
BEGIN
  UPDATE public.mu_people
     SET verification_state = public.mu_derive_verification(id, candidate_gaps)
   WHERE id = _person_id
  RETURNING verification_state INTO s;
  RETURN s;
END;
$$;

REVOKE ALL ON FUNCTION public.mu_derive_verification(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_derive_verification(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_derive_verification(uuid) TO service_role;

-- 2. Remove the stale four-argument review overload so reviews resolve to one function.
DROP FUNCTION IF EXISTS public.mu_review_document(uuid, text, text, date);

NOTIFY pgrst, 'reload schema';