-- 1. Document lifecycle columns -------------------------------------------
ALTER TABLE public.mu_documents
  ADD COLUMN IF NOT EXISTS doc_type text,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS uploaded_by_name text,
  ADD COLUMN IF NOT EXISTS source_note text,
  ADD COLUMN IF NOT EXISTS review_outcome text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.mu_documents DROP CONSTRAINT IF EXISTS mu_documents_review_outcome_chk;
ALTER TABLE public.mu_documents
  ADD CONSTRAINT mu_documents_review_outcome_chk
  CHECK (review_outcome IN ('pending', 'accepted', 'rejected'));

-- Classify a document from its label / stored path. Mirrors docTypeOf in the app.
CREATE OR REPLACE FUNCTION public.mu_doc_type(_label text, _url text DEFAULT '')
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN lower(coalesce(_label,'') || ' ' || coalesce(_url,'')) ~ '(\ycv\y|resume|curriculum)' THEN 'CV'
    WHEN lower(coalesce(_label,'') || ' ' || coalesce(_url,'')) ~ '(licen[cs]e|practis|nmcn|mdcn|pcn|registration)' THEN 'Licence'
    WHEN lower(coalesce(_label,'') || ' ' || coalesce(_url,'')) ~ '(certificate|\ycert\y|diploma|degree|bls|acls|training)' THEN 'Certificate'
    WHEN lower(coalesce(_label,'') || ' ' || coalesce(_url,'')) ~ '(passport|nin|national id|\yid\y|voter|driver)' THEN 'ID'
    WHEN lower(coalesce(_label,'') || ' ' || coalesce(_url,'')) ~ '(reference|referee|recommendation)' THEN 'Reference'
    ELSE 'Other'
  END
$$;

UPDATE public.mu_documents
   SET review_outcome = CASE WHEN verified THEN 'accepted' WHEN rejected THEN 'rejected' ELSE 'pending' END,
       doc_type = coalesce(doc_type, public.mu_doc_type(label, url));

-- verified / rejected are now derived from the review outcome, never set directly.
CREATE OR REPLACE FUNCTION public.mu_documents_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.doc_type := coalesce(NEW.doc_type, public.mu_doc_type(NEW.label, NEW.url));
  IF TG_OP = 'UPDATE' AND NEW.review_outcome IS DISTINCT FROM OLD.review_outcome
     AND NEW.review_outcome <> 'pending' AND NEW.reviewed_at IS NULL THEN
    NEW.reviewed_at := now();
  END IF;
  NEW.verified := (NEW.review_outcome = 'accepted');
  NEW.rejected := (NEW.review_outcome = 'rejected');
  IF NEW.review_outcome = 'accepted' THEN
    NEW.verified_at := coalesce(NEW.verified_at, NEW.reviewed_at, now());
    NEW.verified_by := coalesce(NEW.verified_by, NEW.reviewed_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mu_documents_sync ON public.mu_documents;
CREATE TRIGGER mu_documents_sync BEFORE INSERT OR UPDATE ON public.mu_documents
  FOR EACH ROW EXECUTE FUNCTION public.mu_documents_sync();

-- 2. Required document set --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mu_required_documents (
  doc_type text PRIMARY KEY,
  label text NOT NULL,
  helper text,
  rule text NOT NULL DEFAULT 'always',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mu_required_documents TO authenticated;
GRANT ALL ON public.mu_required_documents TO service_role;
ALTER TABLE public.mu_required_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone signed in can read required documents" ON public.mu_required_documents;
CREATE POLICY "Anyone signed in can read required documents"
  ON public.mu_required_documents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage required documents" ON public.mu_required_documents;
CREATE POLICY "Admins manage required documents"
  ON public.mu_required_documents FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS mu_required_documents_updated_at ON public.mu_required_documents;
CREATE TRIGGER mu_required_documents_updated_at BEFORE UPDATE ON public.mu_required_documents
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

INSERT INTO public.mu_required_documents (doc_type, label, helper, rule, sort_order)
VALUES
  ('CV', 'Curriculum vitae', 'An up to date CV covering your recent roles.', 'always', 1),
  ('ID', 'Identity document', 'A clear photo of your NIN slip, passport or driver licence.', 'always', 2),
  ('Certificate', 'Qualification certificate', 'Your highest relevant qualification or training certificate.', 'always', 3),
  ('Licence', 'Licence to practise', 'Your current practising licence, showing the expiry date.', 'licensed_only', 4)
ON CONFLICT (doc_type) DO NOTHING;

-- 3. Per person requirement status -----------------------------------------
CREATE OR REPLACE FUNCTION public.mu_document_status(_person_id uuid)
RETURNS TABLE (
  doc_type text, label text, helper text, required boolean, status text,
  document_id uuid, document_label text, document_url text,
  expires_at date, review_reason text, reviewed_at timestamptz, source_note text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prof text;
BEGIN
  SELECT p.profession INTO prof FROM public.mu_people p WHERE p.id = _person_id;

  RETURN QUERY
  WITH req AS (
    SELECT r.doc_type, r.label, r.helper, r.sort_order,
           (r.rule = 'always' OR (r.rule = 'licensed_only' AND public.mu_expects_licence(prof))) AS required
      FROM public.mu_required_documents r
     WHERE r.active
  ),
  best AS (
    SELECT DISTINCT ON (d.doc_type)
           d.doc_type, d.id, d.label, d.url, d.expires_at, d.review_reason,
           d.reviewed_at, d.source_note, d.review_outcome
      FROM public.mu_documents d
     WHERE d.person_id = _person_id
     ORDER BY d.doc_type,
              CASE d.review_outcome WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
              d.created_at DESC
  )
  SELECT req.doc_type, req.label, req.helper, req.required,
         CASE
           WHEN b.id IS NULL THEN 'missing'
           WHEN b.review_outcome = 'accepted' AND b.expires_at IS NOT NULL AND b.expires_at < current_date THEN 'expired'
           WHEN b.review_outcome = 'accepted' THEN 'accepted'
           WHEN b.review_outcome = 'rejected' THEN 'rejected'
           ELSE 'pending'
         END,
         b.id, b.label, b.url, b.expires_at, b.review_reason, b.reviewed_at, b.source_note
    FROM req LEFT JOIN best b ON b.doc_type = req.doc_type
   ORDER BY req.sort_order;
END;
$$;

REVOKE ALL ON FUNCTION public.mu_document_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_document_status(uuid) TO authenticated, service_role;

-- 4. Verified is derived, never chosen -------------------------------------
CREATE OR REPLACE FUNCTION public.mu_derive_verification(_person_id uuid, _gaps jsonb)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n_missing int; n_pending int; n_bad int;
BEGIN
  SELECT count(*) FILTER (WHERE s.status = 'missing'),
         count(*) FILTER (WHERE s.status = 'pending'),
         count(*) FILTER (WHERE s.status IN ('rejected', 'expired'))
    INTO n_missing, n_pending, n_bad
    FROM public.mu_document_status(_person_id) s
   WHERE s.required;

  IF n_bad > 0 THEN RETURN 'failed'; END IF;
  IF n_missing = 0 AND n_pending = 0 AND coalesce(jsonb_array_length(coalesce(_gaps, '[]'::jsonb)), 0) = 0 THEN
    RETURN 'verified';
  END IF;
  IF n_pending > 0 THEN RETURN 'in_review'; END IF;
  RETURN 'unverified';
END;
$$;

REVOKE ALL ON FUNCTION public.mu_derive_verification(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_derive_verification(uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mu_people_derive_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.verification_state := 'unverified';
  ELSE
    NEW.verification_state := public.mu_derive_verification(NEW.id, NEW.candidate_gaps);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zzz_mu_people_derive_verification ON public.mu_people;
CREATE TRIGGER zzz_mu_people_derive_verification BEFORE INSERT OR UPDATE ON public.mu_people
  FOR EACH ROW EXECUTE FUNCTION public.mu_people_derive_verification();

CREATE OR REPLACE FUNCTION public.mu_documents_touch_person()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := coalesce(NEW.person_id, OLD.person_id);
BEGIN
  UPDATE public.mu_people SET updated_at = now() WHERE id = pid;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS mu_documents_touch_person ON public.mu_documents;
CREATE TRIGGER mu_documents_touch_person AFTER INSERT OR UPDATE OR DELETE ON public.mu_documents
  FOR EACH ROW EXECUTE FUNCTION public.mu_documents_touch_person();

-- 5. Admin actions ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mu_admin_upload_document(
  _person_id uuid, _label text, _url text, _doc_type text, _source_note text, _expires_at date DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid; actor text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF coalesce(btrim(coalesce(_source_note, '')), '') = '' THEN
    RAISE EXCEPTION 'A source note is required so the trail shows where this document came from';
  END IF;

  SELECT coalesce(display_name, email) INTO actor FROM public.admin_permissions WHERE user_id = auth.uid() LIMIT 1;

  INSERT INTO public.mu_documents (person_id, source_table, label, url, doc_type, source_note, uploaded_by, uploaded_by_name, expires_at)
  VALUES (_person_id, 'admin_upload', _label, _url, _doc_type, btrim(_source_note), auth.uid(), actor, _expires_at)
  RETURNING id INTO new_id;

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (_person_id, auth.uid(), actor, 'document_uploaded_by_admin',
          jsonb_build_object('document_id', new_id, 'label', _label, 'doc_type', _doc_type, 'source_note', btrim(_source_note)));

  RETURN jsonb_build_object('document_id', new_id);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_admin_upload_document(uuid, text, text, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_admin_upload_document(uuid, text, text, text, text, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mu_review_document(
  _document_id uuid, _outcome text, _reason text DEFAULT NULL, _expires_at date DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.mu_documents; actor text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF _outcome NOT IN ('accepted', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'Unknown review outcome %', _outcome;
  END IF;
  IF _outcome = 'rejected' AND coalesce(btrim(coalesce(_reason, '')), '') = '' THEN
    RAISE EXCEPTION 'A reason is required when a document is rejected';
  END IF;

  SELECT coalesce(display_name, email) INTO actor FROM public.admin_permissions WHERE user_id = auth.uid() LIMIT 1;

  UPDATE public.mu_documents
     SET review_outcome = _outcome,
         review_reason = CASE WHEN _outcome = 'rejected' THEN btrim(_reason) ELSE NULL END,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         expires_at = coalesce(_expires_at, expires_at)
   WHERE id = _document_id
   RETURNING * INTO d;

  IF d.id IS NULL THEN RAISE EXCEPTION 'Document not found'; END IF;

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (d.person_id, auth.uid(), actor, 'document_' || _outcome,
          jsonb_build_object('document_id', d.id, 'label', d.label, 'doc_type', d.doc_type, 'reason', d.review_reason));

  RETURN jsonb_build_object('person_id', d.person_id, 'doc_type', d.doc_type, 'label', d.label, 'reason', d.review_reason);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_review_document(uuid, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_review_document(uuid, text, text, date) TO authenticated, service_role;

-- 6. Resolving a flagged difference between an application and the profile --
CREATE OR REPLACE FUNCTION public.mu_resolve_field_conflict(_conflict_id uuid, _action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.mu_field_conflicts; actor text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF _action NOT IN ('accept', 'revert') THEN
    RAISE EXCEPTION 'Unknown action %', _action;
  END IF;

  SELECT * INTO c FROM public.mu_field_conflicts WHERE id = _conflict_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Conflict not found'; END IF;

  SELECT coalesce(display_name, email) INTO actor FROM public.admin_permissions WHERE user_id = auth.uid() LIMIT 1;

  IF _action = 'revert' AND c.field IN ('profession','current_position','state','lga','licensing_body','license_number','phone','email') THEN
    EXECUTE format('UPDATE public.mu_people SET %I = $1 WHERE id = $2', c.field)
      USING c.stored_value, c.person_id;
  ELSIF _action = 'revert' AND c.field = 'years_experience' THEN
    UPDATE public.mu_people SET years_experience = nullif(c.stored_value, '')::int WHERE id = c.person_id;
  END IF;

  UPDATE public.mu_field_conflicts SET status = CASE WHEN _action = 'accept' THEN 'accepted' ELSE 'reverted' END,
         updated_at = now()
   WHERE id = _conflict_id;

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (c.person_id, auth.uid(), actor, 'field_conflict_' || _action,
          jsonb_build_object('field', c.field, 'stored_value', c.stored_value, 'parsed_value', c.parsed_value));

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.mu_resolve_field_conflict(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_resolve_field_conflict(uuid, text) TO authenticated, service_role;

-- 7. Recompute every existing person's verified state -----------------------
UPDATE public.mu_people SET updated_at = now();