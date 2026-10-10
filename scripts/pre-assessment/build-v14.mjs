// Version 14: a baby who is not born yet, and the care of a newborn.
//
// A mother arranging a live-in newborn nanny before her baby was born by
// surrogate found version 13 asking whether the baby still naps, takes
// regular medicines, has been in hospital or enjoys anything, with nowhere to
// say how the baby will be fed or what the nanny does at night. The intake now
// records a baby not born yet with the expected date (derived_age_band
// "expected"), and the nanny pages carry a newborn block in place of the
// toddler routine. Version 13 stays exactly as published.
import { readFileSync, writeFileSync } from "node:fs";

const v13 = JSON.parse(readFileSync(new URL("../../docs/care/pre-assessment-v13.json", import.meta.url), "utf8"));

const and = (field, condition) => ({
  ...field,
  showWhen: field.showWhen ? { allOf: [field.showWhen, condition] } : condition,
});
const bandIs = (...bands) => ({ field: "derived_age_band", in: bands });
const bandNot = (...bands) => ({ not: bandIs(...bands) });
const EARLY = ["newborn", "expected"];

/** Every rule written for babies now also holds for a baby not born yet. */
const withExpected = (condition) => {
  if (!condition || typeof condition !== "object") return condition;
  if (Array.isArray(condition)) return condition.map(withExpected);
  const next = { ...condition };
  if (next.field === "derived_age_band" && Array.isArray(next.in) && next.in.includes("newborn") && !next.in.includes("expected")) {
    next.in = [...next.in, "expected"];
  }
  for (const key of ["allOf", "anyOf"]) if (next[key]) next[key] = next[key].map(withExpected);
  if (next.not) next.not = withExpected(next.not);
  return next;
};

const SHOW = {
  // Nothing to ask yet about a baby's health history, or whether they know
  // about the visit.
  child_knows_visit: bandNot("expected"),
  diagnosed_conditions: bandNot("expected"),
  professional_involved: bandNot("expected"),
  regular_medicines: bandNot("expected"),
  allergies: bandNot("expected"),
  // A toddler's routine, not a newborn's. The newborn block asks what matters.
  nn_duties_child: bandNot(...EARLY),
  nn_naps: bandNot(...EARLY),
  nn_night_waking: bandNot(...EARLY),
  nn_toileting: bandNot(...EARLY),
  nn_diet_has: bandNot(...EARLY),
  nn_activities: bandNot(...EARLY),
  nn_comfort: bandNot(...EARLY),
  nn_bedtime: bandNot("expected"),
  nn_waking: bandNot("expected"),
  nn_sleep_settle: bandNot("expected"),
  nn_sleep_arrangement: bandNot("expected"),
  nn_sleep_notes: bandNot("expected"),
  nn_safety_areas: bandNot("expected"),
  // The newborn block asks about nights in its own terms.
  nn_overnight: bandNot(...EARLY),
};

const REPLACE_SHOW = {
  nn_overnight_nights: {
    anyOf: [
      { field: "nn_overnight", in: ["yes"] },
      { field: "nb_nights", in: ["feeds", "full", "monitor"] },
    ],
  },
};

const ASKED = {
  nn_overnight_nights: "Which nights would the nanny cover?",
};

const field = (id, record, asked, extra) => ({
  id, record, asked,
  carry: "clinical_evidence", subject: "care_recipient", displayContext: "assessment", cardinality: "recipient",
  ...extra,
});

/** New questions, each placed after the one named. */
const ADD = [
  ["diagnosed_conditions", field("expected_notes", "Anything known from the pregnancy",
    "Is there anything from the pregnancy or the scans that we should know?", {
      type: "long_text",
      help: "Leave this blank if there is nothing to add.",
      showWhen: bandIs("expected"),
    })],
  ["nn_care_kind", field("nb_start", "When the newborn care starts", "When should the nanny start?", {
    type: "choice",
    required: true,
    carry: "operational",
    options: [
      { value: "before_birth", label: "Before the birth, to get ready" },
      { value: "birth", label: "From the birth" },
      { value: "home", label: "When the baby comes home" },
      { value: "other", label: "Another time" },
    ],
    showWhen: bandIs("expected"),
  })],
  ["nb_start", field("nb_birth_place", "Where the baby will be born", "Where will {child} be born?", {
    type: "text",
    carry: "operational",
    help: "The city, and the hospital if you know it.",
    showWhen: bandIs("expected"),
  })],
  ["nb_birth_place", field("nb_travel", "Nanny to travel after the birth",
    "Would the nanny need to travel to meet {child} after the birth?", {
      type: "yes_no",
      carry: "operational",
      showWhen: bandIs("expected"),
    })],
  ["nb_travel", field("nb_feeding", "How the baby is fed", "How will {child} be fed?", {
    type: "choice",
    required: true,
    options: [
      { value: "formula", label: "Formula" },
      { value: "breast", label: "Breastfed" },
      { value: "expressed", label: "Expressed breast milk, by bottle" },
      { value: "mixed", label: "A mix" },
      { value: "not_sure", label: "Not sure yet" },
    ],
    showWhen: bandIs(...EARLY),
  })],
  ["nb_feeding", field("nb_tasks", "Newborn care the nanny takes on", "Which newborn care should the nanny take on?", {
    type: "multi",
    required: true,
    help: "Choose everything that applies.",
    options: [
      { value: "formula_prep", label: "Preparing formula correctly" },
      { value: "sterilising", label: "Sterilising bottles and equipment" },
      { value: "bottle_feeding", label: "Bottle feeding and winding" },
      { value: "nappies", label: "Nappy changes" },
      { value: "bathing", label: "Bathing and skin care" },
      { value: "cord", label: "Care of the umbilical cord" },
      { value: "soothing", label: "Soothing and settling" },
      { value: "sleep_routine", label: "A safe sleep routine" },
      { value: "laundry", label: "The baby's laundry" },
      { value: "appointments", label: "Going to check-ups and vaccinations" },
    ],
    showWhen: bandIs(...EARLY),
  })],
  ["nb_tasks", field("nb_nights", "Help needed at night", "What help is needed at night?", {
    type: "choice",
    required: true,
    options: [
      { value: "none", label: "No night care" },
      { value: "feeds", label: "Night feeds and changes, then settling back to sleep" },
      { value: "full", label: "Full night care, so the parents can sleep" },
      { value: "monitor", label: "Watching over the baby through the night" },
      { value: "not_sure", label: "Not sure yet" },
    ],
    showWhen: bandIs(...EARLY),
  })],
  ["nb_nights", field("nb_sleep_place", "Where the baby sleeps at night", "Where will {child} sleep at night?", {
    type: "choice",
    options: [
      { value: "parents_room", label: "In a cot in the parents' room" },
      { value: "nursery", label: "In a nursery" },
      { value: "nanny_room", label: "In the nanny's room" },
      { value: "not_sure", label: "Not decided yet" },
    ],
    showWhen: bandIs(...EARLY),
  })],
];

const correct = (f) => {
  let next = { ...f };
  if (ASKED[f.id]) next.asked = ASKED[f.id];
  if (next.showWhen) next.showWhen = withExpected(next.showWhen);
  if (REPLACE_SHOW[f.id]) next.showWhen = REPLACE_SHOW[f.id];
  if (SHOW[f.id]) next = and(next, SHOW[f.id]);
  return next;
};

const sections = v13.sections.map((section) => {
  const fields = section.fields.map(correct);
  for (const [after, added] of ADD) {
    const at = fields.findIndex((f) => f.id === after);
    if (at >= 0) fields.splice(at + 1, 0, added);
  }
  return {
    ...section,
    ...(section.when && typeof section.when === "object" ? { when: withExpected(section.when) } : {}),
    fields,
  };
});

const definition = {
  ...v13,
  version: 14,
  source: "MC-FRM-09 pre-assessment specification, version 14, 6 October 2026",
  moduleRules: withExpected(v13.moduleRules),
  sections,
};

const ids = new Set(sections.flatMap((s) => s.fields.map((f) => f.id)));
for (const id of [...Object.keys(SHOW), ...Object.keys(REPLACE_SHOW), ...Object.keys(ASKED)]) {
  if (!ids.has(id)) throw new Error(`v14 changes a field that does not exist: ${id}`);
}
for (const [, added] of ADD) if (!ids.has(added.id)) throw new Error(`v14 did not place ${added.id}`);

writeFileSync(new URL("../../docs/care/pre-assessment-v14.json", import.meta.url), `${JSON.stringify(definition, null, 2)}\n`);
console.log(`sections: ${sections.length}, questions: ${ids.size}`);
