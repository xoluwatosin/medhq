ALTER TABLE public.mu_parsed_fields ADD COLUMN IF NOT EXISTS note text;

CREATE TABLE IF NOT EXISTS public.mu_cv_parses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  document_id uuid,
  document_label text,
  model text,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  profession text,
  gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_cv_parses TO authenticated;
GRANT ALL ON public.mu_cv_parses TO service_role;

ALTER TABLE public.mu_cv_parses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage mu cv parses" ON public.mu_cv_parses
  FOR ALL USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS mu_cv_parses_person_idx ON public.mu_cv_parses(person_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.mu_queue_cv_parse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (coalesce(NEW.label,'') || ' ' || coalesce(NEW.url,'')) ~* '(\ycv\y|resume|curriculum)' THEN
    UPDATE public.mu_people
       SET parse_status = 'not_parsed'
     WHERE id = NEW.person_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mu_documents_queue_cv_parse ON public.mu_documents;
CREATE TRIGGER mu_documents_queue_cv_parse
AFTER INSERT ON public.mu_documents
FOR EACH ROW EXECUTE FUNCTION public.mu_queue_cv_parse();