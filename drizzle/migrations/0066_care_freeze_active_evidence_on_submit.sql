-- The evidence a pre-assessment carries is worked out once, from the exact
-- definition and the final answers, and frozen as the form is sent.
CREATE OR REPLACE FUNCTION private.care_active_evidence_of(
  _client_id uuid, _definition_id uuid, _responses jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _definition jsonb; _sections jsonb; _out jsonb;
BEGIN
  SELECT definition INTO _definition FROM public.form_definitions WHERE id = _definition_id;
  IF _definition IS NULL THEN RETURN '[]'::jsonb; END IF;

  _sections := private.care_sections_for(
    _definition, private.care_resolve_modules(_client_id, _definition));

  SELECT COALESCE(jsonb_agg(fl ->> 'id'), '[]'::jsonb) INTO _out
    FROM jsonb_array_elements(_sections) s,
         jsonb_array_elements(COALESCE(s -> 'fields', '[]'::jsonb)) fl
   WHERE COALESCE(fl ->> 'carry', 'context') = 'clinical_evidence'
     AND (NOT (fl ? 'showWhen')
          OR private.care_condition_met(fl -> 'showWhen', COALESCE(_responses, '{}'::jsonb)))
     AND private.care_answered(COALESCE(_responses, '{}'::jsonb) -> (fl ->> 'id'));
  RETURN _out;
END;
$function$;

CREATE OR REPLACE FUNCTION private.care_active_evidence(_document uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _d public.care_documents%ROWTYPE;
BEGIN
  SELECT * INTO _d FROM public.care_documents WHERE id = _document;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE(_d.active_evidence,
                  private.care_active_evidence_of(_d.client_id, _d.form_definition_id, _d.responses));
END;
$function$;

CREATE OR REPLACE FUNCTION private.care_freeze_active_evidence()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF NEW.kind = 'pre_assessment' AND NEW.status = 'submitted' AND NEW.active_evidence IS NULL THEN
    NEW.active_evidence := private.care_active_evidence_of(
      NEW.client_id, NEW.form_definition_id, NEW.responses);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS care_freeze_active_evidence ON public.care_documents;
CREATE TRIGGER care_freeze_active_evidence
BEFORE INSERT OR UPDATE ON public.care_documents
FOR EACH ROW EXECUTE FUNCTION private.care_freeze_active_evidence();
