CREATE OR REPLACE FUNCTION public.mu_norm_email(_e text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(lower(btrim(coalesce(_e, ''))), '')
$$;

CREATE OR REPLACE FUNCTION public.mu_norm_phone(_p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN d IS NULL OR length(d) < 7 THEN NULL
    WHEN left(d, 4) = '2340' THEN '234' || substr(d, 5)
    WHEN left(d, 3) = '234' THEN d
    WHEN left(d, 1) = '0'   THEN '234' || substr(d, 2)
    ELSE d
  END
  FROM (SELECT NULLIF(regexp_replace(coalesce(_p, ''), '[^0-9]', '', 'g'), '') AS d) s
$$;