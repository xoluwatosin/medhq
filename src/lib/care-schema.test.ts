// A definition is either valid in full or not published at all, and the same
// answers always open the same modules.
import { describe, expect, it } from "vitest";
import { resolveModules, sectionsForModules, validateDefinition } from "@/lib/care-schema";
import { SYNTHETIC_DEFINITION } from "@/lib/care-schema.fixture";
import type { CareDefinition } from "@/lib/care";

const clone = (): CareDefinition => JSON.parse(JSON.stringify(SYNTHETIC_DEFINITION)) as CareDefinition;

describe("definition validation", () => {
  it("accepts a well formed definition", () => {
    expect(validateDefinition(SYNTHETIC_DEFINITION)).toEqual({ ok: true, issues: [] });
  });

  it("rejects a repeated question identifier and says where", () => {
    const bad = clone();
    bad.sections[1].fields[0].id = bad.sections[0].fields[0].id;
    const result = validateDefinition(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === "sections[1].fields[0].id")).toBe(true);
  });

  it("rejects a control this engine cannot draw", () => {
    const bad = clone();
    (bad.sections[0].fields[0] as { type: string }).type = "mood_ring";
    expect(validateDefinition(bad).issues.some((i) => i.problem.includes("mood_ring"))).toBe(true);
  });

  it("rejects a condition that names a question the definition does not hold", () => {
    const bad = clone();
    bad.sections[0].fields[1].showWhen = { field: "nowhere", in: ["yes"] };
    expect(validateDefinition(bad).issues.some((i) => i.problem.includes("nowhere"))).toBe(true);
  });

  it("rejects a measurement with no fixed unit", () => {
    const bad = clone();
    delete bad.sections[1].fields[1].measures;
    expect(validateDefinition(bad).issues.some((i) => i.path.endsWith(".measures"))).toBe(true);
  });

  it("rejects an escalation that names an answer the question cannot give", () => {
    const bad = clone();
    bad.sections[0].fields[1].routes = { to: "clinical", unless: ["maybe"] };
    expect(validateDefinition(bad).issues.some((i) => i.problem.includes("maybe"))).toBe(true);
  });

  it("rejects a module no section attaches to", () => {
    const bad = clone();
    bad.moduleRules = { ...bad.moduleRules, ghost: { always: ["eldercare"] } };
    expect(validateDefinition(bad).issues.some((i) => i.path === "moduleRules.ghost")).toBe(true);
  });

  it("rejects a section module with no rule to open it", () => {
    const bad = clone();
    delete bad.moduleRules!.medicines;
    expect(validateDefinition(bad).issues.some((i) => i.path === "moduleRules.medicines")).toBe(true);
  });
});

describe("module resolution", () => {
  it("opens a module the service always carries", () => {
    expect(resolveModules(SYNTHETIC_DEFINITION, "eldercare", {})).toEqual(["medicines"]);
  });

  it("opens a module an answer triggers", () => {
    expect(resolveModules(SYNTHETIC_DEFINITION, null, { "syn.core.devices": ["oxygen"] }))
      .toEqual(["devices"]);
  });

  it("gives the same list in the same order however the answers arrive", () => {
    const responses = { "syn.core.devices": ["oxygen"], "syn.core.medicines_present": "yes" };
    expect(resolveModules(SYNTHETIC_DEFINITION, "eldercare", responses)).toEqual(["devices", "medicines"]);
    expect(resolveModules(SYNTHETIC_DEFINITION, "eldercare", { ...responses })).toEqual(["devices", "medicines"]);
  });

  it("opens nothing when nothing applies", () => {
    expect(resolveModules(SYNTHETIC_DEFINITION, "nanny", {})).toEqual([]);
  });

  it("shows only the sections the frozen modules opened", () => {
    const ids = sectionsForModules(SYNTHETIC_DEFINITION, ["medicines"]).map((s) => s.id);
    expect(ids).toEqual(["syn_core", "syn_clinical", "syn_medicines"]);
  });
});

describe("a section that carries the family's answers", () => {
  it("accepts a confirm_amend section with no questions of its own", () => {
    const ok = clone();
    ok.sections.push({
      id: "syn_review", title: "What the family told us", when: "always",
      mode: "confirm_amend", fields: [],
    });
    expect(validateDefinition(ok).ok).toBe(true);
  });

  it("still rejects an ordinary section with no questions", () => {
    const bad = clone();
    bad.sections.push({ id: "syn_empty", title: "Nothing here", when: "always", fields: [] });
    expect(validateDefinition(bad).issues.some((i) => i.problem.includes("at least one question")))
      .toBe(true);
  });
});
