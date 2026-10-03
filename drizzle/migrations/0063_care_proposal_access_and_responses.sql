-- Pass 2: proposal content is clinical. Journey access alone sees status only.
REVOKE ALL ON public.care_proposals FROM anon;
REVOKE ALL ON public.care_proposals FROM authenticated;
REVOKE ALL ON public.care_proposal_sends FROM anon;
REVOKE ALL ON public.care_proposal_sends FROM authenticated;
REVOKE ALL ON public.care_proposal_comments FROM anon;
REVOKE ALL ON public.care_proposal_comments FROM authenticated;
GRANT SELECT ON public.care_proposals TO authenticated;
GRANT SELECT ON public.care_proposal_sends TO authenticated;
GRANT SELECT ON public.care_proposal_comments TO authenticated;
GRANT ALL ON public.care_proposals TO service_role;
GRANT ALL ON public.care_proposal_sends TO service_role;
GRANT ALL ON public.care_proposal_comments TO service_role;

DROP POLICY IF EXISTS "Granted people read sent proposals" ON public.care_proposals;
CREATE POLICY "Clinically granted people read proposals sent to them"
  ON public.care_proposals FOR SELECT TO authenticated
  USING (
    status = ANY (ARRAY['sent'::text, 'superseded'::text])
    AND private.care_has_scope(client_id, 'clinical')
    AND EXISTS (
      SELECT 1 FROM public.care_proposal_sends s
       WHERE s.proposal_id = care_proposals.id
         AND s.person_id IN (SELECT public.care_my_person_ids()))
  );

-- What a client said about one exact version.
CREATE TABLE public.care_proposal_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.care_proposals(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.care_people(id),
  response text NOT NULL CHECK (response IN ('agreed','changes_requested','call_requested')),
  comment text,
  responded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.care_proposal_responses IS
  'A response belongs to one proposal version. A later version inherits nothing.';

CREATE INDEX care_proposal_responses_proposal_idx
  ON public.care_proposal_responses (proposal_id, created_at DESC);

REVOKE ALL ON public.care_proposal_responses FROM anon;
REVOKE ALL ON public.care_proposal_responses FROM authenticated;
GRANT SELECT ON public.care_proposal_responses TO authenticated;
GRANT ALL ON public.care_proposal_responses TO service_role;

ALTER TABLE public.care_proposal_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read proposal responses"
  ON public.care_proposal_responses FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "People read their own proposal responses"
  ON public.care_proposal_responses FOR SELECT TO authenticated
  USING (person_id IN (SELECT public.care_my_person_ids()));

-- Status without content, for anyone with journey access to the client.
CREATE OR REPLACE FUNCTION public.care_proposal_status(_client_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _rows jsonb;
BEGIN
  IF NOT (private.has_role(auth.uid(), 'admin'::app_role)
          OR private.care_has_scope(_client_id, 'journey')) THEN
    RAISE EXCEPTION 'Not allowed to read this client''s proposals';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'proposal_id', p.id,
           'version', p.version,
           'status', p.status,
           'sent_at', p.sent_at,
           'withdrawn_at', p.withdrawn_at,
           'response', r.response,
           'responded_at', r.created_at
         ) ORDER BY p.version DESC), '[]'::jsonb)
    INTO _rows
    FROM public.care_proposals p
    LEFT JOIN LATERAL (
      SELECT response, created_at FROM public.care_proposal_responses x
       WHERE x.proposal_id = p.id ORDER BY created_at DESC LIMIT 1) r ON true
   WHERE p.client_id = _client_id
     AND p.status <> 'draft';

  RETURN _rows;
END;
$function$;

REVOKE ALL ON FUNCTION public.care_proposal_status(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.care_proposal_status(uuid) TO authenticated;

-- Agree, request changes, or ask for a call. Never issues a plan.
CREATE OR REPLACE FUNCTION public.care_proposal_respond(
  _proposal_id uuid, _response text, _comment text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _p public.care_proposals%ROWTYPE;
  _person uuid;
BEGIN
  IF _response NOT IN ('agreed','changes_requested','call_requested') THEN
    RAISE EXCEPTION 'That response could not be recorded';
  END IF;
  SELECT * INTO _p FROM public.care_proposals WHERE id = _proposal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That proposal is not on record'; END IF;
  IF _p.status <> 'sent' THEN RAISE EXCEPTION 'That proposal is not open for a response'; END IF;

  SELECT s.person_id INTO _person FROM public.care_proposal_sends s
   WHERE s.proposal_id = _proposal_id AND s.person_id IN (SELECT public.care_my_person_ids())
   LIMIT 1;

  IF _person IS NULL OR NOT private.care_has_scope(_p.client_id, 'clinical') THEN
    RAISE EXCEPTION 'Not allowed to respond to this proposal';
  END IF;

  IF _response = 'changes_requested'
     AND NULLIF(btrim(COALESCE(_comment, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Say what should change';
  END IF;

  INSERT INTO public.care_proposal_responses
    (proposal_id, client_id, person_id, response, comment, responded_by)
  VALUES (_proposal_id, _p.client_id, _person, _response,
          NULLIF(btrim(COALESCE(_comment, '')), ''), auth.uid());

  IF _response = 'changes_requested' THEN
    PERFORM private.care_work_add(
      _p.client_id, 'prepare_plan', 'Changes requested on the care proposal',
      'proposal_changes:' || _proposal_id::text,
      'The family have asked for changes to the proposal.', 'high', false,
      public.care_working_due(now(), 2), 'clinical', NULL, 'proposal_changes_requested');
  ELSIF _response = 'call_requested' THEN
    PERFORM private.care_work_add(
      _p.client_id, 'callback', 'Call the family about the proposal',
      'proposal_call:' || _proposal_id::text,
      'The family have asked for a call about the proposal.', 'high', false,
      public.care_working_due(now(), 1), 'care', NULL, 'proposal_call_requested');
  END IF;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_p.client_id, 'care_proposal_response',
          jsonb_build_object('proposal_id', _proposal_id, 'version', _p.version,
                             'response', _response), auth.uid());

  RETURN jsonb_build_object('ok', true, 'proposal_id', _proposal_id, 'response', _response);
END;
$function$;

REVOKE ALL ON FUNCTION public.care_proposal_respond(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.care_proposal_respond(uuid, text, text) TO authenticated;
