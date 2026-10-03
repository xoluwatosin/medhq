
-- 1. Revoke anon access to sensitive admin-identifying columns on blog_posts
REVOKE SELECT ON public.blog_posts FROM anon;
GRANT SELECT (
  id, title, slug, excerpt, content, category, author,
  featured_image_url, published_at, status, archived,
  hero_template, body_template, body_images, body_captions,
  polaroid_caption, created_at
) ON public.blog_posts TO anon;

-- 2. Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
