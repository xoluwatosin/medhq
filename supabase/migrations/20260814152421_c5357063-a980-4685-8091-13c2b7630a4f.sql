DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.mu_people LOOP
    PERFORM public.mu_flag_profile_ambiguity(r.id);
  END LOOP;
END $$;