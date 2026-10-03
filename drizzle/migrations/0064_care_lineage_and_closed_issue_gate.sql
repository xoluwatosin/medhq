-- Pass 5: one accepted assessment version, one care-plan draft built from it.
CREATE OR REPLACE FUNCTION private.care_plan_draft(_client_id uuid, _built_from uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _definition uuid; _doc uuid;
BEGIN
  IF _built_from IS NOT NULL THEN
    SELECT id INTO _doc FROM public.care_documents
     WHERE kind = 'care_plan' AND built_from_id = _built_from
     ORDER BY created_at LIMIT 1;
  ELSE
    SELECT id INTO _doc FROM public.care_documents
     WHERE client_id = _client_id AND kind = 'care_plan'
       AND status = 'draft' AND built_from_id IS NULL
     ORDER BY created_at LIMIT 1;
  END IF;
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

-- A proposal is projected from the plan behind the accepted assessment.
CREATE OR REPLACE FUNCTION public.care_proposal_draft(_client_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _accepted uuid;
  _plan public.care_documents%ROWTYPE;
  _content jsonb := '{}'::jsonb;
  _key text;
  _existing public.care_proposals%ROWTYPE;
  _next integer;
BEGIN
  IF NOT private.care_ops_ok() THEN
    RAISE EXCEPTION 'Not allowed to prepare a care proposal';
  END IF;

  SELECT w.document_id INTO _accepted FROM public.care_assessment_work w
   WHERE w.client_id = _client_id AND w.review_decision = 'accepted'
   ORDER BY w.reviewed_at DESC NULLS LAST LIMIT 1;

  IF _accepted IS NOT NULL THEN
    SELECT * INTO _plan FROM public.care_documents
     WHERE kind = 'care_plan' AND built_from_id = _accepted
     ORDER BY version DESC LIMIT 1;
  END IF;

  IF _plan.id IS NULL THEN
    SELECT * INTO _plan FROM public.care_documents
     WHERE client_id = _client_id AND kind = 'care_plan'
     ORDER BY version DESC LIMIT 1;
  END IF;

  IF _plan.id IS NULL THEN
    RAISE EXCEPTION 'There is no care plan to base a proposal on yet';
  END IF;

  FOREACH _key IN ARRAY private.care_proposal_sections() LOOP
    IF _plan.responses ? _key THEN
      _content := _content || jsonb_build_object(_key, _plan.responses -> _key);
    END IF;
  END LOOP;

  SELECT * INTO _existing FROM public.care_proposals
   WHERE client_id = _client_id AND status = 'draft'
   ORDER BY version DESC LIMIT 1;

  IF _existing.id IS NOT NULL THEN
    UPDATE public.care_proposals
       SET content = _content, plan_document_id = _plan.id,
           content_hash = md5(_content::text)
     WHERE id = _existing.id;
    RETURN jsonb_build_object('ok', true, 'proposal_id', _existing.id, 'version', _existing.version);
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO _next
    FROM public.care_proposals WHERE client_id = _client_id;

  INSERT INTO public.care_proposals (client_id, plan_document_id, version, content, content_hash,
                                     created_by, supersedes_id)
  VALUES (_client_id, _plan.id, _next, _content, md5(_content::text), auth.uid(),
          (SELECT id FROM public.care_proposals
            WHERE client_id = _client_id AND status = 'sent'
            ORDER BY version DESC LIMIT 1))
  RETURNING * INTO _existing;

  RETURN jsonb_build_object('ok', true, 'proposal_id', _existing.id, 'version', _existing.version);
END;
$function$;

-- Sending requires the clinical grant that reading the content requires.
CREATE OR REPLACE FUNCTION public.care_proposal_send(_proposal_id uuid, _person_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _p public.care_proposals%ROWTYPE;
  _person uuid;
  _sent integer := 0;
  _added integer := 0;
BEGIN
  IF NOT private.care_ops_ok() THEN
    RAISE EXCEPTION 'Not allowed to send a care proposal';
  END IF;
  IF _person_ids IS NULL OR array_length(_person_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Choose at least one person to send the proposal to';
  END IF;

  SELECT * INTO _p FROM public.care_proposals WHERE id = _proposal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That proposal is not on record'; END IF;
  IF _p.status = 'withdrawn' THEN RAISE EXCEPTION 'That proposal has been withdrawn'; END IF;

  FOREACH _person IN ARRAY _person_ids LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.care_access_grants g
       WHERE g.client_id = _p.client_id AND g.person_id = _person
         AND g.state = 'active' AND g.clinical_scope
    ) THEN
      RAISE EXCEPTION 'That person does not have clinical access to this client';
    END IF;

    INSERT INTO public.care_proposal_sends (proposal_id, person_id, sent_by)
    VALUES (_proposal_id, _person, auth.uid())
    ON CONFLICT (proposal_id, person_id) DO NOTHING;
    GET DIAGNOSTICS _added = ROW_COUNT;

    IF _added > 0 THEN
      _sent := _sent + 1;
      PERFORM private.care_notify_record(
        'care_proposal_sent', _p.client_id,
        'proposal:' || _proposal_id::text || ':' || _person::text,
        'Your care proposal is ready', NULL, 'care_proposals', _proposal_id);
    END IF;
  END LOOP;

  UPDATE public.care_proposals
     SET status = 'sent',
         sent_at = COALESCE(sent_at, now()),
         updated_at = now()
   WHERE id = _proposal_id AND status = 'draft';

  RETURN jsonb_build_object('proposal_id', _proposal_id, 'sent', _sent);
END;
$function$;

-- Commenting needs the same clinical access as reading.
CREATE OR REPLACE FUNCTION public.care_proposal_comment(_proposal_id uuid, _body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _p public.care_proposals%ROWTYPE;
  _person uuid;
BEGIN
  IF _body IS NULL OR btrim(_body) = '' THEN
    RAISE EXCEPTION 'Write something before sending the comment';
  END IF;
  SELECT * INTO _p FROM public.care_proposals WHERE id = _proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That proposal is not on record'; END IF;

  SELECT s.person_id INTO _person FROM public.care_proposal_sends s
   WHERE s.proposal_id = _proposal_id AND s.person_id IN (SELECT public.care_my_person_ids())
   LIMIT 1;

  IF _person IS NOT NULL AND NOT private.care_has_scope(_p.client_id, 'clinical') THEN
    _person := NULL;
  END IF;

  IF _person IS NULL AND NOT private.care_ops_ok() THEN
    RAISE EXCEPTION 'Not allowed to comment on this proposal';
  END IF;

  INSERT INTO public.care_proposal_comments (proposal_id, person_id, author_user_id, body)
  VALUES (_proposal_id, _person, auth.uid(), btrim(_body));

  RETURN jsonb_build_object('ok', true, 'proposal_id', _proposal_id);
END;
$function$;

-- Pass 6: the issue gate stays shut until the layers behind it exist.
CREATE OR REPLACE FUNCTION private.care_plan_issue_ready(_client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  -- Issuing a care plan needs an agreed package, confirmed staffing with viable
  -- cover, verified medicines and equipment, resolved client comments and
  -- Clinical Lead approval. None of those layers exist yet, so this refuses.
  SELECT false;
$function$;
