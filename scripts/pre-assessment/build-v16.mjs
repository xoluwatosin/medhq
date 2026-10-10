// Version 16: another contact needs a name and a number.
//
// Version 15 required a relationship for the alternative contact, so a family
// who gave a full name and a phone number still had the question flagged as
// unanswered. Another contact now needs a first name, a last name and a phone
// number; an email address and how they are related are welcome but not
// required. Version 15 stays exactly as published.
import { readFileSync, writeFileSync } from "node:fs";

const v15 = JSON.parse(readFileSync(new URL("../../docs/care/pre-assessment-v16.json", import.meta.url), "utf8"));

const CONTACT_HELP = "We need their first name, last name and phone number. An email address is helpful too.";
const contactParts = (f) => ({ ...f, help: CONTACT_HELP, requiredParts: ["firstName", "lastName", "phone"] });

const CHANGES = {
  alt_contact: contactParts,
  local_contact: contactParts,
};

const sections = v15.sections.map((section) => ({
  ...section,
  fields: section.fields.map((f) => (CHANGES[f.id] ? CHANGES[f.id](f) : f)),
}));

const definition = {
  ...v15,
  version: 16,
  source: "MC-FRM-09 pre-assessment specification, version 16, 8 October 2026",
  sections,
};

const ids = new Set(sections.flatMap((s) => s.fields.map((f) => f.id)));
for (const id of Object.keys(CHANGES)) {
  if (!ids.has(id)) throw new Error(`v16 changes a field that does not exist: ${id}`);
}

writeFileSync(new URL("../../docs/care/pre-assessment-v16.json", import.meta.url), `${JSON.stringify(definition, null, 2)}\n`);
console.log(`sections: ${sections.length}, questions: ${ids.size}`);
