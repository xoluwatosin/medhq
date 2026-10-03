-- The proposal send check read grant columns that do not exist on
-- care_access_grants (it holds state, journey_scope). Correct it, and make a
-- repeated send safe: the same person is only recorded once per proposal.

CREATE UNIQUE INDEX IF NOT EXISTS care_proposal_sends_once
  ON public.care_proposal_sends (proposal_id, person_id);

CREATE OR REPLACE FUNCTION public.care_proposal_send(_proposal_id uuid, _person_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _p public.care_proposals%ROWTYPE;
  _person uuid;
  _sent integer := 0;
  _added boolean;
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
         AND g.state = 'active' AND g.journey_scope
    ) THEN
      RAISE EXCEPTION 'That person does not have access to this client''s journey';
    END IF;

    INSERT INTO public.care_proposal_sends (proposal_id, person_id, sent_by)
    VALUES (_proposal_id, _person, auth.uid())
    ON CONFLICT (proposal_id, person_id) DO NOTHING;
    GET DIAGNOSTICS _added = ROW_COUNT;

    IF _added THEN
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
