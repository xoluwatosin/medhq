CREATE OR REPLACE FUNCTION public.mu_promote_parsed_fields(_person_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  queued int := 0;
  skipped int := 0;
  conflicts int := 0;
  r record;
  held text;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT private.has_role(auth.uid(), 'admin'::app_role)
     AND current_setting('mu.internal_caller', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  FOR r IN
    WITH best AS (
      SELECT DISTINCT ON (pf.person_id, pf.field)
             pf.id, pf.person_id, pf.field, btrim(pf.value) AS value, pf.confidence
        FROM public.mu_parsed_fields pf
       WHERE pf.field IN ('profession','licensing_body','state','lga','years_experience')
         AND coalesce(btrim(pf.value), '') <> ''
         AND pf.status <> 'candidate_updated'
         AND (_person_id IS NULL OR pf.person_id = _person_id)
       ORDER BY pf.person_id, pf.field, pf.confidence DESC, pf.created_at DESC
    )
    SELECT * FROM best
  LOOP
    IF r.field = 'years_experience' THEN
      UPDATE public.mu_parsed_fields
         SET status = 'superseded',
             note = 'Years of experience is not collected as a candidate profile fact.',
             updated_at = now()
       WHERE id = r.id AND status <> 'candidate_updated';
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    SELECT CASE r.field
             WHEN 'profession' THEN p.profession
             WHEN 'licensing_body' THEN p.licensing_body
             WHEN 'state' THEN p.state
             WHEN 'lga' THEN p.lga
           END
      INTO held
      FROM public.mu_people p
     WHERE p.id = r.person_id;

    UPDATE public.mu_parsed_fields
       SET status = 'queried',
           note = CASE
             WHEN coalesce(btrim(held), '') = ''
               THEN 'We found this in information already on file. Please confirm it or give the correct answer.'
             WHEN public.mu_parsed_norm(r.field, r.value) = public.mu_parsed_norm(r.field, held)
               THEN 'We already hold this answer. Please confirm it is correct or change it.'
             ELSE 'The information on file does not agree. Please give the correct answer.'
           END,
           updated_at = now()
     WHERE id = r.id
       AND status <> 'candidate_updated';

    IF FOUND THEN
      queued := queued + 1;
      INSERT INTO public.mu_activity (person_id, actor_id, action, detail)
      VALUES (
        r.person_id,
        auth.uid(),
        'parsed_field_queued_for_candidate',
        jsonb_build_object('field', r.field, 'parsed', r.value, 'held', held, 'parsed_field_id', r.id)
      );
    END IF;

    IF coalesce(btrim(held), '') <> ''
       AND public.mu_parsed_norm(r.field, held) <> public.mu_parsed_norm(r.field, r.value) THEN
      INSERT INTO public.mu_field_conflicts (person_id, field, stored_value, parsed_value, parsed_field_id)
      VALUES (r.person_id, r.field, held, r.value, r.id)
      ON CONFLICT (person_id, field) DO UPDATE
        SET stored_value = EXCLUDED.stored_value,
            parsed_value = EXCLUDED.parsed_value,
            parsed_field_id = EXCLUDED.parsed_field_id,
            status = 'asked_candidate',
            updated_at = now();
      conflicts := conflicts + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('promoted', 0, 'queued', queued, 'skipped', skipped, 'conflicts', conflicts);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mu_settle_parsed_fields(_person_id uuid, _threshold numeric DEFAULT 0.8)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  asked int := 0;
  empty int := 0;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  FOR r IN
    SELECT *
      FROM public.mu_parsed_vs_held(_person_id)
     WHERE status NOT IN ('candidate_updated', 'superseded')
  LOOP
    IF coalesce(btrim(r.parsed_value), '') = '' THEN
      UPDATE public.mu_parsed_fields
         SET status = 'superseded', reviewed_at = now(), updated_at = now()
       WHERE id = r.id;
      empty := empty + 1;
    ELSIF r.field = 'years_experience' THEN
      UPDATE public.mu_parsed_fields
         SET status = 'superseded',
             note = 'Years of experience is not collected as a candidate profile fact.',
             reviewed_at = now(),
             updated_at = now()
       WHERE id = r.id;
      empty := empty + 1;
    ELSE
      PERFORM public.mu_ask_candidate_parsed_field(r.id, NULL);
      asked := asked + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'agreed', 0, 'filled', 0, 'asked', asked, 'empty', empty);
END;
$function$;