
CREATE TABLE public.mu_document_types (
  code text PRIMARY KEY,
  label text NOT NULL,
  helper text,
  evidences text[] NOT NULL DEFAULT '{}',
  expected_fields text[] NOT NULL DEFAULT '{}',
  expires boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mu_document_types TO authenticated;
GRANT ALL ON public.mu_document_types TO service_role;
ALTER TABLE public.mu_document_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users can read document types" ON public.mu_document_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage document types" ON public.mu_document_types FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER mu_document_types_touch BEFORE UPDATE ON public.mu_document_types FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

INSERT INTO public.mu_document_types (code, label, helper, evidences, expected_fields, expires, sort_order) VALUES
  ('cv','CV','Your work history in one document.','{}', ARRAY['full_name','phone','email','profession','years_experience','state','lga','employment','qualifications','certifications','languages'], false, 10),
  ('practising_licence','Practising licence','The licence you renew to practise, for example the NMCN practising licence.', ARRAY['licence'], ARRAY['full_name','licensing_body','license_number','license_expiry','issue_date','profession'], true, 20),
  ('registration_certificate','Registration certificate','Your one-off council registration certificate, which does not expire.', ARRAY['licence'], ARRAY['full_name','licensing_body','license_number','issue_date','profession','award'], false, 30),
  ('qualification_certificate','Qualification certificate','A degree, diploma or school of nursing certificate.', ARRAY['qualification'], ARRAY['full_name','award','institution','award_date','grade'], false, 40),
  ('training_certificate','Training certificate','Short course certificates such as BLS, ACLS, safeguarding or IPC.', ARRAY['training'], ARRAY['full_name','training_name','issuer','issue_date','expiry_date'], true, 50),
  ('nysc','NYSC document','Your discharge, exemption or exclusion certificate.', ARRAY['nysc'], ARRAY['full_name','nysc_status','issue_date','service_state','call_up_number'], false, 60),
  ('government_id','Government ID','NIN slip, international passport, voter card or driver licence.', ARRAY['identity'], ARRAY['full_name','id_type','id_number','date_of_birth','sex','expiry_date'], true, 70),
  ('right_to_work','Right to work or visa','A visa, residence permit or work authorisation.', ARRAY['right_to_work'], ARRAY['full_name','country','permit_type','permit_number','valid_from','expiry_date'], true, 80),
  ('reference_letter','Reference','A letter from someone who can speak to your work.', ARRAY['reference'], ARRAY['full_name','referee_name','referee_role','organisation','referee_contact','issue_date'], false, 90),
  ('service_letter','Employment or service letter','Appointment, confirmation or letter of service from an employer.', ARRAY['employment'], ARRAY['full_name','employer','job_title','start_date','end_date','issue_date'], false, 100),
  ('police_clearance','Police or background check','A police character certificate or background check result.', ARRAY['background_check'], ARRAY['full_name','issuing_authority','issue_date','outcome'], true, 110),
  ('medical_fitness','Medical fitness report','A fitness to work or pre-employment medical report.', ARRAY['medical_fitness'], ARRAY['full_name','issuer','issue_date','outcome'], true, 120),
  ('proof_of_address','Proof of address','A utility bill or bank statement showing where you live.', ARRAY['address'], ARRAY['full_name','address','state','lga','issue_date'], true, 130),
  ('other','Other','Anything that does not fit the list above.', '{}', ARRAY['full_name'], false, 200);

ALTER TABLE public.mu_documents
  ADD COLUMN doc_kind text REFERENCES public.mu_document_types(code),
  ADD COLUMN doc_kind_source text NOT NULL DEFAULT 'unclassified',
  ADD COLUMN doc_kind_confidence numeric NOT NULL DEFAULT 0,
  ADD COLUMN doc_kind_evidence text,
  ADD COLUMN classified_at timestamptz;
CREATE INDEX mu_documents_doc_kind ON public.mu_documents (doc_kind);

CREATE OR REPLACE FUNCTION public.mu_doc_kind_guess(_label text, _url text DEFAULT '')
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH t AS (SELECT lower(coalesce(_label,'') || ' ' || coalesce(_url,'')) AS s)
  SELECT CASE
    WHEN (SELECT s FROM t) ~ '(\ycv\y|resume|curriculum ?vit)' THEN 'cv'
    WHEN (SELECT s FROM t) ~ '(nysc|discharge certificate|exemption certificate|call ?up)' THEN 'nysc'
    WHEN (SELECT s FROM t) ~ '(practi[cs]ing licen[cs]e|current licen[cs]e|licence renewal|annual licen)' THEN 'practising_licence'
    WHEN (SELECT s FROM t) ~ '(registration certificate|council registration|nmcn|mdcn|mlscn|pcn cert|rrbn)' THEN 'registration_certificate'
    WHEN (SELECT s FROM t) ~ '(bls|acls|pals|nrp|safeguard|infection (prevention|control)|ipc|manual handling|first aid|short course|workshop|seminar|training)' THEN 'training_certificate'
    WHEN (SELECT s FROM t) ~ '(degree|diploma|bnsc|b\.?sc|hnd|\yond\y|school of nursing|transcript|statement of result|convocation|qualification)' THEN 'qualification_certificate'
    WHEN (SELECT s FROM t) ~ '(visa|residence permit|right to work|work permit|brp|share code)' THEN 'right_to_work'
    WHEN (SELECT s FROM t) ~ '(passport|\ynin\y|national id|voter|driver''?s? licen[cs]e|identity)' THEN 'government_id'
    WHEN (SELECT s FROM t) ~ '(police|background check|character certificate|dbs)' THEN 'police_clearance'
    WHEN (SELECT s FROM t) ~ '(medical (fitness|report)|fitness to work|pre.?employment medical)' THEN 'medical_fitness'
    WHEN (SELECT s FROM t) ~ '(reference|referee|recommendation|testimonial)' THEN 'reference_letter'
    WHEN (SELECT s FROM t) ~ '(appointment letter|letter of service|employment letter|confirmation letter|posting|payslip|pay slip)' THEN 'service_letter'
    WHEN (SELECT s FROM t) ~ '(utility bill|bank statement|proof of address|address)' THEN 'proof_of_address'
    WHEN (SELECT s FROM t) ~ '(licen[cs]e)' THEN 'practising_licence'
    WHEN (SELECT s FROM t) ~ '(certificate|\ycert\y)' THEN 'qualification_certificate'
    ELSE 'other'
  END
$$;
REVOKE EXECUTE ON FUNCTION public.mu_doc_kind_guess(text, text) FROM anon;

UPDATE public.mu_documents
   SET doc_kind = public.mu_doc_kind_guess(label, url),
       doc_kind_source = 'filename',
       doc_kind_confidence = 0.4,
       doc_kind_evidence = 'Guessed from the file name and label before the document was read.'
 WHERE doc_kind IS NULL;

CREATE OR REPLACE FUNCTION public.mu_documents_guess_kind()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.doc_kind IS NULL THEN
    NEW.doc_kind := public.mu_doc_kind_guess(NEW.label, NEW.url);
    NEW.doc_kind_source := 'filename';
    NEW.doc_kind_confidence := 0.4;
    NEW.doc_kind_evidence := 'Guessed from the file name and label before the document was read.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER mu_documents_guess_kind_trg
  BEFORE INSERT ON public.mu_documents
  FOR EACH ROW EXECUTE FUNCTION public.mu_documents_guess_kind();

INSERT INTO public.mu_lexicon_phrases (facet_type, code, phrase, source, reference_code, weight)
SELECT 'skill', s, v, 'training_catalogue', t.code, 0.9
  FROM public.mu_training_catalogue t
  CROSS JOIN LATERAL unnest(t.skill_facets) AS s
  CROSS JOIN LATERAL unnest(array_append(t.variants, lower(t.name))) AS v
 WHERE s <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.mu_lexicon_phrases (facet_type, code, phrase, source, reference_code, weight)
SELECT 'specialty', s, v, 'training_catalogue', t.code, 0.8
  FROM public.mu_training_catalogue t
  CROSS JOIN LATERAL unnest(t.specialty_facets) AS s
  CROSS JOIN LATERAL unnest(array_append(t.variants, lower(t.name))) AS v
 WHERE s <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.mu_lexicon_phrases (facet_type, code, phrase, weight) VALUES
  ('specialty','critical_care','icu',0.95),('specialty','critical_care','intensive care unit',1),
  ('specialty','critical_care','critical care unit',1),('specialty','critical_care','ccu',0.7),
  ('specialty','accident_emergency','accident and emergency',1),('specialty','accident_emergency','a&e',0.95),
  ('specialty','accident_emergency','emergency room',0.95),('specialty','accident_emergency','casualty',0.85),
  ('specialty','theatre_perioperative','operating theatre',1),('specialty','theatre_perioperative','peri-operative',1),
  ('specialty','theatre_perioperative','scrub nurse',0.95),('specialty','theatre_perioperative','circulating nurse',0.9),
  ('specialty','anaesthetics','anaesthesia',1),('specialty','anaesthetics','nurse anaesthetist',1),
  ('specialty','maternity_obstetrics','labour ward',1),('specialty','maternity_obstetrics','obstetrics',1),
  ('specialty','maternity_obstetrics','antenatal clinic',0.9),('specialty','maternity_obstetrics','midwifery',0.95),
  ('specialty','gynaecology','gynaecology',1),('specialty','gynaecology','gynecology',1),
  ('specialty','neonatal','scbu',0.95),('specialty','neonatal','special care baby unit',1),
  ('specialty','neonatal','nicu',1),('specialty','neonatal','newborn unit',0.9),
  ('specialty','paediatrics','paediatric ward',1),('specialty','paediatrics','children ward',0.9),
  ('specialty','paediatrics','pediatrics',1),
  ('specialty','geriatrics','elderly care',1),('specialty','geriatrics','care of the elderly',1),
  ('specialty','geriatrics','geriatric',1),('specialty','geriatrics','old people''s home',0.8),
  ('specialty','oncology','oncology',1),('specialty','oncology','chemotherapy unit',0.9),
  ('specialty','haematology','haematology',1),('specialty','haematology','sickle cell clinic',0.85),
  ('specialty','dialysis_renal','dialysis',1),('specialty','dialysis_renal','renal unit',1),
  ('specialty','dialysis_renal','nephrology',1),
  ('specialty','cardiology','cardiology',1),('specialty','cardiology','cardiac unit',0.95),
  ('specialty','cardiothoracic','cardiothoracic',1),
  ('specialty','respiratory','respiratory unit',0.9),('specialty','respiratory','chest clinic',0.85),
  ('specialty','orthopaedics','orthopaedic',1),('specialty','orthopaedics','orthopedic',1),
  ('specialty','neurology_stroke','stroke unit',1),('specialty','neurology_stroke','neurology',1),
  ('specialty','neurology_stroke','neurosurgery',0.9),
  ('specialty','burns_plastics','burns unit',1),('specialty','burns_plastics','plastic surgery',0.9),
  ('specialty','urology','urology',1),
  ('specialty','ophthalmic','ophthalmic',1),('specialty','ophthalmic','eye clinic',0.9),
  ('specialty','ent','ear nose and throat',1),('specialty','ent','otorhinolaryngology',1),
  ('specialty','dermatology','dermatology',1),
  ('specialty','mental_health','psychiatric',1),('specialty','mental_health','mental health',1),
  ('specialty','mental_health','neuropsychiatric hospital',0.95),
  ('specialty','learning_disability','learning disability',1),('specialty','learning_disability','special needs',0.8),
  ('specialty','learning_disability','autism support',0.85),
  ('specialty','substance_misuse','drug rehabilitation',0.9),('specialty','substance_misuse','substance misuse',1),
  ('specialty','palliative_care','palliative',1),('specialty','palliative_care','hospice',0.95),
  ('specialty','rehabilitation','rehabilitation',1),('specialty','rehabilitation','rehab centre',0.9),
  ('specialty','physiotherapy','physiotherapy',1),('specialty','occupational_therapy','occupational therapy',1),
  ('specialty','speech_language','speech and language therapy',1),
  ('specialty','nutrition_dietetics','dietetics',1),('specialty','nutrition_dietetics','nutritionist',0.9),
  ('specialty','infection_control','infection prevention and control',1),('specialty','infection_control','ipc unit',0.9),
  ('specialty','public_health','public health',1),('specialty','public_health','community health',0.85),
  ('specialty','primary_care','primary health care',1),('specialty','primary_care','phc',0.85),
  ('specialty','occupational_health','occupational health',1),('specialty','occupational_health','staff clinic',0.8),
  ('specialty','school_health','school health',1),
  ('specialty','family_planning','family planning',1),('specialty','family_planning','reproductive health',0.85),
  ('specialty','hiv_art','antiretroviral',1),('specialty','hiv_art','hiv clinic',1),('specialty','hiv_art','pmtct',0.95),
  ('specialty','tuberculosis','tuberculosis',1),('specialty','tuberculosis','dots clinic',0.9),
  ('specialty','tropical_infectious_disease','lassa fever',0.95),('specialty','tropical_infectious_disease','malaria programme',0.85),
  ('specialty','tropical_infectious_disease','isolation centre',0.9),
  ('specialty','diabetes_endocrine','diabetes clinic',1),('specialty','diabetes_endocrine','endocrinology',1),
  ('specialty','wound_care','wound care',1),('specialty','wound_care','tissue viability',1),
  ('specialty','dementia_care','dementia',1),('specialty','dementia_care','alzheimer',0.95),
  ('specialty','post_surgical_recovery','recovery room',0.95),('specialty','post_surgical_recovery','post operative care',1),
  ('specialty','spinal_injury','spinal injury',1),
  ('specialty','general_medicine','medical ward',1),('specialty','general_medicine','general medicine',1),
  ('specialty','general_surgery','surgical ward',1),('specialty','general_surgery','general surgery',1),
  ('setting','home_care','home care',1),('setting','home_care','domiciliary',1),('setting','home_care','home nursing',1),
  ('setting','live_in_care','live-in care',1),('setting','live_in_care','live in nurse',0.95),
  ('setting','hospital_inpatient','teaching hospital',0.9),('setting','hospital_inpatient','general hospital',0.9),
  ('setting','hospital_inpatient','inpatient',1),('setting','hospital_inpatient','federal medical centre',0.9),
  ('setting','outpatient_clinic','outpatient',1),('setting','outpatient_clinic','gopd',0.95),
  ('setting','icu','intensive care unit',1),('setting','hdu','high dependency unit',1),
  ('setting','theatre','operating theatre',1),
  ('setting','emergency_department','emergency department',1),('setting','emergency_department','accident and emergency',0.9),
  ('setting','dialysis_unit','dialysis centre',1),('setting','maternity_unit','maternity',1),
  ('setting','community','community outreach',0.9),('setting','phc_centre','primary health centre',1),
  ('setting','care_home','nursing home',1),('setting','care_home','residential home',0.95),
  ('setting','hospice','hospice',1),('setting','rehabilitation_centre','rehabilitation centre',1),
  ('setting','school','school clinic',0.9),('setting','telehealth','telemedicine',1),
  ('setting','ambulance_prehospital','ambulance service',1),('setting','ambulance_prehospital','pre-hospital',1),
  ('setting','laboratory','laboratory',1),('setting','imaging','radiology',1),('setting','pharmacy','pharmacy',1),
  ('setting','corporate_occupational','company clinic',0.9),('setting','ngo_programme','ngo',0.8),
  ('setting','ngo_programme','usaid project',0.85),
  ('skill','cannulation','cannulation',1),('skill','venepuncture','venepuncture',1),
  ('skill','venepuncture','venipuncture',1),('skill','phlebotomy','phlebotomy',1),
  ('skill','medication_administration','drug administration',1),('skill','medication_administration','medication administration',1),
  ('skill','controlled_drugs','controlled drugs',1),('skill','injection_administration','intramuscular injection',0.95),
  ('skill','insulin_administration','insulin administration',1),
  ('skill','iv_therapy','intravenous infusion',1),('skill','infusion_pumps','infusion pump',1),
  ('skill','blood_transfusion','blood transfusion',1),
  ('skill','wound_dressing','wound dressing',1),('skill','wound_dressing','dressing of wounds',1),
  ('skill','suturing','suturing',1),('skill','catheterisation','urinary catheterisation',1),
  ('skill','bowel_care','bowel care',1),('skill','stoma_care','stoma care',1),
  ('skill','ng_tube_feeding','nasogastric tube',1),('skill','peg_feeding','peg feeding',1),
  ('skill','tracheostomy_care','tracheostomy',1),('skill','suctioning','suctioning',1),
  ('skill','oxygen_therapy','oxygen therapy',1),('skill','nebuliser_therapy','nebulisation',1),
  ('skill','ventilator_management','mechanical ventilation',1),('skill','cpap_bipap','cpap',0.95),
  ('skill','chest_drain_care','chest drain',1),('skill','central_line_care','central line',1),
  ('skill','dialysis_machine_operation','haemodialysis machine',1),
  ('skill','ecg_monitoring','ecg',0.95),('skill','cardiac_monitoring','cardiac monitoring',1),
  ('skill','vital_signs_monitoring','vital signs',1),('skill','vital_signs_monitoring','tpr and bp',0.9),
  ('skill','news2_scoring','early warning score',1),('skill','point_of_care_testing','point of care testing',1),
  ('skill','specimen_collection','specimen collection',1),('skill','blood_glucose_monitoring','blood glucose monitoring',1),
  ('skill','pain_assessment','pain assessment',1),('skill','wound_assessment','wound assessment',1),
  ('skill','pressure_area_care','pressure area care',1),('skill','pressure_area_care','bed sore prevention',0.9),
  ('skill','falls_risk_assessment','falls risk',1),('skill','nutritional_assessment','nutritional assessment',1),
  ('skill','developmental_assessment','developmental assessment',1),
  ('skill','basic_life_support','cardiopulmonary resuscitation',1),('skill','advanced_life_support','advanced life support',1),
  ('skill','neonatal_resuscitation','neonatal resuscitation',1),('skill','triage','triage',1),
  ('skill','trauma_care','trauma care',1),('skill','emergency_obstetric_care','emergency obstetric care',1),
  ('skill','defibrillation','defibrillation',1),
  ('skill','antenatal_care','antenatal care',1),('skill','labour_management','conduct of delivery',1),
  ('skill','labour_management','labour management',1),('skill','postnatal_care','postnatal care',1),
  ('skill','breastfeeding_support','breastfeeding counselling',1),('skill','immunisation','immunisation',1),
  ('skill','immunisation','routine immunization',1),('skill','growth_monitoring','growth monitoring',1),
  ('skill','kangaroo_mother_care','kangaroo mother care',1),('skill','phototherapy','phototherapy',1),
  ('skill','personal_care','personal care',1),('skill','bathing_showering','bed bath',1),
  ('skill','bathing_showering','assisting with bathing',1),('skill','toileting_continence','continence care',1),
  ('skill','toileting_continence','toileting',1),('skill','dressing_grooming','assisting with dressing',1),
  ('skill','oral_hygiene','oral hygiene',1),('skill','meal_preparation','meal preparation',1),
  ('skill','feeding_assistance','feeding assistance',1),('skill','mobility_assistance','mobility support',1),
  ('skill','manual_handling','manual handling',1),('skill','hoist_operation','hoist',1),
  ('skill','housekeeping_support','light housekeeping',1),('skill','shopping_errands','shopping and errands',1),
  ('skill','companionship','companionship',1),('skill','escorting_appointments','escorting to appointments',1),
  ('skill','sleep_night_care','waking night',1),('skill','sleep_night_care','sleep-in night',1),
  ('skill','diabetes_management','diabetes management',1),('skill','dementia_support','dementia care',1),
  ('skill','behaviour_that_challenges','behaviour that challenges',1),
  ('skill','epilepsy_seizure_management','seizure management',1),
  ('skill','stroke_rehabilitation_support','stroke rehabilitation',1),
  ('skill','palliative_symptom_control','symptom control',1),('skill','end_of_life_care','end of life care',1),
  ('skill','physiotherapy_exercises','passive exercises',1),('skill','speech_swallow_support','swallowing assessment',0.9),
  ('skill','respite_care','respite care',1),
  ('skill','safeguarding','safeguarding',1),('skill','safeguarding','child protection',0.9),
  ('skill','infection_control_practice','infection control',1),('skill','risk_assessment','risk assessment',1),
  ('skill','care_planning','care plan',1),('skill','clinical_documentation','nursing documentation',1),
  ('skill','electronic_health_records','electronic medical record',1),('skill','electronic_health_records','emr',0.85),
  ('skill','medication_reconciliation','medication reconciliation',1),('skill','health_education','health education',1),
  ('skill','family_education','patient and family education',1),('skill','discharge_planning','discharge planning',1),
  ('skill','supervision_mentoring','supervision of student nurses',1),('skill','supervision_mentoring','preceptorship',0.9),
  ('skill','shift_coordination','shift in charge',1),('skill','shift_coordination','ward round coordination',0.85),
  ('skill','audit_quality_improvement','clinical audit',1),('skill','data_reporting','dhis2',0.9),
  ('skill','data_reporting','monthly reporting',0.8),
  ('patient_group','older_adults','elderly clients',1),('patient_group','older_adults','senior citizens',0.9),
  ('patient_group','adults','adult patients',0.9),('patient_group','young_adults','young adults',0.9),
  ('patient_group','children','children',1),('patient_group','infants_neonates','neonates',1),
  ('patient_group','mothers_newborns','mother and baby',1),('patient_group','dementia','dementia clients',1),
  ('patient_group','stroke_survivors','stroke patients',1),
  ('patient_group','palliative_end_of_life','terminally ill',1),
  ('patient_group','physical_disability','physically challenged',1),
  ('patient_group','learning_disability_clients','learning disabilities',1),
  ('patient_group','autism','autistic clients',1),('patient_group','mental_health_clients','psychiatric patients',1),
  ('patient_group','post_surgical','post operative patients',1),
  ('patient_group','chronic_illness','chronic illness',1),('patient_group','cancer','cancer patients',1),
  ('patient_group','renal_failure','renal patients',1),('patient_group','diabetes_clients','diabetic patients',1),
  ('patient_group','spinal_cord_injury','spinal cord injury',1),('patient_group','brain_injury','brain injury',1),
  ('patient_group','bariatric','bariatric clients',1),('patient_group','sickle_cell','sickle cell patients',1),
  ('patient_group','hiv_clients','people living with hiv',1),
  ('patient_group','respiratory_conditions','asthma and copd',0.9),
  ('language','english','english',1),('language','yoruba','yoruba',1),('language','igbo','igbo',1),
  ('language','hausa','hausa',1),('language','pidgin','pidgin english',1),('language','pidgin','broken english',0.8),
  ('language','french','french',1),('language','sign_language','sign language',1),('language','arabic','arabic',1)
ON CONFLICT DO NOTHING;
