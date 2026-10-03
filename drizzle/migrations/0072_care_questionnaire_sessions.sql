-- One coordinated pre-assessment across every recipient on one care request.
--
-- The session is coordination and provenance. The clinical evidence stays in
-- care_documents: one canonical pre-assessment document per recipient, owned
-- by that recipient's client row. Nothing here replaces that.

CREATE TABLE public.care_questionnaire_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.care_requests(id) ON DELETE CASCADE,
  form_definition_id UUID NOT NULL REFERENCES public.form_definitions(id),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'superseded')),
  shared_responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  filler_type TEXT NOT NULL DEFAULT 'family_member',
  respondent_person_id UUID REFERENCES public.care_people(id),
  respondent_contact_id UUID,
  -- Where the family had reached, so the link resumes rather than restarts.
  position_section TEXT,
  position_page TEXT,
  position_recipient_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX care_questionnaire_sessions_one_live
  ON public.care_questionnaire_sessions (request_id)
  WHERE status = 'draft';
CREATE INDEX care_questionnaire_sessions_request
  ON public.care_questionnaire_sessions (request_id);

GRANT SELECT ON public.care_questionnaire_sessions TO authenticated;
GRANT ALL ON public.care_questionnaire_sessions TO service_role;
ALTER TABLE public.care_questionnaire_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read questionnaire sessions"
  ON public.care_questionnaire_sessions FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- Exactly which recipients this one link may write to.
CREATE TABLE public.care_questionnaire_session_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.care_questionnaire_sessions(id) ON DELETE CASCADE,
  request_recipient_id UUID NOT NULL REFERENCES public.care_request_recipients(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  document_id UUID NOT NULL REFERENCES public.care_documents(id),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, request_recipient_id),
  UNIQUE (session_id, document_id)
);

CREATE INDEX care_questionnaire_session_recipients_session
  ON public.care_questionnaire_session_recipients (session_id, display_order);

GRANT SELECT ON public.care_questionnaire_session_recipients TO authenticated;
GRANT ALL ON public.care_questionnaire_session_recipients TO service_role;
ALTER TABLE public.care_questionnaire_session_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read questionnaire session recipients"
  ON public.care_questionnaire_session_recipients FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- A file a family sent from a questionnaire link. The questionnaire answer
-- holds this row's id, never a storage path chosen by a browser.
CREATE TABLE public.care_upload_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.care_questionnaire_sessions(id) ON DELETE SET NULL,
  request_id UUID REFERENCES public.care_requests(id) ON DELETE SET NULL,
  token_id UUID REFERENCES public.care_access_tokens(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  request_recipient_id UUID REFERENCES public.care_request_recipients(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.care_documents(id) ON DELETE SET NULL,
  field_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  detected_mime TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'care-uploads',
  storage_path TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX care_upload_files_client ON public.care_upload_files (client_id, field_id);
CREATE INDEX care_upload_files_session ON public.care_upload_files (session_id);

GRANT SELECT ON public.care_upload_files TO authenticated;
GRANT ALL ON public.care_upload_files TO service_role;
ALTER TABLE public.care_upload_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read care upload files"
  ON public.care_upload_files FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- The existing token machinery carries a session reference for v5. The legacy
-- client_id stays for older links, but it never decides who a v5 link may
-- write to: the session's recipient rows do.
ALTER TABLE public.care_access_tokens
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.care_questionnaire_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS care_access_tokens_session ON public.care_access_tokens (session_id);
