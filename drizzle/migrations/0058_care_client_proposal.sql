CREATE TABLE IF NOT EXISTS public.care_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  plan_document_id uuid NOT NULL REFERENCES public.care_documents(id) ON DELETE RESTRICT,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','withdrawn','superseded')),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text,
  supersedes_id uuid REFERENCES public.care_proposals(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  sent_at timestamptz,
  sent_by uuid,
  withdrawn_at timestamptz,
  withdrawn_by uuid,
  UNIQUE (client_id, version)
);

CREATE INDEX IF NOT EXISTS care_proposals_client_idx ON public.care_proposals (client_id, status);

CREATE TABLE IF NOT EXISTS public.care_proposal_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.care_proposals(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.care_people(id) ON DELETE RESTRICT,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid,
  UNIQUE (proposal_id, person_id, sent_at)
);

CREATE INDEX IF NOT EXISTS care_proposal_sends_proposal_idx ON public.care_proposal_sends (proposal_id);

CREATE TABLE IF NOT EXISTS public.care_proposal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.care_proposals(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.care_people(id) ON DELETE RESTRICT,
  author_user_id uuid,
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_proposal_comments_proposal_idx
  ON public.care_proposal_comments (proposal_id, created_at);

GRANT SELECT ON public.care_proposals TO authenticated;
GRANT SELECT ON public.care_proposal_sends TO authenticated;
GRANT SELECT ON public.care_proposal_comments TO authenticated;
GRANT ALL ON public.care_proposals TO service_role;
GRANT ALL ON public.care_proposal_sends TO service_role;
GRANT ALL ON public.care_proposal_comments TO service_role;

ALTER TABLE public.care_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_proposal_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_proposal_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read proposals" ON public.care_proposals FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Granted people read sent proposals" ON public.care_proposals FOR SELECT TO authenticated
  USING (
    status IN ('sent','superseded')
    AND private.care_has_scope(client_id, 'journey')
    AND EXISTS (
      SELECT 1 FROM public.care_proposal_sends s
       WHERE s.proposal_id = care_proposals.id
         AND s.person_id IN (SELECT public.care_my_person_ids())
    )
  );

CREATE POLICY "Staff read proposal sends" ON public.care_proposal_sends FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "People read their own sends" ON public.care_proposal_sends FOR SELECT TO authenticated
  USING (person_id IN (SELECT public.care_my_person_ids()));

CREATE POLICY "Staff read proposal comments" ON public.care_proposal_comments FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "People read comments on proposals sent to them"
  ON public.care_proposal_comments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.care_proposal_sends s
     WHERE s.proposal_id = care_proposal_comments.proposal_id
       AND s.person_id IN (SELECT public.care_my_person_ids())
  ));

CREATE OR REPLACE FUNCTION private.care_proposal_sections()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['front_sheet','goals','the_day','the_week','personal_care','moving_about',
               'skin_food_continence','medicines','how_to_be','boundaries','who_is_coming',
               'review','agreement']
$$;

CREATE OR REPLACE FUNCTION private.care_proposal_freeze()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('sent','superseded','withdrawn') THEN
    IF NEW.content IS DISTINCT FROM OLD.content
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.plan_document_id IS DISTINCT FROM OLD.plan_document_id
       OR NEW.client_id IS DISTINCT FROM OLD.client_id
       OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
       OR NEW.sent_at IS DISTINCT FROM OLD.sent_at THEN
      RAISE EXCEPTION 'A proposal that has been sent cannot be changed';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS care_proposals_freeze ON public.care_proposals;
CREATE TRIGGER care_proposals_freeze BEFORE UPDATE ON public.care_proposals
FOR EACH ROW EXECUTE FUNCTION private.care_proposal_freeze();

CREATE OR REPLACE FUNCTION public.care_proposal_draft(_client_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _plan public.care_documents%ROWTYPE;
  _content jsonb := '{}'::jsonb;
  _key text;
  _existing public.care_proposals%ROWTYPE;
  _next integer;
BEGIN
  IF NOT private.care_ops_ok() THEN
    RAISE EXCEPTION 'Not allowed to prepare a care proposal';
  END IF;

  SELECT * INTO _plan FROM public.care_documents
   WHERE client_id = _client_id AND kind = 'care_plan'
   ORDER BY version DESC LIMIT 1;
  IF NOT FOUND THEN
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

  IF FOUND THEN
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
END $$;

CREATE OR REPLACE FUNCTION public.care_proposal_send(_proposal_id uuid, _person_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p public.care_proposals%ROWTYPE;
  _person uuid;
  _sent integer := 0;
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
         AND g.status = 'active' AND 'journey' = ANY (g.scopes)
    ) THEN
      RAISE EXCEPTION 'That person does not have access to this client''s journey';
    END IF;

    INSERT INTO public.care_proposal_sends (proposal_id, person_id, sent_by)
    VALUES (_proposal_id, _person, auth.uid());
    _sent := _sent + 1;

    PERFORM private.care_notify_record(
      'care_proposal_sent', _p.client_id,
      'proposal:' || _proposal_id::text || ':' || _person::text,
      'Your care proposal is ready', NULL, 'care_proposals', _proposal_id);
  END LOOP;

  IF _p.status = 'draft' THEN
    UPDATE public.care_proposals
       SET status = 'sent', sent_at = now(), sent_by = auth.uid()
     WHERE id = _proposal_id;
    UPDATE public.care_proposals SET status = 'superseded'
     WHERE id = _p.supersedes_id AND status = 'sent';
  END IF;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_p.client_id, 'care_proposal_sent',
          jsonb_build_object('proposal_id', _proposal_id, 'people', _sent), auth.uid());

  RETURN jsonb_build_object('ok', true, 'proposal_id', _proposal_id, 'sent', _sent);
END $$;

CREATE OR REPLACE FUNCTION public.care_proposal_withdraw(_proposal_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.care_proposals%ROWTYPE;
BEGIN
  IF NOT private.care_ops_ok() THEN
    RAISE EXCEPTION 'Not allowed to withdraw a care proposal';
  END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN
    RAISE EXCEPTION 'Give a reason for withdrawing the proposal';
  END IF;
  SELECT * INTO _p FROM public.care_proposals WHERE id = _proposal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That proposal is not on record'; END IF;
  IF _p.status = 'withdrawn' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'proposal_id', _proposal_id);
  END IF;

  UPDATE public.care_proposals
     SET status = 'withdrawn', withdrawn_at = now(), withdrawn_by = auth.uid()
   WHERE id = _proposal_id;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_p.client_id, 'care_proposal_withdrawn',
          jsonb_build_object('proposal_id', _proposal_id, 'reason', btrim(_reason)), auth.uid());

  RETURN jsonb_build_object('ok', true, 'proposal_id', _proposal_id);
END $$;

CREATE OR REPLACE FUNCTION public.care_proposal_comment(_proposal_id uuid, _body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  IF _person IS NULL AND NOT private.care_ops_ok() THEN
    RAISE EXCEPTION 'Not allowed to comment on this proposal';
  END IF;

  INSERT INTO public.care_proposal_comments (proposal_id, person_id, author_user_id, body)
  VALUES (_proposal_id, _person, auth.uid(), btrim(_body));

  RETURN jsonb_build_object('ok', true, 'proposal_id', _proposal_id);
END $$;

REVOKE ALL ON FUNCTION public.care_proposal_draft(uuid) FROM public;
REVOKE ALL ON FUNCTION public.care_proposal_send(uuid, uuid[]) FROM public;
REVOKE ALL ON FUNCTION public.care_proposal_withdraw(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.care_proposal_comment(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_proposal_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_proposal_send(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_proposal_withdraw(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_proposal_comment(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION private.care_plan_issue_ready(_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.care_assessment_work w
                  WHERE w.client_id = _client_id AND w.review_decision = 'accepted')
     AND EXISTS (SELECT 1 FROM public.care_episodes e
                  WHERE e.client_id = _client_id AND e.status = 'active'
                    AND e.service_configuration_id IS NOT NULL)
     AND EXISTS (SELECT 1 FROM public.care_delivery_assignments a
                  JOIN public.care_episodes e ON e.id = a.episode_id
                 WHERE e.client_id = _client_id AND a.status = 'active')
     AND EXISTS (SELECT 1 FROM public.care_proposals p
                  WHERE p.client_id = _client_id AND p.status = 'sent')
$$;