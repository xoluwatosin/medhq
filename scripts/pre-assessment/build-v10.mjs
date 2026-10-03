// Adds the governed answer-context contract to the current pre-assessment.
// Earlier versions remain unchanged; each historical document keeps its own
// definition and receives an explicit map through the migration backfill.
import { readFileSync, writeFileSync } from "node:fs";

const v9 = JSON.parse(readFileSync(new URL("../../docs/care/pre-assessment-v9.json", import.meta.url), "utf8"));

const REQUEST_SECTIONS = new Set(["core_arrangements", "consent", "svc_nanny_role", "svc_other"]);
const HOUSEHOLD_FIELDS = new Set([
  "visit_address", "visit_lga", "visit_landmark", "visit_attendees", "visit_preferences",
  "support_now", "childcare_now", "support_detail", "alt_contact_has", "alt_contact",
  "ps_household", "ec_home_safety", "nn_household",
]);
const ENQUIRER_FIELDS = new Set([
  "respondent_relationship", "decision_authority", "decision_authority_other", "is_parent_guardian",
  "pr_holder_first_name", "pr_holder_last_name", "pr_holder_relationship", "pr_holder_phone",
]);
const APPOINTMENT_FIELDS = new Set(["visit_attendees", "visit_preferences"]);
const SERVICE_FIELDS = new Set(["service_requested", "service_confirmed"]);

const metadata = (sectionId, field) => {
  if (SERVICE_FIELDS.has(field.id)) {
    return { subject: "service_intention", displayContext: "care_request", cardinality: "recipient_service" };
  }
  if (APPOINTMENT_FIELDS.has(field.id)) {
    return { subject: "appointment", displayContext: "care_request", cardinality: "request" };
  }
  if (ENQUIRER_FIELDS.has(field.id)) {
    return { subject: "enquirer", displayContext: "person", cardinality: "request" };
  }
  if (HOUSEHOLD_FIELDS.has(field.id)) {
    return { subject: "household", displayContext: "household", cardinality: "household" };
  }
  if (REQUEST_SECTIONS.has(sectionId)) {
    return { subject: "care_request", displayContext: "care_request", cardinality: field.type === "repeatable" ? "repeatable" : "request" };
  }
  return {
    subject: "care_recipient",
    displayContext: field.carry === "clinical_evidence" ? "assessment" : "person",
    cardinality: field.type === "repeatable" ? "repeatable" : "recipient",
  };
};

// Version 10 also corrects the nanny and childcare route so each fact is asked
// once, at the level it belongs to. Version 9 stays exactly as published.
const SCHOOL_RUN_ONLY = { field: "nn_duties_child", contains: ["school_run"] };
const SETTING_FIELDS = new Set([
  "nn_setting_type", "nn_setting_name", "nn_setting_days", "nn_setting_start",
  "nn_setting_end", "nn_setting_area", "nn_setting_term", "nn_collection_people",
]);
const option = (value, label) => ({ value, label });

const CHILD_DUTIES = [
  option("supervision", "Supervision through the day"),
  option("feeding_help", "Helping with feeding"),
  option("bathing", "Bathing and dressing"),
  option("nappies", "Nappies or toileting"),
  option("naps", "Settling for naps and bedtime"),
  option("school_run", "School run"),
  option("homework", "Homework support"),
  option("play", "Play and activities"),
  option("medicines", "Giving medicines"),
  option("health_tasks", "Health tasks a nurse would do"),
];

const ROLE_DUTIES = [
  option("child_meals", "Preparing the children's meals"),
  option("child_laundry", "The children's laundry"),
  option("tidying", "Tidying the children's rooms and toys"),
  option("outings_appointments", "Activities or appointments away from home"),
  option("travel", "Travel with the family"),
  option("other", "Something else"),
];

const correct = (field) => {
  if (field.id === "care_times") {
    // Live-in is an accommodation arrangement, not a time of day. It is asked
    // once, in the nanny role section.
    return { ...field, options: field.options.filter((o) => o.value !== "live_in") };
  }
  if (field.id === "nn_duties_child") {
    return {
      ...field,
      record: "Direct care expected for this child",
      asked: "Which direct care does {child} need?",
      options: CHILD_DUTIES,
    };
  }
  if (field.id === "nn_setting_attends") return { ...field, showWhen: SCHOOL_RUN_ONLY };
  if (SETTING_FIELDS.has(field.id)) {
    return {
      ...field,
      showWhen: { allOf: [SCHOOL_RUN_ONLY, { field: "nn_setting_attends", in: ["yes"] }] },
    };
  }
  if (field.id === "nn_pattern") {
    return { ...field, record: "Living arrangement", asked: "Would the nanny live in your home?" };
  }
  if (field.id === "nn_overnight") {
    return {
      ...field,
      record: "Overnight responsibility",
      asked: "Would the nanny be responsible for the children through the night?",
      showWhen: { field: "care_times", contains: ["overnight"] },
    };
  }
  if (field.id === "nn_overnight_nights") {
    return { ...field, asked: "Which nights would that cover?" };
  }
  if (field.id === "nn_duties") {
    return {
      ...field,
      record: "Shared duties across the role",
      asked: "Which shared duties are expected, across all the children?",
      help: "Care for each child is asked separately.",
      options: ROLE_DUTIES,
    };
  }
  return field;
};

const definition = {
  ...v9,
  version: 10,
  source: "MC-FRM-09 pre-assessment specification, version 10, 17 September 2026",
  sections: v9.sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => {
      const corrected = correct(field);
      return { ...corrected, ...metadata(section.id, corrected) };
    }),
  })),
};


for (const section of definition.sections) {
  for (const field of section.fields) {
    for (const key of ["subject", "displayContext", "cardinality"]) {
      if (!field[key]) throw new Error(`${section.id}.${field.id} has no ${key}`);
    }
  }
}

writeFileSync(new URL("../../docs/care/pre-assessment-v10.json", import.meta.url), `${JSON.stringify(definition, null, 2)}\n`);
console.log(`sections: ${definition.sections.length}, questions: ${definition.sections.flatMap((s) => s.fields).length}`);