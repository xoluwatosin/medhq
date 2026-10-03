
CREATE OR REPLACE FUNCTION public.mu_system_request_document(_person_id uuid, _doc_type text, _note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.mu_document_requests
     SET note = _note, due_by = current_date + 14, requested_by_name = 'System'
   WHERE person_id = _person_id AND doc_type = _doc_type AND status = 'open';
  IF NOT FOUND THEN
    INSERT INTO public.mu_document_requests (person_id, doc_type, note, due_by, requested_by_name)
    VALUES (_person_id, _doc_type, _note, current_date + 14, 'System');
    INSERT INTO public.mu_activity (person_id, actor_name, action, detail)
    VALUES (_person_id, 'System', 'documents_requested',
            jsonb_build_object('doc_types', ARRAY[_doc_type], 'note', _note));
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mu_system_request_document(uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mu_autosettle_documents(_limit integer DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record; v jsonb; ev text; accepted int := 0; held int := 0; asked int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  FOR r IN
    SELECT d.id, d.person_id FROM public.mu_documents d
     WHERE d.review_outcome = 'pending'
     ORDER BY d.created_at ASC
     LIMIT least(coalesce(_limit,500), 2000)
  LOOP
    v := public.mu_document_verdict(r.id);

    IF v->>'action' = 'accept' THEN
      UPDATE public.mu_documents
         SET review_outcome = 'accepted', hold_reason = NULL, review_reason = NULL, reviewed_at = now(),
             expires_at = coalesce(public.mu_loose_date(v->>'expires_at'), expires_at)
       WHERE id = r.id;
      FOR ev IN SELECT jsonb_array_elements_text(coalesce(v->'evidences','[]'::jsonb)) LOOP
        BEGIN
          PERFORM public.mu_attach_credential_document(r.person_id, ev, r.id, 'document');
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END LOOP;
      INSERT INTO public.mu_activity (person_id, actor_name, action, detail)
      VALUES (r.person_id, 'System', 'document_auto_accepted',
              jsonb_build_object('document_id', r.id, 'kind', v->>'kind'));
      accepted := accepted + 1;

    ELSIF v->>'action' = 'hold' THEN
      UPDATE public.mu_documents SET hold_reason = v->>'reason' WHERE id = r.id;
      held := held + 1;
      IF coalesce((v->>'ask')::boolean, false) THEN
        PERFORM public.mu_system_request_document(
          r.person_id, coalesce(v->>'kind','other'),
          v->>'reason' || ' Please upload a clear, current copy.');
        asked := asked + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('accepted', accepted, 'held', held, 'asked', asked);
END;
$$;

CREATE OR REPLACE FUNCTION public.mu_settle_after_read()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v jsonb; ev text;
BEGIN
  v := public.mu_document_verdict(NEW.document_id);
  IF v->>'action' = 'accept' THEN
    UPDATE public.mu_documents
       SET review_outcome = 'accepted', hold_reason = NULL, reviewed_at = now(),
           expires_at = coalesce(public.mu_loose_date(v->>'expires_at'), expires_at)
     WHERE id = NEW.document_id AND review_outcome = 'pending';
    FOR ev IN SELECT jsonb_array_elements_text(coalesce(v->'evidences','[]'::jsonb)) LOOP
      BEGIN
        PERFORM public.mu_attach_credential_document(NEW.person_id, ev, NEW.document_id, 'document');
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END LOOP;
  ELSIF v->>'action' = 'hold' THEN
    UPDATE public.mu_documents SET hold_reason = v->>'reason'
     WHERE id = NEW.document_id AND review_outcome = 'pending';
    IF coalesce((v->>'ask')::boolean, false) THEN
      PERFORM public.mu_system_request_document(NEW.person_id, coalesce(v->>'kind','other'),
        v->>'reason' || ' Please upload a clear, current copy.');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

SELECT public.mu_autosettle_documents(2000);
