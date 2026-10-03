-- 1. Parse bookkeeping on the person
ALTER TABLE public.mu_people
  ADD COLUMN IF NOT EXISTS parse_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parse_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS parse_document_id uuid;

-- 2. Private config holder (URL + shared secret live here, never in code)
CREATE TABLE IF NOT EXISTS private.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.app_config ENABLE ROW LEVEL SECURITY;
GRANT ALL ON private.app_config TO service_role;

-- 3. Dispatch one person to the parser. No config, no call: silent no-op.
CREATE OR REPLACE FUNCTION private.mu_dispatch_parse(_person_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_url text;
  secret text;
BEGIN
  SELECT value INTO base_url FROM private.app_config WHERE key = 'functions_url';
  SELECT value INTO secret   FROM private.app_config WHERE key = 'parse_cv_cron_secret';
  IF base_url IS NULL OR secret IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := base_url || '/parse-cv',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := jsonb_build_object('person_id', _person_id)
  );
END;
$$;

-- 4. A CV landing queues the parse itself.
CREATE OR REPLACE FUNCTION public.mu_queue_cv_parse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cur_doc uuid;
  cur_status text;
BEGIN
  IF public.mu_doc_type(NEW.label, NEW.url) <> 'CV' THEN
    RETURN NEW;
  END IF;

  SELECT parse_document_id, coalesce(parse_status, 'not_parsed')
    INTO cur_doc, cur_status
    FROM public.mu_people WHERE id = NEW.person_id;

  -- Same document already in flight or done: do not fire twice.
  IF cur_doc = NEW.id AND cur_status IN ('queued', 'parsed', 'empty') THEN
    RETURN NEW;
  END IF;

  UPDATE public.mu_people
     SET parse_status = 'queued',
         parse_document_id = NEW.id,
         parse_attempts = CASE WHEN cur_doc IS DISTINCT FROM NEW.id THEN 1 ELSE parse_attempts + 1 END,
         parse_last_attempt_at = now()
   WHERE id = NEW.person_id;

  PERFORM private.mu_dispatch_parse(NEW.person_id);
  RETURN NEW;
END;
$$;

-- 5. Hourly sweep. Three attempts, then it stops and waits for a human.
CREATE OR REPLACE FUNCTION private.mu_parse_sweep(_limit integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN
    SELECT p.id
      FROM public.mu_people p
     WHERE coalesce(p.parse_status, 'not_parsed') IN ('not_parsed', 'queued', 'failed')
       AND p.parse_attempts < 3
       AND (p.parse_last_attempt_at IS NULL OR p.parse_last_attempt_at < now() - interval '45 minutes')
       AND EXISTS (
         SELECT 1 FROM public.mu_documents d
          WHERE d.person_id = p.id AND d.doc_type = 'CV'
       )
     ORDER BY p.last_activity_at DESC
     LIMIT coalesce(_limit, 25)
  LOOP
    UPDATE public.mu_people
       SET parse_status = 'queued',
           parse_attempts = parse_attempts + 1,
           parse_last_attempt_at = now(),
           parse_document_id = coalesce(parse_document_id, (
             SELECT d.id FROM public.mu_documents d
              WHERE d.person_id = r.id AND d.doc_type = 'CV'
              ORDER BY d.created_at DESC LIMIT 1))
     WHERE id = r.id;
    PERFORM private.mu_dispatch_parse(r.id);
    n := n + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'dispatched', n);
END;
$$;

-- 6. Promotion runs itself. Both promoters only fill blanks, so a value the
--    candidate has corrected is never overwritten.
CREATE OR REPLACE FUNCTION public.mu_promote_parsed_fields(_person_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  promoted int := 0;
  skipped  int := 0;
  conflicts int := 0;
  r record;
BEGIN
  -- auth.uid() IS NULL means an internal caller: a trigger or the scheduler.
  IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  FOR r IN
    WITH best AS (
      SELECT DISTINCT ON (pf.person_id, pf.field)
             pf.id, pf.person_id, pf.field, btrim(pf.value) AS value, pf.confidence
        FROM public.mu_parsed_fields pf
       WHERE pf.field IN ('profession','licensing_body','state','lga','years_experience')
         AND coalesce(btrim(pf.value), '') <> ''
         AND (_person_id IS NULL OR pf.person_id = _person_id)
       ORDER BY pf.person_id, pf.field, pf.confidence DESC, pf.created_at DESC
    )
    SELECT * FROM best
  LOOP
    IF r.field = 'years_experience' THEN
      IF EXISTS (
        SELECT 1 FROM public.mu_people p
         WHERE p.id = r.person_id
           AND p.years_experience IS NOT NULL
           AND r.value ~ '^[0-9]+$'
           AND p.years_experience <> r.value::int
      ) THEN
        INSERT INTO public.mu_field_conflicts (person_id, field, stored_value, parsed_value, parsed_field_id)
        SELECT r.person_id, r.field, p.years_experience::text, r.value, r.id
          FROM public.mu_people p WHERE p.id = r.person_id
        ON CONFLICT (person_id, field) DO UPDATE
          SET stored_value = EXCLUDED.stored_value,
              parsed_value = EXCLUDED.parsed_value,
              parsed_field_id = EXCLUDED.parsed_field_id;
        conflicts := conflicts + 1;
      END IF;
      CONTINUE;
    END IF;

    IF r.field = 'profession' THEN
      UPDATE public.mu_people p
         SET profession = r.value,
             profession_source = 'parsed',
             profession_confidence = r.confidence,
             promotion_provenance = p.promotion_provenance || jsonb_build_object(
               'profession', jsonb_build_object(
                 'parsed_field_id', r.id, 'confidence', r.confidence,
                 'source', 'parsed', 'promoted_at', now()))
       WHERE p.id = r.person_id
         AND coalesce(btrim(coalesce(p.profession,'')), '') = '';
    ELSIF r.field = 'licensing_body' THEN
      UPDATE public.mu_people p
         SET licensing_body = r.value,
             promotion_provenance = p.promotion_provenance || jsonb_build_object(
               'licensing_body', jsonb_build_object(
                 'parsed_field_id', r.id, 'confidence', r.confidence,
                 'source', 'parsed', 'promoted_at', now()))
       WHERE p.id = r.person_id
         AND coalesce(btrim(coalesce(p.licensing_body,'')), '') = '';
    ELSIF r.field = 'state' THEN
      UPDATE public.mu_people p
         SET state = r.value,
             promotion_provenance = p.promotion_provenance || jsonb_build_object(
               'state', jsonb_build_object(
                 'parsed_field_id', r.id, 'confidence', r.confidence,
                 'source', 'parsed', 'promoted_at', now()))
       WHERE p.id = r.person_id
         AND coalesce(btrim(coalesce(p.state,'')), '') = '';
    ELSIF r.field = 'lga' THEN
      UPDATE public.mu_people p
         SET lga = r.value,
             promotion_provenance = p.promotion_provenance || jsonb_build_object(
               'lga', jsonb_build_object(
                 'parsed_field_id', r.id, 'confidence', r.confidence,
                 'source', 'parsed', 'promoted_at', now()))
       WHERE p.id = r.person_id
         AND coalesce(btrim(coalesce(p.lga,'')), '') = '';
    END IF;

    IF FOUND THEN
      promoted := promoted + 1;
    ELSE
      skipped := skipped + 1;
      INSERT INTO public.mu_field_conflicts (person_id, field, stored_value, parsed_value, parsed_field_id)
      SELECT r.person_id, r.field,
             CASE r.field WHEN 'profession' THEN p.profession
                          WHEN 'licensing_body' THEN p.licensing_body
                          WHEN 'state' THEN p.state
                          WHEN 'lga' THEN p.lga END,
             r.value, r.id
        FROM public.mu_people p
       WHERE p.id = r.person_id
         AND lower(btrim(coalesce(
               CASE r.field WHEN 'profession' THEN p.profession
                            WHEN 'licensing_body' THEN p.licensing_body
                            WHEN 'state' THEN p.state
                            WHEN 'lga' THEN p.lga END, '')))
             <> lower(r.value)
      ON CONFLICT (person_id, field) DO UPDATE
        SET stored_value = EXCLUDED.stored_value,
            parsed_value = EXCLUDED.parsed_value,
            parsed_field_id = EXCLUDED.parsed_field_id;
      IF FOUND THEN conflicts := conflicts + 1; END IF;
    END IF;
  END LOOP;

  UPDATE public.mu_people
     SET profession_source = 'self_declared'
   WHERE profession IS NOT NULL AND profession_source IS NULL;

  RETURN jsonb_build_object('promoted', promoted, 'skipped', skipped, 'conflicts', conflicts);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mu_after_parse_promote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.mu_promote_application_answers(NEW.id);
  PERFORM public.mu_promote_parsed_fields(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mu_people_after_parse_promote ON public.mu_people;
CREATE TRIGGER mu_people_after_parse_promote
AFTER UPDATE OF parse_status ON public.mu_people
FOR EACH ROW
WHEN (NEW.parse_status IN ('parsed','empty') AND OLD.parse_status IS DISTINCT FROM NEW.parse_status)
EXECUTE FUNCTION public.mu_after_parse_promote();

CREATE OR REPLACE FUNCTION public.mu_after_link_promote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.person_id IS NOT NULL THEN
    PERFORM public.mu_promote_application_answers(NEW.person_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS join_app_promote ON public.join_applications;
CREATE TRIGGER join_app_promote
AFTER INSERT OR UPDATE OF person_id ON public.join_applications
FOR EACH ROW EXECUTE FUNCTION public.mu_after_link_promote();

DROP TRIGGER IF EXISTS matchmaker_app_promote ON public.matchmaker_applications;
CREATE TRIGGER matchmaker_app_promote
AFTER INSERT OR UPDATE OF person_id ON public.matchmaker_applications
FOR EACH ROW EXECUTE FUNCTION public.mu_after_link_promote();

-- 7. Let the scheduler run the duplicate scan (admin still required for humans).
CREATE OR REPLACE FUNCTION public.mu_scan_name_duplicates()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  n integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
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
$function$;