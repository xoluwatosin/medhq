-- Tranche 2A hardening: withdrawable bases, least-privilege client identity,
-- atomic contact/person edits.

-- 1. A grant may hold no scope at all once it is no longer usable, so that
--    withdrawing a basis can never be blocked by the grant it emptied.
ALTER TABLE public.care_access_grants
  DROP CONSTRAINT IF EXISTS care_access_grants_some_scope;
ALTER TABLE public.care_access_grants
  ADD CONSTRAINT care_access_grants_scope_state CHECK (
    journey_scope OR clinical_scope OR finance_scope
    OR state IN ('suspended','revoked')
  );

CREATE OR REPLACE FUNCTION public.care_basis_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.withdrawn_at IS NOT NULL AND OLD.withdrawn_at IS NULL THEN
    UPDATE public.care_access_grants
      SET clinical_scope = false, clinical_basis_id = NULL
      WHERE clinical_basis_id = NEW.id;
    UPDATE public.care_access_grants
      SET finance_scope = false, finance_basis_id = NULL
      WHERE finance_basis_id = NEW.id;
    -- Nothing is deleted: a grant with no scope left is kept as history and
    -- suspended so it cannot open anything.
    UPDATE public.care_access_grants
      SET state = 'suspended', suspended_at = COALESCE(suspended_at, now())
      WHERE state = 'active'
        AND NOT (journey_scope OR clinical_scope OR finance_scope);
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Least privilege: a grant no longer opens the whole client row.
DROP POLICY IF EXISTS "Granted people read their client" ON public.clients;

CREATE OR REPLACE FUNCTION public.care_my_clients()
RETURNS TABLE (client_id uuid, client_reference text, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT c.id,
         c.enquiry_number,
         COALESCE(NULLIF(c.preferred_name, ''), c.full_name)
  FROM public.clients c
  WHERE auth.uid() IS NOT NULL
    AND (
      private.care_has_scope(c.id, 'journey')
      OR private.care_has_scope(c.id, 'clinical')
      OR private.care_has_scope(c.id, 'finance')
    )
$$;
REVOKE ALL ON FUNCTION public.care_my_clients() FROM public;
GRANT EXECUTE ON FUNCTION public.care_my_clients() TO authenticated;

-- 3. One transaction for a contact edit: the client specific facts and the
--    person behind them move together or not at all.
CREATE OR REPLACE FUNCTION public.care_contact_save(
  _contact_id uuid,
  _full_name text,
  _relationship text,
  _phone text,
  _whatsapp text,
  _email text,
  _is_primary boolean,
  _country text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
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
$$;
REVOKE ALL ON FUNCTION public.care_contact_save(uuid, text, text, text, text, text, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_contact_save(uuid, text, text, text, text, text, boolean, text) TO authenticated;