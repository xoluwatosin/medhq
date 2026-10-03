ALTER FUNCTION public.care_client_onboarding_complete(text, text, jsonb, timestamptz)
  SET search_path TO 'public', 'private', 'extensions';