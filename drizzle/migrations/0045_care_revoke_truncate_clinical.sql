-- Signed-in accounts must hold no destructive privilege on clinical records.
REVOKE TRUNCATE ON public.care_documents FROM authenticated;
REVOKE TRUNCATE ON public.care_plan_needs FROM authenticated;
REVOKE TRUNCATE ON public.care_plan_goals FROM authenticated;
REVOKE TRUNCATE ON public.care_plan_tasks FROM authenticated;
REVOKE TRUNCATE ON public.care_documents FROM anon;
REVOKE TRUNCATE ON public.care_plan_needs FROM anon;
REVOKE TRUNCATE ON public.care_plan_goals FROM anon;
REVOKE TRUNCATE ON public.care_plan_tasks FROM anon;