CREATE OR REPLACE FUNCTION public.mu_sync_join_documents()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.person_id IS NOT NULL AND coalesce(NEW.cv_url,'') <> '' THEN
    INSERT INTO public.mu_documents (person_id, source_table, source_id, label, url)
    SELECT NEW.person_id, 'join_applications', NEW.id, 'CV', NEW.cv_url
    WHERE NOT EXISTS (
      SELECT 1 FROM public.mu_documents d
       WHERE d.person_id = NEW.person_id AND d.url = NEW.cv_url
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mu_sync_matchmaker_documents()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE k text; v text;
BEGIN
  IF NEW.person_id IS NULL OR NEW.documents IS NULL OR jsonb_typeof(NEW.documents) <> 'object' THEN
    RETURN NEW;
  END IF;
  FOR k, v IN SELECT key, value #>> '{}' FROM jsonb_each(NEW.documents) LOOP
    IF coalesce(v,'') <> '' THEN
      INSERT INTO public.mu_documents (person_id, source_table, source_id, label, url)
      SELECT NEW.person_id, 'matchmaker_applications', NEW.id, k, v
      WHERE NOT EXISTS (
        SELECT 1 FROM public.mu_documents d
         WHERE d.person_id = NEW.person_id AND d.url = v
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mu_sync_join_docs ON public.join_applications;
CREATE TRIGGER mu_sync_join_docs
AFTER INSERT OR UPDATE OF cv_url, person_id ON public.join_applications
FOR EACH ROW EXECUTE FUNCTION public.mu_sync_join_documents();

DROP TRIGGER IF EXISTS mu_sync_mm_docs ON public.matchmaker_applications;
CREATE TRIGGER mu_sync_mm_docs
AFTER INSERT OR UPDATE OF documents, person_id ON public.matchmaker_applications
FOR EACH ROW EXECUTE FUNCTION public.mu_sync_matchmaker_documents();

-- Backfill anything the one-off import missed
INSERT INTO public.mu_documents (person_id, source_table, source_id, label, url)
SELECT j.person_id, 'join_applications', j.id, 'CV', j.cv_url
  FROM public.join_applications j
 WHERE j.person_id IS NOT NULL AND coalesce(j.cv_url,'') <> ''
   AND NOT EXISTS (SELECT 1 FROM public.mu_documents d WHERE d.person_id = j.person_id AND d.url = j.cv_url);

INSERT INTO public.mu_documents (person_id, source_table, source_id, label, url)
SELECT m.person_id, 'matchmaker_applications', m.id, e.key, e.value #>> '{}'
  FROM public.matchmaker_applications m
  CROSS JOIN LATERAL jsonb_each(m.documents) e
 WHERE m.person_id IS NOT NULL AND jsonb_typeof(m.documents) = 'object'
   AND coalesce(e.value #>> '{}','') <> ''
   AND NOT EXISTS (SELECT 1 FROM public.mu_documents d WHERE d.person_id = m.person_id AND d.url = e.value #>> '{}');