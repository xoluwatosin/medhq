-- Clinical research gets its own line on the enquiry desk.
--
-- The For facilities form asks whether a facility needs clinical staff,
-- support services or clinical research staff. Research enquiries were filed
-- under hospital staffing; they now land on their own line, with their own
-- reply email and their own questions, next to the other facility lines.
--
-- Additive and safe to run twice: nothing existing is changed. Enquiries
-- already filed under hospital staffing stay where they are.

INSERT INTO public.enquiry_service_lines
  (key, name, blurb, segment, route, sort_order, reply_subject, reply_intro, reply_outro)
VALUES
  ('clinical_research', 'Clinical research', 'Research coordinators, research nurses and data staff for trials and studies',
   'facility', '/clinical-research', 95,
   'Your clinical research enquiry, and what happens next',
   'Thank you for your enquiry about clinical research staffing.',
   'A coordinator will call you to confirm the study, the roles and the compliance your site needs, and how our commercial terms are structured.')
ON CONFLICT (key) DO NOTHING;

-- The questions the desk shows for this line, matching the form's options.
INSERT INTO public.enquiry_questions (service_line_id, field_key, label, help, input_type, options, required, sort_order)
SELECT l.id, q.field_key, q.label, q.help, q.input_type, q.options, q.required, q.sort_order
FROM public.enquiry_service_lines l
JOIN (VALUES
  ('facility_name', 'Which site or sponsor is this for?', '', 'text', '[]'::jsonb, true, 110),
  ('roles_needed', 'Which roles do you need?', 'Choose as many as apply.', 'multi',
   '["Research coordinators","Research nurses","Data managers","Lab scientists","Support staff"]'::jsonb, true, 120),
  ('headcount', 'Roughly how many people?', '', 'text', '[]'::jsonb, false, 130)
) AS q(field_key, label, help, input_type, options, required, sort_order) ON true
WHERE l.key = 'clinical_research'
  AND NOT EXISTS (
    SELECT 1 FROM public.enquiry_questions e WHERE e.service_line_id = l.id AND e.field_key = q.field_key
  );
