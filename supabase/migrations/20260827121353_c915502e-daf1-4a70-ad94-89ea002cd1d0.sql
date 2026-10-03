CREATE OR REPLACE FUNCTION public.mu_derive_verification(_person_id uuid, _gaps jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  n_missing int; n_pending int; n_bad int;
BEGIN
  -- The NYSC certificate is asked for, chased and shown as outstanding, but it
  -- never holds verification back. Everything else still does.
  SELECT count(*) FILTER (WHERE s.status = 'missing'),
         count(*) FILTER (WHERE s.status = 'pending'),
         count(*) FILTER (WHERE s.status IN ('rejected', 'expired'))
    INTO n_missing, n_pending, n_bad
    FROM public.mu_document_status(_person_id) s
   WHERE s.required AND s.doc_type <> 'NYSC';

  IF n_bad > 0 THEN RETURN 'failed'; END IF;
  IF n_missing = 0 AND n_pending = 0 AND coalesce(jsonb_array_length(coalesce(_gaps, '[]'::jsonb)), 0) = 0 THEN
    RETURN 'verified';
  END IF;
  IF n_pending > 0 THEN RETURN 'in_review'; END IF;
  RETURN 'unverified';
END;
$function$;