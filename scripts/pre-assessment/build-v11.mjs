// Version 11: the questions read what the intake already settled.
//
// A walk-through of the form as fourteen different people (someone arranging
// care for themselves, a mother with her newborn, a son in London for his
// father, a grandmother, a neighbour and others) found the same faults again
// and again: a parent asked whether they are the parent, the baby's name and
// birth date asked again after the intake took them, household questions asked
// once for every person on the request, and wording that called the person
// answering "the mother". Version 10 stays exactly as published.
//
// Every condition here reads facts the page and the server both build from the
// intake (intakeRoutingAnswers), so the two always agree on what is asked.
import { readFileSync, writeFileSync } from "node:fs";

const v10 = JSON.parse(readFileSync(new URL("../../docs/care/pre-assessment-v10.json", import.meta.url), "utf8"));

/** Show the field only while this also holds, keeping any existing rule. */
const andShow = (field, condition) => ({
  ...field,
  showWhen: field.showWhen ? { allOf: [field.showWhen, condition] } : condition,
});

const notFirstRecipient = { not: { field: "intake_first_recipient", in: ["no"] } };
const notBaby = { not: { field: "derived_age_band", in: ["newborn", "infant"] } };

const SHOW = {
  // The intake recorded the relationship. A mother, father or guardian is not
  // asked whether they are the parent; anyone else still is.
  is_parent_guardian: { not: { field: "intake_filler_parent", in: ["yes"] } },
  // A child under four is not asked about, or told about, the visit.
  child_knows_visit: { not: { field: "derived_age_years", lt: 4 } },
  // The intake holds the baby's name and, when the baby is on the request,
  // the date of birth.
  pn_baby_name: { field: "recipient_first_name", empty: true },
  pn_delivery_date: { field: "intake_newborn_dob", empty: true },
  // A baby is not asked about languages or communication aids, and a newborn's
  // birth admission is not a "recent hospital stay".
  languages: { allOf: [notBaby, notFirstRecipient] },
  communication_support: notBaby,
  hospital_recent: { not: { field: "derived_age_band", in: ["newborn"] } },
  // About the household, not the person: asked once, with the first person.
  situation: notFirstRecipient,
  immediate_danger: notFirstRecipient,
  support_now: notFirstRecipient,
  alt_contact_has: notFirstRecipient,
  // "When would you like care to begin?" is asked for the whole request first;
  // this is only asked where that was not answered.
  urgency: { allOf: [notFirstRecipient, { field: "start_when", empty: true }] },
};

const ASKED = {
  urgency: "How soon is support needed?",
  professional_involved: "Is a doctor or other health professional involved in {possessive} care?",
  pn_mother_recovery: "How is {possessive} recovery going?",
  pn_mother_concerns: "{Do} {subject} have any of these now?",
  pn_mother_support: "What support would help {subject} most?",
  ec_social: "Who {do} {subject} live with?",
  mb_falls: "{Have} {subject} had a fall in the last six months?",
  mb_transfers: "{Do} {subject} need help with stairs, or getting in and out of a bed or chair?",
  // The baby is a named person on the request: ask about them by name.
  pn_baby_term: "Was {subject} born at term or early?",
  pn_baby_scbu: "Did {subject} need special or intensive care after birth?",
  pn_baby_jaundice: "{Have} {subject} been yellow in the skin or eyes?",
  pn_baby_feeding_frequency: "How often {is} {subject} feeding?",
  pn_baby_warning: "{Do} {subject} have any of these now?",
  pn_baby_readmitted: "{Have} {subject} been back in hospital since going home?",
};

const HELP = {
  pn_baby_warning:
    "Medic Connect is not an emergency service. If {subject} is not feeding, is hard to wake, has a fever or is struggling to breathe, go to a hospital now.",
};

const OPTION_LABELS = {
  ec_memory: { yes: "Yes, changes have been noticed" },
  ec_social: { alone: "Alone" },
  pn_mother_support: { rest: "Time and help to rest" },
};

const SECTION_TITLES = {
  svc_postnatal_mother: "{Possessive} recovery",
  svc_postnatal_baby: "About {subject}",
};

const correct = (field) => {
  let next = { ...field };
  if (ASKED[field.id]) next.asked = ASKED[field.id];
  if (HELP[field.id]) next.help = HELP[field.id];
  if (SHOW[field.id]) next = andShow(next, SHOW[field.id]);
  const labels = OPTION_LABELS[field.id];
  if (labels && next.options) {
    next.options = next.options.map((o) => (labels[o.value] ? { ...o, label: labels[o.value] } : o));
  }
  return next;
};

const definition = {
  ...v10,
  version: 11,
  source: "MC-FRM-09 pre-assessment specification, version 11, 6 October 2026",
  sections: v10.sections.map((section) => ({
    ...section,
    ...(SECTION_TITLES[section.id] ? { title: SECTION_TITLES[section.id] } : {}),
    fields: section.fields.map(correct),
  })),
};

// Every change must land on a field that exists, so a renamed field cannot
// silently drop a rule.
const ids = new Set(definition.sections.flatMap((s) => s.fields.map((f) => f.id)));
for (const id of [...Object.keys(SHOW), ...Object.keys(ASKED), ...Object.keys(HELP), ...Object.keys(OPTION_LABELS)]) {
  if (!ids.has(id)) throw new Error(`v11 changes a field that does not exist: ${id}`);
}
for (const [fieldId, labels] of Object.entries(OPTION_LABELS)) {
  const field = definition.sections.flatMap((s) => s.fields).find((f) => f.id === fieldId);
  for (const value of Object.keys(labels)) {
    if (!(field.options ?? []).some((o) => o.value === value)) throw new Error(`${fieldId} has no option ${value}`);
  }
}
for (const id of Object.keys(SECTION_TITLES)) {
  if (!definition.sections.some((s) => s.id === id)) throw new Error(`v11 retitles a section that does not exist: ${id}`);
}

writeFileSync(new URL("../../docs/care/pre-assessment-v11.json", import.meta.url), `${JSON.stringify(definition, null, 2)}\n`);
console.log(`sections: ${definition.sections.length}, questions: ${definition.sections.flatMap((s) => s.fields).length}`);
