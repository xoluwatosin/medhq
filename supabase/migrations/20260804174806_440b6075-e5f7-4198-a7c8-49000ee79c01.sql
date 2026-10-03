CREATE TABLE IF NOT EXISTS public.mu_facet_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_field text NOT NULL,
  pattern text NOT NULL,
  facet_type text NOT NULL,
  code text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0.7,
  note text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_field, pattern, facet_type, code)
);

GRANT SELECT ON public.mu_facet_keywords TO authenticated;
GRANT ALL ON public.mu_facet_keywords TO service_role;
ALTER TABLE public.mu_facet_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage facet keywords" ON public.mu_facet_keywords
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS mu_facet_keywords_updated_at ON public.mu_facet_keywords;
CREATE TRIGGER mu_facet_keywords_updated_at BEFORE UPDATE ON public.mu_facet_keywords
  FOR EACH ROW EXECUTE FUNCTION public.matchmaker_set_updated_at();

DELETE FROM public.mu_facet_keywords;

INSERT INTO public.mu_facet_keywords (source_field, pattern, facet_type, code, confidence, note) VALUES
-- ---------- certifications -> skills ----------
('certifications','(^|[^a-z])(bls|b\.l\.s)([^a-z]|$)|basic life support','skill','basic_life_support',0.9,'BLS certificate'),
('certifications','(^|[^a-z])cpr([^a-z]|$)|cardiopulmonary resuscitation|(^|[^a-z])aed([^a-z]|$)','skill','basic_life_support',0.8,'CPR/AED'),
('certifications','first aid','skill','basic_life_support',0.65,'First aid only'),
('certifications','(^|[^a-z])(acls|atls|itls|pals|tls)([^a-z]|$)|advanced (cardiac|cardiovascular|trauma|paediatric|pediatric) life support|trauma life support','skill','advanced_life_support',0.9,'ACLS/ATLS/PALS'),
('certifications','phlebotom|venepunct|venipunct','skill','phlebotomy',0.85,NULL),
('certifications','(^|[^a-z])(ecg|ekg)([^a-z]|$)|electrocardiog','skill','ecg_monitoring',0.85,NULL),
('certifications','cannulat','skill','cannulation',0.85,NULL),
('certifications','wound (care|management|dressing)','skill','wound_dressing',0.8,NULL),
('certifications','triage','skill','triage',0.8,NULL),
('certifications','safeguard|child protection','skill','safeguarding',0.8,NULL),
('certifications','manual handling|moving and handling','skill','manual_handling',0.8,NULL),
('certifications','medication (administration|management)','skill','medication_administration',0.8,NULL),
('certifications','ventilat','skill','ventilator_management',0.8,NULL),
('certifications','tracheostom','skill','tracheostomy_care',0.8,NULL),
('certifications','catheter','skill','catheterisation',0.8,NULL),
('certifications','(intravenous|iv) (therapy|infusion)|infusion pump','skill','iv_therapy',0.8,NULL),
-- ---------- certifications -> specialties / settings ----------
('certifications','infection (prevention|control)|hand hygiene|ipc training','specialty','infection_control',0.8,NULL),
('certifications','neonatal resuscitation|(^|[^a-z])nrp([^a-z]|$)','specialty','neonatal',0.8,NULL),
('certifications','(^|[^a-z])imci([^a-z]|$)|integrated management of childhood','specialty','paediatrics',0.8,NULL),
('certifications','midwif|(^|[^a-z])rm([^a-z]|$)','specialty','maternity_obstetrics',0.75,NULL),
('certifications','public health nurs|(^|[^a-z])rphn([^a-z]|$)','specialty','public_health',0.8,NULL),
('certifications','psychiatr|mental health','specialty','mental_health',0.75,NULL),
('certifications','nephrolog|dialysis|renal','specialty','dialysis_renal',0.8,NULL),
('certifications','oncolog|chemotherap','specialty','oncology',0.8,NULL),
('certifications','palliative|hospice','specialty','palliative_care',0.8,NULL),
('certifications','dementia|alzheim','specialty','dementia_care',0.8,NULL),
('certifications','diabet','specialty','diabetes_endocrine',0.75,NULL),
('certifications','(theatre|theater|operating room|operating theatre|periopera|peri-opera|scrub nurse|anaesthetic nurse|anesthetic nurse)','specialty','theatre_perioperative',0.85,'Theatre wording only, never medical-surgical'),
('certifications','emergency care provider|emergency (and|&) disaster|(^|[^a-z])a&e([^a-z]|$)|accident (and|&) emergency','specialty','accident_emergency',0.75,NULL),
('certifications','(intensive care|critical care|(^|[^a-z])icu([^a-z]|$))','specialty','critical_care',0.85,NULL),
-- ---------- specialisms / clinical_skills -> specialties ----------
('specialisms','(intensive care|critical care|(^|[^a-z])icu([^a-z]|$))','specialty','critical_care',0.7,NULL),
('specialisms','accident (and|&) emergency|(^|[^a-z])a&e([^a-z]|$)|emergency (unit|room|care|nursing|department)|(^|[^a-z])er([^a-z]|$)','specialty','accident_emergency',0.7,NULL),
('specialisms','(theatre|theater|operating room|operating theatre|periopera|peri-opera|scrub nurse|anaesthetic nurse|anesthetic nurse)','specialty','theatre_perioperative',0.75,'Theatre wording only; medical-surgical excluded'),
('specialisms','post[- ]?operative|post[- ]?surgical|surgical recovery|recovery (room|unit)','specialty','post_surgical_recovery',0.7,NULL),
('specialisms','medical[- ]surgical|med[- ]surg|medical ward|general nursing|general medicine','specialty','general_medicine',0.7,'Medical-surgical is general medicine, not theatre'),
('specialisms','matern|obstetri|labou?r ward|antenatal|postnatal|midwif|gyna?ecolog','specialty','maternity_obstetrics',0.7,NULL),
('specialisms','neonat|(^|[^a-z])nicu([^a-z]|$)|newborn','specialty','neonatal',0.7,NULL),
('specialisms','p(a)?ediatric|child health','specialty','paediatrics',0.7,NULL),
('specialisms','geriatric|elderly|older adult|aged care','specialty','geriatrics',0.7,NULL),
('specialisms','oncolog|chemotherap|cancer','specialty','oncology',0.7,NULL),
('specialisms','dialysis|nephrolog|renal','specialty','dialysis_renal',0.7,NULL),
('specialisms','cardiolog|cardiac|coronary','specialty','cardiology',0.7,NULL),
('specialisms','orthopa?edic|ortho ward','specialty','orthopaedics',0.7,NULL),
('specialisms','mental health|psychiatr','specialty','mental_health',0.7,NULL),
('specialisms','palliative|hospice|end of life','specialty','palliative_care',0.7,NULL),
('specialisms','rehabilitat|physiotherap','specialty','rehabilitation',0.7,NULL),
('specialisms','infection (prevention|control)|hand hygiene','specialty','infection_control',0.7,NULL),
('specialisms','public health|community health nursing|epidemiolog','specialty','public_health',0.7,NULL),
('specialisms','primary (care|health care)|gopd|outpatient (services|clinic|department)','specialty','primary_care',0.7,NULL),
('specialisms','diabet|endocrin','specialty','diabetes_endocrine',0.7,NULL),
('specialisms','wound (care|management|dressing)|tissue viability','specialty','wound_care',0.7,NULL),
('specialisms','dementia|alzheim','specialty','dementia_care',0.7,NULL),
('specialisms','home (care|nursing)|domicil|live[- ]in care','setting','home_care',0.7,NULL),
('specialisms','community health|community nursing','setting','community',0.7,NULL),
('specialisms','telehealth|telemedicine|virtual (care|assistant)','setting','telehealth',0.7,NULL),
('specialisms','ward|inpatient|hospital','setting','hospital_inpatient',0.65,NULL),
('specialisms','care home|nursing home|residential care','setting','care_home',0.7,NULL),
('specialisms','ambulance|pre[- ]?hospital|paramedic','setting','ambulance_prehospital',0.7,NULL),
('specialisms','laborator|(^|[^a-z])lab([^a-z]|$)|microbiolog','setting','laboratory',0.65,NULL),
('specialisms','pharmac','setting','pharmacy',0.7,NULL),
('specialisms','occupational health|corporate health','setting','corporate_occupational',0.7,NULL),
-- ---------- clinical_skills -> skills ----------
('clinical_skills','cannulat','skill','cannulation',0.75,NULL),
('clinical_skills','phlebotom|venepunct|venipunct','skill','phlebotomy',0.75,NULL),
('clinical_skills','medication (administration|management)|drug administration','skill','medication_administration',0.75,NULL),
('clinical_skills','(intravenous|iv) (therapy|infusion)','skill','iv_therapy',0.75,NULL),
('clinical_skills','wound (care|dressing|management)','skill','wound_dressing',0.75,NULL),
('clinical_skills','catheter','skill','catheterisation',0.75,NULL),
('clinical_skills','(ng|nasogastric) tube|enteral feed','skill','ng_tube_feeding',0.75,NULL),
('clinical_skills','tracheostom','skill','tracheostomy_care',0.75,NULL),
('clinical_skills','ventilat','skill','ventilator_management',0.75,NULL),
('clinical_skills','(^|[^a-z])(ecg|ekg)([^a-z]|$)|electrocardiog','skill','ecg_monitoring',0.75,NULL),
('clinical_skills','vital signs|observations|monitoring of vitals','skill','vital_signs_monitoring',0.75,NULL),
('clinical_skills','(^|[^a-z])(bls|cpr|aed)([^a-z]|$)|basic life support','skill','basic_life_support',0.8,NULL),
('clinical_skills','(^|[^a-z])(acls|atls|pals)([^a-z]|$)|advanced (cardiac|cardiovascular|life)','skill','advanced_life_support',0.8,NULL),
('clinical_skills','manual handling|moving and handling','skill','manual_handling',0.75,NULL),
('clinical_skills','personal care|activities of daily living|(^|[^a-z])adl','skill','personal_care',0.75,NULL),
('clinical_skills','stoma','skill','stoma_care',0.75,NULL),
('clinical_skills','pressure (area|ulcer|sore)','skill','pressure_area_care',0.75,NULL),
('clinical_skills','diabet','skill','diabetes_management',0.75,NULL),
('clinical_skills','physiotherap|mobility exercise','skill','physiotherapy_exercises',0.75,NULL),
('clinical_skills','care plan','skill','care_planning',0.75,NULL),
('clinical_skills','documentation|record keeping|charting','skill','clinical_documentation',0.75,NULL),
('clinical_skills','triage','skill','triage',0.75,NULL),
('clinical_skills','infusion pump','skill','infusion_pumps',0.75,NULL),
('clinical_skills','oxygen therapy','skill','oxygen_therapy',0.75,NULL),
('clinical_skills','symptom control|palliative','skill','palliative_symptom_control',0.75,NULL),
('clinical_skills','safeguard','skill','safeguarding',0.75,NULL),
('clinical_skills','(patient|family) (education|teaching)|health education','skill','family_education',0.75,NULL),
-- ---------- languages ----------
('languages','english','language','english',0.9,NULL),
('languages','yoruba','language','yoruba',0.9,NULL),
('languages','igbo|ibo','language','igbo',0.9,NULL),
('languages','hausa','language','hausa',0.9,NULL),
('languages','pidgin','language','pidgin',0.9,NULL),
('languages','french','language','french',0.9,NULL),
('languages','efik','language','efik',0.9,NULL),
('languages','(^|[^a-z])tiv([^a-z]|$)','language','tiv',0.9,NULL),
('languages','kanuri','language','kanuri',0.9,NULL),
('languages','ijaw|izon','language','ijaw',0.9,NULL),
('languages','fulfulde|fulani','language','fulfulde',0.9,NULL),
('languages','(^|[^a-z])edo([^a-z]|$)|bini','language','edo',0.9,NULL),
('languages','urhobo','language','urhobo',0.9,NULL),
('languages','ibibio','language','ibibio',0.9,NULL),
-- ---------- availability ----------
('availability','full[- ]?time','availability','full_time',0.8,NULL),
('availability','part[- ]?time','availability','part_time',0.8,NULL),
('availability','live[- ]?in','availability','live_in',0.8,NULL),
('availability','day shift|days only','availability','day_shift',0.8,NULL),
('availability','night shift|nights','availability','night_shift',0.8,NULL),
('availability','weekend','availability','weekends',0.8,NULL),
('availability','on[- ]?call','availability','on_call',0.8,NULL),
('availability','locum|ad[- ]?hoc|as needed|prn','availability','locum_ad_hoc',0.8,NULL),
('availability','immediate','availability','immediate_start',0.8,NULL),
-- ---------- seniority from current position ----------
('current_position','consultant','seniority','consultant',0.7,NULL),
('current_position','chief|principal|matron|head of|unit manager|nurse manager','seniority','lead',0.7,NULL),
('current_position','senior','seniority','senior',0.7,NULL),
('current_position','(^|[^a-z])(intern|student|trainee|assistant|nysc|corps member)','seniority','entry',0.7,NULL);

-- Rebuild automatically derived facets from parsed CV fields using the table above.
CREATE OR REPLACE FUNCTION public.mu_rebuild_parsed_facets(_person_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  removed int := 0;
  added int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  DELETE FROM public.mu_profile_facets f
   WHERE f.source = 'parsed'
     AND (_person_id IS NULL OR f.person_id = _person_id);
  GET DIAGNOSTICS removed = ROW_COUNT;

  WITH hits AS (
    SELECT DISTINCT ON (pf.person_id, k.facet_type, k.code)
           pf.person_id,
           k.facet_type,
           k.code,
           k.confidence,
           left(k.source_field || ': ' || pf.value, 240) AS evidence,
           pf.document_id,
           pf.model
      FROM public.mu_parsed_fields pf
      JOIN public.mu_facet_keywords k
        ON k.active
       AND k.source_field = pf.field
       AND pf.value IS NOT NULL
       AND pf.value ~* k.pattern
     WHERE (_person_id IS NULL OR pf.person_id = _person_id)
       AND pf.status <> 'rejected'
     ORDER BY pf.person_id, k.facet_type, k.code, k.confidence DESC
  )
  INSERT INTO public.mu_profile_facets (person_id, facet_type, code, source, confidence, evidence, document_id, model)
  SELECT h.person_id, h.facet_type, h.code, 'parsed', h.confidence, h.evidence, h.document_id, h.model
    FROM hits h
   WHERE NOT EXISTS (
     SELECT 1 FROM public.mu_profile_facets e
      WHERE e.person_id = h.person_id AND e.facet_type = h.facet_type AND e.code = h.code
        AND e.source IN ('claimed','verified')
   );
  GET DIAGNOSTICS added = ROW_COUNT;

  RETURN jsonb_build_object('removed', removed, 'added', added, 'scope', coalesce(_person_id::text, 'all'));
END;
$function$;

REVOKE ALL ON FUNCTION public.mu_rebuild_parsed_facets(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mu_rebuild_parsed_facets(uuid) TO authenticated, service_role;

SELECT public.mu_rebuild_parsed_facets(NULL);