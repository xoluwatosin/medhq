-- The relationship recorded at intake is the care recipient's relationship to
-- the person arranging care ("Relationship to you"), so it is recorded from
-- the recipient outwards, with the matching inverse recorded alongside it.
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
  _raw text;
  _code text;
  _inverse text;
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
    _raw := NULLIF(COALESCE(NULLIF(_contact.relationship, ''), _contact.relationship_other), '');
    _code := private.care_group_relationship_code(_raw);
    SELECT inverse_code INTO _inverse FROM public.care_group_relationship_terms WHERE code = _code;

    INSERT INTO public.care_person_relationships
      (group_id, from_person_id, to_person_id, relationship_code, other_label, created_by)
    VALUES (_group, _rr.person_id, _contact.person_id, _code,
            CASE WHEN _code = 'other' THEN _raw ELSE NULL END, auth.uid())
    ON CONFLICT (from_person_id, to_person_id, relationship_code) DO NOTHING;

    IF _inverse IS NOT NULL THEN
      INSERT INTO public.care_person_relationships
        (group_id, from_person_id, to_person_id, relationship_code, other_label, created_by)
      VALUES (_group, _contact.person_id, _rr.person_id, _inverse, NULL, auth.uid())
      ON CONFLICT (from_person_id, to_person_id, relationship_code) DO NOTHING;
    END IF;

    INSERT INTO public.care_group_members (group_id, person_id, role, created_by)
    VALUES (_group, _contact.person_id, 'contact', auth.uid())
    ON CONFLICT (group_id, person_id, role) DO NOTHING;
  END IF;
END;
$function$;
