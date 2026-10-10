// Version 12: postnatal care and omugwo, for the whole family on the request.
//
// Walking version 11 as a grandmother arranging omugwo for her daughter and
// grandchild, a sister doing the same, a husband, and a mother of twins found:
// the grandmother asked whether she is the baby's parent, and then for the
// parent's name and phone, when the mother is on the same request; and the
// mother's pages calling a baby the form already knows by name "the baby".
// Version 11 stays exactly as published.
//
// Conditions read facts the page and the server both build from the intake
// (intakeRoutingAnswers), so the two always agree on what is asked.
import { readFileSync, writeFileSync } from "node:fs";

const v11 = JSON.parse(readFileSync(new URL("../../docs/care/pre-assessment-v11.json", import.meta.url), "utf8"));

const andShow = (field, condition) => ({
  ...field,
  showWhen: field.showWhen ? { allOf: [field.showWhen, condition] } : condition,
});

const SHOW = {
  // The baby's mother is on the request, so the parent is known.
  is_parent_guardian: { not: { field: "intake_parent_on_request", in: ["yes"] } },
};

const ASKED = {
  // {baby} is the babies on the request by name, else "your baby" or "the baby".
  pn_delivery_date: "When was {baby} born?",
  pn_delivery_type: "What kind of birth was it?",
  pn_feeding: "How {do} {subject} feed {baby}?",
};

const OPTION_LABELS = {
  pn_mother_support: { baby_care: "Care of {baby}" },
};

const correct = (field) => {
  let next = { ...field };
  if (ASKED[field.id]) next.asked = ASKED[field.id];
  if (SHOW[field.id]) next = andShow(next, SHOW[field.id]);
  const labels = OPTION_LABELS[field.id];
  if (labels && next.options) {
    next.options = next.options.map((o) => (labels[o.value] ? { ...o, label: labels[o.value] } : o));
  }
  return next;
};

const definition = {
  ...v11,
  version: 12,
  source: "MC-FRM-09 pre-assessment specification, version 12, 6 October 2026",
  sections: v11.sections.map((section) => ({ ...section, fields: section.fields.map(correct) })),
};

const fields = definition.sections.flatMap((s) => s.fields);
for (const id of [...Object.keys(SHOW), ...Object.keys(ASKED), ...Object.keys(OPTION_LABELS)]) {
  if (!fields.some((f) => f.id === id)) throw new Error(`v12 changes a field that does not exist: ${id}`);
}
for (const [fieldId, labels] of Object.entries(OPTION_LABELS)) {
  const field = fields.find((f) => f.id === fieldId);
  for (const value of Object.keys(labels)) {
    if (!(field.options ?? []).some((o) => o.value === value)) throw new Error(`${fieldId} has no option ${value}`);
  }
}

writeFileSync(new URL("../../docs/care/pre-assessment-v12.json", import.meta.url), `${JSON.stringify(definition, null, 2)}\n`);
console.log(`sections: ${definition.sections.length}, questions: ${fields.length}`);
