-- The family signs their care offer by hand when they accept.
--
-- The drawn signature is kept with the acceptance, and the signed copy of the
-- agreement (made from the offer, the terms and that signature) is kept in a
-- private bucket. Once the first payment is in, the signed copy is emailed to
-- the family as our written confirmation of the booking. Only the service role
-- reads and writes the bucket; staff and families get it through functions.

ALTER TABLE public.care_offers ADD COLUMN IF NOT EXISTS accepted_signature text;
ALTER TABLE public.care_offers ADD COLUMN IF NOT EXISTS signed_pdf_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('care-agreements', 'care-agreements', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- A signature, once given, and the signed copy, once kept, never change.
CREATE OR REPLACE FUNCTION private.care_offer_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF OLD.status <> 'draft' AND (NEW.content IS DISTINCT FROM OLD.content
      OR NEW.terms IS DISTINCT FROM OLD.terms OR NEW.terms_version IS DISTINCT FROM OLD.terms_version) THEN
    RAISE EXCEPTION 'An offer that has been sent cannot be changed. Withdraw it and make a new one.';
  END IF;
  IF OLD.status = 'accepted' AND NEW.status NOT IN ('accepted') THEN
    RAISE EXCEPTION 'An accepted offer stays accepted.';
  END IF;
  IF OLD.accepted_signature IS NOT NULL AND NEW.accepted_signature IS DISTINCT FROM OLD.accepted_signature THEN
    RAISE EXCEPTION 'A signature cannot be changed.';
  END IF;
  IF OLD.signed_pdf_path IS NOT NULL AND NEW.signed_pdf_path IS DISTINCT FROM OLD.signed_pdf_path THEN
    RAISE EXCEPTION 'The signed copy cannot be replaced.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
