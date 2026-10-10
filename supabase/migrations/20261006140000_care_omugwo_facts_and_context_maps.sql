-- Pre-assessment version 12 reads two more intake facts: the babies on the
-- request by name, and whether a baby's mother is on the same request (so a
-- grandmother or aunt arranging omugwo is not asked who the parent is).
-- The publish guard must know them.
--
-- Every published version also gets its answer context map, copied from its
-- own questions, as versions 9 and 10 have.

DO $$
DECLARE _src text;
BEGIN
  SELECT pg_get_functiondef('private.care_definition_condition_issues(jsonb)'::regprocedure) INTO _src;
  IF position('intake_parent_on_request' IN _src) = 0 THEN
    _src := replace(_src, '''intake_sole_self'',''intake_newborn_dob''',
      '''intake_sole_self'',''intake_newborn_dob'',''intake_newborn_names'',''intake_parent_on_request''');
    IF position('intake_parent_on_request' IN _src) = 0 THEN
      RAISE EXCEPTION 'care_definition_condition_issues is not the version this migration expects';
    END IF;
    EXECUTE _src;
  END IF;
END $$;

INSERT INTO public.care_answer_context_maps (form_definition_id, field_id, subject, display_context, cardinality)
SELECT fd.id, fl ->> 'id', fl ->> 'subject', fl ->> 'displayContext', fl ->> 'cardinality'
  FROM public.form_definitions fd,
       jsonb_array_elements(fd.definition -> 'sections') s,
       jsonb_array_elements(COALESCE(s -> 'fields', '[]'::jsonb)) fl
 WHERE fd.kind = 'pre_assessment' AND fd.version >= 11
   AND NOT EXISTS (SELECT 1 FROM public.care_answer_context_maps m
                    WHERE m.form_definition_id = fd.id AND m.field_id = fl ->> 'id');
