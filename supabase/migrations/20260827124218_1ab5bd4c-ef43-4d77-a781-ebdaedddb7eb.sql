CREATE OR REPLACE FUNCTION public.mu_reclassify_document(_document_id uuid, _doc_type text, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor text;
  old_type text;
  pid uuid;
  old_label text;
  new_label text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  IF coalesce(btrim(_doc_type), '') = '' THEN
    RAISE EXCEPTION 'A document kind is required';
  END IF;

  SELECT person_id, doc_type, label
    INTO pid, old_type, old_label
  FROM public.mu_documents
  WHERE id = _document_id;

  IF pid IS NULL THEN
    RAISE EXCEPTION 'That document could not be found';
  END IF;

  SELECT coalesce(display_name, email)
    INTO actor
  FROM public.admin_permissions
  WHERE user_id = auth.uid()
  LIMIT 1;

  new_label := CASE
    WHEN old_type IS NOT NULL AND old_label LIKE old_type || ' — %'
      THEN _doc_type || ' — ' || substr(old_label, length(old_type) + 4)
    ELSE old_label
  END;

  UPDATE public.mu_documents
  SET doc_type = _doc_type,
      label = new_label
  WHERE id = _document_id;

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (
    pid,
    auth.uid(),
    coalesce(actor, 'Administrator'),
    'document_reclassified',
    jsonb_build_object(
      'document_id', _document_id,
      'from', old_type,
      'to', _doc_type,
      'reason', nullif(btrim(coalesce(_reason, '')), '')
    )
  );

  PERFORM public.mu_derive_verification(pid);

  RETURN jsonb_build_object('document_id', _document_id, 'doc_type', _doc_type);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_reclassify_document(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_reclassify_document(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_reclassify_document(uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';