// Controlled vocabulary for matching.
//
// Both sides of a match speak this language: a candidate's CV is normalised
// into these codes, and an opportunity's brief is normalised into the same
// codes. Anything a model returns outside this vocabulary is discarded, never
// stored. Ranking itself is deterministic SQL — the vocabulary is the only
// thing a model contributes.

export const FACET_TYPES = [
  "specialty",
  "setting",
  "skill",
  "seniority",
  "availability",
  "language",
  "patient_group",
] as const;
export type FacetType = (typeof FACET_TYPES)[number];

export const FACET_TYPE_LABELS: Record<FacetType, string> = {
  specialty: "Clinical specialty",
  setting: "Care setting",
  skill: "Skill",
  seniority: "Seniority",
  availability: "Availability",
  language: "Language",
  patient_group: "Patient group",
};

// Specialties follow NMCN and MDCN post-basic programmes, with UK Skills for
// Care and CQC domiciliary language where the Nigerian list has no equivalent.
export const SPECIALTIES = [
  "critical_care",
  "accident_emergency",
  "theatre_perioperative",
  "anaesthetics",
  "maternity_obstetrics",
  "gynaecology",
  "neonatal",
  "paediatrics",
  "geriatrics",
  "oncology",
  "haematology",
  "dialysis_renal",
  "cardiology",
  "cardiothoracic",
  "respiratory",
  "orthopaedics",
  "neurology_stroke",
  "burns_plastics",
  "urology",
  "ophthalmic",
  "ent",
  "dermatology",
  "mental_health",
  "learning_disability",
  "substance_misuse",
  "palliative_care",
  "rehabilitation",
  "physiotherapy",
  "occupational_therapy",
  "speech_language",
  "nutrition_dietetics",
  "infection_control",
  "public_health",
  "primary_care",
  "occupational_health",
  "school_health",
  "family_planning",
  "hiv_art",
  "tuberculosis",
  "tropical_infectious_disease",
  "diabetes_endocrine",
  "wound_care",
  "dementia_care",
  "post_surgical_recovery",
  "spinal_injury",
  "general_medicine",
  "general_surgery",
] as const;

export const SETTINGS = [
  "home_care",
  "live_in_care",
  "hospital_inpatient",
  "outpatient_clinic",
  "icu",
  "hdu",
  "theatre",
  "emergency_department",
  "dialysis_unit",
  "maternity_unit",
  "community",
  "phc_centre",
  "care_home",
  "hospice",
  "rehabilitation_centre",
  "school",
  "telehealth",
  "ambulance_prehospital",
  "laboratory",
  "imaging",
  "pharmacy",
  "corporate_occupational",
  "ngo_programme",
] as const;

// Clinical skills follow RCN and NMC procedural language; personal and
// domiciliary care skills follow the Skills for Care and Care Certificate
// standards used in UK home care.
export const SKILLS = [
  // Clinical procedures
  "cannulation",
  "venepuncture",
  "phlebotomy",
  "medication_administration",
  "controlled_drugs",
  "injection_administration",
  "insulin_administration",
  "iv_therapy",
  "infusion_pumps",
  "blood_transfusion",
  "wound_dressing",
  "negative_pressure_wound_therapy",
  "suturing",
  "catheterisation",
  "bladder_irrigation",
  "bowel_care",
  "stoma_care",
  "ng_tube_feeding",
  "peg_feeding",
  "tracheostomy_care",
  "suctioning",
  "oxygen_therapy",
  "nebuliser_therapy",
  "ventilator_management",
  "cpap_bipap",
  "chest_drain_care",
  "central_line_care",
  "dialysis_machine_operation",
  "ecg_monitoring",
  "cardiac_monitoring",
  "vital_signs_monitoring",
  "news2_scoring",
  "point_of_care_testing",
  "specimen_collection",
  "blood_glucose_monitoring",
  "pain_assessment",
  "wound_assessment",
  "pressure_area_care",
  "falls_risk_assessment",
  "nutritional_assessment",
  "developmental_assessment",
  // Emergency and resuscitation
  "basic_life_support",
  "advanced_life_support",
  "neonatal_resuscitation",
  "triage",
  "trauma_care",
  "emergency_obstetric_care",
  "defibrillation",
  // Maternal, neonatal and child
  "antenatal_care",
  "labour_management",
  "postnatal_care",
  "breastfeeding_support",
  "immunisation",
  "growth_monitoring",
  "kangaroo_mother_care",
  "phototherapy",
  // Personal and domiciliary care
  "personal_care",
  "bathing_showering",
  "toileting_continence",
  "dressing_grooming",
  "oral_hygiene",
  "meal_preparation",
  "feeding_assistance",
  "mobility_assistance",
  "manual_handling",
  "hoist_operation",
  "housekeeping_support",
  "shopping_errands",
  "companionship",
  "escorting_appointments",
  "sleep_night_care",
  // Condition-specific support
  "diabetes_management",
  "dementia_support",
  "behaviour_that_challenges",
  "epilepsy_seizure_management",
  "stroke_rehabilitation_support",
  "palliative_symptom_control",
  "end_of_life_care",
  "physiotherapy_exercises",
  "speech_swallow_support",
  "respite_care",
  // Governance, safety and administration
  "safeguarding",
  "infection_control_practice",
  "risk_assessment",
  "care_planning",
  "clinical_documentation",
  "electronic_health_records",
  "medication_reconciliation",
  "health_education",
  "family_education",
  "discharge_planning",
  "supervision_mentoring",
  "shift_coordination",
  "audit_quality_improvement",
  "data_reporting",
] as const;

// ISCO-08 style progression, kept short enough for a human to reason about.
export const SENIORITY = ["entry", "junior", "mid", "senior", "lead", "consultant"] as const;

export const AVAILABILITY = [
  "full_time",
  "part_time",
  "live_in",
  "day_shift",
  "night_shift",
  "weekends",
  "on_call",
  "locum_ad_hoc",
  "immediate_start",
] as const;

// Patient groups follow the ICD-11 and Skills for Care client-group framing.
export const PATIENT_GROUPS = [
  "older_adults",
  "adults",
  "young_adults",
  "children",
  "infants_neonates",
  "mothers_newborns",
  "dementia",
  "stroke_survivors",
  "palliative_end_of_life",
  "physical_disability",
  "learning_disability_clients",
  "autism",
  "mental_health_clients",
  "post_surgical",
  "chronic_illness",
  "cancer",
  "renal_failure",
  "diabetes_clients",
  "spinal_cord_injury",
  "brain_injury",
  "bariatric",
  "sickle_cell",
  "hiv_clients",
  "respiratory_conditions",
] as const;

export const LANGUAGES = [
  "english",
  "yoruba",
  "igbo",
  "hausa",
  "pidgin",
  "french",
  "efik",
  "tiv",
  "kanuri",
  "ijaw",
  "fulfulde",
  "edo",
  "urhobo",
  "ibibio",
  "idoma",
  "nupe",
  "itsekiri",
  "arabic",
  "sign_language",
] as const;

export const FACET_VOCABULARY: Record<FacetType, readonly string[]> = {
  specialty: SPECIALTIES,
  setting: SETTINGS,
  skill: SKILLS,
  seniority: SENIORITY,
  availability: AVAILABILITY,
  language: LANGUAGES,
  patient_group: PATIENT_GROUPS,
};


/** Human label for a code: critical_care -> Critical care. */
export const facetLabel = (code: string): string => {
  const s = code.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** True only for codes that exist in the vocabulary for that type. */
export const isValidFacet = (type: string, code: string): boolean =>
  (FACET_VOCABULARY as Record<string, readonly string[]>)[type]?.includes(code) ?? false;

export type FacetSource = "parsed" | "claimed" | "verified";

export const FACET_SOURCE_LABELS: Record<FacetSource, string> = {
  parsed: "Parsed from CV",
  claimed: "Confirmed by candidate",
  verified: "Verified by admin",
};

export interface Facet {
  id?: string;
  facet_type: FacetType;
  code: string;
  source: FacetSource;
  confidence: number;
  evidence?: string | null;
}

export interface OpportunityFacet {
  id?: string;
  facet_type: FacetType;
  code: string;
  requirement: "required" | "desirable";
}

export interface MatchRow {
  person_id: string;
  full_name: string;
  profession: string | null;
  years_experience: number | null;
  state: string | null;
  lga: string | null;
  score: number;
  breakdown: Record<string, unknown>;
  blockers: string[];
  matched_required: string[];
  matched_desirable: string[];
  missing_required: string[];
}
