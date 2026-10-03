-- One ranking, one derivation, one set of rules. Nothing else decides what is
-- next and nothing else decides what stage a client is in.

CREATE OR REPLACE FUNCTION public.care_work_ranked(_client_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, client_id uuid, kind text, title text, detail text, status text, priority text,
  is_blocker boolean, due_at timestamptz, assignee_user_id uuid, team text, blocked_by uuid,
  created_at timestamptz, rank_order integer, rank_reason text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH horizon AS (SELECT public.care_working_due(now(), 2) AS soon)
  SELECT w.id, w.client_id, w.kind, w.title, w.detail, w.status, w.priority,
         w.is_blocker, w.due_at, w.assignee_user_id, w.team, w.blocked_by, w.created_at,
         (CASE
            WHEN w.is_blocker THEN 1
            WHEN w.priority = 'urgent' THEN 2
            WHEN w.due_at IS NOT NULL AND w.due_at < now() THEN 3
            WHEN w.due_at IS NOT NULL AND w.due_at <= h.soon THEN 4
            ELSE 5
          END + CASE WHEN w.status = 'blocked' THEN 100 ELSE 0 END)::integer AS rank_order,
         CASE WHEN w.status = 'blocked' THEN 'Waiting on other work' ELSE
           CASE
             WHEN w.is_blocker THEN 'Safety or clinical blocker'
             WHEN w.priority = 'urgent' THEN 'Urgent'
             WHEN w.due_at IS NOT NULL AND w.due_at < now() THEN 'Overdue'
             WHEN w.due_at IS NOT NULL AND w.due_at <= h.soon THEN 'Due within two working days'
             ELSE 'Next by due date'
           END
         END AS rank_reason
    FROM public.care_work_items w, horizon h
   WHERE w.status IN ('open','blocked')
     AND (_client_id IS NULL OR w.client_id = _client_id)
   ORDER BY rank_order, w.due_at NULLS LAST, w.created_at
$$;
GRANT EXECUTE ON FUNCTION public.care_work_ranked(uuid) TO authenticated, service_role;

-- The single next action per client, ranked the same way.
CREATE OR REPLACE VIEW public.care_client_next_action
WITH (security_invoker = on) AS
  SELECT DISTINCT ON (r.client_id)
         r.client_id, r.id AS work_id, r.kind, r.title, r.status, r.priority, r.is_blocker,
         r.due_at, r.assignee_user_id, r.team, r.rank_order, r.rank_reason
    FROM public.care_work_ranked(NULL) r
   ORDER BY r.client_id, r.rank_order, r.due_at NULLS LAST, r.created_at;
GRANT SELECT ON public.care_client_next_action TO authenticated;

-- Derived Care stage. clients.stage is only ever a cache of this.
CREATE OR REPLACE FUNCTION public.care_derive_stage(_client_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE _c public.clients%ROWTYPE;
BEGIN
  SELECT * INTO _c FROM public.clients WHERE id = _client_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF _c.closed_at IS NOT NULL THEN RETURN 'closed'; END IF;
  IF _c.paused_at IS NOT NULL THEN RETURN 'paused'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_assignments a
              WHERE a.client_id = _client_id AND a.role IN ('named_caregiver','supervising_nurse')
                AND (a.starts_on IS NULL OR a.starts_on <= current_date)
                AND (a.ends_on IS NULL OR a.ends_on >= current_date))
  THEN RETURN 'care_running'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_documents d
              WHERE d.client_id = _client_id AND d.kind = 'care_plan' AND d.status = 'submitted')
  THEN RETURN 'plan_issued'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_documents d
              WHERE d.client_id = _client_id AND d.kind = 'care_plan' AND d.status = 'draft')
  THEN RETURN 'plan_preparation'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_documents d
              WHERE d.client_id = _client_id AND d.kind = 'assessment' AND d.status = 'submitted')
  THEN RETURN 'clinical_review'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_documents d
              WHERE d.client_id = _client_id AND d.kind = 'assessment' AND d.status = 'draft')
  THEN RETURN 'assessment_in_progress'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_assignments a
              WHERE a.client_id = _client_id AND a.role = 'assessor')
  THEN RETURN 'assessment_booked'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_documents d
              WHERE d.client_id = _client_id AND d.kind = 'pre_assessment' AND d.status = 'submitted')
  THEN RETURN 'pre_assessment_received'; END IF;

  IF EXISTS (SELECT 1 FROM public.care_access_tokens t
              WHERE t.client_id = _client_id AND t.purpose = 'pre_assessment' AND t.revoked_at IS NULL)
  THEN RETURN 'awaiting_pre_assessment'; END IF;

  RETURN 'enquiry';
END;
$$;
GRANT EXECUTE ON FUNCTION public.care_derive_stage(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.care_refresh_stage(_client_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _stage text;
BEGIN
  _stage := public.care_derive_stage(_client_id);
  UPDATE public.clients SET stage = _stage, updated_at = now()
   WHERE id = _client_id AND stage IS DISTINCT FROM _stage;
  RETURN _stage;
END;
$$;
GRANT EXECUTE ON FUNCTION public.care_refresh_stage(uuid) TO authenticated, service_role;

-- Drift repair: the projection is rebuilt from facts for every client.
CREATE OR REPLACE FUNCTION public.care_reconcile_stages()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n integer := 0; _row record;
BEGIN
  FOR _row IN SELECT id, stage FROM public.clients LOOP
    IF public.care_derive_stage(_row.id) IS DISTINCT FROM _row.stage THEN
      PERFORM public.care_refresh_stage(_row.id);
      _n := _n + 1;
    END IF;
  END LOOP;
  RETURN _n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.care_reconcile_stages() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.care_stage_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM public.care_refresh_stage(COALESCE(NEW.client_id, OLD.client_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS care_documents_stage ON public.care_documents;
CREATE TRIGGER care_documents_stage AFTER INSERT OR UPDATE OR DELETE ON public.care_documents
  FOR EACH ROW EXECUTE FUNCTION private.care_stage_touch();

DROP TRIGGER IF EXISTS care_assignments_stage ON public.care_assignments;
CREATE TRIGGER care_assignments_stage AFTER INSERT OR UPDATE OR DELETE ON public.care_assignments
  FOR EACH ROW EXECUTE FUNCTION private.care_stage_touch();

DROP TRIGGER IF EXISTS care_tokens_stage ON public.care_access_tokens;
CREATE TRIGGER care_tokens_stage AFTER INSERT OR UPDATE OR DELETE ON public.care_access_tokens
  FOR EACH ROW EXECUTE FUNCTION private.care_stage_touch();

-- 4. The rules. Every rule is idempotent by source key.
CREATE OR REPLACE FUNCTION public.care_work_event(
  _client_id uuid, _event text, _ref uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role)
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Not allowed to record Care work';
  END IF;

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
  END IF;

  PERFORM public.care_refresh_stage(_client_id);
END;
$$;
REVOKE ALL ON FUNCTION public.care_work_event(uuid, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.care_work_event(uuid, text, uuid) TO authenticated, service_role;

-- A new client always owes somebody a call back.
CREATE OR REPLACE FUNCTION private.care_client_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.care_work_add(
    NEW.id, 'callback', 'Call the enquirer back', 'client_created',
    'Confirm what is needed and whether to proceed.', 'high', false,
    public.care_working_due(now(), 1), 'care', NULL, 'client_created');
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS care_clients_created_work ON public.clients;
CREATE TRIGGER care_clients_created_work AFTER INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION private.care_client_created();

-- A raised flag is work, and an urgent one blocks everything else.
CREATE OR REPLACE FUNCTION private.care_flag_work()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.care_work_add(
    NEW.client_id, 'resolve_escalation',
    CASE WHEN NEW.severity = 'urgent' THEN 'Answer this today' ELSE 'Look at what was flagged' END,
    'flag:' || NEW.id::text,
    NEW.detail,
    CASE WHEN NEW.severity = 'urgent' THEN 'urgent' ELSE 'high' END,
    NEW.severity = 'urgent',
    CASE WHEN NEW.severity = 'urgent' THEN now() ELSE public.care_working_due(now(), 1) END,
    'care', NULL, 'flag_raised', NEW.document_id);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS care_flags_work ON public.care_flags;
CREATE TRIGGER care_flags_work AFTER INSERT ON public.care_flags
  FOR EACH ROW EXECUTE FUNCTION private.care_flag_work();

-- 5. Finishing, stopping, reopening and owning work.
CREATE OR REPLACE FUNCTION public.care_work_complete(_id uuid, _outcome text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _row public.care_work_items%ROWTYPE;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to complete work';
  END IF;
  UPDATE public.care_work_items
     SET status = 'completed', outcome = NULLIF(btrim(COALESCE(_outcome, '')), ''),
         completed_at = now(), completed_by = auth.uid()
   WHERE id = _id AND status IN ('open','blocked')
   RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'That work is already finished'; END IF;

  -- Work waiting on this can now be done.
  UPDATE public.care_work_items SET status = 'open'
   WHERE blocked_by = _id AND status = 'blocked';

  IF _row.kind = 'callback' AND COALESCE(_outcome, '') = 'proceeding' THEN
    PERFORM private.care_work_add(
      _row.client_id, 'send_pre_assessment', 'Send the pre-assessment link', 'proceeding',
      'The family answers a few questions before the visit.', 'high', false,
      public.care_working_due(now(), 1), 'care', NULL, 'callback_completed');
  END IF;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_row.client_id, 'work_completed',
          jsonb_build_object('work_id', _id, 'kind', _row.kind, 'outcome', _outcome), auth.uid());

  PERFORM public.care_refresh_stage(_row.client_id);
END;
$$;
REVOKE ALL ON FUNCTION public.care_work_complete(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_work_complete(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.care_work_cancel(_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _row public.care_work_items%ROWTYPE;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to cancel work';
  END IF;
  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Say why this work is being cancelled';
  END IF;
  UPDATE public.care_work_items
     SET status = 'cancelled', cancel_reason = btrim(_reason),
         cancelled_at = now(), cancelled_by = auth.uid()
   WHERE id = _id AND status IN ('open','blocked')
   RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'That work is already finished'; END IF;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_row.client_id, 'work_cancelled',
          jsonb_build_object('work_id', _id, 'kind', _row.kind, 'reason', _reason), auth.uid());
  PERFORM public.care_refresh_stage(_row.client_id);
END;
$$;
REVOKE ALL ON FUNCTION public.care_work_cancel(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_work_cancel(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.care_work_reopen(_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE _row public.care_work_items%ROWTYPE;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to reopen work';
  END IF;
  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Say why this work is being reopened';
  END IF;
  UPDATE public.care_work_items
     SET status = 'open', reopen_reason = btrim(_reason)
   WHERE id = _id AND status IN ('completed','cancelled')
   RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'That work is already open'; END IF;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_row.client_id, 'work_reopened',
          jsonb_build_object('work_id', _id, 'kind', _row.kind, 'reason', _reason), auth.uid());
  PERFORM public.care_refresh_stage(_row.client_id);
END;
$$;
REVOKE ALL ON FUNCTION public.care_work_reopen(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.care_work_reopen(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.care_work_set(
  _id uuid, _assignee_user_id uuid DEFAULT NULL, _team text DEFAULT NULL, _due_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not allowed to change work';
  END IF;
  UPDATE public.care_work_items
     SET assignee_user_id = COALESCE(_assignee_user_id, assignee_user_id),
         team = COALESCE(NULLIF(btrim(COALESCE(_team, '')), ''), team),
         due_at = COALESCE(_due_at, due_at)
   WHERE id = _id AND status IN ('open','blocked');
END;
$$;
REVOKE ALL ON FUNCTION public.care_work_set(uuid, uuid, text, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.care_work_set(uuid, uuid, text, timestamptz) TO authenticated, service_role;
