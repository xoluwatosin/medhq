
-- 1. Referee states -----------------------------------------------------
ALTER TABLE public.mu_references
  ADD CONSTRAINT mu_references_status_check
  CHECK (status IN ('offered','taken_up','unreachable','declined'));

DROP TRIGGER IF EXISTS mu_references_updated_at ON public.mu_references;
CREATE TRIGGER mu_references_updated_at
BEFORE UPDATE ON public.mu_references
FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- 2. Label tidying ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mu_tidy_label(_label text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parts text[];
  seen text[] := '{}';
  out_parts text[] := '{}';
  seg text;
  s text;
BEGIN
  s := btrim(regexp_replace(coalesce(_label,''), '\s+', ' ', 'g'));
  IF s = '' THEN RETURN s; END IF;

  parts := string_to_array(s, ' — ');
  FOREACH seg IN ARRAY parts LOOP
    seg := btrim(seg);
    CONTINUE WHEN seg = '';
    -- one common name for the same thing
    IF lower(seg) IN ('cv/resume','resume','curriculum vitae','cv') THEN seg := 'CV'; END IF;
    IF NOT (lower(seg) = ANY (seen)) THEN
      seen := seen || lower(seg);
      out_parts := out_parts || seg;
    END IF;
  END LOOP;

  RETURN array_to_string(out_parts, ' — ');
END;
$$;

-- 3. Repeat uploads fold into history ------------------------------------
CREATE OR REPLACE FUNCTION public.mu_supersede_repeat_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.mu_documents d
     SET superseded_at = now(), superseded_by = NEW.id
   WHERE d.person_id = NEW.person_id
     AND d.id <> NEW.id
     AND d.superseded_at IS NULL
     AND coalesce(d.review_outcome, 'pending') <> 'accepted'
     AND coalesce(d.doc_type, public.mu_doc_type(d.label, d.url))
         IS NOT DISTINCT FROM coalesce(NEW.doc_type, public.mu_doc_type(NEW.label, NEW.url))
     AND lower(public.mu_tidy_label(d.label)) = lower(public.mu_tidy_label(NEW.label))
     AND d.created_at <= NEW.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mu_documents_supersede_repeats ON public.mu_documents;
CREATE TRIGGER mu_documents_supersede_repeats
AFTER INSERT ON public.mu_documents
FOR EACH ROW EXECUTE FUNCTION public.mu_supersede_repeat_documents();

-- 4. The tidy-up routine --------------------------------------------------
CREATE OR REPLACE FUNCTION public.mu_tidy_documents(_apply boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor text;
  n_label int := 0;
  n_kind int := 0;
  n_dupe int := 0;
  touched uuid[] := '{}';
  r record;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT coalesce(display_name, email) INTO actor
  FROM public.admin_permissions WHERE user_id = auth.uid() LIMIT 1;

  -- a. names that repeat themselves
  SELECT count(*) INTO n_label
  FROM public.mu_documents
  WHERE public.mu_tidy_label(label) IS DISTINCT FROM label;

  -- b. sitting in Other but the file name says otherwise
  SELECT count(*) INTO n_kind
  FROM public.mu_documents
  WHERE coalesce(doc_type, 'Other') = 'Other'
    AND public.mu_doc_type(label, url) <> 'Other';

  -- c. repeat uploads of the same document
  SELECT count(*) INTO n_dupe
  FROM (
    SELECT d.id,
           row_number() OVER (
             PARTITION BY d.person_id,
                          coalesce(d.doc_type, public.mu_doc_type(d.label, d.url)),
                          lower(public.mu_tidy_label(d.label))
             ORDER BY (coalesce(d.review_outcome,'pending') = 'accepted') DESC, d.created_at DESC
           ) rn
      FROM public.mu_documents d
     WHERE d.superseded_at IS NULL
  ) x WHERE x.rn > 1;

  IF NOT _apply THEN
    RETURN jsonb_build_object('applied', false, 'labels', n_label, 'kinds', n_kind, 'repeats', n_dupe);
  END IF;

  FOR r IN
    SELECT DISTINCT person_id FROM public.mu_documents
     WHERE public.mu_tidy_label(label) IS DISTINCT FROM label
        OR (coalesce(doc_type,'Other') = 'Other' AND public.mu_doc_type(label, url) <> 'Other')
  LOOP
    touched := touched || r.person_id;
  END LOOP;

  UPDATE public.mu_documents
     SET label = public.mu_tidy_label(label)
   WHERE public.mu_tidy_label(label) IS DISTINCT FROM label;

  UPDATE public.mu_documents
     SET doc_type = public.mu_doc_type(label, url)
   WHERE coalesce(doc_type, 'Other') = 'Other'
     AND public.mu_doc_type(label, url) <> 'Other';

  WITH ranked AS (
    SELECT d.id, d.person_id,
           first_value(d.id) OVER (
             PARTITION BY d.person_id,
                          coalesce(d.doc_type, public.mu_doc_type(d.label, d.url)),
                          lower(public.mu_tidy_label(d.label))
             ORDER BY (coalesce(d.review_outcome,'pending') = 'accepted') DESC, d.created_at DESC
           ) keeper
      FROM public.mu_documents d
     WHERE d.superseded_at IS NULL
  )
  UPDATE public.mu_documents d
     SET superseded_at = now(), superseded_by = ranked.keeper
    FROM ranked
   WHERE d.id = ranked.id AND ranked.keeper <> d.id;

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  SELECT DISTINCT p, auth.uid(), coalesce(actor, 'Administrator'), 'documents_tidied',
         jsonb_build_object('labels', n_label, 'kinds', n_kind, 'repeats', n_dupe)
    FROM unnest(touched) AS p;

  FOR r IN SELECT DISTINCT p AS person_id FROM unnest(touched) AS p LOOP
    BEGIN
      PERFORM public.mu_derive_verification(r.person_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object('applied', true, 'labels', n_label, 'kinds', n_kind, 'repeats', n_dupe);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_tidy_documents(boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mu_tidy_documents(boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mu_tidy_label(text) TO authenticated, service_role, anon;
