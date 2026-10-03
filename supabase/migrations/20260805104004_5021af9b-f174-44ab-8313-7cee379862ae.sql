
-- Flow A: enquiry intake + client list, sealed inside the clinical schema.

CREATE TABLE clinical.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('MC-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  -- who the care is for
  client_name text NOT NULL,
  date_of_birth date,
  phone text,
  email text,
  address_line text,
  lga text,
  state text,
  -- who got in touch
  enquirer_name text,
  enquirer_relationship text,
  enquirer_phone text,
  enquirer_email text,
  -- the enquiry itself
  service_interest text,
  care_needs text,
  urgency text CHECK (urgency IN ('immediate','within_a_week','within_a_month','planning_ahead')),
  funding_note text,
  source text,
  stage text NOT NULL DEFAULT 'enquiry'
    CHECK (stage IN ('enquiry','assessment_booked','assessment_done','care_planned','active','on_hold','closed')),
  stage_note text,
  closed_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX clinical_clients_stage_idx ON clinical.clients(stage);
CREATE INDEX clinical_clients_created_idx ON clinical.clients(created_at DESC);

ALTER TABLE clinical.clients ENABLE ROW LEVEL SECURITY;
-- No grants to anon/authenticated: the clinical schema is not on the Data API.
-- Every access goes through the SECURITY DEFINER functions below.
GRANT ALL ON clinical.clients TO service_role;

CREATE TRIGGER clinical_clients_updated_at BEFORE UPDATE ON clinical.clients
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- LIST -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clinical_client_list(
  _search text DEFAULT NULL, _stage text DEFAULT NULL, _limit integer DEFAULT 200
) RETURNS TABLE(
  id uuid, reference text, client_name text, phone text, lga text, state text,
  service_interest text, urgency text, stage text, created_at timestamptz, updated_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, clinical AS $$
BEGIN
  IF NOT public.clinical_session_ok() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN QUERY
  SELECT c.id, c.reference, c.client_name, c.phone, c.lga, c.state,
         c.service_interest, c.urgency, c.stage, c.created_at, c.updated_at
    FROM clinical.clients c
   WHERE (_stage IS NULL OR c.stage = _stage)
     AND (
       _search IS NULL OR btrim(_search) = '' OR
       c.client_name ILIKE '%'||_search||'%' OR
       coalesce(c.reference,'') ILIKE '%'||_search||'%' OR
       coalesce(c.phone,'') ILIKE '%'||_search||'%' OR
       coalesce(c.enquirer_name,'') ILIKE '%'||_search||'%'
     )
   ORDER BY c.created_at DESC
   LIMIT greatest(1, least(coalesce(_limit,200), 500));
END;
$$;

-- GET (logged) ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clinical_client_get(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, clinical AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.clinical_session_ok() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT to_jsonb(c) INTO result FROM clinical.clients c WHERE c.id = _id;
  IF result IS NULL THEN RAISE EXCEPTION 'Client not found'; END IF;
  RETURN result;
END;
$$;

-- CREATE ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clinical_client_create(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, clinical AS $$
DECLARE new_row clinical.clients%ROWTYPE;
BEGIN
  IF NOT public.clinical_session_ok() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF coalesce(btrim(_payload->>'client_name'),'') = '' THEN
    RAISE EXCEPTION 'The name of the person needing care is required';
  END IF;

  INSERT INTO clinical.clients (
    client_name, date_of_birth, phone, email, address_line, lga, state,
    enquirer_name, enquirer_relationship, enquirer_phone, enquirer_email,
    service_interest, care_needs, urgency, funding_note, source, created_by
  ) VALUES (
    btrim(_payload->>'client_name'),
    nullif(_payload->>'date_of_birth','')::date,
    nullif(btrim(coalesce(_payload->>'phone','')),''),
    nullif(btrim(coalesce(_payload->>'email','')),''),
    nullif(btrim(coalesce(_payload->>'address_line','')),''),
    nullif(btrim(coalesce(_payload->>'lga','')),''),
    nullif(btrim(coalesce(_payload->>'state','')),''),
    nullif(btrim(coalesce(_payload->>'enquirer_name','')),''),
    nullif(btrim(coalesce(_payload->>'enquirer_relationship','')),''),
    nullif(btrim(coalesce(_payload->>'enquirer_phone','')),''),
    nullif(btrim(coalesce(_payload->>'enquirer_email','')),''),
    nullif(btrim(coalesce(_payload->>'service_interest','')),''),
    nullif(btrim(coalesce(_payload->>'care_needs','')),''),
    nullif(_payload->>'urgency',''),
    nullif(btrim(coalesce(_payload->>'funding_note','')),''),
    nullif(btrim(coalesce(_payload->>'source','')),''),
    auth.uid()
  ) RETURNING * INTO new_row;

  PERFORM public.clinical_log('client', 'create', new_row.id, new_row.id,
    jsonb_build_object('reference', new_row.reference, 'stage', new_row.stage));
  RETURN to_jsonb(new_row);
END;
$$;

-- UPDATE (partial, confirm-with-history at the UI layer) -----------------------
CREATE OR REPLACE FUNCTION public.clinical_client_update(_id uuid, _payload jsonb, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, clinical AS $$
DECLARE before_row clinical.clients%ROWTYPE; after_row clinical.clients%ROWTYPE; changes jsonb := '{}'::jsonb; k text;
BEGIN
  IF NOT public.clinical_session_ok() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT * INTO before_row FROM clinical.clients WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client not found'; END IF;

  UPDATE clinical.clients SET
    client_name           = coalesce(nullif(btrim(_payload->>'client_name'),''), client_name),
    date_of_birth         = CASE WHEN _payload ? 'date_of_birth' THEN nullif(_payload->>'date_of_birth','')::date ELSE date_of_birth END,
    phone                 = CASE WHEN _payload ? 'phone' THEN nullif(btrim(_payload->>'phone'),'') ELSE phone END,
    email                 = CASE WHEN _payload ? 'email' THEN nullif(btrim(_payload->>'email'),'') ELSE email END,
    address_line          = CASE WHEN _payload ? 'address_line' THEN nullif(btrim(_payload->>'address_line'),'') ELSE address_line END,
    lga                   = CASE WHEN _payload ? 'lga' THEN nullif(btrim(_payload->>'lga'),'') ELSE lga END,
    state                 = CASE WHEN _payload ? 'state' THEN nullif(btrim(_payload->>'state'),'') ELSE state END,
    enquirer_name         = CASE WHEN _payload ? 'enquirer_name' THEN nullif(btrim(_payload->>'enquirer_name'),'') ELSE enquirer_name END,
    enquirer_relationship = CASE WHEN _payload ? 'enquirer_relationship' THEN nullif(btrim(_payload->>'enquirer_relationship'),'') ELSE enquirer_relationship END,
    enquirer_phone        = CASE WHEN _payload ? 'enquirer_phone' THEN nullif(btrim(_payload->>'enquirer_phone'),'') ELSE enquirer_phone END,
    enquirer_email        = CASE WHEN _payload ? 'enquirer_email' THEN nullif(btrim(_payload->>'enquirer_email'),'') ELSE enquirer_email END,
    service_interest      = CASE WHEN _payload ? 'service_interest' THEN nullif(btrim(_payload->>'service_interest'),'') ELSE service_interest END,
    care_needs            = CASE WHEN _payload ? 'care_needs' THEN nullif(btrim(_payload->>'care_needs'),'') ELSE care_needs END,
    urgency               = CASE WHEN _payload ? 'urgency' THEN nullif(_payload->>'urgency','') ELSE urgency END,
    funding_note          = CASE WHEN _payload ? 'funding_note' THEN nullif(btrim(_payload->>'funding_note'),'') ELSE funding_note END,
    source                = CASE WHEN _payload ? 'source' THEN nullif(btrim(_payload->>'source'),'') ELSE source END
  WHERE id = _id RETURNING * INTO after_row;

  FOR k IN SELECT jsonb_object_keys(to_jsonb(after_row)) LOOP
    IF to_jsonb(before_row)->k IS DISTINCT FROM to_jsonb(after_row)->k AND k <> 'updated_at' THEN
      changes := changes || jsonb_build_object(k, jsonb_build_object('from', to_jsonb(before_row)->k, 'to', to_jsonb(after_row)->k));
    END IF;
  END LOOP;

  IF changes <> '{}'::jsonb THEN
    PERFORM public.clinical_log('client', 'update', _id, _id,
      jsonb_build_object('changes', changes, 'reason', _reason));
  END IF;
  RETURN to_jsonb(after_row);
END;
$$;

-- STAGE CHANGE ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clinical_client_set_stage(_id uuid, _stage text, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, clinical AS $$
DECLARE old_stage text; row_after clinical.clients%ROWTYPE;
BEGIN
  IF NOT public.clinical_session_ok() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT stage INTO old_stage FROM clinical.clients WHERE id = _id;
  IF old_stage IS NULL THEN RAISE EXCEPTION 'Client not found'; END IF;

  UPDATE clinical.clients
     SET stage = _stage,
         stage_note = _note,
         closed_reason = CASE WHEN _stage = 'closed' THEN coalesce(_note, closed_reason) ELSE closed_reason END
   WHERE id = _id RETURNING * INTO row_after;

  PERFORM public.clinical_log('client', 'stage_change', _id, _id,
    jsonb_build_object('from', old_stage, 'to', _stage, 'note', _note));
  RETURN to_jsonb(row_after);
END;
$$;

-- SUMMARY ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clinical_client_counts()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, clinical AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.clinical_session_ok() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT coalesce(jsonb_object_agg(stage, n), '{}'::jsonb) INTO result
    FROM (SELECT stage, count(*) AS n FROM clinical.clients GROUP BY stage) t;
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clinical_client_list(text,text,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clinical_client_get(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clinical_client_create(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clinical_client_update(uuid,jsonb,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clinical_client_set_stage(uuid,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clinical_client_counts() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.clinical_client_list(text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clinical_client_get(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clinical_client_create(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clinical_client_update(uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clinical_client_set_stage(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clinical_client_counts() TO authenticated;
