-- Stage 1: the multi-person foundation.
--
-- A care group joins related people, recipients, requests and shared
-- arrangements. It is not an account and grants nobody access to anything.
-- One clients row stays the canonical record for one person receiving care.

-- ---------------------------------------------------------------- vocabulary
CREATE TABLE IF NOT EXISTS public.care_group_relationship_terms (
  code text PRIMARY KEY,
  label text NOT NULL,
  inverse_code text,
  requires_text boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.care_group_relationship_terms TO anon, authenticated;
GRANT ALL ON public.care_group_relationship_terms TO service_role;
ALTER TABLE public.care_group_relationship_terms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads relationship terms" ON public.care_group_relationship_terms;
CREATE POLICY "Anyone reads relationship terms" ON public.care_group_relationship_terms
  FOR SELECT USING (is_active);
DROP POLICY IF EXISTS "Admins manage relationship terms" ON public.care_group_relationship_terms;
CREATE POLICY "Admins manage relationship terms" ON public.care_group_relationship_terms
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.care_group_relationship_terms (code, label, inverse_code, requires_text) VALUES
  ('mother_of', 'Mother of', 'child_of', false),
  ('father_of', 'Father of', 'child_of', false),
  ('parent_or_guardian_of', 'Parent or guardian of', 'child_of', false),
  ('child_of', 'Child of', 'parent_or_guardian_of', false),
  ('spouse_or_partner_of', 'Spouse or partner of', 'spouse_or_partner_of', false),
  ('sibling_of', 'Sibling of', 'sibling_of', false),
  ('grandparent_of', 'Grandparent of', 'grandchild_of', false),
  ('grandchild_of', 'Grandchild of', 'grandparent_of', false),
  ('relative_of', 'Relative of', 'relative_of', false),
  ('friend_of', 'Friend of', 'friend_of', false),
  ('professional_representative_of', 'Professional representative of', NULL, false),
  ('payer_for', 'Payer for', NULL, false),
  ('emergency_contact_for', 'Emergency contact for', NULL, false),
  ('other', 'Other', NULL, true)
ON CONFLICT (code) DO NOTHING;

-- -------------------------------------------------------------- care groups
CREATE TABLE IF NOT EXISTS public.care_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  address_line text,
  landmark text,
  state_code text,
  lga_code text,
  status text NOT NULL DEFAULT 'active',
  source text NOT NULL DEFAULT 'staff',
  origin_client_id uuid UNIQUE REFERENCES public.clients(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_groups_status_check CHECK (status IN ('active', 'closed'))
);
COMMENT ON COLUMN public.care_groups.origin_client_id IS
  'Set only on the compatibility group created for a care record that predates grouping. Keeps the backfill deterministic.';

CREATE TABLE IF NOT EXISTS public.care_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.care_groups(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.care_people(id) ON DELETE CASCADE,
  role text NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_group_members_role_check
    CHECK (role IN ('enquirer', 'care_recipient', 'payer', 'representative', 'contact', 'other')),
  CONSTRAINT care_group_members_unique UNIQUE (group_id, person_id, role)
);

CREATE TABLE IF NOT EXISTS public.care_person_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.care_groups(id) ON DELETE CASCADE,
  from_person_id uuid NOT NULL REFERENCES public.care_people(id) ON DELETE CASCADE,
  to_person_id uuid NOT NULL REFERENCES public.care_people(id) ON DELETE CASCADE,
  relationship_code text NOT NULL REFERENCES public.care_group_relationship_terms(code),
  other_label text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_person_relationships_distinct CHECK (from_person_id <> to_person_id),
  CONSTRAINT care_person_relationships_unique UNIQUE (from_person_id, to_person_id, relationship_code)
);
COMMENT ON TABLE public.care_person_relationships IS
  'Directional facts about people. A relationship never grants clinical, journey or finance access.';

-- ------------------------------------------------------------ care requests
CREATE TABLE IF NOT EXISTS public.care_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.care_groups(id) ON DELETE CASCADE,
  enquirer_person_id uuid REFERENCES public.care_people(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  source text NOT NULL DEFAULT 'staff',
  attribution jsonb,
  enquiry_notes text,
  callback_at timestamptz,
  callback_phone text,
  created_from_submission_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_requests_status_check CHECK (status IN
    ('draft', 'open', 'questionnaire_sent', 'responses_returned', 'assessment_booked', 'closed'))
);

CREATE TABLE IF NOT EXISTS public.care_request_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.care_requests(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.care_people(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'care_recipient',
  address_line text,
  landmark text,
  state_code text,
  lga_code text,
  display_order integer NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_request_recipients_role_check CHECK (role IN ('care_recipient')),
  CONSTRAINT care_request_recipients_unique UNIQUE (request_id, client_id)
);
COMMENT ON TABLE public.care_request_recipients IS
  'One row per person receiving care on a request. client_id stays the canonical clinical record.';

-- -------------------------------------------------------- service intentions
CREATE TABLE IF NOT EXISTS public.care_service_intentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.care_requests(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'proposed',
  is_shared boolean NOT NULL DEFAULT false,
  reason text,
  source text NOT NULL DEFAULT 'staff',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_service_intentions_state_check CHECK (state IN ('proposed', 'confirmed', 'declined'))
);

CREATE TABLE IF NOT EXISTS public.care_service_intention_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intention_id uuid NOT NULL REFERENCES public.care_service_intentions(id) ON DELETE CASCADE,
  request_recipient_id uuid NOT NULL REFERENCES public.care_request_recipients(id) ON DELETE CASCADE,
  needs_clinical_resolution boolean NOT NULL DEFAULT false,
  conflict_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_service_intention_recipients_unique UNIQUE (intention_id, request_recipient_id)
);
COMMENT ON COLUMN public.care_service_intention_recipients.needs_clinical_resolution IS
  'Set by the compatibility check when a service and a recipient do not obviously fit. Never resolved automatically.';

-- --------------------------------------------------------- assessment visits
CREATE TABLE IF NOT EXISTS public.care_assessment_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.care_requests(id) ON DELETE SET NULL,
  group_id uuid NOT NULL REFERENCES public.care_groups(id) ON DELETE CASCADE,
  appointment_at timestamptz,
  appointment_ends_at timestamptz,
  location_kind text NOT NULL DEFAULT 'home',
  address_line text,
  landmark text,
  assessor_person_id uuid REFERENCES public.mu_people(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'planned',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_assessment_visits_location_check CHECK (location_kind IN ('home', 'clinic', 'virtual')),
  CONSTRAINT care_assessment_visits_status_check CHECK (status IN ('planned', 'confirmed', 'completed', 'cancelled'))
);
COMMENT ON TABLE public.care_assessment_visits IS
  'Shared appointment facts for a visit covering one or several recipients. Each recipient keeps their own assessment work and document.';

ALTER TABLE public.care_assessment_work
  ADD COLUMN IF NOT EXISTS visit_id uuid REFERENCES public.care_assessment_visits(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS care_assessment_work_visit_idx ON public.care_assessment_work(visit_id);

CREATE INDEX IF NOT EXISTS care_group_members_group_idx ON public.care_group_members(group_id);
CREATE INDEX IF NOT EXISTS care_person_relationships_from_idx ON public.care_person_relationships(from_person_id);
CREATE INDEX IF NOT EXISTS care_person_relationships_to_idx ON public.care_person_relationships(to_person_id);
CREATE INDEX IF NOT EXISTS care_requests_group_idx ON public.care_requests(group_id);
CREATE INDEX IF NOT EXISTS care_request_recipients_request_idx ON public.care_request_recipients(request_id);
CREATE INDEX IF NOT EXISTS care_request_recipients_client_idx ON public.care_request_recipients(client_id);
CREATE INDEX IF NOT EXISTS care_service_intentions_request_idx ON public.care_service_intentions(request_id);
CREATE INDEX IF NOT EXISTS care_service_intention_recipients_intention_idx
  ON public.care_service_intention_recipients(intention_id);

-- ------------------------------------------------------- grants and policies
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_group_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_person_relationships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_request_recipients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_service_intentions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_service_intention_recipients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_assessment_visits TO authenticated;
GRANT ALL ON public.care_groups TO service_role;
GRANT ALL ON public.care_group_members TO service_role;
GRANT ALL ON public.care_person_relationships TO service_role;
GRANT ALL ON public.care_requests TO service_role;
GRANT ALL ON public.care_request_recipients TO service_role;
GRANT ALL ON public.care_service_intentions TO service_role;
GRANT ALL ON public.care_service_intention_recipients TO service_role;
GRANT ALL ON public.care_assessment_visits TO service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['care_groups','care_group_members','care_person_relationships',
    'care_requests','care_request_recipients','care_service_intentions',
    'care_service_intention_recipients','care_assessment_visits']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage %s" ON public.%I', t, t);
    EXECUTE format($p$CREATE POLICY "Admins manage %s" ON public.%I FOR ALL TO authenticated
      USING (private.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role))$p$, t, t);
  END LOOP;
END $$;

-- ------------------------------------------------- service/recipient fitness
CREATE OR REPLACE FUNCTION private.care_service_recipient_conflict(_service_id uuid, _client_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _slug text; _age numeric;
BEGIN
  SELECT slug INTO _slug FROM public.services WHERE id = _service_id;
  SELECT CASE
           WHEN c.date_of_birth IS NOT NULL
             THEN EXTRACT(EPOCH FROM (now() - c.date_of_birth::timestamptz)) / 31557600
           ELSE c.age_years::numeric
         END
    INTO _age FROM public.clients c WHERE c.id = _client_id;

  IF _slug IS NULL OR _age IS NULL THEN RETURN NULL; END IF;

  IF _slug IN ('nanny_childcare', 'paediatric', 'paediatric-care') AND _age >= 18 THEN
    RETURN 'This service is for a child, but this recipient is recorded as an adult.';
  END IF;
  IF _slug = 'eldercare' AND _age < 18 THEN
    RETURN 'Eldercare is recorded against a recipient under 18.';
  END IF;
  IF _slug = 'antenatal' AND _age < 12 THEN
    RETURN 'Antenatal care is recorded against a young child.';
  END IF;
  IF _slug = 'postnatal' AND _age >= 1 AND _age < 12 THEN
    RETURN 'Postnatal care usually covers a mother or a newborn, not a child of this age.';
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION private.care_intention_recipient_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _service uuid; _client uuid; _intention_request uuid; _recipient_request uuid; _conflict text;
BEGIN
  SELECT service_id, request_id INTO _service, _intention_request
    FROM public.care_service_intentions WHERE id = NEW.intention_id;
  SELECT client_id, request_id INTO _client, _recipient_request
    FROM public.care_request_recipients WHERE id = NEW.request_recipient_id;
  IF _intention_request IS DISTINCT FROM _recipient_request THEN
    RAISE EXCEPTION 'A service can only be allocated to a recipient on the same request';
  END IF;
  _conflict := private.care_service_recipient_conflict(_service, _client);
  NEW.conflict_reason := _conflict;
  NEW.needs_clinical_resolution := _conflict IS NOT NULL;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS care_intention_recipient_guard ON public.care_service_intention_recipients;
CREATE TRIGGER care_intention_recipient_guard
  BEFORE INSERT OR UPDATE ON public.care_service_intention_recipients
  FOR EACH ROW EXECUTE FUNCTION private.care_intention_recipient_guard();

-- ------------------------------------------------------------ write pathways
CREATE OR REPLACE FUNCTION private.care_group_admin_guard()
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to edit care groups';
  END IF;
END;
$function$;

-- The compatibility group for a care record that predates grouping.
CREATE OR REPLACE FUNCTION public.care_group_ensure(_client_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _group uuid; _request uuid; _client public.clients%ROWTYPE;
BEGIN
  PERFORM private.care_group_admin_guard();
  SELECT * INTO _client FROM public.clients WHERE id = _client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Care record not found'; END IF;

  SELECT id INTO _group FROM public.care_groups WHERE origin_client_id = _client_id;
  IF _group IS NULL THEN
    INSERT INTO public.care_groups (display_name, address_line, landmark, state_code, lga_code,
                                    source, origin_client_id, created_by)
    VALUES (_client.full_name, _client.address_line, _client.landmark, _client.state_code,
            _client.lga_code, 'backfill', _client_id, auth.uid())
    RETURNING id INTO _group;
  END IF;

  SELECT r.id INTO _request FROM public.care_requests r
    WHERE r.group_id = _group ORDER BY r.created_at LIMIT 1;
  IF _request IS NULL THEN
    INSERT INTO public.care_requests (group_id, status, source, created_from_submission_id, created_by)
    VALUES (_group, 'open', 'backfill', _client.created_from_submission_id, auth.uid())
    RETURNING id INTO _request;
  END IF;

  INSERT INTO public.care_request_recipients (request_id, client_id, address_line, landmark,
                                              state_code, lga_code, display_order, created_by)
  VALUES (_request, _client_id, _client.address_line, _client.landmark, _client.state_code,
          _client.lga_code, 1, auth.uid())
  ON CONFLICT (request_id, client_id) DO NOTHING;

  RETURN _group;
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_group_save(
  _group_id uuid, _display_name text, _address_line text DEFAULT NULL,
  _landmark text DEFAULT NULL, _state_code text DEFAULT NULL, _lga_code text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _id uuid;
BEGIN
  PERFORM private.care_group_admin_guard();
  IF _display_name IS NULL OR btrim(_display_name) = '' THEN
    RAISE EXCEPTION 'A care group needs a name';
  END IF;
  IF _group_id IS NULL THEN
    INSERT INTO public.care_groups (display_name, address_line, landmark, state_code, lga_code, created_by)
    VALUES (btrim(_display_name), _address_line, _landmark, _state_code, _lga_code, auth.uid())
    RETURNING id INTO _id;
  ELSE
    UPDATE public.care_groups SET display_name = btrim(_display_name), address_line = _address_line,
      landmark = _landmark, state_code = _state_code, lga_code = _lga_code, updated_at = now()
     WHERE id = _group_id RETURNING id INTO _id;
    IF _id IS NULL THEN RAISE EXCEPTION 'Care group not found'; END IF;
  END IF;
  RETURN _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_group_member_set(_group_id uuid, _person_id uuid, _role text, _notes text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _id uuid;
BEGIN
  PERFORM private.care_group_admin_guard();
  INSERT INTO public.care_group_members (group_id, person_id, role, notes, created_by)
  VALUES (_group_id, _person_id, _role, _notes, auth.uid())
  ON CONFLICT (group_id, person_id, role) DO UPDATE SET notes = EXCLUDED.notes
  RETURNING id INTO _id;
  RETURN _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_relationship_set(
  _from_person_id uuid, _to_person_id uuid, _relationship_code text,
  _group_id uuid DEFAULT NULL, _other_label text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _id uuid; _requires boolean;
BEGIN
  PERFORM private.care_group_admin_guard();
  SELECT requires_text INTO _requires FROM public.care_group_relationship_terms
   WHERE code = _relationship_code AND is_active;
  IF _requires IS NULL THEN RAISE EXCEPTION 'That relationship is not on the list'; END IF;
  IF _requires AND COALESCE(btrim(_other_label), '') = '' THEN
    RAISE EXCEPTION 'Say what the relationship is';
  END IF;
  INSERT INTO public.care_person_relationships
    (group_id, from_person_id, to_person_id, relationship_code, other_label, created_by)
  VALUES (_group_id, _from_person_id, _to_person_id, _relationship_code, NULLIF(btrim(COALESCE(_other_label,'')),''), auth.uid())
  ON CONFLICT (from_person_id, to_person_id, relationship_code)
    DO UPDATE SET other_label = EXCLUDED.other_label, group_id = COALESCE(EXCLUDED.group_id, public.care_person_relationships.group_id)
  RETURNING id INTO _id;
  RETURN _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_relationship_remove(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  PERFORM private.care_group_admin_guard();
  DELETE FROM public.care_person_relationships WHERE id = _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_request_save(
  _request_id uuid, _group_id uuid, _enquirer_person_id uuid DEFAULT NULL,
  _status text DEFAULT NULL, _source text DEFAULT NULL, _enquiry_notes text DEFAULT NULL,
  _callback_at timestamptz DEFAULT NULL, _callback_phone text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _id uuid;
BEGIN
  PERFORM private.care_group_admin_guard();
  IF _request_id IS NULL THEN
    INSERT INTO public.care_requests (group_id, enquirer_person_id, status, source,
                                      enquiry_notes, callback_at, callback_phone, created_by)
    VALUES (_group_id, _enquirer_person_id, COALESCE(_status, 'draft'), COALESCE(_source, 'staff'),
            _enquiry_notes, _callback_at, _callback_phone, auth.uid())
    RETURNING id INTO _id;
  ELSE
    UPDATE public.care_requests SET
      enquirer_person_id = _enquirer_person_id,
      status = COALESCE(_status, status),
      source = COALESCE(_source, source),
      enquiry_notes = _enquiry_notes,
      callback_at = _callback_at,
      callback_phone = _callback_phone,
      updated_at = now()
     WHERE id = _request_id RETURNING id INTO _id;
    IF _id IS NULL THEN RAISE EXCEPTION 'Care request not found'; END IF;
  END IF;
  RETURN _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_request_recipient_add(
  _request_id uuid, _client_id uuid, _person_id uuid DEFAULT NULL,
  _address_line text DEFAULT NULL, _landmark text DEFAULT NULL,
  _state_code text DEFAULT NULL, _lga_code text DEFAULT NULL, _display_order integer DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _id uuid; _next integer;
BEGIN
  PERFORM private.care_group_admin_guard();
  SELECT COALESCE(MAX(display_order), 0) + 1 INTO _next
    FROM public.care_request_recipients WHERE request_id = _request_id;
  INSERT INTO public.care_request_recipients
    (request_id, client_id, person_id, address_line, landmark, state_code, lga_code, display_order, created_by)
  VALUES (_request_id, _client_id, _person_id, _address_line, _landmark, _state_code, _lga_code,
          COALESCE(_display_order, _next), auth.uid())
  ON CONFLICT (request_id, client_id) DO UPDATE SET
    person_id = COALESCE(EXCLUDED.person_id, public.care_request_recipients.person_id),
    address_line = EXCLUDED.address_line, landmark = EXCLUDED.landmark,
    state_code = EXCLUDED.state_code, lga_code = EXCLUDED.lga_code
  RETURNING id INTO _id;
  RETURN _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_request_recipient_remove(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  PERFORM private.care_group_admin_guard();
  DELETE FROM public.care_request_recipients WHERE id = _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_service_intention_set(
  _intention_id uuid, _request_id uuid, _service_id uuid, _recipient_ids uuid[],
  _state text DEFAULT NULL, _is_shared boolean DEFAULT NULL,
  _reason text DEFAULT NULL, _source text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _id uuid; _recipient uuid;
BEGIN
  PERFORM private.care_group_admin_guard();
  IF _recipient_ids IS NULL OR array_length(_recipient_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'A service needs at least one recipient';
  END IF;

  IF _intention_id IS NULL THEN
    INSERT INTO public.care_service_intentions (request_id, service_id, state, is_shared, reason, source, created_by)
    VALUES (_request_id, _service_id, COALESCE(_state, 'proposed'),
            COALESCE(_is_shared, array_length(_recipient_ids, 1) > 1),
            _reason, COALESCE(_source, 'staff'), auth.uid())
    RETURNING id INTO _id;
  ELSE
    UPDATE public.care_service_intentions SET
      service_id = _service_id,
      state = COALESCE(_state, state),
      is_shared = COALESCE(_is_shared, array_length(_recipient_ids, 1) > 1),
      reason = _reason, updated_at = now()
     WHERE id = _intention_id AND request_id = _request_id
    RETURNING id INTO _id;
    IF _id IS NULL THEN RAISE EXCEPTION 'Service intention not found on this request'; END IF;
  END IF;

  DELETE FROM public.care_service_intention_recipients
   WHERE intention_id = _id AND NOT (request_recipient_id = ANY (_recipient_ids));
  FOREACH _recipient IN ARRAY _recipient_ids LOOP
    INSERT INTO public.care_service_intention_recipients (intention_id, request_recipient_id)
    VALUES (_id, _recipient)
    ON CONFLICT (intention_id, request_recipient_id) DO NOTHING;
  END LOOP;

  RETURN _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_service_intention_remove(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  PERFORM private.care_group_admin_guard();
  DELETE FROM public.care_service_intentions WHERE id = _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.care_visit_set(
  _visit_id uuid, _group_id uuid, _request_id uuid DEFAULT NULL,
  _appointment_at timestamptz DEFAULT NULL, _appointment_ends_at timestamptz DEFAULT NULL,
  _location_kind text DEFAULT NULL, _address_line text DEFAULT NULL,
  _assessor_person_id uuid DEFAULT NULL, _status text DEFAULT NULL, _notes text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _id uuid;
BEGIN
  PERFORM private.care_group_admin_guard();
  IF _visit_id IS NULL THEN
    INSERT INTO public.care_assessment_visits (group_id, request_id, appointment_at, appointment_ends_at,
      location_kind, address_line, assessor_person_id, status, notes, created_by)
    VALUES (_group_id, _request_id, _appointment_at, _appointment_ends_at,
            COALESCE(_location_kind, 'home'), _address_line, _assessor_person_id,
            COALESCE(_status, 'planned'), _notes, auth.uid())
    RETURNING id INTO _id;
  ELSE
    UPDATE public.care_assessment_visits SET
      request_id = COALESCE(_request_id, request_id),
      appointment_at = _appointment_at,
      appointment_ends_at = _appointment_ends_at,
      location_kind = COALESCE(_location_kind, location_kind),
      address_line = _address_line,
      assessor_person_id = _assessor_person_id,
      status = COALESCE(_status, status),
      notes = _notes,
      updated_at = now()
     WHERE id = _visit_id RETURNING id INTO _id;
    IF _id IS NULL THEN RAISE EXCEPTION 'Assessment visit not found'; END IF;
  END IF;
  RETURN _id;
END;
$function$;

-- Attaching work to a visit shares the appointment facts. It never merges documents.
CREATE OR REPLACE FUNCTION public.care_visit_attach_work(_visit_id uuid, _work_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _visit public.care_assessment_visits%ROWTYPE; _client uuid; _ok boolean;
BEGIN
  PERFORM private.care_group_admin_guard();
  SELECT * INTO _visit FROM public.care_assessment_visits WHERE id = _visit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment visit not found'; END IF;
  SELECT client_id INTO _client FROM public.care_assessment_work WHERE id = _work_id;
  IF _client IS NULL THEN RAISE EXCEPTION 'Assessment work not found'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.care_request_recipients rr
      JOIN public.care_requests r ON r.id = rr.request_id
     WHERE rr.client_id = _client AND r.group_id = _visit.group_id
  ) INTO _ok;
  IF NOT _ok THEN
    RAISE EXCEPTION 'That recipient is not part of this care group';
  END IF;

  UPDATE public.care_assessment_work SET
    visit_id = _visit_id,
    appointment_at = COALESCE(_visit.appointment_at, appointment_at),
    appointment_ends_at = COALESCE(_visit.appointment_ends_at, appointment_ends_at),
    location_kind = _visit.location_kind,
    updated_at = now()
   WHERE id = _work_id;
END;
$function$;

-- ---------------------------------------------------------------- read model
CREATE OR REPLACE FUNCTION public.care_group_overview(_group_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _out jsonb;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to read care groups';
  END IF;

  SELECT jsonb_build_object(
    'group', to_jsonb(g),
    'members', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'role', m.role, 'person_id', m.person_id,
        'full_name', p.full_name, 'email', p.email, 'phone', p.phone) ORDER BY m.created_at)
      FROM public.care_group_members m JOIN public.care_people p ON p.id = m.person_id
      WHERE m.group_id = g.id), '[]'::jsonb),
    'relationships', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', rel.id, 'from_person_id', rel.from_person_id, 'to_person_id', rel.to_person_id,
        'relationship_code', rel.relationship_code, 'other_label', rel.other_label) ORDER BY rel.created_at)
      FROM public.care_person_relationships rel WHERE rel.group_id = g.id), '[]'::jsonb),
    'requests', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'status', r.status, 'source', r.source,
        'enquirer_person_id', r.enquirer_person_id, 'created_at', r.created_at,
        'recipients', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'id', rr.id, 'client_id', rr.client_id, 'person_id', rr.person_id,
            'full_name', c.full_name, 'display_order', rr.display_order,
            'address_line', COALESCE(rr.address_line, c.address_line)) ORDER BY rr.display_order)
          FROM public.care_request_recipients rr JOIN public.clients c ON c.id = rr.client_id
          WHERE rr.request_id = r.id), '[]'::jsonb),
        'services', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'id', si.id, 'service_id', si.service_id, 'service_name', s.name, 'service_slug', s.slug,
            'state', si.state, 'is_shared', si.is_shared, 'reason', si.reason,
            'recipients', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'request_recipient_id', sir.request_recipient_id,
                'needs_clinical_resolution', sir.needs_clinical_resolution,
                'conflict_reason', sir.conflict_reason))
              FROM public.care_service_intention_recipients sir
              WHERE sir.intention_id = si.id), '[]'::jsonb)) ORDER BY si.created_at)
          FROM public.care_service_intentions si JOIN public.services s ON s.id = si.service_id
          WHERE si.request_id = r.id), '[]'::jsonb)
      ) ORDER BY r.created_at)
      FROM public.care_requests r WHERE r.group_id = g.id), '[]'::jsonb),
    'visits', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', v.id, 'appointment_at', v.appointment_at, 'location_kind', v.location_kind,
        'status', v.status, 'assessor_person_id', v.assessor_person_id,
        'work_ids', COALESCE((SELECT jsonb_agg(w.id) FROM public.care_assessment_work w
                              WHERE w.visit_id = v.id), '[]'::jsonb)) ORDER BY v.appointment_at)
      FROM public.care_assessment_visits v WHERE v.group_id = g.id), '[]'::jsonb)
  ) INTO _out
  FROM public.care_groups g WHERE g.id = _group_id;

  IF _out IS NULL THEN RAISE EXCEPTION 'Care group not found'; END IF;
  RETURN _out;
END;
$function$;

-- Every writer is admin-only and server-derives the actor. No anon execution.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.care_group_ensure(uuid)',
    'public.care_group_save(uuid,text,text,text,text,text)',
    'public.care_group_member_set(uuid,uuid,text,text)',
    'public.care_relationship_set(uuid,uuid,text,uuid,text)',
    'public.care_relationship_remove(uuid)',
    'public.care_request_save(uuid,uuid,uuid,text,text,text,timestamptz,text)',
    'public.care_request_recipient_add(uuid,uuid,uuid,text,text,text,text,integer)',
    'public.care_request_recipient_remove(uuid)',
    'public.care_service_intention_set(uuid,uuid,uuid,uuid[],text,boolean,text,text)',
    'public.care_service_intention_remove(uuid)',
    'public.care_visit_set(uuid,uuid,uuid,timestamptz,timestamptz,text,text,uuid,text,text)',
    'public.care_visit_attach_work(uuid,uuid)',
    'public.care_group_overview(uuid)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, public', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ----------------------------------------------------------------- backfill
-- One compatibility group per existing care record. Nothing existing is edited.
INSERT INTO public.care_groups (display_name, address_line, landmark, state_code, lga_code, source, origin_client_id)
SELECT c.full_name, c.address_line, c.landmark, c.state_code, c.lga_code, 'backfill', c.id
  FROM public.clients c
 WHERE NOT EXISTS (SELECT 1 FROM public.care_groups g WHERE g.origin_client_id = c.id);

INSERT INTO public.care_requests (group_id, status, source, created_from_submission_id)
SELECT g.id, 'open', 'backfill', c.created_from_submission_id
  FROM public.care_groups g JOIN public.clients c ON c.id = g.origin_client_id
 WHERE g.origin_client_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.care_requests r WHERE r.group_id = g.id);

INSERT INTO public.care_request_recipients (request_id, client_id, address_line, landmark, state_code, lga_code, display_order)
SELECT r.id, c.id, c.address_line, c.landmark, c.state_code, c.lga_code, 1
  FROM public.care_groups g
  JOIN public.clients c ON c.id = g.origin_client_id
  JOIN public.care_requests r ON r.group_id = g.id
 WHERE g.origin_client_id IS NOT NULL
ON CONFLICT (request_id, client_id) DO NOTHING;

-- The original service stays exactly where it was, as a compatibility projection.
COMMENT ON COLUMN public.clients.service_id IS
  'Original single service for this record. Compatibility projection only: the full truth now lives in care_service_intentions.';
