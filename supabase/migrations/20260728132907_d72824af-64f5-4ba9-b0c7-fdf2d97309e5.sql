CREATE TABLE public.matchmaker_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.matchmaker_applications(id) ON DELETE CASCADE,
  opportunity_id uuid,
  recipient_email text NOT NULL,
  email_type text NOT NULL,
  subject text,
  booking_link text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  sent_by uuid,
  sent_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.matchmaker_email_log TO authenticated;
GRANT ALL ON public.matchmaker_email_log TO service_role;

ALTER TABLE public.matchmaker_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read candidate email log"
ON public.matchmaker_email_log FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert candidate email log"
ON public.matchmaker_email_log FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_mm_email_log_application ON public.matchmaker_email_log(application_id);

INSERT INTO public.admin_settings (key, value)
VALUES
  ('email_tpl_interview_invite', '{"subject":"Interview invitation: {{role_title}} at {{company}}","body":"Dear {{first_name}},\n\nThank you for applying for the **{{role_title}}** role at {{company}}. We were pleased with your application and would love to get to know you better.\n\nWe would like to invite you to an interview. Please pick a time that works for you using the link below.\n\n[[cta:Book your interview|{{booking_link}}]]\n\nBefore we meet, please take some time to research {{company}} and the wider healthcare industry in Nigeria, so we can have a rich conversation about the work.\n\nIf none of the available times suit you, simply reply to this email and we will find another slot.\n\nWe look forward to speaking with you."}'::jsonb),
  ('email_tpl_rejection', '{"subject":"Your application for {{role_title}}","body":"Dear {{first_name}},\n\nThank you for taking the time to apply for the **{{role_title}}** role at {{company}}, and for sharing your experience with us.\n\nAfter careful consideration, we will not be moving forward with your application on this occasion. This was a difficult decision, as we received a very strong set of applications.\n\nWe would genuinely encourage you to keep an eye on future roles with us. Your details stay with us and we would be glad to consider you again.\n\nWe wish you every success in your career."}'::jsonb)
ON CONFLICT (key) DO NOTHING;