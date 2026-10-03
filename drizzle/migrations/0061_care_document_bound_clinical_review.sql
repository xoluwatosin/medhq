-- Pass 1: a clinical review belongs to one submitted assessment version.
CREATE TABLE public.care_assessment_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_work_id uuid NOT NULL REFERENCES public.care_assessment_work(id) ON DELETE CASCADE,
  assessment_document_id uuid NOT NULL UNIQUE REFERENCES public.care_documents(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','returned')),
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision text CHECK (decision IN ('accepted','returned')),
  decision_reason text,
  return_category text,
  return_instructions text,
  return_priority text CHECK (return_priority IN ('routine','important','urgent')),
  decision_notes text,
  reviewer_user_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.care_assessment_reviews IS
  'One review per submitted assessment document version. The review columns on care_assessment_work are a current-state projection of the latest review, kept in step by the server.';

CREATE INDEX care_assessment_reviews_work_idx
  ON public.care_assessment_reviews (assessment_work_id, created_at DESC);
CREATE INDEX care_assessment_reviews_client_idx
  ON public.care_assessment_reviews (client_id);

REVOKE ALL ON public.care_assessment_reviews FROM anon;
REVOKE ALL ON public.care_assessment_reviews FROM authenticated;
GRANT SELECT ON public.care_assessment_reviews TO authenticated;
GRANT ALL ON public.care_assessment_reviews TO service_role;

ALTER TABLE public.care_assessment_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinical staff read assessment reviews"
  ON public.care_assessment_reviews FOR SELECT TO authenticated
  USING (private.care_clinical_ok());

-- Opening a review. One per document, and asking twice changes nothing.
CREATE OR REPLACE FUNCTION private.care_review_open(_work uuid, _doc uuid, _client uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _id uuid;
BEGIN
  IF _doc IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO _id FROM public.care_assessment_reviews WHERE assessment_document_id = _doc;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  INSERT INTO public.care_assessment_reviews (assessment_work_id, assessment_document_id, client_id)
  VALUES (_work, _doc, _client)
  ON CONFLICT (assessment_document_id) DO NOTHING
  RETURNING id INTO _id;
  IF _id IS NULL THEN
    SELECT id INTO _id FROM public.care_assessment_reviews WHERE assessment_document_id = _doc;
  END IF;
  RETURN _id;
END;
$function$;

-- The review of the version currently sitting for review on this visit.
CREATE OR REPLACE FUNCTION private.care_review_current(_work uuid)
 RETURNS public.care_assessment_reviews
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT r.* FROM public.care_assessment_reviews r
    JOIN public.care_assessment_work w ON w.id = r.assessment_work_id
   WHERE r.assessment_work_id = _work AND r.assessment_document_id = w.document_id
   LIMIT 1;
$function$;

-- Records already on file keep their review, bound to the version they judged.
INSERT INTO public.care_assessment_reviews
  (assessment_work_id, assessment_document_id, client_id, status, checklist,
   decision, decision_reason, reviewer_user_id, started_at, completed_at)
SELECT w.id, w.document_id, w.client_id,
       COALESCE(w.review_decision, 'open'),
       COALESCE(w.review_checklist, '{}'::jsonb),
       w.review_decision, w.review_reason, w.reviewed_by,
       COALESCE(w.submitted_at, w.created_at),
       w.reviewed_at
  FROM public.care_assessment_work w
 WHERE w.document_id IS NOT NULL
   AND (w.status = 'submitted' OR w.review_decision IS NOT NULL)
ON CONFLICT (assessment_document_id) DO NOTHING;

-- Reading a review: the one bound to this version, plus the history behind it.
CREATE OR REPLACE FUNCTION public.care_review_record(_work uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _current public.care_assessment_reviews; _history jsonb;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'Not allowed to read this review';
  END IF;
  SELECT * INTO _current FROM private.care_review_current(_work);
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::jsonb) INTO _history
    FROM public.care_assessment_reviews r
   WHERE r.assessment_work_id = _work
     AND (_current.id IS NULL OR r.id <> _current.id);
  RETURN jsonb_build_object(
    'current', CASE WHEN _current.id IS NULL THEN NULL ELSE to_jsonb(_current) END,
    'history', _history);
END;
$function$;

REVOKE ALL ON FUNCTION public.care_review_record(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.care_review_record(uuid) TO authenticated;

-- Submitting opens exactly one review for that exact document.
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
  _definition jsonb; _sections jsonb;
  _src_answers jsonb; _src_def jsonb;
  _missing integer := 0; _undecided integer := 0;
BEGIN
  IF NOT public.care_is_assigned_assessor(_id) THEN
    RAISE EXCEPTION 'Only the assigned assessor can send this assessment';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF _w.status = 'submitted' THEN
    PERFORM private.care_review_open(_id, _w.document_id, _w.client_id);
    RETURN jsonb_build_object('ok', true, 'already', true, 'document_id', _w.document_id);
  END IF;
  IF _w.document_id IS NULL THEN RAISE EXCEPTION 'There is nothing to send yet'; END IF;

  SELECT * INTO _d FROM public.care_documents WHERE id = _w.document_id;
  SELECT definition INTO _definition FROM public.form_definitions WHERE id = _d.form_definition_id;
  _sections := private.care_sections_for(COALESCE(_definition,'{}'::jsonb),
                                         COALESCE(_d.resolved_modules,'[]'::jsonb));

  SELECT count(*) INTO _missing
    FROM jsonb_array_elements(_sections) s,
         jsonb_array_elements(COALESCE(s -> 'fields','[]'::jsonb)) fl
   WHERE COALESCE((fl ->> 'required')::boolean, false)
     AND (NOT (fl ? 'showWhen')
          OR private.care_condition_met(fl -> 'showWhen', COALESCE(_d.responses,'{}'::jsonb)))
     AND NOT private.care_answered(COALESCE(_d.responses,'{}'::jsonb) -> (fl ->> 'id'));
  IF _missing > 0 THEN
    RAISE EXCEPTION 'Answer every required question before sending this assessment';
  END IF;

  SELECT d.responses, f.definition INTO _src_answers, _src_def
    FROM public.care_documents d
    JOIN public.form_definitions f ON f.id = d.form_definition_id
   WHERE d.id = _w.source_document_id;

  IF _src_def IS NOT NULL THEN
    SELECT count(*) INTO _undecided
      FROM jsonb_array_elements(_src_def -> 'sections') s,
           jsonb_array_elements(COALESCE(s -> 'fields','[]'::jsonb)) fl
     WHERE private.care_answered(COALESCE(_src_answers,'{}'::jsonb) -> (fl ->> 'id'))
       AND NOT (COALESCE(_d.responses,'{}'::jsonb) ? ('confirm.' || (fl ->> 'id')));
    IF _undecided > 0 THEN
      RAISE EXCEPTION 'Confirm or amend everything the family told us before sending this assessment';
    END IF;
  END IF;

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
         review_checklist = NULL,
         updated_at = now()
   WHERE id = _id;

  PERFORM private.care_review_open(_id, _w.document_id, _w.client_id);

  PERFORM private.care_assessment_escalate(_d, _definition);
  PERFORM private.care_assessment_log(_id, 'submitted',
    jsonb_build_object('document_id', _w.document_id, 'version', _version));
  PERFORM private.care_work_apply(_w.client_id, 'assessment_submitted', _id);
  RETURN jsonb_build_object('ok', true, 'document_id', _w.document_id, 'version', _version);
END;
$function$;

-- The checklist is held on the review, not on the visit.
CREATE OR REPLACE FUNCTION public.care_review_checklist_save(_id uuid, _checklist jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _r public.care_assessment_reviews;
  _item text;
  _decision text;
BEGIN
  IF NOT private.care_clinical_ok() THEN
    RAISE EXCEPTION 'Not allowed to review assessments';
  END IF;
  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assessment is not on record'; END IF;
  IF _w.status <> 'submitted' THEN RAISE EXCEPTION 'That assessment has not been sent for review'; END IF;
  IF jsonb_typeof(COALESCE(_checklist, 'null'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'That checklist could not be recorded';
  END IF;

  PERFORM private.care_review_open(_id, _w.document_id, _w.client_id);
  SELECT * INTO _r FROM private.care_review_current(_id);
  IF _r.id IS NULL THEN RAISE EXCEPTION 'There is no review open on this assessment'; END IF;
  IF _r.status <> 'open' THEN RAISE EXCEPTION 'That assessment has already been reviewed'; END IF;

  FOR _item IN SELECT jsonb_object_keys(_checklist) LOOP
    IF NOT (_item = ANY(private.care_review_checklist_items())) THEN
      RAISE EXCEPTION 'That is not a check on this review';
    END IF;
    _decision := _checklist #>> ARRAY[_item, 'decision'];
    IF _decision IS NOT NULL AND _decision NOT IN ('met', 'not_met', 'not_applicable') THEN
      RAISE EXCEPTION 'That checklist decision could not be recorded';
    END IF;
    IF length(COALESCE(_checklist #>> ARRAY[_item, 'note'], '')) > 4000 THEN
      RAISE EXCEPTION 'That note is too long';
    END IF;
  END LOOP;

  UPDATE public.care_assessment_reviews
     SET checklist = _checklist, updated_at = now() WHERE id = _r.id;

  UPDATE public.care_assessment_work
     SET review_checklist = _checklist, updated_at = now()
   WHERE id = _id;
  RETURN jsonb_build_object('ok', true, 'review_id', _r.id);
END;
$function$;
