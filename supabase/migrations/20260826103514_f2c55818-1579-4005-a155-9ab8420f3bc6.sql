CREATE OR REPLACE FUNCTION public.mu_field_shape_problem(_field text, _value text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v text := btrim(coalesce(_value, ''));
  states text[] := ARRAY['abia','adamawa','akwa ibom','anambra','bauchi','bayelsa','benue','borno','cross river','delta','ebonyi','edo','ekiti','enugu','fct','abuja','federal capital territory','gombe','imo','jigawa','kaduna','kano','katsina','kebbi','kogi','kwara','lagos','nasarawa','niger','ogun','ondo','osun','oyo','plateau','rivers','sokoto','taraba','yobe','zamfara'];
  professions text[] := ARRAY[
    'registered nurse','nurse/midwife','midwife','nursing assistant',
    'community health extension worker','medical doctor','pharmacist',
    'pharmacy technician','physiotherapist','medical laboratory scientist',
    'radiographer','paramedic / emergency medical technician','care assistant',
    'home health aide','nutritionist / dietitian','occupational therapist',
    'speech and language therapist','psychologist / counsellor',
    'health records officer','clinical research associate',
    'healthcare administrator','non-clinical / support'
  ];
  bodies text[] := ARRAY['nmcn','mdcn','pcn','mlscn','mrtb','rrbn','chprbn','drcn','nbte','mhpcn','hrorbn','none applicable','other'];
BEGIN
  IF v = '' THEN
    RETURN 'We could not read anything for this.';
  END IF;

  IF _field = 'profession' AND lower(v) = ANY (professions) THEN
    RETURN NULL;
  END IF;
  IF _field = 'licensing_body' AND lower(v) = ANY (bodies) THEN
    RETURN NULL;
  END IF;

  -- LGA names are validated against the location index below. Many official
  -- Nigerian LGA names legitimately contain slashes, so punctuation alone
  -- must never cause a candidate-stated LGA to be erased.
  IF _field IN ('state','profession','licensing_body')
     AND (v ~ ',' OR v ~* '\yand\y' OR v ~ '/' OR v ~ '\|' OR v ~ ';') THEN
    RETURN 'Your CV lists more than one. Tell us the right one.';
  END IF;

  IF _field = 'state' AND lower(regexp_replace(v, '\s+state$', '', 'i')) <> ALL (states) THEN
    RETURN 'We could not match this to a Nigerian state.';
  END IF;

  IF _field = 'years_experience' THEN
    IF v !~ '^[0-9]{1,2}$' THEN
      RETURN 'We need a plain number of years.';
    END IF;
    IF v::int > 60 THEN
      RETURN 'That looks too high. How many years is it?';
    END IF;
  END IF;

  IF _field = 'license_expiry' THEN
    BEGIN
      IF v::date < date '1990-01-01' OR v::date > current_date + interval '20 years' THEN
        RETURN 'That expiry date does not look right.';
      END IF;
    EXCEPTION WHEN others THEN
      RETURN 'We could not read that as a date.';
    END;
  END IF;

  IF _field = 'license_number' AND (length(v) < 3 OR length(v) > 30) THEN
    RETURN 'That licence number does not look complete.';
  END IF;

  RETURN NULL;
END;
$function$;

-- Restore Muminat's repeatedly confirmed official LGA now that it will no
-- longer be erased by the ambiguity trigger.
UPDATE public.mu_people
SET lga = 'Ado-Odo/Ota',
    location_source = 'candidate_stated'
WHERE id = '45f7d4e4-3631-4655-a6a9-26e5ef673193'
  AND state = 'Ogun'
  AND lga IS NULL;