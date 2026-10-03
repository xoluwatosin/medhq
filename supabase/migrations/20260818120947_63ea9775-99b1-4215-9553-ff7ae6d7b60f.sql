-- Word-set fallback for council names written in a different order
CREATE OR REPLACE FUNCTION public.mu_norm_body(_v text)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $fn$
DECLARE s text; hit text; ws text;
BEGIN
  s := lower(btrim(coalesce(_v, '')));
  IF s = '' THEN RETURN NULL; END IF;
  s := replace(s, '&', 'and');
  s := regexp_replace(s, '\(([^)]*)\)', ' \1 ', 'g');
  s := replace(replace(s, ',', ' '), '.', '');
  s := btrim(regexp_replace(s, '\s+', ' ', 'g'));

  SELECT b.name INTO hit FROM public.mu_licensing_bodies b
   WHERE lower(b.code) = s
      OR lower(replace(b.name, '&', 'and')) = s
      OR EXISTS (SELECT 1 FROM unnest(coalesce(b.variants, '{}')) v WHERE lower(v) = s)
   LIMIT 1;
  IF hit IS NOT NULL THEN RETURN hit; END IF;

  SELECT b.name INTO hit FROM public.mu_licensing_bodies b
   WHERE s = lower(replace(b.name, '&', 'and')) || ' ' || lower(b.code)
      OR (s LIKE '%' || lower(b.code) || '%' AND s LIKE '%' || split_part(lower(replace(b.name, '&', 'and')), ' ', 1) || '%')
   LIMIT 1;
  IF hit IS NOT NULL THEN RETURN hit; END IF;

  -- word-set match, ignoring order, filler words and the country adjective
  ws := (SELECT string_agg(w, ' ' ORDER BY w) FROM unnest(
          regexp_split_to_array(regexp_replace(s, '[^a-z ]', '', 'g'), '\s+')) w
         WHERE w NOT IN ('', 'of', 'the', 'and') );
  ws := replace(replace(ws, 'nigerian', 'nigeria'), 'councils', 'council');

  SELECT b.name INTO hit FROM public.mu_licensing_bodies b
   WHERE ws = (SELECT string_agg(w, ' ' ORDER BY w) FROM unnest(
                 regexp_split_to_array(regexp_replace(lower(replace(b.name, '&', 'and')), '[^a-z ]', '', 'g'), '\s+')) w
                WHERE w NOT IN ('', 'of', 'the', 'and'))
   LIMIT 1;
  RETURN hit;
END; $fn$;

-- Local government canonicaliser: punctuation and suffix tolerant
CREATE OR REPLACE FUNCTION public.mu_norm_lga(_v text, _state text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $fn$
DECLARE s text; k text; hit text;
BEGIN
  s := lower(btrim(coalesce(_v, '')));
  IF s = '' THEN RETURN NULL; END IF;
  s := regexp_replace(s, '\m(local government area|local government|local govt|lga|l\.g\.a\.?)\M', ' ', 'gi');
  k := regexp_replace(s, '[^a-z0-9]', '', 'g');
  IF k = '' THEN RETURN NULL; END IF;

  SELECT i.lga INTO hit FROM public.mu_lga_index i
   WHERE regexp_replace(lower(i.lga), '[^a-z0-9]', '', 'g') = k
     AND (_state IS NULL OR lower(i.state) = lower(_state))
   LIMIT 1;
  IF hit IS NOT NULL THEN RETURN hit; END IF;

  SELECT i.lga INTO hit FROM public.mu_lga_index i
   WHERE regexp_replace(lower(i.lga), '[^a-z0-9]', '', 'g') = k
   LIMIT 1;
  RETURN hit;
END; $fn$;

-- Clear placeholders that are not answers
UPDATE public.mu_people
   SET lga = NULL
 WHERE lga IS NOT NULL
   AND (regexp_replace(lower(btrim(lga)), '[^a-z]', '', 'g') IN ('no','nil','na','none','nan','yes')
        OR lower(lga) LIKE '%relocate%');

UPDATE public.mu_people
   SET licensing_body = NULL
 WHERE licensing_body IS NOT NULL
   AND public.mu_norm_body(licensing_body) IS NULL
   AND length(regexp_replace(licensing_body, '[^a-zA-Z]', '', 'g')) < 12;

-- Canonicalise what can be matched
UPDATE public.mu_people p
   SET licensing_body = public.mu_norm_body(p.licensing_body)
 WHERE p.licensing_body IS NOT NULL
   AND public.mu_norm_body(p.licensing_body) IS NOT NULL
   AND public.mu_norm_body(p.licensing_body) <> p.licensing_body;

UPDATE public.mu_people p
   SET lga = public.mu_norm_lga(p.lga, p.state)
 WHERE p.lga IS NOT NULL
   AND public.mu_norm_lga(p.lga, p.state) IS NOT NULL
   AND public.mu_norm_lga(p.lga, p.state) <> p.lga;

-- Enrichment facets are never a candidate question
UPDATE public.mu_parsed_fields f
   SET status = 'accepted', reviewed_at = now(),
       note = btrim(coalesce(f.note, '') || ' [sweep2: enrichment auto-accepted]')
 WHERE f.status IN ('pending', 'queried')
   AND f.field IN ('specialisms','clinical_skills','certifications','education','qualification','employer','current_position','profession_text')
   AND coalesce(f.confidence, 0) >= 0.6
   AND coalesce(btrim(coalesce(f.value, '')), '') <> '';

-- Retire parsed rows that now agree with the canonicalised profile
UPDATE public.mu_parsed_fields f
   SET status = 'accepted', reviewed_at = now(),
       note = btrim(coalesce(f.note, '') || ' [sweep2: already on profile]')
  FROM public.mu_people p
 WHERE p.id = f.person_id AND f.status IN ('pending','queried')
   AND ((f.field = 'licensing_body' AND public.mu_norm_body(f.value) IS NOT NULL
         AND public.mu_norm_body(f.value) = public.mu_norm_body(p.licensing_body))
     OR (f.field = 'lga' AND public.mu_norm_lga(f.value, p.state) IS NOT NULL
         AND public.mu_norm_lga(f.value, p.state) = public.mu_norm_lga(p.lga, p.state)));

UPDATE public.mu_people SET updated_at = now();