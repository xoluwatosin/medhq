DROP POLICY IF EXISTS "Admins read care form revision events" ON public.care_form_revision_events;
CREATE POLICY "Authorised Care staff read form revision events" ON public.care_form_revision_events
FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  AND (
    private.has_admin_permission(auth.uid(), 'care_coordinator')
    OR private.has_admin_permission(auth.uid(), 'care_clinical')
  )
);

DROP POLICY IF EXISTS "Admins read care plan approvals" ON public.care_plan_approvals;
CREATE POLICY "Authorised Care staff read plan approvals" ON public.care_plan_approvals
FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  AND (
    private.has_admin_permission(auth.uid(), 'care_coordinator')
    OR private.has_admin_permission(auth.uid(), 'care_clinical')
  )
);

DROP POLICY IF EXISTS "Admins read care answer context maps" ON public.care_answer_context_maps;
CREATE POLICY "Authorised Care staff read answer context maps" ON public.care_answer_context_maps
FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  AND (
    private.has_admin_permission(auth.uid(), 'care_coordinator')
    OR private.has_admin_permission(auth.uid(), 'care_clinical')
  )
);

CREATE OR REPLACE FUNCTION public.care_plan_approve(_document_id uuid, _decision text DEFAULT 'approved', _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _doc public.care_documents%ROWTYPE; _role text; _hash text; _row public.care_plan_approvals%ROWTYPE;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Not allowed to approve the care plan'; END IF;
  IF private.is_super_admin(auth.uid()) THEN _role := 'super_admin';
  ELSIF private.has_admin_permission(auth.uid(), 'care_clinical') THEN _role := 'clinical';
  ELSIF private.has_admin_permission(auth.uid(), 'care_coordinator') THEN _role := 'coordinator';
  ELSE RAISE EXCEPTION 'Not allowed to approve the care plan'; END IF;
  IF _decision NOT IN ('approved','withdrawn') THEN RAISE EXCEPTION 'That is not a plan approval decision'; END IF;
  IF _decision = 'withdrawn' AND COALESCE(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'Give a reason for withdrawing approval'; END IF;
  SELECT * INTO _doc FROM public.care_documents WHERE id=_document_id AND kind='care_plan' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That care plan is not on record'; END IF;
  IF _doc.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft care plan can be approved'; END IF;
  _hash := md5(COALESCE(_doc.responses,'{}'::jsonb)::text);
  INSERT INTO public.care_plan_approvals(client_id,document_id,content_hash,decision,reason,actor_id,actor_name,actor_role)
  VALUES(_doc.client_id,_doc.id,_hash,_decision,NULLIF(btrim(_reason),''),auth.uid(),(SELECT email FROM auth.users WHERE id=auth.uid()),_role)
  RETURNING * INTO _row;
  INSERT INTO public.care_activity(client_id,action,detail,actor_id,actor_name)
  VALUES(_doc.client_id,CASE WHEN _decision='approved' THEN 'care_plan_approved' ELSE 'care_plan_approval_withdrawn' END,
    jsonb_build_object('document_id',_doc.id,'approval_id',_row.id,'content_hash',_hash,'role',_role,'reason',NULLIF(btrim(_reason),'')),auth.uid(),_row.actor_name);
  RETURN jsonb_build_object('ok',true,'approval_id',_row.id,'decision',_decision,'content_hash',_hash,'role',_role);
END; $$;
REVOKE ALL ON FUNCTION public.care_plan_approve(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.care_plan_approve(uuid,text,text) TO authenticated;