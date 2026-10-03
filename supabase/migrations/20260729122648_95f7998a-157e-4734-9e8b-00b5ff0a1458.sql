-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.mu_norm_email(_e text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(lower(btrim(coalesce(_e, ''))), '')
$$;

CREATE OR REPLACE FUNCTION public.mu_norm_phone(_p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN d IS NULL OR length(d) < 7 THEN NULL
    WHEN left(d, 4) = '2340' THEN '234' || substr(d, 5)
    WHEN left(d, 3) = '234' THEN d
    WHEN left(d, 1) = '0'   THEN '234' || substr(d, 2)
    ELSE d
  END
  FROM (SELECT NULLIF(regexp_replace(coalesce(_p, ''), '[^0-9]', '', 'g'), '') AS d) s
$$;

-- ============ people ============
CREATE TABLE public.mu_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  email_key text GENERATED ALWAYS AS (public.mu_norm_email(email)) STORED,
  phone_key text GENERATED ALWAYS AS (public.mu_norm_phone(phone)) STORED,
  current_position text,
  years_experience integer,
  state text,
  lga text,
  licensing_body text,
  license_number text,
  license_expiry date,
  languages jsonb NOT NULL DEFAULT '[]'::jsonb,
  availability jsonb NOT NULL DEFAULT '[]'::jsonb,
  right_to_work boolean,
  status text NOT NULL DEFAULT 'new',
  verification_state text NOT NULL DEFAULT 'unverified',
  admin_notes text,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX mu_people_email_key_uq ON public.mu_people (email_key) WHERE email_key IS NOT NULL;
CREATE INDEX mu_people_phone_key_idx ON public.mu_people (phone_key) WHERE phone_key IS NOT NULL;
CREATE INDEX mu_people_name_idx ON public.mu_people (lower(full_name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_people TO authenticated;
GRANT ALL ON public.mu_people TO service_role;
ALTER TABLE public.mu_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage people" ON public.mu_people FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER mu_people_updated_at BEFORE UPDATE ON public.mu_people
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- ============ documents index ============
CREATE TABLE public.mu_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  source_table text NOT NULL,
  source_id uuid,
  label text NOT NULL,
  url text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  verified_by uuid,
  verified_at timestamptz,
  rejected boolean NOT NULL DEFAULT false,
  expires_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX mu_documents_person_url_uq ON public.mu_documents (person_id, url);
CREATE INDEX mu_documents_person_idx ON public.mu_documents (person_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_documents TO authenticated;
GRANT ALL ON public.mu_documents TO service_role;
ALTER TABLE public.mu_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage mu documents" ON public.mu_documents FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER mu_documents_updated_at BEFORE UPDATE ON public.mu_documents
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- ============ merge review queue ============
CREATE TABLE public.mu_merge_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_a uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  person_b uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  reason text NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX mu_merge_pair_uq ON public.mu_merge_candidates (LEAST(person_a, person_b), GREATEST(person_a, person_b));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_merge_candidates TO authenticated;
GRANT ALL ON public.mu_merge_candidates TO service_role;
ALTER TABLE public.mu_merge_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage merge candidates" ON public.mu_merge_candidates FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- ============ activity log ============
CREATE TABLE public.mu_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_name text,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mu_activity_person_idx ON public.mu_activity (person_id, created_at DESC);

GRANT SELECT, INSERT ON public.mu_activity TO authenticated;
GRANT ALL ON public.mu_activity TO service_role;
ALTER TABLE public.mu_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read activity" ON public.mu_activity FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins write activity" ON public.mu_activity FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- ============ link columns ============
ALTER TABLE public.matchmaker_applications ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.mu_people(id) ON DELETE SET NULL;
ALTER TABLE public.join_applications ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.mu_people(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS matchmaker_applications_person_idx ON public.matchmaker_applications (person_id);
CREATE INDEX IF NOT EXISTS join_applications_person_idx ON public.join_applications (person_id);

-- ============ resolver ============
CREATE OR REPLACE FUNCTION public.mu_resolve_person(
  _name text, _email text, _phone text, _position text, _years integer, _state text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ek text := public.mu_norm_email(_email);
  pk text := public.mu_norm_phone(_phone);
  pid uuid;
BEGIN
  IF ek IS NOT NULL THEN
    SELECT id INTO pid FROM public.mu_people WHERE email_key = ek LIMIT 1;
  END IF;
  IF pid IS NULL AND pk IS NOT NULL THEN
    SELECT id INTO pid FROM public.mu_people WHERE phone_key = pk ORDER BY created_at LIMIT 1;
  END IF;

  IF pid IS NULL THEN
    INSERT INTO public.mu_people (full_name, email, phone, current_position, years_experience, state)
    VALUES (coalesce(btrim(_name), ''), _email, _phone, _position, _years, _state)
    RETURNING id INTO pid;
  ELSE
    UPDATE public.mu_people SET
      full_name        = CASE WHEN coalesce(full_name,'') = '' THEN coalesce(btrim(_name), '') ELSE full_name END,
      email            = coalesce(email, _email),
      phone            = coalesce(phone, _phone),
      current_position = coalesce(current_position, _position),
      years_experience = coalesce(years_experience, _years),
      state            = coalesce(state, _state),
      last_activity_at = now()
    WHERE id = pid;
  END IF;

  -- flag weaker duplicates for human review (same name, different record)
  INSERT INTO public.mu_merge_candidates (person_a, person_b, reason, score)
  SELECT LEAST(pid, p.id), GREATEST(pid, p.id), 'Same name, different contact details', 0.6
  FROM public.mu_people p
  WHERE p.id <> pid
    AND coalesce(btrim(_name), '') <> ''
    AND lower(p.full_name) = lower(btrim(_name))
  ON CONFLICT DO NOTHING;

  RETURN pid;
END;
$$;

-- ============ auto-link triggers ============
CREATE OR REPLACE FUNCTION public.mu_link_matchmaker_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.person_id IS NULL THEN
    NEW.person_id := public.mu_resolve_person(
      NEW.full_name, NEW.email, NEW.phone, NEW.current_position, NEW.years_experience, NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mu_link_join_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.person_id IS NULL THEN
    NEW.person_id := public.mu_resolve_person(
      coalesce(NULLIF(btrim(coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,'')), ''), NEW.name),
      NEW.email, NEW.phone, NEW.role, NEW.years_experience, NEW.state);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mu_link_mm_app BEFORE INSERT ON public.matchmaker_applications
  FOR EACH ROW EXECUTE FUNCTION public.mu_link_matchmaker_application();
CREATE TRIGGER mu_link_join_app BEFORE INSERT ON public.join_applications
  FOR EACH ROW EXECUTE FUNCTION public.mu_link_join_application();

-- ============ backfill ============
DO $$
DECLARE r record; pid uuid;
BEGIN
  FOR r IN
    SELECT id, full_name, email, phone, current_position, years_experience
    FROM public.matchmaker_applications WHERE person_id IS NULL ORDER BY created_at
  LOOP
    pid := public.mu_resolve_person(r.full_name, r.email, r.phone, r.current_position, r.years_experience, NULL);
    UPDATE public.matchmaker_applications SET person_id = pid WHERE id = r.id;
  END LOOP;

  FOR r IN
    SELECT id, first_name, last_name, name, email, phone, role, years_experience, state
    FROM public.join_applications WHERE person_id IS NULL ORDER BY created_at
  LOOP
    pid := public.mu_resolve_person(
      coalesce(NULLIF(btrim(coalesce(r.first_name,'') || ' ' || coalesce(r.last_name,'')), ''), r.name),
      r.email, r.phone, r.role, r.years_experience, r.state);
    UPDATE public.join_applications SET person_id = pid WHERE id = r.id;
  END LOOP;
END $$;

-- index documents already on file
INSERT INTO public.mu_documents (person_id, source_table, source_id, label, url)
SELECT a.person_id, 'matchmaker_applications', a.id, d.key, d.value #>> '{}'
FROM public.matchmaker_applications a, jsonb_each(a.documents) d
WHERE a.person_id IS NOT NULL AND d.value #>> '{}' IS NOT NULL AND d.value #>> '{}' <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.mu_documents (person_id, source_table, source_id, label, url)
SELECT j.person_id, 'join_applications', j.id, 'CV', j.cv_url
FROM public.join_applications j
WHERE j.person_id IS NOT NULL AND coalesce(j.cv_url, '') <> ''
ON CONFLICT DO NOTHING;