// Validates the built assessment definition against the engine's own rules.
// Run with: npx vite-node scripts/assessment/check.ts
import { readFileSync } from "node:fs";
import { validateDefinition } from "../../src/lib/care-schema";
import type { CareDefinition } from "../../src/lib/care";

const definition = JSON.parse(
  readFileSync(new URL("../../docs/care/assessment-v2.json", import.meta.url), "utf8"),
) as CareDefinition;

const result = validateDefinition(definition);
if (!result.ok) {
  for (const issue of result.issues) console.error(`${issue.path}: ${issue.problem}`);
  console.error(`${result.issues.length} problems`);
  process.exit(1);
}
console.log("definition valid");
