-- Tranche 2A.1: canonical Care-domain person record.
-- Email is a contact and matching signal, never identity. No unique email.

CREATE TABLE public.care_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  preferred_name text,
  email text,
  phone text,
  whatsapp text,
  country text,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'staff',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_people TO authenticated;
GRANT ALL ON public.care_people TO service_role;
ALTER TABLE public.care_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage care people" ON public.care_people FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Non-unique search helpers. Several people may legitimately share an address.
CREATE INDEX care_people_email_lower_idx ON public.care_people (lower(email));
CREATE INDEX care_people_phone_idx ON public.care_people (phone);
CREATE INDEX care_people_auth_user_id_idx ON public.care_people (auth_user_id);

CREATE TRIGGER care_people_touch
  BEFORE UPDATE ON public.care_people
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- Link the per-client contact role to the human.
ALTER TABLE public.client_contacts
  ADD COLUMN person_id uuid REFERENCES public.care_people(id) ON DELETE RESTRICT;

CREATE INDEX client_contacts_person_id_idx ON public.client_contacts (person_id);

-- Migration-safety backfill: one distinct person per existing contact row.
-- Deliberately no deduplication by email, phone or name. Each contact keeps
-- the exact person made from its own values, so the pairing is per row and
-- never inferred from the ordering of generated ids.
DO $backfill$
DECLARE
  contact record;
  made_id uuid;
BEGIN
  FOR contact IN
    SELECT id, full_name, email, phone, whatsapp, country
    FROM public.client_contacts
    WHERE person_id IS NULL
    ORDER BY id
  LOOP
    INSERT INTO public.care_people (full_name, email, phone, whatsapp, country, source)
    VALUES (contact.full_name, contact.email, contact.phone, contact.whatsapp, contact.country, 'backfill')
    RETURNING id INTO made_id;

    UPDATE public.client_contacts SET person_id = made_id WHERE id = contact.id;
  END LOOP;
END
$backfill$;

-- Safety net so no contact can be written without a human behind it.
CREATE OR REPLACE FUNCTION public.care_contact_ensure_person()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.person_id IS NULL THEN
    INSERT INTO public.care_people (full_name, email, phone, whatsapp, country, source)
    VALUES (NEW.full_name, NEW.email, NEW.phone, NEW.whatsapp, NEW.country, 'auto')
    RETURNING id INTO NEW.person_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER client_contacts_ensure_person
  BEFORE INSERT ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.care_contact_ensure_person();
