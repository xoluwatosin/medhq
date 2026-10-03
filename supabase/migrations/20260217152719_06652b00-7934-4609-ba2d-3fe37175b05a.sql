
-- 1. Add status and archived columns to contact_submissions
ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- 2. Add status and archived columns to join_applications
ALTER TABLE public.join_applications
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- 3. Admin SELECT policy on contact_submissions
CREATE POLICY "Admins can read all contact submissions"
  ON public.contact_submissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Admin UPDATE policy on contact_submissions
CREATE POLICY "Admins can update contact submissions"
  ON public.contact_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Admin SELECT policy on join_applications
CREATE POLICY "Admins can read all join applications"
  ON public.join_applications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Admin UPDATE policy on join_applications
CREATE POLICY "Admins can update join applications"
  ON public.join_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Campaigns table
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  audience_type text NOT NULL DEFAULT 'all',
  manual_recipients text[] DEFAULT '{}',
  template text NOT NULL DEFAULT 'plain',
  template_data jsonb DEFAULT '{}'::jsonb,
  total_recipients integer DEFAULT 0,
  total_delivered integer DEFAULT 0,
  total_opened integer DEFAULT 0,
  total_clicked integer DEFAULT 0,
  total_bounced integer DEFAULT 0,
  scheduled_for timestamp with time zone,
  sent_at timestamp with time zone,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read campaigns" ON public.campaigns
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert campaigns" ON public.campaigns
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update campaigns" ON public.campaigns
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete campaigns" ON public.campaigns
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 8. Audience groups table
CREATE TABLE public.audience_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audience_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audience groups" ON public.audience_groups
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert audience groups" ON public.audience_groups
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update audience groups" ON public.audience_groups
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete audience groups" ON public.audience_groups
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 9. Audience members table
CREATE TABLE public.audience_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text DEFAULT '',
  group_id uuid NOT NULL REFERENCES public.audience_groups(id) ON DELETE CASCADE,
  source text DEFAULT 'manual',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(email, group_id)
);

ALTER TABLE public.audience_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audience members" ON public.audience_members
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert audience members" ON public.audience_members
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update audience members" ON public.audience_members
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete audience members" ON public.audience_members
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 10. Campaign events table
CREATE TABLE public.campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  recipient_email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read campaign events" ON public.campaign_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert campaign events" ON public.campaign_events
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 11. Seed default audience group
INSERT INTO public.audience_groups (name, description)
VALUES ('Newsletter Subscribers', 'Default group for newsletter subscribers')
ON CONFLICT (name) DO NOTHING;
