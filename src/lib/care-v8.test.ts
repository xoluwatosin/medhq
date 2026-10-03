// The version 8 pre-assessment: what it asks, and how its new controls read back.
import { describe, expect, it } from "vitest";
import definition from "../../docs/care/pre-assessment-v8.json";
import { readAnswer, type CareField, type CareSection } from "@/lib/care";
import { presentationParts } from "@/lib/care-itinerary";

const sections = (definition as unknown as { sections: CareSection[] }).sections;
const section = (id: string) => sections.find((s) => s.id === id)!;
const field = (sectionId: string, fieldId: string) =>
  section(sectionId).fields.find((f) => f.id === fieldId)!;

describe("pre-assessment version 8", () => {
  it("no longer counts children or asks about them in one box", () => {
    const ids = section("svc_nanny_children").fields.map((f) => f.id);
    expect(ids).not.toContain("nn_children_count");
    expect(ids).not.toContain("nn_children");
  });

  it("asks whether childcare is clinical, non-clinical or both", () => {
    expect(field("svc_nanny_children", "nn_care_kind").options?.map((o) => o.value))
      .toEqual(["non_clinical", "clinical", "both"]);
  });

  it("still asks about health, medicines and allergies for non-clinical childcare", () => {
    const ids = section("svc_nanny_children").fields.map((f) => f.id);
    expect(ids).toContain("nn_health");
    expect(ids).toContain("nn_medicines_detail");
  });

  it("asks for an alternative contact's details together", () => {
    const contact = field("core_support", "alt_contact");
    expect(contact.type).toBe("contact_block");
    expect(field("core_support", "alt_contact_has").type).toBe("yes_no");
  });

  it("builds who will be there from the care recipients on the request", () => {
    expect(field("core_arrangements", "visit_attendees").optionsFrom).toBe("care_recipients");
  });

  it("offers dietary requirements, activities and comfort as grouped choices", () => {
    for (const id of ["nn_diet", "nn_activities", "nn_comfort"]) {
      const f = field("svc_nanny_children", id);
      expect(f.type).toBe("tag_list");
      expect((f.groups ?? []).length).toBeGreaterThan(1);
    }
  });

  it("breaks the childcare section into shorter screens", () => {
    const parts = presentationParts(section("svc_nanny_children"));
    expect(parts.length).toBeGreaterThan(4);
    expect(parts.every((p) => p.fields.length > 0)).toBe(true);
  });
});

describe("reading the new controls back", () => {
  it("names grouped choices and keeps a person's own words", () => {
    const diet = field("svc_nanny_children", "nn_diet");
    const first = (diet.groups ?? [])[0].options[0];
    expect(readAnswer(diet, { codes: [first.value], other: "No shellfish" }))
      .toBe(`${first.label}, No shellfish`);
  });

  it("reads one person's details as a single line", () => {
    const contact = field("core_support", "alt_contact") as CareField;
    expect(readAnswer(contact, {
      firstName: "Ada", lastName: "Obi", relationship: "Sister",
      phone: "08012345678", email: "ada@example.com",
    })).toBe("Ada Obi, Sister, 08012345678, ada@example.com");
  });
});
