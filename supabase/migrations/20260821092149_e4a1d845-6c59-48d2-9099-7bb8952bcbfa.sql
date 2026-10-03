CREATE TABLE public.email_kit_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'transactional',
  recipe TEXT,
  purpose TEXT,
  subject TEXT NOT NULL DEFAULT '',
  preheader TEXT NOT NULL DEFAULT '',
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_kit_templates TO authenticated;
GRANT ALL ON public.email_kit_templates TO service_role;

ALTER TABLE public.email_kit_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email kit templates"
ON public.email_kit_templates FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.email_kit_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER email_kit_templates_updated_at
BEFORE UPDATE ON public.email_kit_templates
FOR EACH ROW EXECUTE FUNCTION public.email_kit_set_updated_at();

CREATE INDEX email_kit_templates_kind_idx ON public.email_kit_templates (kind, updated_at DESC);