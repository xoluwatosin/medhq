-- Outstanding required items are computed at submit and kept on the document,
-- so the coordinator can see what is missing without recomputing.
ALTER TABLE public.care_documents
  ADD COLUMN IF NOT EXISTS outstanding_required jsonb NOT NULL DEFAULT '[]'::jsonb;

-- One live draft per client and kind, so autosave can upsert safely.
CREATE UNIQUE INDEX IF NOT EXISTS care_documents_one_draft_idx
  ON public.care_documents (client_id, kind)
  WHERE status = 'draft';

-- Flags raised for the clinical lead. A row, not a boolean, so it can be
-- cleared with a note and the history survives.
CREATE TABLE IF NOT EXISTS public.care_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.care_documents(id) ON DELETE SET NULL,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'review' CHECK (severity IN ('review', 'urgent')),
  detail text,
  raised_by text NOT NULL DEFAULT 'system',
  cleared_at timestamptz,
  cleared_by uuid,
  clear_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_flags_client_id_idx ON public.care_flags (client_id);
GRANT SELECT, INSERT, UPDATE ON public.care_flags TO authenticated;
GRANT ALL ON public.care_flags TO service_role;
ALTER TABLE public.care_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage care flags" ON public.care_flags FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));