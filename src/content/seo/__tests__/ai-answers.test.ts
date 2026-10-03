import { describe, expect, it } from "vitest";

import { AI_ANSWERS } from "../ai-answers";
import { GOVERNED_FEES, GOVERNED_MODULES, renderFeeTokens } from "../governed-modules";

const SERVED_MARKETS = ["Lagos", "Abuja", "FCT", "Ogun", "Ibadan", "Oyo"];
// Places that must never be described as served while the register says otherwise.
const UNSERVED_PLACES = ["Port Harcourt", "Rivers State", "Kano", "Enugu", "Kaduna", "Benin City"];
// Wording that would promise timing, availability or an outcome.
const FORBIDDEN_PROMISES = [
  /within \d+\s*(-|–|to)?\s*\d*\s*(minutes|hours|days|weeks)/i,
  /same day guarantee/i,
  /guarantee/i,
  /guaranteed/i,
  /24\/7 response/i,
  /immediately available/i,
  /cure/i,
  /best in nigeria/i,
];

describe("AI answer sheet", () => {
  it("has unique codes and non-empty questions", () => {
    const codes = AI_ANSWERS.map((record) => record.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const record of AI_ANSWERS) {
      expect(record.question.trim().endsWith("?")).toBe(true);
      expect(record.answer.length).toBeGreaterThan(80);
    }
  });

  it("cites governed modules that exist", () => {
    for (const record of AI_ANSWERS) {
      expect(record.sources.length).toBeGreaterThan(0);
      for (const code of record.sources) {
        expect(GOVERNED_MODULES[code], `${record.code} cites unknown module ${code}`).toBeTruthy();
      }
    }
  });

  it("only uses registered price tokens, never hard-coded amounts", () => {
    for (const record of AI_ANSWERS) {
      for (const [, sku] of record.answer.matchAll(/\{\{fee:([A-Z0-9-]+)\}\}/g)) {
        expect(GOVERNED_FEES[sku], `${record.code} references unregistered price ${sku}`).toBeTruthy();
      }
      expect(record.answer, `${record.code} writes a raw amount instead of a price token`).not.toMatch(/₦\d/);
      expect(renderFeeTokens(record.answer)).not.toContain("{{fee:");
    }
  });

  it("makes no timing, availability or outcome promises", () => {
    for (const record of AI_ANSWERS) {
      for (const pattern of FORBIDDEN_PROMISES) {
        expect(record.answer, `${record.code} matches forbidden wording ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("never claims coverage outside the served markets", () => {
    for (const record of AI_ANSWERS) {
      for (const place of UNSERVED_PLACES) {
        expect(record.answer, `${record.code} mentions unserved ${place}`).not.toContain(place);
      }
    }
    const coverage = AI_ANSWERS.find((record) => record.code === "QA-02");
    expect(coverage).toBeTruthy();
    for (const market of SERVED_MARKETS) {
      expect(coverage!.answer).toContain(market);
    }
  });

  it("keeps the emergency boundary explicit", () => {
    const emergency = AI_ANSWERS.find((record) => record.code === "QA-07");
    expect(emergency?.answer).toContain("not an emergency service");
  });
});
