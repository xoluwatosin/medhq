WITH ranked AS (
  SELECT
    id,
    'r' || row_number() OVER (
      PARTITION BY request_id
      ORDER BY display_order NULLS LAST, created_at, id
    )::text AS recipient_key
  FROM public.care_request_recipients
  WHERE intake_recipient_key IS NULL
)
UPDATE public.care_request_recipients AS recipient
SET intake_recipient_key = ranked.recipient_key
FROM ranked
WHERE recipient.id = ranked.id;

CREATE OR REPLACE FUNCTION public.set_care_request_recipient_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate integer;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.intake_recipient_key IS NOT NULL AND NEW.intake_recipient_key IS DISTINCT FROM OLD.intake_recipient_key THEN
    RAISE EXCEPTION 'A care recipient intake key cannot be changed';
  END IF;
  IF NEW.intake_recipient_key IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.request_id::text));
  SELECT COALESCE(MAX(substring(intake_recipient_key FROM 2)::integer), 0) + 1
  INTO candidate
  FROM public.care_request_recipients
  WHERE request_id = NEW.request_id
    AND intake_recipient_key ~ '^r[0-9]+$';

  NEW.intake_recipient_key := 'r' || candidate::text;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS care_request_recipient_key_before_write ON public.care_request_recipients;
CREATE TRIGGER care_request_recipient_key_before_write
BEFORE INSERT OR UPDATE OF intake_recipient_key ON public.care_request_recipients
FOR EACH ROW EXECUTE FUNCTION public.set_care_request_recipient_key();

COMMENT ON FUNCTION public.set_care_request_recipient_key() IS
  'Assigns and protects the immutable request-local key used by pre-assessment answers and uploads.';