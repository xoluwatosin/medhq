-- Heard product foundation.
-- Heard is a separate operational data domain inside the same backend.
-- No Heard record is ever linked to a Care, Workforce, Candidate or mu_* person.
-- Identity is never inferred from email, name or telephone number.

-- A. Write to us -------------------------------------------------------------
CREATE TABLE public.heard_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text,
  content text NOT NULL,
  email text,
  status text NOT NULL DEFAULT 'new',
  moderation_state text NOT NULL DEFAULT 'pending',
  moderation_notes text,
  moderated_by uuid,
  moderated_at timestamptz,
  auth_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.heard_submissions TO authenticated;
GRANT ALL ON public.heard_submissions TO service_role;
ALTER TABLE public.heard_submissions ENABLE ROW LEVEL SECURITY;

-- B. Story Swap --------------------------------------------------------------
CREATE TABLE public.heard_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text,
  content text NOT NULL,
  sign_it_as text,
  submitter_email text,
  moderation_state text NOT NULL DEFAULT 'pending',
  approval_state text NOT NULL DEFAULT 'undecided',
  matching_state text NOT NULL DEFAULT 'unmatched',
  delivery_state text NOT NULL DEFAULT 'not_sent',
  matched_with_story_id uuid REFERENCES public.heard_stories(id),
  moderation_notes text,
  moderated_by uuid,
  moderated_at timestamptz,
  auth_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.heard_stories TO authenticated;
GRANT ALL ON public.heard_stories TO service_role;
ALTER TABLE public.heard_stories ENABLE ROW LEVEL SECURITY;

-- C. Letters -----------------------------------------------------------------
-- destination is single-valued, so public display and email distribution are
-- mutually exclusive by construction.
CREATE TABLE public.heard_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_ref text NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  heading text,
  content text NOT NULL,
  sign_it_as text,
  submitter_email text,
  moderation_state text NOT NULL DEFAULT 'pending',
  approval_state text NOT NULL DEFAULT 'undecided',
  destination text NOT NULL DEFAULT 'undecided',
  published_at timestamptz,
  moderation_notes text,
  moderated_by uuid,
  moderated_at timestamptz,
  auth_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT heard_letters_public_ref_key UNIQUE (public_ref),
  CONSTRAINT heard_letters_destination_check
    CHECK (destination IN ('undecided', 'letter_room', 'email_distribution')),
  CONSTRAINT heard_letters_approval_check
    CHECK (approval_state IN ('undecided', 'approved', 'rejected'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.heard_letters TO authenticated;
GRANT ALL ON public.heard_letters TO service_role;
ALTER TABLE public.heard_letters ENABLE ROW LEVEL SECURITY;

-- D. Letter recipients -------------------------------------------------------
CREATE TABLE public.heard_letter_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  status text NOT NULL DEFAULT 'subscribed',
  consent_version text NOT NULL DEFAULT 'v1',
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  unsubscribe_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  auth_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT heard_letter_recipients_email_key UNIQUE (email),
  CONSTRAINT heard_letter_recipients_status_check
    CHECK (status IN ('subscribed', 'unsubscribed', 'suppressed'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.heard_letter_recipients TO authenticated;
GRANT ALL ON public.heard_letter_recipients TO service_role;
ALTER TABLE public.heard_letter_recipients ENABLE ROW LEVEL SECURITY;

-- E. Delivery ledger ---------------------------------------------------------
CREATE TABLE public.heard_letter_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES public.heard_letters(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.heard_letter_recipients(id) ON DELETE CASCADE,
  delivery_status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- the same recipient must never receive the same letter twice
  CONSTRAINT heard_letter_deliveries_unique UNIQUE (letter_id, recipient_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.heard_letter_deliveries TO authenticated;
GRANT ALL ON public.heard_letter_deliveries TO service_role;
ALTER TABLE public.heard_letter_deliveries ENABLE ROW LEVEL SECURITY;

-- G. Consent -----------------------------------------------------------------
-- One row per consent act. Permission to use a letter and permission to
-- receive letters are separate, and either can exist without the other.
CREATE TABLE public.heard_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_type text NOT NULL,
  consent_version text NOT NULL DEFAULT 'v1',
  email text,
  subject_table text,
  subject_id uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT heard_consents_type_check
    CHECK (consent_type IN ('letter_use', 'letter_receipt', 'story_use', 'submission_use'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.heard_consents TO authenticated;
GRANT ALL ON public.heard_consents TO service_role;
ALTER TABLE public.heard_consents ENABLE ROW LEVEL SECURITY;

-- Heard moderation authority -------------------------------------------------
-- Care access alone never grants Heard moderation.
CREATE OR REPLACE FUNCTION private.heard_can(_perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT auth.uid() IS NOT NULL
     AND private.has_role(auth.uid(), 'admin'::public.app_role)
     AND private.has_admin_permission(auth.uid(), _perm)
$$;

CREATE POLICY "Heard reviewers read submissions" ON public.heard_submissions
  FOR SELECT TO authenticated USING (private.heard_can('heard_content_review'));
CREATE POLICY "Heard reviewers update submissions" ON public.heard_submissions
  FOR UPDATE TO authenticated
  USING (private.heard_can('heard_content_review'))
  WITH CHECK (private.heard_can('heard_content_review'));

CREATE POLICY "Heard reviewers read stories" ON public.heard_stories
  FOR SELECT TO authenticated USING (private.heard_can('heard_story_swap_manage'));
CREATE POLICY "Heard reviewers update stories" ON public.heard_stories
  FOR UPDATE TO authenticated
  USING (private.heard_can('heard_story_swap_manage'))
  WITH CHECK (private.heard_can('heard_story_swap_manage'));

CREATE POLICY "Heard reviewers read letters" ON public.heard_letters
  FOR SELECT TO authenticated USING (private.heard_can('heard_letters_manage'));
CREATE POLICY "Heard reviewers update letters" ON public.heard_letters
  FOR UPDATE TO authenticated
  USING (private.heard_can('heard_letters_manage'))
  WITH CHECK (private.heard_can('heard_letters_manage'));

CREATE POLICY "Heard delivery managers read recipients" ON public.heard_letter_recipients
  FOR SELECT TO authenticated USING (private.heard_can('heard_delivery_manage'));
CREATE POLICY "Heard delivery managers update recipients" ON public.heard_letter_recipients
  FOR UPDATE TO authenticated
  USING (private.heard_can('heard_delivery_manage'))
  WITH CHECK (private.heard_can('heard_delivery_manage'));

CREATE POLICY "Heard delivery managers read deliveries" ON public.heard_letter_deliveries
  FOR SELECT TO authenticated USING (private.heard_can('heard_delivery_manage'));

CREATE POLICY "Heard reviewers read consents" ON public.heard_consents
  FOR SELECT TO authenticated USING (private.heard_can('heard_content_review'));

-- Controlled submission paths -------------------------------------------------
-- The public never writes to a Heard table directly. Identifiers, timestamps,
-- status, moderation and audit fields are all server-derived.

CREATE OR REPLACE FUNCTION public.heard_submit_message(
  _content text,
  _subject text DEFAULT NULL,
  _email text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  IF _content IS NULL OR length(btrim(_content)) < 2 THEN
    RAISE EXCEPTION 'A message is required';
  END IF;
  INSERT INTO public.heard_submissions (subject, content, email)
  VALUES (nullif(btrim(_subject), ''), left(btrim(_content), 20000), nullif(lower(btrim(_email)), ''))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.heard_submit_message(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heard_submit_message(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.heard_submit_story(
  _content text,
  _subject text DEFAULT NULL,
  _sign_it_as text DEFAULT NULL,
  _email text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  IF _content IS NULL OR length(btrim(_content)) < 2 THEN
    RAISE EXCEPTION 'A story is required';
  END IF;
  INSERT INTO public.heard_stories (subject, content, sign_it_as, submitter_email)
  VALUES (
    nullif(btrim(_subject), ''),
    left(btrim(_content), 20000),
    nullif(btrim(_sign_it_as), ''),
    nullif(lower(btrim(_email)), '')
  )
  RETURNING id INTO new_id;
  INSERT INTO public.heard_consents (consent_type, email, subject_table, subject_id, source)
  VALUES ('story_use', nullif(lower(btrim(_email)), ''), 'heard_stories', new_id, 'story_swap_form');
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.heard_submit_story(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heard_submit_story(text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.heard_submit_letter(
  _content text,
  _heading text DEFAULT NULL,
  _sign_it_as text DEFAULT NULL,
  _email text DEFAULT NULL,
  _consent_version text DEFAULT 'v1'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  IF _content IS NULL OR length(btrim(_content)) < 2 THEN
    RAISE EXCEPTION 'A letter is required';
  END IF;
  INSERT INTO public.heard_letters (heading, content, sign_it_as, submitter_email)
  VALUES (
    nullif(btrim(_heading), ''),
    left(btrim(_content), 20000),
    nullif(btrim(_sign_it_as), ''),
    nullif(lower(btrim(_email)), '')
  )
  RETURNING id INTO new_id;
  INSERT INTO public.heard_consents (consent_type, consent_version, email, subject_table, subject_id, source)
  VALUES ('letter_use', _consent_version, nullif(lower(btrim(_email)), ''), 'heard_letters', new_id, 'letters_form');
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.heard_submit_letter(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heard_submit_letter(text, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.heard_subscribe_letters(
  _email text,
  _consent_version text DEFAULT 'v1'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE rec_id uuid;
DECLARE clean_email text := nullif(lower(btrim(_email)), '');
BEGIN
  IF clean_email IS NULL OR clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;
  INSERT INTO public.heard_letter_recipients (email, consent_version)
  VALUES (clean_email, _consent_version)
  ON CONFLICT (email) DO UPDATE
    SET status = 'subscribed',
        consent_version = EXCLUDED.consent_version,
        subscribed_at = now(),
        unsubscribed_at = NULL,
        updated_at = now()
  RETURNING id INTO rec_id;
  INSERT INTO public.heard_consents (consent_type, consent_version, email, subject_table, subject_id, source)
  VALUES ('letter_receipt', _consent_version, clean_email, 'heard_letter_recipients', rec_id, 'letter_room_optin');
  RETURN rec_id;
END;
$$;
REVOKE ALL ON FUNCTION public.heard_subscribe_letters(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heard_subscribe_letters(text, text) TO service_role;

-- Public Letter Room ----------------------------------------------------------
-- Only approved, letter-room letters, and only the public fields.
CREATE OR REPLACE FUNCTION public.heard_public_letters(_limit integer DEFAULT 50)
RETURNS TABLE (public_ref text, heading text, content text, sign_it_as text, published_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.public_ref, l.heading, l.content, l.sign_it_as, l.published_at
  FROM public.heard_letters l
  WHERE l.approval_state = 'approved'
    AND l.destination = 'letter_room'
    AND l.published_at IS NOT NULL
  ORDER BY l.published_at DESC
  LIMIT least(greatest(coalesce(_limit, 50), 1), 200)
$$;
REVOKE ALL ON FUNCTION public.heard_public_letters(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heard_public_letters(integer) TO anon, authenticated, service_role;
