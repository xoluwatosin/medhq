// Builds the professional assessment definition, version 2.
//
// Run with: node scripts/assessment/build.mjs
// The output is written to docs/care/assessment-v2.json and is validated by
// src/lib/care-schema.ts, and again by the database, before publication.
import { writeFileSync } from "node:fs";
import { UNIVERSAL_SECTIONS, CLOSING_SECTIONS } from "./universal.mjs";
import { SERVICE_SECTIONS, MODULE_RULES } from "./services.mjs";

const definition = {
  version: 2,
  kind: "assessment",
  source: "Medic Connect Professional Assessment Specification, 13 September 2026",
  moduleRules: MODULE_RULES,
  sections: [...UNIVERSAL_SECTIONS, ...SERVICE_SECTIONS, ...CLOSING_SECTIONS],
};

const path = new URL("../../docs/care/assessment-v2.json", import.meta.url);
writeFileSync(path, `${JSON.stringify(definition, null, 2)}\n`);

const fields = definition.sections.flatMap((s) => s.fields);
console.log(`sections: ${definition.sections.length}, questions: ${fields.length}`);
