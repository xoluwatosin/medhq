-- Tranche 6 hardening: assessment work timing, a canonical language domain,
-- language semantics on the client record, and section-level amendments.

-- 1. When the visit work is due. A day before the appointment, or now when the
-- visit is arranged inside that day.
CREATE OR REPLACE FUNCTION public.care_assessment_due(_appointment timestamptz)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _appointment IS NULL THEN NULL
    WHEN _appointment - interval '24 hours' < now() THEN now()
    ELSE _appointment - interval '24 hours'
  END
$$;

CREATE OR REPLACE FUNCTION private.care_work_apply(_client_id uuid, _event text, _ref uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _appointment timestamptz;
  _due timestamptz;
BEGIN
  IF _event = 'client_created' THEN
    PERFORM private.care_work_add(
      _client_id, 'callback', 'Call the enquirer back', 'client_created',
      'Confirm what is needed and whether to proceed.', 'high', false,
      public.care_working_due(now(), 1), 'care', NULL, _event, NULL, _ref);

  ELSIF _event = 'proceeding' THEN
    PERFORM private.care_work_add(
      _client_id, 'send_pre_assessment', 'Send the pre-assessment link', 'proceeding',
      'The family answers a few questions before the visit.', 'high', false,
      public.care_working_due(now(), 1), 'care', NULL, _event);

  ELSIF _event = 'pre_assessment_sent' THEN
    UPDATE public.care_work_items
       SET status = 'completed', outcome = 'Link sent', completed_at = now()
     WHERE client_id = _client_id AND kind = 'send_pre_assessment' AND status IN ('open','blocked');
    PERFORM private.care_work_add(
      _client_id, 'chase', 'Chase the pre-assessment answers', 'pre_assessment_sent:' || COALESCE(_ref::text, 'link'),
      'The link has gone out and nothing has come back yet.', 'normal', false,
      public.care_working_due(now(), 3), 'care', NULL, _event);

  ELSIF _event = 'pre_assessment_submitted' THEN
    UPDATE public.care_work_items
       SET status = 'completed', outcome = 'Answers returned', completed_at = now()
     WHERE client_id = _client_id AND kind IN ('chase','send_pre_assessment') AND status IN ('open','blocked');
    PERFORM private.care_work_add(
      _client_id, 'book', 'Book the assessment visit', 'pre_assessment_submitted:' || COALESCE(_ref::text, 'doc'),
      'The answers are in and the visit can be arranged.', 'high', false,
      public.care_working_due(now(), 2), 'care', NULL, _event, _ref);

  ELSIF _event = 'assessment_scheduled' THEN
    SELECT appointment_at INTO _appointment FROM public.care_assessment_work WHERE id = _ref;
    _due := public.care_assessment_due(_appointment);

    UPDATE public.care_work_items
       SET status = 'completed', outcome = 'Visit arranged', completed_at = now()
     WHERE client_id = _client_id AND kind = 'book' AND status IN ('open','blocked');

    IF NOT EXISTS (
      SELECT 1 FROM public.care_assessment_work
       WHERE id = _ref AND assessor_person_id IS NOT NULL
    ) THEN
      PERFORM private.care_work_add(
        _client_id, 'assign', 'Assign an assessor', 'assessment_scheduled:' || COALESCE(_ref::text, 'visit'),
        'The visit is arranged and nobody is assigned to carry it out.', 'high', true,
        public.care_working_due(now(), 1), 'care', NULL, _event);
    END IF;

    -- One conduct item per visit. The source key carries the assessment, so
    -- moving the visit moves the same item rather than raising a second one.
    PERFORM private.care_work_add(
      _client_id, 'conduct', 'Carry out the assessment visit', 'assessment_visit:' || COALESCE(_ref::text, 'visit'),
      'The assessor visits and records the assessment.', 'normal', false,
      _due, 'care', NULL, _event);
    UPDATE public.care_work_items
       SET due_at = _due, updated_at = now()
     WHERE client_id = _client_id AND kind = 'conduct' AND status IN ('open','blocked');

  ELSIF _event = 'assessor_assigned' THEN
    UPDATE public.care_work_items
       SET status = 'completed', outcome = 'Assessor assigned', completed_at = now()
     WHERE client_id = _client_id AND kind = 'assign' AND status IN ('open','blocked');

  ELSIF _event = 'assessment_cancelled' THEN
    UPDATE public.care_work_items
       SET status = 'cancelled', cancel_reason = 'The assessment was cancelled', cancelled_at = now()
     WHERE client_id = _client_id AND kind IN ('assign','conduct') AND status IN ('open','blocked');
    PERFORM private.care_work_add(
      _client_id, 'book', 'Book the assessment visit', 'assessment_cancelled:' || COALESCE(_ref::text, 'visit'),
      'The arranged visit was cancelled and needs rearranging.', 'high', false,
      public.care_working_due(now(), 2), 'care', NULL, _event);

  ELSIF _event = 'assessment_submitted' THEN
    UPDATE public.care_work_items
       SET status = 'completed', outcome = 'Assessment sent', completed_at = now()
     WHERE client_id = _client_id AND kind IN ('conduct','assign') AND status IN ('open','blocked');
    PERFORM private.care_work_add(
      _client_id, 'clinical_review', 'Review the assessment', 'assessment_submitted:' || COALESCE(_ref::text, 'assessment'),
      'The assessor has sent the assessment for clinical review.', 'high', false,
      public.care_working_due(now(), 2), 'clinical', NULL, _event);
  END IF;

  PERFORM public.care_refresh_stage(_client_id);
END;
$$;

-- 2. Languages as a reference domain, so a stored language is always a code
-- Care can match on rather than whatever somebody typed.
CREATE TABLE IF NOT EXISTS public.care_languages (
  code text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.care_languages TO anon, authenticated;
GRANT ALL ON public.care_languages TO service_role;
ALTER TABLE public.care_languages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Languages are readable" ON public.care_languages;
CREATE POLICY "Languages are readable" ON public.care_languages FOR SELECT USING (true);

INSERT INTO public.care_languages (code, label, sort_order)
SELECT
  btrim(regexp_replace(lower(l), '[^a-z0-9]+', '_', 'g'), '_'),
  l,
  i::integer
FROM unnest(ARRAY['English','Nigerian Pidgin','Hausa','Yoruba','Igbo','Fulfulde','Kanuri','Ibibio','Efik','Annang','Tiv','Ijaw','Izon','Urhobo','Isoko','Itsekiri','Edo','Esan','Etsako','Nupe','Igala','Idoma','Ebira','Gwari','Berom','Jukun','Bura','Margi','Babur','Mumuye','Tarok','Angas','Bachama','Chamba','Eggon','Ogoni','Khana','Ikwerre','Ekpeye','Ogba','Kalabari','Okrika','Nembe','Epie','Degema','Yala','Bekwarra','Bette','Ejagham','Boki','Mbembe','Igede','Alago','Migili','Gade','Koro','Kambari','Dukawa','Zarma','Bade','Ngizim','Karekare','Bolewa','Ngamo','Tangale','Waja','Kamwe','Higgi','Kilba','Marghi','Yandang','Vere','Longuda','Arabic (Shuwa)','Sign Language (Nigerian)','French','Arabic','Portuguese','Spanish','German','Italian','Dutch','Russian','Ukrainian','Polish','Romanian','Greek','Turkish','Hebrew','Persian','Urdu','Hindi','Punjabi','Bengali','Tamil','Telugu','Malayalam','Gujarati','Marathi','Nepali','Sinhala','Mandarin Chinese','Cantonese','Japanese','Korean','Vietnamese','Thai','Khmer','Malay','Indonesian','Tagalog','Swahili','Amharic','Tigrinya','Somali','Oromo','Zulu','Xhosa','Afrikaans','Shona','Chichewa','Kinyarwanda','Luganda','Wolof','Bambara','Twi','Ga','Ewe','Fante','Mossi','Lingala','Kikongo','Berber (Tamazight)','Swedish','Norwegian','Danish','Finnish','Czech','Slovak','Hungarian','Bulgarian','Serbian','Croatian','Bosnian','Albanian','Lithuanian','Latvian','Estonian','Georgian','Armenian','Azerbaijani','Kazakh','Uzbek','Pashto','British Sign Language']) WITH ORDINALITY AS t(l, i)
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order;

-- 3. Two different facts, named apart. language_codes is what the client
-- speaks. care_language_codes is what a care professional has to speak, which
-- is what the pre-assessment actually asks for.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS care_language_codes text[];

CREATE OR REPLACE FUNCTION public.care_languages_valid(_codes text[])
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT _codes IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM unnest(_codes) AS c(code)
         WHERE NOT EXISTS (
           SELECT 1 FROM public.care_languages l WHERE l.code = c.code AND l.is_active
         )
      )
$$;

CREATE OR REPLACE FUNCTION public.care_clients_controlled_values()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.state_code IS NOT NULL OR NEW.lga_code IS NOT NULL THEN
    PERFORM public.care_geo_check(NEW.state_code, NEW.lga_code);
  END IF;
  IF NEW.sex_code IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.care_sex_terms WHERE code = NEW.sex_code) THEN
    RAISE EXCEPTION 'That is not a sex we hold: %', NEW.sex_code;
  END IF;
  IF NOT public.care_languages_valid(NEW.language_codes) THEN
    RAISE EXCEPTION 'That is not a language we hold';
  END IF;
  IF NOT public.care_languages_valid(NEW.care_language_codes) THEN
    RAISE EXCEPTION 'That is not a language we hold';
  END IF;
  RETURN NEW;
END;
$$;

-- 4. One correction session can cover several answers in a section.
ALTER TABLE public.care_response_amendments ADD COLUMN IF NOT EXISTS session_id uuid;
ALTER TABLE public.care_response_amendments ADD COLUMN IF NOT EXISTS section_id text;

CREATE INDEX IF NOT EXISTS care_response_amendments_session
  ON public.care_response_amendments (session_id);

-- Corrections for one section, recorded together, original answers untouched.
-- _changes is { field_id: corrected_value }. Unchanged fields are skipped.
CREATE OR REPLACE FUNCTION public.care_amend_section(
  _document_id uuid,
  _section_id text,
  _changes jsonb,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _doc public.care_documents%ROWTYPE;
  _session uuid := gen_random_uuid();
  _key text;
  _value jsonb;
  _original jsonb;
  _written integer := 0;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to correct an answer';
  END IF;
  IF COALESCE(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'Give a reason for the correction';
  END IF;

  SELECT * INTO _doc FROM public.care_documents WHERE id = _document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That form is not on the record'; END IF;

  FOR _key, _value IN SELECT * FROM jsonb_each(COALESCE(_changes, '{}'::jsonb)) LOOP
    _original := COALESCE(_doc.responses -> _key, 'null'::jsonb);
    CONTINUE WHEN _original = _value;
    INSERT INTO public.care_response_amendments
      (document_id, client_id, field_id, section_id, session_id,
       original_value, corrected_value, reason, amended_by, amended_by_name)
    VALUES
      (_document_id, _doc.client_id, _key, _section_id, _session,
       _original, _value, btrim(_reason), auth.uid(),
       (SELECT email FROM auth.users WHERE id = auth.uid()));
    _written := _written + 1;
  END LOOP;

  IF _written > 0 THEN
    INSERT INTO public.care_activity (client_id, action, detail, actor_id, actor_name)
    VALUES (_doc.client_id, 'responses_amended',
            jsonb_build_object('section', _section_id, 'fields', _written, 'session', _session),
            auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()));
  END IF;

  RETURN jsonb_build_object('ok', true, 'session_id', _session, 'written', _written);
END;
$$;

REVOKE ALL ON FUNCTION public.care_amend_section(uuid, text, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_amend_section(uuid, text, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_assessment_due(timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_languages_valid(text[]) TO authenticated, service_role;
