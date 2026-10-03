import { describe, expect, it } from "vitest";
import {
  ALLERGENS,
  ALLERGEN_GROUPS,
  CLINICAL_LISTS,
  CONDITIONS,
  CONDITION_GROUPS,
  MEDICINES,
  MEDICINE_GROUPS,
  allergenLabel,
  conditionLabel,
  groupedTerms,
  medicineLabel,
  searchTerms,
  toClinicalCode,
  type ClinicalTerm,
  type TermGroup,
} from "@/lib/care-clinical-lists";

const lists: Array<[string, ClinicalTerm[], TermGroup[]]> = [
  ["medicines", MEDICINES, MEDICINE_GROUPS],
  ["allergens", ALLERGENS, ALLERGEN_GROUPS],
  ["conditions", CONDITIONS, CONDITION_GROUPS],
];

describe("the universal clinical lists", () => {
  it.each(lists)("%s hold no repeated code", (_name, terms) => {
    const codes = terms.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it.each(lists)("%s name a group that exists", (_name, terms, groups) => {
    const known = new Set(groups.map((g) => g.code));
    for (const t of terms) expect(known.has(t.group)).toBe(true);
  });

  it.each(lists)("%s hold a code and words to read for every entry", (_name, terms) => {
    for (const t of terms) {
      expect(t.code).toMatch(/^[a-z0-9_]+$/);
      expect(t.label.trim().length).toBeGreaterThan(0);
      expect(t.code).toBe(toClinicalCode(t.label));
    }
  });

  it("is substantial enough to be useful", () => {
    expect(MEDICINES.length).toBeGreaterThan(250);
    expect(ALLERGENS.length).toBeGreaterThan(70);
    expect(CONDITIONS.length).toBeGreaterThan(180);
  });

  it("reads a stored code back as its label, and keeps an unknown code visible", () => {
    expect(medicineLabel("paracetamol")).toBe("Paracetamol");
    expect(allergenLabel("peanut")).toBe("Peanut");
    expect(conditionLabel("sickle_cell_disease")).toBe("Sickle cell disease");
    expect(conditionLabel("something_retired")).toContain("Not on the list");
    expect(conditionLabel(null)).toBe("Not recorded");
  });

  it("finds a medicine by the name a family would type", () => {
    expect(searchTerms(MEDICINES, "panadol").map((t) => t.code)).toContain("paracetamol");
    expect(searchTerms(MEDICINES, "coartem").map((t) => t.code)).toContain(
      "artemether_with_lumefantrine",
    );
    expect(searchTerms(MEDICINES, "ventolin").map((t) => t.code)).toContain("salbutamol");
    expect(searchTerms(ALLERGENS, "groundnut").map((t) => t.code)).toContain("peanut");
  });

  it("prefers a label match over a synonym match", () => {
    const [first] = searchTerms(MEDICINES, "aspirin");
    expect(first.code).toBe("aspirin");
  });

  it("browses the whole list when nothing has been typed", () => {
    expect(searchTerms(CONDITIONS, "", 5)).toHaveLength(5);
  });

  it.each(lists)("%s arrange under their groups", (_name, terms, groups) => {
    const grouped = groupedTerms(terms, groups);
    const counted = grouped.reduce((sum, g) => sum + g.terms.length, 0);
    expect(counted).toBe(terms.length);
  });

  it("exposes the three lists by the control that uses them", () => {
    expect(Object.keys(CLINICAL_LISTS).sort()).toEqual(["allergen", "condition", "medicine"]);
  });
});
