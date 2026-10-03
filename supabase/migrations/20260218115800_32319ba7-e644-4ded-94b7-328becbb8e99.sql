
CREATE TABLE public.otp_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  code text NOT NULL,
  used boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Deny all public access; only service role can read/write
CREATE POLICY "No public select on otp_codes" ON public.otp_codes FOR SELECT USING (false);
CREATE POLICY "No public insert on otp_codes" ON public.otp_codes FOR INSERT WITH CHECK (false);
CREATE POLICY "No public update on otp_codes" ON public.otp_codes FOR UPDATE USING (false);
CREATE POLICY "No public delete on otp_codes" ON public.otp_codes FOR DELETE USING (false);

-- Index for fast lookups
CREATE INDEX idx_otp_codes_email_used ON public.otp_codes (email, used);
