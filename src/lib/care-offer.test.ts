import { describe, expect, it } from "vitest";
import { ELDERCARE_FEES, eldercareTemplate, offerWords, optionTotals, scheduleRows } from "./care-offer";

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

describe("eldercare offer template", () => {
  const c = eldercareTemplate({
    preparedFor: "Wole Rasaq", careFor: "Mrs Rasaq", location: "Ikeja, Lagos", start: "After the home assessment", months: 3,
  });

  it("uses the published eldercare prices", () => {
    const visits = c.options.find((o) => o.id === "morning_visits")!;
    const liveIn = c.options.find((o) => o.id === "live_in")!;
    expect(visits.monthly).toBe(ELDERCARE_FEES.companionVisit * ELDERCARE_FEES.visitsPerMonth);
    expect(liveIn.monthly).toBe(ELDERCARE_FEES.liveIn);
  });

  it("talks about a caregiver, not a nurse or a baby", () => {
    const rows = scheduleRows(c, "MC-2610-0105-O1", c.options[0], "monthly");
    const text = JSON.stringify(rows) + offerWords(c).duties;
    expect(text).toContain("caregiver");
    expect(text).not.toMatch(/\bnurse\b|\bbaby\b/i);
  });
});
