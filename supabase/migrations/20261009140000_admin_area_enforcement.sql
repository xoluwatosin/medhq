-- Ticked areas are now kept by the database, not only by the screens.
--
-- Every admin rule asked one question, "is this an admin?", so an admin could
-- reach any data underneath whatever areas were ticked for them. Each table
-- below gains one restrictive rule on top of its existing ones: an admin also
-- needs one of the areas that legitimately uses the table, or the row must be
-- about themselves (their own contract, leave, emergency contacts). Families,
-- candidates and the public are not admins, so the rule never applies to them,
-- and the owner account passes everywhere. Dropping these policies restores the
-- previous behaviour exactly.

CREATE OR REPLACE FUNCTION private.admin_area_ok(_areas text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT NOT private.has_role(auth.uid(), 'admin'::app_role)
      OR private.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.admin_permissions ap
         WHERE ap.user_id = auth.uid()
           AND COALESCE(ap.is_active, true)
           AND ap.permissions ?| _areas
      )
$function$;

-- Workforce: contracts, contract templates, emergency contacts and leave.
CREATE POLICY area_workforce ON public.mu_contracts AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['workforce'])) OR person_id = (SELECT public.mu_my_person_id()))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['workforce'])) OR person_id = (SELECT public.mu_my_person_id()));
CREATE POLICY area_workforce ON public.mu_contract_events AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['workforce'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['workforce'])));
CREATE POLICY area_workforce ON public.mu_contract_templates AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['workforce'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['workforce'])));
CREATE POLICY area_workforce ON public.mu_contract_clause_library AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['workforce'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['workforce'])));
CREATE POLICY area_workforce ON public.mu_contract_annex_library AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['workforce'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['workforce'])));
CREATE POLICY area_workforce ON public.mu_staff_emergency_contacts AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['workforce'])) OR person_id = (SELECT public.mu_my_person_id()))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['workforce'])) OR person_id = (SELECT public.mu_my_person_id()));
CREATE POLICY area_workforce ON public.mu_leave_requests AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['workforce', 'match_universe'])) OR person_id = (SELECT public.mu_my_person_id()))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['workforce', 'match_universe'])) OR person_id = (SELECT public.mu_my_person_id()));

-- Finance: invoices and the price catalogue. Care coordinators bill families.
CREATE POLICY area_invoices ON public.paystack_invoices AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['invoices', 'care_coordinator'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['invoices', 'care_coordinator'])));
CREATE POLICY area_invoices ON public.paystack_invoice_lines AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['invoices', 'care_coordinator'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['invoices', 'care_coordinator'])));
CREATE POLICY area_invoices ON public.invoice_services AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['invoices', 'care_coordinator'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['invoices', 'care_coordinator'])));
CREATE POLICY area_invoices ON public.invoice_service_categories AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['invoices', 'care_coordinator'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['invoices', 'care_coordinator'])));
CREATE POLICY area_invoices ON public.orders AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['invoices', 'care_coordinator'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['invoices', 'care_coordinator'])));

-- Content. Only writing is kept to the blog area: the public site reads posts,
-- and an admin browsing it should see the blog like anyone else.
CREATE POLICY area_blog_insert ON public.blog_posts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['blog'])));
CREATE POLICY area_blog_update ON public.blog_posts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['blog'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['blog'])));
CREATE POLICY area_blog_delete ON public.blog_posts AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['blog'])));

-- Communications. Opportunity emails are sent from Talent, to an audience.
CREATE POLICY area_campaigns ON public.campaigns AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['campaigns', 'audience', 'match_universe'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['campaigns', 'audience', 'match_universe'])));
CREATE POLICY area_campaigns ON public.campaign_events AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['campaigns', 'audience', 'match_universe'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['campaigns', 'audience', 'match_universe'])));
CREATE POLICY area_audience ON public.audience_groups AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['audience', 'campaigns', 'match_universe'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['audience', 'campaigns', 'match_universe'])));
CREATE POLICY area_audience ON public.audience_members AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['audience', 'campaigns', 'match_universe'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['audience', 'campaigns', 'match_universe'])));

-- Programmes.
CREATE POLICY area_creator ON public.creator_applications AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['creator_applications'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['creator_applications'])));

-- Talent: applications and opportunities.
CREATE POLICY area_talent ON public.join_applications AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['applications', 'match_universe'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['applications', 'match_universe'])));
CREATE POLICY area_talent ON public.matchmaker_applications AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['match_universe', 'applications', 'matchmakers'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['match_universe', 'applications', 'matchmakers'])));
CREATE POLICY area_talent ON public.matchmaker_email_log AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['match_universe', 'applications', 'matchmakers'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['match_universe', 'applications', 'matchmakers'])));

-- Inbox: enquiries. The care team promotes enquiries into care requests.
CREATE POLICY area_enquiries ON public.contact_submissions AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['enquiries', 'care_coordinator'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['enquiries', 'care_coordinator'])));
CREATE POLICY area_enquiries ON public.enquiry_sends AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT private.admin_area_ok(ARRAY['enquiries', 'care_coordinator'])))
  WITH CHECK ((SELECT private.admin_area_ok(ARRAY['enquiries', 'care_coordinator'])));

-- The staff register function bypasses table rules, so it checks the area itself.
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
   WHERE p.is_staff
     AND private.has_role(auth.uid(), 'admin'::app_role)
     AND private.admin_area_ok(ARRAY['workforce'])
   ORDER BY p.full_name;
$function$;
