import { describe, expect, it } from "vitest";
import { careRequestRows, phoneCountry } from "@/lib/enquiry-summary";

const read = (answers: Record<string, unknown>) =>
  Object.fromEntries(careRequestRows(answers, (k) => k ?? "").map((r) => [r.label, r.value]));

describe("a care request on the enquiry desk", () => {
  it("reads a request someone made for themselves", () => {
    const rows = read({ for_whom: "For me", who_needs_care: "an adult", kind_of_care: "Clinical home care", how_soon: "This week", confirmed_from_page: "", prior_interests: ["eldercare"] });
    expect(rows["Who the care is for"]).toBe("The person enquiring (an adult)");
    expect(rows["How they chose it"]).toBe("Chose from the list of care");
    expect(rows["Also looked at"]).toBe("Eldercare and companion care");
  });

  it("says plainly when who the care is for was not asked", () => {
    const rows = read({ for_whom: "", who_needs_care: "", kind_of_care: "Eldercare and companion care", how_soon: "Within 48 hours", confirmed_from_page: "Eldercare and companion care (confirmed)", prior_interests: [] });
    expect(rows["Who the care is for"]).toBe("Not asked");
    expect(rows["How they chose it"]).toBe("Chose eldercare and companion care from its own page");
    expect(rows["Also looked at"]).toBeUndefined();
  });

  it("reads a request for a relative", () => {
    const rows = read({ for_whom: "For someone else", who_needs_care: "An older person", kind_of_care: "Eldercare and companion care" });
    expect(rows["Who the care is for"]).toBe("Someone else: an older person");
    expect(read({ for_whom: "For themselves", who_needs_care: "Themselves, an older person" })["Who the care is for"])
      .toBe("The person enquiring (an older person)");
  });

  it("names the country a family is calling from", () => {
    expect(phoneCountry("+44 7700 900123")).toBe("United Kingdom");
    expect(phoneCountry("+234 8063906034")).toBe("Nigeria");
    expect(phoneCountry(null)).toBeNull();
  });
});
