-- Upserts a form definition. Used to load definition JSON that is authored as
-- a file, so large question sets do not have to be pasted into a console.
CREATE OR REPLACE FUNCTION private.upsert_form_definition(_kind text, _version int, _status text, _def jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.form_definitions (kind, version, status, published_at, definition)
  VALUES (_kind, _version, _status, CASE WHEN _status = 'published' THEN now() ELSE NULL END, _def)
  ON CONFLICT (kind, version) DO UPDATE
    SET definition = EXCLUDED.definition,
        status = EXCLUDED.status,
        published_at = COALESCE(public.form_definitions.published_at, EXCLUDED.published_at),
        updated_at = now()
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION private.upsert_form_definition(text, int, text, jsonb) FROM PUBLIC;