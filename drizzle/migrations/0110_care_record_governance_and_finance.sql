CREATE TABLE public.care_form_revision_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.care_documents(id) ON DELETE CASCADE,
  token_id uuid REFERENCES public.care_access_tokens(id) ON DELETE SET NULL,
  session_id uuid,
  event text NOT NULL CHECK (event IN ('submitted','reopened','revision_submitted','delivery_retry')),
  revision_number integer NOT NULL DEFAULT 1,
  actor_id uuid,
  actor_name text,
  actor_kind text NOT NULL DEFAULT 'system' CHECK (actor_kind IN ('family','staff','system')),
  reason text,
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  outstanding_required jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.care_form_revision_events TO authenticated;
GRANT ALL ON public.care_form_revision_events TO service_role;
ALTER TABLE public.care_form_revision_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read care form revision events" ON public.care_form_revision_events FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX care_form_revision_events_document_idx ON public.care_form_revision_events(document_id, created_at DESC);
CREATE UNIQUE INDEX care_form_revision_events_submission_once_idx ON public.care_form_revision_events(document_id, event) WHERE event = 'submitted';
CREATE UNIQUE INDEX care_form_revision_events_session_once_idx ON public.care_form_revision_events(document_id, session_id, event) WHERE session_id IS NOT NULL;

CREATE TABLE public.care_plan_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.care_documents(id) ON DELETE CASCADE,
  content_hash text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved','withdrawn')),
  reason text,
  actor_id uuid NOT NULL,
  actor_name text,
  actor_role text NOT NULL CHECK (actor_role IN ('clinical','coordinator','super_admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.care_plan_approvals TO authenticated;
GRANT ALL ON public.care_plan_approvals TO service_role;
ALTER TABLE public.care_plan_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read care plan approvals" ON public.care_plan_approvals FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX care_plan_approvals_document_idx ON public.care_plan_approvals(document_id, created_at DESC);

CREATE TABLE public.care_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  recipient_contact_id uuid NOT NULL REFERENCES public.client_contacts(id) ON DELETE RESTRICT,
  quote_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','accepted','expired','withdrawn','superseded')),
  currency text NOT NULL DEFAULT 'NGN',
  current_version integer NOT NULL DEFAULT 1,
  accepted_version_id uuid,
  accepted_at timestamptz,
  accepted_by uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.care_quotes TO authenticated;
GRANT ALL ON public.care_quotes TO service_role;
ALTER TABLE public.care_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Care coordinators read quotes" ON public.care_quotes FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role) AND private.has_admin_permission(auth.uid(), 'care_coordinator'));
CREATE INDEX care_quotes_client_idx ON public.care_quotes(client_id, created_at DESC);

CREATE TABLE public.care_quote_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.care_quotes(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','accepted','superseded','withdrawn')),
  subtotal numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 7.5,
  vat_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  valid_until date,
  notes text,
  content_hash text NOT NULL,
  issued_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(quote_id, version)
);
GRANT SELECT ON public.care_quote_versions TO authenticated;
GRANT ALL ON public.care_quote_versions TO service_role;
ALTER TABLE public.care_quote_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Care coordinators read quote versions" ON public.care_quote_versions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.care_quotes q WHERE q.id = quote_id AND private.has_role(auth.uid(), 'admin'::app_role) AND private.has_admin_permission(auth.uid(), 'care_coordinator')));

CREATE TABLE public.care_quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_version_id uuid NOT NULL REFERENCES public.care_quote_versions(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.care_quote_lines TO authenticated;
GRANT ALL ON public.care_quote_lines TO service_role;
ALTER TABLE public.care_quote_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Care coordinators read quote lines" ON public.care_quote_lines FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.care_quote_versions v JOIN public.care_quotes q ON q.id=v.quote_id WHERE v.id=quote_version_id AND private.has_role(auth.uid(), 'admin'::app_role) AND private.has_admin_permission(auth.uid(), 'care_coordinator')));
CREATE INDEX care_quote_lines_version_idx ON public.care_quote_lines(quote_version_id, position);

ALTER TABLE public.paystack_invoices ADD COLUMN recipient_contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.paystack_invoices ADD COLUMN quote_version_id uuid REFERENCES public.care_quote_versions(id) ON DELETE SET NULL;
ALTER TABLE public.paystack_invoices ADD COLUMN issued_at timestamptz;
ALTER TABLE public.care_quotes ADD CONSTRAINT care_quotes_accepted_version_fk FOREIGN KEY (accepted_version_id) REFERENCES public.care_quote_versions(id) ON DELETE SET NULL;
CREATE INDEX paystack_invoices_client_created_idx ON public.paystack_invoices(client_id, created_at DESC);

CREATE TABLE public.care_finance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.paystack_invoices(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('credit_note','refund','payment_adjustment')),
  reference text NOT NULL UNIQUE,
  amount numeric NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'recorded' CHECK (status IN ('draft','recorded','completed','cancelled')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT ON public.care_finance_adjustments TO authenticated;
GRANT ALL ON public.care_finance_adjustments TO service_role;
ALTER TABLE public.care_finance_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Care coordinators read finance adjustments" ON public.care_finance_adjustments FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role) AND private.has_admin_permission(auth.uid(), 'care_coordinator'));
CREATE INDEX care_finance_adjustments_invoice_idx ON public.care_finance_adjustments(invoice_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.care_plan_approve(_document_id uuid, _decision text DEFAULT 'approved', _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _doc public.care_documents%ROWTYPE; _role text; _hash text; _row public.care_plan_approvals%ROWTYPE;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Not allowed to approve the care plan'; END IF;
  IF private.has_admin_permission(auth.uid(), 'care_clinical') THEN _role := 'clinical';
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
REVOKE ALL ON FUNCTION public.care_plan_approve(uuid,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.care_plan_approve(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.care_quote_save(_quote_id uuid, _client_id uuid, _recipient_contact_id uuid, _lines jsonb, _vat_rate numeric DEFAULT 7.5, _valid_until date DEFAULT NULL, _notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _quote public.care_quotes%ROWTYPE; _version integer; _version_id uuid; _subtotal numeric; _vat numeric; _total numeric; _content jsonb; _line jsonb; _position integer:=0;
BEGIN
  IF NOT (private.has_role(auth.uid(), 'admin'::app_role) AND private.has_admin_permission(auth.uid(), 'care_coordinator')) THEN RAISE EXCEPTION 'Not allowed to manage quotes'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_contacts WHERE id=_recipient_contact_id AND client_id=_client_id AND email IS NOT NULL) THEN RAISE EXCEPTION 'Select a recorded contact with an email address'; END IF;
  IF jsonb_typeof(COALESCE(_lines,'[]'::jsonb)) <> 'array' OR jsonb_array_length(COALESCE(_lines,'[]'::jsonb))=0 THEN RAISE EXCEPTION 'Add at least one quote line'; END IF;
  IF _vat_rate < 0 OR _vat_rate > 100 THEN RAISE EXCEPTION 'VAT rate is out of range'; END IF;
  SELECT COALESCE(sum((COALESCE(value->>'quantity','0'))::numeric * (COALESCE(value->>'unit_price','0'))::numeric),0) INTO _subtotal FROM jsonb_array_elements(_lines);
  IF _subtotal <= 0 THEN RAISE EXCEPTION 'The quote total must be greater than zero'; END IF;
  _vat := round((_subtotal * _vat_rate / 100)::numeric,2); _total := _subtotal + _vat;
  IF _quote_id IS NULL THEN
    INSERT INTO public.care_quotes(client_id,recipient_contact_id,quote_number,created_by)
    VALUES(_client_id,_recipient_contact_id,'MC-Q-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(gen_random_uuid()::text,1,6)),auth.uid()) RETURNING * INTO _quote;
    _version := 1;
  ELSE
    SELECT * INTO _quote FROM public.care_quotes WHERE id=_quote_id AND client_id=_client_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'That quote is not on this Care record'; END IF;
    IF _quote.status NOT IN ('draft','issued') THEN RAISE EXCEPTION 'That quote cannot be changed'; END IF;
    _version := _quote.current_version + 1;
    UPDATE public.care_quote_versions SET status='superseded' WHERE quote_id=_quote.id AND status IN ('draft','issued');
    UPDATE public.care_quotes SET recipient_contact_id=_recipient_contact_id,current_version=_version,status='draft',updated_at=now() WHERE id=_quote.id;
  END IF;
  _content := jsonb_build_object('lines',_lines,'vat_rate',_vat_rate,'valid_until',_valid_until,'notes',_notes,'subtotal',_subtotal,'vat_amount',_vat,'total',_total);
  INSERT INTO public.care_quote_versions(quote_id,version,subtotal,vat_rate,vat_amount,total,valid_until,notes,content_hash,created_by)
  VALUES(_quote.id,_version,_subtotal,_vat_rate,_vat,_total,_valid_until,NULLIF(btrim(_notes),''),md5(_content::text),auth.uid()) RETURNING id INTO _version_id;
  FOR _line IN SELECT value FROM jsonb_array_elements(_lines) LOOP
    INSERT INTO public.care_quote_lines(quote_version_id,position,description,quantity,unit_price,line_total)
    VALUES(_version_id,_position,btrim(_line->>'description'),(_line->>'quantity')::numeric,(_line->>'unit_price')::numeric,round(((_line->>'quantity')::numeric*(_line->>'unit_price')::numeric),2));
    _position:=_position+1;
  END LOOP;
  INSERT INTO public.care_activity(client_id,action,detail,actor_id,actor_name) VALUES(_client_id,'quote_drafted',jsonb_build_object('quote_id',_quote.id,'version_id',_version_id,'version',_version,'total',_total),auth.uid(),(SELECT email FROM auth.users WHERE id=auth.uid()));
  RETURN jsonb_build_object('ok',true,'quote_id',_quote.id,'version_id',_version_id,'version',_version,'total',_total);
END; $$;
REVOKE ALL ON FUNCTION public.care_quote_save(uuid,uuid,uuid,jsonb,numeric,date,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.care_quote_save(uuid,uuid,uuid,jsonb,numeric,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.care_quote_issue(_quote_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _q public.care_quotes%ROWTYPE; _v public.care_quote_versions%ROWTYPE;
BEGIN
  IF NOT (private.has_role(auth.uid(), 'admin'::app_role) AND private.has_admin_permission(auth.uid(), 'care_coordinator')) THEN RAISE EXCEPTION 'Not allowed to issue quotes'; END IF;
  SELECT * INTO _q FROM public.care_quotes WHERE id=_quote_id FOR UPDATE;
  IF NOT FOUND OR _q.status <> 'draft' THEN RAISE EXCEPTION 'That quote is not ready to issue'; END IF;
  SELECT * INTO _v FROM public.care_quote_versions WHERE quote_id=_q.id AND version=_q.current_version;
  UPDATE public.care_quote_versions SET status='issued',issued_at=now() WHERE id=_v.id;
  UPDATE public.care_quotes SET status='issued',updated_at=now() WHERE id=_q.id;
  INSERT INTO public.care_activity(client_id,action,detail,actor_id,actor_name) VALUES(_q.client_id,'quote_issued',jsonb_build_object('quote_id',_q.id,'version_id',_v.id,'version',_v.version,'recipient_contact_id',_q.recipient_contact_id),auth.uid(),(SELECT email FROM auth.users WHERE id=auth.uid()));
  RETURN jsonb_build_object('ok',true,'quote_id',_q.id,'version_id',_v.id);
END; $$;
REVOKE ALL ON FUNCTION public.care_quote_issue(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.care_quote_issue(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.care_quote_accept(_quote_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _q public.care_quotes%ROWTYPE; _v public.care_quote_versions%ROWTYPE; _c public.client_contacts%ROWTYPE; _invoice_id uuid; _name text;
BEGIN
  IF NOT (private.has_role(auth.uid(), 'admin'::app_role) AND private.has_admin_permission(auth.uid(), 'care_coordinator')) THEN RAISE EXCEPTION 'Not allowed to accept quotes'; END IF;
  SELECT * INTO _q FROM public.care_quotes WHERE id=_quote_id FOR UPDATE;
  IF NOT FOUND OR _q.status <> 'issued' THEN RAISE EXCEPTION 'Only an issued quote can be accepted'; END IF;
  SELECT * INTO _v FROM public.care_quote_versions WHERE quote_id=_q.id AND version=_q.current_version AND status='issued';
  SELECT * INTO _c FROM public.client_contacts WHERE id=_q.recipient_contact_id AND client_id=_q.client_id;
  IF _v.id IS NULL OR _c.id IS NULL OR COALESCE(btrim(_c.email),'')='' THEN RAISE EXCEPTION 'The quote recipient is not available'; END IF;
  _name:=COALESCE(NULLIF(btrim(_c.full_name),''),concat_ws(' ',_c.first_name,_c.last_name));
  INSERT INTO public.paystack_invoices(invoice_number,client_id,recipient_contact_id,quote_version_id,client_name,client_first_name,client_last_name,client_email,client_phone,type,currency,vat_rate,subtotal,vat_amount,total,notes,status,due_date,created_by)
  VALUES('MC-DRAFT-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(gen_random_uuid()::text,1,6)),_q.client_id,_c.id,_v.id,_name,_c.first_name,_c.last_name,_c.email,_c.phone,'standard','NGN',_v.vat_rate,_v.subtotal,_v.vat_amount,_v.total,_v.notes,'draft',COALESCE(_v.valid_until,current_date+14),auth.uid()) RETURNING id INTO _invoice_id;
  INSERT INTO public.paystack_invoice_lines(invoice_id,position,description,quantity,unit_price,line_total) SELECT _invoice_id,position,description,quantity,unit_price,line_total FROM public.care_quote_lines WHERE quote_version_id=_v.id ORDER BY position;
  UPDATE public.care_quote_versions SET status='accepted' WHERE id=_v.id;
  UPDATE public.care_quotes SET status='accepted',accepted_version_id=_v.id,accepted_at=now(),accepted_by=auth.uid(),updated_at=now() WHERE id=_q.id;
  INSERT INTO public.care_activity(client_id,action,detail,actor_id,actor_name) VALUES(_q.client_id,'quote_accepted',jsonb_build_object('quote_id',_q.id,'version_id',_v.id,'invoice_id',_invoice_id,'recipient_contact_id',_c.id),auth.uid(),(SELECT email FROM auth.users WHERE id=auth.uid()));
  RETURN jsonb_build_object('ok',true,'quote_id',_q.id,'invoice_id',_invoice_id);
END; $$;
REVOKE ALL ON FUNCTION public.care_quote_accept(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.care_quote_accept(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.care_finance_adjust(_invoice_id uuid,_kind text,_amount numeric,_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE _invoice public.paystack_invoices%ROWTYPE; _id uuid; _reference text;
BEGIN
  IF NOT (private.has_role(auth.uid(), 'admin'::app_role) AND private.has_admin_permission(auth.uid(), 'care_coordinator')) THEN RAISE EXCEPTION 'Not allowed to record financial adjustments'; END IF;
  IF _kind NOT IN ('credit_note','refund','payment_adjustment') THEN RAISE EXCEPTION 'That is not a financial adjustment'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;
  IF COALESCE(btrim(_reason),'')='' THEN RAISE EXCEPTION 'Give a reason for the adjustment'; END IF;
  SELECT * INTO _invoice FROM public.paystack_invoices WHERE id=_invoice_id;
  IF NOT FOUND OR _invoice.client_id IS NULL THEN RAISE EXCEPTION 'That invoice is not linked to a Care record'; END IF;
  _reference:='MC-'||CASE _kind WHEN 'credit_note' THEN 'CN' WHEN 'refund' THEN 'RF' ELSE 'ADJ' END||'-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(gen_random_uuid()::text,1,6));
  INSERT INTO public.care_finance_adjustments(client_id,invoice_id,kind,reference,amount,reason,status,created_by,completed_at)
  VALUES(_invoice.client_id,_invoice.id,_kind,_reference,_amount,btrim(_reason),CASE WHEN _kind='credit_note' THEN 'recorded' ELSE 'draft' END,auth.uid(),CASE WHEN _kind='credit_note' THEN now() ELSE NULL END) RETURNING id INTO _id;
  INSERT INTO public.care_activity(client_id,action,detail,actor_id,actor_name) VALUES(_invoice.client_id,_kind||'_recorded',jsonb_build_object('adjustment_id',_id,'invoice_id',_invoice.id,'reference',_reference,'amount',_amount,'reason',btrim(_reason)),auth.uid(),(SELECT email FROM auth.users WHERE id=auth.uid()));
  RETURN jsonb_build_object('ok',true,'adjustment_id',_id,'reference',_reference);
END; $$;
REVOKE ALL ON FUNCTION public.care_finance_adjust(uuid,text,numeric,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.care_finance_adjust(uuid,text,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.care_definition_context_issues(_definition jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE _issues jsonb:='[]'::jsonb; _section jsonb; _field jsonb; _path text; _i integer:=0; _j integer; _subjects text[]:=ARRAY['enquirer','care_recipient','household','care_request','service_intention','appointment','finance']; _contexts text[]:=ARRAY['person','household','care_request','assessment','finance']; _cardinalities text[]:=ARRAY['request','household','recipient','recipient_service','repeatable'];
BEGIN
  FOR _section IN SELECT value FROM jsonb_array_elements(COALESCE(_definition->'sections','[]'::jsonb)) LOOP
    _j:=0;
    FOR _field IN SELECT value FROM jsonb_array_elements(COALESCE(_section->'fields','[]'::jsonb)) LOOP
      _path:='sections['||_i||'].fields['||_j||']';
      IF NOT ((_field->>'subject')=ANY(_subjects)) THEN _issues:=_issues||jsonb_build_object('path',_path||'.subject','problem','A question needs a valid answer subject'); END IF;
      IF NOT ((_field->>'displayContext')=ANY(_contexts)) THEN _issues:=_issues||jsonb_build_object('path',_path||'.displayContext','problem','A question needs a valid display context'); END IF;
      IF NOT ((_field->>'cardinality')=ANY(_cardinalities)) THEN _issues:=_issues||jsonb_build_object('path',_path||'.cardinality','problem','A question needs a valid cardinality'); END IF;
      _j:=_j+1;
    END LOOP;
    _i:=_i+1;
  END LOOP;
  RETURN _issues;
END; $$;

CREATE OR REPLACE FUNCTION private.care_definition_context_publish_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE _issues jsonb;
BEGIN
  IF NEW.kind <> 'pre_assessment' OR NEW.status <> 'published' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status='published' AND OLD.definition IS NOT DISTINCT FROM NEW.definition THEN RETURN NEW; END IF;
  _issues:=private.care_definition_context_issues(NEW.definition);
  IF jsonb_array_length(_issues)>0 THEN RAISE EXCEPTION 'This form cannot be published: % (%)',(_issues->0)->>'problem',(_issues->0)->>'path'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER care_definition_context_publish_guard BEFORE INSERT OR UPDATE ON public.form_definitions FOR EACH ROW EXECUTE FUNCTION private.care_definition_context_publish_guard();