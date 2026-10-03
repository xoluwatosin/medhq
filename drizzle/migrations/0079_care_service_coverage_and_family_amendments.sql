-- Changing or adding a service after the pre-assessment.
--
-- Three things, all additive:
--   1. a link can be a short top-up covering only the services added later;
--   2. a family may correct their own answers until the assessment visit opens;
--   3. an assessor may record a service the family asked for at the visit.

-- ------------------------------------------------------------------ top-ups
ALTER TABLE public.care_access_tokens
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS parent_token_id uuid REFERENCES public.care_access_tokens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES public.care_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS covers_services text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'care_access_tokens_scope_check'
  ) THEN
    ALTER TABLE public.care_access_tokens
      ADD CONSTRAINT care_access_tokens_scope_check CHECK (scope IN ('full', 'top_up'));
  END IF;
END $$;

COMMENT ON COLUMN public.care_access_tokens.covers_services IS
  'For a top-up link, the service keys whose sections it asks. Null on a full link.';

-- Which service, for which person, a pre-assessment has actually covered.
CREATE TABLE IF NOT EXISTS public.care_pre_assessment_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.care_requests(id) ON DELETE CASCADE,
  request_recipient_id uuid NOT NULL REFERENCES public.care_request_recipients(id) ON DELETE CASCADE,
  intention_id uuid NOT NULL REFERENCES public.care_service_intentions(id) ON DELETE CASCADE,
  token_id uuid REFERENCES public.care_access_tokens(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.care_documents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'returned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  returned_at timestamptz,
  CONSTRAINT care_pre_assessment_coverage_unique UNIQUE (request_recipient_id, intention_id)
);
COMMENT ON TABLE public.care_pre_assessment_coverage IS
  'A service added after the family answered, and the top-up that asks about it.';

CREATE INDEX IF NOT EXISTS care_pre_assessment_coverage_request
  ON public.care_pre_assessment_coverage (request_id);
CREATE INDEX IF NOT EXISTS care_pre_assessment_coverage_token
  ON public.care_pre_assessment_coverage (token_id);

GRANT SELECT ON public.care_pre_assessment_coverage TO authenticated;
GRANT ALL ON public.care_pre_assessment_coverage TO service_role;
ALTER TABLE public.care_pre_assessment_coverage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read pre-assessment coverage"
  ON public.care_pre_assessment_coverage FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- --------------------------------------------------------------- the gap
-- A service is not covered when it was recorded after that person sent their
-- pre-assessment and no returned top-up has asked about it since.
CREATE OR REPLACE FUNCTION public.care_request_coverage(_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _recipients jsonb; _visit_started boolean; _gaps integer := 0;
BEGIN
  PERFORM private.care_group_admin_guard();

  SELECT EXISTS (
    SELECT 1
      FROM public.care_assessment_work w
      JOIN public.care_request_recipients rr ON rr.client_id = w.client_id
     WHERE rr.request_id = _request_id
       AND (w.started_at IS NOT NULL OR w.status IN ('in_progress', 'submitted'))
  ) INTO _visit_started;

  SELECT COALESCE(jsonb_agg(row ORDER BY row ->> 'display_order'), '[]'::jsonb)
    INTO _recipients
    FROM (
      SELECT jsonb_build_object(
        'request_recipient_id', rr.id,
        'client_id', rr.client_id,
        'name', COALESCE(c.full_name, 'Care recipient'),
        'display_order', lpad(rr.display_order::text, 4, '0'),
        'submitted_at', d.submitted_at,
        'gaps', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'intention_id', si.id,
                   'service_id', si.service_id,
                   'service_name', s.name,
                   'service_slug', s.slug,
                   'state', si.state,
                   'top_up_sent', cov.id IS NOT NULL)
                 ORDER BY s.name)
            FROM public.care_service_intention_recipients sir
            JOIN public.care_service_intentions si ON si.id = sir.intention_id
            JOIN public.services s ON s.id = si.service_id
            LEFT JOIN public.care_pre_assessment_coverage cov
                   ON cov.intention_id = si.id
                  AND cov.request_recipient_id = rr.id
                  AND cov.status = 'returned'
           WHERE sir.request_recipient_id = rr.id
             AND si.request_id = _request_id
             AND d.submitted_at IS NOT NULL
             AND si.created_at > d.submitted_at
             AND cov.id IS NULL
        ), '[]'::jsonb)
      ) AS row
      FROM public.care_request_recipients rr
      JOIN public.clients c ON c.id = rr.client_id
      LEFT JOIN LATERAL (
        SELECT dd.id, dd.submitted_at
          FROM public.care_documents dd
         WHERE dd.client_id = rr.client_id
           AND dd.kind = 'pre_assessment'
           AND dd.status IN ('submitted', 'superseded')
         ORDER BY dd.submitted_at DESC NULLS LAST
         LIMIT 1
      ) d ON true
     WHERE rr.request_id = _request_id
    ) rows;

  SELECT COALESCE(sum(jsonb_array_length(r -> 'gaps')), 0)
    INTO _gaps
    FROM jsonb_array_elements(_recipients) r;

  RETURN jsonb_build_object(
    'visit_started', _visit_started,
    'amendable', NOT _visit_started,
    'gap_count', _gaps,
    'recipients', _recipients);
END;
$function$;

REVOKE ALL ON FUNCTION public.care_request_coverage(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.care_request_coverage(uuid) TO authenticated, service_role;

-- ------------------------------------------------- amendments from the family
-- The family may correct what they sent until the visit opens. Nothing is
-- overwritten: every correction is recorded against the sent document.
CREATE OR REPLACE FUNCTION public.care_family_amend(
  _token_hash text, _document_id uuid, _section_id text, _changes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _token public.care_access_tokens%ROWTYPE;
  _doc public.care_documents%ROWTYPE;
  _definition jsonb; _section jsonb; _field jsonb;
  _session uuid := gen_random_uuid();
  _key text; _value jsonb; _current jsonb; _problem text; _written integer := 0;
BEGIN
  SELECT * INTO _token FROM public.care_access_tokens WHERE token_hash = _token_hash;
  IF NOT FOUND THEN RAISE EXCEPTION 'This link is not valid'; END IF;
  IF _token.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'This link has been withdrawn'; END IF;
  IF _token.expires_at IS NOT NULL AND _token.expires_at < now() THEN
    RAISE EXCEPTION 'This link has expired';
  END IF;

  SELECT * INTO _doc FROM public.care_documents WHERE id = _document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That form is not on the record'; END IF;
  IF _doc.client_id <> _token.client_id THEN RAISE EXCEPTION 'This link is not valid'; END IF;
  IF _doc.kind <> 'pre_assessment' THEN RAISE EXCEPTION 'That form cannot be changed here'; END IF;
  IF _doc.status <> 'submitted' THEN RAISE EXCEPTION 'That form has not been sent yet'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.care_assessment_work w
     WHERE w.client_id = _doc.client_id
       AND (w.started_at IS NOT NULL OR w.status IN ('in_progress', 'submitted'))
  ) THEN
    RAISE EXCEPTION 'Changes are now made with the nurse on the day';
  END IF;

  SELECT d.definition INTO _definition
    FROM public.form_definitions d WHERE d.id = _doc.form_definition_id;
  IF _definition IS NULL THEN RAISE EXCEPTION 'The questions behind this form are not on the record'; END IF;

  SELECT s INTO _section
    FROM jsonb_array_elements(COALESCE(_definition -> 'sections', '[]'::jsonb)) s
   WHERE s ->> 'id' = _section_id LIMIT 1;
  IF _section IS NULL THEN RAISE EXCEPTION 'That part of the form is not on the record'; END IF;

  FOR _key, _value IN SELECT * FROM jsonb_each(COALESCE(_changes, '{}'::jsonb)) LOOP
    SELECT f INTO _field
      FROM jsonb_array_elements(COALESCE(_section -> 'fields', '[]'::jsonb)) f
     WHERE f ->> 'id' = regexp_replace(_key, '^r\d+__', '') LIMIT 1;
    IF _field IS NULL THEN RAISE EXCEPTION 'That question is not in that part of the form'; END IF;

    SELECT a.corrected_value INTO _current
      FROM public.care_response_amendments a
     WHERE a.document_id = _document_id AND a.field_id = _key
     ORDER BY a.created_at DESC LIMIT 1;
    IF _current IS NULL THEN _current := COALESCE(_doc.responses -> _key, 'null'::jsonb); END IF;

    CONTINUE WHEN _current = _value;

    _problem := private.care_check_answer(_field, _value);
    IF _problem IS NOT NULL THEN RAISE EXCEPTION '%', _problem; END IF;

    INSERT INTO public.care_response_amendments
      (document_id, client_id, field_id, section_id, session_id,
       original_value, corrected_value, reason, amended_by, amended_by_name)
    VALUES (_document_id, _doc.client_id, _key, _section_id, _session,
            _current, _value, 'Changed by the family before the assessment',
            NULL, 'Family, from their link');
    _written := _written + 1;
  END LOOP;

  IF _written > 0 THEN
    INSERT INTO public.care_access_log (token_id, client_id, document_id, action)
    VALUES (_token.id, _doc.client_id, _document_id, 'answers_amended');
  END IF;

  RETURN jsonb_build_object('ok', true, 'changed', _written);
END;
$function$;

REVOKE ALL ON FUNCTION public.care_family_amend(text, uuid, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.care_family_amend(text, uuid, text, jsonb) TO service_role;

-- ------------------------------------- a service the family asked for at the visit
-- The assessor records the request. It never confirms a service and never
-- touches pricing.
CREATE OR REPLACE FUNCTION public.care_assessment_service_request(
  _work_id uuid, _service_id uuid, _note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _w public.care_assessment_work%ROWTYPE;
  _recipient public.care_request_recipients%ROWTYPE;
  _intention uuid; _service text;
BEGIN
  IF NOT (public.care_is_assigned_assessor(_work_id) OR private.care_ops_ok()) THEN
    RAISE EXCEPTION 'Not allowed to record a service on this assessment';
  END IF;

  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _work_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assessment is not on record'; END IF;

  SELECT name INTO _service FROM public.services WHERE id = _service_id;
  IF _service IS NULL THEN RAISE EXCEPTION 'That service is not on the list'; END IF;

  SELECT * INTO _recipient
    FROM public.care_request_recipients
   WHERE client_id = _w.client_id
   ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'This person is not on a care request'; END IF;

  SELECT si.id INTO _intention
    FROM public.care_service_intentions si
    JOIN public.care_service_intention_recipients sir ON sir.intention_id = si.id
   WHERE si.request_id = _recipient.request_id
     AND si.service_id = _service_id
     AND sir.request_recipient_id = _recipient.id
   LIMIT 1;

  IF _intention IS NULL THEN
    INSERT INTO public.care_service_intentions
      (request_id, service_id, state, is_shared, reason, source, created_by)
    VALUES (_recipient.request_id, _service_id, 'proposed', false,
            NULLIF(btrim(COALESCE(_note, '')), ''), 'assessor', auth.uid())
    RETURNING id INTO _intention;

    INSERT INTO public.care_service_intention_recipients (intention_id, request_recipient_id)
    VALUES (_intention, _recipient.id)
    ON CONFLICT (intention_id, request_recipient_id) DO NOTHING;
  END IF;

  PERFORM private.care_assessment_log(_work_id, 'service_requested',
    jsonb_build_object('service_id', _service_id, 'service', _service,
                       'intention_id', _intention, 'note', NULLIF(btrim(COALESCE(_note, '')), '')));

  RETURN jsonb_build_object('ok', true, 'intention_id', _intention, 'service', _service);
END;
$function$;

REVOKE ALL ON FUNCTION public.care_assessment_service_request(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.care_assessment_service_request(uuid, uuid, text) TO authenticated, service_role;