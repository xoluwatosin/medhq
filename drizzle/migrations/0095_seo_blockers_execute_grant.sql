REVOKE ALL ON FUNCTION public.seo_page_blockers(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.seo_page_blockers(uuid) TO authenticated, service_role;