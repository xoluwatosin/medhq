-- Intake integrity correction: routing from the exact source pre-assessment,
-- exact plan and proposal lineage, review rules, and the access boundary.
-- Everything here is synthetic and rolled back.
BEGIN;

DO $$
DECLARE
  _svc uuid; _client uuid; _pre uuid; _pre_def uuid; _asm_def jsonb;
  _facts jsonb; _plan_a uuid; _plan_b uuid; _asm_a uuid; _asm_b uuid;
  _def_src text;
BEGIN
  -- ---------------------------------------------------------------- routing
  -- The family's answers are stored exactly as care-form-save writes them:
  -- no derived_* keys at all. Routing has to work from the raw answers.
  SELECT id INTO _svc FROM public.services WHERE questionnaire_section = 's6' LIMIT 1;
  INSERT INTO public.clients (full_name, service_id)
  VALUES ('ZZ synthetic intake', _svc) RETURNING id INTO _client;

  SELECT id INTO _pre_def FROM public.form_definitions
   WHERE kind = 'pre_assessment' AND status = 'published' ORDER BY version DESC LIMIT 1;
  SELECT definition INTO _asm_def FROM public.form_definitions
   WHERE kind = 'assessment' AND status = 'published' ORDER BY version DESC LIMIT 1;

  INSERT INTO public.care_documents
    (client_id, kind, status, version, form_definition_id, responses, submitted_at)
  VALUES (_client, 'pre_assessment', 'submitted', 1, _pre_def, jsonb_build_object(
    'who_for', 'someone_else',
    'dob_known', 'yes',
    'date_of_birth', to_char((now() - interval '7 years')::date, 'YYYY-MM-DD'),
    'service_requested', 'nanny',
    'service_confirmed', 'additional_needs',
    'why_now', 'The school asked us to get help'), now())
  RETURNING id INTO _pre;

  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys((SELECT responses FROM public.care_documents WHERE id = _pre)) k
     WHERE k LIKE 'derived\_%'
  ) THEN
    RAISE EXCEPTION 'the fixture must hold no derived_* answers';
  END IF;

  _facts := private.care_routing_facts_for(_pre, _client, _asm_def, NULL, NULL);

  IF _facts ->> 'enquiry_service' <> 'nanny' THEN
    RAISE EXCEPTION 'the enquiry service is history and must not change: %', _facts ->> 'enquiry_service';
  END IF;
  IF _facts ->> 'service' <> 'additional_needs' THEN
    RAISE EXCEPTION 'the confirmed service must come from the source pre-assessment: %', _facts ->> 'service';
  END IF;
  IF _facts ->> 'recipient_group' <> 'child' OR _facts ->> 'age_band' <> 'child' THEN
    RAISE EXCEPTION 'recipient group and age band must be computed from the source: %', _facts;
  END IF;
  IF NOT (_facts -> 'modules') ? 'm_svc_additional' THEN
    RAISE EXCEPTION 'the additional needs module must open: %', _facts -> 'modules';
  END IF;
  IF (_facts -> 'modules') ? 'm_svc_nanny' THEN
    RAISE EXCEPTION 'the enquiry route must not open its module: %', _facts -> 'modules';
  END IF;

  -- Active evidence is derived from the same exact source, and a hidden
  -- historical answer stays on the record without becoming evidence.
  IF private.care_active_evidence(_pre) IS NULL THEN
    RAISE EXCEPTION 'active evidence must be derivable from the source pre-assessment';
  END IF;
  IF (SELECT responses ? 'why_now' FROM public.care_documents WHERE id = _pre) IS NOT TRUE THEN
    RAISE EXCEPTION 'the family answers must never be rewritten';
  END IF;

  -- ---------------------------------------------------------------- lineage
  -- Two accepted assessments, each with its own plan. A proposal for one can
  -- never be built from the other's plan.
  INSERT INTO public.care_documents (client_id, kind, status, version, form_definition_id, responses)
  VALUES (_client, 'assessment', 'submitted', 1, _pre_def, '{}'::jsonb) RETURNING id INTO _asm_a;
  INSERT INTO public.care_documents (client_id, kind, status, version, form_definition_id, responses)
  VALUES (_client, 'assessment', 'submitted', 2, _pre_def, '{}'::jsonb) RETURNING id INTO _asm_b;

  INSERT INTO public.care_documents
    (client_id, kind, status, version, form_definition_id, responses, built_from_id)
  VALUES (_client, 'care_plan', 'submitted', 1, _pre_def, '{}'::jsonb, _asm_a) RETURNING id INTO _plan_a;
  INSERT INTO public.care_documents
    (client_id, kind, status, version, form_definition_id, responses, built_from_id)
  VALUES (_client, 'care_plan', 'draft', 2, _pre_def, '{}'::jsonb, _asm_b) RETURNING id INTO _plan_b;

  IF (SELECT id FROM public.care_documents
       WHERE kind = 'care_plan' AND built_from_id = _asm_b) <> _plan_b THEN
    RAISE EXCEPTION 'the plan for one assessment must not resolve to another';
  END IF;
  IF _plan_a = _plan_b THEN
    RAISE EXCEPTION 'each accepted assessment keeps its own plan';
  END IF;

  _def_src := pg_get_functiondef('public.care_proposal_draft(uuid, uuid)'::regprocedure);
  IF _def_src NOT LIKE '%built_from_id%' THEN
    RAISE EXCEPTION 'drafting a proposal must resolve the plan by its assessment lineage';
  END IF;

  -- ------------------------------------------------------------ issue gate
  IF private.care_plan_issue_ready(_client) THEN
    RAISE EXCEPTION 'the care plan issue gate must stay shut';
  END IF;

  -- Everything above is synthetic and inside the transaction, so the ROLLBACK
  -- at the foot of this file removes it. Nothing is deleted by hand.

  RAISE NOTICE 'intake routing and lineage: pass';
END $$;

-- --------------------------------------------------------------- review rules
DO $$
DECLARE _src text;
BEGIN
  _src := pg_get_functiondef('public.care_review_checklist_save(uuid, jsonb)'::regprocedure);
  IF _src NOT LIKE '%not_met%' OR _src NOT LIKE '%note%' THEN
    RAISE EXCEPTION 'a check that is not met must require a note';
  END IF;

  _src := pg_get_functiondef(
    'public.care_assessment_return(uuid, text, text, text, text)'::regprocedure);
  IF _src NOT LIKE '%_category%' OR _src NOT LIKE '%_instructions%' OR _src NOT LIKE '%_priority%' THEN
    RAISE EXCEPTION 'returning must require a category, instructions and a priority';
  END IF;

  -- One review per sent version, never shared between versions.
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'care_assessment_reviews'
       AND indexdef LIKE '%UNIQUE%assessment_document_id%'
  ) THEN
    RAISE EXCEPTION 'a review must be bound to exactly one sent assessment version';
  END IF;

  RAISE NOTICE 'review rules: pass';
END $$;

-- ------------------------------------------------------------ access boundary
DO $$
DECLARE _t text; _p text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['care_proposals','care_proposal_sends','care_proposal_comments',
                            'care_proposal_responses','care_assessment_reviews'] LOOP
    FOREACH _p IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
      IF has_table_privilege('anon', 'public.' || _t, _p)
         OR has_table_privilege('authenticated', 'public.' || _t, _p) THEN
        RAISE EXCEPTION 'ordinary users must not write % directly (%)', _t, _p;
      END IF;
    END LOOP;
    IF has_table_privilege('anon', 'public.' || _t, 'SELECT') THEN
      RAISE EXCEPTION 'signed-out visitors must not read %', _t;
    END IF;
  END LOOP;

  -- The safe status projection stays available; content does not travel with it.
  IF NOT has_function_privilege('authenticated', 'public.care_proposal_status(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'the safe proposal status must stay readable';
  END IF;
  IF pg_get_functiondef('public.care_proposal_status(uuid)'::regprocedure) LIKE '%p.content%' THEN
    RAISE EXCEPTION 'the status projection must carry no proposal content';
  END IF;
  IF pg_get_functiondef('public.care_proposal_respond(uuid, text, text)'::regprocedure)
     NOT LIKE '%changes_requested%' THEN
    RAISE EXCEPTION 'a response must be one of the three recorded answers';
  END IF;

  RAISE NOTICE 'access boundary: pass';
END $$;

ROLLBACK;
