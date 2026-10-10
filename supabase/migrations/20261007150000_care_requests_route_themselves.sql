-- Care requests from the website go straight into Care.
--
-- A care request (one with kind_of_care or for_whom in its answers) becomes a
-- client as soon as it is saved: the enquirer as a person and the main
-- contact, a household, an open care request, and the client under the
-- service the family chose. When the care is for the enquirer, the client is
-- them. When it is for someone else, the website does not ask their name, so
-- the client reads "Name to confirm (via <enquirer>)" until staff change it.
-- A failure here never stops the request being saved: it stays in Enquiries
-- for staff to route by hand.
--
-- The hand route (care_enquiry_convert) wrote its activity to a column that
-- does not exist, care_activity.actor, so it has never succeeded. It now
-- writes actor_id.
--
-- contact_submissions.staff_notified_at records the staff email for each new
-- request, so it is sent once.

ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS staff_notified_at timestamptz;

CREATE OR REPLACE FUNCTION private.care_request_route(_submission_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _s public.contact_submissions%ROWTYPE;
  _self boolean;
  _who text;
  _enquirer text;
  _service uuid;
  _group_key text;
  _person uuid;
  _group uuid;
  _request uuid;
  _client uuid;
BEGIN
  SELECT * INTO _s FROM public.contact_submissions WHERE id = _submission_id FOR UPDATE;
  IF NOT FOUND OR _s.care_client_id IS NOT NULL THEN RETURN _s.care_client_id; END IF;
  IF NOT (COALESCE(_s.answers, '{}'::jsonb) ? 'kind_of_care' OR COALESCE(_s.answers, '{}'::jsonb) ? 'for_whom') THEN
    RETURN NULL;
  END IF;

  _enquirer := NULLIF(btrim(COALESCE(NULLIF(btrim(_s.name), ''),
                 btrim(COALESCE(_s.first_name, '') || ' ' || COALESCE(_s.last_name, '')))), '');
  IF _enquirer IS NULL THEN RETURN NULL; END IF;

  _self := COALESCE(_s.answers->>'for_whom', '') ~* '^for (me|themselves)$';
  _who := NULLIF(btrim(COALESCE(_s.answers->>'who_needs_care', '')), '');

  SELECT s.id, COALESCE(s.client_group, s.client_groups[1]) INTO _service, _group_key
    FROM public.services s WHERE s.slug = _s.service_line;

  INSERT INTO public.care_people (full_name, first_name, last_name, email, phone, whatsapp, source)
  VALUES (_enquirer, NULLIF(btrim(_s.first_name), ''), NULLIF(btrim(_s.last_name), ''),
          NULLIF(lower(btrim(COALESCE(_s.email, ''))), ''),
          NULLIF(btrim(COALESCE(_s.phone, '')), ''),
          NULLIF(btrim(COALESCE(_s.phone, '')), ''), 'enquiry')
  RETURNING id INTO _person;

  INSERT INTO public.care_groups (display_name, source)
  VALUES (_enquirer || ' household', 'enquiry')
  RETURNING id INTO _group;

  INSERT INTO public.care_requests (group_id, enquirer_person_id, status, source, created_from_submission_id)
  VALUES (_group, _person, 'open', 'website_enquiry', _submission_id)
  RETURNING id INTO _request;

  IF _self THEN
    INSERT INTO public.clients (full_name, first_name, last_name, person_id, service_id, client_group,
                                created_from_submission_id)
    VALUES (_enquirer, NULLIF(btrim(_s.first_name), ''), NULLIF(btrim(_s.last_name), ''), _person,
            _service, COALESCE(_group_key, 'adult'), _submission_id)
    RETURNING id INTO _client;
  ELSE
    INSERT INTO public.clients (full_name, service_id, client_group, created_from_submission_id)
    VALUES ('Name to confirm (via ' || _enquirer || ')', _service, COALESCE(_group_key, 'adult'), _submission_id)
    RETURNING id INTO _client;
  END IF;

  INSERT INTO public.client_contacts (client_id, person_id, full_name, first_name, last_name,
                                      phone, whatsapp, email, is_primary, is_enquirer)
  VALUES (_client, _person, _enquirer, NULLIF(btrim(_s.first_name), ''), NULLIF(btrim(_s.last_name), ''),
          _s.phone, _s.phone, NULLIF(lower(btrim(COALESCE(_s.email, ''))), ''), true, true);

  INSERT INTO public.care_request_recipients (request_id, person_id, client_id, display_order)
  VALUES (_request, CASE WHEN _self THEN _person END, _client, 1);

  UPDATE public.contact_submissions SET care_client_id = _client WHERE id = _submission_id;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_client, 'routed_from_website',
          jsonb_build_object('submission_id', _submission_id, 'request_id', _request, 'group_id', _group,
                             'person_id', _person, 'for_themselves', _self, 'who', _who), NULL);

  PERFORM public.care_refresh_stage(_client);
  RETURN _client;
END;
$function$;

REVOKE ALL ON FUNCTION private.care_request_route(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.care_request_route_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  BEGIN
    PERFORM private.care_request_route(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Care request % was not routed: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS care_request_route ON public.contact_submissions;
CREATE TRIGGER care_request_route AFTER INSERT ON public.contact_submissions
FOR EACH ROW EXECUTE FUNCTION private.care_request_route_trigger();

-- The hand route, with its activity written to the column that exists.
CREATE OR REPLACE FUNCTION public.care_enquiry_convert(_submission_id uuid, _service_id uuid DEFAULT NULL::uuid, _client_group text DEFAULT NULL::text, _group_id uuid DEFAULT NULL::uuid, _person_id uuid DEFAULT NULL::uuid)
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

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_client, 'converted_from_enquiry',
          jsonb_build_object('submission_id', _submission_id, 'request_id', _request,
                             'group_id', _group, 'person_id', _person), auth.uid());

  PERFORM public.care_refresh_stage(_client);

  RETURN jsonb_build_object('client_id', _client, 'request_id', _request, 'group_id', _group,
                            'person_id', _person, 'recipient_id', _recipient,
                            'already_converted', false);
END;
$function$;
