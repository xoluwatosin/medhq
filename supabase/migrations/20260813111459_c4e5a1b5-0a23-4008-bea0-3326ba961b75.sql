-- 1. Intake health -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mu_intake_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT jsonb_build_object(
    'people_total', (SELECT count(*) FROM public.mu_people),
    'people_today', (SELECT count(*) FROM public.mu_people WHERE created_at >= date_trunc('day', now())),
    'people_week', (SELECT count(*) FROM public.mu_people WHERE created_at >= now() - interval '7 days'),
    'docs_pending', (SELECT count(*) FROM public.mu_documents WHERE review_outcome = 'pending'),
    'docs_today', (SELECT count(*) FROM public.mu_documents WHERE created_at >= date_trunc('day', now())),
    'docs_by_source', (
      SELECT coalesce(jsonb_object_agg(source_table, n), '{}'::jsonb)
      FROM (SELECT source_table, count(*) AS n FROM public.mu_documents GROUP BY source_table) s
    ),
    'parse_status', (
      SELECT coalesce(jsonb_object_agg(coalesce(parse_status, 'unknown'), n), '{}'::jsonb)
      FROM (SELECT parse_status, count(*) AS n FROM public.mu_people GROUP BY parse_status) s
    ),
    'no_cv', (
      SELECT count(*) FROM public.mu_people p
      WHERE NOT EXISTS (
        SELECT 1 FROM public.mu_documents d
        WHERE d.person_id = p.id AND d.doc_type = 'CV'
      )
    ),
    'parsed_pending', (SELECT count(*) FROM public.mu_parsed_fields WHERE status = 'pending'),
    'conflicts_open', (SELECT count(*) FROM public.mu_field_conflicts WHERE status = 'open'),
    'merges_open', (SELECT count(*) FROM public.mu_merge_candidates WHERE status = 'open'),
    'uninvited', (SELECT count(*) FROM public.mu_people WHERE email IS NOT NULL AND invited_at IS NULL),
    'invited_unclaimed', (SELECT count(*) FROM public.mu_people WHERE invited_at IS NOT NULL AND claimed_at IS NULL)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.mu_intake_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_intake_health() TO authenticated;

-- People whose CV could not be read, or who have never been read at all.
CREATE OR REPLACE FUNCTION public.mu_parse_backlog(_limit integer DEFAULT 100)
RETURNS TABLE (
  person_id uuid,
  full_name text,
  email text,
  parse_status text,
  has_cv boolean,
  cv_document_id uuid,
  cv_label text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, p.parse_status,
         d.id IS NOT NULL, d.id, d.label, p.created_at
  FROM public.mu_people p
  LEFT JOIN LATERAL (
    SELECT id, label FROM public.mu_documents dd
    WHERE dd.person_id = p.id AND dd.doc_type = 'CV'
    ORDER BY dd.created_at DESC LIMIT 1
  ) d ON true
  WHERE private.has_role(auth.uid(), 'admin'::public.app_role)
    AND coalesce(p.parse_status, 'not_parsed') <> 'parsed'
  ORDER BY (p.parse_status = 'failed') DESC, p.created_at DESC
  LIMIT coalesce(_limit, 100);
$$;

REVOKE ALL ON FUNCTION public.mu_parse_backlog(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_parse_backlog(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.mu_requeue_parse(_person_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  UPDATE public.mu_people SET parse_status = 'not_parsed' WHERE id = _person_id;

  INSERT INTO public.mu_activity (person_id, actor_id, action, detail)
  VALUES (_person_id, auth.uid(), 'cv_parse_requeued', '{}'::jsonb);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_requeue_parse(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_requeue_parse(uuid) TO authenticated;

-- 2. Parsed versus held -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mu_parsed_vs_held(_person_id uuid)
RETURNS TABLE (
  id uuid,
  field text,
  parsed_value text,
  held_value text,
  confidence numeric,
  evidence text,
  status text,
  document_label text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  SELECT pf.id,
         pf.field,
         pf.value,
         CASE pf.field
           WHEN 'full_name' THEN p.full_name
           WHEN 'email' THEN p.email
           WHEN 'phone' THEN p.phone
           WHEN 'profession' THEN p.profession
           WHEN 'current_position' THEN p.current_position
           WHEN 'years_experience' THEN p.years_experience::text
           WHEN 'state' THEN p.state
           WHEN 'lga' THEN p.lga
           WHEN 'licensing_body' THEN p.licensing_body
           WHEN 'license_number' THEN p.license_number
           WHEN 'license_expiry' THEN p.license_expiry::text
           ELSE NULL
         END,
         pf.confidence,
         pf.evidence,
         pf.status,
         d.label
  FROM public.mu_parsed_fields pf
  LEFT JOIN public.mu_people p ON p.id = pf.person_id
  LEFT JOIN public.mu_documents d ON d.id = pf.document_id
  WHERE pf.person_id = _person_id
  ORDER BY (pf.status = 'pending') DESC, pf.confidence DESC NULLS LAST, pf.field;
END;
$$;

REVOKE ALL ON FUNCTION public.mu_parsed_vs_held(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_parsed_vs_held(uuid) TO authenticated;

-- Accept a parsed value onto the profile, or keep the one we already hold.
CREATE OR REPLACE FUNCTION public.mu_review_parsed_field(_id uuid, _action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f public.mu_parsed_fields;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF _action NOT IN ('accept', 'keep') THEN
    RAISE EXCEPTION 'action must be accept or keep';
  END IF;

  SELECT * INTO f FROM public.mu_parsed_fields WHERE id = _id;
  IF f.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not found');
  END IF;

  IF _action = 'accept' AND f.value IS NOT NULL AND btrim(f.value) <> '' THEN
    CASE f.field
      WHEN 'full_name' THEN UPDATE public.mu_people SET full_name = f.value WHERE id = f.person_id;
      WHEN 'phone' THEN UPDATE public.mu_people SET phone = f.value WHERE id = f.person_id;
      WHEN 'profession' THEN UPDATE public.mu_people
        SET profession = f.value, profession_source = 'cv_reviewed' WHERE id = f.person_id;
      WHEN 'current_position' THEN UPDATE public.mu_people SET current_position = f.value WHERE id = f.person_id;
      WHEN 'years_experience' THEN UPDATE public.mu_people
        SET years_experience = nullif(regexp_replace(f.value, '[^0-9]', '', 'g'), '')::int WHERE id = f.person_id;
      WHEN 'state' THEN UPDATE public.mu_people SET state = f.value WHERE id = f.person_id;
      WHEN 'lga' THEN UPDATE public.mu_people SET lga = f.value WHERE id = f.person_id;
      WHEN 'licensing_body' THEN UPDATE public.mu_people SET licensing_body = f.value WHERE id = f.person_id;
      WHEN 'license_number' THEN UPDATE public.mu_people SET license_number = f.value WHERE id = f.person_id;
      WHEN 'license_expiry' THEN
        BEGIN
          UPDATE public.mu_people SET license_expiry = f.value::date WHERE id = f.person_id;
        EXCEPTION WHEN others THEN NULL;
        END;
      ELSE NULL;
    END CASE;
  END IF;

  UPDATE public.mu_parsed_fields
  SET status = CASE WHEN _action = 'accept' THEN 'accepted' ELSE 'superseded' END,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = _id;

  UPDATE public.mu_field_conflicts
  SET status = 'resolved', updated_at = now()
  WHERE parsed_field_id = _id AND status = 'open';

  INSERT INTO public.mu_activity (person_id, actor_id, action, detail)
  VALUES (
    f.person_id, auth.uid(),
    CASE WHEN _action = 'accept' THEN 'parsed_field_accepted' ELSE 'parsed_field_kept_ours' END,
    jsonb_build_object('field', f.field, 'value', f.value)
  );

  RETURN jsonb_build_object('ok', true, 'field', f.field);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_review_parsed_field(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_review_parsed_field(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mu_review_parsed_fields_bulk(_ids uuid[], _action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i uuid;
  n integer := 0;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  FOREACH i IN ARRAY coalesce(_ids, ARRAY[]::uuid[]) LOOP
    PERFORM public.mu_review_parsed_field(i, _action);
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'count', n);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_review_parsed_fields_bulk(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_review_parsed_fields_bulk(uuid[], text) TO authenticated;

-- 3. Shortlist stages ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mu_shortlist_set_stage(_id uuid, _status text, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.mu_shortlists;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF _status NOT IN ('shortlisted', 'put_forward', 'client_interviewing', 'placed', 'withdrawn') THEN
    RAISE EXCEPTION 'unknown stage %', _status;
  END IF;

  SELECT * INTO s FROM public.mu_shortlists WHERE id = _id;
  IF s.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not found');
  END IF;

  UPDATE public.mu_shortlists
  SET status = _status,
      note = coalesce(_note, note),
      updated_at = now()
  WHERE id = _id;

  INSERT INTO public.mu_activity (person_id, actor_id, action, detail)
  VALUES (s.person_id, auth.uid(), 'shortlist_stage_changed',
          jsonb_build_object('from', s.status, 'to', _status, 'opportunity_id', s.opportunity_id, 'note', _note));

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_shortlist_set_stage(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_shortlist_set_stage(uuid, text, text) TO authenticated;

-- 4. Expiry sweep -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mu_expire_documents()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
BEGIN
  WITH lapsed AS (
    UPDATE public.mu_documents
    SET review_outcome = 'pending', verified = false, updated_at = now()
    WHERE review_outcome = 'accepted'
      AND expires_at IS NOT NULL
      AND expires_at < current_date
    RETURNING person_id, id, label
  )
  INSERT INTO public.mu_activity (person_id, action, detail)
  SELECT person_id, 'document_expired', jsonb_build_object('document_id', id, 'label', label)
  FROM lapsed;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'expired', n);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_expire_documents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_expire_documents() TO authenticated, service_role;

-- 5. Name-based duplicate suspects -------------------------------------------
CREATE OR REPLACE FUNCTION public.mu_scan_name_duplicates()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  WITH pairs AS (
    SELECT a.id AS person_a, b.id AS person_b
    FROM public.mu_people a
    JOIN public.mu_people b
      ON lower(btrim(a.full_name)) = lower(btrim(b.full_name))
     AND a.id < b.id
    WHERE btrim(coalesce(a.full_name, '')) <> ''
      AND (a.email_key IS NULL OR b.email_key IS NULL OR a.email_key <> b.email_key)
      AND (a.phone_key IS NULL OR b.phone_key IS NULL OR a.phone_key <> b.phone_key)
      AND NOT EXISTS (
        SELECT 1 FROM public.mu_merge_candidates m
        WHERE (m.person_a = a.id AND m.person_b = b.id)
           OR (m.person_a = b.id AND m.person_b = a.id)
      )
  )
  INSERT INTO public.mu_merge_candidates (person_a, person_b, reason, score, status)
  SELECT person_a, person_b, 'Same name, different contact details', 0.6, 'open'
  FROM pairs;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'raised', n);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_scan_name_duplicates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_scan_name_duplicates() TO authenticated;