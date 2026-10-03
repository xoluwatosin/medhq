ALTER TABLE public.care_access_tokens
  ADD COLUMN IF NOT EXISTS request_recipient_id uuid REFERENCES public.care_request_recipients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.care_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS care_access_tokens_request_recipient
  ON public.care_access_tokens (request_recipient_id)
  WHERE request_recipient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS care_access_tokens_document
  ON public.care_access_tokens (document_id)
  WHERE document_id IS NOT NULL;

COMMENT ON COLUMN public.care_access_tokens.request_recipient_id IS
  'Authoritative request recipient for a top-up link. Never inferred from a name.';
COMMENT ON COLUMN public.care_access_tokens.document_id IS
  'Exact pre-assessment document this link reads and writes.';

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
       AND w.started_at IS NOT NULL
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
                   'top_up_sent', EXISTS (
                     SELECT 1 FROM public.care_pre_assessment_coverage sent
                      WHERE sent.intention_id = si.id
                        AND sent.request_recipient_id = rr.id
                        AND sent.status = 'sent'
                   ))
                 ORDER BY s.name)
            FROM public.care_service_intention_recipients sir
            JOIN public.care_service_intentions si ON si.id = sir.intention_id
            JOIN public.services s ON s.id = si.service_id
           WHERE sir.request_recipient_id = rr.id
             AND si.request_id = _request_id
             AND si.state NOT IN ('declined', 'removed')
             AND d.submitted_at IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM public.care_pre_assessment_coverage cov
                WHERE cov.intention_id = si.id
                  AND cov.request_recipient_id = rr.id
                  AND cov.status = 'returned'
             )
             AND (
               si.created_at > d.submitted_at
               OR NOT EXISTS (
                 SELECT 1 FROM public.care_pre_assessment_coverage prior
                  WHERE prior.intention_id = si.id
                    AND prior.request_recipient_id = rr.id
                    AND prior.status = 'returned'
               )
             )
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
  _intention uuid; _service text; _matches integer;
BEGIN
  IF NOT (public.care_is_assigned_assessor(_work_id) OR private.care_ops_ok()) THEN
    RAISE EXCEPTION 'Not allowed to record a service on this assessment';
  END IF;
  IF NULLIF(btrim(COALESCE(_note, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Enter why this service is being added';
  END IF;

  SELECT * INTO _w FROM public.care_assessment_work WHERE id = _work_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That assessment is not on record'; END IF;
  IF _w.status = 'submitted' THEN
    RAISE EXCEPTION 'This assessment has been submitted. Create a follow-up assessment for the additional service';
  END IF;

  SELECT name INTO _service FROM public.services WHERE id = _service_id AND is_active = true;
  IF _service IS NULL THEN RAISE EXCEPTION 'That service is not on the list'; END IF;

  SELECT count(*) INTO _matches
    FROM public.care_request_recipients
   WHERE client_id = _w.client_id;
  IF _matches <> 1 THEN
    RAISE EXCEPTION 'Choose the care recipient in the care request before adding this service';
  END IF;

  SELECT * INTO _recipient
    FROM public.care_request_recipients
   WHERE client_id = _w.client_id
   LIMIT 1;

  SELECT si.id INTO _intention
    FROM public.care_service_intentions si
    JOIN public.care_service_intention_recipients sir ON sir.intention_id = si.id
   WHERE si.request_id = _recipient.request_id
     AND si.service_id = _service_id
     AND sir.request_recipient_id = _recipient.id
     AND si.state NOT IN ('declined', 'removed')
   LIMIT 1;

  IF _intention IS NULL THEN
    INSERT INTO public.care_service_intentions
      (request_id, service_id, state, is_shared, reason, source, created_by)
    VALUES (_recipient.request_id, _service_id, 'proposed', false,
            btrim(_note), 'assessor', auth.uid())
    RETURNING id INTO _intention;

    INSERT INTO public.care_service_intention_recipients (intention_id, request_recipient_id)
    VALUES (_intention, _recipient.id)
    ON CONFLICT (intention_id, request_recipient_id) DO NOTHING;
  END IF;

  PERFORM private.care_assessment_log(_work_id, 'service_requested',
    jsonb_build_object('service_id', _service_id, 'service', _service,
                       'intention_id', _intention, 'note', btrim(_note)));

  RETURN jsonb_build_object('ok', true, 'intention_id', _intention, 'service', _service);
END;
$function$;

REVOKE ALL ON FUNCTION public.care_assessment_service_request(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.care_assessment_service_request(uuid, uuid, text) TO authenticated, service_role;