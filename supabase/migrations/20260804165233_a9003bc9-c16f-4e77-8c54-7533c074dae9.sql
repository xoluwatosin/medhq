-- Provenance for promoted values
ALTER TABLE public.mu_people
  ADD COLUMN IF NOT EXISTS promotion_provenance jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Conflicts between self-declared (form) values and parsed (CV) values.
CREATE TABLE IF NOT EXISTS public.mu_field_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  field text NOT NULL,
  stored_value text,
  parsed_value text,
  parsed_field_id uuid REFERENCES public.mu_parsed_fields(id) ON DELETE SET NULL,
  precedence text NOT NULL DEFAULT 'self_declared_wins',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, field)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_field_conflicts TO authenticated;
GRANT ALL ON public.mu_field_conflicts TO service_role;

ALTER TABLE public.mu_field_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage field conflicts"
  ON public.mu_field_conflicts FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER mu_field_conflicts_updated_at
  BEFORE UPDATE ON public.mu_field_conflicts
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- Promotion routine.
-- Precedence: SELF-DECLARED WINS. A value already on mu_people (from the
-- application form or an admin edit) is never overwritten. Parsed CV values
-- fill nulls only. Where the two disagree on a populated field, the
-- disagreement is recorded in mu_field_conflicts for admin review.
-- Never promotes license_number / license_expiry (candidate confirms first).
-- Never writes verification_state: promotion is not verification.
CREATE OR REPLACE FUNCTION public.mu_promote_parsed_fields(_person_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  promoted int := 0;
  skipped  int := 0;
  conflicts int := 0;
  r record;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
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
    -- years_experience is never promoted; it exists here only to detect conflicts
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
      -- populated field that disagrees with the CV: record it, do not overwrite
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

  -- Anything already self-declared on the profile but with no provenance is
  -- labelled as such, so provenance is never silently 'parsed'.
  UPDATE public.mu_people
     SET profession_source = 'self_declared'
   WHERE profession IS NOT NULL AND profession_source IS NULL;

  RETURN jsonb_build_object('promoted', promoted, 'skipped', skipped, 'conflicts', conflicts);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_promote_parsed_fields(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_promote_parsed_fields(uuid) TO authenticated;