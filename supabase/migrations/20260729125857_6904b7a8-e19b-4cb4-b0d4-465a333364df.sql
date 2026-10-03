ALTER TABLE public.mu_people
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS profession_source text,
  ADD COLUMN IF NOT EXISTS profession_confidence numeric,
  ADD COLUMN IF NOT EXISTS parse_status text NOT NULL DEFAULT 'not_parsed',
  ADD COLUMN IF NOT EXISTS parsed_at timestamptz,
  ADD COLUMN IF NOT EXISTS candidate_gaps jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.mu_parsed_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.mu_documents(id) ON DELETE SET NULL,
  field text NOT NULL,
  value text,
  confidence numeric NOT NULL DEFAULT 0,
  evidence text,
  model text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mu_parsed_fields_person_field_uq
  ON public.mu_parsed_fields (person_id, field);
CREATE INDEX IF NOT EXISTS mu_parsed_fields_status_idx
  ON public.mu_parsed_fields (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_parsed_fields TO authenticated;
GRANT ALL ON public.mu_parsed_fields TO service_role;
ALTER TABLE public.mu_parsed_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage mu parsed fields" ON public.mu_parsed_fields;
CREATE POLICY "Admins manage mu parsed fields" ON public.mu_parsed_fields FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS mu_parsed_fields_updated_at ON public.mu_parsed_fields;
CREATE TRIGGER mu_parsed_fields_updated_at BEFORE UPDATE ON public.mu_parsed_fields
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();