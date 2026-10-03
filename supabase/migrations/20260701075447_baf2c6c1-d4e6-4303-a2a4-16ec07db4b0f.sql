
ALTER TABLE public.matchmaker_opportunities
  ADD COLUMN IF NOT EXISTS standard_fields jsonb NOT NULL
  DEFAULT '{"phone":"optional","current_position":"optional","years_experience":"optional","cover_note":"optional"}'::jsonb;

CREATE TABLE IF NOT EXISTS public.matchmaker_question_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.matchmaker_question_templates TO authenticated;
GRANT ALL ON public.matchmaker_question_templates TO service_role;

ALTER TABLE public.matchmaker_question_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage question templates"
  ON public.matchmaker_question_templates
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER matchmaker_question_templates_updated_at
  BEFORE UPDATE ON public.matchmaker_question_templates
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();
