-- Returning the pre-assessment is one fact, not eight.
--
-- Before this, a form was frozen and then six further writes were attempted
-- one after another. If any of them failed, the family could never send the
-- form again and nothing would ever pick the pieces up: no follow-up task, no
-- address on the record, no flag for the nurse. The address write was worse
-- than unreliable, it was impossible, because it refused to run against the
-- token that had just been frozen.
--
-- Everything internal now happens in one call that can be safely repeated.
CREATE OR REPLACE FUNCTION public.care_pre_assessment_finalise(
  _token_hash text,
  _document_id uuid,
  _outstanding jsonb DEFAULT '[]'::jsonb,
  _flags jsonb DEFAULT '[]'::jsonb,
  _address_line text DEFAULT NULL::text,
  _state_code text DEFAULT NULL::text,
  _lga_code text DEFAULT NULL::text,
  _language_codes text[] DEFAULT NULL::text[],
  _grant_person_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _token public.care_access_tokens%ROWTYPE;
  _client public.clients%ROWTYPE;
  _doc public.care_documents%ROWTYPE;
  _already boolean := false;
  _state text;
  _lga text;
  _flag jsonb;
  _now timestamptz := now();
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Not allowed to send this form back';
  END IF;

  SELECT * INTO _token FROM public.care_access_tokens WHERE token_hash = _token_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This link is not valid'; END IF;
  IF _token.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'This link has been withdrawn'; END IF;

  SELECT * INTO _doc FROM public.care_documents WHERE id = _document_id FOR UPDATE;
  IF NOT FOUND OR _doc.client_id <> _token.client_id OR _doc.kind <> 'pre_assessment' THEN
    RAISE EXCEPTION 'This link is not valid';
  END IF;
  SELECT * INTO _client FROM public.clients WHERE id = _token.client_id;

  _already := _doc.status = 'submitted';

  -- The address the family gave us, resolved against the reference tables by
  -- the caller and checked again here.
  _state := COALESCE(NULLIF(btrim(COALESCE(_state_code, '')), ''), _client.state_code);
  _lga := COALESCE(NULLIF(btrim(COALESCE(_lga_code, '')), ''), _client.lga_code);
  IF _lga IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.care_lgas WHERE code = _lga AND state_code IS NOT DISTINCT FROM _state
  ) THEN
    _lga := NULL;
  END IF;
  PERFORM public.care_geo_check(_state, _lga);

  UPDATE public.clients
     SET address_line = COALESCE(NULLIF(btrim(COALESCE(_address_line, '')), ''), address_line),
         state_code = _state,
         lga_code = _lga,
         care_language_codes = CASE
           WHEN _language_codes IS NOT NULL AND array_length(_language_codes, 1) > 0
             THEN _language_codes ELSE care_language_codes END,
         updated_at = _now
   WHERE id = _client.id;

  IF NOT EXISTS (
    SELECT 1 FROM public.care_access_log
     WHERE token_id = _token.id AND action = 'address_saved')
  THEN
    INSERT INTO public.care_access_log (token_id, client_id, action)
    VALUES (_token.id, _client.id, 'address_saved');
  END IF;

  IF NOT _already THEN
    UPDATE public.care_documents
       SET status = 'submitted', version = 1, submitted_at = _now,
           outstanding_required = COALESCE(_outstanding, '[]'::jsonb), updated_at = _now
     WHERE id = _document_id;
  END IF;

  UPDATE public.care_access_tokens
     SET frozen_at = COALESCE(frozen_at, _now),
         submitted_at = COALESCE(submitted_at, _now),
         updated_at = _now
   WHERE id = _token.id;

  -- Answers that have to reach somebody. Written once per document.
  IF jsonb_typeof(_flags) = 'array' THEN
    FOR _flag IN SELECT * FROM jsonb_array_elements(_flags) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.care_flags
         WHERE document_id = _document_id
           AND kind = _flag ->> 'kind'
           AND detail IS NOT DISTINCT FROM (_flag ->> 'detail'))
      THEN
        INSERT INTO public.care_flags (client_id, document_id, kind, severity, detail, raised_by)
        VALUES (_client.id, _document_id, _flag ->> 'kind',
                COALESCE(_flag ->> 'severity', 'review'), _flag ->> 'detail', 'system');
      END IF;
    END LOOP;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.care_activity
     WHERE client_id = _client.id AND action = 'pre_assessment_returned'
       AND detail ->> 'document_id' = _document_id::text)
  THEN
    INSERT INTO public.care_activity (client_id, action, detail, actor_name)
    VALUES (_client.id, 'pre_assessment_returned',
            jsonb_build_object('document_id', _document_id,
                               'outstanding', jsonb_array_length(COALESCE(_outstanding, '[]'::jsonb)),
                               'flags', jsonb_array_length(COALESCE(_flags, '[]'::jsonb))),
            'The person answering the form');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.care_access_log
     WHERE token_id = _token.id AND action = 'form_submitted')
  THEN
    INSERT INTO public.care_access_log (token_id, client_id, document_id, action)
    VALUES (_token.id, _client.id, _document_id, 'form_submitted');
  END IF;

  -- The arranging contact follows the journey, and only the journey.
  IF _grant_person_id IS NOT NULL THEN
    PERFORM public.care_journey_grant(_client.id, _grant_person_id,
      'Answered the pre-assessment as the arranging contact', 'pre_assessment_submitted');
  END IF;

  -- The journey moves because work moved. Idempotent on the source key.
  PERFORM private.care_work_apply(_client.id, 'pre_assessment_submitted', _document_id);

  RETURN jsonb_build_object('ok', true, 'already', _already, 'document_id', _document_id);
END;
$function$;