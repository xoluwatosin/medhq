
DELETE FROM public.mu_document_extractions
 WHERE error ILIKE '%document text%';

DO $$
DECLARE d uuid;
BEGIN
  FOR d IN SELECT id FROM public.mu_documents
            WHERE classified_at IS NULL AND rejected = false
              AND coalesce(doc_kind,'other') <> 'cv'
  LOOP
    PERFORM private.mu_dispatch_document_parse(d);
  END LOOP;
END $$;
