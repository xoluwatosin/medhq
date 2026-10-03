-- =========================================================================
-- 1) BLOG POSTS — restrict anon to safe display columns only
-- =========================================================================

DROP POLICY IF EXISTS "Published blog posts are publicly readable" ON public.blog_posts;

CREATE POLICY "Anon can read published posts (safe columns)"
ON public.blog_posts
FOR SELECT
TO anon
USING (status = 'published' AND published_at <= now());

-- Authenticated public readers (signed-in non-admins) also limited to published.
CREATE POLICY "Authenticated can read published posts (safe columns)"
ON public.blog_posts
FOR SELECT
TO authenticated
USING (status = 'published' AND published_at <= now());

-- Column-level grants: revoke broad SELECT then re-grant only safe columns to anon.
REVOKE SELECT ON public.blog_posts FROM anon;
GRANT SELECT (
  id, title, slug, excerpt, content, category, author,
  featured_image_url, published_at, hero_template, body_template,
  body_images, body_captions, polaroid_caption, status
) ON public.blog_posts TO anon;

-- Authenticated users (admins and standard users) need full column access; admin RLS
-- policy gates write/delete and full-row reads to admins via has_role().
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;


-- =========================================================================
-- 2) STORAGE — applications bucket: tighten anonymous CV uploads
-- =========================================================================

DROP POLICY IF EXISTS "Anyone can upload application CVs" ON storage.objects;

-- Require: applications bucket, cvs/ folder, UUID-shaped filename, allowed extension.
-- Path pattern matches `cvs/<uuid>.<pdf|doc|docx>` — the same pattern the join wizard generates.
CREATE POLICY "Scoped anonymous CV uploads"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'applications'
  AND (storage.foldername(name))[1] = 'cvs'
  AND name ~ '^cvs/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|doc|docx|PDF|DOC|DOCX)$'
);


-- =========================================================================
-- 3) STORAGE — creator-uploads bucket: tighten anonymous uploads
-- =========================================================================

DROP POLICY IF EXISTS "Anyone can upload creator files" ON storage.objects;

-- Require: correct bucket, portfolios/ or rate-cards/ folder, timestamped+random filename
-- with an allowed media/document extension. Matches the pattern Creator.tsx generates.
CREATE POLICY "Scoped anonymous creator uploads"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'creator-uploads'
  AND (storage.foldername(name))[1] = ANY (ARRAY['portfolios','rate-cards'])
  AND name ~ '^(portfolios|rate-cards)/[0-9]+-[a-z0-9]+\.(pdf|jpe?g|png|webp|gif|heic|heif|doc|docx|PDF|JPE?G|PNG|WEBP|GIF|HEIC|HEIF|DOC|DOCX)$'
);


-- =========================================================================
-- 4) SECURITY DEFINER FUNCTIONS — revoke direct execute by API callers
-- =========================================================================

-- is_super_admin: only called by trusted edge functions (service_role) — strip API callers.
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;

-- has_role: required by RLS policies that run as `authenticated`, so it must stay
-- callable by that role. Strip PUBLIC and anon so it cannot be called by signed-out
-- users or any unintended grantee chain.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
