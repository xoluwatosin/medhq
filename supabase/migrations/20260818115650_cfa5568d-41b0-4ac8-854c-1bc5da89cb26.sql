
-- Send one document to the reader. Same shared-secret pattern as the CV parser.
CREATE OR REPLACE FUNCTION private.mu_dispatch_document_parse(_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_url text;
  secret text;
BEGIN
  SELECT value INTO base_url FROM private.app_config WHERE key = 'functions_url';
  SELECT value INTO secret   FROM private.app_config WHERE key = 'parse_cv_cron_secret';
  IF base_url IS NULL OR secret IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := base_url || '/parse-document',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := jsonb_build_object('document_id', _document_id)
  );
END;
$$;

-- Anything that is not a CV goes to the document reader on upload.
CREATE OR REPLACE FUNCTION public.mu_queue_document_parse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.doc_kind, 'other') = 'cv' OR NEW.rejected THEN
    RETURN NEW;
  END IF;
  PERFORM private.mu_dispatch_document_parse(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER mu_documents_queue_parse
  AFTER INSERT ON public.mu_documents
  FOR EACH ROW EXECUTE FUNCTION public.mu_queue_document_parse();

-- Catch-up sweep: oldest unread first, a handful at a time.
CREATE OR REPLACE FUNCTION private.mu_sweep_document_parses(_limit integer DEFAULT 10)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
  n integer := 0;
BEGIN
  FOR d IN
    SELECT id FROM public.mu_documents
     WHERE classified_at IS NULL
       AND rejected = false
       AND coalesce(doc_kind, 'other') <> 'cv'
     ORDER BY created_at
     LIMIT greatest(1, least(_limit, 25))
  LOOP
    PERFORM private.mu_dispatch_document_parse(d.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

SELECT cron.schedule(
  'mu-document-parse-sweep',
  '*/15 * * * *',
  $$SELECT private.mu_sweep_document_parses(10)$$
);

-- What the reader has got through, and where it disagreed with the file name.
CREATE OR REPLACE FUNCTION public.mu_document_reading_health()
RETURNS TABLE (
  metric text,
  value bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'documents_total', count(*) FROM public.mu_documents WHERE rejected = false
  UNION ALL
  SELECT 'read', count(*) FROM public.mu_documents WHERE rejected = false AND classified_at IS NOT NULL
  UNION ALL
  SELECT 'awaiting_read', count(*) FROM public.mu_documents
   WHERE rejected = false AND classified_at IS NULL AND coalesce(doc_kind,'other') <> 'cv'
  UNION ALL
  SELECT 'reclassified_by_content', count(*) FROM public.mu_documents d
   JOIN public.mu_document_extractions e ON e.document_id = d.id
   WHERE d.doc_kind_source = 'content' AND e.doc_type <> public.mu_doc_kind_guess(d.label, d.url)
  UNION ALL
  SELECT 'low_confidence_kind', count(*) FROM public.mu_documents
   WHERE doc_kind_source = 'content' AND doc_kind_confidence < 0.7
  UNION ALL
  SELECT 'read_failed', count(*) FROM public.mu_document_extractions WHERE error IS NOT NULL
  UNION ALL
  SELECT 'name_mismatch', count(*) FROM public.mu_document_extractions
   WHERE (quality->>'belongs_to_holder') = 'false';
$$;
REVOKE EXECUTE ON FUNCTION public.mu_document_reading_health() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mu_document_reading_health() TO authenticated;
