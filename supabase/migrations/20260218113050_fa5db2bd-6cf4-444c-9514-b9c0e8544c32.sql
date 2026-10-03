
-- Super admin identification function
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = 'af2fac7f-86db-483f-831e-3cb38454a30c'::uuid
$$;

-- Admin permissions table
CREATE TABLE public.admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  display_name text,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  requires_blog_approval boolean NOT NULL DEFAULT true,
  requires_campaign_approval boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- Super admin can do everything
CREATE POLICY "Super admin full access" ON public.admin_permissions
FOR ALL USING (public.is_super_admin(auth.uid()));

-- Admins can read their own row
CREATE POLICY "Admins can read own permissions" ON public.admin_permissions
FOR SELECT USING (user_id = auth.uid());

-- Admin login log table
CREATE TABLE public.admin_login_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  logged_in_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_login_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can read all login logs" ON public.admin_login_log
FOR SELECT USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can insert own login log" ON public.admin_login_log
FOR INSERT WITH CHECK (user_id = auth.uid());

-- New columns on blog_posts
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS last_edited_by uuid,
  ADD COLUMN IF NOT EXISTS last_edited_by_name text,
  ADD COLUMN IF NOT EXISTS editors jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approval_status text;

-- New columns on campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS last_edited_by uuid,
  ADD COLUMN IF NOT EXISTS last_edited_by_name text,
  ADD COLUMN IF NOT EXISTS editors jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approval_status text;

-- Insert super admin's own permissions row
INSERT INTO public.admin_permissions (user_id, email, display_name, permissions, requires_blog_approval, requires_campaign_approval, is_active)
VALUES (
  'af2fac7f-86db-483f-831e-3cb38454a30c',
  'oluwatosin@medicconnect.co',
  'Oluwatosin',
  '["dashboard","blog","campaigns","email_templates","enquiries","applications","creator_applications","audience","archives","settings"]'::jsonb,
  false,
  false,
  true
)
ON CONFLICT (user_id) DO NOTHING;
