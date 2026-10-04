import { describe, expect, it } from "vitest";
import { EXPANSION_PAGES } from "@/content/seo/expansion-pages";
import { GOVERNED_FEES, GOVERNED_MODULES } from "@/content/seo/governed-modules";

const genericPlaceholders = [
  "The formal assessment confirms the plan, professional scope and service arrangement.",
  "Requirements are scoped and agreed with the organisation before deployment.",
  "Start with the specific need addressed by",
];

describe("expansion SEO content quality", () => {
  it("keeps exactly 66 unique expansion routes, the eight merged routes excluded", () => {
    expect(EXPANSION_PAGES).toHaveLength(66);
    expect(new Set(EXPANSION_PAGES.map((page) => page.path)).size).toBe(66);
  });

  it("gives every page a unique direct answer", () => {
    const answers = EXPANSION_PAGES.map((page) => page.intro.join(" "));
    expect(answers.every((text) => text.length >= 120)).toBe(true);
    expect(new Set(answers).size).toBe(EXPANSION_PAGES.length);
    expect(answers.some((text) => genericPlaceholders.some((placeholder) => text.includes(placeholder)))).toBe(false);
  });

  it("answers every question page with decision guidance", () => {
    const questions = EXPANSION_PAGES.filter((page) => page.h1.endsWith("?"));
    expect(questions.length).toBeGreaterThan(0);
    for (const page of questions) {
      expect(page.answerHeading).toBe("The short answer");
      expect(page.answerPoints.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps work routes accurate and candidate registration qualified", () => {
    const jobs = EXPANSION_PAGES.filter((page) => page.template === "jobs");
    for (const page of jobs) expect(page.intro.join(" ").toLowerCase()).toContain("not an offer");
    // Candidate registration lives on /careers; the old pool route redirects there.
    expect(EXPANSION_PAGES.find((page) => page.path === "/medic-connect-talent-pool")).toBeUndefined();
  });

  it("uses only governed module and fee references", () => {
    for (const page of EXPANSION_PAGES) {
      for (const code of page.moduleCodes) expect(GOVERNED_MODULES[code]).toBeDefined();
      for (const sku of page.feeSkus) expect(GOVERNED_FEES[sku]).toBeDefined();
    }
  });
});
