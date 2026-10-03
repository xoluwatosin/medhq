-- People whose newest CV read predates the full-extraction parser.
CREATE OR REPLACE FUNCTION private.mu_reparse_batch(_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN
    SELECT p.id
      FROM public.mu_people p
     WHERE EXISTS (SELECT 1 FROM public.mu_documents d WHERE d.person_id = p.id AND d.doc_type = 'CV')
       AND NOT EXISTS (
         SELECT 1 FROM public.mu_cv_parses c
          WHERE c.person_id = p.id
            AND coalesce(c.extraction, '{}'::jsonb) <> '{}'::jsonb)
       AND (p.parse_last_attempt_at IS NULL OR p.parse_last_attempt_at < now() - interval '20 minutes')
     ORDER BY p.last_activity_at DESC
     LIMIT greatest(coalesce(_limit, 20), 1)
  LOOP
    UPDATE public.mu_people
       SET parse_status = 'queued',
           parse_last_attempt_at = now(),
           parse_document_id = coalesce(parse_document_id, (
             SELECT d.id FROM public.mu_documents d
              WHERE d.person_id = r.id AND d.doc_type = 'CV'
              ORDER BY d.created_at DESC LIMIT 1))
     WHERE id = r.id;
    PERFORM private.mu_dispatch_parse(r.id);
    n := n + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'dispatched', n);
END;
$$;

SELECT cron.unschedule('mu-reparse-pool') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'mu-reparse-pool');

SELECT cron.schedule('mu-reparse-pool', '*/5 * * * *', $$SELECT private.mu_reparse_batch(20)$$);

SELECT private.mu_reparse_batch(20);