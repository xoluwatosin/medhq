-- Household membership and relationships recorded automatically whenever a
-- care recipient joins a care request, and website care requests routed into
-- care records server side.

CREATE OR REPLACE FUNCTION private.care_group_sync_recipient(_recipient_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _rr public.care_request_recipients%ROWTYPE;
  _group uuid;
  _enquirer uuid;
  _contact public.client_contacts%ROWTYPE;
  _code text;
BEGIN
  SELECT * INTO _rr FROM public.care_request_recipients WHERE id = _recipient_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT r.group_id, r.enquirer_person_id INTO _group, _enquirer
    FROM public.care_requests r WHERE r.id = _rr.request_id;
  IF _group IS NULL THEN RETURN; END IF;

  IF _rr.person_id IS NOT NULL THEN
    INSERT INTO public.care_group_members (group_id, person_id, role, created_by)
    VALUES (_group, _rr.person_id, 'care_recipient', auth.uid())
    ON CONFLICT (group_id, person_id, role) DO NOTHING;
  END IF;

  IF _enquirer IS NOT NULL THEN
    INSERT INTO public.care_group_members (group_id, person_id, role, created_by)
    VALUES (_group, _enquirer, 'enquirer', auth.uid())
    ON CONFLICT (group_id, person_id, role) DO NOTHING;
  END IF;

  SELECT * INTO _contact FROM public.client_contacts
   WHERE client_id = _rr.client_id AND person_id IS NOT NULL
   ORDER BY is_primary DESC NULLS LAST, created_at
   LIMIT 1;

  IF _contact.person_id IS NOT NULL AND _rr.person_id IS NOT NULL
     AND _contact.person_id <> _rr.person_id THEN
    _code := private.care_group_relationship_code(
      COALESCE(NULLIF(_contact.relationship, ''), _contact.relationship_other));
    INSERT INTO public.care_person_relationships
      (group_id, from_person_id, to_person_id, relationship_code, other_label, created_by)
    VALUES (_group, _contact.person_id, _rr.person_id, _code,
            CASE WHEN _code = 'other'
                 THEN NULLIF(COALESCE(NULLIF(_contact.relationship, ''), _contact.relationship_other), '')
                 ELSE NULL END,
            auth.uid())
    ON CONFLICT (from_person_id, to_person_id, relationship_code) DO NOTHING;

    INSERT INTO public.care_group_members (group_id, person_id, role, created_by)
    VALUES (_group, _contact.person_id, 'contact', auth.uid())
    ON CONFLICT (group_id, person_id, role) DO NOTHING;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION private.care_group_sync_recipient_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
BEGIN
  PERFORM private.care_group_sync_recipient(NEW.id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS care_group_sync_recipient ON public.care_request_recipients;
CREATE TRIGGER care_group_sync_recipient
AFTER INSERT OR UPDATE OF person_id ON public.care_request_recipients
FOR EACH ROW EXECUTE FUNCTION private.care_group_sync_recipient_trigger();

-- People who already look like the person behind a website care request.
-- A signal only: staff decide, nothing attaches itself.
CREATE OR REPLACE FUNCTION public.care_enquiry_matches(_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE _email text; _phone text; _out jsonb;
BEGIN
  PERFORM private.care_group_admin_guard();
  SELECT lower(btrim(COALESCE(email, ''))), btrim(COALESCE(phone, ''))
    INTO _email, _phone FROM public.contact_submissions WHERE id = _submission_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'person_id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone,
    'matched_on', CASE WHEN lower(COALESCE(p.email, '')) = _email THEN 'email' ELSE 'phone' END,
    'group_id', (SELECT r.group_id FROM public.care_requests r
                  WHERE r.enquirer_person_id = p.id ORDER BY r.created_at LIMIT 1),
    'group_name', (SELECT g.display_name FROM public.care_requests r
                     JOIN public.care_groups g ON g.id = r.group_id
                    WHERE r.enquirer_person_id = p.id ORDER BY r.created_at LIMIT 1)
  )), '[]'::jsonb) INTO _out
  FROM public.care_people p
  WHERE (_email <> '' AND lower(COALESCE(p.email, '')) = _email)
     OR (_phone <> '' AND p.phone = _phone);

  RETURN _out;
END;
$function$;

-- Turns a website care request into a care record. Attaches to an existing
-- household and person when staff name them; otherwise creates new ones.
CREATE OR REPLACE FUNCTION public.care_enquiry_convert(
  _submission_id uuid,
  _service_id uuid DEFAULT NULL,
  _client_group text DEFAULT NULL,
  _group_id uuid DEFAULT NULL,
  _person_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _s public.contact_submissions%ROWTYPE;
  _person uuid := _person_id;
  _group uuid := _group_id;
  _request uuid;
  _client uuid;
  _recipient uuid;
  _name text;
  _group_key text := _client_group;
BEGIN
  PERFORM private.care_group_admin_guard();
  SELECT * INTO _s FROM public.contact_submissions WHERE id = _submission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enquiry not found'; END IF;
  IF _s.care_client_id IS NOT NULL THEN
    RETURN jsonb_build_object('client_id', _s.care_client_id, 'already_converted', true);
  END IF;

  _name := NULLIF(btrim(COALESCE(_s.name, btrim(COALESCE(_s.first_name, '') || ' ' || COALESCE(_s.last_name, '')))), '');
  IF _name IS NULL THEN RAISE EXCEPTION 'This enquiry has no name to record'; END IF;

  IF _group_key IS NULL AND _service_id IS NOT NULL THEN
    SELECT COALESCE(s.client_group, s.client_groups[1]) INTO _group_key
      FROM public.services s WHERE s.id = _service_id;
  END IF;

  IF _person IS NULL THEN
    INSERT INTO public.care_people (full_name, first_name, last_name, email, phone, whatsapp, source, created_by)
    VALUES (_name, _s.first_name, _s.last_name,
            NULLIF(lower(btrim(COALESCE(_s.email, ''))), ''),
            NULLIF(btrim(COALESCE(_s.phone, '')), ''),
            NULLIF(btrim(COALESCE(_s.phone, '')), ''), 'enquiry', auth.uid())
    RETURNING id INTO _person;
  END IF;

  IF _group IS NULL THEN
    INSERT INTO public.care_groups (display_name, source, created_by)
    VALUES (_name || ' household', 'enquiry', auth.uid())
    RETURNING id INTO _group;
  END IF;

  SELECT r.id INTO _request FROM public.care_requests r
   WHERE r.group_id = _group AND r.status <> 'closed'
   ORDER BY r.created_at DESC LIMIT 1;
  IF _request IS NULL THEN
    INSERT INTO public.care_requests (group_id, enquirer_person_id, status, source,
                                      created_from_submission_id, created_by)
    VALUES (_group, _person, 'open', 'website_enquiry', _submission_id, auth.uid())
    RETURNING id INTO _request;
  ELSE
    UPDATE public.care_requests
       SET enquirer_person_id = COALESCE(enquirer_person_id, _person), updated_at = now()
     WHERE id = _request;
  END IF;

  INSERT INTO public.clients (full_name, first_name, last_name, service_id, client_group,
                              lga, created_from_submission_id)
  VALUES (_name, _s.first_name, _s.last_name, _service_id,
          COALESCE(_group_key, 'adult'), _s.city, _submission_id)
  RETURNING id INTO _client;

  INSERT INTO public.client_contacts (client_id, person_id, full_name, first_name, last_name,
                                      phone, whatsapp, email, is_primary, is_enquirer)
  VALUES (_client, _person, _name, _s.first_name, _s.last_name,
          _s.phone, _s.phone, _s.email, true, true);

  INSERT INTO public.care_request_recipients (request_id, person_id, client_id, display_order, created_by)
  VALUES (_request, _person, _client,
          COALESCE((SELECT max(display_order) + 1 FROM public.care_request_recipients
                     WHERE request_id = _request), 1), auth.uid())
  RETURNING id INTO _recipient;

  UPDATE public.contact_submissions
     SET care_client_id = _client, stage = COALESCE(NULLIF(stage, 'new'), 'contacted')
   WHERE id = _submission_id;

  INSERT INTO public.care_activity (client_id, action, detail, actor)
  VALUES (_client, 'converted_from_enquiry',
          jsonb_build_object('submission_id', _submission_id, 'request_id', _request,
                             'group_id', _group, 'person_id', _person), auth.uid());

  PERFORM public.care_refresh_stage(_client);

  RETURN jsonb_build_object('client_id', _client, 'request_id', _request, 'group_id', _group,
                            'person_id', _person, 'recipient_id', _recipient,
                            'already_converted', false);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.care_enquiry_matches(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_enquiry_convert(uuid, uuid, text, uuid, uuid) TO authenticated, service_role;
