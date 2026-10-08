import { describe, expect, it } from "vitest";
import { optionTotals } from "./care-offer";

const opt = (monthly: number) => ({ id: "a", title: "A", staffing: "", monthly, summary: "", goodFor: [], consider: [] });

describe("optionTotals", () => {
  it("keeps the agreed upfront prices", () => {
    expect(optionTotals(opt(769000), 4, 5).upfront).toBe(2922000);
    expect(optionTotals(opt(1454000), 4, 5).upfront).toBe(5525000);
  });

  it("never charges more upfront than the full fee on small sums", () => {
    const t = optionTotals(opt(1200), 4, 5);
    expect(t.upfront).toBe(4560);
    expect(t.saving).toBe(240);
  });
});
