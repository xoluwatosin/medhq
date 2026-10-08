-- Removing a care recipient added by mistake, and services that follow the
-- service already chosen for a recipient.
--
-- 1. care_request_recipient_remove takes a recipient off a request and removes
--    their care record, with a reason. A copy of what was removed, who removed
--    it and why is kept in care_record_removals, and each remaining record on
--    the request notes it. A record with history (a form, an assessment, a
--    quote, an invoice, a link sent, care delivered) cannot be removed this
--    way; care is ended on it instead.
-- 2. A recipient whose care record already names a service is linked to that
--    service on the request, so "recipient has no service" no longer appears
--    for someone the intake or staff already placed under a service.
-- 3. A service recorded on a request is confirmed unless staff say otherwise.

CREATE TABLE IF NOT EXISTS public.care_record_removals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid,
  client_id uuid NOT NULL,
  client_snapshot jsonb NOT NULL,
  recipient_snapshot jsonb NOT NULL,
  reason text NOT NULL,
  removed_by uuid,
  removed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.care_record_removals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY care_record_removals_admin_read ON public.care_record_removals
    FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.care_request_recipient_remove(_recipient_id uuid, _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _rr public.care_request_recipients%ROWTYPE;
  _c public.clients%ROWTYPE;
  _others integer;
  _history text;
  _sibling uuid;
BEGIN
  PERFORM private.care_group_admin_guard();
  IF COALESCE(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'Say why this recipient is being removed'; END IF;

  SELECT * INTO _rr FROM public.care_request_recipients WHERE id = _recipient_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That recipient is not on this request'; END IF;

  SELECT count(*) INTO _others FROM public.care_request_recipients
   WHERE request_id = _rr.request_id AND id <> _rr.id;
  IF _others = 0 THEN
    RAISE EXCEPTION 'This is the only person on the request. End care on their record instead.';
  END IF;

  SELECT * INTO _c FROM public.clients WHERE id = _rr.client_id FOR UPDATE;

  _history := CASE
    WHEN EXISTS (SELECT 1 FROM public.care_documents WHERE client_id = _c.id) THEN 'a form'
    WHEN EXISTS (SELECT 1 FROM public.care_access_tokens WHERE client_id = _c.id) THEN 'a link sent to the family'
    WHEN EXISTS (SELECT 1 FROM public.care_assessment_work WHERE client_id = _c.id) THEN 'an assessment'
    WHEN EXISTS (SELECT 1 FROM public.care_quotes WHERE client_id = _c.id) THEN 'a quote'
    WHEN EXISTS (SELECT 1 FROM public.paystack_invoices WHERE client_id = _c.id) THEN 'an invoice'
    WHEN EXISTS (SELECT 1 FROM public.care_episodes WHERE client_id = _c.id) THEN 'care delivered'
    ELSE NULL END;
  IF _history IS NOT NULL THEN
    RAISE EXCEPTION 'This record already has %, so it cannot be removed. End care on it instead.', _history;
  END IF;

  INSERT INTO public.care_record_removals
    (request_id, client_id, client_snapshot, recipient_snapshot, reason, removed_by)
  VALUES (_rr.request_id, _c.id, to_jsonb(_c), to_jsonb(_rr), btrim(_reason), auth.uid());

  FOR _sibling IN
    SELECT client_id FROM public.care_request_recipients WHERE request_id = _rr.request_id AND id <> _rr.id
  LOOP
    INSERT INTO public.care_activity (client_id, action, detail, actor_id)
    VALUES (_sibling, 'recipient_removed',
            jsonb_build_object('name', _c.full_name, 'reason', btrim(_reason), 'removed_client_id', _c.id),
            auth.uid());
  END LOOP;

  DELETE FROM public.clients WHERE id = _c.id;

  RETURN jsonb_build_object('removed', _c.full_name);
END;
$function$;

REVOKE ALL ON FUNCTION public.care_request_recipient_remove(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.care_request_recipient_remove(uuid, text) TO authenticated;

-- A recipient is linked to the service their care record names.
CREATE OR REPLACE FUNCTION private.care_recipient_service_sync(_recipient_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _rr public.care_request_recipients%ROWTYPE; _svc uuid; _int uuid;
BEGIN
  SELECT * INTO _rr FROM public.care_request_recipients WHERE id = _recipient_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT service_id INTO _svc FROM public.clients WHERE id = _rr.client_id;
  IF _svc IS NULL THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM public.care_service_intention_recipients l
      JOIN public.care_service_intentions i ON i.id = l.intention_id
     WHERE l.request_recipient_id = _rr.id AND i.service_id = _svc) THEN
    RETURN;
  END IF;
  SELECT id INTO _int FROM public.care_service_intentions
   WHERE request_id = _rr.request_id AND service_id = _svc AND state <> 'declined'
   ORDER BY created_at LIMIT 1;
  IF _int IS NULL THEN
    INSERT INTO public.care_service_intentions (request_id, service_id, state, is_shared, source)
    VALUES (_rr.request_id, _svc, 'confirmed', false, 'intake')
    RETURNING id INTO _int;
  END IF;
  INSERT INTO public.care_service_intention_recipients (intention_id, request_recipient_id)
  VALUES (_int, _rr.id)
  ON CONFLICT (intention_id, request_recipient_id) DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION private.care_recipient_service_sync(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.care_recipient_service_sync_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _id uuid;
BEGIN
  IF TG_TABLE_NAME = 'care_request_recipients' THEN
    PERFORM private.care_recipient_service_sync(NEW.id);
  ELSE
    FOR _id IN SELECT id FROM public.care_request_recipients WHERE client_id = NEW.id LOOP
      PERFORM private.care_recipient_service_sync(_id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE TRIGGER care_recipient_service_sync AFTER INSERT ON public.care_request_recipients
FOR EACH ROW EXECUTE FUNCTION private.care_recipient_service_sync_trigger();

CREATE TRIGGER care_client_service_sync AFTER UPDATE OF service_id ON public.clients
FOR EACH ROW WHEN (NEW.service_id IS DISTINCT FROM OLD.service_id)
EXECUTE FUNCTION private.care_recipient_service_sync_trigger();

ALTER TABLE public.care_service_intentions ALTER COLUMN state SET DEFAULT 'confirmed';

-- Recipients on open requests whose record names a service and who have no
-- service at all on the request.
DO $$
DECLARE _id uuid;
BEGIN
  FOR _id IN
    SELECT rr.id FROM public.care_request_recipients rr
      JOIN public.care_requests r ON r.id = rr.request_id AND r.status <> 'closed'
      JOIN public.clients c ON c.id = rr.client_id AND c.service_id IS NOT NULL
     WHERE NOT EXISTS (SELECT 1 FROM public.care_service_intention_recipients l WHERE l.request_recipient_id = rr.id)
  LOOP
    PERFORM private.care_recipient_service_sync(_id);
  END LOOP;
END $$;
