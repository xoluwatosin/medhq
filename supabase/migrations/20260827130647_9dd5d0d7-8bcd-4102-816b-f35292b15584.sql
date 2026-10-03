CREATE OR REPLACE FUNCTION public.mu_guess_doc_kind(_label text, _url text DEFAULT ''::text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN lower(coalesce(_label,'') || ' ' || coalesce(_url,'')) ~ '(identity document|passport|\ynin\y|national id|voter|driver|\yid\y)' THEN 'ID'
    WHEN lower(coalesce(_label,'') || ' ' || coalesce(_url,'')) ~ '(licen[cs]e|practis|nmcn|mdcn|\ypcn\y|registration)' THEN 'Licence'
    WHEN lower(coalesce(_label,'') || ' ' || coalesce(_url,'')) ~ '(nysc|qualification certificate|certificate|\ycert\y|diploma|degree|\ybls\y|\yacls\y|training)' THEN 'Certificate'
    WHEN lower(coalesce(_label,'') || ' ' || coalesce(_url,'')) ~ '(reference|referee|recommendation)' THEN 'Reference'
    WHEN lower(coalesce(_label,'') || ' ' || coalesce(_url,'')) ~ '(\ycv\y|resume|curriculum)' THEN 'CV'
    ELSE 'Other'
  END
$$;

GRANT EXECUTE ON FUNCTION public.mu_guess_doc_kind(text, text) TO authenticated, service_role, anon;

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

  SELECT count(*) INTO n_label
  FROM public.mu_documents
  WHERE public.mu_tidy_label(label) IS DISTINCT FROM label;

  SELECT count(*) INTO n_kind
  FROM public.mu_documents
  WHERE coalesce(doc_type, 'Other') = 'Other'
    AND public.mu_guess_doc_kind(label, url) <> 'Other';

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
        OR (coalesce(doc_type,'Other') = 'Other' AND public.mu_guess_doc_kind(label, url) <> 'Other')
  LOOP
    touched := touched || r.person_id;
  END LOOP;

  UPDATE public.mu_documents
     SET label = public.mu_tidy_label(label)
   WHERE public.mu_tidy_label(label) IS DISTINCT FROM label;

  UPDATE public.mu_documents
     SET doc_type = public.mu_guess_doc_kind(label, url)
   WHERE coalesce(doc_type, 'Other') = 'Other'
     AND public.mu_guess_doc_kind(label, url) <> 'Other';

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