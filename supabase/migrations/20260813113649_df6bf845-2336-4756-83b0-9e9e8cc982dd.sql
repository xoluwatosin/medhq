-- 1. DOCUMENT REQUESTS -------------------------------------------------------
CREATE TABLE public.mu_document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  note text,
  due_by date,
  requested_by uuid,
  requested_by_name text,
  status text NOT NULL DEFAULT 'open',
  fulfilled_document_id uuid REFERENCES public.mu_documents(id) ON DELETE SET NULL,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mu_document_requests_person_idx ON public.mu_document_requests (person_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_document_requests TO authenticated;
GRANT ALL ON public.mu_document_requests TO service_role;

ALTER TABLE public.mu_document_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage document requests"
  ON public.mu_document_requests FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Candidates see their own document requests"
  ON public.mu_document_requests FOR SELECT TO authenticated
  USING (person_id = public.mu_my_person_id());

CREATE TRIGGER mu_document_requests_touch
  BEFORE UPDATE ON public.mu_document_requests
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- Close the loop: a document arriving satisfies any open request for its type.
CREATE OR REPLACE FUNCTION public.mu_close_document_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _type text;
  _closed int;
BEGIN
  _type := COALESCE(NEW.doc_type, public.mu_doc_type(NEW.label, NEW.url));
  IF _type IS NULL THEN RETURN NEW; END IF;

  UPDATE public.mu_document_requests
     SET status = 'fulfilled',
         fulfilled_document_id = NEW.id,
         fulfilled_at = now()
   WHERE person_id = NEW.person_id
     AND status = 'open'
     AND doc_type = _type;

  GET DIAGNOSTICS _closed = ROW_COUNT;

  IF _closed > 0 THEN
    INSERT INTO public.mu_activity (person_id, action, detail)
    VALUES (NEW.person_id, 'document_request_fulfilled',
            jsonb_build_object('doc_type', _type, 'document_id', NEW.id, 'closed', _closed));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER mu_documents_close_requests
  AFTER INSERT ON public.mu_documents
  FOR EACH ROW EXECUTE FUNCTION public.mu_close_document_requests();

-- Admin raises a request (idempotent per open doc_type).
CREATE OR REPLACE FUNCTION public.mu_request_documents(
  _person_id uuid,
  _doc_types text[],
  _note text DEFAULT NULL,
  _due_by date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _t text;
  _name text;
  _created int := 0;
  _updated int := 0;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF _doc_types IS NULL OR array_length(_doc_types, 1) IS NULL THEN
    RETURN jsonb_build_object('created', 0, 'updated', 0);
  END IF;

  SELECT COALESCE(display_name, email) INTO _name
    FROM public.admin_permissions WHERE user_id = auth.uid() LIMIT 1;

  FOREACH _t IN ARRAY _doc_types LOOP
    UPDATE public.mu_document_requests
       SET note = COALESCE(_note, note),
           due_by = COALESCE(_due_by, due_by),
           requested_by = auth.uid(),
           requested_by_name = COALESCE(_name, requested_by_name)
     WHERE person_id = _person_id AND doc_type = _t AND status = 'open';
    IF FOUND THEN
      _updated := _updated + 1;
    ELSE
      INSERT INTO public.mu_document_requests
        (person_id, doc_type, note, due_by, requested_by, requested_by_name)
      VALUES (_person_id, _t, _note, _due_by, auth.uid(), _name);
      _created := _created + 1;
    END IF;
  END LOOP;

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (_person_id, auth.uid(), _name, 'documents_requested',
          jsonb_build_object('doc_types', _doc_types, 'note', _note, 'due_by', _due_by));

  RETURN jsonb_build_object('created', _created, 'updated', _updated);
END;
$$;

CREATE OR REPLACE FUNCTION public.mu_cancel_document_request(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.mu_document_requests;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  UPDATE public.mu_document_requests
     SET status = 'cancelled', cancelled_at = now()
   WHERE id = _id AND status = 'open'
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;

  INSERT INTO public.mu_activity (person_id, actor_id, action, detail)
  VALUES (_row.person_id, auth.uid(), 'document_request_cancelled',
          jsonb_build_object('doc_type', _row.doc_type));

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_request_documents(uuid, text[], text, date) FROM anon;
REVOKE ALL ON FUNCTION public.mu_cancel_document_request(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mu_request_documents(uuid, text[], text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_cancel_document_request(uuid) TO authenticated;

-- 2. WORK PREFERENCES ---------------------------------------------------------
CREATE TABLE public.mu_work_preferences (
  person_id uuid PRIMARY KEY REFERENCES public.mu_people(id) ON DELETE CASCADE,
  care_types text[] NOT NULL DEFAULT '{}',
  live_in text NOT NULL DEFAULT 'unknown',
  shift_patterns text[] NOT NULL DEFAULT '{}',
  engagement_types text[] NOT NULL DEFAULT '{}',
  travel_states text[] NOT NULL DEFAULT '{}',
  travel_lgas text[] NOT NULL DEFAULT '{}',
  max_travel_minutes integer,
  willing_to_relocate boolean,
  notice_period text,
  notes text,
  updated_by uuid,
  updated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_work_preferences TO authenticated;
GRANT ALL ON public.mu_work_preferences TO service_role;

ALTER TABLE public.mu_work_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage work preferences"
  ON public.mu_work_preferences FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Candidates read their own preferences"
  ON public.mu_work_preferences FOR SELECT TO authenticated
  USING (person_id = public.mu_my_person_id());

CREATE POLICY "Candidates create their own preferences"
  ON public.mu_work_preferences FOR INSERT TO authenticated
  WITH CHECK (person_id = public.mu_my_person_id());

CREATE POLICY "Candidates update their own preferences"
  ON public.mu_work_preferences FOR UPDATE TO authenticated
  USING (person_id = public.mu_my_person_id())
  WITH CHECK (person_id = public.mu_my_person_id());

CREATE TRIGGER mu_work_preferences_touch
  BEFORE UPDATE ON public.mu_work_preferences
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- Preference edits belong on the trail like everything else.
CREATE OR REPLACE FUNCTION public.mu_work_preferences_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (NEW.person_id, auth.uid(), NEW.updated_by_name, 'work_preferences_updated',
          jsonb_build_object(
            'care_types', NEW.care_types,
            'live_in', NEW.live_in,
            'shift_patterns', NEW.shift_patterns,
            'engagement_types', NEW.engagement_types));
  UPDATE public.mu_people SET last_activity_at = now() WHERE id = NEW.person_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mu_work_preferences_audit_trg
  AFTER INSERT OR UPDATE ON public.mu_work_preferences
  FOR EACH ROW EXECUTE FUNCTION public.mu_work_preferences_audit();