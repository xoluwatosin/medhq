DROP FUNCTION IF EXISTS public.mu_parsed_vs_held(uuid);

CREATE OR REPLACE FUNCTION public.mu_parsed_vs_held(_person_id uuid)
 RETURNS TABLE(id uuid, field text, parsed_value text, held_value text, confidence numeric, evidence text, status text, document_label text, note text, asked_at timestamptz)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  SELECT pf.id,
         pf.field,
         pf.value,
         CASE pf.field
           WHEN 'full_name' THEN p.full_name
           WHEN 'email' THEN p.email
           WHEN 'phone' THEN p.phone
           WHEN 'profession' THEN p.profession
           WHEN 'current_position' THEN p.current_position
           WHEN 'years_experience' THEN p.years_experience::text
           WHEN 'state' THEN p.state
           WHEN 'lga' THEN p.lga
           WHEN 'licensing_body' THEN p.licensing_body
           WHEN 'license_number' THEN p.license_number
           WHEN 'license_expiry' THEN p.license_expiry::text
           ELSE NULL
         END,
         pf.confidence,
         pf.evidence,
         pf.status,
         d.label,
         pf.note,
         pf.updated_at
  FROM public.mu_parsed_fields pf
  LEFT JOIN public.mu_people p ON p.id = pf.person_id
  LEFT JOIN public.mu_documents d ON d.id = pf.document_id
  WHERE pf.person_id = _person_id
  ORDER BY (pf.status = 'pending') DESC, pf.confidence DESC NULLS LAST, pf.field;
END;
$function$;