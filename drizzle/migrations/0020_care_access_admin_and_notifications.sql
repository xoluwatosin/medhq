-- Tranche 2B + Tranche 3: grant administration, journey access on submission,
-- and one durable notification delivery foundation.

-- 0. Pre-flight: a basis withdrawal must succeed whatever state the grant is
--    in. An invited single scope grant emptied by a withdrawal is suspended
--    exactly like an active one, so the scope/state check can never refuse it.
CREATE OR REPLACE FUNCTION public.care_basis_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.withdrawn_at IS NOT NULL AND OLD.withdrawn_at IS NULL THEN
    UPDATE public.care_access_grants g
      SET clinical_scope = CASE WHEN g.clinical_basis_id = NEW.id THEN false ELSE g.clinical_scope END,
          clinical_basis_id = CASE WHEN g.clinical_basis_id = NEW.id THEN NULL ELSE g.clinical_basis_id END,
          finance_scope = CASE WHEN g.finance_basis_id = NEW.id THEN false ELSE g.finance_scope END,
          finance_basis_id = CASE WHEN g.finance_basis_id = NEW.id THEN NULL ELSE g.finance_basis_id END,
          state = CASE
            WHEN g.state IN ('active','invited')
             AND NOT (g.journey_scope
               OR (CASE WHEN g.clinical_basis_id = NEW.id THEN false ELSE g.clinical_scope END)
               OR (CASE WHEN g.finance_basis_id = NEW.id THEN false ELSE g.finance_scope END))
            THEN 'suspended' ELSE g.state END,
          suspended_at = CASE
            WHEN g.state IN ('active','invited')
             AND NOT (g.journey_scope
               OR (CASE WHEN g.clinical_basis_id = NEW.id THEN false ELSE g.clinical_scope END)
               OR (CASE WHEN g.finance_basis_id = NEW.id THEN false ELSE g.finance_scope END))
            THEN COALESCE(g.suspended_at, now()) ELSE g.suspended_at END
      WHERE g.clinical_basis_id = NEW.id OR g.finance_basis_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- 1. Who may administer care access. Care operations, not the admin role.
CREATE OR REPLACE FUNCTION private.care_can_admin_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT _user_id IS NOT NULL
     AND private.has_admin_permission(_user_id, 'care_coordinator')
$$;
REVOKE ALL ON FUNCTION private.care_can_admin_access(uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.care_can_admin_access(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.care_access_caller_ok()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
      OR private.care_can_admin_access(auth.uid())
$$;
REVOKE ALL ON FUNCTION private.care_access_caller_ok() FROM public;
GRANT EXECUTE ON FUNCTION private.care_access_caller_ok() TO authenticated;

-- 2. Portal invitations. One live invitation per grant. The grant stays the
--    authority: an opened invitation never widens scope.
CREATE TABLE public.care_portal_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL REFERENCES public.care_access_grants(id) ON DELETE RESTRICT,
  person_id uuid NOT NULL REFERENCES public.care_people(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  destination text,
  expires_at timestamptz NOT NULL,
  first_opened_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_portal_invitations_grant_idx ON public.care_portal_invitations (grant_id);
CREATE INDEX care_portal_invitations_client_idx ON public.care_portal_invitations (client_id);
CREATE UNIQUE INDEX care_portal_invitations_live_one
  ON public.care_portal_invitations (grant_id)
  WHERE revoked_at IS NULL AND accepted_at IS NULL;

GRANT SELECT ON public.care_portal_invitations TO authenticated;
GRANT ALL ON public.care_portal_invitations TO service_role;
ALTER TABLE public.care_portal_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage portal invitations" ON public.care_portal_invitations FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER care_portal_invitations_touch
  BEFORE UPDATE ON public.care_portal_invitations
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- 3. Notifications. One durable record per logical send, whatever the channel.
CREATE TABLE public.care_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN (
    'pre_assessment_link',
    'portal_invitation',
    'account_setup'
  )),
  channel text NOT NULL CHECK (channel IN ('email','whatsapp','manual')),
  destination text,
  person_id uuid REFERENCES public.care_people(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  related_table text,
  related_id uuid,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sending','sent','failed','cancelled')),
  attempt_count integer NOT NULL DEFAULT 0,
  dedupe_key text NOT NULL,
  subject text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  provider_message_id text,
  provider_error text,
  origin text NOT NULL DEFAULT 'system',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_notifications_dedupe UNIQUE (dedupe_key)
);
CREATE INDEX care_notifications_client_idx ON public.care_notifications (client_id, created_at DESC);
CREATE INDEX care_notifications_person_idx ON public.care_notifications (person_id);
CREATE INDEX care_notifications_related_idx ON public.care_notifications (related_table, related_id);
CREATE INDEX care_notifications_status_idx ON public.care_notifications (status);

GRANT SELECT ON public.care_notifications TO authenticated;
GRANT ALL ON public.care_notifications TO service_role;
ALTER TABLE public.care_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read care notifications" ON public.care_notifications FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER care_notifications_touch
  BEFORE UPDATE ON public.care_notifications
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- One logical send, whatever replays it.
CREATE OR REPLACE FUNCTION public.care_notification_claim(
  _kind text,
  _channel text,
  _dedupe_key text,
  _destination text DEFAULT NULL,
  _person_id uuid DEFAULT NULL,
  _client_id uuid DEFAULT NULL,
  _contact_id uuid DEFAULT NULL,
  _related_table text DEFAULT NULL,
  _related_id uuid DEFAULT NULL,
  _subject text DEFAULT NULL,
  _origin text DEFAULT 'system'
)
RETURNS TABLE (id uuid, status text, attempt_count integer, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _row public.care_notifications%ROWTYPE; _created boolean := false;
BEGIN
  IF NOT private.care_access_caller_ok() THEN
    RAISE EXCEPTION 'Not allowed to queue notifications';
  END IF;

  SELECT * INTO _row FROM public.care_notifications WHERE dedupe_key = _dedupe_key;
  IF NOT FOUND THEN
    INSERT INTO public.care_notifications (
      kind, channel, destination, person_id, client_id, contact_id,
      related_table, related_id, subject, dedupe_key, origin, created_by
    ) VALUES (
      _kind, _channel, _destination, _person_id, _client_id, _contact_id,
      _related_table, _related_id, _subject, _dedupe_key, _origin, auth.uid()
    )
    RETURNING * INTO _row;
    _created := true;
  END IF;

  RETURN QUERY SELECT _row.id, _row.status, _row.attempt_count, _created;
END;
$$;
REVOKE ALL ON FUNCTION public.care_notification_claim(text, text, text, text, uuid, uuid, uuid, text, uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_notification_claim(text, text, text, text, uuid, uuid, uuid, text, uuid, text, text) TO authenticated, service_role;

-- An attempt is recorded before the provider is called, the outcome after.
CREATE OR REPLACE FUNCTION public.care_notification_attempt(_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _n integer;
BEGIN
  IF NOT private.care_access_caller_ok() THEN
    RAISE EXCEPTION 'Not allowed to send notifications';
  END IF;
  UPDATE public.care_notifications
    SET status = 'sending',
        attempt_count = attempt_count + 1,
        last_attempt_at = now(),
        provider_error = NULL
    WHERE id = _id AND status IN ('queued','failed','sending')
    RETURNING attempt_count INTO _n;
  IF _n IS NULL THEN
    RAISE EXCEPTION 'That notification cannot be attempted again';
  END IF;
  IF _n > 5 THEN
    RAISE EXCEPTION 'That notification has been attempted too many times';
  END IF;
  RETURN _n;
END;
$$;
REVOKE ALL ON FUNCTION public.care_notification_attempt(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.care_notification_attempt(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.care_notification_result(
  _id uuid,
  _ok boolean,
  _provider_message_id text DEFAULT NULL,
  _provider_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.care_access_caller_ok() THEN
    RAISE EXCEPTION 'Not allowed to record a delivery result';
  END IF;
  UPDATE public.care_notifications
    SET status = CASE WHEN _ok THEN 'sent' ELSE 'failed' END,
        sent_at = CASE WHEN _ok THEN now() ELSE sent_at END,
        failed_at = CASE WHEN _ok THEN failed_at ELSE now() END,
        provider_message_id = COALESCE(_provider_message_id, provider_message_id),
        provider_error = CASE WHEN _ok THEN NULL ELSE _provider_error END
    WHERE id = _id;
END;
$$;
REVOKE ALL ON FUNCTION public.care_notification_result(uuid, boolean, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_notification_result(uuid, boolean, text, text) TO authenticated, service_role;

-- 4. Recording and withdrawing a basis.
CREATE OR REPLACE FUNCTION public.care_basis_record(
  _client_id uuid,
  _person_id uuid,
  _basis_kind text,
  _evidence_note text DEFAULT NULL,
  _evidence_sighted boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _id uuid;
BEGIN
  IF NOT private.care_can_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to record an access basis';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.care_people WHERE id = _person_id) THEN
    RAISE EXCEPTION 'That person is not on record';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = _client_id) THEN
    RAISE EXCEPTION 'That client is not on record';
  END IF;

  INSERT INTO public.care_access_bases (
    person_id, client_id, basis_kind, evidence_note, evidence_sighted, recorded_by
  ) VALUES (
    _person_id, _client_id, _basis_kind,
    NULLIF(btrim(COALESCE(_evidence_note, '')), ''),
    COALESCE(_evidence_sighted, false), auth.uid()
  )
  RETURNING id INTO _id;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_client_id, 'access_basis_recorded',
          jsonb_build_object('person_id', _person_id, 'basis_kind', _basis_kind), auth.uid());

  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.care_basis_record(uuid, uuid, text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.care_basis_record(uuid, uuid, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.care_basis_withdraw(_basis_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _client uuid; _person uuid; _kind text;
BEGIN
  IF NOT private.care_can_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to withdraw an access basis';
  END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN
    RAISE EXCEPTION 'Give a reason for withdrawing this basis';
  END IF;

  UPDATE public.care_access_bases
    SET withdrawn_at = now(), withdrawn_by = auth.uid(), withdrawn_reason = btrim(_reason)
    WHERE id = _basis_id AND withdrawn_at IS NULL
    RETURNING client_id, person_id, basis_kind INTO _client, _person, _kind;
  IF _client IS NULL THEN
    RAISE EXCEPTION 'That basis is not on record, or has already been withdrawn';
  END IF;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_client, 'access_basis_withdrawn',
          jsonb_build_object('person_id', _person, 'basis_kind', _kind, 'reason', btrim(_reason)), auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.care_basis_withdraw(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_basis_withdraw(uuid, text) TO authenticated;

-- 5. Grant administration. One grant per person and client, always.
CREATE OR REPLACE FUNCTION public.care_grant_set(
  _client_id uuid,
  _person_id uuid,
  _journey boolean,
  _clinical_basis_id uuid,
  _finance_basis_id uuid,
  _reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _id uuid; _state text;
BEGIN
  IF NOT private.care_can_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to change access';
  END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN
    RAISE EXCEPTION 'Give a reason for this access decision';
  END IF;
  IF NOT COALESCE(_journey, false) AND _clinical_basis_id IS NULL AND _finance_basis_id IS NULL THEN
    RAISE EXCEPTION 'Choose at least one kind of access';
  END IF;

  SELECT id, state INTO _id, _state
    FROM public.care_access_grants WHERE person_id = _person_id AND client_id = _client_id;

  IF _id IS NULL THEN
    INSERT INTO public.care_access_grants (
      person_id, client_id, journey_scope,
      clinical_scope, clinical_basis_id, finance_scope, finance_basis_id,
      state, grant_reason, granted_by
    ) VALUES (
      _person_id, _client_id, COALESCE(_journey, false),
      _clinical_basis_id IS NOT NULL, _clinical_basis_id,
      _finance_basis_id IS NOT NULL, _finance_basis_id,
      'active', btrim(_reason), auth.uid()
    )
    RETURNING id INTO _id;
  ELSE
    UPDATE public.care_access_grants SET
      journey_scope = COALESCE(_journey, false),
      clinical_scope = _clinical_basis_id IS NOT NULL,
      clinical_basis_id = _clinical_basis_id,
      finance_scope = _finance_basis_id IS NOT NULL,
      finance_basis_id = _finance_basis_id,
      state = 'active',
      grant_reason = btrim(_reason),
      granted_by = auth.uid(),
      granted_at = now(),
      revoked_at = NULL, revoked_by = NULL, revoked_reason = NULL,
      suspended_at = NULL
    WHERE id = _id;
  END IF;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_client_id, 'access_granted',
          jsonb_build_object(
            'person_id', _person_id,
            'journey', COALESCE(_journey, false),
            'clinical', _clinical_basis_id IS NOT NULL,
            'finance', _finance_basis_id IS NOT NULL,
            'previous_state', _state,
            'reason', btrim(_reason)), auth.uid());

  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.care_grant_set(uuid, uuid, boolean, uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_grant_set(uuid, uuid, boolean, uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.care_grant_suspend(_grant_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _client uuid; _person uuid;
BEGIN
  IF NOT private.care_can_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to change access';
  END IF;
  UPDATE public.care_access_grants
    SET state = 'suspended', suspended_at = now()
    WHERE id = _grant_id AND state IN ('active','invited')
    RETURNING client_id, person_id INTO _client, _person;
  IF _client IS NULL THEN
    RAISE EXCEPTION 'That access is not open';
  END IF;
  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_client, 'access_suspended',
          jsonb_build_object('person_id', _person, 'reason', NULLIF(btrim(COALESCE(_reason, '')), '')), auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.care_grant_suspend(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_grant_suspend(uuid, text) TO authenticated;

-- Reactivation only puts back what the bases still support.
CREATE OR REPLACE FUNCTION public.care_grant_reactivate(_grant_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _client uuid; _person uuid;
BEGIN
  IF NOT private.care_can_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to change access';
  END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN
    RAISE EXCEPTION 'Give a reason for reopening this access';
  END IF;
  UPDATE public.care_access_grants
    SET state = 'active', suspended_at = NULL, grant_reason = btrim(_reason), granted_by = auth.uid()
    WHERE id = _grant_id AND state = 'suspended'
      AND (journey_scope OR clinical_scope OR finance_scope)
    RETURNING client_id, person_id INTO _client, _person;
  IF _client IS NULL THEN
    RAISE EXCEPTION 'That access cannot be reopened. Record a basis and grant it again.';
  END IF;
  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_client, 'access_reactivated',
          jsonb_build_object('person_id', _person, 'reason', btrim(_reason)), auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.care_grant_reactivate(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_grant_reactivate(uuid, text) TO authenticated;

-- Revocation is per person and per client. Nothing is deleted.
CREATE OR REPLACE FUNCTION public.care_grant_revoke(_grant_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _client uuid; _person uuid; _links integer := 0; _invites integer := 0; _queued integer := 0;
BEGIN
  IF NOT private.care_can_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to revoke access';
  END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN
    RAISE EXCEPTION 'Give a reason for revoking this access';
  END IF;

  UPDATE public.care_access_grants
    SET state = 'revoked', revoked_at = now(), revoked_by = auth.uid(), revoked_reason = btrim(_reason)
    WHERE id = _grant_id AND state <> 'revoked'
    RETURNING client_id, person_id INTO _client, _person;
  IF _client IS NULL THEN
    RAISE EXCEPTION 'That access has already been revoked';
  END IF;

  WITH revoked AS (
    UPDATE public.care_access_tokens
      SET revoked_at = now(), updated_at = now()
      WHERE client_id = _client AND person_id = _person
        AND revoked_at IS NULL AND frozen_at IS NULL AND submitted_at IS NULL
      RETURNING 1
  ) SELECT count(*) INTO _links FROM revoked;

  WITH killed AS (
    UPDATE public.care_portal_invitations
      SET revoked_at = now(), revoked_reason = btrim(_reason)
      WHERE grant_id = _grant_id AND revoked_at IS NULL AND accepted_at IS NULL
      RETURNING 1
  ) SELECT count(*) INTO _invites FROM killed;

  WITH stopped AS (
    UPDATE public.care_notifications
      SET status = 'cancelled'
      WHERE kind = 'portal_invitation' AND client_id = _client AND person_id = _person
        AND status IN ('queued','failed')
      RETURNING 1
  ) SELECT count(*) INTO _queued FROM stopped;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_client, 'access_revoked',
          jsonb_build_object('person_id', _person, 'reason', btrim(_reason),
                             'links_withdrawn', _links, 'invitations_withdrawn', _invites,
                             'sends_cancelled', _queued), auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.care_grant_revoke(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_grant_revoke(uuid, text) TO authenticated;

-- 6. Payer. Paying for care is not a reason to read a care plan.
CREATE OR REPLACE FUNCTION public.care_payer_set(_client_id uuid, _person_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.care_can_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to set the payer';
  END IF;
  IF _person_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.care_people WHERE id = _person_id
  ) THEN
    RAISE EXCEPTION 'That person is not on record';
  END IF;

  INSERT INTO public.client_commercial (client_id, payer_person_id)
  VALUES (_client_id, _person_id)
  ON CONFLICT (client_id) DO UPDATE SET payer_person_id = EXCLUDED.payer_person_id, updated_at = now();

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_client_id, 'payer_set', jsonb_build_object('person_id', _person_id), auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.care_payer_set(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.care_payer_set(uuid, uuid) TO authenticated;

-- 7. Journey access on pre-assessment submission. Deterministic, idempotent,
--    journey only, and never a quiet reversal of a staff revocation.
CREATE OR REPLACE FUNCTION public.care_journey_grant(
  _client_id uuid,
  _person_id uuid,
  _reason text,
  _origin text DEFAULT 'pre_assessment_submitted'
)
RETURNS TABLE (grant_id uuid, outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _id uuid; _state text; _journey boolean; _result text;
BEGIN
  IF NOT private.care_access_caller_ok() THEN
    RAISE EXCEPTION 'Not allowed to grant journey access';
  END IF;
  IF _person_id IS NULL OR _client_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, 'no_person'::text;
    RETURN;
  END IF;
  IF _origin = 'manual' AND (_reason IS NULL OR btrim(_reason) = '') THEN
    RAISE EXCEPTION 'Give a reason for granting journey access';
  END IF;

  SELECT id, state, journey_scope INTO _id, _state, _journey
    FROM public.care_access_grants WHERE person_id = _person_id AND client_id = _client_id;

  IF _id IS NULL THEN
    INSERT INTO public.care_access_grants (
      person_id, client_id, journey_scope, state, purpose, grant_reason, granted_by
    ) VALUES (
      _person_id, _client_id, true, 'active', 'arranging_contact',
      NULLIF(btrim(COALESCE(_reason, '')), ''), auth.uid()
    )
    RETURNING id INTO _id;
    _result := 'created';
  ELSIF _state = 'revoked' THEN
    RETURN QUERY SELECT _id, 'revoked_left_alone'::text;
    RETURN;
  ELSIF _journey THEN
    RETURN QUERY SELECT _id, 'already_held'::text;
    RETURN;
  ELSE
    UPDATE public.care_access_grants
      SET journey_scope = true,
          grant_reason = COALESCE(NULLIF(btrim(COALESCE(_reason, '')), ''), grant_reason)
      WHERE id = _id;
    _result := 'journey_added';
  END IF;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_client_id, 'journey_access_granted',
          jsonb_build_object('person_id', _person_id, 'origin', _origin,
                             'outcome', _result,
                             'reason', NULLIF(btrim(COALESCE(_reason, '')), '')), auth.uid());

  RETURN QUERY SELECT _id, _result;
END;
$$;
REVOKE ALL ON FUNCTION public.care_journey_grant(uuid, uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_journey_grant(uuid, uuid, text, text) TO authenticated, service_role;

-- 8. One read for the access section.
CREATE OR REPLACE FUNCTION public.care_access_overview(_client_id uuid)
RETURNS TABLE (
  person_id uuid,
  person_name text,
  email text,
  phone text,
  contact_id uuid,
  relationship text,
  is_primary boolean,
  is_payer boolean,
  grant_id uuid,
  grant_state text,
  journey_scope boolean,
  clinical_scope boolean,
  finance_scope boolean,
  grant_reason text,
  granted_at timestamptz,
  revoked_reason text,
  clinical_basis_id uuid,
  finance_basis_id uuid,
  bases jsonb,
  invitation jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.care_can_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to see access for this client';
  END IF;

  RETURN QUERY
  WITH people AS (
    SELECT cc.person_id AS pid FROM public.client_contacts cc
      WHERE cc.client_id = _client_id AND cc.person_id IS NOT NULL
    UNION
    SELECT g.person_id FROM public.care_access_grants g WHERE g.client_id = _client_id
    UNION
    SELECT b.person_id FROM public.care_access_bases b WHERE b.client_id = _client_id
    UNION
    SELECT cm.payer_person_id FROM public.client_commercial cm
      WHERE cm.client_id = _client_id AND cm.payer_person_id IS NOT NULL
  )
  SELECT
    p.id,
    COALESCE(NULLIF(p.preferred_name, ''), p.full_name),
    p.email,
    p.phone,
    cc.id,
    cc.relationship,
    COALESCE(cc.is_primary, false),
    EXISTS (SELECT 1 FROM public.client_commercial cm
              WHERE cm.client_id = _client_id AND cm.payer_person_id = p.id),
    g.id,
    g.state,
    COALESCE(g.journey_scope, false),
    COALESCE(g.clinical_scope, false),
    COALESCE(g.finance_scope, false),
    g.grant_reason,
    g.granted_at,
    g.revoked_reason,
    g.clinical_basis_id,
    g.finance_basis_id,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'basis_kind', b.basis_kind, 'evidence_note', b.evidence_note,
        'evidence_sighted', b.evidence_sighted, 'recorded_at', b.recorded_at,
        'withdrawn_at', b.withdrawn_at, 'withdrawn_reason', b.withdrawn_reason
      ) ORDER BY b.recorded_at DESC)
      FROM public.care_access_bases b
      WHERE b.client_id = _client_id AND b.person_id = p.id
    ), '[]'::jsonb),
    (
      SELECT jsonb_build_object(
        'id', i.id, 'expires_at', i.expires_at, 'accepted_at', i.accepted_at,
        'first_opened_at', i.first_opened_at, 'revoked_at', i.revoked_at,
        'destination', i.destination, 'created_at', i.created_at,
        'delivery_status', n.status, 'delivery_error', n.provider_error,
        'delivery_attempts', n.attempt_count, 'notification_id', n.id
      )
      FROM public.care_portal_invitations i
      LEFT JOIN public.care_notifications n
        ON n.related_table = 'care_portal_invitations' AND n.related_id = i.id
      WHERE i.client_id = _client_id AND i.person_id = p.id
      ORDER BY i.created_at DESC, n.created_at DESC
      LIMIT 1
    )
  FROM people pl
  JOIN public.care_people p ON p.id = pl.pid
  LEFT JOIN LATERAL (
    SELECT c.id, c.relationship, c.is_primary FROM public.client_contacts c
      WHERE c.client_id = _client_id AND c.person_id = p.id
      ORDER BY c.is_primary DESC, c.created_at LIMIT 1
  ) cc ON true
  LEFT JOIN public.care_access_grants g
    ON g.client_id = _client_id AND g.person_id = p.id
  ORDER BY COALESCE(cc.is_primary, false) DESC, COALESCE(NULLIF(p.preferred_name, ''), p.full_name);
END;
$$;
REVOKE ALL ON FUNCTION public.care_access_overview(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.care_access_overview(uuid) TO authenticated;