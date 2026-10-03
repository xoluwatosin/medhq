-- Tranche 7: clinical review of the assessment, and the versioned care plan.

ALTER TABLE public.care_assessment_work
  ADD COLUMN IF NOT EXISTS review_decision text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'care_assessment_work_review_decision_check'
  ) THEN
    ALTER TABLE public.care_assessment_work
      ADD CONSTRAINT care_assessment_work_review_decision_check
      CHECK (review_decision IS NULL OR review_decision IN ('accepted','returned'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.care_clinical_ok()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT private.has_role(auth.uid(), 'admin'::app_role)
     AND private.has_admin_permission(auth.uid(), 'care_clinical')
$function$;

CREATE OR REPLACE FUNCTION private.care_document_freeze()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF OLD.kind NOT IN ('assessment','care_plan') THEN RETURN NEW; END IF;
  IF OLD.status IN ('submitted','superseded') THEN
    IF NEW.responses IS DISTINCT FROM OLD.responses THEN
      RAISE EXCEPTION 'That record has already been sent and cannot be changed';
    END IF;
    IF NEW.status = 'draft' THEN
      RAISE EXCEPTION 'That record has already been sent and cannot be reopened';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS care_documents_freeze ON public.care_documents;
CREATE TRIGGER care_documents_freeze
  BEFORE UPDATE ON public.care_documents
  FOR EACH ROW EXECUTE FUNCTION private.care_document_freeze();

INSERT INTO public.form_definitions (kind, version, status, definition, published_at)
SELECT 'care_plan', 1, 'published', jsonb_build_object(
  'kind', 'care_plan',
  'version', 1,
  'framework', true,
  'source', 'Medic Connect Care plan structure v1',
  'note', 'Structural only. The fourteen canonical sections are fixed. Needs, goals and tasks are held as structured records against this plan version.',
  'sections', (
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'order', s.ord,
      'mode', 'narrative',
      'fields', jsonb_build_array(jsonb_build_object(
        'id', 'note', 'type', 'textarea', 'record', s.title, 'required', false))
    ) ORDER BY s.ord)
    FROM (VALUES
      (1,'front_sheet','Front sheet'),
      (2,'goals','What we are trying to achieve'),
      (3,'the_day','The day'),
      (4,'the_week','The week'),
      (5,'personal_care','Personal care'),
      (6,'moving_about','Moving about'),
      (7,'skin_food_continence','Skin, food and continence'),
      (8,'medicines','Medicines'),
      (9,'how_to_be','How to be with this person'),
      (10,'risks','Risks and what we do about them'),
      (11,'boundaries','Boundaries'),
      (12,'who_is_coming','Who is coming'),
      (13,'review','Review'),
      (14,'agreement','Agreement')
    ) AS s(ord, id, title)
  )
), now()
WHERE NOT EXISTS (SELECT 1 FROM public.form_definitions WHERE kind = 'care_plan');

CREATE TABLE IF NOT EXISTS public.care_plan_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.care_documents(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  section_id text NOT NULL DEFAULT 'front_sheet',
  ordering integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  detail text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_plan_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.care_documents(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  need_id uuid REFERENCES public.care_plan_needs(id) ON DELETE SET NULL,
  ordering integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  detail text,
  measure text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_plan_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.care_documents(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES public.care_plan_goals(id) ON DELETE SET NULL,
  section_id text NOT NULL DEFAULT 'the_day',
  ordering integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  detail text,
  frequency text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_plan_needs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_plan_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_plan_tasks TO authenticated;
GRANT ALL ON public.care_plan_needs TO service_role;
GRANT ALL ON public.care_plan_goals TO service_role;
GRANT ALL ON public.care_plan_tasks TO service_role;

ALTER TABLE public.care_plan_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_plan_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_plan_tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS care_plan_needs_doc_idx ON public.care_plan_needs (document_id, ordering);
CREATE INDEX IF NOT EXISTS care_plan_goals_doc_idx ON public.care_plan_goals (document_id, ordering);
CREATE INDEX IF NOT EXISTS care_plan_tasks_doc_idx ON public.care_plan_tasks (document_id, ordering);

DROP POLICY IF EXISTS "Admins manage plan needs" ON public.care_plan_needs;
CREATE POLICY "Admins manage plan needs" ON public.care_plan_needs
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage plan goals" ON public.care_plan_goals;
CREATE POLICY "Admins manage plan goals" ON public.care_plan_goals
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage plan tasks" ON public.care_plan_tasks;
CREATE POLICY "Admins manage plan tasks" ON public.care_plan_tasks
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Clinical grant reads issued plan needs" ON public.care_plan_needs;
CREATE POLICY "Clinical grant reads issued plan needs" ON public.care_plan_needs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.care_documents d
                  WHERE d.id = document_id AND d.kind = 'care_plan' AND d.status = 'submitted'
                    AND private.care_has_scope(d.client_id, 'clinical')));

DROP POLICY IF EXISTS "Clinical grant reads issued plan goals" ON public.care_plan_goals;
CREATE POLICY "Clinical grant reads issued plan goals" ON public.care_plan_goals
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.care_documents d
                  WHERE d.id = document_id AND d.kind = 'care_plan' AND d.status = 'submitted'
                    AND private.care_has_scope(d.client_id, 'clinical')));

DROP POLICY IF EXISTS "Clinical grant reads issued plan tasks" ON public.care_plan_tasks;
CREATE POLICY "Clinical grant reads issued plan tasks" ON public.care_plan_tasks
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.care_documents d
                  WHERE d.id = document_id AND d.kind = 'care_plan' AND d.status = 'submitted'
                    AND private.care_has_scope(d.client_id, 'clinical')));

CREATE OR REPLACE FUNCTION private.care_plan_next_version(_client_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT 1 + COALESCE(MAX(version), 0) FROM public.care_documents
   WHERE client_id = _client_id AND kind = 'care_plan' AND status IN ('submitted','superseded');
$function$;

CREATE OR REPLACE FUNCTION private.care_plan_draft(_client_id uuid, _built_from uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _definition uuid; _doc uuid;
BEGIN
  SELECT id INTO _doc FROM public.care_documents
   WHERE client_id = _client_id AND kind = 'care_plan' AND status = 'draft';
  IF _doc IS NOT NULL THEN RETURN _doc; END IF;

  SELECT id INTO _definition FROM public.form_definitions
   WHERE kind = 'care_plan' AND status = 'published' ORDER BY version DESC LIMIT 1;
  IF _definition IS NULL THEN
    RAISE EXCEPTION 'The care plan structure has not been published yet';
  END IF;

  INSERT INTO public.care_documents
    (client_id, kind, form_definition_id, status, version, responses, built_from_id)
  VALUES (_client_id, 'care_plan', _definition, 'draft',
          private.care_plan_next_version(_client_id), '{}'::jsonb, _built_from)
  RETURNING id INTO _doc;
  RETURN _doc;
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_plan_save_section(_document_id uuid, _section_id text, _value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _d public.care_documents%ROWTYPE; _sections jsonb;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'Not allowed to write the care plan';
  END IF;
  SELECT * INTO _d FROM public.care_documents WHERE id = _document_id FOR UPDATE;
  IF NOT FOUND OR _d.kind <> 'care_plan' THEN RAISE EXCEPTION 'That care plan is not on record'; END IF;
  IF _d.status <> 'draft' THEN RAISE EXCEPTION 'That care plan version has already been issued'; END IF;

  SELECT definition -> 'sections' INTO _sections FROM public.form_definitions WHERE id = _d.form_definition_id;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_sections) s WHERE s ->> 'id' = _section_id) THEN
    RAISE EXCEPTION 'That is not a section of the care plan';
  END IF;

  UPDATE public.care_documents
     SET responses = COALESCE(responses, '{}'::jsonb) || jsonb_build_object(_section_id, COALESCE(_value, '{}'::jsonb)),
         updated_at = now()
   WHERE id = _document_id
   RETURNING responses INTO _sections;

  RETURN jsonb_build_object('ok', true, 'section_id', _section_id, 'saved', _sections -> _section_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_plan_item_save(_document_id uuid, _kind text, _id uuid, _payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _d public.care_documents%ROWTYPE; _out uuid; _title text;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'Not allowed to write the care plan';
  END IF;
  SELECT * INTO _d FROM public.care_documents WHERE id = _document_id;
  IF NOT FOUND OR _d.kind <> 'care_plan' THEN RAISE EXCEPTION 'That care plan is not on record'; END IF;
  IF _d.status <> 'draft' THEN RAISE EXCEPTION 'That care plan version has already been issued'; END IF;

  _title := NULLIF(btrim(COALESCE(_payload ->> 'title', '')), '');
  IF _title IS NULL THEN RAISE EXCEPTION 'A short title is needed'; END IF;

  IF _kind = 'need' THEN
    IF _id IS NULL THEN
      INSERT INTO public.care_plan_needs (document_id, client_id, section_id, ordering, title, detail, created_by)
      VALUES (_document_id, _d.client_id, COALESCE(_payload ->> 'section_id', 'front_sheet'),
              COALESCE((_payload ->> 'ordering')::int, 0), _title, _payload ->> 'detail', auth.uid())
      RETURNING id INTO _out;
    ELSE
      UPDATE public.care_plan_needs
         SET title = _title, detail = _payload ->> 'detail',
             section_id = COALESCE(_payload ->> 'section_id', section_id),
             ordering = COALESCE((_payload ->> 'ordering')::int, ordering), updated_at = now()
       WHERE id = _id AND document_id = _document_id RETURNING id INTO _out;
    END IF;
  ELSIF _kind = 'goal' THEN
    IF _id IS NULL THEN
      INSERT INTO public.care_plan_goals (document_id, client_id, need_id, ordering, title, detail, measure, created_by)
      VALUES (_document_id, _d.client_id, NULLIF(_payload ->> 'need_id','')::uuid,
              COALESCE((_payload ->> 'ordering')::int, 0), _title, _payload ->> 'detail', _payload ->> 'measure', auth.uid())
      RETURNING id INTO _out;
    ELSE
      UPDATE public.care_plan_goals
         SET title = _title, detail = _payload ->> 'detail', measure = _payload ->> 'measure',
             need_id = NULLIF(_payload ->> 'need_id','')::uuid,
             ordering = COALESCE((_payload ->> 'ordering')::int, ordering), updated_at = now()
       WHERE id = _id AND document_id = _document_id RETURNING id INTO _out;
    END IF;
  ELSIF _kind = 'task' THEN
    IF _id IS NULL THEN
      INSERT INTO public.care_plan_tasks (document_id, client_id, goal_id, section_id, ordering, title, detail, frequency, created_by)
      VALUES (_document_id, _d.client_id, NULLIF(_payload ->> 'goal_id','')::uuid,
              COALESCE(_payload ->> 'section_id', 'the_day'),
              COALESCE((_payload ->> 'ordering')::int, 0), _title, _payload ->> 'detail', _payload ->> 'frequency', auth.uid())
      RETURNING id INTO _out;
    ELSE
      UPDATE public.care_plan_tasks
         SET title = _title, detail = _payload ->> 'detail', frequency = _payload ->> 'frequency',
             goal_id = NULLIF(_payload ->> 'goal_id','')::uuid,
             section_id = COALESCE(_payload ->> 'section_id', section_id),
             ordering = COALESCE((_payload ->> 'ordering')::int, ordering), updated_at = now()
       WHERE id = _id AND document_id = _document_id RETURNING id INTO _out;
    END IF;
  ELSE
    RAISE EXCEPTION 'That is not part of a care plan';
  END IF;

  IF _out IS NULL THEN RAISE EXCEPTION 'That entry is not on this care plan version'; END IF;
  UPDATE public.care_documents SET updated_at = now() WHERE id = _document_id;
  RETURN _out;
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_plan_item_remove(_document_id uuid, _kind text, _id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _status text;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'Not allowed to write the care plan';
  END IF;
  SELECT status INTO _status FROM public.care_documents WHERE id = _document_id AND kind = 'care_plan';
  IF _status IS NULL THEN RAISE EXCEPTION 'That care plan is not on record'; END IF;
  IF _status <> 'draft' THEN RAISE EXCEPTION 'That care plan version has already been issued'; END IF;

  IF _kind = 'need' THEN
    DELETE FROM public.care_plan_needs WHERE id = _id AND document_id = _document_id;
  ELSIF _kind = 'goal' THEN
    DELETE FROM public.care_plan_goals WHERE id = _id AND document_id = _document_id;
  ELSIF _kind = 'task' THEN
    DELETE FROM public.care_plan_tasks WHERE id = _id AND document_id = _document_id;
  ELSE
    RAISE EXCEPTION 'That is not part of a care plan';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_plan_submit(_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _d public.care_documents%ROWTYPE;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'Not allowed to issue the care plan';
  END IF;
  SELECT * INTO _d FROM public.care_documents WHERE id = _document_id FOR UPDATE;
  IF NOT FOUND OR _d.kind <> 'care_plan' THEN RAISE EXCEPTION 'That care plan is not on record'; END IF;
  IF _d.status = 'submitted' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'document_id', _document_id, 'version', _d.version);
  END IF;
  IF _d.status <> 'draft' THEN RAISE EXCEPTION 'That care plan version cannot be issued'; END IF;

  UPDATE public.care_documents
     SET status = 'submitted', submitted_at = now(),
         content_hash = md5(COALESCE(_d.responses, '{}'::jsonb)::text), updated_at = now()
   WHERE id = _document_id;

  IF _d.supersedes_id IS NOT NULL THEN
    UPDATE public.care_documents SET status = 'superseded', updated_at = now()
     WHERE id = _d.supersedes_id AND status = 'submitted';
  END IF;

  UPDATE public.care_work_items
     SET status = 'completed', outcome = 'Care plan prepared', completed_at = now()
   WHERE client_id = _d.client_id AND kind = 'prepare_plan' AND status IN ('open','blocked');

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_d.client_id, 'care_plan_issued',
          jsonb_build_object('document_id', _document_id, 'version', _d.version), auth.uid());

  PERFORM public.care_refresh_stage(_d.client_id);
  RETURN jsonb_build_object('ok', true, 'document_id', _document_id, 'version', _d.version);
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_plan_new_version(_document_id uuid, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _d public.care_documents%ROWTYPE; _new uuid; _existing uuid; _map jsonb := '{}'::jsonb;
  _n record; _g record; _t record; _id uuid;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'Not allowed to write the care plan';
  END IF;
  SELECT * INTO _d FROM public.care_documents WHERE id = _document_id;
  IF NOT FOUND OR _d.kind <> 'care_plan' THEN RAISE EXCEPTION 'That care plan is not on record'; END IF;
  IF _d.status <> 'submitted' THEN RAISE EXCEPTION 'Only an issued care plan can start a new version'; END IF;

  SELECT id INTO _existing FROM public.care_documents
   WHERE client_id = _d.client_id AND kind = 'care_plan' AND status = 'draft';
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;

  INSERT INTO public.care_documents
    (client_id, kind, form_definition_id, status, version, responses,
     built_from_id, supersedes_id, reissue_reason)
  VALUES (_d.client_id, 'care_plan', _d.form_definition_id, 'draft',
          private.care_plan_next_version(_d.client_id), _d.responses,
          _d.id, _d.id, NULLIF(btrim(COALESCE(_reason,'')), ''))
  RETURNING id INTO _new;

  FOR _n IN SELECT * FROM public.care_plan_needs WHERE document_id = _d.id LOOP
    INSERT INTO public.care_plan_needs (document_id, client_id, section_id, ordering, title, detail, created_by)
    VALUES (_new, _d.client_id, _n.section_id, _n.ordering, _n.title, _n.detail, auth.uid())
    RETURNING id INTO _id;
    _map := _map || jsonb_build_object(_n.id::text, _id::text);
  END LOOP;

  FOR _g IN SELECT * FROM public.care_plan_goals WHERE document_id = _d.id LOOP
    INSERT INTO public.care_plan_goals (document_id, client_id, need_id, ordering, title, detail, measure, created_by)
    VALUES (_new, _d.client_id, NULLIF(_map ->> _g.need_id::text, '')::uuid,
            _g.ordering, _g.title, _g.detail, _g.measure, auth.uid())
    RETURNING id INTO _id;
    _map := _map || jsonb_build_object(_g.id::text, _id::text);
  END LOOP;

  FOR _t IN SELECT * FROM public.care_plan_tasks WHERE document_id = _d.id LOOP
    INSERT INTO public.care_plan_tasks (document_id, client_id, goal_id, section_id, ordering, title, detail, frequency, created_by)
    VALUES (_new, _d.client_id, NULLIF(_map ->> _t.goal_id::text, '')::uuid,
            _t.section_id, _t.ordering, _t.title, _t.detail, _t.frequency, auth.uid());
  END LOOP;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_d.client_id, 'care_plan_version_started',
          jsonb_build_object('document_id', _new, 'built_from_id', _d.id), auth.uid());

  PERFORM public.care_refresh_stage(_d.client_id);
  RETURN _new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_assessment_accept(_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _w public.care_assessment_work%ROWTYPE; _plan uuid; _self boolean;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'Not allowed to review assessments';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assessment is not on record'; END IF;

  IF _w.review_decision = 'accepted' THEN
    SELECT id INTO _plan FROM public.care_documents
     WHERE client_id = _w.client_id AND kind = 'care_plan' AND status IN ('draft','submitted')
     ORDER BY created_at LIMIT 1;
    RETURN jsonb_build_object('ok', true, 'already', true, 'care_plan_id', _plan);
  END IF;
  IF _w.status <> 'submitted' THEN RAISE EXCEPTION 'That assessment has not been sent for review'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.mu_people p
                  WHERE p.id = _w.assessor_person_id AND p.auth_user_id = auth.uid())
    INTO _self;
  IF _self THEN RAISE EXCEPTION 'The assessor cannot review their own assessment'; END IF;

  UPDATE public.care_assessment_work
     SET review_decision = 'accepted', reviewed_by = auth.uid(), reviewed_at = now(),
         review_reason = NULL, updated_at = now()
   WHERE id = _id;

  UPDATE public.care_work_items
     SET status = 'completed', outcome = 'Assessment accepted', completed_at = now(), completed_by = auth.uid()
   WHERE client_id = _w.client_id AND kind = 'clinical_review' AND status IN ('open','blocked');

  PERFORM private.care_work_add(
    _w.client_id, 'prepare_plan', 'Prepare the care plan', 'assessment_accepted:' || _id::text,
    'The assessment has been accepted and the plan can be written.', 'high', false,
    public.care_working_due(now(), 3), 'clinical', NULL, 'assessment_accepted');

  PERFORM private.care_work_add(
    _w.client_id, 'agree_package', 'Agree the care package', 'assessment_accepted:' || _id::text,
    'Set out what is proposed and agree it with the family.', 'high', false,
    public.care_working_due(now(), 3), 'care', NULL, 'assessment_accepted');

  _plan := private.care_plan_draft(_w.client_id, _w.document_id);

  PERFORM private.care_assessment_log(_id, 'accepted',
    jsonb_build_object('document_id', _w.document_id, 'care_plan_id', _plan));

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_w.client_id, 'assessment_accepted',
          jsonb_build_object('assessment_id', _id, 'care_plan_id', _plan), auth.uid());

  PERFORM public.care_refresh_stage(_w.client_id);
  RETURN jsonb_build_object('ok', true, 'care_plan_id', _plan);
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_assessment_return(_id uuid, _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _w public.care_assessment_work%ROWTYPE; _source public.care_documents%ROWTYPE; _next uuid; _self boolean;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'Not allowed to review assessments';
  END IF;
  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Say what needs clarifying';
  END IF;

  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assessment is not on record'; END IF;
  IF _w.review_decision = 'returned' AND _w.status = 'in_progress' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'document_id', _w.document_id);
  END IF;
  IF _w.review_decision = 'accepted' THEN
    RAISE EXCEPTION 'That assessment has already been accepted';
  END IF;
  IF _w.status <> 'submitted' THEN RAISE EXCEPTION 'That assessment has not been sent for review'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.mu_people p
                  WHERE p.id = _w.assessor_person_id AND p.auth_user_id = auth.uid())
    INTO _self;
  IF _self THEN RAISE EXCEPTION 'The assessor cannot review their own assessment'; END IF;

  SELECT * INTO _source FROM public.care_documents WHERE id = _w.document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'The sent assessment is not on record'; END IF;

  INSERT INTO public.care_documents
    (client_id, kind, form_definition_id, status, responses, built_from_id,
     reissue_reason, authored_by_person_id)
  VALUES (_source.client_id, 'assessment', _source.form_definition_id, 'draft',
          _source.responses, _source.id, btrim(_reason), _w.assessor_person_id)
  RETURNING id INTO _next;

  UPDATE public.care_assessment_work
     SET review_decision = 'returned', reviewed_by = auth.uid(), reviewed_at = now(),
         review_reason = btrim(_reason), status = 'in_progress', submitted_at = NULL,
         document_id = _next, updated_at = now()
   WHERE id = _id;

  UPDATE public.care_work_items
     SET status = 'completed', outcome = 'Returned for clarification',
         completed_at = now(), completed_by = auth.uid()
   WHERE client_id = _w.client_id AND kind = 'clinical_review' AND status IN ('open','blocked');

  PERFORM private.care_work_add(
    _w.client_id, 'conduct', 'Clarify the assessment', 'assessment_visit:' || _id::text,
    'The assessment came back for clarification.', 'high', false,
    public.care_working_due(now(), 2), 'care', NULL, 'assessment_returned');

  PERFORM private.care_assessment_log(_id, 'returned',
    jsonb_build_object('source_document_id', _source.id, 'document_id', _next, 'reason', btrim(_reason)));

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_w.client_id, 'assessment_returned',
          jsonb_build_object('assessment_id', _id, 'reason', btrim(_reason)), auth.uid());

  PERFORM public.care_refresh_stage(_w.client_id);
  RETURN jsonb_build_object('ok', true, 'document_id', _next);
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_assessment_submit(_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _d public.care_documents%ROWTYPE;
  _version integer;
BEGIN
  IF NOT public.care_is_assigned_assessor(_id) THEN
    RAISE EXCEPTION 'Only the assigned assessor can send this assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF _w.status = 'submitted' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'document_id', _w.document_id);
  END IF;
  IF _w.document_id IS NULL THEN RAISE EXCEPTION 'There is nothing to send yet'; END IF;

  SELECT * INTO _d FROM public.care_documents WHERE id = _w.document_id;

  SELECT 1 + COALESCE(MAX(version), 0) INTO _version FROM public.care_documents
   WHERE client_id = _w.client_id AND kind = 'assessment' AND status IN ('submitted','superseded');

  UPDATE public.care_documents
     SET status = 'submitted', version = _version, submitted_at = now(),
         supersedes_id = CASE WHEN EXISTS (
             SELECT 1 FROM public.care_documents p
              WHERE p.id = _d.built_from_id AND p.kind = 'assessment'
           ) THEN _d.built_from_id ELSE supersedes_id END,
         content_hash = md5(COALESCE(_d.responses, '{}'::jsonb)::text), updated_at = now()
   WHERE id = _w.document_id;

  IF _d.built_from_id IS NOT NULL THEN
    UPDATE public.care_documents SET status = 'superseded', updated_at = now()
     WHERE id = _d.built_from_id AND kind = 'assessment' AND status = 'submitted';
  END IF;

  UPDATE public.care_assessment_work
     SET status = 'submitted', submitted_at = now(),
         review_decision = NULL, reviewed_by = NULL, reviewed_at = NULL, review_reason = NULL,
         updated_at = now()
   WHERE id = _id;

  PERFORM private.care_assessment_log(_id, 'submitted',
    jsonb_build_object('document_id', _w.document_id, 'version', _version));
  PERFORM private.care_work_apply(_w.client_id, 'assessment_submitted', _id);
  RETURN jsonb_build_object('ok', true, 'document_id', _w.document_id, 'version', _version);
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_derive_stage(_client_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE _c public.clients%ROWTYPE;
BEGIN
  SELECT * INTO _c FROM public.clients WHERE id = _client_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF _c.closed_at IS NOT NULL THEN RETURN 'closed'; END IF;
  IF _c.paused_at IS NOT NULL THEN RETURN 'paused'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_assignments a
              WHERE a.client_id = _client_id AND a.role IN ('named_caregiver','supervising_nurse','care_worker','nurse')
                AND (a.starts_on IS NULL OR a.starts_on <= current_date)
                AND (a.ends_on IS NULL OR a.ends_on >= current_date))
  THEN RETURN 'care_running'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_documents d
              WHERE d.client_id = _client_id AND d.kind = 'care_plan' AND d.status = 'submitted')
  THEN RETURN 'care_setup'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_documents d
              WHERE d.client_id = _client_id AND d.kind = 'care_plan' AND d.status = 'draft')
  THEN RETURN 'care_plan_preparation'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_assessment_work w
              WHERE w.client_id = _client_id AND w.status = 'submitted'
                AND w.review_decision IS NULL)
  THEN RETURN 'clinical_review'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_assessment_work w
              WHERE w.client_id = _client_id AND w.status = 'in_progress')
  THEN RETURN 'assessment_in_progress'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_documents d
              JOIN public.care_assessment_work w ON w.document_id = d.id
              WHERE d.client_id = _client_id AND d.kind = 'assessment' AND d.status = 'draft'
                AND w.status IN ('requested','scheduled','in_progress'))
  THEN RETURN 'assessment_in_progress'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_assessment_work w
              WHERE w.client_id = _client_id AND w.status IN ('requested','scheduled')
                AND w.appointment_at IS NOT NULL)
  THEN RETURN 'assessment_booked'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_documents d
              WHERE d.client_id = _client_id AND d.kind = 'pre_assessment' AND d.status = 'submitted')
  THEN RETURN 'pre_assessment_received'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_access_tokens t
              WHERE t.client_id = _client_id AND t.purpose = 'pre_assessment' AND t.revoked_at IS NULL)
  THEN RETURN 'awaiting_pre_assessment'; END IF;

  RETURN 'enquiry';
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_work_domain_managed(_kind text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT _kind IN ('book','assign','conduct','clinical_review','prepare_plan');
$function$;