// The review checklist rules, as the screen applies them. The database holds
// the same twelve checks and the same gate.
import { describe, expect, it } from "vitest";
import {
  checklistAllowsAccept, checklistDecided, REVIEW_CHECKS, type ReviewChecklist,
} from "@/lib/care-assessment";

const all = (decision: "met" | "not_met" | "not_applicable"): ReviewChecklist =>
  Object.fromEntries(REVIEW_CHECKS.map((c) => [c.key, { decision }]));

describe("the clinical review checklist", () => {
  it("holds twelve checks", () => {
    expect(REVIEW_CHECKS).toHaveLength(12);
    expect(new Set(REVIEW_CHECKS.map((c) => c.key)).size).toBe(12);
  });

  it("counts only decided checks", () => {
    expect(checklistDecided({})).toBe(0);
    expect(checklistDecided({ [REVIEW_CHECKS[0].key]: {} })).toBe(0);
    expect(checklistDecided(all("met"))).toBe(12);
  });

  it("allows acceptance only when every check is decided and none is unmet", () => {
    expect(checklistAllowsAccept({})).toBe(false);
    expect(checklistAllowsAccept(all("met"))).toBe(true);
    expect(checklistAllowsAccept(all("not_applicable"))).toBe(true);
    expect(checklistAllowsAccept({ ...all("met"), [REVIEW_CHECKS[3].key]: { decision: "not_met" } }))
      .toBe(false);
    const { [REVIEW_CHECKS[5].key]: _missing, ...rest } = all("met");
    expect(checklistAllowsAccept(rest)).toBe(false);
  });
});
