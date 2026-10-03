// Builds the pre-assessment definition, version 4.
//
// Run with: node scripts/pre-assessment/build.mjs
// The output is written to docs/care/pre-assessment-v4.json and is validated
// by src/lib/care-schema.ts before it can be published.
//
// Version 4 adds one thing to version 3: every question says what it is to the
// professional assessment that follows. Only clinical evidence is confirmed or
// amended at the visit; context is read, operational answers run the visit, and
// authority and consent are held as the basis for acting at all.
import { writeFileSync } from "node:fs";
import { ROUTE_SECTIONS, CONSENT_SECTION } from "./route.mjs";
import { SERVICE_SECTIONS } from "./services.mjs";
import { RISK_SECTIONS, MODULE_RULES } from "./modules.mjs";

/**
 * How each section's answers are carried. Written out in full, section by
 * section, so the classification is a governed decision and never inferred
 * from a title at run time.
 */
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

const sections = [
  ...ROUTE_SECTIONS,
  ...SERVICE_SECTIONS,
  ...RISK_SECTIONS,
  CONSENT_SECTION,
].map((section) => {
  const carry = CARRY[section.id];
  if (!carry) throw new Error(`No carry classification for section ${section.id}`);
  return {
    ...section,
    fields: section.fields.map((field) => ({ ...field, carry: field.carry ?? carry })),
  };
});

const definition = {
  version: 4,
  kind: "pre_assessment",
  source: "MC-FRM-07 pre-assessment specification, 13 September 2026",
  opening:
    "These questions help us understand what is needed before the assessment visit. You only see the questions that apply to your request, and your answers save as you go.",
  closing:
    "Thank you. We have your answers. If something changes, tell the nurse on the day or call us on +234 812 698 8237.",
  privacyUrl: "/privacy",
  moduleRules: MODULE_RULES,
  sections,
};

const path = new URL("../../docs/care/pre-assessment-v4.json", import.meta.url);
writeFileSync(path, `${JSON.stringify(definition, null, 2)}\n`);

const fields = definition.sections.flatMap((s) => s.fields);
const counted = {};
for (const field of fields) counted[field.carry] = (counted[field.carry] ?? 0) + 1;
console.log(`sections: ${definition.sections.length}, questions: ${fields.length}`);
console.log(counted);
