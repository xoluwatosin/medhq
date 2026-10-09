-- Notifications to people: the bell in the admin header, and an email.
--
-- Each notification is for one signed-in person. They are written only by the
-- database, from triggers on the things people do (leave, reviews, blog and
-- campaign approvals, reporting lines) and from a daily reminder sweep. Nobody
-- is told about their own action. Every few minutes a job emails whatever has
-- not been read in the app yet, one email per person.

CREATE TABLE IF NOT EXISTS public.staff_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  actor_user_id uuid,
  ref_table text,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  emailed_at timestamptz,
  email_skipped boolean NOT NULL DEFAULT false,
  email_error text
);
CREATE INDEX IF NOT EXISTS staff_notifications_user_idx ON public.staff_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS staff_notifications_unsent_idx ON public.staff_notifications (created_at)
  WHERE emailed_at IS NULL AND NOT email_skipped;
ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_notifications FROM anon, authenticated;
GRANT SELECT ON public.staff_notifications TO authenticated;
GRANT ALL ON public.staff_notifications TO service_role;
DO $$ BEGIN
  CREATE POLICY staff_notifications_own ON public.staff_notifications FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Marks the caller's notifications read: the ones given, or all of them.
CREATE OR REPLACE FUNCTION public.staff_notifications_read(_ids uuid[] DEFAULT NULL)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH done AS (
    UPDATE public.staff_notifications SET read_at = now()
     WHERE user_id = auth.uid() AND read_at IS NULL AND (_ids IS NULL OR id = ANY(_ids))
    RETURNING 1)
  SELECT count(*)::int FROM done
$function$;
REVOKE ALL ON FUNCTION public.staff_notifications_read(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_notifications_read(uuid[]) TO authenticated;

/* ---- Helpers ------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION private.notify(_user uuid, _kind text, _title text, _body text, _link text,
  _ref_table text DEFAULT NULL, _ref_id uuid DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF _user IS NULL OR _user IS NOT DISTINCT FROM auth.uid() THEN RETURN; END IF;
  INSERT INTO public.staff_notifications (user_id, kind, title, body, link, actor_user_id, ref_table, ref_id)
  VALUES (_user, _kind, _title, NULLIF(btrim(COALESCE(_body, '')), ''), _link, auth.uid(), _ref_table, _ref_id);
END;
$function$;

CREATE OR REPLACE FUNCTION private.person_user(_person uuid)
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT auth_user_id FROM public.mu_people WHERE id = _person $function$;

CREATE OR REPLACE FUNCTION private.person_name(_person uuid)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT COALESCE(NULLIF(btrim(full_name), ''), 'Someone') FROM public.mu_people WHERE id = _person $function$;

-- The person's manager as a signed-in user; the owner when they have none.
CREATE OR REPLACE FUNCTION private.person_manager_user(_person uuid)
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT m.auth_user_id FROM public.mu_people p JOIN public.mu_people m ON m.id = p.reports_to WHERE p.id = _person),
    'af2fac7f-86db-483f-831e-3cb38454a30c'::uuid)
$function$;

-- The name of whoever is acting, for "Munachim sent a post".
CREATE OR REPLACE FUNCTION private.actor_name()
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT NULLIF(btrim(full_name), '') FROM public.mu_people WHERE auth_user_id = auth.uid() LIMIT 1),
    (SELECT NULLIF(btrim(display_name), '') FROM public.admin_permissions WHERE user_id = auth.uid() LIMIT 1),
    'Someone')
$function$;

CREATE OR REPLACE FUNCTION private.fmt_day(_d date)
 RETURNS text LANGUAGE sql IMMUTABLE
AS $function$ SELECT to_char(_d, 'FMDD Mon YYYY') $function$;

-- "21 to 24 Dec 2026", "30 Dec 2026 to 2 Jan 2027", or one day.
CREATE OR REPLACE FUNCTION private.fmt_range(_from date, _to date)
 RETURNS text LANGUAGE sql IMMUTABLE
AS $function$
  SELECT CASE
    WHEN _from = _to THEN to_char(_from, 'FMDD Mon YYYY')
    WHEN date_trunc('month', _from) = date_trunc('month', _to) THEN to_char(_from, 'FMDD') || ' to ' || to_char(_to, 'FMDD Mon YYYY')
    WHEN date_trunc('year', _from) = date_trunc('year', _to) THEN to_char(_from, 'FMDD Mon') || ' to ' || to_char(_to, 'FMDD Mon YYYY')
    ELSE to_char(_from, 'FMDD Mon YYYY') || ' to ' || to_char(_to, 'FMDD Mon YYYY') END
$function$;

/* ---- Leave --------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION private.notify_on_leave()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _label text := CASE NEW.leave_type
    WHEN 'sick' THEN 'Sick leave' WHEN 'compassionate' THEN 'Compassionate leave'
    WHEN 'maternity' THEN 'Maternity leave' WHEN 'paternity' THEN 'Paternity leave'
    WHEN 'study' THEN 'Study leave' WHEN 'unpaid' THEN 'Unpaid leave' WHEN 'other' THEN 'Leave'
    ELSE 'Annual leave' END;
  _dates text := private.fmt_range(NEW.from_date, NEW.to_date);
  _days text := CASE WHEN NEW.working_days IS NULL THEN ''
    ELSE ', ' || NEW.working_days || ' working day' || CASE WHEN NEW.working_days = 1 THEN '' ELSE 's' END END;
  _name text := private.person_name(NEW.person_id);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mu_people WHERE id = NEW.person_id AND is_staff) THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'requested' THEN
      PERFORM private.notify(private.person_manager_user(NEW.person_id), 'leave_requested',
        _name || ' asked for leave', _label || ', ' || _dates || _days || COALESCE('. "' || NULLIF(btrim(NEW.reason), '') || '"', ''),
        '/admin/me?person=' || NEW.person_id, 'mu_leave_requests', NEW.id);
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('approved', 'declined') THEN
      PERFORM private.notify(private.person_user(NEW.person_id), 'leave_decided',
        CASE NEW.status WHEN 'approved' THEN 'Your leave is approved' ELSE 'Your leave request was declined' END,
        _label || ', ' || _dates || _days || COALESCE('. ' || NULLIF(btrim(NEW.decision_note), ''), ''),
        '/admin/me?tab=leave', 'mu_leave_requests', NEW.id);
    ELSIF NEW.status = 'withdrawn' THEN
      PERFORM private.notify(private.person_manager_user(NEW.person_id), 'leave_withdrawn',
        _name || ' withdrew a leave request', _label || ', ' || _dates || _days,
        '/admin/me?person=' || NEW.person_id, 'mu_leave_requests', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DO $$ BEGIN
  CREATE TRIGGER notify_on_leave AFTER INSERT OR UPDATE OF status ON public.mu_leave_requests
    FOR EACH ROW EXECUTE FUNCTION private.notify_on_leave();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

/* ---- Reviews ------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION private.notify_on_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _label text := CASE NEW.kind WHEN 'probation' THEN 'probation review' WHEN 'one_to_one' THEN 'one to one'
    WHEN 'quarterly' THEN 'quarterly review' ELSE 'annual appraisal' END;
  _reviewer uuid := COALESCE(private.person_user(NEW.reviewer_person_id), private.person_manager_user(NEW.person_id));
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.notify(private.person_user(NEW.person_id), 'review_booked',
      'Your ' || _label || ' is booked',
      CASE WHEN NEW.due_date IS NULL THEN 'Your manager will let you know the date.'
        ELSE 'It is due on ' || private.fmt_day(NEW.due_date) || '.' END,
      '/admin/me?tab=reviews', 'hr_reviews', NEW.id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'shared' THEN
      PERFORM private.notify(private.person_user(NEW.person_id), 'review_shared',
        'Your ' || _label || ' is ready to read', 'Read it, add your comments and confirm.',
        '/admin/me?tab=reviews', 'hr_reviews', NEW.id);
    ELSIF NEW.status = 'acknowledged' THEN
      PERFORM private.notify(_reviewer, 'review_acknowledged',
        private.person_name(NEW.person_id) || ' confirmed their ' || _label,
        COALESCE('Their comments: ' || left(NULLIF(btrim(NEW.employee_comments), ''), 300), 'They added no comments.'),
        '/admin/me?person=' || NEW.person_id, 'hr_reviews', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DO $$ BEGIN
  CREATE TRIGGER notify_on_review AFTER INSERT OR UPDATE OF status ON public.hr_reviews
    FOR EACH ROW EXECUTE FUNCTION private.notify_on_review();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

/* ---- Reporting lines ----------------------------------------------------- */

CREATE OR REPLACE FUNCTION private.notify_on_reports_to()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF NOT NEW.is_staff OR NEW.reports_to IS NOT DISTINCT FROM OLD.reports_to OR NEW.reports_to IS NULL THEN RETURN NEW; END IF;
  PERFORM private.notify(NEW.auth_user_id, 'reports_to_changed',
    'You now report to ' || private.person_name(NEW.reports_to), NULL, '/admin/me', 'mu_people', NEW.id);
  PERFORM private.notify(private.person_user(NEW.reports_to), 'new_report',
    private.person_name(NEW.id) || ' now reports to you',
    'You will see their leave requests and reviews under your team.', '/admin/me?person=' || NEW.id, 'mu_people', NEW.id);
  RETURN NEW;
END;
$function$;

DO $$ BEGIN
  CREATE TRIGGER notify_on_reports_to AFTER UPDATE OF reports_to ON public.mu_people
    FOR EACH ROW EXECUTE FUNCTION private.notify_on_reports_to();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

/* ---- Blog and campaign approvals ----------------------------------------- */

CREATE OR REPLACE FUNCTION private.notify_on_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _blog boolean := TG_TABLE_NAME = 'blog_posts';
  _what text := CASE WHEN _blog THEN 'post' ELSE 'campaign' END;
  _title text := COALESCE(NULLIF(btrim(NEW.title), ''), 'Untitled');
  _link text := CASE WHEN _blog THEN '/admin/posts/' ELSE '/admin/campaigns/' END || NEW.id;
  _author uuid := COALESCE(NEW.created_by, NEW.last_edited_by);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.approval_status IS NOT DISTINCT FROM OLD.approval_status THEN RETURN NEW; END IF;
  END IF;

  IF NEW.approval_status = 'pending' THEN
    PERFORM private.notify('af2fac7f-86db-483f-831e-3cb38454a30c'::uuid, _what || '_pending',
      private.actor_name() || ' sent a ' || _what || ' for approval', _title, '/admin/approvals', TG_TABLE_NAME, NEW.id);
  ELSIF NEW.approval_status = 'approved' THEN
    PERFORM private.notify(_author, _what || '_approved',
      CASE WHEN _blog AND NEW.status = 'scheduled' THEN 'Your post is approved and scheduled'
           WHEN _blog THEN 'Your post is live' ELSE 'Your campaign is approved' END,
      _title, _link, TG_TABLE_NAME, NEW.id);
  ELSIF NEW.approval_status = 'rejected' THEN
    PERFORM private.notify(_author, _what || '_rejected', 'Your ' || _what || ' was sent back',
      _title || COALESCE('. ' || NULLIF(btrim(NEW.approval_note), ''), ''), _link, TG_TABLE_NAME, NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DO $$ BEGIN
  CREATE TRIGGER notify_on_approval AFTER INSERT OR UPDATE OF approval_status ON public.blog_posts
    FOR EACH ROW EXECUTE FUNCTION private.notify_on_approval();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER notify_on_approval AFTER INSERT OR UPDATE OF approval_status ON public.campaigns
    FOR EACH ROW EXECUTE FUNCTION private.notify_on_approval();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

/* ---- Daily reminders ----------------------------------------------------- */

-- Probations ending within two weeks, and reviews due within three days that
-- are not written yet. Each is sent once.
CREATE OR REPLACE FUNCTION private.hr_daily_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN
    SELECT p.id, p.full_name, p.probation_end FROM public.mu_people p
     WHERE p.is_staff AND p.staff_status <> 'exited'
       AND p.probation_end BETWEEN current_date AND current_date + 14
       AND COALESCE(p.probation_status, 'in_probation') IN ('in_probation', 'extended')
       AND NOT EXISTS (SELECT 1 FROM public.staff_notifications s
                        WHERE s.kind = 'probation_ending' AND s.ref_id = p.id AND s.created_at > now() - interval '30 days')
  LOOP
    PERFORM private.notify(private.person_manager_user(r.id), 'probation_ending',
      r.full_name || '''s probation ends on ' || private.fmt_day(r.probation_end),
      CASE WHEN EXISTS (SELECT 1 FROM public.hr_reviews v WHERE v.person_id = r.id AND v.kind = 'probation' AND v.status IN ('scheduled', 'draft'))
        THEN 'Their probation review is booked. Write it and share it before then.'
        ELSE 'Book their probation review.' END,
      '/admin/me?person=' || r.id, 'mu_people', r.id);
    n := n + 1;
  END LOOP;

  FOR r IN
    SELECT v.id, v.person_id, v.reviewer_person_id, v.due_date, v.kind FROM public.hr_reviews v
     WHERE v.status IN ('scheduled', 'draft') AND v.due_date BETWEEN current_date AND current_date + 3
       AND NOT EXISTS (SELECT 1 FROM public.staff_notifications s WHERE s.kind = 'review_due' AND s.ref_id = v.id)
  LOOP
    PERFORM private.notify(COALESCE(private.person_user(r.reviewer_person_id), private.person_manager_user(r.person_id)), 'review_due',
      private.person_name(r.person_id) || '''s ' ||
        CASE r.kind WHEN 'probation' THEN 'probation review' WHEN 'one_to_one' THEN 'one to one'
          WHEN 'quarterly' THEN 'quarterly review' ELSE 'annual appraisal' END
        || ' is due ' || CASE WHEN r.due_date = current_date THEN 'today' ELSE 'on ' || private.fmt_day(r.due_date) END,
      'Write it and share it with them.', '/admin/me?person=' || r.person_id, 'hr_reviews', r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$function$;

/* ---- Email --------------------------------------------------------------- */

-- Hands unread notifications older than two minutes to the email function.
-- The pause lets a burst arrive as one email, and skips anything already
-- seen in the app.
CREATE OR REPLACE FUNCTION private.staff_notifications_dispatch()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE n integer;
BEGIN
  UPDATE public.staff_notifications SET email_skipped = true
   WHERE emailed_at IS NULL AND NOT email_skipped AND read_at IS NOT NULL;
  SELECT count(*) INTO n FROM public.staff_notifications
   WHERE emailed_at IS NULL AND NOT email_skipped AND email_error IS NULL AND created_at < now() - interval '2 minutes';
  IF n = 0 THEN RETURN 0; END IF;
  PERFORM net.http_post(
    url := (SELECT value FROM private.app_config WHERE key = 'functions_url') || '/send-staff-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM private.app_config WHERE key = 'cron_secret')),
    body := '{}'::jsonb);
  RETURN n;
END;
$function$;

-- Schedules (UTC): emails every five minutes, reminders at 07:50 Lagos time.
SELECT cron.schedule('staff-notifications-email', '*/5 * * * *', 'select private.staff_notifications_dispatch();');
SELECT cron.schedule('hr-daily-reminders', '50 6 * * *', 'select private.hr_daily_reminders();');
