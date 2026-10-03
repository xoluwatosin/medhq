CREATE OR REPLACE FUNCTION public.mu_tidy_label(_label text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  parts text[];
  seen text[] := '{}';
  out_parts text[] := '{}';
  seg text;
  s text;
BEGIN
  s := btrim(regexp_replace(coalesce(_label,''), '\s+', ' ', 'g'));
  IF s = '' THEN RETURN s; END IF;

  parts := string_to_array(s, ' — ');
  FOREACH seg IN ARRAY parts LOOP
    seg := btrim(seg);
    CONTINUE WHEN seg = '';
    IF lower(seg) IN ('cv/resume','resume','curriculum vitae','cv') THEN seg := 'CV'; END IF;
    IF NOT (lower(seg) = ANY (seen)) THEN
      seen := seen || lower(seg);
      out_parts := out_parts || seg;
    END IF;
  END LOOP;

  RETURN array_to_string(out_parts, ' — ');
END;
$$;