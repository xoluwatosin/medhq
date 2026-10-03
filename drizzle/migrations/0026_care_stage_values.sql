-- The stage is now derived, and the derived vocabulary is wider than the
-- hand-written one. Historical keys stay allowed so old rows remain valid.
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_stage_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_stage_check CHECK (
  stage IN (
    'enquiry',
    'awaiting_pre_assessment',
    'pre_assessment_received',
    'assessment_booked',
    'assessment_in_progress',
    'clinical_review',
    'plan_preparation',
    'plan_issued',
    'care_running',
    'paused',
    'closed',
    -- historical keys, kept readable
    'callback_due',
    'pre_assessment_sent',
    'responses_returned',
    'assessment_complete'
  )
) NOT VALID;
ALTER TABLE public.clients VALIDATE CONSTRAINT clients_stage_check;