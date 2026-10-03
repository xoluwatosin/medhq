-- Database default privileges hand every new public table to anon and
-- authenticated. These tables are written only through their own functions,
-- so take the direct write and read rights back explicitly.
REVOKE ALL ON public.care_episodes FROM anon, authenticated;
REVOKE ALL ON public.care_service_configurations FROM anon, authenticated;
REVOKE ALL ON public.care_delivery_assignments FROM anon, authenticated;
REVOKE ALL ON public.care_assignments FROM anon, authenticated;

GRANT SELECT ON public.care_episodes TO authenticated;
GRANT SELECT ON public.care_service_configurations TO authenticated;
GRANT SELECT ON public.care_delivery_assignments TO authenticated;
GRANT SELECT ON public.care_assignments TO authenticated;