-- Remove the abandoned care/clinical module.
-- Verified before writing: no views, no incoming foreign keys, no RLS policies
-- and no application code reference clinical.* or the clinical_* RPCs.
DROP FUNCTION IF EXISTS public.clinical_client_list(text, text, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.clinical_client_get(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.clinical_client_create(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.clinical_client_update(uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.clinical_client_set_stage(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.clinical_client_counts() CASCADE;
DROP FUNCTION IF EXISTS public.clinical_audit_list(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.clinical_staff_list(integer) CASCADE;
DROP FUNCTION IF EXISTS public.clinical_log(uuid, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.clinical_me() CASCADE;
DROP FUNCTION IF EXISTS public.clinical_is_staff() CASCADE;
DROP FUNCTION IF EXISTS public.clinical_session_ok() CASCADE;
DROP FUNCTION IF EXISTS public.clinical_has_aal2() CASCADE;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'clinical\_%'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;

DROP SCHEMA IF EXISTS clinical CASCADE;
