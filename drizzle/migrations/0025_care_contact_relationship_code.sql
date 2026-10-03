-- A contact's relationship is now a stable code. The free text column stays
-- readable and is kept in step, so nothing that reads it breaks.
CREATE OR REPLACE FUNCTION public.care_contact_save(
  _contact_id uuid,
  _full_name text,
  _relationship text,
  _phone text,
  _whatsapp text,
  _email text,
  _is_primary boolean,
  _country text DEFAULT NULL::text,
  _relationship_code text DEFAULT NULL::text,
  _relationship_other text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE _person uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to edit contacts';
  END IF;
  IF _full_name IS NULL OR btrim(_full_name) = '' THEN
    RAISE EXCEPTION 'A contact needs a name';
  END IF;

  SELECT person_id INTO _person FROM public.client_contacts WHERE id = _contact_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  UPDATE public.client_contacts SET
    full_name = btrim(_full_name),
    relationship = NULLIF(btrim(COALESCE(_relationship, '')), ''),
    relationship_code = COALESCE(NULLIF(btrim(COALESCE(_relationship_code, '')), ''), relationship_code),
    relationship_other = CASE
      WHEN NULLIF(btrim(COALESCE(_relationship_code, '')), '') = 'other'
        THEN NULLIF(btrim(COALESCE(_relationship_other, '')), '')
      WHEN NULLIF(btrim(COALESCE(_relationship_code, '')), '') IS NOT NULL THEN NULL
      ELSE relationship_other
    END,
    phone = NULLIF(btrim(COALESCE(_phone, '')), ''),
    whatsapp = NULLIF(btrim(COALESCE(_whatsapp, '')), ''),
    email = NULLIF(btrim(COALESCE(_email, '')), ''),
    country = COALESCE(NULLIF(btrim(COALESCE(_country, '')), ''), country),
    is_primary = COALESCE(_is_primary, false),
    updated_at = now()
  WHERE id = _contact_id;

  IF _person IS NOT NULL THEN
    UPDATE public.care_people SET
      full_name = btrim(_full_name),
      phone = NULLIF(btrim(COALESCE(_phone, '')), ''),
      whatsapp = NULLIF(btrim(COALESCE(_whatsapp, '')), ''),
      email = NULLIF(btrim(COALESCE(_email, '')), ''),
      country = COALESCE(NULLIF(btrim(COALESCE(_country, '')), ''), country),
      updated_at = now()
    WHERE id = _person;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The person behind this contact could not be updated';
    END IF;
  END IF;

  RETURN _contact_id;
END;
$function$;