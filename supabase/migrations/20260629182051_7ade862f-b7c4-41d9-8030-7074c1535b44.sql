
-- 1. Create internal schema for role-check helpers
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

-- 2. Recreate helper functions inside the private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id = 'af2fac7f-86db-483f-831e-3cb38454a30c'::uuid
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_super_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_super_admin(uuid) TO authenticated, service_role;

-- 3. Rewrite all policies to use private.* helpers

-- blog_posts
DROP POLICY IF EXISTS "Admins can read all blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can insert blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can update blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can delete blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Authenticated can read published posts (safe columns)" ON public.blog_posts;
CREATE POLICY "Admins can read all blog posts" ON public.blog_posts FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert blog posts" ON public.blog_posts FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update blog posts" ON public.blog_posts FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete blog posts" ON public.blog_posts FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
-- Note: the prior "Authenticated can read published posts" policy is intentionally NOT recreated.
-- Anon readers still see published posts; admins still see everything via the admin policy.

-- user_roles
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- audience_groups
DROP POLICY IF EXISTS "Admins can read audience groups" ON public.audience_groups;
DROP POLICY IF EXISTS "Admins can insert audience groups" ON public.audience_groups;
DROP POLICY IF EXISTS "Admins can update audience groups" ON public.audience_groups;
DROP POLICY IF EXISTS "Admins can delete audience groups" ON public.audience_groups;
CREATE POLICY "Admins can read audience groups" ON public.audience_groups FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert audience groups" ON public.audience_groups FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update audience groups" ON public.audience_groups FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete audience groups" ON public.audience_groups FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- audience_members
DROP POLICY IF EXISTS "Admins can read audience members" ON public.audience_members;
DROP POLICY IF EXISTS "Admins can insert audience members" ON public.audience_members;
DROP POLICY IF EXISTS "Admins can update audience members" ON public.audience_members;
DROP POLICY IF EXISTS "Admins can delete audience members" ON public.audience_members;
CREATE POLICY "Admins can read audience members" ON public.audience_members FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert audience members" ON public.audience_members FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update audience members" ON public.audience_members FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete audience members" ON public.audience_members FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- contact_submissions
DROP POLICY IF EXISTS "Admins can read all contact submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Admins can update contact submissions" ON public.contact_submissions;
CREATE POLICY "Admins can read all contact submissions" ON public.contact_submissions FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update contact submissions" ON public.contact_submissions FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- join_applications
DROP POLICY IF EXISTS "Admins can read all join applications" ON public.join_applications;
DROP POLICY IF EXISTS "Admins can update join applications" ON public.join_applications;
CREATE POLICY "Admins can read all join applications" ON public.join_applications FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update join applications" ON public.join_applications FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- campaigns
DROP POLICY IF EXISTS "Admins can read campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can insert campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can delete campaigns" ON public.campaigns;
CREATE POLICY "Admins can read campaigns" ON public.campaigns FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert campaigns" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update campaigns" ON public.campaigns FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete campaigns" ON public.campaigns FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- campaign_events
DROP POLICY IF EXISTS "Admins can read campaign events" ON public.campaign_events;
DROP POLICY IF EXISTS "Admins can insert campaign events" ON public.campaign_events;
CREATE POLICY "Admins can read campaign events" ON public.campaign_events FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert campaign events" ON public.campaign_events FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- creator_applications
DROP POLICY IF EXISTS "Admins can read all creator applications" ON public.creator_applications;
DROP POLICY IF EXISTS "Admins can update creator applications" ON public.creator_applications;
CREATE POLICY "Admins can read all creator applications" ON public.creator_applications FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update creator applications" ON public.creator_applications FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- email_suppressions
DROP POLICY IF EXISTS "Admins read suppressions" ON public.email_suppressions;
CREATE POLICY "Admins read suppressions" ON public.email_suppressions FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- admin_settings
DROP POLICY IF EXISTS "Admins can read settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.admin_settings;
CREATE POLICY "Admins can read settings" ON public.admin_settings FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update settings" ON public.admin_settings FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- admin_permissions (super admin)
DROP POLICY IF EXISTS "Super admin full access" ON public.admin_permissions;
CREATE POLICY "Super admin full access" ON public.admin_permissions FOR ALL TO authenticated USING (private.is_super_admin(auth.uid())) WITH CHECK (private.is_super_admin(auth.uid()));

-- admin_login_log (super admin)
DROP POLICY IF EXISTS "Super admin can read all login logs" ON public.admin_login_log;
CREATE POLICY "Super admin can read all login logs" ON public.admin_login_log FOR SELECT TO authenticated USING (private.is_super_admin(auth.uid()));

-- orders: rewrite + add INSERT policy (admin-only)
DROP POLICY IF EXISTS "Admins can read orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
CREATE POLICY "Admins can read orders" ON public.orders FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- storage.objects policies referencing the helpers
DROP POLICY IF EXISTS "Admins can upload blog images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update blog images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete blog images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read application files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update application files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete application files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update creator uploads" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete creator uploads" ON storage.objects;

CREATE POLICY "Admins can upload blog images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'blog-images' AND private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update blog images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'blog-images' AND private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (bucket_id = 'blog-images' AND private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete blog images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'blog-images' AND private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can read application files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'applications' AND private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update application files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'applications' AND private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (bucket_id = 'applications' AND private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete application files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'applications' AND private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update creator uploads" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'creator-uploads' AND private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (bucket_id = 'creator-uploads' AND private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete creator uploads" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'creator-uploads' AND private.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. Drop the old public.has_role / public.is_super_admin so they no longer appear in the exposed API
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_super_admin(uuid);
