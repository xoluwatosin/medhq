-- 1. Profile fields for the student and route work
ALTER TABLE public.mu_people
  ADD COLUMN IF NOT EXISTS study_level text,
  ADD COLUMN IF NOT EXISTS joining_statement text,
  ADD COLUMN IF NOT EXISTS track_source text,
  ADD COLUMN IF NOT EXISTS track_confirmed_at timestamptz;

-- 2. Preferences for the non-clinical and student routes
ALTER TABLE public.mu_work_preferences
  ADD COLUMN IF NOT EXISTS function_areas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS employer_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS work_setting text,
  ADD COLUMN IF NOT EXISTS contract_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS salary_band text,
  ADD COLUMN IF NOT EXISTS placement_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS roles_wanted text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS roles_wanted_other text;

-- 3. Documents can belong to a route, or be exempted from one
ALTER TABLE public.mu_required_documents
  ADD COLUMN IF NOT EXISTS track_key text,
  ADD COLUMN IF NOT EXISTS exempt_tracks text[] NOT NULL DEFAULT '{}';

-- 4. A route match beats a job-title pattern match
CREATE OR REPLACE FUNCTION public.mu_role_requirement(_profession text, _track text)
RETURNS mu_role_requirements
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT r.* FROM public.mu_role_requirements r
   WHERE r.active
     AND (
       (r.track_key IS NOT NULL AND r.track_key = coalesce(btrim(coalesce(_track, '')), ''))
       OR (r.pattern IS NOT NULL AND coalesce(btrim(coalesce(_profession, '')), '') <> '' AND _profession ~* r.pattern)
       OR r.role_key = 'general'
     )
   ORDER BY
     CASE WHEN r.track_key IS NOT NULL
            AND r.track_key = coalesce(btrim(coalesce(_track, '')), '') THEN 0 ELSE 1 END,
     r.sort_order
   LIMIT 1
$function$;

-- 5. Gaps follow the route
CREATE OR REPLACE FUNCTION public.mu_candidate_gaps_row(p mu_people)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  g text[] := '{}';
  lic_state text;
  pending text[];
  req public.mu_role_requirements;
  wants_licence boolean;
  n_refs int;
  trk text;
  prefs public.mu_work_preferences;
BEGIN
  SELECT coalesce(array_agg(DISTINCT field), '{}')
    INTO pending
    FROM public.mu_parsed_fields
   WHERE person_id = p.id AND status = 'candidate_updated'
     AND coalesce(btrim(coalesce(value, '')), '') <> '';

  trk := coalesce(btrim(coalesce(p.track, '')), '');
  req := public.mu_role_requirement(p.profession, p.track);

  IF coalesce(btrim(coalesce(p.profession, '')), '') = '' THEN g := g || 'profession'::text; END IF;
  IF coalesce(btrim(coalesce(p.state, '')), '') = '' THEN g := g || 'state'::text; END IF;
  IF coalesce(btrim(coalesce(p.lga, '')), '') = ''
     OR public.mu_norm_lga(p.lga, p.state) IS NULL THEN g := g || 'lga'::text; END IF;

  SELECT public.mu_credential_state(c.claim, c.evidence_document_id, c.verification_outcome, c.expires_at)
    INTO lic_state
    FROM public.mu_credentials c
   WHERE c.person_id = p.id AND c.credential_type = 'licence';
  lic_state := coalesce(lic_state, 'unknown');

  wants_licence := trk NOT IN ('student', 'non_clinical', 'support')
                   AND (coalesce(req.expects_licence, false) OR public.mu_expects_licence(p.profession));

  IF wants_licence AND lic_state NOT IN ('declined', 'verified') THEN
    IF coalesce(btrim(coalesce(p.licensing_body, '')), '') = '' THEN g := g || 'licensing_body'::text; END IF;
    IF coalesce(btrim(coalesce(p.license_number, '')), '') = '' THEN g := g || 'license_number'::text; END IF;
    IF p.license_expiry IS NULL THEN g := g || 'license_expiry'::text; END IF;
  END IF;

  IF coalesce(p.languages, '[]'::jsonb) = '[]'::jsonb THEN g := g || 'languages'::text; END IF;

  IF coalesce(req.needs_right_to_work, true)
     AND p.right_to_work IS NULL AND coalesce(p.right_to_work_status, 'unknown') = 'unknown'
    THEN g := g || 'right_to_work'::text; END IF;

  -- NYSC is asked of every qualified professional. Students are the exception.
  IF trk <> 'student' THEN
    IF coalesce(btrim(coalesce(p.nysc_status, '')), '') = '' THEN g := g || 'nysc_status'::text; END IF;
  END IF;

  IF trk = 'student' THEN
    IF coalesce(btrim(coalesce(p.institution, '')), '') = '' THEN g := g || 'institution'::text; END IF;
    IF coalesce(btrim(coalesce(p.course_of_study, '')), '') = '' THEN g := g || 'course_of_study'::text; END IF;
    IF coalesce(btrim(coalesce(p.expected_graduation, '')), '') = '' THEN g := g || 'expected_graduation'::text; END IF;
    IF coalesce(btrim(coalesce(p.joining_statement, '')), '') = '' THEN g := g || 'joining_statement'::text; END IF;
  ELSIF coalesce(req.needs_institution, false)
     AND coalesce(btrim(coalesce(p.institution, '')), '') = '' THEN
    g := g || 'institution'::text;
  END IF;

  IF trk <> 'non_clinical' AND coalesce(btrim(coalesce(p.sex, '')), '') = '' THEN
    g := g || 'sex'::text;
  END IF;

  -- Non-clinical candidates are not rostered, so availability is never asked of them.
  IF trk <> 'non_clinical' AND coalesce(req.needs_availability, true)
     AND p.last_availability_update IS NULL
    THEN g := g || 'availability'::text; END IF;

  SELECT * INTO prefs FROM public.mu_work_preferences w WHERE w.person_id = p.id;

  IF coalesce(req.needs_preferences, true) THEN
    IF prefs.person_id IS NULL THEN
      g := g || 'work_preferences'::text;
    ELSIF trk = 'non_clinical' AND coalesce(array_length(prefs.function_areas, 1), 0) = 0 THEN
      g := g || 'work_preferences'::text;
    ELSIF trk = 'student' AND coalesce(array_length(prefs.placement_types, 1), 0) = 0 THEN
      g := g || 'work_preferences'::text;
    ELSIF trk NOT IN ('non_clinical', 'student')
      AND coalesce(array_length(prefs.care_types, 1), 0) = 0 THEN
      g := g || 'work_preferences'::text;
    END IF;
  END IF;

  SELECT count(*) INTO n_refs FROM public.mu_references r WHERE r.person_id = p.id;
  IF n_refs < coalesce(req.min_references, 1) THEN g := g || 'references'::text; END IF;

  SELECT coalesce(array_agg(x ORDER BY ord), '{}') INTO g
    FROM unnest(g) WITH ORDINALITY t(x, ord)
   WHERE NOT (x = ANY (pending));

  RETURN to_jsonb(g);
END; $function$;

-- 6. Requested documents follow the route
CREATE OR REPLACE FUNCTION public.mu_document_status(_person_id uuid)
RETURNS TABLE(doc_type text, label text, helper text, required boolean, status text,
              document_id uuid, document_label text, document_url text, expires_at date,
              review_reason text, reviewed_at timestamp with time zone, source_note text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof text;
  staff boolean;
  trk text;
  nysc text;
BEGIN
  SELECT p.profession, p.is_staff, coalesce(btrim(coalesce(p.track, '')), ''), lower(coalesce(p.nysc_status, ''))
    INTO prof, staff, trk, nysc
    FROM public.mu_people p WHERE p.id = _person_id;
  staff := COALESCE(staff, false);

  RETURN QUERY
  WITH req AS (
    SELECT r.doc_type, r.label, r.helper, r.sort_order,
           (r.rule = 'always'
             OR (r.rule = 'licensed_only' AND trk NOT IN ('student','non_clinical','support')
                 AND public.mu_expects_licence(prof))
             OR (r.rule = 'staff_only' AND staff)
             OR (r.rule = 'nysc_only' AND nysc IN ('completed', 'exempt'))) AS required
      FROM public.mu_required_documents r
     WHERE r.active
       AND (r.rule <> 'staff_only' OR staff)
       AND (r.track_key IS NULL OR r.track_key = trk)
       AND NOT (trk = ANY (coalesce(r.exempt_tracks, '{}')))
       AND (r.rule <> 'nysc_only' OR nysc IN ('completed', 'exempt'))
  ),
  best AS (
    SELECT DISTINCT ON (d.doc_type)
           d.doc_type, d.id, d.label, d.url, d.expires_at, d.review_reason,
           d.reviewed_at, d.source_note, d.review_outcome
      FROM public.mu_documents d
     WHERE d.person_id = _person_id
       AND d.superseded_at IS NULL
     ORDER BY d.doc_type,
              CASE d.review_outcome WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
              d.created_at DESC
  )
  SELECT req.doc_type, req.label, req.helper, req.required,
         CASE
           WHEN b.id IS NULL THEN 'missing'
           WHEN b.review_outcome = 'accepted' AND b.expires_at IS NOT NULL AND b.expires_at < current_date THEN 'expired'
           WHEN b.review_outcome = 'accepted' THEN 'accepted'
           WHEN b.review_outcome = 'rejected' THEN 'rejected'
           ELSE 'pending'
         END,
         b.id, b.label, b.url, b.expires_at, b.review_reason, b.reviewed_at, b.source_note
    FROM req LEFT JOIN best b ON b.doc_type = req.doc_type
   ORDER BY req.sort_order;
END;
$$;

-- 7. Candidates can maintain their own route and study facts
CREATE OR REPLACE FUNCTION public.mu_candidate_update_profile(_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p            public.mu_people%ROWTYPE;
  allowed      text[] := ARRAY[
    'state','lga','profession','sex','languages','licensing_body','license_number',
    'license_expiry','nysc_status','right_to_work','address_line','address_landmark','address_area',
    'track','institution','course_of_study','study_level','year_of_study','expected_graduation',
    'joining_statement'
  ];
  k            text;
  v            text;
  old_value    text;
  changes      jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO p FROM public.mu_people WHERE auth_user_id = auth.uid();
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'No profile for this account';
  END IF;

  FOR k, v IN SELECT key, btrim(coalesce(value #>> '{}', '')) FROM jsonb_each(_patch)
  LOOP
    IF NOT (k = ANY(allowed)) THEN CONTINUE; END IF;

    EXECUTE format('SELECT (%I)::text FROM public.mu_people WHERE id = $1', k)
      INTO old_value USING p.id;

    IF coalesce(old_value, '') = coalesce(v, '') THEN CONTINUE; END IF;

    IF k = 'languages' THEN
      UPDATE public.mu_people
         SET languages = (
               SELECT coalesce(jsonb_agg(jsonb_build_object('language', t, 'fluency', 'Unstated')), '[]'::jsonb)
                 FROM unnest(string_to_array(v, ',')) AS t
                WHERE btrim(t) <> ''
             )
       WHERE id = p.id;
    ELSIF k = 'right_to_work' THEN
      UPDATE public.mu_people
         SET right_to_work = (lower(v) LIKE 'y%'),
             right_to_work_status = CASE WHEN lower(v) LIKE 'y%' THEN 'confirmed' ELSE 'absent' END
       WHERE id = p.id;
    ELSIF k = 'license_expiry' THEN
      UPDATE public.mu_people
         SET license_expiry = nullif(v, '')::date
       WHERE id = p.id;
    ELSE
      EXECUTE format('UPDATE public.mu_people SET %I = nullif($1, %L) WHERE id = $2', k, '')
        USING v, p.id;
    END IF;

    IF k IN ('state','lga') THEN
      UPDATE public.mu_people SET location_source = 'candidate_stated' WHERE id = p.id;
    ELSIF k = 'profession' THEN
      UPDATE public.mu_people SET profession_source = 'candidate_stated' WHERE id = p.id;
    ELSIF k = 'track' THEN
      UPDATE public.mu_people
         SET track_source = 'candidate_confirmed', track_confirmed_at = now()
       WHERE id = p.id;
    ELSIF k IN ('address_line','address_landmark','address_area') THEN
      UPDATE public.mu_people
         SET address_source = 'candidate_stated', address_captured_at = now()
       WHERE id = p.id;
    END IF;

    changes := changes || jsonb_build_object('field', k, 'from', old_value, 'to', v);

    INSERT INTO public.mu_activity (person_id, action, detail, actor_id, actor_name)
    VALUES (
      p.id,
      'candidate_updated_profile',
      jsonb_build_object('field', k, 'from', old_value, 'to', v),
      auth.uid(),
      p.full_name
    );
  END LOOP;

  RETURN jsonb_build_object('changed', changes);
END;
$function$;