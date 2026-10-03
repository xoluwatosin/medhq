-- The enquiry desk.
--
-- A person asking about care arrives through several doors and, until now,
-- landed in one flat row with a free-text service name and nothing else. This
-- gives every enquiry a service line, the answers to the questions that line
-- asks, and a record of everything we have sent back, so nobody is emailed the
-- same brochure twice and nobody is left waiting unseen.

/* ------------------------------------------------------------ service lines */

CREATE TABLE IF NOT EXISTS public.enquiry_service_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  blurb text NOT NULL DEFAULT '',
  segment text NOT NULL DEFAULT 'care',
  route text,
  brochure_path text,
  brochure_name text,
  brochure_updated_at timestamptz,
  reply_subject text NOT NULL DEFAULT '',
  reply_intro text NOT NULL DEFAULT '',
  reply_outro text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.enquiry_service_lines TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquiry_service_lines TO authenticated;
GRANT ALL ON public.enquiry_service_lines TO service_role;

ALTER TABLE public.enquiry_service_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active service lines"
  ON public.enquiry_service_lines FOR SELECT
  USING (active);

CREATE POLICY "Admins manage service lines"
  ON public.enquiry_service_lines FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

/* --------------------------------------------------------------- questions */

CREATE TABLE IF NOT EXISTS public.enquiry_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_line_id uuid REFERENCES public.enquiry_service_lines(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  help text NOT NULL DEFAULT '',
  input_type text NOT NULL DEFAULT 'choice',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enquiry_questions_line_idx
  ON public.enquiry_questions(service_line_id, sort_order);

GRANT SELECT ON public.enquiry_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquiry_questions TO authenticated;
GRANT ALL ON public.enquiry_questions TO service_role;

ALTER TABLE public.enquiry_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active questions"
  ON public.enquiry_questions FOR SELECT
  USING (active);

CREATE POLICY "Admins manage questions"
  ON public.enquiry_questions FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

/* ------------------------------------------------------- the enquiry itself */

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS service_line text,
  ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'contact_form',
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS owner text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS consent_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz;

CREATE INDEX IF NOT EXISTS contact_submissions_line_idx
  ON public.contact_submissions(service_line, created_at DESC);
CREATE INDEX IF NOT EXISTS contact_submissions_stage_idx
  ON public.contact_submissions(stage, created_at DESC);
CREATE INDEX IF NOT EXISTS contact_submissions_email_idx
  ON public.contact_submissions(lower(email));

/* ------------------------------------------------------------ what we sent */

CREATE TABLE IF NOT EXISTS public.enquiry_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid,
  email text NOT NULL,
  service_line text,
  kind text NOT NULL DEFAULT 'auto_reply',
  subject text NOT NULL DEFAULT '',
  brochure_name text,
  status text NOT NULL DEFAULT 'sent',
  provider_id text,
  error text,
  actor text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enquiry_sends_email_idx ON public.enquiry_sends(lower(email), sent_at DESC);
CREATE INDEX IF NOT EXISTS enquiry_sends_enquiry_idx ON public.enquiry_sends(enquiry_id, sent_at DESC);

GRANT SELECT ON public.enquiry_sends TO authenticated;
GRANT ALL ON public.enquiry_sends TO service_role;

ALTER TABLE public.enquiry_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read enquiry sends"
  ON public.enquiry_sends FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

/* --------------------------------------------------------------- the lines */

INSERT INTO public.enquiry_service_lines (key, name, segment, route, sort_order, reply_subject, reply_intro, reply_outro)
VALUES
  ('eldercare', 'Eldercare', 'care', '/eldercare', 10,
   'Your eldercare enquiry, and what happens next',
   'Thank you for telling us about the care your loved one needs. Everything we arrange begins with understanding the person, not the diagnosis.',
   'The brochure attached takes you through the care needs assessment, how our carers are matched, and how our pricing is structured.'),
  ('postnatal', 'Postnatal care and Omugwo', 'care', '/postnatal-care', 20,
   'Your postnatal care enquiry, and what happens next',
   'Thank you for reaching out about postnatal support. The first weeks matter, and we plan around the household as it actually is.',
   'The brochure attached takes you through the care needs assessment, what a postnatal nurse does day to day, and how our pricing is structured.'),
  ('antenatal', 'Antenatal care', 'care', '/antenatal-care', 30,
   'Your antenatal care enquiry, and what happens next',
   'Thank you for reaching out about antenatal support.',
   'The brochure attached takes you through the care needs assessment, what to expect from your visits, and how our pricing is structured.'),
  ('post_surgical', 'Post-surgical recovery', 'care', '/post-surgical-care', 40,
   'Your recovery care enquiry, and what happens next',
   'Thank you for telling us about the recovery ahead. Discharge is the beginning of the work, not the end of it.',
   'The brochure attached takes you through the care needs assessment, how recovery plans are built, and how our pricing is structured.'),
  ('clinical_home_care', 'Clinical home care', 'care', '/clinical-home-care', 50,
   'Your clinical home care enquiry, and what happens next',
   'Thank you for reaching out about clinical care at home.',
   'The brochure attached takes you through the care needs assessment, the clinical scope our nurses work to, and how our pricing is structured.'),
  ('paediatric', 'Paediatric care', 'care', '/pediatric-care', 60,
   'Your paediatric care enquiry, and what happens next',
   'Thank you for telling us about your child''s care.',
   'The brochure attached takes you through the care needs assessment, how we match paediatric nurses, and how our pricing is structured.'),
  ('nanny_childcare', 'Nanny and childcare', 'care', '/nanny-childcare', 70,
   'Your childcare enquiry, and what happens next',
   'Thank you for telling us about the support your household needs.',
   'The brochure attached takes you through the assessment, how nannies are vetted, and how our pricing is structured.'),
  ('care_from_abroad', 'Care from abroad', 'care', '/care-from-abroad', 80,
   'Arranging care from abroad, and what happens next',
   'Thank you for reaching out. Arranging care from another country asks for more reporting, not less, and we plan for that from the start.',
   'The brochure attached takes you through the care needs assessment, how families abroad stay informed, and how our pricing is structured.'),
  ('hospital_staffing', 'Hospital staffing', 'facility', '/hospital-staffing', 90,
   'Your staffing enquiry, and what happens next',
   'Thank you for your staffing enquiry.',
   'The brochure attached sets out how we source, verify and deploy clinical staff, and how our commercial terms are structured.'),
  ('hospital_support', 'Hospital support services', 'facility', '/hospital-support', 100,
   'Your support services enquiry, and what happens next',
   'Thank you for your enquiry about support services.',
   'The brochure attached sets out our support service lines and how our commercial terms are structured.'),
  ('general', 'Something else', 'other', NULL, 200,
   'Thank you for your enquiry',
   'Thank you for getting in touch with Medic Connect.',
   'The brochure attached takes you through how we work, what a care needs assessment involves, and how our pricing is structured.')
ON CONFLICT (key) DO NOTHING;

/* ----------------------------------------------- the questions we ask first */

INSERT INTO public.enquiry_questions (service_line_id, field_key, label, help, input_type, options, required, sort_order)
VALUES
  (NULL, 'care_for', 'Who is the care for?', '', 'choice',
   '["A parent or older relative","My partner","My child","Myself","Someone else"]'::jsonb, true, 10),
  (NULL, 'setting', 'Where is the care needed?', '', 'choice',
   '["At home","In hospital","Moving home from hospital","Not decided yet"]'::jsonb, true, 20),
  (NULL, 'pattern', 'What pattern of care are you thinking of?', 'You can change this after the assessment.', 'choice',
   '["Live-in","Day shifts","Night shifts","Short visits","Not sure yet"]'::jsonb, true, 30),
  (NULL, 'start_when', 'When would care need to start?', '', 'choice',
   '["As soon as possible","Within a week","Within a month","Just planning ahead"]'::jsonb, true, 40),
  (NULL, 'duration', 'How long do you expect it to run?', '', 'choice',
   '["A few weeks","A few months","Ongoing","Not sure yet"]'::jsonb, false, 50),
  (NULL, 'arranger', 'Who is arranging and paying for the care?', '', 'choice',
   '["Me, here in Nigeria","Me, from abroad","A family member abroad","A company or employer","Not decided yet"]'::jsonb, false, 60),
  (NULL, 'heard_from', 'How did you hear about us?', '', 'choice',
   '["A friend or family member","A hospital or doctor","Instagram or LinkedIn","Google search","Somewhere else"]'::jsonb, false, 70)
ON CONFLICT DO NOTHING;

INSERT INTO public.enquiry_questions (service_line_id, field_key, label, help, input_type, options, required, sort_order)
SELECT l.id, q.field_key, q.label, q.help, q.input_type, q.options, q.required, q.sort_order
FROM public.enquiry_service_lines l
JOIN (VALUES
  ('eldercare', 'support_needs', 'What support is needed day to day?', 'Choose as many as apply.', 'multi',
   '["Mobility and transfers","Personal care and washing","Medication","Memory or dementia support","Companionship","Meals and household"]'::jsonb, true, 110),
  ('eldercare', 'mobility', 'How mobile is your relative?', '', 'choice',
   '["Walks unaided","Walks with a frame or stick","Needs help to move","Bed bound"]'::jsonb, false, 120),
  ('postnatal', 'baby_age', 'How old is the baby, or when is the baby due?', '', 'text', '[]'::jsonb, true, 110),
  ('postnatal', 'birth_type', 'Was it a vaginal birth or a caesarean?', '', 'choice',
   '["Vaginal birth","Caesarean","Not yet born"]'::jsonb, false, 120),
  ('postnatal', 'postnatal_needs', 'What would help most?', 'Choose as many as apply.', 'multi',
   '["Overnight baby care","Feeding and lactation support","Recovery care for mum","Cooking and household","Older children"]'::jsonb, true, 130),
  ('antenatal', 'due_date', 'When is the baby due?', '', 'text', '[]'::jsonb, true, 110),
  ('antenatal', 'pregnancy_notes', 'Is the pregnancy being managed for anything in particular?', '', 'textarea', '[]'::jsonb, false, 120),
  ('post_surgical', 'procedure', 'What procedure was carried out, or is planned?', '', 'text', '[]'::jsonb, true, 110),
  ('post_surgical', 'discharge_date', 'When is discharge, or when did it happen?', '', 'text', '[]'::jsonb, false, 120),
  ('post_surgical', 'recovery_needs', 'What does recovery involve?', 'Choose as many as apply.', 'multi',
   '["Wound care","Drains or catheter","Pain management","Physiotherapy support","Mobility","Medication"]'::jsonb, true, 130),
  ('clinical_home_care', 'clinical_needs', 'What clinical care is needed?', 'Choose as many as apply.', 'multi',
   '["IV therapy","Wound care","Catheter or stoma","Tracheostomy","Oxygen","Palliative care","Chronic condition management"]'::jsonb, true, 110),
  ('clinical_home_care', 'diagnosis', 'What is the diagnosis, as you understand it?', '', 'textarea', '[]'::jsonb, false, 120),
  ('paediatric', 'child_age', 'How old is the child?', '', 'text', '[]'::jsonb, true, 110),
  ('paediatric', 'child_needs', 'What support does the child need?', 'Choose as many as apply.', 'multi',
   '["Nursing care","Recovery after hospital","Feeding support","Developmental support","Respite for parents"]'::jsonb, true, 120),
  ('nanny_childcare', 'children_count', 'How many children, and how old?', '', 'text', '[]'::jsonb, true, 110),
  ('nanny_childcare', 'nanny_pattern', 'What hours do you need covered?', '', 'choice',
   '["Live-in","Full days","School hours","Evenings and nights","Weekends"]'::jsonb, true, 120),
  ('care_from_abroad', 'country', 'Which country are you arranging from?', '', 'text', '[]'::jsonb, true, 110),
  ('care_from_abroad', 'reporting', 'How often would you like to be updated?', '', 'choice',
   '["Daily","Every few days","Weekly","When something changes"]'::jsonb, false, 120),
  ('hospital_staffing', 'facility_name', 'Which facility is this for?', '', 'text', '[]'::jsonb, true, 110),
  ('hospital_staffing', 'roles_needed', 'Which roles do you need?', 'Choose as many as apply.', 'multi',
   '["Registered nurses","Midwives","Doctors","Lab scientists","Pharmacy","Care assistants"]'::jsonb, true, 120),
  ('hospital_staffing', 'headcount', 'Roughly how many people?', '', 'text', '[]'::jsonb, false, 130),
  ('hospital_support', 'facility_name', 'Which facility is this for?', '', 'text', '[]'::jsonb, true, 110),
  ('hospital_support', 'support_lines', 'Which services are you interested in?', 'Choose as many as apply.', 'multi',
   '["Portering and ward support","Security","Event medical cover","Permanent placements","Cleaning and hygiene"]'::jsonb, true, 120)
) AS q(line_key, field_key, label, help, input_type, options, required, sort_order)
  ON q.line_key = l.key
ON CONFLICT DO NOTHING;

/* ------------------------------------------- reading the history we already have */

UPDATE public.contact_submissions SET service_line = CASE
  WHEN service ILIKE '%elder%' OR service ILIKE '%geriat%' THEN 'eldercare'
  WHEN service ILIKE '%postnatal%' OR service ILIKE '%omugwo%' THEN 'postnatal'
  WHEN service ILIKE '%antenatal%' OR service ILIKE '%pregnan%' THEN 'antenatal'
  WHEN service ILIKE '%surgic%' OR service ILIKE '%recovery%' THEN 'post_surgical'
  WHEN service ILIKE '%clinical%' OR service ILIKE '%home-care%' OR service ILIKE '%home care%' THEN 'clinical_home_care'
  WHEN service ILIKE '%paediat%' OR service ILIKE '%pediat%' THEN 'paediatric'
  WHEN service ILIKE '%nanny%' OR service ILIKE '%child%' THEN 'nanny_childcare'
  WHEN service ILIKE '%abroad%' OR service ILIKE '%diaspora%' THEN 'care_from_abroad'
  WHEN service ILIKE '%staffing%' OR service ILIKE '%facilit%' OR service ILIKE '%hospital%' THEN 'hospital_staffing'
  ELSE 'general'
END
WHERE service_line IS NULL;

UPDATE public.contact_submissions SET source = CASE
  WHEN service ILIKE 'WhatsApp:%' THEN 'whatsapp_questionnaire'
  WHEN service ILIKE 'Intake:%' THEN 'welcome_intake'
  ELSE 'contact_form'
END
WHERE source = 'contact_form' AND (service ILIKE 'WhatsApp:%' OR service ILIKE 'Intake:%');

UPDATE public.contact_submissions SET stage = CASE
  WHEN status = 'replied' THEN 'contacted'
  ELSE 'new'
END
WHERE stage = 'new';
