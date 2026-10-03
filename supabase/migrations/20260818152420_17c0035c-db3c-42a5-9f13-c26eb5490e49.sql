
CREATE OR REPLACE FUNCTION public.mu_fold_accents(_t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT translate(coalesce(_t,''), 'àáâãäåèéêëìíîïòóôõöùúûüçñÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇÑ',
                                   'aaaaaaeeeeiiiiooooouuuucnAAAAAAEEEEIIIIOOOOOUUUUCN');
$$;

CREATE OR REPLACE FUNCTION public.mu_name_tokens(_name text)
RETURNS text[]
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(array_agg(t ORDER BY t), '{}'::text[])
  FROM (
    SELECT DISTINCT t
    FROM unnest(string_to_array(
      regexp_replace(lower(public.mu_fold_accents(coalesce(_name,''))), '[^a-z ]', ' ', 'g'), ' ')) AS t
    WHERE length(t) > 1
      AND t NOT IN ('mr','mrs','miss','ms','dr','nr','rn','rm','sir','chief','late','nurse')
  ) s;
$$;

CREATE OR REPLACE FUNCTION public.mu_name_agreement(_a text, _b text)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE a text[]; b text[];
BEGIN
  a := public.mu_name_tokens(_a);
  b := public.mu_name_tokens(_b);
  IF array_length(a,1) IS NULL OR array_length(b,1) IS NULL THEN RETURN false; END IF;
  RETURN (a <@ b) OR (b <@ a);
END;
$$;

CREATE OR REPLACE FUNCTION public.mu_document_verdict(_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.mu_documents;
  e public.mu_document_extractions;
  t public.mu_document_types;
  kind text;
  expiry date;
  q jsonb;
  doc_name text;
  held_name text;
BEGIN
  SELECT * INTO d FROM public.mu_documents WHERE id = _document_id;
  IF d.id IS NULL THEN RETURN jsonb_build_object('action','hold','reason','Document not found'); END IF;

  SELECT * INTO e FROM public.mu_document_extractions x
   WHERE x.document_id = _document_id ORDER BY x.created_at DESC LIMIT 1;

  IF e.id IS NULL THEN
    RETURN jsonb_build_object('action','wait','reason','Not read yet');
  END IF;

  IF coalesce(e.error,'') <> '' THEN
    IF e.error ILIKE '%document text%' OR e.error ILIKE '%Unsupported file type%' THEN
      RETURN jsonb_build_object('action','hold','ask',true,
        'reason','We cannot open this file format. Please send a PDF or a clear photo.');
    END IF;
    RETURN jsonb_build_object('action','hold','ask',true,'reason','We could not open or read this copy.');
  END IF;

  q := coalesce(e.extraction->'quality', e.quality, '{}'::jsonb);
  kind := coalesce(e.doc_type, d.doc_kind, 'other');

  IF coalesce(q->>'readable','true') = 'false' THEN
    RETURN jsonb_build_object('action','hold','ask',true,'reason','The copy we hold is not clear enough to read.');
  END IF;

  IF coalesce(q->>'belongs_to_holder','true') = 'false' THEN
    doc_name := coalesce(
      e.extraction->'holder'->'full_name'->>'value',
      e.extraction->'identity'->'full_name'->>'value',
      e.extraction->'credential'->'holder_name'->>'value');
    SELECT full_name INTO held_name FROM public.mu_people WHERE id = d.person_id;
    IF doc_name IS NULL OR NOT public.mu_name_agreement(doc_name, held_name) THEN
      RETURN jsonb_build_object('action','hold','ask',true,
        'reason','The name on this document does not match the name on the profile.');
    END IF;
  END IF;

  IF e.classification_confidence < 0.85 OR kind = 'other' THEN
    RETURN jsonb_build_object('action','hold','ask',false,
      'reason','We cannot tell with confidence what this document is.');
  END IF;

  SELECT * INTO t FROM public.mu_document_types WHERE code = kind;

  expiry := public.mu_loose_date(coalesce(
    e.extraction->'credential'->'expiry_date'->>'value',
    e.extraction->'training'->'expiry_date'->>'value',
    e.extraction->'identity'->'expiry_date'->>'value',
    e.extraction->'check'->'expiry_date'->>'value'
  ));

  IF expiry IS NOT NULL AND expiry < current_date THEN
    RETURN jsonb_build_object('action','hold','ask',true,'kind',kind,
      'reason','This document expired on ' || to_char(expiry,'DD Mon YYYY') || '.');
  END IF;

  IF kind = 'practising_licence' AND expiry IS NULL THEN
    RETURN jsonb_build_object('action','hold','ask',true,'kind',kind,
      'reason','We cannot see an expiry date on this licence.');
  END IF;

  RETURN jsonb_build_object('action','accept','kind',kind,'expires_at',expiry,
                            'evidences', coalesce(to_jsonb(t.evidences), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION private.mu_sweep_document_parses(_limit integer DEFAULT 10)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
  n integer := 0;
BEGIN
  FOR d IN
    SELECT doc.id FROM public.mu_documents doc
     WHERE doc.classified_at IS NULL
       AND doc.rejected = false
       AND coalesce(doc.doc_kind, 'other') <> 'cv'
       AND NOT EXISTS (
         SELECT 1 FROM public.mu_document_extractions x
          WHERE x.document_id = doc.id
            AND (x.error ILIKE '%document text%' OR x.error ILIKE '%Unsupported file type%'))
     ORDER BY doc.created_at
     LIMIT greatest(1, least(_limit, 25))
  LOOP
    PERFORM private.mu_dispatch_document_parse(d.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
