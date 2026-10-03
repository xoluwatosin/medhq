-- 13. candidate_gaps becomes a derived value ------------------------------

CREATE OR REPLACE FUNCTION public.mu_expects_licence(_profession text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN coalesce(btrim(coalesce(_profession, '')), '') = '' THEN false
    WHEN _profession ~* '(registered nurse|nursing officer|staff nurse|midwif|medical doctor|physician|pharmacist|pharmacy technician|physiotherap|physical therap|laboratory scientist|medical lab|radiograph|sonograph|paramedic|emergency medical|occupational therap|speech and language|dietit|dietic|nutrition|psycholog|counsell|community health extension|dent(ist|al surgeon)|optometr)'
      THEN true
    ELSE false
  END
$$;

COMMENT ON FUNCTION public.mu_expects_licence(text) IS
  'Which profession families are expected to hold a practising licence. Anything outside this list is never asked for licence fields.';

CREATE OR REPLACE FUNCTION public.mu_candidate_gaps_row(p public.mu_people)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g text[] := '{}';
  lic_state text;
  pending text[];
BEGIN
  -- Fields the candidate has already answered and that are sitting with our
  -- team are not gaps; asking twice is how you lose people.
  SELECT coalesce(array_agg(DISTINCT field), '{}')
    INTO pending
    FROM public.mu_parsed_fields
   WHERE person_id = p.id AND status = 'candidate_updated'
     AND coalesce(btrim(coalesce(value, '')), '') <> '';

  IF coalesce(btrim(coalesce(p.profession, '')), '') = '' THEN g := g || 'profession'; END IF;
  IF p.years_experience IS NULL THEN g := g || 'years_experience'; END IF;
  IF coalesce(btrim(coalesce(p.state, '')), '') = '' THEN g := g || 'state'; END IF;
  IF coalesce(btrim(coalesce(p.lga, '')), '') = '' THEN g := g || 'lga'; END IF;

  -- Applicability comes from the claim, not from field nullness.
  SELECT public.mu_credential_state(c.claim, c.evidence_document_id, c.verification_outcome, c.expires_at)
    INTO lic_state
    FROM public.mu_credentials c
   WHERE c.person_id = p.id AND c.credential_type = 'licence';
  lic_state := coalesce(lic_state, 'unknown');

  IF public.mu_expects_licence(p.profession) AND lic_state NOT IN ('declined', 'verified') THEN
    IF coalesce(btrim(coalesce(p.licensing_body, '')), '') = '' THEN g := g || 'licensing_body'; END IF;
    IF coalesce(btrim(coalesce(p.license_number, '')), '') = '' THEN g := g || 'license_number'; END IF;
    IF p.license_expiry IS NULL THEN g := g || 'license_expiry'; END IF;
  END IF;

  IF p.last_availability_update IS NULL THEN g := g || 'availability'; END IF;

  SELECT coalesce(array_agg(x ORDER BY ord), '{}') INTO g
    FROM unnest(g) WITH ORDINALITY t(x, ord)
   WHERE NOT (x = ANY (pending));

  RETURN to_jsonb(g);
END;
$$;

-- Derived on every write to mu_people. Nothing may write it directly.
CREATE OR REPLACE FUNCTION public.mu_people_derive_gaps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.candidate_gaps := public.mu_candidate_gaps_row(NEW);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_mu_people_derive_gaps ON public.mu_people;
CREATE TRIGGER zz_mu_people_derive_gaps
  BEFORE INSERT OR UPDATE ON public.mu_people
  FOR EACH ROW EXECUTE FUNCTION public.mu_people_derive_gaps();

-- Credentials and candidate answers both change the answer, so both re-derive.
CREATE OR REPLACE FUNCTION public.mu_rederive_gaps_for_person()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := coalesce(NEW.person_id, OLD.person_id);
BEGIN
  UPDATE public.mu_people SET updated_at = updated_at WHERE id = pid;
  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS mu_credentials_rederive_gaps ON public.mu_credentials;
CREATE TRIGGER mu_credentials_rederive_gaps
  AFTER INSERT OR UPDATE OR DELETE ON public.mu_credentials
  FOR EACH ROW EXECUTE FUNCTION public.mu_rederive_gaps_for_person();

DROP TRIGGER IF EXISTS mu_parsed_fields_rederive_gaps ON public.mu_parsed_fields;
CREATE TRIGGER mu_parsed_fields_rederive_gaps
  AFTER INSERT OR UPDATE OR DELETE ON public.mu_parsed_fields
  FOR EACH ROW EXECUTE FUNCTION public.mu_rederive_gaps_for_person();

-- The guard no longer needs to protect a column nobody can write.
CREATE OR REPLACE FUNCTION public.mu_people_guard_admin_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR private.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.verification_state    := OLD.verification_state;
  NEW.status                := OLD.status;
  NEW.admin_notes           := OLD.admin_notes;
  NEW.profession_confidence := OLD.profession_confidence;
  NEW.profession_source     := OLD.profession_source;
  NEW.auth_user_id          := OLD.auth_user_id;
  NEW.email_key             := OLD.email_key;
  NEW.phone_key             := OLD.phone_key;
  NEW.parse_status          := OLD.parse_status;
  NEW.parsed_at             := OLD.parsed_at;
  NEW.invited_at            := OLD.invited_at;
  NEW.claimed_at            := OLD.claimed_at;
  NEW.created_at            := OLD.created_at;
  NEW.promotion_provenance  := OLD.promotion_provenance;

  RETURN NEW;
END;
$$;

-- 15. One function attaches a document to a credential, for both paths ------

CREATE OR REPLACE FUNCTION public.mu_attach_credential_document(
  _person_id uuid,
  _credential_type text,
  _document_id uuid,
  _claim_source text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin boolean;
  existing public.mu_credentials%ROWTYPE;
  before_state text := 'unknown';
  after_state text;
  actor text;
BEGIN
  is_admin := auth.uid() IS NOT NULL AND private.has_role(auth.uid(), 'admin'::app_role);
  IF NOT is_admin AND public.mu_my_person_id() IS DISTINCT FROM _person_id THEN
    RAISE EXCEPTION 'Not authorised to attach evidence for this person';
  END IF;

  IF _credential_type NOT IN ('licence', 'right_to_work', 'nysc', 'qualification', 'id') THEN
    RAISE EXCEPTION 'Unknown credential type %', _credential_type;
  END IF;

  PERFORM 1 FROM public.mu_documents d WHERE d.id = _document_id AND d.person_id = _person_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That document does not belong to this person';
  END IF;

  SELECT * INTO existing FROM public.mu_credentials
   WHERE person_id = _person_id AND credential_type = _credential_type;

  IF FOUND THEN
    before_state := public.mu_credential_state(existing.claim, existing.evidence_document_id,
                                               existing.verification_outcome, existing.expires_at);
    UPDATE public.mu_credentials
       SET evidence_document_id = _document_id,
           claim_source = coalesce(_claim_source, claim_source)
     WHERE id = existing.id
     RETURNING * INTO existing;
  ELSE
    INSERT INTO public.mu_credentials (person_id, credential_type, evidence_document_id, claim_source)
    VALUES (_person_id, _credential_type, _document_id, _claim_source)
    RETURNING * INTO existing;
  END IF;

  after_state := public.mu_credential_state(existing.claim, existing.evidence_document_id,
                                            existing.verification_outcome, existing.expires_at);

  actor := CASE WHEN is_admin THEN 'admin' ELSE 'candidate' END;
  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (_person_id, auth.uid(), actor, 'credential_evidence_attached',
          jsonb_build_object('credential_type', _credential_type, 'document_id', _document_id,
                             'from', before_state, 'to', after_state, 'via', actor));

  RETURN jsonb_build_object('credential_id', existing.id, 'credential_type', _credential_type,
                            'from', before_state, 'to', after_state);
END;
$$;

REVOKE ALL ON FUNCTION public.mu_attach_credential_document(uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_attach_credential_document(uuid, text, uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.mu_candidate_gaps_row(public.mu_people) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_candidate_gaps_row(public.mu_people) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.mu_expects_licence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_expects_licence(text) TO authenticated, service_role;