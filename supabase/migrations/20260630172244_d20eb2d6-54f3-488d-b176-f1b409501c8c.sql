
-- Shared updated_at trigger function in public schema
CREATE OR REPLACE FUNCTION public.matchmaker_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================================
-- matchmaker_opportunities
-- =====================================================================
CREATE TABLE public.matchmaker_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  description text,
  location text,
  role_details text,
  requirements text,
  document_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  link_target text NOT NULL DEFAULT 'detail' CHECK (link_target IN ('detail', 'landing')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX matchmaker_opportunities_status_idx ON public.matchmaker_opportunities (status);
CREATE INDEX matchmaker_opportunities_slug_idx ON public.matchmaker_opportunities (slug);

GRANT SELECT ON public.matchmaker_opportunities TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.matchmaker_opportunities TO authenticated;
GRANT ALL ON public.matchmaker_opportunities TO service_role;

ALTER TABLE public.matchmaker_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view open or closed opportunities"
  ON public.matchmaker_opportunities FOR SELECT
  USING (status IN ('open', 'closed'));

CREATE POLICY "Admins can view all opportunities"
  ON public.matchmaker_opportunities FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert opportunities"
  ON public.matchmaker_opportunities FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update opportunities"
  ON public.matchmaker_opportunities FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete opportunities"
  ON public.matchmaker_opportunities FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- matchmaker_applications  (current_role renamed -> current_position to avoid reserved word)
-- =====================================================================
CREATE TABLE public.matchmaker_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.matchmaker_opportunities(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  current_position text,
  years_experience int,
  cover_note text,
  documents jsonb NOT NULL DEFAULT '{}'::jsonb,
  requirement_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'shortlisted', 'rejected', 'hired')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX matchmaker_applications_opportunity_idx ON public.matchmaker_applications (opportunity_id);
CREATE INDEX matchmaker_applications_status_idx ON public.matchmaker_applications (status);

GRANT INSERT ON public.matchmaker_applications TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.matchmaker_applications TO authenticated;
GRANT ALL ON public.matchmaker_applications TO service_role;

ALTER TABLE public.matchmaker_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an application"
  ON public.matchmaker_applications FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all applications"
  ON public.matchmaker_applications FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update applications"
  ON public.matchmaker_applications FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete applications"
  ON public.matchmaker_applications FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- matchmaker_share_events
-- =====================================================================
CREATE TABLE public.matchmaker_share_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES public.matchmaker_opportunities(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email', 'copy', 'native')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX matchmaker_share_events_opportunity_idx ON public.matchmaker_share_events (opportunity_id);

GRANT INSERT ON public.matchmaker_share_events TO anon, authenticated;
GRANT SELECT ON public.matchmaker_share_events TO authenticated;
GRANT ALL ON public.matchmaker_share_events TO service_role;

ALTER TABLE public.matchmaker_share_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log a share event"
  ON public.matchmaker_share_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view share events"
  ON public.matchmaker_share_events FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER matchmaker_opportunities_set_updated_at
  BEFORE UPDATE ON public.matchmaker_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

CREATE TRIGGER matchmaker_applications_set_updated_at
  BEFORE UPDATE ON public.matchmaker_applications
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- Storage policies: reuse existing private 'applications' bucket under matchmakers/ prefix.
-- Anyone (anon + authenticated) can upload to matchmakers/* so candidates can attach docs.
CREATE POLICY "Anyone can upload matchmaker documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'applications'
    AND (storage.foldername(name))[1] = 'matchmakers'
  );

CREATE POLICY "Admins can read matchmaker documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'applications'
    AND (storage.foldername(name))[1] = 'matchmakers'
    AND private.has_role(auth.uid(), 'admin')
  );
