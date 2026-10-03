-- Shape check. Confidence says how sure the model was; this says whether the
-- answer is even the right shape. A confident nonsense is still nonsense.
CREATE OR REPLACE FUNCTION public.mu_field_shape_problem(_field text, _value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v text := btrim(coalesce(_value, ''));
  states text[] := ARRAY['abia','adamawa','akwa ibom','anambra','bauchi','bayelsa','benue','borno','cross river','delta','ebonyi','edo','ekiti','enugu','fct','abuja','federal capital territory','gombe','imo','jigawa','kaduna','kano','katsina','kebbi','kogi','kwara','lagos','nasarawa','niger','ogun','ondo','osun','oyo','plateau','rivers','sokoto','taraba','yobe','zamfara'];
BEGIN
  IF v = '' THEN
    RETURN 'We could not read anything for this.';
  END IF;

  -- Single-value fields must hold one value, not a list.
  IF _field IN ('state','lga','profession','licensing_body')
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
$$;

-- Route anything uncertain or misshapen to the candidate the moment it is written.
CREATE OR REPLACE FUNCTION public.mu_route_uncertain_field()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  problem text;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  problem := public.mu_field_shape_problem(NEW.field, NEW.value);

  IF problem IS NULL AND coalesce(NEW.confidence, 0) < 0.85 THEN
    problem := 'We were not confident we read this correctly. Please confirm it.';
  END IF;

  IF problem IS NOT NULL THEN
    NEW.status := 'queried';
    NEW.note := problem;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mu_parsed_fields_route_uncertain ON public.mu_parsed_fields;
CREATE TRIGGER mu_parsed_fields_route_uncertain
BEFORE INSERT OR UPDATE OF value, confidence, status ON public.mu_parsed_fields
FOR EACH ROW EXECUTE FUNCTION public.mu_route_uncertain_field();

-- Same test applied to everything already waiting.
UPDATE public.mu_parsed_fields pf
   SET status = 'queried',
       note = coalesce(public.mu_field_shape_problem(pf.field, pf.value),
                       'We were not confident we read this correctly. Please confirm it.')
 WHERE pf.status = 'pending'
   AND (public.mu_field_shape_problem(pf.field, pf.value) IS NOT NULL
        OR coalesce(pf.confidence, 0) < 0.85);