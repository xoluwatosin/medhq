// Builds the pre-assessment definition, version 5.
//
// Run with: node scripts/pre-assessment/build-v5.mjs
// Version 4 stays exactly as it was published: a form already started keeps the
// questions it was started on.
//
// Version 5 changes how the health answers are captured, not what is asked.
// Conditions, medicines and allergies come from the shared Medic Connect
// clinical lists rather than free text, hospitals and professionals are asked
// in named parts, documents are uploaded into private Care storage, and the
// visit is offered as up to three real dates rather than a weekday and a vague
// time of day.
import { writeFileSync } from "node:fs";
import { ROUTE_SECTIONS, CONSENT_SECTION } from "./route.mjs";
import { SERVICE_SECTIONS } from "./services.mjs";
import { RISK_SECTIONS, MODULE_RULES } from "./modules.mjs";

const CARRY = {
  route: "operational",
  route_service: "operational",
  decisions_adult: "authority_consent",
  decisions_child: "authority_consent",
  core_situation: "clinical_evidence",
  core_health: "clinical_evidence",
  core_support: "clinical_evidence",
  core_arrangements: "operational",
  svc_antenatal: "clinical_evidence",
  svc_postnatal_mother: "clinical_evidence",
  svc_postnatal_baby: "clinical_evidence",
  svc_post_surgical: "clinical_evidence",
  svc_eldercare: "clinical_evidence",
  svc_clinical: "clinical_evidence",
  mod_wound: "clinical_evidence",
  mod_device: "clinical_evidence",
  mod_respiratory: "clinical_evidence",
  mod_nutrition: "clinical_evidence",
  mod_palliative: "clinical_evidence",
  svc_nanny_children: "clinical_evidence",
  svc_nanny_role: "operational",
  svc_additional_needs: "clinical_evidence",
  svc_other: "context",
  mod_medicines: "clinical_evidence",
  mod_mobility: "clinical_evidence",
  consent: "authority_consent",
};

/**
 * One structured control in place of one free-text box. Everything else about
 * the question — when it is asked, what it is called in the record, whether it
 * is required — is left exactly as version 4 had it.
 */
const STRUCTURED = {
  condition_details: {
    type: "condition_list",
    asked: "Which conditions should we know about?",
    help: "Start typing to find a condition. Add anything that is not listed in your own words.",
    drop: ["items", "options"],
  },
  allergy_details: {
    type: "allergy_list",
    asked: "What is the allergy, and what happens?",
    help: "Add each allergy separately, with what happens and how severe it is.",
    drop: ["items", "options"],
  },
  md_list: {
    type: "medicine_list",
    asked: "Please list the medicines {subject} {are} taking.",
    help: "Start typing to find a medicine. Add the dose and how often where you know it.",
    drop: ["items", "options"],
  },
  hospital_name: {
    type: "hospital",
    asked: "Which hospital, and where?",
    drop: ["items", "options"],
  },
  professional_details: {
    type: "professional",
    asked: "Who is involved, and where do they practise?",
    drop: ["items", "options"],
  },
  discharge_letter: {
    type: "care_upload",
    asked: "Upload the discharge letter, if you have it",
    help: "A PDF or a clear photograph. This is held privately with your care record.",
    drop: ["items", "options"],
  },
};

/** Asked once, at the end of the arrangements section, in place of the old weekday and time-of-day pair. */
const VISIT_PREFERENCES = {
  id: "visit_preferences",
  record: "Preferred times for the assessment visit",
  asked: "When would suit you for the assessment visit?",
  help: "Give up to three options. We will confirm one of them with you.",
  type: "appointment_preference",
  carry: "operational",
};

const REMOVED = new Set(["visit_days", "visit_time"]);

const applyField = (field) => {
  const change = STRUCTURED[field.id];
  if (!change) return field;
  const next = { ...field };
  for (const key of change.drop ?? []) delete next[key];
  next.type = change.type;
  if (change.asked) next.asked = change.asked;
  if (change.help) next.help = change.help;
  return next;
};

const sections = [
  ...ROUTE_SECTIONS,
  ...SERVICE_SECTIONS,
  ...RISK_SECTIONS,
  CONSENT_SECTION,
].map((section) => {
  const carry = CARRY[section.id];
  if (!carry) throw new Error(`No carry classification for section ${section.id}`);
  const fields = section.fields
    .filter((field) => !REMOVED.has(field.id))
    .map((field) => ({ ...applyField(field), carry: field.carry ?? carry }));
  if (section.id === "core_arrangements") fields.push(VISIT_PREFERENCES);
  return { ...section, fields };
});

const definition = {
  version: 5,
  kind: "pre_assessment",
  source: "MC-FRM-07 pre-assessment specification, version 5, 14 September 2026",
  vocabulary: "medicconnect-care",
  vocabularyVersion: 1,
  opening:
    "These questions help us understand what is needed before the assessment visit. You only see the questions that apply to your request, and your answers save as you go, so you can stop and come back to the same link.",
  closing:
    "Thank you. We have your answers. If something changes, tell the nurse on the day or call us on +234 812 698 8237.",
  privacyUrl: "/privacy",
  moduleRules: MODULE_RULES,
  sections,
};

const path = new URL("../../docs/care/pre-assessment-v5.json", import.meta.url);
writeFileSync(path, `${JSON.stringify(definition, null, 2)}\n`);

const fields = definition.sections.flatMap((s) => s.fields);
const structured = fields.filter((f) =>
  ["condition_list", "medicine_list", "allergy_list", "hospital", "professional", "care_upload", "appointment_preference"].includes(f.type),
);
console.log(`sections: ${definition.sections.length}, questions: ${fields.length}`);
console.log(`structured clinical controls: ${structured.map((f) => f.id).join(", ")}`);
