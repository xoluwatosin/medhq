// Builds the pre-assessment definition, version 7.
//
// Run with: node scripts/pre-assessment/build-v7.mjs
//
// Versions 1 to 6 stay exactly as published: a form already started keeps the
// questions it was started on, and every earlier record reads
// back unchanged.
//
// Version 7 preserves the structured medicine flow and corrects recipient/service routing.
// In version 5 "Do you take regular medicines?" sat in the health section while
// the medicine list, who manages them, missed doses and time-critical medicines
// sat in a separate module several sections later, so answering yes led
// nowhere. Here those questions sit immediately after the question that opens
// them, and the time-critical follow-up is chosen from the medicines already
// entered rather than typed again.
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

/** One structured control in place of one free-text box, as version 5 has it. */
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
    asked: "Which medicines {are} {subject} taking?",
    help: "Start typing to find a medicine, then set the amount, the unit and how often. Record only what is already taken. We never suggest a medicine or a dose.",
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
  md_critical_detail: {
    type: "medicine_choice",
    asked: "Which of them?",
    help: "Choose from the medicines already listed.",
    source: "md_list",
    drop: ["items", "options"],
  },
};

/** Asked once, at the end of the arrangements section. */
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
  if (change.source) next.source = change.source;
  return next;
};

/* ---- the medicine questions move to where they are opened ---------------- */
//
// In version 5 these questions formed the m_medicines module, opened either by
// the service asked for or by "Do you take regular medicines?". Version 6 asks
// them in the health section, immediately after that question, under exactly
// the same condition the module used, so nothing is asked of anyone who was
// not asked it before, and nothing is withheld from anyone who was.

const MEDICINES_APPLY = {
  anyOf: [
    { field: "regular_medicines", in: ["yes"] },
    {
      field: "derived_service",
      in: ["post_surgical", "clinical_home_care", "additional_needs"],
    },
  ],
};

const withMedicinesCondition = (field) => {
  const next = { ...field };
  next.showWhen = next.showWhen
    ? { allOf: [MEDICINES_APPLY, next.showWhen] }
    : MEDICINES_APPLY;
  return next;
};

const medicinesSection = RISK_SECTIONS.find((s) => s.id === "mod_medicines");
if (!medicinesSection) throw new Error("The medicines module could not be found");

const MEDICINE_FIELDS = medicinesSection.fields.map((field) => ({
  ...withMedicinesCondition(field),
  carry: field.carry ?? CARRY.mod_medicines,
}));

/** The medicines module no longer exists as a section, so its rule goes with it. */
const { m_medicines: _retired, ...MODULE_RULES_V6 } = MODULE_RULES;

const sourceSections = [
  ...ROUTE_SECTIONS,
  ...SERVICE_SECTIONS,
  ...RISK_SECTIONS.filter((s) => s.id !== "mod_medicines"),
  CONSENT_SECTION,
];

const v7SourceSections = sourceSections.map((section) => {
  if (section.id === "svc_postnatal_mother") return { ...section, when: { ...section.when, service: ["postnatal"] } };
  if (section.id === "svc_postnatal_baby") return { ...section, when: { service: ["newborn"] } };
  if (section.id === "svc_clinical") return { ...section, when: { ...section.when, service: ["clinical_home_care", "paediatric"] } };
  return section;
});

const sections = v7SourceSections.map((section) => {
  const carry = CARRY[section.id];
  if (!carry) throw new Error(`No carry classification for section ${section.id}`);
  const fields = section.fields
    .filter((field) => !REMOVED.has(field.id))
    .map((field) => ({ ...applyField(field), carry: field.carry ?? carry }));

  if (section.id === "core_health") {
    const at = fields.findIndex((f) => f.id === "regular_medicines");
    if (at < 0) throw new Error("The regular medicines question could not be found");
    fields.splice(at + 1, 0, ...MEDICINE_FIELDS.map(applyField));
  }
  if (section.id === "core_support") {
    const at = fields.findIndex((field) => field.id === "alt_contact_phone");
    if (at >= 0) fields.splice(at + 1, 0, {
      id: "alt_contact_email",
      record: "Alternative contact, email",
      asked: "Their email address (optional)",
      type: "text",
      showWhen: { field: "alt_contact_first_name", empty: false },
      carry: "clinical_evidence",
    });
  }
  if (section.id === "mod_nutrition") {
    for (const field of fields) {
      if (!["nu_swallow", "nu_swallow_plan"].includes(field.id)) continue;
      const notAdditionalNeeds = { not: { field: "derived_service", in: ["additional_needs"] } };
      field.showWhen = field.showWhen ? { allOf: [notAdditionalNeeds, field.showWhen] } : notAdditionalNeeds;
    }
  }
  if (section.id === "core_arrangements") fields.push(VISIT_PREFERENCES);
  return { ...section, fields };
});

const definition = {
  version: 7,
  kind: "pre_assessment",
  source: "MC-FRM-07 pre-assessment specification, version 7, 14 September 2026",
  vocabulary: "medicconnect-care",
  vocabularyVersion: 1,
  opening:
    "These questions help us understand what is needed before the assessment visit. You only see the questions that apply to your request, and your answers save as you go, so you can stop and come back to the same link.",
  closing:
    "Thank you. We have your answers. If something changes, tell the nurse on the day or call us on +234 812 698 8237.",
  privacyUrl: "/privacy",
  moduleRules: MODULE_RULES_V6,
  sections,
};

const path = new URL("../../docs/care/pre-assessment-v7.json", import.meta.url);
writeFileSync(path, `${JSON.stringify(definition, null, 2)}\n`);

const fields = definition.sections.flatMap((s) => s.fields);
console.log(`sections: ${definition.sections.length}, questions: ${fields.length}`);
const health = definition.sections.find((s) => s.id === "core_health");
console.log(`health section order: ${health.fields.map((f) => f.id).join(", ")}`);
