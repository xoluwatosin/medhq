-- Staffing changes must refresh the cached client stage, but a delivery
-- assignment carries the episode, not the client.
CREATE OR REPLACE FUNCTION private.care_delivery_stage_touch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _client uuid;
BEGIN
  SELECT e.client_id INTO _client FROM public.care_episodes e
   WHERE e.id = COALESCE(NEW.episode_id, OLD.episode_id);
  IF _client IS NOT NULL THEN PERFORM public.care_refresh_stage(_client); END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.care_delivery_stage_touch() FROM public;

DROP TRIGGER IF EXISTS care_delivery_assignments_stage ON public.care_delivery_assignments;
CREATE TRIGGER care_delivery_assignments_stage
  AFTER INSERT OR UPDATE OR DELETE ON public.care_delivery_assignments
  FOR EACH ROW EXECUTE FUNCTION private.care_delivery_stage_touch();