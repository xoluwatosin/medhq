-- 1. A stage on every application.
ALTER TABLE public.matchmaker_applications
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'applied',
  ADD COLUMN IF NOT EXISTS stage_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS stage_by uuid,
  ADD COLUMN IF NOT EXISTS stage_note text;

UPDATE public.matchmaker_applications a
   SET stage = CASE
     WHEN a.status = 'hired' THEN 'offer_made'
     WHEN a.status = 'rejected' THEN 'not_taken_forward'
     WHEN a.status = 'withdrawn' THEN 'withdrawn'
     WHEN a.status = 'shortlisted' THEN 'shortlisted'
     WHEN EXISTS (SELECT 1 FROM public.mu_shortlists s
                   WHERE s.person_id = a.person_id AND s.opportunity_id = a.opportunity_id) THEN 'shortlisted'
     ELSE 'applied'
   END,
   stage_at = coalesce(a.updated_at, a.created_at);

-- 2. Interview times the office offers and the candidate books.
CREATE TABLE public.mu_interview_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.matchmaker_applications(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  mode text NOT NULL DEFAULT 'video',
  location text,
  status text NOT NULL DEFAULT 'offered',
  booked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mu_interview_slots_application_idx ON public.mu_interview_slots(application_id);
CREATE INDEX mu_interview_slots_person_idx ON public.mu_interview_slots(person_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mu_interview_slots TO authenticated;
GRANT ALL ON public.mu_interview_slots TO service_role;
ALTER TABLE public.mu_interview_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage interview slots" ON public.mu_interview_slots
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Candidates read their own interview slots" ON public.mu_interview_slots
  FOR SELECT TO authenticated
  USING (person_id = public.mu_my_person_id());

CREATE TRIGGER mu_interview_slots_updated_at
  BEFORE UPDATE ON public.mu_interview_slots
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- 3. Moving a stage, recorded once.
CREATE OR REPLACE FUNCTION public.mu_set_application_stage(_application_id uuid, _stage text, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  a public.matchmaker_applications;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF _stage NOT IN ('applied','shortlisted','interview_offered','interview_booked','interview_held','offer_made','not_taken_forward','withdrawn') THEN
    RAISE EXCEPTION 'Unknown stage %', _stage;
  END IF;

  UPDATE public.matchmaker_applications
     SET stage = _stage, stage_at = now(), stage_by = auth.uid(), stage_note = _note,
         status = CASE
           WHEN _stage = 'not_taken_forward' THEN 'rejected'
           WHEN _stage = 'offer_made' THEN 'hired'
           WHEN _stage IN ('shortlisted','interview_offered','interview_booked','interview_held') THEN 'shortlisted'
           WHEN _stage = 'withdrawn' THEN 'withdrawn'
           ELSE 'new'
         END
   WHERE id = _application_id
   RETURNING * INTO a;

  IF a.id IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;

  IF _stage IN ('not_taken_forward','withdrawn') THEN
    UPDATE public.mu_interview_slots SET status = 'withdrawn'
     WHERE application_id = _application_id AND status = 'offered';
  END IF;

  IF a.person_id IS NOT NULL THEN
    INSERT INTO public.mu_activity (person_id, actor_id, action, detail)
    VALUES (a.person_id, auth.uid(), 'application_stage_' || _stage,
            jsonb_build_object('application_id', _application_id, 'note', _note));
  END IF;
END; $function$;

-- 4. Offering times.
CREATE OR REPLACE FUNCTION public.mu_offer_interview_slots(_application_id uuid, _slots jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  a public.matchmaker_applications;
  n int := 0;
  s jsonb;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  SELECT * INTO a FROM public.matchmaker_applications WHERE id = _application_id;
  IF a.id IS NULL OR a.person_id IS NULL THEN RAISE EXCEPTION 'Application not linked to a person'; END IF;

  FOR s IN SELECT * FROM jsonb_array_elements(coalesce(_slots, '[]'::jsonb)) LOOP
    INSERT INTO public.mu_interview_slots (application_id, person_id, starts_at, duration_minutes, mode, location, created_by)
    VALUES (
      _application_id, a.person_id,
      (s->>'starts_at')::timestamptz,
      coalesce((s->>'duration_minutes')::int, 30),
      coalesce(nullif(s->>'mode', ''), 'video'),
      nullif(s->>'location', ''),
      auth.uid()
    );
    n := n + 1;
  END LOOP;

  IF n > 0 THEN
    PERFORM public.mu_set_application_stage(_application_id, 'interview_offered', NULL);
  END IF;
  RETURN n;
END; $function$;

-- 5. The candidate books one of them.
CREATE OR REPLACE FUNCTION public.mu_book_interview_slot(_slot_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  slot public.mu_interview_slots;
BEGIN
  SELECT * INTO slot FROM public.mu_interview_slots WHERE id = _slot_id;
  IF slot.id IS NULL THEN RAISE EXCEPTION 'Interview time not found'; END IF;
  IF NOT (private.has_role(auth.uid(), 'admin'::app_role) OR slot.person_id = public.mu_my_person_id()) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF slot.status <> 'offered' THEN RAISE EXCEPTION 'That time is no longer available'; END IF;

  UPDATE public.mu_interview_slots SET status = 'booked', booked_at = now() WHERE id = _slot_id;
  UPDATE public.mu_interview_slots SET status = 'declined'
   WHERE application_id = slot.application_id AND id <> _slot_id AND status = 'offered';

  UPDATE public.matchmaker_applications
     SET stage = 'interview_booked', stage_at = now()
   WHERE id = slot.application_id;

  INSERT INTO public.mu_activity (person_id, actor_id, action, detail)
  VALUES (slot.person_id, auth.uid(), 'interview_booked',
          jsonb_build_object('application_id', slot.application_id, 'starts_at', slot.starts_at));
END; $function$;

REVOKE EXECUTE ON FUNCTION public.mu_set_application_stage(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mu_offer_interview_slots(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mu_book_interview_slot(uuid) FROM anon;

-- 6. One reader for both sides.
CREATE OR REPLACE FUNCTION public.mu_applications_for_person(_person_id uuid)
RETURNS TABLE(
  id uuid, kind text, title text, location text, applied_at timestamptz,
  stage text, stage_at timestamptz, stage_note text, opportunity_id uuid,
  can_withdraw boolean, slots jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (private.has_role(auth.uid(), 'admin'::app_role) OR _person_id = public.mu_my_person_id()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT a.id, 'opportunity'::text,
         coalesce(o.title, 'Role no longer listed'), o.location, a.created_at,
         a.stage, a.stage_at, a.stage_note, a.opportunity_id,
         a.stage NOT IN ('withdrawn', 'offer_made', 'not_taken_forward'),
         coalesce((
           SELECT jsonb_agg(jsonb_build_object(
                    'id', s.id, 'starts_at', s.starts_at, 'duration_minutes', s.duration_minutes,
                    'mode', s.mode, 'location', s.location, 'status', s.status)
                  ORDER BY s.starts_at)
             FROM public.mu_interview_slots s
            WHERE s.application_id = a.id AND s.status IN ('offered', 'booked')
         ), '[]'::jsonb)
    FROM public.matchmaker_applications a
    LEFT JOIN public.matchmaker_opportunities o ON o.id = a.opportunity_id
   WHERE a.person_id = _person_id
  UNION ALL
  SELECT j.id, 'network'::text,
         'Join the network' || coalesce(' — ' || nullif(j.role, ''), ''),
         nullif(j.state, ''), j.created_at,
         'applied'::text, j.created_at, NULL::text, NULL::uuid,
         false, '[]'::jsonb
    FROM public.join_applications j
   WHERE j.person_id = _person_id
   ORDER BY 5 DESC;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.mu_applications_for_person(uuid) FROM anon;

DROP FUNCTION IF EXISTS public.mu_my_applications();

CREATE OR REPLACE FUNCTION public.mu_my_applications()
RETURNS TABLE(
  id uuid, kind text, title text, location text, applied_at timestamptz,
  stage text, stage_at timestamptz, stage_note text, opportunity_id uuid,
  can_withdraw boolean, slots jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT * FROM public.mu_applications_for_person(public.mu_my_person_id())
$function$;

REVOKE EXECUTE ON FUNCTION public.mu_my_applications() FROM anon;