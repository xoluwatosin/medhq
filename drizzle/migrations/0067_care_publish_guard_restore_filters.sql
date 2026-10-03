CREATE OR REPLACE FUNCTION private.care_definition_publish_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
DECLARE
  _condition_problems text[] := ARRAY[
    'A condition names the question it reads',
    'That question is not in this definition',
    'A condition uses exactly one test',
    'That test is not one the engine can read'];
  _issues jsonb;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'published'
     AND OLD.definition IS DISTINCT FROM NEW.definition THEN
    RAISE EXCEPTION 'A published form cannot be edited. Publish a new version instead.';
  END IF;

  SELECT COALESCE(jsonb_agg(i), '[]'::jsonb) INTO _issues
    FROM jsonb_array_elements(private.care_definition_issues(NEW.definition)) i
   WHERE NOT ((i ->> 'problem') = ANY(_condition_problems));

  _issues := _issues || private.care_definition_condition_issues(NEW.definition);
  _issues := _issues || private.care_definition_carry_issues(NEW.definition);

  IF jsonb_array_length(_issues) > 0 THEN
    RAISE EXCEPTION 'This form cannot be published: % (%)',
      (_issues -> 0) ->> 'problem', (_issues -> 0) ->> 'path';
  END IF;
  RETURN NEW;
END;
$$;
