-- Staff record whether a care needs assessment at home is needed. "Not
-- needed" always carries a reason. Once staff say it is needed, the visit can
-- be booked before the pre-assessment comes back.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS assessment_decision text,
  ADD COLUMN IF NOT EXISTS assessment_reason text;
DO $$ BEGIN
  ALTER TABLE public.clients ADD CONSTRAINT clients_assessment_decision_check
    CHECK (assessment_decision IS NULL OR assessment_decision IN ('needed','not_needed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.care_client_assessment_decide(_client_id uuid, _needed boolean, _reason text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  PERFORM private.care_group_admin_guard();
  IF NOT _needed AND COALESCE(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'Say why an assessment is not needed';
  END IF;
  UPDATE public.clients
     SET assessment_decision = CASE WHEN _needed THEN 'needed' ELSE 'not_needed' END,
         assessment_reason = CASE WHEN _needed THEN NULLIF(btrim(COALESCE(_reason, '')), '') ELSE btrim(_reason) END,
         care_route = CASE WHEN _needed THEN 'standard'
                           WHEN care_route = 'standard' THEN NULL ELSE care_route END,
         route_set_by = auth.uid(), route_set_at = now(), updated_at = now()
   WHERE id = _client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Care record not found'; END IF;
  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_client_id, CASE WHEN _needed THEN 'assessment_needed' ELSE 'assessment_not_needed' END,
          jsonb_build_object('reason', NULLIF(btrim(COALESCE(_reason, '')), '')), auth.uid());
END;
$function$;

REVOKE ALL ON FUNCTION public.care_client_assessment_decide(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.care_client_assessment_decide(uuid, boolean, text) TO authenticated;

UPDATE public.clients SET assessment_decision = 'needed'
 WHERE care_route = 'standard' AND assessment_decision IS NULL;

-- care_assessment_schedule: the form-first check now also passes when the
-- client's assessment_decision is 'needed' (applied to the live database with
-- the full function body on 8 October 2026).
