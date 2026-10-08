// Version 15: what kind of care comes first.
//
// Version 14 asked which days and times support is needed before knowing the
// kind of care, so a family wanting live-in care ticked every day and every
// time, and "How long" mixed a kind of care (a one-off visit) with lengths of
// time. The form now asks the kind of care first: live-in skips days and
// times, a one-off skips the length. The visit questions say plainly that a
// nurse comes to the home for the care needs assessment. Version 14 stays
// exactly as published.
import { readFileSync, writeFileSync } from "node:fs";

const v14 = JSON.parse(readFileSync(new URL("../../docs/care/pre-assessment-v14.json", import.meta.url), "utf8"));

const request = { carry: "operational", subject: "care_request", displayContext: "care_request", cardinality: "request" };
const patternIs = (...values) => ({ field: "care_pattern", in: values });

const carePattern = {
  id: "care_pattern",
  record: "Kind of care",
  asked: "What kind of care is needed?",
  type: "choice",
  required: true,
  options: [
    { value: "live_in", label: "Live-in: someone stays in the home" },
    { value: "shifts", label: "Shifts: set hours each day" },
    { value: "visits", label: "Visits at set times" },
    { value: "one_off", label: "A one-off shift or visit" },
    { value: "not_sure", label: "Not sure yet" },
  ],
  ...request,
};

const CHANGES = {
  care_days: (f) => ({ ...f, showWhen: patternIs("shifts", "visits", "not_sure") }),
  care_times: (f) => ({ ...f, showWhen: patternIs("shifts", "visits", "not_sure") }),
  duration: (f) => ({
    ...f,
    asked: "For how long might care be needed?",
    options: [
      { value: "under_2_weeks", label: "Less than two weeks" },
      { value: "2_6_weeks", label: "Two to six weeks" },
      { value: "1_3_months", label: "One to three months" },
      { value: "3_6_months", label: "Three to six months" },
      { value: "longer", label: "Longer than six months" },
      { value: "not_sure", label: "Not sure yet" },
    ],
    showWhen: { not: patternIs("one_off") },
  }),
  visit_address: (f) => ({
    ...f,
    record: "Address for the nurse's visit",
    asked: "Where should our nurse come for the care needs assessment?",
    help: "Before care starts, a nurse visits to meet you, see the home and agree the care plan. This is usually the home where care will happen.",
  }),
  visit_lga: (f) => ({ ...f, asked: "Which state and area is the home in?" }),
  visit_attendees: (f) => ({ ...f, asked: "Who will be there for the nurse's visit?" }),
  visit_preferences: (f) => ({ ...f, asked: "When would suit you for the nurse's visit?" }),
};

const sections = v14.sections.map((section) => {
  if (section.id !== "core_arrangements") return section;
  const fields = section.fields.map((f) => (CHANGES[f.id] ? CHANGES[f.id](f) : f));
  fields.splice(fields.findIndex((f) => f.id === "care_days"), 0, carePattern);
  return { ...section, fields };
});

const definition = {
  ...v14,
  version: 15,
  source: "MC-FRM-09 pre-assessment specification, version 15, 8 October 2026",
  sections,
};

const ids = new Set(sections.flatMap((s) => s.fields.map((f) => f.id)));
for (const id of [...Object.keys(CHANGES), "care_pattern"]) {
  if (!ids.has(id)) throw new Error(`v15 changes a field that does not exist: ${id}`);
}

writeFileSync(new URL("../../docs/care/pre-assessment-v15.json", import.meta.url), `${JSON.stringify(definition, null, 2)}\n`);
console.log(`sections: ${sections.length}, questions: ${ids.size}`);
