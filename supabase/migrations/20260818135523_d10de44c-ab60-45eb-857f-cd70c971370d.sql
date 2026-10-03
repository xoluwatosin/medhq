-- 1. Ambiguity now quarantines the value instead of keeping it.
CREATE OR REPLACE FUNCTION public.mu_flag_profile_ambiguity(_person_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  fld text; val text; problem text; n int := 0;
  st text; lg text; known text[];
  clear_fields text[] := '{}';
BEGIN
  FOREACH fld IN ARRAY ARRAY['state','lga','profession','licensing_body'] LOOP
    EXECUTE format('SELECT %I::text FROM public.mu_people WHERE id = $1', fld)
      INTO val USING _person_id;
    CONTINUE WHEN val IS NULL OR btrim(val) = '';
    problem := public.mu_field_shape_problem(fld, val);
    CONTINUE WHEN problem IS NULL;
    IF NOT EXISTS (
      SELECT 1 FROM public.mu_parsed_fields
       WHERE person_id = _person_id AND field = fld
         AND status IN ('queried','candidate_updated')) THEN
      PERFORM public.mu_query_field(_person_id, fld, val, problem);
      n := n + 1;
    END IF;
    clear_fields := clear_fields || fld::text;
  END LOOP;

  SELECT state, lga INTO st, lg FROM public.mu_people WHERE id = _person_id;
  IF lg IS NOT NULL AND btrim(lg) <> '' AND public.mu_field_shape_problem('lga', lg) IS NULL THEN
    known := public.mu_lga_states(lg);
    IF cardinality(known) = 0 THEN
      IF NOT EXISTS (SELECT 1 FROM public.mu_parsed_fields WHERE person_id = _person_id AND field = 'lga' AND status IN ('queried','candidate_updated')) THEN
        PERFORM public.mu_query_field(_person_id, 'lga', lg,
          'We could not match this to a Nigerian local government area. Please pick yours.');
        n := n + 1;
      END IF;
      clear_fields := clear_fields || 'lga'::text;
    ELSIF st IS NOT NULL AND btrim(st) <> ''
      AND NOT EXISTS (SELECT 1 FROM unnest(known) k WHERE public.mu_loc_key(k) = public.mu_loc_key(st)) THEN
      IF NOT EXISTS (SELECT 1 FROM public.mu_parsed_fields WHERE person_id = _person_id AND field = 'lga' AND status IN ('queried','candidate_updated')) THEN
        PERFORM public.mu_query_field(_person_id, 'lga', lg,
          lg || ' is in ' || array_to_string(known, ' or ') || ', but your profile says ' || st || '. Please confirm the area you live in.');
        n := n + 1;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.mu_parsed_fields WHERE person_id = _person_id AND field = 'state' AND status IN ('queried','candidate_updated')) THEN
        PERFORM public.mu_query_field(_person_id, 'state', st,
          'Your area (' || lg || ') is in ' || array_to_string(known, ' or ') || '. Please confirm the state you live in.');
        n := n + 1;
      END IF;
      clear_fields := clear_fields || 'lga'::text || 'state'::text;
    END IF;
  END IF;

  -- We do not keep data we cannot trust. The held text lives on the question.
  IF cardinality(clear_fields) > 0 THEN
    EXECUTE format(
      'UPDATE public.mu_people SET %s WHERE id = $1',
      (SELECT string_agg(format('%I = NULL', f), ', ') FROM (SELECT DISTINCT unnest(clear_fields) AS f) q))
      USING _person_id;
  END IF;

  RETURN n;
END;
$function$;

-- 2. Sweep everyone now.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.mu_people LOOP
    PERFORM public.mu_flag_profile_ambiguity(r.id);
  END LOOP;
END $$;

-- 3. References the candidate gives us.
CREATE TABLE public.mu_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  referee_name text NOT NULL,
  relationship text,
  job_title text,
  organisation text,
  email text,
  phone text,
  note text,
  status text NOT NULL DEFAULT 'offered',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mu_references_person_idx ON public.mu_references(person_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_references TO authenticated;
GRANT ALL ON public.mu_references TO service_role;

ALTER TABLE public.mu_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage references" ON public.mu_references
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Candidates read their own references" ON public.mu_references
  FOR SELECT TO authenticated USING (person_id = mu_my_person_id());

CREATE POLICY "Candidates add their own references" ON public.mu_references
  FOR INSERT TO authenticated WITH CHECK (person_id = mu_my_person_id());

CREATE POLICY "Candidates update their own references" ON public.mu_references
  FOR UPDATE TO authenticated
  USING (person_id = mu_my_person_id())
  WITH CHECK (person_id = mu_my_person_id());

CREATE POLICY "Candidates remove their own references" ON public.mu_references
  FOR DELETE TO authenticated USING (person_id = mu_my_person_id());

CREATE TRIGGER mu_references_updated_at BEFORE UPDATE ON public.mu_references
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();