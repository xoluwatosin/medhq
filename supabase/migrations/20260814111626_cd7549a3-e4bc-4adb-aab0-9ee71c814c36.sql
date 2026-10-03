CREATE OR REPLACE FUNCTION public.mu_resolve_field_conflict(_conflict_id uuid, _action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE c public.mu_field_conflicts; actor text; new_value text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF _action NOT IN ('accept', 'revert') THEN
    RAISE EXCEPTION 'Unknown action %', _action;
  END IF;

  SELECT * INTO c FROM public.mu_field_conflicts WHERE id = _conflict_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Conflict not found'; END IF;

  SELECT coalesce(display_name, email) INTO actor FROM public.admin_permissions WHERE user_id = auth.uid() LIMIT 1;

  -- accept = take the parsed value, revert = keep what we already hold.
  new_value := CASE WHEN _action = 'accept' THEN c.parsed_value ELSE c.stored_value END;

  IF c.field IN ('profession','current_position','state','lga','licensing_body','license_number','phone','email') THEN
    EXECUTE format('UPDATE public.mu_people SET %I = $1 WHERE id = $2', c.field)
      USING nullif(btrim(coalesce(new_value, '')), ''), c.person_id;
  ELSIF c.field = 'years_experience' THEN
    UPDATE public.mu_people
       SET years_experience = CASE WHEN new_value ~ '^[0-9]+$' THEN new_value::int ELSE years_experience END
     WHERE id = c.person_id;
  END IF;

  IF _action = 'accept' AND c.parsed_field_id IS NOT NULL THEN
    UPDATE public.mu_parsed_fields
       SET status = 'accepted', reviewed_by = auth.uid(), reviewed_at = now()
     WHERE id = c.parsed_field_id;
  ELSIF _action = 'revert' AND c.parsed_field_id IS NOT NULL THEN
    UPDATE public.mu_parsed_fields
       SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
     WHERE id = c.parsed_field_id;
  END IF;

  UPDATE public.mu_field_conflicts
     SET status = CASE WHEN _action = 'accept' THEN 'accepted' ELSE 'reverted' END,
         updated_at = now()
   WHERE id = _conflict_id;

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (c.person_id, auth.uid(), actor, 'field_conflict_' || _action,
          jsonb_build_object('field', c.field, 'stored_value', c.stored_value,
                             'parsed_value', c.parsed_value, 'kept', new_value));

  RETURN jsonb_build_object('status', 'ok');
END;
$function$;

CREATE OR REPLACE FUNCTION public.mu_open_field_conflicts(_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid, person_id uuid, full_name text, field text,
  stored_value text, parsed_value text, precedence text, created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id, c.person_id, p.full_name, c.field, c.stored_value, c.parsed_value, c.precedence, c.created_at
    FROM public.mu_field_conflicts c
    JOIN public.mu_people p ON p.id = c.person_id
   WHERE private.has_role(auth.uid(), 'admin'::app_role)
     AND c.status = 'open'
   ORDER BY c.created_at DESC
   LIMIT coalesce(_limit, 100);
$$;

REVOKE EXECUTE ON FUNCTION public.mu_open_field_conflicts(integer) FROM anon;