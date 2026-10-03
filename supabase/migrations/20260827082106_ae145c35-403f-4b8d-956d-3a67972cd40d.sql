CREATE OR REPLACE FUNCTION public.mu_claim_my_person()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_name text;
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

  SELECT lower(trim(email)),
         COALESCE(NULLIF(trim(raw_user_meta_data->>'display_name'), ''),
                  NULLIF(trim(raw_user_meta_data->>'full_name'), ''), '')
    INTO v_email, v_name
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

  IF v_person IS NOT NULL THEN
    UPDATE public.mu_people
       SET auth_user_id = v_uid,
           claimed_at = COALESCE(claimed_at, now()),
           updated_at = now()
     WHERE id = v_person;

    INSERT INTO public.mu_activity (person_id, actor_id, action, detail)
    VALUES (v_person, v_uid, 'account_claimed', jsonb_build_object('email', v_email));

    RETURN v_person;
  END IF;

  -- No record on file for this address. Rather than dead-end the sign-up,
  -- open a fresh profile so they always have somewhere to land.
  INSERT INTO public.mu_people (full_name, email, auth_user_id, claimed_at, status)
  VALUES (v_name, v_email, v_uid, now(), 'new')
  RETURNING id INTO v_person;

  INSERT INTO public.mu_activity (person_id, actor_id, action, detail)
  VALUES (v_person, v_uid, 'account_claimed',
          jsonb_build_object('email', v_email, 'via', 'self_signup_new_profile'));

  RETURN v_person;
END;
$function$;