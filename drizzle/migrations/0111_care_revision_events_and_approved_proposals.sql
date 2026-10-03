CREATE OR REPLACE FUNCTION private.care_record_pre_assessment_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _token_id uuid; _revision integer;
BEGIN
  IF NEW.kind <> 'pre_assessment' OR NEW.status <> 'submitted' OR (TG_OP='UPDATE' AND OLD.status='submitted') THEN RETURN NEW; END IF;
  SELECT id INTO _token_id FROM public.care_access_tokens WHERE document_id=NEW.id ORDER BY created_at LIMIT 1;
  SELECT COALESCE(max(revision_number),0)+1 INTO _revision FROM public.care_form_revision_events WHERE document_id=NEW.id AND event IN ('submitted','revision_submitted');
  INSERT INTO public.care_form_revision_events(client_id,document_id,token_id,event,revision_number,actor_kind,actor_name,outstanding_required,created_at)
  VALUES(NEW.client_id,NEW.id,_token_id,'submitted',_revision,'family','Family, from their link',COALESCE(NEW.outstanding_required,'[]'::jsonb),COALESCE(NEW.submitted_at,now()))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER care_documents_pre_assessment_submission AFTER INSERT OR UPDATE OF status ON public.care_documents FOR EACH ROW EXECUTE FUNCTION private.care_record_pre_assessment_submission();

CREATE OR REPLACE FUNCTION private.care_record_pre_assessment_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _revision integer; _kind text; _token_id uuid; _change jsonb;
BEGIN
  SELECT id INTO _token_id FROM public.care_access_tokens WHERE document_id=NEW.document_id ORDER BY created_at LIMIT 1;
  _kind:=CASE WHEN NEW.amended_by IS NULL THEN 'family' ELSE 'staff' END;
  SELECT COALESCE(max(revision_number),1)+1 INTO _revision FROM public.care_form_revision_events WHERE document_id=NEW.document_id AND event IN ('submitted','revision_submitted');
  INSERT INTO public.care_form_revision_events(client_id,document_id,token_id,session_id,event,revision_number,actor_id,actor_name,actor_kind,reason,created_at)
  VALUES(NEW.client_id,NEW.document_id,_token_id,NEW.session_id,'reopened',_revision,NEW.amended_by,NEW.amended_by_name,_kind,NEW.reason,NEW.created_at)
  ON CONFLICT DO NOTHING;
  _change:=jsonb_build_object('amendment_id',NEW.id,'field_id',NEW.field_id,'section_id',NEW.section_id,'previous_value',NEW.original_value,'new_value',NEW.corrected_value);
  INSERT INTO public.care_form_revision_events(client_id,document_id,token_id,session_id,event,revision_number,actor_id,actor_name,actor_kind,reason,changed_fields,created_at)
  VALUES(NEW.client_id,NEW.document_id,_token_id,NEW.session_id,'revision_submitted',_revision,NEW.amended_by,NEW.amended_by_name,_kind,NEW.reason,jsonb_build_array(_change),NEW.created_at)
  ON CONFLICT (document_id,session_id,event) WHERE session_id IS NOT NULL
  DO UPDATE SET changed_fields=care_form_revision_events.changed_fields||EXCLUDED.changed_fields;
  RETURN NEW;
END; $$;
CREATE TRIGGER care_response_amendment_revision AFTER INSERT ON public.care_response_amendments FOR EACH ROW EXECUTE FUNCTION private.care_record_pre_assessment_revision();

INSERT INTO public.care_form_revision_events(client_id,document_id,token_id,event,revision_number,actor_kind,actor_name,outstanding_required,created_at)
SELECT d.client_id,d.id,t.id,'submitted',1,'family','Family, from their link',COALESCE(d.outstanding_required,'[]'::jsonb),COALESCE(d.submitted_at,d.updated_at)
FROM public.care_documents d
LEFT JOIN LATERAL (SELECT id FROM public.care_access_tokens x WHERE x.document_id=d.id ORDER BY x.created_at LIMIT 1) t ON true
WHERE d.kind='pre_assessment' AND d.status='submitted'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION private.care_proposal_requires_approved_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _responses jsonb; _hash text;
BEGIN
  SELECT responses INTO _responses FROM public.care_documents WHERE id=NEW.plan_document_id AND kind='care_plan';
  IF _responses IS NULL THEN RAISE EXCEPTION 'The proposal must come from a care plan'; END IF;
  _hash:=md5(_responses::text);
  IF NOT EXISTS (
    SELECT 1 FROM public.care_plan_approvals a
    WHERE a.document_id=NEW.plan_document_id AND a.content_hash=_hash AND a.decision='approved'
      AND NOT EXISTS (SELECT 1 FROM public.care_plan_approvals later WHERE later.document_id=a.document_id AND later.created_at>a.created_at AND later.decision='withdrawn')
  ) THEN RAISE EXCEPTION 'Approve the current working plan before preparing a client proposal'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER care_proposals_approved_plan BEFORE INSERT OR UPDATE OF plan_document_id,content ON public.care_proposals FOR EACH ROW EXECUTE FUNCTION private.care_proposal_requires_approved_plan();