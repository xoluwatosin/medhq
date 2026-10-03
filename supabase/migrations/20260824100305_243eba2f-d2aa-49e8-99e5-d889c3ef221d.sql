-- Attach a signed-in account to the person record we already hold for that email.
CREATE OR REPLACE FUNCTION public.mu_claim_my_person()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_person uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT id INTO v_person FROM public.mu_people WHERE auth_user_id = v_uid LIMIT 1;
  IF v_person IS NOT NULL THEN
    UPDATE public.mu_people
       SET claimed_at = COALESCE(claimed_at, now())
     WHERE id = v_person;
    RETURN v_person;
  END IF;

  -- Only a confirmed email may claim a record, and only one that has no account yet.
  SELECT lower(trim(email)) INTO v_email
    FROM auth.users
   WHERE id = v_uid AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_person
    FROM public.mu_people
   WHERE email_key = public.mu_norm_email(v_email)
     AND auth_user_id IS NULL
   ORDER BY created_at
   LIMIT 1;

  IF v_person IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.mu_people
     SET auth_user_id = v_uid,
         claimed_at = COALESCE(claimed_at, now()),
         updated_at = now()
   WHERE id = v_person;

  INSERT INTO public.mu_activity (person_id, actor_id, action, detail)
  VALUES (v_person, v_uid, 'account_claimed', jsonb_build_object('email', v_email));

  RETURN v_person;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mu_claim_my_person() TO authenticated;