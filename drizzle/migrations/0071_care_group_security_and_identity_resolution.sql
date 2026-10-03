-- Stage 1 correction: least-privilege on the care group foundation, and a
-- deliberate, never-guessed route from a recipient to a person record.
-- Additive only. No historical migration is edited, no clinical document moved.

-- ------------------------------------------------------------ least privilege
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'care_groups','care_group_members','care_person_relationships','care_requests',
    'care_request_recipients','care_service_intentions','care_service_intention_recipients',
    'care_assessment_visits','care_group_relationship_terms']
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage %s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Anyone reads relationship terms" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage relationship terms" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins read %s" ON public.%I', t, t);
    EXECUTE format($p$CREATE POLICY "Admins read %s" ON public.%I FOR SELECT TO authenticated
                     USING (private.has_role(auth.uid(), 'admin'::app_role))$p$, t, t);
  END LOOP;
END $$;

-- The governed relationship vocabulary is read by every signed-in coordinator.
DROP POLICY IF EXISTS "Signed in staff read relationship terms" ON public.care_group_relationship_terms;
CREATE POLICY "Signed in staff read relationship terms"
  ON public.care_group_relationship_terms FOR SELECT TO authenticated USING (true);

-- --------------------------------------------------- scoped person resolution
-- A recipient resolves to exactly one person because a member of staff said so.
-- Nothing is matched on an email address or a name, and nothing is ever merged.
CREATE OR REPLACE FUNCTION public.care_person_create(
  _full_name text, _preferred_name text DEFAULT NULL,
  _email text DEFAULT NULL, _phone text DEFAULT NULL, _whatsapp text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _id uuid;
BEGIN
  PERFORM private.care_group_admin_guard();
  IF COALESCE(btrim(_full_name), '') = '' THEN
    RAISE EXCEPTION 'A person needs a name';
  END IF;
  INSERT INTO public.care_people (full_name, preferred_name, email, phone, whatsapp, source, created_by)
  VALUES (btrim(_full_name), NULLIF(btrim(COALESCE(_preferred_name, '')), ''),
          NULLIF(btrim(lower(COALESCE(_email, ''))), ''), NULLIF(btrim(COALESCE(_phone, '')), ''),
          NULLIF(btrim(COALESCE(_whatsapp, '')), ''), 'care_intake', auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_recipient_person_link(
  _recipient_id uuid, _person_id uuid, _role text DEFAULT 'care_recipient')
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _group uuid; _existing uuid; _client uuid;
BEGIN
  PERFORM private.care_group_admin_guard();
  SELECT r.group_id, rr.person_id, rr.client_id INTO _group, _existing, _client
    FROM public.care_request_recipients rr
    JOIN public.care_requests r ON r.id = rr.request_id
   WHERE rr.id = _recipient_id;
  IF _group IS NULL THEN RAISE EXCEPTION 'Recipient not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.care_people WHERE id = _person_id) THEN
    RAISE EXCEPTION 'Person not found';
  END IF;
  IF _existing IS NOT NULL AND _existing <> _person_id THEN
    RAISE EXCEPTION 'This recipient is already a different person. Records are never merged.';
  END IF;

  UPDATE public.care_request_recipients SET person_id = _person_id WHERE id = _recipient_id;

  INSERT INTO public.care_group_members (group_id, person_id, role, created_by)
  VALUES (_group, _person_id, COALESCE(NULLIF(btrim(_role), ''), 'care_recipient'), auth.uid())
  ON CONFLICT (group_id, person_id, role) DO NOTHING;
END;
$function$;

-- One transaction: the person, the canonical care record, group membership and
-- the recipient row on the request. Called again with the same person it is a
-- no-op rather than a second record.
CREATE OR REPLACE FUNCTION public.care_recipient_create(
  _request_id uuid,
  _full_name text,
  _person_id uuid DEFAULT NULL,
  _preferred_name text DEFAULT NULL,
  _date_of_birth date DEFAULT NULL,
  _age_years integer DEFAULT NULL,
  _sex_code text DEFAULT NULL,
  _address_line text DEFAULT NULL,
  _landmark text DEFAULT NULL,
  _state_code text DEFAULT NULL,
  _lga_code text DEFAULT NULL,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _group uuid; _person uuid; _client uuid; _recipient uuid; _next integer;
BEGIN
  PERFORM private.care_group_admin_guard();
  SELECT group_id INTO _group FROM public.care_requests WHERE id = _request_id;
  IF _group IS NULL THEN RAISE EXCEPTION 'Care request not found'; END IF;
  IF COALESCE(btrim(_full_name), '') = '' THEN RAISE EXCEPTION 'A recipient needs a name'; END IF;

  _person := _person_id;
  IF _person IS NULL THEN
    _person := public.care_person_create(_full_name, _preferred_name, _email, _phone);
  ELSIF NOT EXISTS (SELECT 1 FROM public.care_people WHERE id = _person) THEN
    RAISE EXCEPTION 'Person not found';
  END IF;

  -- An existing recipient for this person on this request is reused.
  SELECT rr.id, rr.client_id INTO _recipient, _client
    FROM public.care_request_recipients rr
   WHERE rr.request_id = _request_id AND rr.person_id = _person;

  IF _recipient IS NULL THEN
    INSERT INTO public.clients
      (full_name, preferred_name, date_of_birth, age_years, sex_code,
       address_line, landmark, state_code, lga_code, stage)
    VALUES (btrim(_full_name), NULLIF(btrim(COALESCE(_preferred_name, '')), ''),
            _date_of_birth, _age_years, _sex_code,
            _address_line, _landmark, _state_code, _lga_code, 'new')
    RETURNING id INTO _client;

    SELECT COALESCE(MAX(display_order), 0) + 1 INTO _next
      FROM public.care_request_recipients WHERE request_id = _request_id;

    INSERT INTO public.care_request_recipients
      (request_id, client_id, person_id, address_line, landmark, state_code, lga_code,
       display_order, created_by)
    VALUES (_request_id, _client, _person, _address_line, _landmark, _state_code, _lga_code,
            _next, auth.uid())
    RETURNING id INTO _recipient;
  END IF;

  INSERT INTO public.care_group_members (group_id, person_id, role, created_by)
  VALUES (_group, _person, 'care_recipient', auth.uid())
  ON CONFLICT (group_id, person_id, role) DO NOTHING;

  RETURN jsonb_build_object('recipient_id', _recipient, 'client_id', _client, 'person_id', _person);
END;
$function$;

-- ------------------------------------------------------------------ readiness
-- What still has to be true before a request can be sent out. Facts only.
CREATE OR REPLACE FUNCTION public.care_request_readiness(_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _recipients integer; _unresolved integer; _services integer;
        _unserviced integer; _conflicts integer; _enquirer uuid; _out jsonb;
BEGIN
  PERFORM private.care_group_admin_guard();
  SELECT enquirer_person_id INTO _enquirer FROM public.care_requests WHERE id = _request_id;

  SELECT count(*), count(*) FILTER (WHERE person_id IS NULL)
    INTO _recipients, _unresolved
    FROM public.care_request_recipients WHERE request_id = _request_id;

  SELECT count(*) INTO _services
    FROM public.care_service_intentions WHERE request_id = _request_id;

  SELECT count(*) INTO _unserviced
    FROM public.care_request_recipients rr
   WHERE rr.request_id = _request_id
     AND NOT EXISTS (SELECT 1 FROM public.care_service_intention_recipients sir
                      WHERE sir.request_recipient_id = rr.id);

  SELECT count(*) INTO _conflicts
    FROM public.care_service_intention_recipients sir
    JOIN public.care_service_intentions si ON si.id = sir.intention_id
   WHERE si.request_id = _request_id AND sir.needs_clinical_resolution;

  _out := jsonb_build_object(
    'recipients', _recipients,
    'recipients_without_person', _unresolved,
    'services', _services,
    'recipients_without_service', _unserviced,
    'conflicts', _conflicts,
    'enquirer_set', _enquirer IS NOT NULL,
    'ready', _recipients > 0 AND _unresolved = 0 AND _services > 0
             AND _unserviced = 0 AND _conflicts = 0 AND _enquirer IS NOT NULL);
  RETURN _out;
END;
$function$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.care_person_create(text,text,text,text,text)',
    'public.care_recipient_person_link(uuid,uuid,text)',
    'public.care_recipient_create(uuid,text,uuid,text,date,integer,text,text,text,text,text,text,text)',
    'public.care_request_readiness(uuid)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, public', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;