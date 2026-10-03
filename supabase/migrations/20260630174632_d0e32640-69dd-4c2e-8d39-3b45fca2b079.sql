ALTER TABLE public.matchmaker_opportunities
  ADD COLUMN IF NOT EXISTS questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS audience_group_id uuid REFERENCES public.audience_groups(id) ON DELETE SET NULL;

ALTER TABLE public.matchmaker_applications
  ADD COLUMN IF NOT EXISTS question_answers jsonb NOT NULL DEFAULT '{}'::jsonb;
