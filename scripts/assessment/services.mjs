// The service-specific clinical modules of the professional assessment.
//
// A module opens from the service the client is being assessed for. Nothing
// else opens it, so an assessor never sees a module that does not apply.
import { opts, q, section } from "../pre-assessment/kit.mjs";

const A = { assessorOnly: true };
const req = { assessorOnly: true, required: true };

const yn = (id, record, asked, extra = {}) =>
  q(id, record, asked, "yes_no", { ...A, ...extra });

const antenatal = section("a_mod_antenatal", "Antenatal", { module: "m_svc_antenatal" }, [
  q("at_gestation", "Gestation in weeks", "Gestation in weeks", "number", req),
  q("at_edd", "Expected date of delivery", "Expected date of delivery", "date", req),
  q("at_obstetric", "Obstetric history", "Obstetric history", "long_text", req),
  q("at_risk_factors", "High-risk factors", "High-risk factors present", "multi", {
    ...A,
    options: opts([
      "hypertension|Raised blood pressure", "pre_eclampsia|Pre-eclampsia", "diabetes|Diabetes in pregnancy",
      "anaemia|Anaemia", "multiple|Multiple pregnancy", "previous_section|Previous caesarean",
      "bleeding|Bleeding", "infection|Infection", "none|None identified|x",
    ]),
    routes: { to: "clinical_lead", unless: ["none", "previous_section"] },
  }),
  q("at_concerns", "Current concerns", "Current concerns", "long_text", A),
  q("at_obs", "Maternal observations", "Maternal observations where indicated", "measurement", {
    ...A,
    measures: [
      { key: "systolic", label: "Blood pressure, systolic", unit: "mmHg" },
      { key: "diastolic", label: "Blood pressure, diastolic", unit: "mmHg" },
      { key: "pulse", label: "Pulse", unit: "bpm" },
      { key: "temperature", label: "Temperature", unit: "°C" },
      { key: "weight", label: "Weight", unit: "kg" },
    ],
  }),
  q("at_clinic_plan", "Antenatal clinic or consultant plan",
    "Antenatal clinic or consultant plan", "long_text", A),
  q("at_supplements", "Medicines and supplements", "Medicines and supplements", "long_text", A),
  q("at_nutrition", "Nutrition and anaemia", "Nutrition and anaemia", "long_text", A),
  q("at_birth_prep", "Birth preparation", "Birth preparation", "long_text", A),
  q("at_wellbeing", "Mental wellbeing", "Mental wellbeing", "long_text", A),
  q("at_home_support", "Home and social support", "Home and social support", "long_text", A),
  q("at_post_birth", "Post-birth planning", "Post-birth planning", "long_text", A),
  q("at_escalate", "Immediate escalation findings", "Immediate escalation findings", "long_text", A),
]);

const postnatal = section("a_mod_postnatal", "Postnatal and newborn", { module: "m_svc_postnatal" }, [
  q("pn_delivery", "Delivery and recovery", "Delivery and recovery", "long_text", req),
  q("pn_wound", "Wound or perineum", "Wound or perineum", "long_text", A),
  q("pn_bleeding", "Bleeding", "Bleeding", "long_text", A),
  q("pn_pain", "Pain", "Pain", "long_text", A),
  q("pn_obs", "Maternal observations", "Maternal observations", "measurement", {
    ...A,
    measures: [
      { key: "temperature", label: "Temperature", unit: "°C" },
      { key: "pulse", label: "Pulse", unit: "bpm" },
      { key: "systolic", label: "Blood pressure, systolic", unit: "mmHg" },
      { key: "diastolic", label: "Blood pressure, diastolic", unit: "mmHg" },
    ],
  }),
  q("pn_warning", "Warning signs of infection or clot",
    "Warning signs of infection or clot present", "multi", {
      ...A,
      options: opts([
        "fever|Fever", "offensive_lochia|Offensive discharge", "calf_pain|Calf pain or swelling",
        "breathlessness|Breathlessness", "headache|Severe headache", "none|None|x",
      ]),
      routes: { to: "clinical_lead", unless: ["none"], sameDay: true },
    }),
  q("pn_feeding_mother", "Feeding experience", "Feeding experience", "long_text", A),
  q("pn_sleep", "Sleep", "Sleep", "long_text", A),
  q("pn_emotional", "Emotional wellbeing", "Emotional wellbeing", "long_text", req),
  q("pn_support", "Support at home", "Support at home", "long_text", A),
  q("nb_age", "Baby's age in days", "Baby's age in days", "number", req),
  q("nb_gestation", "Gestation at birth in weeks", "Gestation at birth in weeks", "number", A),
  q("nb_feeding", "Feeding assessment", "Feeding assessment", "long_text", req),
  q("nb_weight", "Weight and trend", "Weight and trend", "measurement", {
    ...A, measures: [{ key: "weight", label: "Weight", unit: "kg" }],
  }),
  q("nb_output", "Hydration and output", "Wet and dirty nappies in the last day", "long_text", A),
  q("nb_jaundice", "Jaundice", "Jaundice", "choice", {
    ...A,
    options: opts(["none|None seen", "mild|Mild", "marked|Marked", "not_assessed|Not assessed"]),
    routes: { to: "clinical_lead", unless: ["none", "mild", "not_assessed"], sameDay: true },
  }),
  q("nb_temp_breathing", "Temperature and breathing", "Temperature and breathing", "long_text", A),
  q("nb_cord", "Cord and skin", "Cord and skin", "long_text", A),
  q("nb_checks", "Newborn checks completed", "Newborn checks completed", "long_text", A),
  q("nb_safe_sleep", "Safe sleep and handling", "Safe sleep and handling", "long_text", req),
  q("nb_immunisation", "Immunisation and follow-up", "Immunisation and follow-up", "long_text", A),
  q("nb_escalation", "Escalation signs explained to the family",
    "Escalation signs explained to the family", "long_text", req),
]);

const postSurgical = section("a_mod_post_surgical", "Post-surgical", { module: "m_svc_post_surgical" }, [
  q("ps_procedure", "Procedure and date", "Procedure and date", "text", req),
  q("ps_discharge", "Discharge instructions", "Discharge instructions", "long_text", req),
  q("ps_wound_device", "Wound, drain or device", "Wound, drain or device", "long_text", A),
  q("ps_warning", "Warning signs", "Warning signs present", "multi", {
    ...A,
    options: opts([
      "infection|Infection", "vte|Clot or calf pain", "respiratory|Breathing difficulty",
      "bleeding|Bleeding", "wound_breakdown|Wound breakdown", "none|None|x",
    ]),
    routes: { to: "clinical_lead", unless: ["none"], sameDay: true },
  }),
  q("ps_pain", "Pain and its control", "Pain and its control", "long_text", A),
  q("ps_mobility", "Mobility and restrictions", "Mobility and restrictions", "long_text", req),
  q("ps_nutrition", "Nutrition and elimination", "Nutrition and elimination", "long_text", A),
  q("ps_medicines", "Medicines after surgery", "Medicines after surgery", "long_text", A),
  q("ps_rehab", "Rehabilitation", "Rehabilitation", "long_text", A),
  q("ps_equipment", "Equipment", "Equipment", "long_text", A),
  q("ps_followup", "Follow-up", "Follow-up", "long_text", A),
  q("ps_interventions", "Required nursing interventions",
    "Required nursing interventions", "long_text", req),
]);

const eldercare = section("a_mod_eldercare", "Eldercare", { module: "m_svc_eldercare" }, [
  q("el_function", "Function and independence", "Function and independence", "long_text", req),
  q("el_frailty", "Frailty indicators", "Frailty indicators observed", "multi", {
    ...A,
    options: opts([
      "slow_walking|Slower walking", "weight_loss|Unintended weight loss", "exhaustion|Exhaustion",
      "low_activity|Low activity", "weakness|Weakness", "none|None observed|x",
    ]),
  }),
  q("el_cognition", "Cognition and delirium", "Cognition and delirium", "long_text", A),
  q("el_falls", "Falls", "Falls", "long_text", A),
  q("el_nutrition", "Nutrition", "Nutrition", "long_text", A),
  q("el_continence", "Continence", "Continence", "long_text", A),
  q("el_skin", "Skin", "Skin", "long_text", A),
  q("el_polypharmacy", "Polypharmacy", "Polypharmacy", "long_text", A),
  q("el_social", "Loneliness and social participation", "Loneliness and social participation", "long_text", A),
  q("el_carer", "Carer sustainability", "Carer sustainability", "long_text", A),
  q("el_advance", "Advance preferences volunteered",
    "Advance preferences, only where volunteered", "long_text", A),
]);

const clinical = section("a_mod_clinical", "Clinical home care", { module: "m_svc_clinical" }, [
  q("cl_submodules", "Clinical care required", "Which clinical care is required?", "multi", {
    ...req,
    options: opts([
      "wound|Wound care", "injection|Injections or infusions", "diabetes|Diabetes care",
      "respiratory|Respiratory or oxygen", "catheter|Catheter or stoma", "peg|PEG or enteral feeding",
      "neuro|Complex neurological care", "trache|Tracheostomy or ventilation",
      "physio|Physiotherapy or rehabilitation", "chronic|Chronic disease support",
      "palliative|Palliative or end-of-life care",
    ]),
  }),
  q("cl_wound", "Wound care instruction", "Authorised wound care instruction", "long_text", {
    ...A, showWhen: { field: "cl_submodules", contains: ["wound"] },
  }),
  q("cl_injection", "Injection or infusion instruction",
    "Authorised injection or infusion instruction", "long_text", {
      ...A, showWhen: { field: "cl_submodules", contains: ["injection"] },
    }),
  q("cl_diabetes", "Diabetes care", "Monitoring, insulin and hypoglycaemia plan", "long_text", {
    ...A, showWhen: { field: "cl_submodules", contains: ["diabetes"] },
  }),
  q("cl_respiratory", "Respiratory or oxygen care",
    "Oxygen prescription, equipment and safety", "long_text", {
      ...A, showWhen: { field: "cl_submodules", contains: ["respiratory"] },
    }),
  q("cl_catheter", "Catheter or stoma care", "Catheter or stoma care", "long_text", {
    ...A, showWhen: { field: "cl_submodules", contains: ["catheter"] },
  }),
  q("cl_peg", "PEG or enteral feeding", "Regimen, pump, flushes and escalation", "long_text", {
    ...A, showWhen: { field: "cl_submodules", contains: ["peg"] },
  }),
  q("cl_neuro", "Complex neurological care", "Complex neurological care", "long_text", {
    ...A, showWhen: { field: "cl_submodules", contains: ["neuro"] },
  }),
  q("cl_trache", "Tracheostomy or ventilation",
    "Tube, suction, humidification, emergency equipment and competence", "long_text", {
      ...A, showWhen: { field: "cl_submodules", contains: ["trache"] },
      routes: { to: "clinical_lead", unless: [] },
    }),
  q("cl_physio", "Physiotherapy or rehabilitation programme",
    "Programme and who authorised it", "long_text", {
      ...A, showWhen: { field: "cl_submodules", contains: ["physio"] },
    }),
  q("cl_chronic", "Chronic disease support", "Chronic disease support", "long_text", {
    ...A, showWhen: { field: "cl_submodules", contains: ["chronic"] },
  }),
  q("cl_palliative", "Palliative or end-of-life care",
    "Symptom control, preferences and agreed plan", "long_text", {
      ...A, showWhen: { field: "cl_submodules", contains: ["palliative"] },
    }),
  q("cl_authorised_by", "Who authorised the clinical instruction",
    "Who authorised the clinical instruction?", "text", req),
  q("cl_competence", "Competence required of the professional",
    "Competence required of the professional", "long_text", req),
  q("cl_supplies", "Supplies and equipment", "Supplies and equipment", "long_text", req),
  q("cl_monitoring", "Monitoring required", "Monitoring required", "long_text", req),
  q("cl_escalation", "Escalation thresholds and contacts",
    "Escalation thresholds and contacts", "long_text", req),
  q("cl_frequency", "Visit frequency required", "Visit frequency required", "long_text", req),
]);

const nanny = section("a_mod_nanny", "Nanny and childcare", { module: "m_svc_nanny" }, [
  q("nn_children", "Children", "Each child", "repeatable", {
    ...req, items: ["First name", "Last name", "Date of birth", "Developmental context"],
  }),
  q("nn_health", "Health, allergies and medicines", "Health, allergies and medicines", "long_text", req),
  q("nn_feeding", "Feeding and meals", "Feeding and meals", "long_text", A),
  q("nn_sleep", "Sleep and naps", "Sleep and naps", "long_text", A),
  q("nn_toileting", "Toileting and routines", "Toileting and routines", "long_text", A),
  q("nn_communication", "How each child communicates", "How each child communicates", "long_text", A),
  q("nn_school", "Nursery or school and authorised collection",
    "Nursery or school, and who may collect", "repeatable", {
      ...A, items: ["Setting", "Hours", "Authorised to collect", "Contact"],
    }),
  q("nn_interests", "Interests and activities", "Interests and activities", "long_text", A),
  q("nn_safeguarding", "Safeguarding and supervision",
    "Safeguarding and supervision requirements", "long_text", req),
  q("nn_household", "Household context", "Household context", "long_text", A),
  q("nn_duties", "Expected duties and boundaries", "Expected duties and boundaries", "long_text", req),
  q("nn_emergency", "Emergency contacts", "Emergency contacts", "repeatable", {
    ...req, items: ["Order", "Name", "Relationship", "Contact"],
  }),
  q("nn_capability", "Nanny capability requirements",
    "Capability requirements for the nanny", "long_text", req),
]);

const additional = section("a_mod_additional", "Children with additional needs",
  { module: "m_svc_additional" }, [
    q("nd_strengths", "Strengths, interests and family priorities",
      "Strengths, interests and family priorities", "long_text", req),
    q("nd_diagnosis", "Diagnosis or assessment status", "Diagnosis or assessment status", "long_text", A),
    q("nd_communication", "Communication and AAC", "Communication and any AAC", "long_text", req),
    q("nd_mobility", "Functional mobility", "Functional mobility", "long_text", A),
    q("nd_personal_care", "Personal care", "Personal care", "long_text", A),
    q("nd_eating", "Eating, drinking and swallowing", "Eating, drinking and swallowing", "long_text", A),
    q("nd_sensory", "Sensory profile", "Sensory profile", "long_text", A),
    q("nd_distress", "Observable distress and what helps",
      "What is seen, what it may communicate, and what helps", "long_text", A),
    q("nd_seizures", "Seizures and rescue plan", "Seizures and rescue plan", "long_text", {
      ...A, help: "Attach the authorised rescue plan where one exists.",
    }),
    q("nd_medicines", "Medicines", "Medicines specific to the child's needs", "long_text", A),
    q("nd_equipment", "Equipment", "Equipment", "long_text", A),
    q("nd_sleep", "Sleep", "Sleep", "long_text", A),
    q("nd_school", "School and therapies", "School and therapies", "long_text", A),
    q("nd_safety", "Safety", "Safety", "long_text", req),
    q("nd_plans", "Professional plans held", "Professional plans held", "upload", A),
    q("nd_participation", "Participation goals", "Participation goals", "long_text", req),
    q("nd_worker", "Capabilities required of the worker",
      "Capabilities required of the worker", "long_text", req),
  ]);

export const SERVICE_SECTIONS = [
  antenatal, postnatal, postSurgical, eldercare, clinical, nanny, additional,
];

/** A service module opens from the service alone. Nothing else opens it. */
export const MODULE_RULES = {
  m_svc_antenatal: { always: ["antenatal"] },
  m_svc_postnatal: { always: ["postnatal"] },
  m_svc_post_surgical: { always: ["post_surgical"] },
  m_svc_eldercare: { always: ["eldercare"] },
  m_svc_clinical: { always: ["clinical_home_care"] },
  m_svc_nanny: { always: ["nanny"] },
  m_svc_additional: { always: ["additional_needs"] },
};
