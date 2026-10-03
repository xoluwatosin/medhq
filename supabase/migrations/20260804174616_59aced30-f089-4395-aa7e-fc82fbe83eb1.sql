DO $$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'mu_match_candidates' AND p.prokind = 'f';
  IF def IS NULL THEN RAISE EXCEPTION 'mu_match_candidates not found'; END IF;
  IF position('SELECT state FROM cred' in def) = 0 THEN
    RAISE NOTICE 'no unqualified cred.state reference found; nothing to do';
    RETURN;
  END IF;
  def := replace(def, 'SELECT state FROM cred', 'SELECT cred.state FROM cred');
  EXECUTE def;
END $$;