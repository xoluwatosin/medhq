-- A baby not born yet has an expected date of birth in the future. The
-- onboarding step refused any future date, so a family arranging newborn care
-- before the birth could not get past it. A future date is accepted when the
-- recipient is marked expectedBirth and the date is within the next ten months,
-- the same rule the form and care-form-save apply.
DO $$
DECLARE _def text; _new text;
BEGIN
  _def := pg_get_functiondef('public.care_client_onboarding_complete(text,text,jsonb,timestamp with time zone)'::regprocedure);
  _new := replace(_def, E'OR (_recipient ->> ''dateOfBirth'')::date > current_date) THEN',
    E'OR ((_recipient ->> ''dateOfBirth'')::date > current_date\n            AND NOT (_recipient -> ''expectedBirth'' = ''true''::jsonb\n                     AND (_recipient ->> ''dateOfBirth'')::date <= current_date + 305))) THEN');
  IF _new = _def THEN RAISE EXCEPTION 'The date of birth check was not found'; END IF;
  EXECUTE _new;
END $$;
