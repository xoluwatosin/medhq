
CREATE TABLE public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT 'true'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read settings"
  ON public.admin_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update settings"
  ON public.admin_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can read settings"
  ON public.admin_settings FOR SELECT
  USING (true);

INSERT INTO public.admin_settings (key, value) VALUES
  ('notify_contact', 'true'::jsonb),
  ('notify_application', 'true'::jsonb),
  ('notify_creator', 'false'::jsonb);
