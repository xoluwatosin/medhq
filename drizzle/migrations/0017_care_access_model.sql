-- Tranche 2A.2 + 2A.3: Care access model and row level security.
-- Person -> recorded access basis -> client specific grant -> RLS.
-- Relationship labels and enquiry ownership create nothing here.

CREATE TABLE public.care_access_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.care_people(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  basis_kind text NOT NULL CHECK (basis_kind IN (
    'self_identity',
    'guardian_authority',
    'client_consent',
    'authorised_representative',
    'court_or_legal_instrument',
    'clinical_referral_disclosure',
    'finance_participant'
  )),
  evidence_note text,
  evidence_sighted boolean NOT NULL DEFAULT false,
  recorded_by uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  withdrawn_by uuid,
  withdrawn_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_access_bases_person_client_idx
  ON public.care_access_bases (person_id, client_id);
CREATE INDEX care_access_bases_client_id_idx ON public.care_access_bases (client_id);

GRANT SELECT, INSERT, UPDATE ON public.care_access_bases TO authenticated;
GRANT ALL ON public.care_access_bases TO service_role;
ALTER TABLE public.care_access_bases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage care access bases" ON public.care_access_bases FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER care_access_bases_touch
  BEFORE UPDATE ON public.care_access_bases
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

CREATE TABLE public.care_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.care_people(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  purpose text,
  journey_scope boolean NOT NULL DEFAULT false,
  clinical_scope boolean NOT NULL DEFAULT false,
  finance_scope boolean NOT NULL DEFAULT false,
  clinical_basis_id uuid REFERENCES public.care_access_bases(id) ON DELETE RESTRICT,
  finance_basis_id uuid REFERENCES public.care_access_bases(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'invited' CHECK (state IN ('invited','active','suspended','revoked')),
  grant_reason text,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  suspended_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  revoked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_access_grants_one_per_client UNIQUE (person_id, client_id),
  CONSTRAINT care_access_grants_some_scope CHECK (journey_scope OR clinical_scope OR finance_scope)
);
CREATE INDEX care_access_grants_person_id_idx ON public.care_access_grants (person_id);
CREATE INDEX care_access_grants_client_id_idx ON public.care_access_grants (client_id);

GRANT SELECT, INSERT, UPDATE ON public.care_access_grants TO authenticated;
GRANT ALL ON public.care_access_grants TO service_role;
ALTER TABLE public.care_access_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage care access grants" ON public.care_access_grants FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER care_access_grants_touch
  BEFORE UPDATE ON public.care_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

CREATE OR REPLACE FUNCTION public.care_grant_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE b record;
BEGIN
  IF NEW.clinical_scope THEN
    IF NEW.clinical_basis_id IS NULL THEN
      RAISE EXCEPTION 'Clinical access needs a recorded basis';
    END IF;
    SELECT * INTO b FROM public.care_access_bases WHERE id = NEW.clinical_basis_id;
    IF b.id IS NULL OR b.person_id <> NEW.person_id OR b.client_id <> NEW.client_id THEN
      RAISE EXCEPTION 'The clinical basis belongs to another person or client';
    END IF;
    IF b.withdrawn_at IS NOT NULL THEN
      RAISE EXCEPTION 'The clinical basis has been withdrawn';
    END IF;
    IF b.basis_kind = 'finance_participant' THEN
      RAISE EXCEPTION 'A finance basis cannot support clinical access';
    END IF;
  END IF;

  IF NEW.finance_scope THEN
    IF NEW.finance_basis_id IS NULL THEN
      RAISE EXCEPTION 'Finance access needs a recorded finance basis';
    END IF;
    SELECT * INTO b FROM public.care_access_bases WHERE id = NEW.finance_basis_id;
    IF b.id IS NULL OR b.person_id <> NEW.person_id OR b.client_id <> NEW.client_id THEN
      RAISE EXCEPTION 'The finance basis belongs to another person or client';
    END IF;
    IF b.withdrawn_at IS NOT NULL THEN
      RAISE EXCEPTION 'The finance basis has been withdrawn';
    END IF;
    IF b.basis_kind <> 'finance_participant' THEN
      RAISE EXCEPTION 'Finance access needs a finance participant basis';
    END IF;
  END IF;

  IF NEW.state = 'revoked' AND NEW.revoked_at IS NULL THEN
    NEW.revoked_at := now();
  END IF;
  IF NEW.state = 'suspended' AND NEW.suspended_at IS NULL THEN
    NEW.suspended_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER care_access_grants_guard
  BEFORE INSERT OR UPDATE ON public.care_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.care_grant_guard();

CREATE OR REPLACE FUNCTION public.care_basis_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.withdrawn_at IS NOT NULL AND OLD.withdrawn_at IS NULL THEN
    UPDATE public.care_access_grants
      SET clinical_scope = false, clinical_basis_id = NULL
      WHERE clinical_basis_id = NEW.id;
    UPDATE public.care_access_grants
      SET finance_scope = false, finance_basis_id = NULL
      WHERE finance_basis_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER care_access_bases_withdrawal
  AFTER UPDATE ON public.care_access_bases
  FOR EACH ROW EXECUTE FUNCTION public.care_basis_withdrawal();

ALTER TABLE public.care_access_tokens
  ADD COLUMN person_id uuid REFERENCES public.care_people(id) ON DELETE SET NULL;
CREATE INDEX care_access_tokens_person_id_idx ON public.care_access_tokens (person_id);

UPDATE public.care_access_tokens t
  SET person_id = c.person_id
  FROM public.client_contacts c
  WHERE t.contact_id = c.id AND t.person_id IS NULL;

ALTER TABLE public.client_commercial
  ADD COLUMN payer_person_id uuid REFERENCES public.care_people(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.care_my_person_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.care_people p
  WHERE auth.uid() IS NOT NULL
    AND p.auth_user_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.care_my_person_ids() TO authenticated;

CREATE OR REPLACE FUNCTION private.care_has_scope(_client_id uuid, _scope text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.care_access_grants g
    JOIN public.care_people p ON p.id = g.person_id
    WHERE auth.uid() IS NOT NULL
      AND p.auth_user_id = auth.uid()
      AND g.client_id = _client_id
      AND g.state = 'active'
      AND CASE _scope
        WHEN 'journey' THEN g.journey_scope
        WHEN 'clinical' THEN g.clinical_scope AND EXISTS (
          SELECT 1 FROM public.care_access_bases b
          WHERE b.id = g.clinical_basis_id
            AND b.person_id = g.person_id
            AND b.client_id = g.client_id
            AND b.withdrawn_at IS NULL
            AND b.basis_kind <> 'finance_participant'
        )
        WHEN 'finance' THEN g.finance_scope AND EXISTS (
          SELECT 1 FROM public.care_access_bases b
          WHERE b.id = g.finance_basis_id
            AND b.person_id = g.person_id
            AND b.client_id = g.client_id
            AND b.withdrawn_at IS NULL
            AND b.basis_kind = 'finance_participant'
        )
        ELSE false
      END
  )
$$;
GRANT EXECUTE ON FUNCTION private.care_has_scope(uuid, text) TO authenticated;

CREATE POLICY "Granted people read their client" ON public.clients FOR SELECT TO authenticated
  USING (
    private.care_has_scope(id, 'journey')
    OR private.care_has_scope(id, 'clinical')
    OR private.care_has_scope(id, 'finance')
  );

CREATE POLICY "Clinical grant reads issued care plans" ON public.care_documents FOR SELECT TO authenticated
  USING (
    kind = 'care_plan'
    AND status = 'submitted'
    AND private.care_has_scope(client_id, 'clinical')
  );

CREATE POLICY "Finance grant reads client commercial" ON public.client_commercial FOR SELECT TO authenticated
  USING (private.care_has_scope(client_id, 'finance'));

CREATE POLICY "People read their own care person record" ON public.care_people FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND auth_user_id = auth.uid());

CREATE POLICY "People read their own grants" ON public.care_access_grants FOR SELECT TO authenticated
  USING (person_id IN (SELECT public.care_my_person_ids()));

CREATE POLICY "People read their own bases" ON public.care_access_bases FOR SELECT TO authenticated
  USING (person_id IN (SELECT public.care_my_person_ids()));