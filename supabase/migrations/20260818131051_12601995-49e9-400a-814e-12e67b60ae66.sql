-- see /tmp/m.sql
CREATE OR REPLACE FUNCTION public.mu_parsed_norm(_field text, _value text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE v text := btrim(coalesce(_value, ''));
BEGIN
  IF v = '' THEN RETURN ''; END IF;
  IF _field = 'state' THEN RETURN lower(coalesce(public.mu_norm_state(v), v));
  ELSIF _field = 'lga' THEN RETURN lower(coalesce(public.mu_norm_lga(v), v));
  ELSIF _field = 'licensing_body' THEN RETURN lower(coalesce(public.mu_norm_body(v), v));
  ELSIF _field = 'years_experience' THEN RETURN coalesce(nullif(regexp_replace(v, '[^0-9]', '', 'g'), ''), '');
  END IF;
  RETURN lower(regexp_replace(v, '\s+', ' ', 'g'));
END;
$$;

CREATE OR REPLACE FUNCTION public.mu_ask_candidate_parsed_field(_id uuid, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE f public.mu_parsed_fields; held text; note text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  SELECT * INTO f FROM public.mu_parsed_fields WHERE id = _id;
  IF f.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not found'); END IF;

  SELECT v.held_value INTO held FROM public.mu_parsed_vs_held(f.person_id) v WHERE v.id = _id;

  note := coalesce(_note,
    CASE WHEN coalesce(btrim(held), '') = '' THEN 'We could not read this from your documents. Please tell us.'
         ELSE 'Your documents say "' || coalesce(f.value, '') || '" but your profile says "' || held ||
              '". Please confirm which is right.' END);

  UPDATE public.mu_parsed_fields
     SET status = 'queried', note = note, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   WHERE id = _id;

  UPDATE public.mu_field_conflicts
     SET status = 'asked_candidate', updated_at = now()
   WHERE parsed_field_id = _id AND status = 'open';

  INSERT INTO public.mu_activity (person_id, actor_id, action, detail)
  VALUES (f.person_id, auth.uid(), 'parsed_field_asked_candidate',
          jsonb_build_object('field', f.field, 'parsed', f.value, 'held', held));

  RETURN jsonb_build_object('ok', true, 'field', f.field);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_ask_candidate_parsed_field(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_ask_candidate_parsed_field(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mu_ask_candidate_parsed_fields_bulk(_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE i uuid; n int := 0;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  FOREACH i IN ARRAY coalesce(_ids, ARRAY[]::uuid[]) LOOP
    PERFORM public.mu_ask_candidate_parsed_field(i, NULL);
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'count', n);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_ask_candidate_parsed_fields_bulk(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_ask_candidate_parsed_fields_bulk(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.mu_settle_parsed_fields(_person_id uuid, _threshold numeric DEFAULT 0.8)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; agreed int := 0; filled int := 0; asked int := 0; empty int := 0;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  FOR r IN SELECT * FROM public.mu_parsed_vs_held(_person_id) WHERE status = 'pending' LOOP
    IF coalesce(btrim(r.parsed_value), '') = '' THEN
      UPDATE public.mu_parsed_fields SET status = 'superseded', reviewed_at = now() WHERE id = r.id;
      empty := empty + 1;
    ELSIF public.mu_parsed_norm(r.field, r.parsed_value) = public.mu_parsed_norm(r.field, r.held_value)
          AND coalesce(btrim(r.held_value), '') <> '' THEN
      UPDATE public.mu_parsed_fields SET status = 'accepted', reviewed_at = now() WHERE id = r.id;
      agreed := agreed + 1;
    ELSIF coalesce(btrim(r.held_value), '') = '' AND coalesce(r.confidence, 0) >= _threshold THEN
      PERFORM public.mu_review_parsed_field(r.id, 'accept');
      filled := filled + 1;
    ELSE
      PERFORM public.mu_ask_candidate_parsed_field(r.id, NULL);
      asked := asked + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'agreed', agreed, 'filled', filled,
                            'asked', asked, 'empty', empty);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_settle_parsed_fields(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_settle_parsed_fields(uuid, numeric) TO authenticated;