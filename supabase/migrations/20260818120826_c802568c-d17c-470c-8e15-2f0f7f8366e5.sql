CREATE OR REPLACE FUNCTION public.mu_norm_state(_v text)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $fn$
DECLARE s text; hit text;
BEGIN
  s := lower(btrim(coalesce(_v, '')));
  IF s = '' THEN RETURN NULL; END IF;
  s := replace(replace(replace(s, '.', ''), ',', ' '), '-', ' ');
  s := btrim(regexp_replace(s, '\s+', ' ', 'g'));
  s := btrim(regexp_replace(s, '\s+state$', '', 'i'));
  IF s IN ('fct', 'abuja', 'federal capital territory', 'fct abuja', 'abuja fct') THEN RETURN 'FCT'; END IF;
  SELECT l.state INTO hit FROM (SELECT DISTINCT state FROM public.mu_lga_index) l WHERE lower(l.state) = s LIMIT 1;
  RETURN hit;
END; $fn$;

CREATE OR REPLACE FUNCTION public.mu_norm_body(_v text)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $fn$
DECLARE s text; hit text;
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
  RETURN hit;
END; $fn$;

UPDATE public.mu_people p SET state = public.mu_norm_state(p.state)
 WHERE p.state IS NOT NULL AND public.mu_norm_state(p.state) IS NOT NULL AND public.mu_norm_state(p.state) <> p.state;

UPDATE public.mu_people p SET licensing_body = public.mu_norm_body(p.licensing_body)
 WHERE p.licensing_body IS NOT NULL AND public.mu_norm_body(p.licensing_body) IS NOT NULL AND public.mu_norm_body(p.licensing_body) <> p.licensing_body;

UPDATE public.mu_people p SET state = public.mu_norm_state(f.value)
  FROM (SELECT DISTINCT ON (person_id) person_id, value FROM public.mu_parsed_fields
         WHERE field = 'state' AND confidence >= 0.85 ORDER BY person_id, confidence DESC, created_at DESC) f
 WHERE f.person_id = p.id AND coalesce(btrim(coalesce(p.state, '')), '') = ''
   AND public.mu_norm_state(f.value) IS NOT NULL;

UPDATE public.mu_people p SET licensing_body = public.mu_norm_body(f.value)
  FROM (SELECT DISTINCT ON (person_id) person_id, value FROM public.mu_parsed_fields
         WHERE field = 'licensing_body' AND confidence >= 0.85 ORDER BY person_id, confidence DESC, created_at DESC) f
 WHERE f.person_id = p.id AND coalesce(btrim(coalesce(p.licensing_body, '')), '') = ''
   AND public.mu_norm_body(f.value) IS NOT NULL;

UPDATE public.mu_field_conflicts c SET status = 'auto_resolved', updated_at = now()
 WHERE c.status = 'open'
   AND (lower(btrim(c.stored_value)) = lower(btrim(c.parsed_value))
     OR (c.field = 'state' AND public.mu_norm_state(c.stored_value) IS NOT NULL
         AND public.mu_norm_state(c.stored_value) = public.mu_norm_state(c.parsed_value))
     OR (c.field = 'licensing_body' AND public.mu_norm_body(c.stored_value) IS NOT NULL
         AND public.mu_norm_body(c.stored_value) = public.mu_norm_body(c.parsed_value))
     OR (c.field = 'years_experience' AND c.stored_value ~ '^[0-9]+$' AND c.parsed_value ~ '^[0-9]+$'
         AND abs(c.stored_value::int - c.parsed_value::int) <= 1));

UPDATE public.mu_parsed_fields f SET status = 'accepted', reviewed_at = now(),
       note = btrim(coalesce(f.note, '') || ' [sweep: already on profile]')
  FROM public.mu_people p
 WHERE p.id = f.person_id AND f.status IN ('pending', 'queried')
   AND ((f.field = 'profession' AND lower(btrim(f.value)) = lower(btrim(coalesce(p.profession, '~'))))
     OR (f.field = 'sex' AND lower(btrim(f.value)) = lower(btrim(coalesce(p.sex, '~'))))
     OR (f.field = 'license_number' AND lower(btrim(f.value)) = lower(btrim(coalesce(p.license_number, '~'))))
     OR (f.field = 'lga' AND lower(btrim(f.value)) = lower(btrim(coalesce(p.lga, '~'))))
     OR (f.field = 'state' AND public.mu_norm_state(f.value) IS NOT NULL
         AND public.mu_norm_state(f.value) = public.mu_norm_state(p.state))
     OR (f.field = 'licensing_body' AND public.mu_norm_body(f.value) IS NOT NULL
         AND public.mu_norm_body(f.value) = public.mu_norm_body(p.licensing_body))
     OR (f.field = 'years_experience' AND f.value ~ '^[0-9]+$' AND p.years_experience IS NOT NULL
         AND abs(p.years_experience - f.value::int) <= 1));

UPDATE public.mu_parsed_fields f SET status = 'accepted', reviewed_at = now(),
       note = btrim(coalesce(f.note, '') || ' [sweep: enrichment auto-accepted]')
 WHERE f.status IN ('pending', 'queried')
   AND f.field IN ('specialisms','clinical_skills','certifications','education','qualification','employer','current_position','profession_text','languages')
   AND coalesce(f.confidence, 0) >= 0.85
   AND coalesce(btrim(coalesce(f.value, '')), '') <> '';

UPDATE public.mu_people SET updated_at = now();