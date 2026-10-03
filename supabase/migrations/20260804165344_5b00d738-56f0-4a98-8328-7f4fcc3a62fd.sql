CREATE OR REPLACE FUNCTION public.mu_people_guard_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- No signed-in user means a trusted backend/maintenance context (service role
  -- or a migration). RLS already prevents anonymous clients reaching this table.
  IF auth.uid() IS NULL OR private.has_role(auth.uid(), 'admin'::app_role) THEN
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
  NEW.promotion_provenance  := OLD.promotion_provenance;

  RETURN NEW;
END;
$$;