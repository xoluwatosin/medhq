// The universal part of the professional assessment.
//
// Source: Medic Connect Professional Assessment Specification, 13 September
// 2026. Every question here is asked by the assessor at the visit. Family
// answers are never repeated as the assessor's own: they are carried into the
// evidence section and confirmed or amended there.
import { opts, q, yesNo, section } from "../pre-assessment/kit.mjs";

const A = { assessorOnly: true };
const req = { assessorOnly: true, required: true };

const yn = (id, record, asked, extra = {}) =>
  q(id, record, asked, "yes_no", { ...A, ...extra });

const SUPPORT_LEVELS = opts([
  "independent|Independent",
  "equipment|Needs equipment or an adaptation",
  "prompting|Needs prompting",
  "some_help|Needs some physical assistance",
  "full_help|Needs full assistance",
  "not_assessed|Not assessed or not applicable",
]);

/** Carried family answers. Each one is confirmed or amended by the assessor. */
const evidence = {
  id: "pre_assessment_review",
  title: "What the family told us",
  when: "always",
  mode: "confirm_amend",
  intro: "Each answer given before the visit is confirmed or amended. Amending never changes what the family sent.",
  fields: [],
};

const visit = section("a_visit", "Visit and identity", "always", [
  q("av_setting", "Assessment setting", "Where is this assessment taking place?", "choice", {
    ...req,
    options: opts(["home|At home", "hospital|In hospital", "remote|Remotely", "other|Somewhere else"]),
  }),
  q("av_setting_other", "Setting detail", "Where exactly?", "text", {
    ...A, showWhen: { field: "av_setting", in: ["other"] },
  }),
  q("av_started_at", "Assessment date", "Date of the visit", "date", req),
  q("av_recipient_name", "Recipient name as confirmed at the visit",
    "Recipient's first and last name, as given at the visit", "person_name", req),
  q("av_dob", "Date of birth confirmed at the visit", "Date of birth", "date", req),
  q("av_preferred_name", "Preferred name", "Preferred name", "text", A),
  q("av_pronouns", "Pronouns", "Pronouns", "text", A),
  q("av_present", "People present", "Who was present?", "repeatable", {
    ...req, items: ["Name", "Relationship", "Role at the visit"],
  }),
  yn("av_interpreter", "Interpreter or communication support used",
    "Was an interpreter or communication support used?"),
  q("av_interpreter_detail", "Communication support detail", "What support was used?", "text", {
    ...A, showWhen: { field: "av_interpreter", in: ["yes"] },
  }),
  q("av_other_sources", "Others who contributed information",
    "Who else contributed information?", "repeatable", {
      ...A, items: ["Name", "Role", "What they contributed"],
    }),
]);

const consent = section("a_consent", "Consent, decision-making and participation", "always", [
  q("ac_decision", "Ability to make this decision now",
    "Can the person understand, retain, weigh and communicate this decision at this time?", "choice", {
      ...req,
      options: opts([
        "yes|Yes",
        "with_support|Yes, with support",
        "unclear|Unclear, further review required",
        "no|No, for this decision",
        "not_applicable|Not applicable, a young child",
      ]),
      routes: { to: "clinical_lead", unless: ["yes", "with_support", "not_applicable"] },
      help: "Never inferred from age, diagnosis, disability, communication method or family involvement.",
    }),
  q("ac_support_used", "Support used to enable participation",
    "What was done to enable the person to take part?", "long_text", A),
  q("ac_own_account", "The person's own account and preferences",
    "In the person's own words, what do they want?", "long_text", A),
  q("ac_representative", "Representative and basis for involvement",
    "Who is acting for the person, and on what basis?", "repeatable", {
      ...A, items: ["Name", "Relationship", "Basis for involvement"],
    }),
  yn("ac_consent_assessment", "Consent to the assessment",
    "Did the person or their representative consent to this assessment?", { required: true }),
  q("ac_sharing", "Basis for sharing information",
    "What is the consent or other basis for sharing information?", "long_text", { ...A, required: true }),
  yn("ac_disagreement", "Disagreement recorded", "Is there disagreement between the person and others?"),
  q("ac_disagreement_detail", "What the disagreement is", "What is the disagreement?", "long_text", {
    ...A, showWhen: { field: "ac_disagreement", in: ["yes"] },
  }),
  q("ac_immediate", "Immediate action required before continuing",
    "Was any immediate action required before continuing?", "long_text", A),
]);

const situation = section("a_situation", "Presenting situation and outcomes", "always", [
  q("as_why_now", "What has led to the assessment now", "What has led to this assessment now?", "long_text", req),
  q("as_changed", "What has changed recently", "What has changed recently?", "long_text", A),
  q("as_independent", "What the person can do independently",
    "What can the person currently do without help?", "long_text", req),
  q("as_current_help", "Help currently provided", "What help is provided now, and by whom?", "long_text", A),
  q("as_matters", "What matters most to the person", "What matters most to the person?", "long_text", req),
  q("as_good_day", "What a good day looks like", "What would a good day look like?", "long_text", A),
  q("as_hopes", "What the person wants to maintain, regain or achieve",
    "What would the person or family like to maintain, regain or achieve?", "long_text", req),
  q("as_without", "Likely outcome without support",
    "What is likely to happen without support?", "long_text", A),
  q("as_priority", "Assessor's summary of priority needs",
    "Summary of the priority needs", "long_text", req),
]);

const health = section("a_health", "Health and clinical history", "always", [
  q("ah_diagnoses", "Diagnoses and status", "Diagnoses and their current status", "repeatable", {
    ...req, items: ["Diagnosis", "Since", "Status"],
  }),
  q("ah_admissions", "Recent admissions, surgery and discharge",
    "Recent admissions, surgery or discharge", "long_text", A),
  q("ah_symptoms", "Current symptoms and changes", "Current symptoms and any change", "long_text", A),
  q("ah_history", "Relevant past history", "Relevant past history", "long_text", A),
  q("ah_infection", "Infection status or precautions",
    "Any infection status or precautions known?", "long_text", A),
  q("ah_clinicians", "Treating clinicians and their instructions",
    "Treating clinicians and their instructions", "repeatable", {
      ...A, items: ["Clinician or service", "Contact", "Instruction"],
    }),
  q("ah_appointments", "Appointments and follow-up", "Appointments and follow-up", "long_text", A),
  q("ah_devices", "Clinical devices in use", "Clinical devices in use", "repeatable", {
    ...A, items: ["Device", "Since", "Who manages it"],
  }),
  yn("ah_observations_taken", "Observations taken", "Were observations clinically indicated and taken today?"),
  q("ah_observations", "Baseline observations", "Observations recorded today", "measurement", {
    ...A,
    showWhen: { field: "ah_observations_taken", in: ["yes"] },
    measures: [
      { key: "temperature", label: "Temperature", unit: "°C" },
      { key: "pulse", label: "Pulse", unit: "bpm" },
      { key: "respiratory_rate", label: "Respiratory rate", unit: "breaths/min" },
      { key: "spo2", label: "Oxygen saturation", unit: "%" },
      { key: "systolic", label: "Blood pressure, systolic", unit: "mmHg" },
      { key: "diastolic", label: "Blood pressure, diastolic", unit: "mmHg" },
      { key: "glucose", label: "Blood glucose", unit: "mmol/L" },
      { key: "weight", label: "Weight", unit: "kg" },
    ],
  }),
  q("ah_observation_context", "Observation context",
    "Position, cuff, device, oxygen and timing context for the observations", "long_text", {
      ...A, showWhen: { field: "ah_observations_taken", in: ["yes"] },
    }),
  q("ah_pain_score", "Pain now, 0 to 10", "Pain now, where 0 is no pain and 10 is the worst pain imaginable",
    "number", { ...A, help: "0 no pain, 10 worst pain imaginable." }),
  q("ah_pain_site", "Pain site", "Where is the pain?", "text", A),
  q("ah_red_flags", "Red flags present today", "Any red flags present today?", "multi", {
    ...A,
    options: opts([
      "breathing|Breathing difficulty", "chest_pain|Chest pain", "bleeding|Bleeding",
      "sepsis|Signs of sepsis", "confusion|New confusion", "unresponsive|Reduced consciousness",
      "fall_injury|Injury from a fall", "none|None today|x",
    ]),
    routes: { to: "clinical_lead", unless: ["none"], sameDay: true },
  }),
]);

const medicines = section("a_medicines", "Medicines and allergies", "always", [
  q("am_list", "Medicines", "Current medicines", "repeatable", {
    ...req,
    items: ["Name", "Strength", "Dose", "Route", "Frequency or times", "Indication",
      "Prescriber or source", "Current supply", "Who manages it", "Support needed",
      "Special instruction", "Time-critical or refrigerated"],
  }),
  q("am_source", "Medicines reconciliation source",
    "What was the medicines list reconciled against?", "choice", {
      ...req,
      options: opts([
        "packs|The packs in the home", "prescription|A prescription or dispensing label",
        "discharge|Discharge paperwork", "clinician|A treating clinician", "family|Family account only",
      ]),
    }),
  q("am_adherence", "Adherence and missed doses", "Adherence and any missed doses", "long_text", A),
  q("am_self_manage", "Ability to self-manage medicines", "Can the person manage their own medicines?", "choice", {
    ...A,
    options: opts([
      "independent|Independently", "prompting|With prompting", "administration|Needs administration",
      "not_assessed|Not assessed",
    ]),
  }),
  q("am_storage", "Storage", "How and where are medicines stored?", "long_text", A),
  q("am_high_risk", "Controlled or high-risk medicines",
    "Any controlled or high-risk medicines, and what that requires", "long_text", A),
  q("am_prn", "PRN instructions", "PRN medicines and the instruction for each", "long_text", A),
  q("am_changes", "Recent changes", "Recent changes to medicines", "long_text", A),
  q("am_side_effects", "Side effects or concerns", "Side effects or concerns", "long_text", A),
  yn("am_escalation", "Medicines escalation required", "Is escalation about medicines required?", {
    routes: { to: "clinical_lead", unless: ["no"] },
  }),
  q("am_allergies", "Allergies", "Allergies", "repeatable", {
    ...req, items: ["Agent", "Reaction", "Severity", "Certainty", "Source"],
  }),
]);

const communication = section("a_communication", "Communication, cognition and emotional wellbeing", "always", [
  q("ak_language", "Preferred language", "Preferred language", "language_picker", A),
  q("ak_senses", "Hearing, sight and speech", "Hearing, sight and speech", "multi", {
    ...A,
    options: opts([
      "hearing|Hearing difficulty", "sight|Sight difficulty", "speech|Speech difficulty",
      "aids_hearing|Uses a hearing aid", "aids_glasses|Wears glasses", "none|No difficulty|x",
    ]),
  }),
  q("ak_method", "Communication method and aids", "How does the person communicate best?", "long_text", A),
  q("ak_understanding", "Understanding of their own health",
    "How well does the person understand their own health and care?", "long_text", A),
  q("ak_cognition", "Memory, orientation and executive difficulty",
    "Any memory, orientation or planning difficulty, described objectively", "long_text", A),
  yn("ak_delirium", "Sudden confusion screen indicated",
    "Is there new or fluctuating confusion today?", {
      routes: { to: "clinical_lead", unless: ["no"], sameDay: true },
    }),
  q("ak_mood", "Mood, anxiety, distress and coping", "Mood, anxiety, distress and coping", "long_text", A),
  q("ak_sleep", "Sleep", "Sleep", "long_text", A),
  q("ak_behaviour", "Behaviour described objectively",
    "What happened, in what context, what it may communicate, what helped and how recovery went", "long_text", {
      ...A, help: "Describe what was seen. Do not use difficult or non-compliant.",
    }),
  q("ak_preferences", "Religious, cultural, privacy and gender preferences",
    "Religious, cultural, privacy and gender preferences", "long_text", A),
]);

const daily = section("a_daily", "Daily living and personal care", "always", [
  q("ad_matrix", "Support needed for each activity", "Support needed for each activity", "matrix", {
    ...req,
    options: SUPPORT_LEVELS,
    rows: [
      "Washing and bathing", "Oral care", "Dressing", "Grooming", "Toileting", "Transfers",
      "Eating and drinking", "Preparing meals", "Shopping", "Household tasks",
      "Getting out into the community", "Telephone and communication", "Managing appointments",
      "Managing money where it affects care",
    ],
  }),
  q("ad_routine", "Usual routine and preferences", "Usual routine and preferences", "long_text", req),
  q("ad_privacy", "Privacy and dignity preferences", "Privacy and dignity preferences", "long_text", A),
  q("ad_exact_help", "The exact help required", "The exact help required, activity by activity", "long_text", req),
]);

const mobility = section("a_mobility", "Mobility, falls and environment", "always", [
  q("ab_indoors", "Usual mobility indoors", "Usual mobility indoors", "choice", {
    ...req,
    options: opts([
      "independent|Without help", "aid|With an aid", "with_person|With a person",
      "wheelchair|Wheelchair", "in_bed|Mostly in bed",
    ]),
  }),
  q("ab_outdoors", "Usual mobility outdoors", "Usual mobility outdoors", "long_text", A),
  q("ab_observed", "Gait and transfer observation", "What was observed of gait and transfers?", "long_text", req),
  q("ab_aids", "Aids and whether they are used correctly", "Aids in use, and whether used correctly", "long_text", A),
  q("ab_weight_bearing", "Weight-bearing restrictions", "Any weight-bearing restriction", "long_text", A),
  q("ab_falls_12m", "Falls in the previous twelve months", "Number of falls in the last twelve months", "number", A),
  q("ab_falls_detail", "Circumstances of falls", "Circumstances of the falls", "long_text", {
    ...A, showWhen: { field: "ab_falls_12m", gte: 1 },
  }),
  yn("ab_fear", "Fear of falling", "Is there fear of falling?"),
  q("ab_stairs", "Stairs and access", "Stairs and access", "long_text", A),
  q("ab_furniture", "Bed, chair and toilet suitability", "Bed, chair and toilet suitability", "long_text", A),
  q("ab_handling", "Manual-handling considerations", "Manual-handling considerations", "long_text", req),
  q("ab_equipment", "Equipment present and required", "Equipment present and required", "repeatable", {
    ...A, items: ["Equipment", "Present or required", "Note"],
  }),
  q("ab_hazards", "Care-relevant home hazards", "Care-relevant hazards in the home", "multi", {
    ...A,
    options: opts([
      "lighting|Lighting", "flooring|Flooring", "bathroom|Bathroom", "electrical|Electrical or fire",
      "pets|Pets", "security|Security", "water|Water supply", "waste|Waste", "none|None relevant|x",
    ]),
  }),
  q("ab_emergency_access", "Emergency access and evacuation",
    "Emergency access and evacuation", "long_text", A),
]);

const nutrition = section("a_nutrition", "Nutrition, hydration and continence", "always", [
  q("an_intake", "Usual intake and preferences", "Usual intake and food preferences", "long_text", A),
  q("an_appetite", "Appetite and weight change", "Appetite and any weight change", "long_text", A),
  q("an_obtain", "Ability to obtain and prepare food", "Ability to obtain and prepare food", "long_text", A),
  q("an_feeding_help", "Feeding assistance required", "Feeding assistance required", "choice", {
    ...A, options: SUPPORT_LEVELS,
  }),
  yn("an_swallow", "Swallowing, choking or aspiration risk",
    "Is there any swallowing, choking or aspiration risk?", {
      routes: { to: "clinical_lead", unless: ["no"] },
    }),
  q("an_texture", "Prescribed texture or fluid modification",
    "Prescribed texture or fluid modification", "text", {
      ...A, showWhen: { field: "an_swallow", in: ["yes"] },
    }),
  q("an_tube", "Feeding tube details", "Feeding tube details", "long_text", A),
  q("an_hydration", "Hydration concerns", "Hydration concerns", "long_text", A),
  q("an_oral", "Dentition and oral health", "Dentition and oral health", "long_text", A),
  q("an_bowel", "Bowel pattern and support", "Bowel pattern and support", "long_text", A),
  q("an_bladder", "Bladder pattern and support", "Bladder pattern and support", "long_text", A),
  q("an_aids", "Continence aids", "Continence aids in use", "long_text", A),
  q("an_devices", "Catheter or stoma", "Catheter or stoma details", "long_text", A),
  q("an_skin_effect", "Skin effects and infection concerns",
    "Skin effects and infection concerns", "long_text", A),
  q("an_plan_upload", "Professional diet, feeding or continence plan",
    "Upload any professional diet, feeding or continence plan", "upload", A),
]);

const skin = section("a_skin", "Skin, wounds and pain", "always", [
  q("ax_integrity", "Skin integrity and pressure-risk factors",
    "Skin integrity and pressure-risk factors", "long_text", req),
  yn("ax_observed", "Pressure areas observed", "Were pressure areas observed, with consent?"),
  q("ax_reposition", "Repositioning ability and current plan",
    "Repositioning ability and any current plan", "long_text", A),
  yn("ax_wounds", "Wounds present", "Are any wounds present?"),
  q("ax_wound_rows", "Wounds", "Each wound", "repeatable", {
    ...A,
    showWhen: { field: "ax_wounds", in: ["yes"] },
    items: ["Type", "Location", "Size", "Tissue", "Exudate", "Odour", "Surrounding skin",
      "Pain", "Signs of infection", "Dressing", "Clinical instruction"],
  }),
  q("ax_surgical", "Surgical wound, drain, staples or sutures",
    "Surgical wound, drain, staple or suture detail", "long_text", {
      ...A, showWhen: { field: "ax_wounds", in: ["yes"] },
    }),
  q("ax_photo", "Wound photographs", "Photographs, where consent was recorded", "upload", {
    ...A, showWhen: { field: "ax_wounds", in: ["yes"] },
    help: "Only with recorded consent.",
  }),
  q("ax_pain", "Pain: location, character, pattern, triggers, relief and effect",
    "Pain: location, character, pattern, triggers, what relieves it and how it affects daily life",
    "long_text", A),
]);

const risk = section("a_risk", "Safeguarding, risk and escalation", "always", [
  q("ar_concerns", "Risks identified", "Which risks are present?", "multi", {
    ...req,
    options: opts([
      "abuse|Abuse, neglect or exploitation", "self_neglect|Self-neglect", "domestic|Domestic safety",
      "child|Child safeguarding", "carer_strain|Carer strain", "wandering|Wandering or going missing",
      "falls|Falls", "choking|Choking or aspiration", "pressure|Pressure injury", "medicine|Medicines",
      "infection|Infection", "fire|Fire or oxygen", "device|Device failure", "deterioration|Deterioration",
      "lone_worker|Lone-worker risk", "none|No risk identified|x",
    ]),
    routes: { to: "safeguarding", unless: ["none", "falls", "carer_strain", "lone_worker"], sameDay: true },
  }),
  q("ar_rows", "Risk assessment", "For each risk identified", "repeatable", {
    ...A,
    items: ["Hazard or concern", "Who may be harmed", "Evidence or context", "Existing controls",
      "Likelihood", "Consequence", "Immediate action", "Recommended control", "Owner", "Review trigger"],
    help: "Likelihood and consequence use the anchors agreed with the clinical lead.",
  }),
  yn("ar_urgent_done", "Urgent action already taken",
    "Where urgent action was needed, has it already been taken?"),
  q("ar_urgent_detail", "Urgent action taken", "What was done, and who was told?", "long_text", {
    ...A, showWhen: { field: "ar_urgent_done", in: ["yes"] },
  }),
]);

const network = section("a_network", "Existing support network", "always", [
  q("aw_household", "Household composition", "Who lives in the household?", "long_text", req),
  q("aw_support", "Family and informal support", "Family and informal support", "repeatable", {
    ...A, items: ["Name", "Relationship", "What they do", "When"],
  }),
  q("aw_paid", "Paid carers or nannies already in place",
    "Paid carers or nannies already in place", "long_text", A),
  q("aw_professionals", "Professionals and services involved",
    "Professionals and services involved", "repeatable", {
      ...A, items: ["Service or professional", "Role", "Contact", "Frequency"],
    }),
  q("aw_school", "School, nursery or therapy", "School, nursery or therapy involvement", "long_text", A),
  q("aw_gaps", "Gaps, duplication and carer strain", "Gaps, duplication and carer strain", "long_text", req),
  q("aw_escalation", "Contact and escalation hierarchy", "Contact and escalation hierarchy", "repeatable", {
    ...req, items: ["Order", "Name", "Relationship or role", "Contact"],
  }),
]);

const synthesis = section("a_synthesis", "Assessor synthesis and recommendations", "always", [
  q("ay_summary", "Professional summary", "Concise professional summary", "long_text", req),
  q("ay_needs", "Confirmed needs", "Confirmed needs", "long_text", req),
  q("ay_strengths", "Strengths and independence to preserve",
    "Strengths and independence to preserve", "long_text", req),
  q("ay_goals", "Person and family goals", "Goals in the person's or family's own terms", "repeatable", {
    ...req, items: ["Goal", "Observable target", "Baseline", "Review measure"],
  }),
  q("ay_risks", "Risks and required controls", "Risks and the controls required", "long_text", req),
  q("ay_model", "Recommended service model", "Recommended service model", "long_text", req),
  q("ay_capabilities", "Recommended professional type and capabilities",
    "Recommended professional type and capabilities", "long_text", req),
  q("ay_pattern", "Proposed visit pattern", "Proposed visit pattern", "weekly_pattern", req),
  q("ay_hours", "Proposed hours each week", "Proposed hours each week", "number", A),
  q("ay_equipment", "Equipment and supplies", "Equipment and supplies needed", "long_text", A),
  q("ay_further", "Further information or professional review needed",
    "Further information or professional review needed", "long_text", A),
  q("ay_actions_taken", "Immediate actions already taken",
    "Immediate actions already taken", "long_text", A),
  q("ay_proceed", "Suitability to proceed", "Is it suitable to proceed?", "choice", {
    ...req,
    options: opts([
      "yes|Yes", "yes_conditions|Yes, with the conditions stated", "no|No, not at this time",
    ]),
  }),
  q("ay_proceed_reason", "Reasons", "Reasons for that view", "long_text", req),
  q("ay_lead_decision", "Items requiring a Clinical Lead decision",
    "Items requiring a Clinical Lead decision", "long_text", A),
]);

const completion = section("a_completion", "Completion", "always", [
  q("az_outstanding", "Anything not assessed and why",
    "Anything not assessed today, and why", "long_text", A),
  q("az_uploads", "Documents collected at the visit",
    "Documents collected at the visit", "upload", A),
  yesNo("az_declaration", "Assessor declaration",
    "I confirm this is my own professional assessment and is accurate.", { ...A, required: true }),
]);

export const UNIVERSAL_SECTIONS = [
  evidence, visit, consent, situation, health, medicines, communication,
  daily, mobility, nutrition, skin, risk, network,
];

export const CLOSING_SECTIONS = [synthesis, completion];
