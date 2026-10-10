-- Build step 4: the lists the Schedule screen offers. Reads only, for
-- coordinators and clinical staff; every write still goes through the existing
-- functions (care_episode_create, care_assignment_plan, care_assignment_activate,
-- care_episode_activate), which keep their own checks.
--
--   care_worker_options          people holding the care_worker capability,
--                                with whether the workforce app is open to them;
--   care_schedule_start_options  clients without running care, and services,
--                                for starting care.
-- Additive: two new functions.

CREATE OR REPLACE FUNCTION public.care_worker_options()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NOT private.care_schedule_ok() THEN RETURN NULL; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'person_id', p.id, 'full_name', p.full_name, 'app_access', private.care_worker_ok(p.id))
           ORDER BY p.full_name)
      FROM public.mu_people p
     WHERE EXISTS (SELECT 1 FROM public.mu_capabilities c
                    WHERE c.person_id = p.id AND c.capability = 'care_worker' AND c.revoked_at IS NULL)), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.care_schedule_start_options()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NOT private.care_schedule_ok() THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'clients', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'client_id', c.id,
               'name', COALESCE(NULLIF(c.preferred_name, ''), NULLIF(c.first_name, ''), c.full_name),
               'reference', c.enquiry_number, 'stage', c.stage)
             ORDER BY c.full_name)
        FROM public.clients c
       WHERE c.closed_at IS NULL AND c.archived_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM public.care_episodes e
                          WHERE e.client_id = c.id AND e.status IN ('planned','active','paused'))), '[]'::jsonb),
    'services', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'code', s.slug, 'name', s.name,
               'configured', EXISTS (SELECT 1 FROM public.care_service_configurations sc
                                      WHERE sc.service_code = s.slug AND sc.status = 'published'))
             ORDER BY s.name)
        FROM public.services s), '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.care_worker_options() FROM public, anon;
REVOKE ALL ON FUNCTION public.care_schedule_start_options() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.care_worker_options() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.care_schedule_start_options() TO authenticated, service_role;
