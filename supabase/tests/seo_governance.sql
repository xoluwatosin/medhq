-- SEO governance acceptance suite.
-- Everything here is synthetic and rolled back. Dates are deterministic.
BEGIN;

-- The index guard is a deferred constraint trigger; make it fire per statement
-- so the suite can observe it without committing.
SET CONSTRAINTS ALL IMMEDIATE;

-- Act as an existing Medic Connect admin so the real authorisation path is used.
DO $$
DECLARE _admin uuid;
BEGIN
  SELECT user_id INTO _admin FROM public.user_roles WHERE role = 'admin'::app_role LIMIT 1;
  IF _admin IS NULL THEN
    RAISE EXCEPTION 'no admin role exists to test the governance write path';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin, 'role', 'authenticated')::text, true);
END $$;

-- 0. Fixtures ----------------------------------------------------------------
DO $$
DECLARE
  _service uuid;
  _fee uuid;
BEGIN
  INSERT INTO public.seo_pages (page_key, path, page_type, estate, publication_state, evidence_state)
  VALUES ('t_page', '/t-seo-page', 'service', 'families', 'planned', 'missing');

  INSERT INTO public.seo_modules (module_code, name, module_type, review_state)
  VALUES ('T-01', 'Synthetic module', 'trust', 'draft');

  INSERT INTO public.seo_modules (module_code, name, module_type, review_state, requires_clinical_review)
  VALUES ('T-02', 'Synthetic clinical module', 'clinical_scope', 'approved', true);

  INSERT INTO public.seo_claims (claim_code, claim_type, claim_text, state, valid_until)
  VALUES ('T-C1', 'operating_fact', 'Synthetic approved claim', 'approved', '2999-01-01T00:00:00Z');

  INSERT INTO public.seo_claims (claim_code, claim_type, claim_text, state, valid_until, requires_clinical_review)
  VALUES ('T-C2', 'service_scope', 'Synthetic clinical claim', 'approved', '2999-01-01T00:00:00Z', true);

  INSERT INTO public.seo_markets (market_key, market_state, safety_state)
  VALUES ('t_market', 'research', 'review');

  SELECT id INTO _service FROM public.services LIMIT 1;
  INSERT INTO public.service_fees (service_id, fee_type, label, amount_naira, state)
  VALUES (_service, 'visit', 'Synthetic fee', 1, 'not_set') RETURNING id INTO _fee;
  PERFORM set_config('seo.test_fee', _fee::text, true);
END $$;

-- A. Indexability gate --------------------------------------------------------
DO $$
DECLARE
  _page uuid;
  _module uuid;
  _claim uuid;
  _blockers text[];
BEGIN
  SELECT id INTO _page FROM public.seo_pages WHERE page_key = 't_page';
  SELECT id INTO _module FROM public.seo_modules WHERE module_code = 'T-01';
  SELECT id INTO _claim FROM public.seo_claims WHERE claim_code = 'T-C1';

  -- An unready page is blocked on readiness alone; evidence state is a note.
  _blockers := public.seo_page_blockers(_page);
  IF NOT _blockers @> ARRAY['Publication not ready'] THEN
    RAISE EXCEPTION 'A: an unready page must be blocked, got %', _blockers;
  END IF;
  IF _blockers @> ARRAY['Missing evidence'] THEN
    RAISE EXCEPTION 'A: evidence state must not gate publication, got %', _blockers;
  END IF;
  IF public.seo_page_set_index_state(_page, 'indexable') = '{}'::text[] THEN
    RAISE EXCEPTION 'A: an unready page must not become indexable';
  END IF;

  UPDATE public.seo_pages SET publication_state = 'ready', evidence_state = 'sufficient' WHERE id = _page;

  -- An unapproved required module blocks.
  INSERT INTO public.seo_page_modules (page_id, module_id, section_key) VALUES (_page, _module, 'body');
  IF NOT public.seo_page_blockers(_page) @> ARRAY['Required module not approved'] THEN
    RAISE EXCEPTION 'A: an unapproved required module must block';
  END IF;
  UPDATE public.seo_modules SET review_state = 'approved' WHERE id = _module;

  -- An unapproved required claim blocks.
  UPDATE public.seo_claims SET state = 'draft' WHERE id = _claim;
  INSERT INTO public.seo_page_claims (page_id, claim_id, usage_key) VALUES (_page, _claim, 'primary');
  IF NOT public.seo_page_blockers(_page) @> ARRAY['Required claim not approved'] THEN
    RAISE EXCEPTION 'A: an unapproved required claim must block';
  END IF;
  UPDATE public.seo_claims SET state = 'approved' WHERE id = _claim;

  -- Everything satisfied: the transition is allowed.
  IF public.seo_page_blockers(_page) <> '{}'::text[] THEN
    RAISE EXCEPTION 'A: a complete page must have no blockers, got %', public.seo_page_blockers(_page);
  END IF;
  IF public.seo_page_set_index_state(_page, 'indexable') <> '{}'::text[] THEN
    RAISE EXCEPTION 'A: a complete page must become indexable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.seo_pages WHERE id = _page AND index_state = 'indexable') THEN
    RAISE EXCEPTION 'A: the index state must be recorded';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.seo_indexable_pages WHERE id = _page) THEN
    RAISE EXCEPTION 'A: a satisfied page must appear in the publishable view';
  END IF;
  RAISE NOTICE 'A indexability gate: pass';
END $$;

-- B. Claim expiry + H. a dependency going bad after indexing -------------------
DO $$
DECLARE
  _page uuid;
  _claim uuid;
BEGIN
  SELECT id INTO _page FROM public.seo_pages WHERE page_key = 't_page';
  SELECT id INTO _claim FROM public.seo_claims WHERE claim_code = 'T-C1';

  IF public.seo_claim_effective_state('approved', NULL, '2999-01-01T00:00:00Z') <> 'approved' THEN
    RAISE EXCEPTION 'B: a current approved claim must read as approved';
  END IF;
  IF public.seo_claim_effective_state('approved', NULL, '2020-01-01T00:00:00Z') <> 'stale' THEN
    RAISE EXCEPTION 'B: an expired approved claim must read as stale';
  END IF;

  -- The claim expires while the page is already indexable.
  UPDATE public.seo_claims SET valid_until = '2020-01-01T00:00:00Z' WHERE id = _claim;

  IF NOT public.seo_page_blockers(_page) @> ARRAY['Required claim not approved'] THEN
    RAISE EXCEPTION 'B: an expired claim must block its page';
  END IF;
  IF public.seo_page_publishable(_page) THEN
    RAISE EXCEPTION 'B: a page with an expired claim must not be publishable';
  END IF;
  IF EXISTS (SELECT 1 FROM public.seo_pages WHERE id = _page AND index_state = 'indexable') THEN
    RAISE EXCEPTION 'H: the page must be withdrawn from indexing when its claim expires';
  END IF;
  IF EXISTS (SELECT 1 FROM public.seo_indexable_pages WHERE id = _page) THEN
    RAISE EXCEPTION 'H: a withdrawn page must not appear in the publishable view';
  END IF;

  -- Restored, it can be indexed again.
  UPDATE public.seo_claims SET valid_until = '2999-01-01T00:00:00Z' WHERE id = _claim;
  IF public.seo_page_set_index_state(_page, 'indexable') <> '{}'::text[] THEN
    RAISE EXCEPTION 'B: a restored claim must allow indexing again';
  END IF;
  RAISE NOTICE 'B claim expiry and H dependency invalidation: pass';
END $$;

-- C. Clinical risk is metadata, never a publication dependency -----------------
DO $$
DECLARE
  _plain uuid;
  _by_module uuid;
  _by_claim uuid;
  _module uuid;
  _claim uuid;
BEGIN
  SELECT id INTO _module FROM public.seo_modules WHERE module_code = 'T-02';
  SELECT id INTO _claim FROM public.seo_claims WHERE claim_code = 'T-C2';

  INSERT INTO public.seo_pages (page_key, path, page_type, estate, publication_state, evidence_state)
  VALUES ('t_plain', '/t-plain', 'service', 'families', 'ready', 'sufficient') RETURNING id INTO _plain;
  INSERT INTO public.seo_pages (page_key, path, page_type, estate, publication_state, evidence_state)
  VALUES ('t_mod', '/t-mod', 'service', 'families', 'ready', 'sufficient') RETURNING id INTO _by_module;
  INSERT INTO public.seo_pages (page_key, path, page_type, estate, publication_state, evidence_state)
  VALUES ('t_claim', '/t-claim', 'service', 'families', 'ready', 'sufficient') RETURNING id INTO _by_claim;

  IF array_to_string(public.seo_page_blockers(_plain), ';') ILIKE '%clinical%' THEN
    RAISE EXCEPTION 'C1: clinical review must never appear as a blocker';
  END IF;

  -- An approved clinical module carries risk metadata but must not block.
  INSERT INTO public.seo_page_modules (page_id, module_id, section_key) VALUES (_by_module, _module, 'body');
  IF public.seo_page_blockers(_by_module) <> '{}'::text[] THEN
    RAISE EXCEPTION 'C2: a clinically flagged module must not block, got %', public.seo_page_blockers(_by_module);
  END IF;

  -- The same holds for an approved clinically flagged claim on an undecided page.
  INSERT INTO public.seo_page_claims (page_id, claim_id, usage_key) VALUES (_by_claim, _claim, 'primary');
  IF public.seo_page_blockers(_by_claim) <> '{}'::text[] THEN
    RAISE EXCEPTION 'C3: a clinically flagged claim must not block, got %', public.seo_page_blockers(_by_claim);
  END IF;

  -- The metadata itself is preserved.
  IF NOT (SELECT requires_clinical_review FROM public.seo_modules WHERE id = _module) THEN
    RAISE EXCEPTION 'C4: clinical risk metadata must be preserved';
  END IF;
  RAISE NOTICE 'C clinical risk is metadata only: pass';
END $$;

-- D. Market serviceability -----------------------------------------------------
DO $$
DECLARE
  _page uuid;
  _market uuid;
BEGIN
  SELECT id INTO _market FROM public.seo_markets WHERE market_key = 't_market';
  INSERT INTO public.seo_pages (page_key, path, page_type, estate, publication_state, evidence_state)
  VALUES ('t_location', '/t-location', 'location', 'families', 'ready', 'sufficient') RETURNING id INTO _page;

  IF NOT public.seo_page_blockers(_page) @> ARRAY['Market not serviceable'] THEN
    RAISE EXCEPTION 'D: a location page with no market must be blocked';
  END IF;

  INSERT INTO public.seo_page_markets (page_id, market_id, local_evidence)
  VALUES (_page, _market, '{"local_note":"synthetic"}'::jsonb);
  IF NOT public.seo_page_blockers(_page) @> ARRAY['Market not serviceable'] THEN
    RAISE EXCEPTION 'D: a market under research must not satisfy the gate';
  END IF;

  UPDATE public.seo_markets SET market_state = 'established', safety_state = 'serviceable' WHERE id = _market;
  IF public.seo_page_blockers(_page) <> '{}'::text[] THEN
    RAISE EXCEPTION 'D: a serviceable market must satisfy the gate, got %', public.seo_page_blockers(_page);
  END IF;
  IF public.seo_page_set_index_state(_page, 'indexable') <> '{}'::text[] THEN
    RAISE EXCEPTION 'D: a serviceable location page must become indexable';
  END IF;

  -- Suspending the market must withdraw the page again.
  UPDATE public.seo_markets SET safety_state = 'suspended' WHERE id = _market;
  IF EXISTS (SELECT 1 FROM public.seo_pages WHERE id = _page AND index_state = 'indexable') THEN
    RAISE EXCEPTION 'D: suspending a market must withdraw the page from indexing';
  END IF;
  RAISE NOTICE 'D market serviceability: pass';
END $$;

-- D2. Pricing must be governed wherever a price is quoted ----------------------
DO $$
DECLARE
  _page uuid;
  _fee uuid := current_setting('seo.test_fee', true)::uuid;
BEGIN
  INSERT INTO public.seo_pages (page_key, path, page_type, estate, publication_state, clinical_requirement)
  VALUES ('t_pricing', '/t-pricing', 'pricing', 'families', 'ready', 'not_required') RETURNING id INTO _page;

  IF NOT public.seo_page_blockers(_page) @> ARRAY['Pricing not governed'] THEN
    RAISE EXCEPTION 'D2: a pricing page without a governed fee must be blocked';
  END IF;

  INSERT INTO public.seo_fee_refs (page_id, service_fee_id, usage_key) VALUES (_page, _fee, 'primary');
  IF NOT public.seo_page_blockers(_page) @> ARRAY['Pricing not governed'] THEN
    RAISE EXCEPTION 'D2: a fee that is not set must not satisfy the pricing gate';
  END IF;

  -- An internal operational rate must never satisfy the public pricing gate.
  UPDATE public.service_fees SET state = 'set', amount_naira = 1000, public_visibility = 'internal' WHERE id = _fee;
  IF NOT public.seo_page_blockers(_page) @> ARRAY['Pricing not governed'] THEN
    RAISE EXCEPTION 'D2: an internal-only fee must not be publishable';
  END IF;

  UPDATE public.service_fees
     SET public_visibility = 'public', price_treatment = 'fixed', billing_unit = 'per_visit',
         public_label = 'Synthetic public fee', is_current = true
   WHERE id = _fee;
  IF public.seo_page_blockers(_page) <> '{}'::text[] THEN
    RAISE EXCEPTION 'D2: a governed public fee must satisfy the gate, got %', public.seo_page_blockers(_page);
  END IF;

  -- Retiring the fee withdraws the public price again.
  UPDATE public.service_fees SET is_current = false WHERE id = _fee;
  IF NOT public.seo_page_blockers(_page) @> ARRAY['Pricing not governed'] THEN
    RAISE EXCEPTION 'D2: a superseded fee must not remain publishable';
  END IF;
  UPDATE public.service_fees SET public_visibility = 'internal', state = 'not_set', is_current = true WHERE id = _fee;
  RAISE NOTICE 'D2 governed public pricing: pass';
END $$;

-- E. Module revision history ---------------------------------------------------
DO $$
DECLARE
  _module uuid;
  _before jsonb;
  _rev record;
  _after public.seo_modules%ROWTYPE;
BEGIN
  SELECT id, content INTO _module, _before FROM public.seo_modules WHERE module_code = 'T-01';
  PERFORM public.seo_module_save(_module, '{"body":"first"}'::jsonb, 'Baseline summary', 'approved', 'Baseline content');
  UPDATE public.seo_modules SET review_state = 'approved' WHERE id = _module;

  PERFORM public.seo_module_save(_module, '{"body":"second"}'::jsonb, 'Second summary', NULL, 'Synthetic change');

  SELECT * INTO _rev FROM public.seo_module_revisions WHERE module_id = _module ORDER BY version DESC LIMIT 1;
  IF _rev.content <> '{"body":"first"}'::jsonb THEN
    RAISE EXCEPTION 'E: the previous content must be preserved, got %', _rev.content;
  END IF;
  IF _rev.created_at IS NULL THEN
    RAISE EXCEPTION 'E: the timestamp must be recorded';
  END IF;

  SELECT * INTO _after FROM public.seo_modules WHERE id = _module;
  IF _after.content <> '{"body":"second"}'::jsonb THEN
    RAISE EXCEPTION 'E: the new content must be stored';
  END IF;
  IF _after.review_state = 'approved' THEN
    RAISE EXCEPTION 'E: changed content must not keep an obsolete approval';
  END IF;
  BEGIN
    PERFORM public.seo_module_save(_module, '{"body":"third"}'::jsonb, NULL, 'approved', '   ');
    RAISE EXCEPTION 'E: a change note must be required';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT ILIKE '%change note%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'E module revision history: pass';
END $$;

-- F. Authorisation --------------------------------------------------------------
DO $$
DECLARE _denied boolean;
BEGIN
  -- Anonymous.
  SET LOCAL ROLE anon;
  _denied := false;
  BEGIN
    INSERT INTO public.seo_pages (page_key, path, page_type, estate) VALUES ('t_anon', '/t-anon', 'other', 'families');
  EXCEPTION WHEN insufficient_privilege THEN _denied := true;
  END;
  RESET ROLE;
  IF NOT _denied THEN RAISE EXCEPTION 'F: an anonymous user must not write governance records'; END IF;
END $$;

DO $$
DECLARE _denied boolean;
BEGIN
  -- Ordinary authenticated user, no admin role.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  _denied := false;
  BEGIN
    INSERT INTO public.seo_claims (claim_code, claim_type, claim_text) VALUES ('t_user', 'other', 'Not allowed');
  EXCEPTION WHEN insufficient_privilege THEN _denied := true;
  END;
  RESET ROLE;
  IF NOT _denied THEN RAISE EXCEPTION 'F: an ordinary authenticated user must not write governance records'; END IF;

  -- Nor through the admin write path: the database decides, not the client.
  SET LOCAL ROLE authenticated;
  _denied := false;
  BEGIN
    PERFORM public.seo_page_create('t_user_page', '/t-user-page', 'other', 'families', NULL);
  EXCEPTION WHEN raise_exception OR insufficient_privilege THEN _denied := true;
  END;
  RESET ROLE;
  IF NOT _denied THEN RAISE EXCEPTION 'F: the write path must refuse a non-admin'; END IF;
END $$;

DO $$
DECLARE
  _admin uuid;
  _page uuid;
BEGIN
  SELECT user_id INTO _admin FROM public.user_roles WHERE role = 'admin'::app_role LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  _page := public.seo_page_create('t_admin_page', '/t-admin-page', 'other', 'families', 'Synthetic admin page');
  PERFORM public.seo_page_save(_page, '{"notes":"Written by an authorised admin"}'::jsonb);
  RESET ROLE;
  IF NOT EXISTS (SELECT 1 FROM public.seo_pages WHERE id = _page AND notes = 'Written by an authorised admin') THEN
    RAISE EXCEPTION 'F: an authorised admin must be able to write through the governance path';
  END IF;
  RAISE NOTICE 'F authorisation: pass';
END $$;

-- G. Fee-reference ownership is exclusive ----------------------------------------
DO $$
DECLARE
  _page uuid;
  _module uuid;
  _fee uuid := current_setting('seo.test_fee', true)::uuid;
  _rejected boolean;
BEGIN
  SELECT id INTO _page FROM public.seo_pages WHERE page_key = 't_page';
  SELECT id INTO _module FROM public.seo_modules WHERE module_code = 'T-01';

  INSERT INTO public.seo_fee_refs (page_id, service_fee_id, usage_key) VALUES (_page, _fee, 'page_only');
  INSERT INTO public.seo_fee_refs (module_id, service_fee_id, usage_key) VALUES (_module, _fee, 'module_only');

  _rejected := false;
  BEGIN
    INSERT INTO public.seo_fee_refs (service_fee_id, usage_key) VALUES (_fee, 'neither');
  EXCEPTION WHEN check_violation THEN _rejected := true;
  END;
  IF NOT _rejected THEN RAISE EXCEPTION 'G: a fee reference with no owner must be rejected'; END IF;

  _rejected := false;
  BEGIN
    INSERT INTO public.seo_fee_refs (page_id, module_id, service_fee_id, usage_key) VALUES (_page, _module, _fee, 'both');
  EXCEPTION WHEN check_violation THEN _rejected := true;
  END;
  IF NOT _rejected THEN RAISE EXCEPTION 'G: a fee reference with two owners must be rejected'; END IF;
  RAISE NOTICE 'G fee reference ownership: pass';
END $$;

-- H (remainder). Publication state integrity --------------------------------------
DO $$
DECLARE
  _page uuid;
  _blockers text[];
BEGIN
  INSERT INTO public.seo_pages (page_key, path, page_type, estate)
  VALUES ('t_states', '/t-states', 'service', 'families') RETURNING id INTO _page;

  -- candidate → indexable without evidence.
  _blockers := public.seo_page_set_index_state(_page, 'indexable');
  IF _blockers = '{}'::text[] THEN RAISE EXCEPTION 'H: a candidate page must not be indexable'; END IF;

  -- ready but with an incomplete dependency.
  UPDATE public.seo_pages SET publication_state = 'ready', evidence_state = 'sufficient' WHERE id = _page;
  INSERT INTO public.seo_page_modules (page_id, module_id, section_key)
  SELECT _page, id, 'body' FROM public.seo_modules WHERE module_code = 'T-01';
  IF public.seo_page_set_index_state(_page, 'indexable') = '{}'::text[] THEN
    RAISE EXCEPTION 'H: an incomplete dependency must block indexing';
  END IF;

  -- fully satisfied.
  UPDATE public.seo_modules SET review_state = 'approved' WHERE module_code = 'T-01';
  IF public.seo_page_set_index_state(_page, 'indexable') <> '{}'::text[] THEN
    RAISE EXCEPTION 'H: a satisfied page must become indexable';
  END IF;

  -- the module is withdrawn afterwards.
  UPDATE public.seo_modules SET review_state = 'retired' WHERE module_code = 'T-01';
  IF EXISTS (SELECT 1 FROM public.seo_pages WHERE id = _page AND index_state = 'indexable') THEN
    RAISE EXCEPTION 'H: retiring a required module must withdraw the page';
  END IF;
  IF EXISTS (SELECT 1 FROM public.seo_indexable_pages WHERE id = _page) THEN
    RAISE EXCEPTION 'H: a withdrawn page must leave the publishable view';
  END IF;
  RAISE NOTICE 'H publication state integrity: pass';
END $$;

ROLLBACK;
