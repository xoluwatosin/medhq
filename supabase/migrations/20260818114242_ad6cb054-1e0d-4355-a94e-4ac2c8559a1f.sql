
-- ---------------------------------------------------------------------------
-- The reference corpus. A model may normalise text onto these rows; it may
-- never invent one. Every table is admin-editable and readable by the app.
-- ---------------------------------------------------------------------------

CREATE TABLE public.mu_licensing_bodies (
  code text PRIMARY KEY,
  name text NOT NULL,
  variants text[] NOT NULL DEFAULT '{}',
  professions text[] NOT NULL DEFAULT '{}',
  number_pattern text,
  licence_expires boolean NOT NULL DEFAULT true,
  issues_registration_certificate boolean NOT NULL DEFAULT true,
  country text NOT NULL DEFAULT 'NG',
  note text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mu_licensing_bodies TO authenticated;
GRANT ALL ON public.mu_licensing_bodies TO service_role;
ALTER TABLE public.mu_licensing_bodies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users can read licensing bodies" ON public.mu_licensing_bodies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage licensing bodies" ON public.mu_licensing_bodies FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.mu_institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  variants text[] NOT NULL DEFAULT '{}',
  kind text NOT NULL DEFAULT 'university',
  state text,
  country text NOT NULL DEFAULT 'NG',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX mu_institutions_name_key ON public.mu_institutions (lower(name));
GRANT SELECT ON public.mu_institutions TO authenticated;
GRANT ALL ON public.mu_institutions TO service_role;
ALTER TABLE public.mu_institutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users can read institutions" ON public.mu_institutions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage institutions" ON public.mu_institutions FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.mu_awards (
  code text PRIMARY KEY,
  title text NOT NULL,
  variants text[] NOT NULL DEFAULT '{}',
  profession text,
  seniority text,
  level text,
  is_clinical boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mu_awards TO authenticated;
GRANT ALL ON public.mu_awards TO service_role;
ALTER TABLE public.mu_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users can read awards" ON public.mu_awards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage awards" ON public.mu_awards FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.mu_training_catalogue (
  code text PRIMARY KEY,
  name text NOT NULL,
  variants text[] NOT NULL DEFAULT '{}',
  usual_issuer text,
  validity_months integer,
  skill_facets text[] NOT NULL DEFAULT '{}',
  specialty_facets text[] NOT NULL DEFAULT '{}',
  standard text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mu_training_catalogue TO authenticated;
GRANT ALL ON public.mu_training_catalogue TO service_role;
ALTER TABLE public.mu_training_catalogue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users can read the training catalogue" ON public.mu_training_catalogue FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage the training catalogue" ON public.mu_training_catalogue FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.mu_lexicon_phrases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facet_type text NOT NULL,
  code text NOT NULL,
  phrase text NOT NULL,
  source text NOT NULL DEFAULT 'seed',
  reference_code text,
  weight numeric NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX mu_lexicon_phrases_key ON public.mu_lexicon_phrases (facet_type, code, lower(phrase));
CREATE INDEX mu_lexicon_phrases_code ON public.mu_lexicon_phrases (facet_type, code);
GRANT SELECT ON public.mu_lexicon_phrases TO authenticated;
GRANT ALL ON public.mu_lexicon_phrases TO service_role;
ALTER TABLE public.mu_lexicon_phrases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users can read the lexicon" ON public.mu_lexicon_phrases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage the lexicon" ON public.mu_lexicon_phrases FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Everything read out of a document. Immutable record, never a verified fact.
CREATE TABLE public.mu_document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.mu_documents(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.mu_people(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  classified_by text NOT NULL DEFAULT 'model',
  classification_confidence numeric NOT NULL DEFAULT 0,
  classification_evidence text,
  model text,
  extraction jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  not_found text[] NOT NULL DEFAULT '{}',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mu_document_extractions_person ON public.mu_document_extractions (person_id);
CREATE INDEX mu_document_extractions_document ON public.mu_document_extractions (document_id);
GRANT SELECT ON public.mu_document_extractions TO authenticated;
GRANT ALL ON public.mu_document_extractions TO service_role;
ALTER TABLE public.mu_document_extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage document extractions" ON public.mu_document_extractions FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Candidates read their own extractions" ON public.mu_document_extractions FOR SELECT TO authenticated USING (person_id = public.mu_my_person_id());

CREATE TRIGGER mu_licensing_bodies_touch BEFORE UPDATE ON public.mu_licensing_bodies FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();
CREATE TRIGGER mu_institutions_touch BEFORE UPDATE ON public.mu_institutions FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();
CREATE TRIGGER mu_awards_touch BEFORE UPDATE ON public.mu_awards FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();
CREATE TRIGGER mu_training_catalogue_touch BEFORE UPDATE ON public.mu_training_catalogue FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();
CREATE TRIGGER mu_lexicon_phrases_touch BEFORE UPDATE ON public.mu_lexicon_phrases FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();
CREATE TRIGGER mu_document_extractions_touch BEFORE UPDATE ON public.mu_document_extractions FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

-- ---------------------------------------------------------------------------
-- Seeds
-- ---------------------------------------------------------------------------

INSERT INTO public.mu_licensing_bodies (code, name, variants, professions, number_pattern, licence_expires, note) VALUES
  ('NMCN','Nursing and Midwifery Council of Nigeria', ARRAY['nmcn','nursing and midwifery council','nursing council of nigeria','n&mcn','nursing & midwifery council of nigeria'], ARRAY['Registered Nurse','Nurse/Midwife','Midwife','Nursing Assistant'], NULL, true, 'Practising licence renews; the registration certificate does not expire.'),
  ('MDCN','Medical and Dental Council of Nigeria', ARRAY['mdcn','medical and dental council','medical council of nigeria'], ARRAY['Medical Doctor'], NULL, true, 'Annual practising licence.'),
  ('PCN','Pharmacists Council of Nigeria', ARRAY['pcn','pharmacists council','pharmacy council of nigeria'], ARRAY['Pharmacist','Pharmacy Technician'], NULL, true, NULL),
  ('MLSCN','Medical Laboratory Science Council of Nigeria', ARRAY['mlscn','medical laboratory science council'], ARRAY['Medical Laboratory Scientist'], NULL, true, NULL),
  ('RRBN','Radiographers Registration Board of Nigeria', ARRAY['rrbn','radiographers registration board'], ARRAY['Radiographer'], NULL, true, NULL),
  ('MRTB','Medical Rehabilitation Therapists Board of Nigeria', ARRAY['mrtb','mrtbn','medical rehabilitation therapists board'], ARRAY['Physiotherapist','Occupational Therapist','Speech and Language Therapist'], NULL, true, NULL),
  ('CHPRBN','Community Health Practitioners Registration Board of Nigeria', ARRAY['chprbn','community health practitioners registration board'], ARRAY['Community Health Extension Worker'], NULL, true, NULL),
  ('DRBN','Dietitians Registration Board of Nigeria', ARRAY['drbn','dietitians registration board'], ARRAY['Nutritionist / Dietitian'], NULL, true, NULL),
  ('HRORBN','Health Records Officers Registration Board of Nigeria', ARRAY['hrorbn','health records officers registration board'], ARRAY['Health Records Officer'], NULL, true, NULL),
  ('NMC_UK','Nursing and Midwifery Council (UK)', ARRAY['nmc','nmc uk','nursing and midwifery council uk'], ARRAY['Registered Nurse','Midwife'], NULL, true, 'Overseas registration, recorded where a candidate holds it.');

INSERT INTO public.mu_awards (code, title, variants, profession, seniority, level, is_clinical) VALUES
  ('BNSC','Bachelor of Nursing Science', ARRAY['bnsc','b.nsc','b nsc','bachelor of nursing science','bsc nursing','b.sc nursing','bachelor of science in nursing','bsn'], 'Registered Nurse','mid','degree', true),
  ('RN','Registered Nurse certificate', ARRAY['rn','registered nurse','general nursing certificate','rn certificate'], 'Registered Nurse','mid','diploma', true),
  ('RM','Registered Midwife certificate', ARRAY['rm','registered midwife','midwifery certificate'], 'Midwife','mid','diploma', true),
  ('RPHN','Registered Public Health Nurse', ARRAY['rphn','public health nursing certificate','registered public health nurse'], 'Registered Nurse','senior','post_basic', true),
  ('RNA','Registered Nurse Anaesthetist', ARRAY['rna','nurse anaesthetist','anaesthetic nursing'], 'Registered Nurse','senior','post_basic', true),
  ('PERIOP','Peri-operative Nursing certificate', ARRAY['peri-operative nursing','perioperative nursing','theatre nursing certificate','ophthalmic theatre'], 'Registered Nurse','senior','post_basic', true),
  ('ACCIDENT','Accident and Emergency Nursing certificate', ARRAY['accident and emergency nursing','a&e nursing certificate','emergency nursing certificate'], 'Registered Nurse','senior','post_basic', true),
  ('CRITCARE','Critical Care Nursing certificate', ARRAY['critical care nursing','intensive care nursing certificate','icu nursing certificate'], 'Registered Nurse','senior','post_basic', true),
  ('PAEDNUR','Paediatric Nursing certificate', ARRAY['paediatric nursing','pediatric nursing certificate'], 'Registered Nurse','senior','post_basic', true),
  ('PSYCHNUR','Psychiatric Nursing certificate', ARRAY['psychiatric nursing','mental health nursing certificate'], 'Registered Nurse','senior','post_basic', true),
  ('RENALNUR','Renal / Nephrology Nursing certificate', ARRAY['renal nursing','nephrology nursing','dialysis nursing certificate'], 'Registered Nurse','senior','post_basic', true),
  ('ONCNUR','Oncology Nursing certificate', ARRAY['oncology nursing'], 'Registered Nurse','senior','post_basic', true),
  ('CARDIONUR','Cardiothoracic Nursing certificate', ARRAY['cardiothoracic nursing','cardiac nursing certificate'], 'Registered Nurse','senior','post_basic', true),
  ('ORTHNUR','Orthopaedic Nursing certificate', ARRAY['orthopaedic nursing','orthopedic nursing'], 'Registered Nurse','senior','post_basic', true),
  ('BURNS','Burns and Plastic Nursing certificate', ARRAY['burns and plastic nursing','plastic surgery nursing'], 'Registered Nurse','senior','post_basic', true),
  ('MSCNUR','Master of Science in Nursing', ARRAY['msc nursing','m.sc nursing','master of nursing science','msn'], 'Registered Nurse','lead','masters', true),
  ('MBBS','Bachelor of Medicine, Bachelor of Surgery', ARRAY['mbbs','mbchb','mb bs','bachelor of medicine'], 'Medical Doctor','mid','degree', true),
  ('BPHARM','Bachelor of Pharmacy', ARRAY['b.pharm','bpharm','bachelor of pharmacy','pharm.d','pharmd'], 'Pharmacist','mid','degree', true),
  ('BMLS','Bachelor of Medical Laboratory Science', ARRAY['bmls','b.mls','medical laboratory science degree'], 'Medical Laboratory Scientist','mid','degree', true),
  ('BPT','Bachelor of Physiotherapy', ARRAY['bpt','b.physio','bachelor of physiotherapy','bmr pt'], 'Physiotherapist','mid','degree', true),
  ('BRAD','Bachelor of Radiography', ARRAY['b.rad','bachelor of radiography','radiography degree'], 'Radiographer','mid','degree', true),
  ('CHEW','Community Health Extension Worker certificate', ARRAY['chew','jchew','community health extension worker','community health officer','cho'], 'Community Health Extension Worker','junior','diploma', true),
  ('ND','National Diploma', ARRAY['nd','ond','national diploma'], NULL,'junior','diploma', false),
  ('HND','Higher National Diploma', ARRAY['hnd','higher national diploma'], NULL,'mid','diploma', false),
  ('AUXNUR','Auxiliary Nursing certificate', ARRAY['auxiliary nursing','auxilliary nursing','auxiliary nurse certificate'], 'Auxiliary Nurse','entry','certificate', true),
  ('CAREASSIST','Care Assistant / Health Care Assistant certificate', ARRAY['care assistant certificate','health care assistant','hca certificate','care certificate'], 'Care Assistant','entry','certificate', true);

INSERT INTO public.mu_training_catalogue (code, name, variants, usual_issuer, validity_months, skill_facets, specialty_facets, standard) VALUES
  ('BLS','Basic Life Support', ARRAY['bls','basic life support','cpr','cardiopulmonary resuscitation','first aid and cpr'], 'AHA / Red Cross', 24, ARRAY['basic_life_support'], '{}', 'AHA'),
  ('ACLS','Advanced Cardiac Life Support', ARRAY['acls','advanced cardiac life support','advanced life support','als'], 'AHA', 24, ARRAY['advanced_life_support','ecg_monitoring'], ARRAY['critical_care'], 'AHA'),
  ('PALS','Paediatric Advanced Life Support', ARRAY['pals','paediatric advanced life support','pediatric advanced life support'], 'AHA', 24, ARRAY['advanced_life_support'], ARRAY['paediatrics'], 'AHA'),
  ('NRP','Neonatal Resuscitation Programme', ARRAY['nrp','neonatal resuscitation','helping babies breathe'], 'AAP', 24, ARRAY['advanced_life_support'], ARRAY['neonatal'], 'AAP'),
  ('IPC','Infection Prevention and Control', ARRAY['ipc','infection control','infection prevention','hand hygiene training'], NULL, 12, ARRAY['infection_control_practice'], ARRAY['infection_control'], 'WHO'),
  ('SAFEGUARD','Safeguarding adults and children', ARRAY['safeguarding','safeguarding adults','safeguarding children','child protection'], NULL, 36, ARRAY['safeguarding'], '{}', 'Care Certificate'),
  ('MANUALHANDLE','Moving and handling', ARRAY['manual handling','moving and handling','patient handling','people handling'], NULL, 12, ARRAY['manual_handling'], '{}', 'Care Certificate'),
  ('MEDADMIN','Safe administration of medicines', ARRAY['medication administration','safe handling of medicines','drug administration training','medication management'], NULL, 24, ARRAY['medication_administration'], '{}', 'Care Certificate'),
  ('DEMENTIACARE','Dementia care awareness', ARRAY['dementia care','dementia awareness','alzheimer care training'], NULL, NULL, ARRAY['dementia_support'], ARRAY['dementia_care'], 'Skills for Care'),
  ('ENDOFLIFE','End of life care', ARRAY['end of life care','palliative care training','last days of life'], NULL, NULL, ARRAY['palliative_symptom_control'], ARRAY['palliative_care'], 'Skills for Care'),
  ('MENTALCAP','Mental capacity and DoLS', ARRAY['mental capacity act','dols','deprivation of liberty'], NULL, NULL, ARRAY['safeguarding'], '{}', 'CQC'),
  ('IVTHERAPY','IV therapy and cannulation', ARRAY['iv therapy','intravenous therapy','cannulation training','venepuncture training','phlebotomy training'], NULL, 24, ARRAY['cannulation','venepuncture','iv_therapy'], '{}', NULL),
  ('WOUNDCARE','Wound care and tissue viability', ARRAY['wound care','wound dressing training','tissue viability','pressure ulcer prevention'], NULL, NULL, ARRAY['wound_dressing','pressure_area_care'], ARRAY['wound_care'], 'RCN'),
  ('DIABETES','Diabetes management', ARRAY['diabetes management','insulin administration training','diabetes care'], NULL, NULL, ARRAY['diabetes_management'], ARRAY['diabetes_endocrine'], NULL),
  ('CATHETER','Catheterisation', ARRAY['catheterisation','catheterization','urinary catheter care'], NULL, NULL, ARRAY['catheterisation'], '{}', NULL),
  ('STOMA','Stoma care', ARRAY['stoma care','colostomy care'], NULL, NULL, ARRAY['stoma_care'], '{}', NULL),
  ('PEG','PEG and enteral feeding', ARRAY['peg feeding','enteral feeding','ng tube training','nasogastric feeding'], NULL, NULL, ARRAY['ng_tube_feeding'], '{}', NULL),
  ('TRACHEO','Tracheostomy care', ARRAY['tracheostomy care','trachy care'], NULL, NULL, ARRAY['tracheostomy_care'], ARRAY['critical_care'], NULL),
  ('VENT','Ventilator management', ARRAY['ventilator management','mechanical ventilation','ventilation training'], NULL, NULL, ARRAY['ventilator_management'], ARRAY['critical_care'], NULL),
  ('EMONC','Emergency obstetric and newborn care', ARRAY['emonc','bemonc','cemonc','emergency obstetric care'], NULL, NULL, ARRAY['advanced_life_support'], ARRAY['maternity_obstetrics','neonatal'], 'WHO'),
  ('IMCI','Integrated Management of Childhood Illness', ARRAY['imci','integrated management of childhood illness'], 'WHO', NULL, '{}', ARRAY['paediatrics'], 'WHO'),
  ('HIVCARE','HIV care and ART', ARRAY['hiv counselling and testing','art training','pmtct','hct training'], NULL, NULL, '{}', ARRAY['public_health'], 'WHO'),
  ('TBCARE','Tuberculosis programme training', ARRAY['dots training','tb programme','tuberculosis training'], NULL, NULL, '{}', ARRAY['public_health'], 'WHO'),
  ('IPCCOVID','Outbreak and IPC response', ARRAY['covid-19 training','outbreak response','lassa fever training','ebola training'], NULL, NULL, ARRAY['infection_control_practice'], ARRAY['infection_control','public_health'], 'WHO'),
  ('FIRSTAID','First aid at work', ARRAY['first aid','first aid at work','emergency first aid'], NULL, 36, ARRAY['basic_life_support'], '{}', NULL),
  ('FOODHYG','Food hygiene', ARRAY['food hygiene','food safety level 2'], NULL, 36, '{}', '{}', 'Care Certificate'),
  ('EQUALITY','Equality, diversity and inclusion', ARRAY['equality and diversity','edi training','inclusion training'], NULL, NULL, '{}', '{}', 'Care Certificate'),
  ('DATAPROT','Information governance', ARRAY['data protection training','information governance','ndpr training','gdpr training'], NULL, 12, '{}', '{}', 'CQC');
