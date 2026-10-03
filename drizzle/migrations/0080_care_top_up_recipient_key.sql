-- A top-up link asks about one person on the request. The key is that
-- person's place in the intake already answered, so the top-up reuses the
-- answers rather than asking who is who a second time.
ALTER TABLE public.care_access_tokens
  ADD COLUMN IF NOT EXISTS covers_recipient_key text;

COMMENT ON COLUMN public.care_access_tokens.covers_recipient_key IS
  'Intake recipient key (r1, r2, ...) a top-up link asks about. Null on a full link.';