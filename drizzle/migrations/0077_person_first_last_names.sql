-- Names are captured as first name and last name everywhere. The existing
-- full name column stays and is kept composed automatically, so every reader
-- of full_name continues to work unchanged.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.client_contacts ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.client_contacts ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.care_people ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.care_people ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.contact_submissions ADD COLUMN IF NOT EXISTS last_name text;

-- Split only the unambiguous two-part names. Anything else is left as it is
-- for a person to correct by hand.
UPDATE public.clients
   SET first_name = split_part(btrim(full_name), ' ', 1),
       last_name  = split_part(btrim(full_name), ' ', 2)
 WHERE first_name IS NULL
   AND array_length(regexp_split_to_array(btrim(coalesce(full_name, '')), '\s+'), 1) = 2;

UPDATE public.client_contacts
   SET first_name = split_part(btrim(full_name), ' ', 1),
       last_name  = split_part(btrim(full_name), ' ', 2)
 WHERE first_name IS NULL
   AND array_length(regexp_split_to_array(btrim(coalesce(full_name, '')), '\s+'), 1) = 2;

UPDATE public.care_people
   SET first_name = split_part(btrim(full_name), ' ', 1),
       last_name  = split_part(btrim(full_name), ' ', 2)
 WHERE first_name IS NULL
   AND array_length(regexp_split_to_array(btrim(coalesce(full_name, '')), '\s+'), 1) = 2;

UPDATE public.contact_submissions
   SET first_name = split_part(btrim(name), ' ', 1),
       last_name  = split_part(btrim(name), ' ', 2)
 WHERE first_name IS NULL
   AND array_length(regexp_split_to_array(btrim(coalesce(name, '')), '\s+'), 1) = 2;

-- Keep the single full name in step whenever the parts are supplied.
CREATE OR REPLACE FUNCTION public.care_compose_full_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  composed text;
BEGIN
  composed := btrim(concat_ws(' ', nullif(btrim(coalesce(NEW.first_name, '')), ''),
                                   nullif(btrim(coalesce(NEW.last_name, '')), '')));
  IF composed <> '' THEN
    NEW.full_name := composed;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_compose_full_name ON public.clients;
CREATE TRIGGER clients_compose_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.care_compose_full_name();

DROP TRIGGER IF EXISTS client_contacts_compose_full_name ON public.client_contacts;
CREATE TRIGGER client_contacts_compose_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.care_compose_full_name();

DROP TRIGGER IF EXISTS care_people_compose_full_name ON public.care_people;
CREATE TRIGGER care_people_compose_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name ON public.care_people
  FOR EACH ROW EXECUTE FUNCTION public.care_compose_full_name();