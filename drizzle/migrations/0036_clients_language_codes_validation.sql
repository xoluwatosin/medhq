-- Languages on a client are codes from the canonical Care list, both the ones
-- the client speaks and the one the care professional must speak. Anything
-- else is refused here, not only on the screen.
CREATE OR REPLACE FUNCTION private.clients_language_codes_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private
AS $$
BEGIN
  IF NEW.language_codes IS NOT NULL AND NOT public.care_languages_valid(NEW.language_codes) THEN
    RAISE EXCEPTION 'That is not a language we hold';
  END IF;
  IF NEW.care_language_codes IS NOT NULL AND NOT public.care_languages_valid(NEW.care_language_codes) THEN
    RAISE EXCEPTION 'That is not a language we hold';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_language_codes_guard ON public.clients;
CREATE TRIGGER clients_language_codes_guard
BEFORE INSERT OR UPDATE OF language_codes, care_language_codes ON public.clients
FOR EACH ROW EXECUTE FUNCTION private.clients_language_codes_guard();