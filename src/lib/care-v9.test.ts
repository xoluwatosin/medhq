// The version 9 pre-assessment: the childcare gaps closed, and the grouped
// contact that has to be given in full.
import { describe, expect, it } from "vitest";
import definition from "../../docs/care/pre-assessment-v9.json";
import { answerComplete, type CareField, type CareSection } from "@/lib/care";
import { serviceConflicts, type IntakeRecipient } from "@/lib/care-intake";

const sections = (definition as unknown as { sections: CareSection[] }).sections;
const section = (id: string) => sections.find((s) => s.id === id)!;
const field = (sectionId: string, fieldId: string) =>
  section(sectionId).fields.find((f) => f.id === fieldId)!;
const ids = (sectionId: string) => section(sectionId).fields.map((f) => f.id);

describe("pre-assessment version 9", () => {
  it("asks about the nursery or school only where the duties call for it", () => {
    const attends = field("svc_nanny_children", "nn_setting_attends");
    expect(attends.showWhen).toMatchObject({ field: "nn_duties_child" });
    expect(ids("svc_nanny_children")).toEqual(
      expect.arrayContaining(["nn_setting_area", "nn_setting_term"]),
    );
  });

  it("opens dietary requirements with a plain yes, no or not sure", () => {
    expect(field("svc_nanny_children", "nn_diet_has").options?.map((o) => o.value))
      .toEqual(["yes", "no", "not_sure"]);
    const list = field("svc_nanny_children", "nn_diet");
    expect((list.groups ?? []).map((g) => g.label)).toEqual([
      "Food allergies",
      "Intolerances",
      "Medically advised diets",
      "Religious or cultural",
      "Vegetarian or vegan",
      "Texture and feeding support",
    ]);
    expect(list.source).toBe("allergies");
  });

  it("asks about waking in the night and where the child sleeps", () => {
    expect(ids("svc_nanny_children")).toEqual(
      expect.arrayContaining(["nn_night_waking", "nn_sleep_arrangement"]),
    );
  });

  it("asks about overnight care on its own rather than inside the duties", () => {
    expect(ids("svc_nanny_role")).toEqual(
      expect.arrayContaining(["nn_overnight", "nn_overnight_nights"]),
    );
    expect(field("svc_nanny_role", "nn_duties").options?.map((o) => o.value))
      .not.toContain("overnight");
  });

  it("follows each safety need with what happens and what helps", () => {
    const list = ids("svc_nanny_children");
    expect(list).toContain("nn_safety_seizures_what");
    expect(list).toContain("nn_safety_seizures_helps");
    expect(list).not.toContain("nn_safety_detail");
    expect(field("svc_nanny_children", "nn_safety_seizures_what").showWhen)
      .toMatchObject({ field: "nn_safety_areas" });
  });

  it("needs every part of an alternative contact, not only a name", () => {
    const contact = field("core_support", "alt_contact") as CareField;
    expect(contact.requiredParts).toEqual(["firstName", "lastName", "relationship", "phone"]);
    expect(answerComplete(contact, { firstName: "Ada" })).toBe(false);
    expect(answerComplete(contact, {
      firstName: "Ada", lastName: "Obi", relationship: "Sister", phone: "08012345678",
    })).toBe(true);
  });
});

describe("childcare on an adult record", () => {
  it("is reported as a conflict to resolve", () => {
    const recipient: IntakeRecipient = {
      id: "r1",
      firstName: "John",
      lastName: "Brown",
      relationship: "Father",
      dobKnown: "yes",
      dateOfBirth: "1960-04-02",
      services: ["nanny"],
    };
    expect(serviceConflicts(recipient).length).toBeGreaterThan(0);
  });
});
