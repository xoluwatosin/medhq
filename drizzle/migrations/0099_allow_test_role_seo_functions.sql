DO $$
DECLARE r record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    FOR r IN
      SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'seo\_%'
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO sandbox_exec', r.sig);
    END LOOP;
  END IF;
END $$;