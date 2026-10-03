-- 1. Prevent candidates from changing administrative columns on their own row
CREATE OR REPLACE FUNCTION public.mu_people_guard_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF private.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.verification_state    := OLD.verification_state;
  NEW.status                := OLD.status;
  NEW.admin_notes           := OLD.admin_notes;
  NEW.profession_confidence := OLD.profession_confidence;
  NEW.profession_source     := OLD.profession_source;
  NEW.auth_user_id          := OLD.auth_user_id;
  NEW.email_key             := OLD.email_key;
  NEW.phone_key             := OLD.phone_key;
  NEW.parse_status          := OLD.parse_status;
  NEW.parsed_at             := OLD.parsed_at;
  NEW.candidate_gaps        := OLD.candidate_gaps;
  NEW.invited_at            := OLD.invited_at;
  NEW.claimed_at            := OLD.claimed_at;
  NEW.created_at            := OLD.created_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mu_people_guard_admin_columns ON public.mu_people;
CREATE TRIGGER mu_people_guard_admin_columns
BEFORE UPDATE ON public.mu_people
FOR EACH ROW EXECUTE FUNCTION public.mu_people_guard_admin_columns();

REVOKE EXECUTE ON FUNCTION public.mu_people_guard_admin_columns() FROM PUBLIC, anon, authenticated;

-- 2. Trigger-only SECURITY DEFINER functions must not be callable via the API
REVOKE EXECUTE ON FUNCTION public.mu_link_join_application() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mu_link_matchmaker_application() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mu_queue_cv_parse() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mu_sync_join_documents() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mu_sync_matchmaker_documents() FROM PUBLIC, anon, authenticated;

-- 3. Restrict remaining SECURITY DEFINER helpers to signed-in users
REVOKE EXECUTE ON FUNCTION public.mu_my_person_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_my_person_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mu_match_opportunities_for_person(uuid, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_match_opportunities_for_person(uuid, integer, boolean) TO authenticated;