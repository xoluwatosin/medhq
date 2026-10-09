-- HR core for staff: leave with manager approval, probation, onboarding and
-- offboarding checklists, and appraisals.
--
-- Who may act on a person's HR follows the structure: their manager (directly
-- or further up the reporting line), an admin with the Workforce area, or the
-- owner. A person sees their own leave, checklist, and the reviews shared with
-- them, and answers those reviews themselves. Nobody approves their own leave
-- or writes their own review, except the owner, who has no one above them.

-- ---------------------------------------------------------------------------
-- Who may act for whom

-- True when _person reports to _manager, directly or through others.
CREATE OR REPLACE FUNCTION private.hr_reports_to(_person uuid, _manager uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  WITH RECURSIVE up AS (
    SELECT p.reports_to AS boss, 1 AS depth FROM public.mu_people p WHERE p.id = _person
    UNION ALL
    SELECT p.reports_to, up.depth + 1 FROM public.mu_people p JOIN up ON p.id = up.boss
     WHERE up.boss IS NOT NULL AND up.depth < 20
  )
  SELECT _manager IS NOT NULL AND EXISTS (SELECT 1 FROM up WHERE boss = _manager)
$function$;

-- True when the signed-in user may manage _person's HR.
CREATE OR REPLACE FUNCTION private.hr_can_manage(_person uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT private.is_super_admin(auth.uid())
      OR (private.has_role(auth.uid(), 'admin'::app_role) AND EXISTS (
            SELECT 1 FROM public.admin_permissions ap
             WHERE ap.user_id = auth.uid() AND COALESCE(ap.is_active, true) AND ap.permissions ? 'workforce'))
      OR private.hr_reports_to(_person, public.mu_my_person_id())
$function$;

-- Working days between two dates, inclusive: no weekends or public holidays.
CREATE OR REPLACE FUNCTION public.hr_working_days(_from date, _to date)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*)::int
    FROM generate_series(_from, _to, interval '1 day') d
   WHERE extract(isodow FROM d) < 6
     AND NOT EXISTS (SELECT 1 FROM public.care_public_holidays h WHERE h.holiday_on = d::date)
$function$;
GRANT EXECUTE ON FUNCTION public.hr_working_days(date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- People: allowance and probation

ALTER TABLE public.mu_people ADD COLUMN IF NOT EXISTS annual_leave_days numeric;
ALTER TABLE public.mu_people ADD COLUMN IF NOT EXISTS probation_end date;
ALTER TABLE public.mu_people ADD COLUMN IF NOT EXISTS probation_status text;
DO $$ BEGIN
  ALTER TABLE public.mu_people ADD CONSTRAINT mu_people_probation_status_check
    CHECK (probation_status IS NULL OR probation_status IN ('in_probation', 'passed', 'extended', 'not_passed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.mu_people ADD CONSTRAINT mu_people_annual_leave_days_check
    CHECK (annual_leave_days IS NULL OR (annual_leave_days >= 0 AND annual_leave_days <= 60));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Leave

ALTER TABLE public.mu_leave_requests ADD COLUMN IF NOT EXISTS leave_type text NOT NULL DEFAULT 'annual';
ALTER TABLE public.mu_leave_requests ADD COLUMN IF NOT EXISTS working_days integer;
DO $$ BEGIN
  ALTER TABLE public.mu_leave_requests ADD CONSTRAINT mu_leave_requests_type_check
    CHECK (leave_type IN ('annual', 'sick', 'compassionate', 'maternity', 'paternity', 'study', 'unpaid', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.hr_leave_request(_from date, _to date, _type text DEFAULT 'annual', _reason text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE me uuid := public.mu_my_person_id(); days int; lid uuid;
BEGIN
  IF me IS NULL OR NOT EXISTS (SELECT 1 FROM public.mu_people WHERE id = me AND is_staff) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only staff can request leave here');
  END IF;
  IF _from IS NULL OR _to IS NULL OR _to < _from THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The last day is before the first day');
  END IF;
  IF _type NOT IN ('annual', 'sick', 'compassionate', 'maternity', 'paternity', 'study', 'unpaid', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Choose a kind of leave');
  END IF;
  days := public.hr_working_days(_from, _to);
  IF days = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Those dates are all weekends or public holidays');
  END IF;
  IF EXISTS (SELECT 1 FROM public.mu_leave_requests l
              WHERE l.person_id = me AND l.status IN ('requested', 'approved')
                AND daterange(l.from_date, l.to_date, '[]') && daterange(_from, _to, '[]')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You already have leave on some of those days');
  END IF;
  INSERT INTO public.mu_leave_requests (person_id, from_date, to_date, reason, leave_type, working_days)
  VALUES (me, _from, _to, NULLIF(btrim(COALESCE(_reason, '')), ''), _type, days) RETURNING id INTO lid;
  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (me, auth.uid(), NULL, 'leave_requested', jsonb_build_object('leave_id', lid, 'from', _from, 'to', _to, 'type', _type, 'days', days));
  RETURN jsonb_build_object('ok', true, 'leave_id', lid, 'working_days', days);
END;
$function$;
REVOKE ALL ON FUNCTION public.hr_leave_request(date, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_leave_request(date, date, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.hr_leave_decide(_id uuid, _action text, _note text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE pid uuid; who text; me uuid := public.mu_my_person_id();
BEGIN
  SELECT person_id INTO pid FROM public.mu_leave_requests WHERE id = _id;
  IF pid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'That request no longer exists'); END IF;

  IF _action = 'withdraw' THEN
    IF pid IS DISTINCT FROM me THEN RETURN jsonb_build_object('ok', false, 'error', 'Only the person who asked can withdraw it'); END IF;
    UPDATE public.mu_leave_requests SET status = 'withdrawn', updated_at = now()
     WHERE id = _id AND (status = 'requested' OR (status = 'approved' AND from_date > current_date));
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'This leave can no longer be withdrawn'); END IF;
    INSERT INTO public.mu_activity (person_id, actor_id, action, detail)
    VALUES (pid, auth.uid(), 'leave_withdrawn', jsonb_build_object('leave_id', _id));
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF _action NOT IN ('approve', 'decline') THEN RETURN jsonb_build_object('ok', false, 'error', 'Unknown action'); END IF;
  IF NOT private.hr_can_manage(pid) THEN RETURN jsonb_build_object('ok', false, 'error', 'Only their manager or Workforce can decide this'); END IF;
  IF pid = me AND NOT private.is_super_admin(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Your own leave is decided by your manager');
  END IF;
  SELECT COALESCE(NULLIF(p.full_name, ''), ap.display_name, ap.email) INTO who
    FROM public.admin_permissions ap LEFT JOIN public.mu_people p ON p.auth_user_id = ap.user_id
   WHERE ap.user_id = auth.uid();
  UPDATE public.mu_leave_requests
     SET status = CASE WHEN _action = 'approve' THEN 'approved' ELSE 'declined' END,
         decision_note = NULLIF(btrim(COALESCE(_note, '')), ''), decided_by = auth.uid(), decided_by_name = who,
         decided_at = now(), updated_at = now()
   WHERE id = _id AND status = 'requested';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'This request has already been decided'); END IF;
  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES (pid, auth.uid(), who, 'leave_' || _action || 'd', jsonb_build_object('leave_id', _id, 'note', _note));
  RETURN jsonb_build_object('ok', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.hr_leave_decide(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_leave_decide(uuid, text, text) TO authenticated;

-- Allowance, taken and booked for a calendar year, for the person, their manager or Workforce.
CREATE OR REPLACE FUNCTION public.hr_leave_balance(_person uuid, _year int DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE y int := COALESCE(_year, extract(year FROM current_date)::int); allowance numeric; taken int; booked int; pending int;
BEGIN
  IF _person IS DISTINCT FROM public.mu_my_person_id() AND NOT private.hr_can_manage(_person) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not available');
  END IF;
  SELECT annual_leave_days INTO allowance FROM public.mu_people WHERE id = _person;
  SELECT COALESCE(sum(public.hr_working_days(GREATEST(from_date, make_date(y, 1, 1)), LEAST(to_date, make_date(y, 12, 31)))) FILTER (WHERE to_date < current_date OR from_date <= current_date), 0)::int,
         COALESCE(sum(public.hr_working_days(GREATEST(from_date, make_date(y, 1, 1)), LEAST(to_date, make_date(y, 12, 31)))) FILTER (WHERE from_date > current_date), 0)::int
    INTO taken, booked
    FROM public.mu_leave_requests
   WHERE person_id = _person AND status = 'approved' AND leave_type = 'annual'
     AND from_date <= make_date(y, 12, 31) AND to_date >= make_date(y, 1, 1);
  SELECT COALESCE(sum(working_days), 0)::int INTO pending
    FROM public.mu_leave_requests
   WHERE person_id = _person AND status = 'requested' AND leave_type = 'annual'
     AND from_date <= make_date(y, 12, 31) AND to_date >= make_date(y, 1, 1);
  RETURN jsonb_build_object('ok', true, 'year', y, 'allowance', allowance, 'taken', taken, 'booked', booked,
    'pending', pending, 'remaining', CASE WHEN allowance IS NULL THEN NULL ELSE allowance - taken - booked END);
END;
$function$;
REVOKE ALL ON FUNCTION public.hr_leave_balance(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_leave_balance(uuid, int) TO authenticated;

-- Leave for a list of people the caller may see: themselves, people below them, or everyone with Workforce.
CREATE OR REPLACE FUNCTION public.hr_leave_list(_person uuid DEFAULT NULL, _only_pending boolean DEFAULT false)
 RETURNS TABLE(id uuid, person_id uuid, full_name text, leave_type text, from_date date, to_date date, working_days integer,
   reason text, status text, decision_note text, decided_by_name text, decided_at timestamptz, created_at timestamptz, can_decide boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT l.id, l.person_id, p.full_name, l.leave_type, l.from_date, l.to_date,
         COALESCE(l.working_days, public.hr_working_days(l.from_date, l.to_date)),
         l.reason, l.status, l.decision_note, l.decided_by_name, l.decided_at, l.created_at,
         l.status = 'requested' AND private.hr_can_manage(l.person_id)
           AND (l.person_id IS DISTINCT FROM public.mu_my_person_id() OR private.is_super_admin(auth.uid()))
    FROM public.mu_leave_requests l
    JOIN public.mu_people p ON p.id = l.person_id
   WHERE p.is_staff
     AND (_person IS NULL OR l.person_id = _person)
     AND (NOT _only_pending OR l.status = 'requested')
     AND (l.person_id = public.mu_my_person_id() OR private.hr_can_manage(l.person_id))
   ORDER BY (l.status = 'requested') DESC, l.from_date DESC
$function$;
REVOKE ALL ON FUNCTION public.hr_leave_list(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_leave_list(uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- Checklists

CREATE TABLE IF NOT EXISTS public.hr_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('onboarding', 'offboarding')),
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  done_at timestamptz,
  done_by uuid,
  done_by_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hr_checklist_items_person_idx ON public.hr_checklist_items (person_id, kind, position);
ALTER TABLE public.hr_checklist_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.hr_checklist_items TO authenticated;
GRANT ALL ON public.hr_checklist_items TO service_role;
DO $$ BEGIN
  CREATE POLICY hr_checklist_read ON public.hr_checklist_items FOR SELECT TO authenticated
    USING (person_id = public.mu_my_person_id() OR private.hr_can_manage(person_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Starts a checklist from the standard list; does nothing if one is already under way.
CREATE OR REPLACE FUNCTION public.hr_checklist_start(_person uuid, _kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE items text[];
BEGIN
  IF NOT private.hr_can_manage(_person) THEN RETURN jsonb_build_object('ok', false, 'error', 'Only their manager or Workforce can do this'); END IF;
  IF EXISTS (SELECT 1 FROM public.hr_checklist_items WHERE person_id = _person AND kind = _kind) THEN
    RETURN jsonb_build_object('ok', true, 'started', false);
  END IF;
  items := CASE _kind
    WHEN 'onboarding' THEN ARRAY[
      'Contract signed', 'ID and right to work checked', 'Bank details received', 'Tax ID received',
      'Emergency contact recorded', 'Work email and accounts set up', 'Admin access given for their role',
      'Induction with their manager', 'Policies read: handbook, safeguarding, data protection',
      'Probation end date set and first review booked']
    WHEN 'offboarding' THEN ARRAY[
      'Resignation or notice recorded', 'Last working day agreed', 'Handover of work and contacts',
      'Admin access withdrawn', 'Work accounts closed or passed on', 'Equipment and documents returned',
      'Final pay and outstanding leave settled', 'Exit conversation held']
    ELSE NULL END;
  IF items IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Unknown checklist'); END IF;
  INSERT INTO public.hr_checklist_items (person_id, kind, title, position)
  SELECT _person, _kind, t, i FROM unnest(items) WITH ORDINALITY AS u(t, i);
  RETURN jsonb_build_object('ok', true, 'started', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.hr_checklist_start(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_checklist_start(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.hr_checklist_tick(_id uuid, _done boolean, _note text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE pid uuid; who text;
BEGIN
  SELECT person_id INTO pid FROM public.hr_checklist_items WHERE id = _id;
  IF pid IS NULL OR NOT private.hr_can_manage(pid) THEN RETURN jsonb_build_object('ok', false, 'error', 'Not available'); END IF;
  SELECT COALESCE(NULLIF(p.full_name, ''), ap.display_name, ap.email) INTO who
    FROM public.admin_permissions ap LEFT JOIN public.mu_people p ON p.auth_user_id = ap.user_id
   WHERE ap.user_id = auth.uid();
  UPDATE public.hr_checklist_items
     SET done_at = CASE WHEN _done THEN now() END,
         done_by = CASE WHEN _done THEN auth.uid() END,
         done_by_name = CASE WHEN _done THEN who END,
         note = COALESCE(NULLIF(btrim(COALESCE(_note, '')), ''), note)
   WHERE id = _id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.hr_checklist_tick(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_checklist_tick(uuid, boolean, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Reviews

CREATE TABLE IF NOT EXISTS public.hr_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  reviewer_person_id uuid REFERENCES public.mu_people(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('probation', 'one_to_one', 'quarterly', 'annual')),
  period_label text,
  due_date date,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'draft', 'shared', 'acknowledged')),
  rating smallint CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  achievements text,
  development text,
  objectives text,
  outcome text CHECK (outcome IS NULL OR outcome IN ('passed', 'extended', 'not_passed')),
  employee_comments text,
  shared_at timestamptz,
  acknowledged_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hr_reviews_person_idx ON public.hr_reviews (person_id, due_date DESC);
ALTER TABLE public.hr_reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_reviews TO authenticated;
GRANT ALL ON public.hr_reviews TO service_role;

-- The person reads a review once it is shared with them; their manager and
-- Workforce read and write it. Nobody writes their own, except the owner.
DO $$ BEGIN
  CREATE POLICY hr_reviews_read ON public.hr_reviews FOR SELECT TO authenticated
    USING (private.hr_can_manage(person_id)
        OR (person_id = public.mu_my_person_id() AND status IN ('shared', 'acknowledged')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY hr_reviews_write ON public.hr_reviews FOR ALL TO authenticated
    USING (private.hr_can_manage(person_id)
       AND (person_id IS DISTINCT FROM public.mu_my_person_id() OR private.is_super_admin(auth.uid()))
       AND status IN ('scheduled', 'draft'))
    WITH CHECK (private.hr_can_manage(person_id)
       AND (person_id IS DISTINCT FROM public.mu_my_person_id() OR private.is_super_admin(auth.uid()))
       AND status IN ('scheduled', 'draft'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Shares a written review with the person. A probation review's outcome is
-- carried onto their record at the same time.
CREATE OR REPLACE FUNCTION public.hr_review_share(_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE r public.hr_reviews%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.hr_reviews WHERE id = _id;
  IF r.id IS NULL OR NOT private.hr_can_manage(r.person_id) THEN RETURN jsonb_build_object('ok', false, 'error', 'Not available'); END IF;
  IF r.status NOT IN ('scheduled', 'draft') THEN RETURN jsonb_build_object('ok', false, 'error', 'Already shared'); END IF;
  IF COALESCE(btrim(r.achievements), '') = '' AND COALESCE(btrim(r.objectives), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Write the review before sharing it');
  END IF;
  IF r.kind = 'probation' AND r.outcome IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Choose the probation outcome first');
  END IF;
  UPDATE public.hr_reviews SET status = 'shared', shared_at = now(), updated_at = now() WHERE id = _id;
  IF r.kind = 'probation' THEN
    UPDATE public.mu_people SET probation_status = r.outcome WHERE id = r.person_id;
  END IF;
  INSERT INTO public.mu_activity (person_id, actor_id, action, detail)
  VALUES (r.person_id, auth.uid(), 'review_shared', jsonb_build_object('review_id', _id, 'kind', r.kind, 'outcome', r.outcome));
  RETURN jsonb_build_object('ok', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.hr_review_share(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_review_share(uuid) TO authenticated;

-- The person adds their comments and confirms they have read it.
CREATE OR REPLACE FUNCTION public.hr_review_acknowledge(_id uuid, _comments text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  UPDATE public.hr_reviews
     SET status = 'acknowledged', acknowledged_at = now(), updated_at = now(),
         employee_comments = NULLIF(btrim(COALESCE(_comments, '')), '')
   WHERE id = _id AND person_id = public.mu_my_person_id() AND status = 'shared';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'This review is not waiting for you'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.hr_review_acknowledge(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_review_acknowledge(uuid, text) TO authenticated;

-- The people below the caller, with what needs their attention.
CREATE OR REPLACE FUNCTION public.hr_my_team()
 RETURNS TABLE(id uuid, full_name text, job_title text, reports_to uuid, direct boolean, staff_start_date date,
   probation_end date, probation_status text, pending_leave integer, next_review date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT p.id, p.full_name, p.job_title, p.reports_to, p.reports_to = public.mu_my_person_id(),
         p.staff_start_date, p.probation_end, p.probation_status,
         (SELECT count(*)::int FROM public.mu_leave_requests l WHERE l.person_id = p.id AND l.status = 'requested'),
         (SELECT min(r.due_date) FROM public.hr_reviews r WHERE r.person_id = p.id AND r.status IN ('scheduled', 'draft'))
    FROM public.mu_people p
   WHERE p.is_staff AND p.staff_status <> 'exited'
     AND public.mu_my_person_id() IS NOT NULL
     AND private.hr_reports_to(p.id, public.mu_my_person_id())
   ORDER BY p.full_name
$function$;
REVOKE ALL ON FUNCTION public.hr_my_team() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_my_team() TO authenticated;
