CREATE TABLE public.care_answer_context_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_definition_id uuid NOT NULL REFERENCES public.form_definitions(id) ON DELETE CASCADE,
  field_id text NOT NULL,
  subject text NOT NULL CHECK (subject IN ('enquirer','care_recipient','household','care_request','service_intention','appointment','finance')),
  display_context text NOT NULL CHECK (display_context IN ('person','household','care_request','assessment','finance')),
  cardinality text NOT NULL CHECK (cardinality IN ('request','household','recipient','recipient_service','repeatable')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(form_definition_id, field_id)
);
GRANT SELECT ON public.care_answer_context_maps TO authenticated;
GRANT ALL ON public.care_answer_context_maps TO service_role;
ALTER TABLE public.care_answer_context_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read care answer context maps" ON public.care_answer_context_maps
FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX care_answer_context_maps_definition_idx ON public.care_answer_context_maps(form_definition_id, field_id);

CREATE OR REPLACE FUNCTION public.care_plan_is_approved(_document_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','private'
AS $$
DECLARE _responses jsonb; _hash text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN false;
  END IF;
  SELECT responses INTO _responses
  FROM public.care_documents
  WHERE id = _document_id AND kind = 'care_plan';
  IF _responses IS NULL THEN RETURN false; END IF;
  _hash := md5(_responses::text);
  RETURN EXISTS (
    SELECT 1
    FROM public.care_plan_approvals approved
    WHERE approved.document_id = _document_id
      AND approved.content_hash = _hash
      AND approved.decision = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM public.care_plan_approvals later
        WHERE later.document_id = approved.document_id
          AND later.created_at > approved.created_at
          AND later.decision = 'withdrawn'
      )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.care_plan_is_approved(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.care_plan_is_approved(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.care_definition_context_publish_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE _issues jsonb;
BEGIN
  IF NEW.kind <> 'pre_assessment' OR NEW.status <> 'published' OR NEW.version < 10 THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status='published' AND OLD.definition IS NOT DISTINCT FROM NEW.definition THEN RETURN NEW; END IF;
  _issues:=private.care_definition_context_issues(NEW.definition);
  IF jsonb_array_length(_issues)>0 THEN RAISE EXCEPTION 'This form cannot be published: % (%)',(_issues->0)->>'problem',(_issues->0)->>'path'; END IF;
  RETURN NEW;
END; $$;