ALTER TABLE public.mu_people
  ADD COLUMN IF NOT EXISTS sex text,
  ADD COLUMN IF NOT EXISTS looking_status text NOT NULL DEFAULT 'unknown';

ALTER TABLE public.mu_work_preferences
  ADD COLUMN IF NOT EXISTS client_sex text NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS religion text,
  ADD COLUMN IF NOT EXISTS client_religion text NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS pets text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS smoking_household text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS deal_breakers text;

-- Everything a candidate has applied to, in one list, with the outcome we hold.
CREATE OR REPLACE FUNCTION public.mu_my_applications()
RETURNS TABLE (
  id uuid,
  kind text,
  title text,
  location text,
  applied_at timestamp with time zone,
  status text,
  can_withdraw boolean,
  shortlist_status text,
  shortlist_at timestamp with time zone
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT public.mu_my_person_id() AS pid)
  SELECT a.id,
         'opportunity'::text,
         COALESCE(o.title, 'Role no longer listed'),
         o.location,
         a.created_at,
         a.status,
         a.status NOT IN ('withdrawn', 'placed', 'rejected'),
         s.status,
         s.updated_at
  FROM public.matchmaker_applications a
  JOIN me ON me.pid IS NOT NULL AND a.person_id = me.pid
  LEFT JOIN public.matchmaker_opportunities o ON o.id = a.opportunity_id
  LEFT JOIN LATERAL (
    SELECT sl.status, sl.updated_at
    FROM public.mu_shortlists sl
    WHERE sl.person_id = a.person_id AND sl.opportunity_id = a.opportunity_id
    ORDER BY sl.updated_at DESC LIMIT 1
  ) s ON true
  UNION ALL
  SELECT j.id,
         'network'::text,
         'Join the network' || COALESCE(' — ' || NULLIF(j.role, ''), ''),
         NULLIF(j.state, ''),
         j.created_at,
         j.status,
         false,
         NULL::text,
         NULL::timestamptz
  FROM public.join_applications j
  JOIN me ON me.pid IS NOT NULL AND j.person_id = me.pid
  ORDER BY 5 DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.mu_my_applications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_my_applications() TO authenticated;

-- A candidate may step back from a role. Nothing else about the application moves.
CREATE OR REPLACE FUNCTION public.mu_withdraw_application(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pid uuid := public.mu_my_person_id();
  app public.matchmaker_applications%ROWTYPE;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'No profile linked to this account'; END IF;
  SELECT * INTO app FROM public.matchmaker_applications WHERE id = _id AND person_id = pid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;

  UPDATE public.matchmaker_applications SET status = 'withdrawn', updated_at = now() WHERE id = _id;
  UPDATE public.mu_shortlists SET status = 'withdrawn', updated_at = now()
   WHERE person_id = pid AND opportunity_id = app.opportunity_id AND status NOT IN ('placed', 'withdrawn');

  INSERT INTO public.mu_activity (person_id, action, detail, actor_name)
  VALUES (pid, 'application_withdrawn', jsonb_build_object('application_id', _id, 'opportunity_id', app.opportunity_id), 'Candidate');

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mu_withdraw_application(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_withdraw_application(uuid) TO authenticated;