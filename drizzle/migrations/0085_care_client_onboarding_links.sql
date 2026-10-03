CREATE TABLE public.care_client_onboarding_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  intake jsonb NOT NULL DEFAULT '{}'::jsonb,
  position integer NOT NULL DEFAULT 1,
  destination_email text,
  delivery_method text CHECK (delivery_method IN ('email', 'copied')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  first_opened_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  request_id uuid REFERENCES public.care_requests(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  pre_assessment_token_id uuid REFERENCES public.care_access_tokens(id) ON DELETE SET NULL,
  duplicate_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_client_onboarding_links TO authenticated;
GRANT ALL ON public.care_client_onboarding_links TO service_role;

ALTER TABLE public.care_client_onboarding_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client onboarding links"
ON public.care_client_onboarding_links
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX care_client_onboarding_links_status_idx
ON public.care_client_onboarding_links(status, created_at DESC);

ALTER TABLE public.care_access_tokens
ADD COLUMN onboarding_link_id uuid REFERENCES public.care_client_onboarding_links(id) ON DELETE SET NULL,
ADD COLUMN suppress_auto_grant boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX care_access_tokens_onboarding_link_unique
ON public.care_access_tokens(onboarding_link_id)
WHERE onboarding_link_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.care_client_onboarding_complete(
  _onboarding_hash text,
  _pre_assessment_hash text,
  _intake jsonb,
  _expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _link public.care_client_onboarding_links%ROWTYPE;
  _enquirer jsonb;
  _recipient jsonb;
  _service_key text;
  _first_name text;
  _last_name text;
  _full_name text;
  _enquirer_person_id uuid;
  _recipient_person_id uuid;
  _client_id uuid;
  _primary_client_id uuid;
  _primary_reference text;
  _contact_id uuid;
  _group_id uuid;
  _request_id uuid;
  _request_recipient_id uuid;
  _intention_id uuid;
  _service_id uuid;
  _client_group text;
  _section text;
  _pre_token_id uuid;
  _display_order integer := 0;
  _duplicates jsonb := '[]'::jsonb;
  _email text;
  _phone text;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Not allowed to complete this onboarding';
  END IF;

  SELECT * INTO _link
  FROM public.care_client_onboarding_links
  WHERE token_hash = _onboarding_hash
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'This link is not valid'; END IF;
  IF _link.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'This link has been withdrawn'; END IF;
  IF _link.expires_at < now() THEN RAISE EXCEPTION 'This link has expired'; END IF;
  IF _link.status = 'completed' THEN
    RETURN jsonb_build_object(
      'request_id', _link.request_id,
      'client_id', _link.client_id,
      'pre_assessment_token_id', _link.pre_assessment_token_id,
      'already_completed', true
    );
  END IF;

  IF jsonb_typeof(_intake) <> 'object' OR jsonb_typeof(_intake -> 'enquirer') <> 'object'
     OR jsonb_typeof(_intake -> 'recipients') <> 'array'
     OR jsonb_array_length(_intake -> 'recipients') = 0 THEN
    RAISE EXCEPTION 'Complete the required details before continuing';
  END IF;

  _enquirer := _intake -> 'enquirer';
  _first_name := btrim(COALESCE(_enquirer ->> 'firstName', ''));
  _last_name := btrim(COALESCE(_enquirer ->> 'lastName', ''));
  _email := lower(btrim(COALESCE(_enquirer ->> 'email', '')));
  _phone := btrim(COALESCE(_enquirer ->> 'phone', ''));
  IF _first_name = '' OR _last_name = '' OR _email = '' OR _phone = '' THEN
    RAISE EXCEPTION 'First name, last name, phone and email are required';
  END IF;
  IF _email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address';
  END IF;

  SELECT COALESCE(jsonb_agg(signal), '[]'::jsonb) INTO _duplicates
  FROM (
    SELECT jsonb_build_object('kind', 'person', 'id', p.id, 'name', p.full_name,
      'matched_on', CASE WHEN lower(p.email) = _email THEN 'email' ELSE 'phone' END) AS signal
    FROM public.care_people p
    WHERE (_email <> '' AND lower(p.email) = _email) OR (_phone <> '' AND p.phone = _phone)
    LIMIT 20
  ) matches;

  _full_name := _first_name || ' ' || _last_name;
  INSERT INTO public.care_people (full_name, first_name, last_name, email, phone, whatsapp, source)
  VALUES (_full_name, _first_name, _last_name, _email, _phone, _phone, 'client_onboarding')
  RETURNING id INTO _enquirer_person_id;

  INSERT INTO public.care_groups (display_name, source)
  VALUES (_full_name || ' care group', 'client_onboarding')
  RETURNING id INTO _group_id;

  INSERT INTO public.care_requests (group_id, enquirer_person_id, status, source)
  VALUES (_group_id, _enquirer_person_id, 'open', 'client_onboarding')
  RETURNING id INTO _request_id;

  FOR _recipient IN SELECT value FROM jsonb_array_elements(_intake -> 'recipients') LOOP
    _display_order := _display_order + 1;
    _first_name := btrim(COALESCE(_recipient ->> 'firstName', ''));
    _last_name := btrim(COALESCE(_recipient ->> 'lastName', ''));
    IF _first_name = '' OR _last_name = '' THEN RAISE EXCEPTION 'Every care recipient needs a first and last name'; END IF;
    IF COALESCE(jsonb_array_length(COALESCE(_recipient -> 'services', '[]'::jsonb)), 0) = 0 THEN
      RAISE EXCEPTION 'Choose at least one service for every care recipient';
    END IF;
    IF COALESCE(_recipient ->> 'dobKnown', '') NOT IN ('yes', 'no') THEN
      RAISE EXCEPTION 'Enter a date of birth, or an approximate age for every care recipient';
    END IF;
    IF _recipient ->> 'dobKnown' = 'yes' AND btrim(COALESCE(_recipient ->> 'dateOfBirth', '')) = '' THEN
      RAISE EXCEPTION 'Enter the date of birth for every applicable care recipient';
    END IF;
    IF _recipient ->> 'dobKnown' = 'no' AND
       (COALESCE(_recipient ->> 'approxAge', '') !~ '^[0-9]+([.][0-9]+)?$' OR (_recipient ->> 'approxAge')::numeric < 0) THEN
      RAISE EXCEPTION 'Enter an approximate age for every applicable care recipient';
    END IF;
    IF COALESCE((_recipient ->> 'isEnquirer')::boolean, false) = false
       AND btrim(COALESCE(_recipient ->> 'relationship', '')) = '' THEN
      RAISE EXCEPTION 'Choose the relationship to every care recipient';
    END IF;
    _full_name := _first_name || ' ' || _last_name;

    IF COALESCE((_recipient ->> 'isEnquirer')::boolean, false) THEN
      _recipient_person_id := _enquirer_person_id;
    ELSE
      INSERT INTO public.care_people (full_name, first_name, last_name, email, phone, whatsapp, source)
      VALUES (
        _full_name, _first_name, _last_name,
        NULLIF(lower(btrim(COALESCE(_recipient ->> 'email', ''))), ''),
        NULLIF(btrim(COALESCE(_recipient ->> 'phone', '')), ''),
        NULLIF(btrim(COALESCE(_recipient ->> 'phone', '')), ''),
        'client_onboarding'
      ) RETURNING id INTO _recipient_person_id;
    END IF;

    _service_key := _recipient -> 'services' ->> 0;
    _section := CASE _service_key
      WHEN 'antenatal' THEN 's1' WHEN 'postnatal_mother' THEN 's2'
      WHEN 'newborn' THEN 's2' WHEN 'paediatric' THEN 's7'
      WHEN 'post_surgical' THEN 's3' WHEN 'eldercare' THEN 's4'
      WHEN 'clinical_home_care' THEN 's5' WHEN 'nanny' THEN 's6'
      WHEN 'additional_needs' THEN 's7' WHEN 'other' THEN 's8' END;
    SELECT s.id, COALESCE(s.client_group, s.client_groups[1]) INTO _service_id, _client_group
    FROM public.services s
    WHERE s.is_offered AND (
      s.slug = _service_key OR s.questionnaire_section = _section OR
      (_service_key = 'antenatal' AND s.slug = 'antenatal-care') OR
      (_service_key = 'postnatal_mother' AND s.slug = 'postnatal-care-omugwo') OR
      (_service_key = 'newborn' AND s.slug = 'paediatric-care') OR
      (_service_key = 'paediatric' AND s.slug = 'paediatric-care') OR
      (_service_key = 'post_surgical' AND s.slug = 'post-surgical-care') OR
      (_service_key = 'eldercare' AND s.slug = 'eldercare-companion-care') OR
      (_service_key = 'clinical_home_care' AND s.slug = 'clinical-home-care') OR
      (_service_key = 'nanny' AND s.slug = 'nanny-childcare') OR
      (_service_key = 'additional_needs' AND s.slug = 'children-additional-needs') OR
      (_service_key = 'other' AND s.slug = 'clinical-home-care')
    ) ORDER BY CASE WHEN s.slug = _service_key THEN 0 ELSE 1 END LIMIT 1;
    IF _service_id IS NULL THEN RAISE EXCEPTION 'A selected service is no longer available'; END IF;

    INSERT INTO public.clients (
      full_name, first_name, last_name, date_of_birth, age_years,
      date_of_birth_is_estimated, service_id, client_group
    ) VALUES (
      _full_name, _first_name, _last_name,
      CASE WHEN _recipient ->> 'dobKnown' = 'yes' THEN NULLIF(_recipient ->> 'dateOfBirth', '')::date ELSE NULL END,
      CASE WHEN _recipient ->> 'dobKnown' = 'no' THEN NULLIF(_recipient ->> 'approxAge', '')::integer ELSE NULL END,
      _recipient ->> 'dobKnown' = 'no', _service_id, _client_group
    ) RETURNING id INTO _client_id;

    IF _primary_client_id IS NULL THEN _primary_client_id := _client_id; END IF;

    INSERT INTO public.client_contacts (
      client_id, person_id, full_name, first_name, last_name, phone, whatsapp, email,
      relationship, relationship_code, relationship_other, is_primary, is_enquirer
    ) VALUES (
      _client_id, _enquirer_person_id,
      (_intake -> 'enquirer' ->> 'firstName') || ' ' || (_intake -> 'enquirer' ->> 'lastName'),
      _intake -> 'enquirer' ->> 'firstName', _intake -> 'enquirer' ->> 'lastName',
      _phone, _phone, _email,
      CASE WHEN COALESCE((_recipient ->> 'isEnquirer')::boolean, false) THEN 'Self' ELSE NULLIF(_recipient ->> 'relationship', '') END,
      CASE WHEN COALESCE((_recipient ->> 'isEnquirer')::boolean, false) THEN 'self' ELSE NULL END,
      NULLIF(_recipient ->> 'relationshipOther', ''), true, true
    ) RETURNING id INTO _contact_id;

    INSERT INTO public.care_request_recipients (
      request_id, person_id, client_id, display_order, intake_recipient_key
    ) VALUES (
      _request_id, _recipient_person_id, _client_id, _display_order, _recipient ->> 'id'
    ) RETURNING id INTO _request_recipient_id;

    FOR _service_key IN SELECT jsonb_array_elements_text(_recipient -> 'services') LOOP
      _service_id := NULL;
      _section := CASE _service_key
        WHEN 'antenatal' THEN 's1' WHEN 'postnatal_mother' THEN 's2'
        WHEN 'newborn' THEN 's2' WHEN 'paediatric' THEN 's7'
        WHEN 'post_surgical' THEN 's3' WHEN 'eldercare' THEN 's4'
        WHEN 'clinical_home_care' THEN 's5' WHEN 'nanny' THEN 's6'
        WHEN 'additional_needs' THEN 's7' WHEN 'other' THEN 's8' END;
      SELECT s.id INTO _service_id
      FROM public.services s
      WHERE s.is_offered AND (
        s.slug = _service_key OR s.questionnaire_section = _section OR
        (_service_key = 'antenatal' AND s.slug = 'antenatal-care') OR
        (_service_key = 'postnatal_mother' AND s.slug = 'postnatal-care-omugwo') OR
        (_service_key = 'newborn' AND s.slug = 'paediatric-care') OR
        (_service_key = 'paediatric' AND s.slug = 'paediatric-care') OR
        (_service_key = 'post_surgical' AND s.slug = 'post-surgical-care') OR
        (_service_key = 'eldercare' AND s.slug = 'eldercare-companion-care') OR
        (_service_key = 'clinical_home_care' AND s.slug = 'clinical-home-care') OR
        (_service_key = 'nanny' AND s.slug = 'nanny-childcare') OR
        (_service_key = 'additional_needs' AND s.slug = 'children-additional-needs') OR
        (_service_key = 'other' AND s.slug = 'clinical-home-care')
      ) ORDER BY CASE WHEN s.slug = _service_key THEN 0 ELSE 1 END LIMIT 1;
      IF _service_id IS NULL THEN RAISE EXCEPTION 'A selected service is no longer available'; END IF;

      INSERT INTO public.care_service_intentions (request_id, service_id, state, is_shared, source)
      VALUES (_request_id, _service_id, 'confirmed', false, 'client_onboarding')
      RETURNING id INTO _intention_id;
      INSERT INTO public.care_service_intention_recipients (intention_id, request_recipient_id)
      VALUES (_intention_id, _request_recipient_id);
    END LOOP;
  END LOOP;

  SELECT id INTO _request_recipient_id
  FROM public.care_request_recipients
  WHERE request_id = _request_id AND client_id = _primary_client_id;

  SELECT id INTO _contact_id
  FROM public.client_contacts
  WHERE client_id = _primary_client_id AND is_primary
  ORDER BY created_at LIMIT 1;

  INSERT INTO public.care_access_tokens (
    client_id, contact_id, person_id, token_hash, filler_type, purpose, expires_at,
    scope, request_id, request_recipient_id, covers_recipient_key,
    onboarding_link_id, suppress_auto_grant
  ) VALUES (
    _primary_client_id, _contact_id, _enquirer_person_id,
    encode(digest((SELECT enquiry_number FROM public.clients WHERE id = _primary_client_id) || '-' || _pre_assessment_hash, 'sha256'), 'hex'),
    CASE
      WHEN EXISTS (SELECT 1 FROM public.care_request_recipients WHERE request_id = _request_id AND person_id = _enquirer_person_id)
        THEN 'client'
      ELSE 'family_member'
    END,
    'pre_assessment', _expires_at, 'full', _request_id, _request_recipient_id,
    (SELECT intake_recipient_key FROM public.care_request_recipients WHERE id = _request_recipient_id),
    _link.id, true
  ) RETURNING id INTO _pre_token_id;

  UPDATE public.care_client_onboarding_links
  SET status = 'completed', intake = _intake, completed_at = now(), updated_at = now(),
      request_id = _request_id, client_id = _primary_client_id,
      pre_assessment_token_id = _pre_token_id, duplicate_signals = _duplicates
  WHERE id = _link.id;

  RETURN jsonb_build_object(
    'request_id', _request_id,
    'client_id', _primary_client_id,
    'pre_assessment_token_id', _pre_token_id,
    'duplicate_signals', _duplicates,
    'already_completed', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.care_client_onboarding_complete(text, text, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.care_client_onboarding_complete(text, text, jsonb, timestamptz) TO service_role;