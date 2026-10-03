CREATE TABLE public.heard_volunteers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  state TEXT NOT NULL,
  role_interest TEXT NOT NULL,
  motivation TEXT,
  time_commitment TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.heard_volunteers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.heard_volunteers TO authenticated;
GRANT ALL ON public.heard_volunteers TO service_role;

ALTER TABLE public.heard_volunteers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can sign up as a Heard volunteer"
  ON public.heard_volunteers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read Heard volunteers"
  ON public.heard_volunteers FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update Heard volunteers"
  ON public.heard_volunteers FOR UPDATE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete Heard volunteers"
  ON public.heard_volunteers FOR DELETE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER heard_volunteers_updated_at
  BEFORE UPDATE ON public.heard_volunteers
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

CREATE TABLE public.heard_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.heard_waitlist TO anon;
GRANT SELECT, INSERT, DELETE ON public.heard_waitlist TO authenticated;
GRANT ALL ON public.heard_waitlist TO service_role;

ALTER TABLE public.heard_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join Heard waitlist"
  ON public.heard_waitlist FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read Heard waitlist"
  ON public.heard_waitlist FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete Heard waitlist entries"
  ON public.heard_waitlist FOR DELETE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));