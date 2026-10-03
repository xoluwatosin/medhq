ALTER TABLE public.care_request_recipients
  ADD COLUMN IF NOT EXISTS intake_recipient_key text;

CREATE UNIQUE INDEX IF NOT EXISTS care_request_recipients_intake_key_unique
  ON public.care_request_recipients (request_id, intake_recipient_key)
  WHERE intake_recipient_key IS NOT NULL;

COMMENT ON COLUMN public.care_request_recipients.intake_recipient_key IS
  'Stable recipient key from the coordinated intake, used to bind recipient-scoped answers and uploads.';