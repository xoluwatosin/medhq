DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.seo_page_blockers(uuid) TO sandbox_exec';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.seo_claim_effective_state(text, timestamptz, timestamptz) TO sandbox_exec';
  END IF;
END $$;