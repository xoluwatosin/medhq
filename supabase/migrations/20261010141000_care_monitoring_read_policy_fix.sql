-- The monitoring read policies called private.care_ops_ok(), which signed-in
-- users may not execute, so a direct read raised instead of returning nothing.
-- Spell the coordinator check out with functions they may execute; the rule is
-- unchanged: clinical staff or care coordinators read, everyone else sees no rows.
ALTER POLICY "Care staff read monitoring plans" ON public.care_monitoring_plans
  USING (private.care_clinical_ok()
         OR (private.has_role(auth.uid(), 'admin'::app_role)
             AND private.has_admin_permission(auth.uid(), 'care_coordinator')));
ALTER POLICY "Care staff read monitoring items" ON public.care_monitoring_items
  USING (private.care_clinical_ok()
         OR (private.has_role(auth.uid(), 'admin'::app_role)
             AND private.has_admin_permission(auth.uid(), 'care_coordinator')));
