-- The care proposal: projection, immutability and the care-plan issue gate.
-- Everything here is synthetic and rolled back.
BEGIN;

DO $$
DECLARE
  _client uuid;
  _plan uuid;
  _def uuid;
  _proposal uuid;
  _content jsonb;
  _failed boolean;
BEGIN
  SELECT id INTO _def FROM public.form_definitions
   WHERE kind = 'care_plan' AND status = 'published' LIMIT 1;

  INSERT INTO public.clients (full_name) VALUES ('Synthetic proposal client') RETURNING id INTO _client;

  INSERT INTO public.care_documents (client_id, kind, status, version, form_definition_id, responses)
  VALUES (_client, 'care_plan', 'draft', 1, _def, jsonb_build_object(
    'front_sheet', jsonb_build_object('note', 'Who this is about'),
    'risks', jsonb_build_object('note', 'Internal safeguarding detail')
  ))
  RETURNING id INTO _plan;

  -- Projection: the allowed sections only.
  INSERT INTO public.care_proposals (client_id, plan_document_id, version, content, content_hash)
  SELECT _client, _plan, 1,
         COALESCE(jsonb_object_agg(k, v), '{}'::jsonb),
         'test'
    FROM jsonb_each((SELECT responses FROM public.care_documents WHERE id = _plan)) AS e(k, v)
   WHERE k = ANY (private.care_proposal_sections())
  RETURNING id, content INTO _proposal, _content;

  IF _content ? 'risks' THEN
    RAISE EXCEPTION 'the proposal must never carry the risk section';
  END IF;
  IF NOT _content ? 'front_sheet' THEN
    RAISE EXCEPTION 'the proposal must carry the front sheet';
  END IF;

  -- The issue gate: nothing is arranged, so the plan cannot be issued.
  IF private.care_plan_issue_ready(_client) THEN
    RAISE EXCEPTION 'the plan must not be issuable before care is arranged';
  END IF;

  -- A sent proposal is a record: the freeze trigger guards it.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.care_proposals'::regclass
       AND tgname = 'care_proposals_freeze' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'a sent proposal must be protected by the freeze trigger';
  END IF;

  RAISE NOTICE 'care proposal: pass';
END $$;

ROLLBACK;
