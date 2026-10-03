-- Pass 7.5B: the care episode and the versioned service configuration it is
-- activated against. One care model; a service changes what modules apply, not
-- which application runs. A published configuration is never edited in place,
-- and publishing a new version never changes an episode already running.

-- ---------------------------------------------------------------- configuration
CREATE TABLE public.care_service_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code text NOT NULL REFERENCES public.services(slug) ON UPDATE CASCADE,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  effective_from timestamptz,
  effective_to timestamptz,
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  supersedes_id uuid REFERENCES public.care_service_configurations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  published_at timestamptz,
  published_by uuid,
  retired_at timestamptz,
  retired_by uuid,
  UNIQUE (service_code, version)
);
CREATE INDEX care_service_configurations_live_idx
  ON public.care_service_configurations(service_code, status, version DESC);

GRANT SELECT ON public.care_service_configurations TO authenticated;
GRANT ALL ON public.care_service_configurations TO service_role;
ALTER TABLE public.care_service_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read service configurations" ON public.care_service_configurations
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------- episodes
CREATE TABLE public.care_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_code text NOT NULL REFERENCES public.services(slug) ON UPDATE CASCADE,
  service_configuration_id uuid REFERENCES public.care_service_configurations(id) ON DELETE RESTRICT,
  service_configuration_version integer,
  configuration_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','active','paused','completed','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  activated_at timestamptz,
  activated_by uuid,
  ended_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_episodes_client_idx ON public.care_episodes(client_id, status);

GRANT SELECT ON public.care_episodes TO authenticated;
GRANT ALL ON public.care_episodes TO service_role;
ALTER TABLE public.care_episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read care episodes" ON public.care_episodes
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS care_episodes_touch ON public.care_episodes;
CREATE TRIGGER care_episodes_touch BEFORE UPDATE ON public.care_episodes
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- A published or retired configuration is a historical fact.
CREATE OR REPLACE FUNCTION private.care_service_config_freeze()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','private' AS $$
BEGIN
  IF OLD.status = 'draft' THEN RETURN NEW; END IF;

  IF NEW.modules IS DISTINCT FROM OLD.modules
     OR NEW.service_code IS DISTINCT FROM OLD.service_code
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.published_at IS DISTINCT FROM OLD.published_at
     OR NEW.published_by IS DISTINCT FROM OLD.published_by
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id
  THEN
    RAISE EXCEPTION 'That service configuration is published and cannot be changed. Publish a new version instead.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'published' AND NEW.status = 'retired')
  THEN
    RAISE EXCEPTION 'A published service configuration can only be retired';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS care_service_configurations_freeze ON public.care_service_configurations;
CREATE TRIGGER care_service_configurations_freeze
  BEFORE UPDATE ON public.care_service_configurations
  FOR EACH ROW EXECUTE FUNCTION private.care_service_config_freeze();

-- ---------------------------------------------------------------- resolver
-- Deterministic module resolution for one episode. Reads the frozen snapshot,
-- never today's configuration. A module marked required survives every age
-- default, service default, client preference and non-safety override.
CREATE OR REPLACE FUNCTION private.care_modules_resolve(
  _modules jsonb, _age integer, _capability text, _overrides jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  _m jsonb; _code text; _required boolean; _on boolean;
  _caps jsonb; _hidden jsonb := COALESCE(_overrides -> 'disable', '[]'::jsonb);
  _shown jsonb := COALESCE(_overrides -> 'enable', '[]'::jsonb);
  _out jsonb := '[]'::jsonb;
BEGIN
  FOR _m IN SELECT value FROM jsonb_array_elements(COALESCE(_modules, '[]'::jsonb)) LOOP
    _code := _m ->> 'code';
    CONTINUE WHEN COALESCE(_code, '') = '';
    _required := COALESCE((_m ->> 'required')::boolean, false);
    _on := COALESCE((_m ->> 'enabled')::boolean, true);

    IF NOT _required THEN
      IF _age IS NOT NULL AND (_m ? 'minAgeYears')
         AND _age < (_m ->> 'minAgeYears')::integer THEN _on := false; END IF;
      IF _age IS NOT NULL AND (_m ? 'maxAgeYears')
         AND _age > (_m ->> 'maxAgeYears')::integer THEN _on := false; END IF;

      _caps := _m -> 'capabilities';
      IF jsonb_typeof(_caps) = 'array' AND jsonb_array_length(_caps) > 0
         AND (_capability IS NULL OR NOT (_caps ? _capability)) THEN _on := false; END IF;

      IF _hidden ? _code THEN _on := false; END IF;
      IF _shown ? _code THEN _on := true; END IF;
    END IF;

    IF _required OR _on THEN
      _out := _out || jsonb_build_array(jsonb_build_object(
        'code', _code,
        'required', _required,
        'familyVisible', COALESCE((_m ->> 'familyVisible')::boolean, false),
        'options', COALESCE(_m -> 'options', '{}'::jsonb)));
    END IF;
  END LOOP;

  SELECT COALESCE(jsonb_agg(v ORDER BY v ->> 'code'), '[]'::jsonb) INTO _out
    FROM jsonb_array_elements(_out) v;
  RETURN _out;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_episode_modules(_episode_id uuid, _capability text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _e public.care_episodes%ROWTYPE; _age integer;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'You do not have permission to read care episodes';
  END IF;
  SELECT * INTO _e FROM public.care_episodes WHERE id = _episode_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That care episode could not be found'; END IF;

  SELECT public.care_age_years(c.date_of_birth) INTO _age
    FROM public.clients c WHERE c.id = _e.client_id;

  RETURN private.care_modules_resolve(
    COALESCE(_e.configuration_snapshot -> 'modules', '[]'::jsonb),
    _age, _capability, _e.overrides);
END;
$$;

-- ---------------------------------------------------------------- write paths
CREATE OR REPLACE FUNCTION private.care_ops_ok()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
  SELECT private.has_role(auth.uid(), 'admin'::app_role)
     AND private.has_admin_permission(auth.uid(), 'care_coordinator')
$$;

CREATE OR REPLACE FUNCTION public.care_service_config_draft(
  _service_code text, _modules jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _next integer; _prev uuid; _id uuid;
BEGIN
  IF NOT private.care_ops_ok() THEN
    RAISE EXCEPTION 'You do not have permission to change service configuration';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.services WHERE slug = _service_code) THEN
    RAISE EXCEPTION 'That service could not be found';
  END IF;
  IF jsonb_typeof(COALESCE(_modules, 'null'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Module configuration must be a list';
  END IF;

  SELECT COALESCE(max(version), 0) + 1 INTO _next
    FROM public.care_service_configurations WHERE service_code = _service_code;
  SELECT id INTO _prev FROM public.care_service_configurations
   WHERE service_code = _service_code AND status = 'published'
   ORDER BY version DESC LIMIT 1;

  INSERT INTO public.care_service_configurations
    (service_code, version, status, modules, supersedes_id, created_by)
  VALUES (_service_code, _next, 'draft', COALESCE(_modules, '[]'::jsonb), _prev, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_service_config_publish(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _c public.care_service_configurations%ROWTYPE;
BEGIN
  IF NOT private.care_ops_ok() THEN
    RAISE EXCEPTION 'You do not have permission to publish service configuration';
  END IF;
  SELECT * INTO _c FROM public.care_service_configurations WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That service configuration could not be found'; END IF;
  IF _c.status <> 'draft' THEN
    RAISE EXCEPTION 'Only a draft service configuration can be published';
  END IF;
  IF jsonb_array_length(COALESCE(_c.modules, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'A service configuration needs at least one module';
  END IF;

  UPDATE public.care_service_configurations
     SET status = 'published', published_at = now(), published_by = auth.uid(),
         effective_from = COALESCE(effective_from, now())
   WHERE id = _id;

  -- The previous published version is retired; episodes already on it keep
  -- their frozen snapshot and stay readable.
  UPDATE public.care_service_configurations
     SET status = 'retired', retired_at = now(), retired_by = auth.uid(),
         effective_to = COALESCE(effective_to, now())
   WHERE service_code = _c.service_code AND status = 'published' AND id <> _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_episode_create(
  _client_id uuid, _service_code text, _starts_at timestamptz DEFAULT NULL,
  _overrides jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _id uuid;
BEGIN
  IF NOT private.care_ops_ok() THEN
    RAISE EXCEPTION 'You do not have permission to open a care episode';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = _client_id) THEN
    RAISE EXCEPTION 'That client could not be found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.services WHERE slug = _service_code) THEN
    RAISE EXCEPTION 'That service could not be found';
  END IF;

  INSERT INTO public.care_episodes
    (client_id, service_code, status, starts_at, overrides, created_by)
  VALUES (_client_id, _service_code, 'planned', _starts_at,
          COALESCE(_overrides, '{}'::jsonb), auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_episode_activate(_episode_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _e public.care_episodes%ROWTYPE; _c public.care_service_configurations%ROWTYPE; _age integer;
BEGIN
  IF NOT private.care_ops_ok() THEN
    RAISE EXCEPTION 'You do not have permission to start a care episode';
  END IF;
  SELECT * INTO _e FROM public.care_episodes WHERE id = _episode_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That care episode could not be found'; END IF;
  IF _e.status = 'active' THEN RETURN; END IF;
  IF _e.status <> 'planned' THEN
    RAISE EXCEPTION 'Only a planned care episode can be started';
  END IF;

  SELECT * INTO _c FROM public.care_service_configurations
   WHERE service_code = _e.service_code AND status = 'published'
   ORDER BY version DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That service has no published configuration to start care against';
  END IF;

  SELECT public.care_age_years(c.date_of_birth) INTO _age
    FROM public.clients c WHERE c.id = _e.client_id;

  UPDATE public.care_episodes
     SET status = 'active',
         activated_at = now(), activated_by = auth.uid(),
         starts_at = COALESCE(starts_at, now()),
         service_configuration_id = _c.id,
         service_configuration_version = _c.version,
         configuration_snapshot = jsonb_build_object(
           'service_code', _e.service_code,
           'configuration_id', _c.id,
           'configuration_version', _c.version,
           'modules', _c.modules,
           'resolved', private.care_modules_resolve(_c.modules, _age, NULL, _e.overrides),
           'overrides', _e.overrides,
           'frozen_at', now())
   WHERE id = _episode_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_episode_set_status(
  _episode_id uuid, _status text, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _e public.care_episodes%ROWTYPE; _ok boolean;
BEGIN
  IF NOT private.care_ops_ok() THEN
    RAISE EXCEPTION 'You do not have permission to change a care episode';
  END IF;
  SELECT * INTO _e FROM public.care_episodes WHERE id = _episode_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That care episode could not be found'; END IF;

  _ok := (_e.status = 'planned' AND _status IN ('active','cancelled'))
      OR (_e.status = 'active'  AND _status IN ('paused','completed','cancelled'))
      OR (_e.status = 'paused'  AND _status IN ('active','completed','cancelled'));

  IF NOT _ok THEN
    RAISE EXCEPTION 'A % care episode cannot become %', _e.status, _status;
  END IF;

  IF _status = 'active' AND _e.status = 'planned' THEN
    PERFORM public.care_episode_activate(_episode_id);
    RETURN;
  END IF;

  UPDATE public.care_episodes
     SET status = _status,
         ended_reason = CASE WHEN _status IN ('completed','cancelled') THEN _reason ELSE ended_reason END,
         ends_at = CASE WHEN _status IN ('completed','cancelled') THEN COALESCE(ends_at, now()) ELSE ends_at END
   WHERE id = _episode_id;
END;
$$;

REVOKE ALL ON FUNCTION private.care_modules_resolve(jsonb, integer, text, jsonb) FROM public;
REVOKE ALL ON FUNCTION private.care_ops_ok() FROM public;
REVOKE ALL ON FUNCTION private.care_service_config_freeze() FROM public;

GRANT EXECUTE ON FUNCTION public.care_episode_modules(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_service_config_draft(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_service_config_publish(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_episode_create(uuid, text, timestamptz, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_episode_activate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_episode_set_status(uuid, text, text) TO authenticated;

COMMENT ON TABLE public.care_episodes IS
  'One period of agreed care delivery. Clinical and service boundary, not the commercial package; the package relationship is added additively in Tranche 8.';
COMMENT ON TABLE public.care_service_configurations IS
  'Versioned module configuration per service. Published versions are immutable and never change an episode already activated against an earlier version.';