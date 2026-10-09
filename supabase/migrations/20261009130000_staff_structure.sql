-- Staff structure: where someone works and who they report to.
--
-- Office staff (the back office: leadership, operations, communications) and
-- field staff (contracted carers and nurses on shifts) share the staff
-- register, but are managed differently, so each staff record says which.
-- "Reports to" existed as a bare id nothing used; it now points at another
-- person and can never point at themselves.

ALTER TABLE public.mu_people ADD COLUMN IF NOT EXISTS work_setting text;
DO $$ BEGIN
  ALTER TABLE public.mu_people ADD CONSTRAINT mu_people_work_setting_check
    CHECK (work_setting IS NULL OR work_setting IN ('office', 'field'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.mu_people ADD CONSTRAINT mu_people_reports_to_fkey
    FOREIGN KEY (reports_to) REFERENCES public.mu_people(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.mu_people ADD CONSTRAINT mu_people_reports_to_not_self
    CHECK (reports_to IS NULL OR reports_to <> id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS mu_people_reports_to_idx ON public.mu_people (reports_to) WHERE reports_to IS NOT NULL;

-- The staff register was callable by any signed-in account, candidates
-- included. It now answers admins only.
CREATE OR REPLACE FUNCTION public.mu_staff_list()
 RETURNS TABLE(id uuid, full_name text, email text, work_email text, phone text, job_title text, department text, employment_type text, staff_status text, staff_start_date date, auth_user_id uuid, contract_status text, contract_id uuid, docs_required integer, docs_accepted integer, docs_missing integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.full_name, p.email, p.work_email, p.phone,
         p.job_title, p.department, p.employment_type, p.staff_status,
         p.staff_start_date, p.auth_user_id,
         c.status, c.id,
         COALESCE(d.req, 0)::int, COALESCE(d.ok, 0)::int, COALESCE(d.req, 0)::int - COALESCE(d.ok, 0)::int
    FROM public.mu_people p
    LEFT JOIN LATERAL (
      SELECT mc.id, mc.status FROM public.mu_contracts mc
       WHERE mc.person_id = p.id
       ORDER BY CASE mc.status WHEN 'active' THEN 0 WHEN 'signed' THEN 1 WHEN 'issued' THEN 2 WHEN 'draft' THEN 3 ELSE 4 END,
                mc.created_at DESC
       LIMIT 1
    ) c ON true
    LEFT JOIN LATERAL (
      SELECT count(*) FILTER (WHERE s.required) AS req,
             count(*) FILTER (WHERE s.required AND s.status = 'accepted') AS ok
        FROM public.mu_document_status(p.id) s
    ) d ON true
   WHERE p.is_staff AND private.has_role(auth.uid(), 'admin'::app_role)
   ORDER BY p.full_name;
$function$;
