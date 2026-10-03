-- Where the family had reached on a questionnaire link, held on the server so
-- the same link resumes on any device rather than restarting.
ALTER TABLE public.care_access_tokens
  ADD COLUMN IF NOT EXISTS position JSONB NOT NULL DEFAULT '{}'::jsonb;
