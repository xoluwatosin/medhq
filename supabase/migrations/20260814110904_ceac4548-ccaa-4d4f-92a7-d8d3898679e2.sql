CREATE OR REPLACE FUNCTION public.mu_next_free_dates(
  _after date,
  _blocks text[] DEFAULT NULL::text[],
  _profession text DEFAULT NULL::text,
  _state text DEFAULT NULL::text,
  _lga text DEFAULT NULL::text,
  _horizon_days integer DEFAULT 180,
  _limit integer DEFAULT 10
)
RETURNS TABLE(
  person_id uuid,
  full_name text,
  profession text,
  state text,
  lga text,
  next_free_date date,
  days_away integer,
  last_availability_update timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  want int[] := public.mu_block_hours(_blocks);
  stop date := _after + COALESCE(_horizon_days, 180);
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH people AS (
    SELECT p.* FROM public.mu_people p
    WHERE (_profession IS NULL OR p.profession = _profession)
      AND (_state IS NULL OR p.state = _state)
      AND (_lga IS NULL OR p.lga = _lga)
  ),
  dates AS (
    SELECT d::date AS slot_date FROM generate_series(_after + 1, stop, interval '1 day') AS d
  ),
  resolved AS (
    SELECT pe.id AS pid,
           dt.slot_date,
           COALESCE(
             (SELECT public.mu_hours_of(ad.blocks) FROM public.mu_availability_days ad
               WHERE ad.person_id = pe.id AND ad.slot_date = dt.slot_date),
             (SELECT public.mu_hours_of(ar.blocks) FROM public.mu_availability_recurrence ar
               WHERE ar.person_id = pe.id AND ar.active
                 AND ar.weekday = (EXTRACT(isodow FROM dt.slot_date)::int - 1))
           ) AS said_hours,
           COALESCE(
             (SELECT array_agg(DISTINCT h)
                FROM public.mu_system_blocks(pe.id, dt.slot_date, dt.slot_date) sb,
                     LATERAL unnest(sb.hours) AS h),
             ARRAY[]::int[]
           ) AS blocked
    FROM people pe CROSS JOIN dates dt
    WHERE EXISTS (
      SELECT 1 FROM public.mu_availability_days a WHERE a.person_id = pe.id AND a.slot_date > _after
    ) OR EXISTS (
      SELECT 1 FROM public.mu_availability_recurrence r WHERE r.person_id = pe.id AND r.active
    )
  ),
  free AS (
    SELECT r.pid, min(r.slot_date) AS next_free
    FROM resolved r
    WHERE EXISTS (
      SELECT 1 FROM unnest(COALESCE(r.said_hours, ARRAY[]::int[])) AS h
      WHERE h = ANY(want) AND NOT (h = ANY(r.blocked))
    )
    GROUP BY r.pid
  )
  SELECT pe.id,
         pe.full_name,
         pe.profession,
         pe.state,
         pe.lga,
         f.next_free,
         (f.next_free - _after)::int,
         pe.last_availability_update
  FROM free f
  JOIN public.mu_people pe ON pe.id = f.pid
  ORDER BY f.next_free, pe.full_name
  LIMIT COALESCE(_limit, 10);
END;
$function$;