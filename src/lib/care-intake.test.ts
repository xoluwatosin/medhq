import { describe, expect, it } from "vitest";
import {
  answersForRecipient, blankRecipient, CARE_SERVICES, emptyIntake, incompleteIntakeSteps, intakeSteps, intakeSummary,
  mergeIntakeSeed, readScopedKey, recipientBand, scopedKey, sectionKeysFor, sectionScope,
  serviceConflicts, serviceIntentions, stepProblems,
  type CareIntake, type IntakeRecipient,
} from "@/lib/care-intake";

const NOW = new Date("2026-09-14T00:00:00Z");

const person = (over: Partial<IntakeRecipient> = {}): IntakeRecipient => ({
  id: "r1",
  firstName: "Amara",
  lastName: "Okafor",
  relationship: "Mother",
  dobKnown: "yes",
  dateOfBirth: "1990-01-01",
  services: ["postnatal_mother"],
  ...over,
});

const intakeWith = (recipients: IntakeRecipient[], over: Partial<CareIntake> = {}): CareIntake => ({
  ...emptyIntake(),
  enquirer: { firstName: "Ngozi", lastName: "Eze", phone: "08120000000", email: "ngozi@example.com" },
  forWhom: recipients.length > 1 ? "several" : "other",
  enquirerReceivesCare: "no",
  recipients,
  ...over,
});

describe("service list", () => {
  it("lists each service independently so routing is exact", () => {
    const values = CARE_SERVICES.map((s) => s.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toContain("postnatal_mother");
    expect(values).toContain("newborn");
    expect(values).toContain("paediatric");
  });
});

describe("steps and branching", () => {
  it("asks for details, then who the request is for", () => {
    const steps = intakeSteps(emptyIntake()).map((s) => s.id);
    expect(steps.slice(0, 2)).toEqual(["enquirer", "for_whom"]);
  });

  it("does not ask whether the enquirer receives care unless several people do", () => {
    const one = intakeSteps({ ...emptyIntake(), forWhom: "other" }).map((s) => s.id);
    expect(one).not.toContain("enquirer_receives_care");
    const many = intakeSteps({ ...emptyIntake(), forWhom: "several" }).map((s) => s.id);
    expect(many).toContain("enquirer_receives_care");
  });

  it("keeps service selection on each recipient and never adds a separate assignment step", () => {
    const eldercare = intakeWith([person({ services: ["eldercare"], dateOfBirth: "1940-01-01" })]);
    expect(intakeSteps(eldercare).map((s) => s.id)).not.toContain("service_people");
    const nanny = intakeWith([person({ services: ["nanny"] })]);
    expect(intakeSteps(nanny).map((s) => s.id)).not.toContain("service_people");
  });
});

describe("step rules", () => {
  it("requires the enquirer's email", () => {
    const problems = stepProblems(emptyIntake(), "enquirer");
    expect(problems.email).toBeTruthy();
  });

  it("requires a first name and a last name for each care recipient", () => {
    const problems = stepProblems(intakeWith([person({ firstName: "", lastName: "" })]), "recipients", NOW);
    expect(problems["r1.firstName"]).toBeTruthy();
    expect(problems["r1.lastName"]).toBeTruthy();
  });

  it("requires at least one service for each care recipient", () => {
    const problems = stepProblems(intakeWith([person({ services: [] })]), "recipients", NOW);
    expect(problems["r1.services"]).toBeTruthy();
  });

  it("does not ask a relationship of the person asking", () => {
    const self = person({ isEnquirer: true, relationship: undefined });
    const problems = stepProblems(intakeWith([self], { forWhom: "myself" }), "recipients", NOW);
    expect(problems["r1.relationship"]).toBeUndefined();
  });

  it("accepts an approximate age when the date of birth is unknown", () => {
    const r = person({ dobKnown: "no", dateOfBirth: undefined, approxAge: 82, services: ["eldercare"] });
    const problems = stepProblems(intakeWith([r]), "recipients", NOW);
    expect(problems["r1.approxAge"]).toBeUndefined();
    expect(recipientBand(r, NOW)).toBe("older_person");
  });
});

describe("service conflicts", () => {
  it("reports a service that cannot apply to the age recorded", () => {
    const child = person({ dateOfBirth: "2020-01-01", services: ["eldercare"] });
    expect(serviceConflicts(child, NOW).map((c) => c.service)).toEqual(["eldercare"]);
  });

  it("reassigns nothing automatically", () => {
    const child = person({ dateOfBirth: "2020-01-01", services: ["eldercare"] });
    serviceConflicts(child, NOW);
    expect(child.services).toEqual(["eldercare"]);
  });

  it("accepts newborn care for a newborn", () => {
    const baby = person({ dateOfBirth: "2026-09-01", services: ["newborn"] });
    expect(serviceConflicts(baby, NOW)).toEqual([]);
  });
});

describe("service intentions", () => {
  it("records a service chosen for more than one person as shared", () => {
    const intake = intakeWith([
      person({ id: "r1", services: ["clinical_home_care"] }),
      person({ id: "r2", services: ["clinical_home_care"] }),
    ]);
    const [intention] = serviceIntentions(intake);
    expect(intention.shared).toBe(true);
    expect(intention.recipientIds).toEqual(["r1", "r2"]);
  });

  it("records a service chosen for one person as not shared", () => {
    const intake = intakeWith([
      person({ id: "r1", services: ["postnatal_mother"] }),
      person({ id: "r2", services: ["eldercare"], dateOfBirth: "1940-01-01" }),
    ]);
    expect(serviceIntentions(intake).every((i) => i.shared === false)).toBe(true);
  });
});

describe("summary", () => {
  it("reads as plain words", () => {
    const intake = intakeWith([
      person({ id: "r1", firstName: "Amara", lastName: "Okafor" }),
      person({ id: "r2", firstName: "Mrs", lastName: "Okafor", services: ["eldercare"], dateOfBirth: "1940-01-01" }),
    ]);
    expect(intakeSummary(intake).map((s) => s.line)).toEqual([
      "Postnatal care and Omugwo (mother) for Amara Okafor",
      "Eldercare and companion care for Mrs Okafor",
    ]);
  });
});

describe("answer ownership", () => {
  it("asks request-wide sections once and person sections per person", () => {
    expect(sectionScope("core_arrangements")).toBe("request");
    expect(sectionScope("consent")).toBe("request");
    expect(sectionScope("core_health")).toBe("recipient");
  });

  it("does not ask the legacy routing sections after intake", () => {
    expect(sectionScope("route")).toBe("intake");
    expect(sectionScope("route_service")).toBe("intake");
  });

  it("keeps one person's answers away from another's", () => {
    const responses = {
      visit_lga: "Eti-Osa",
      r1__allergies: "yes",
      r2__allergies: "no",
    };
    expect(answersForRecipient(responses, "r1")).toEqual({ visit_lga: "Eti-Osa", allergies: "yes" });
    expect(answersForRecipient(responses, "r2")).toEqual({ visit_lga: "Eti-Osa", allergies: "no" });
  });

  it("round-trips a scoped key", () => {
    expect(readScopedKey(scopedKey("r3", "allergies"))).toEqual({ recipientId: "r3", fieldId: "allergies" });
    expect(readScopedKey("allergies")).toEqual({ recipientId: null, fieldId: "allergies" });
  });

  it("keeps maternal postnatal and newborn routes separate", () => {
    const r = person({ services: ["postnatal_mother", "newborn"] });
    expect(sectionKeysFor(r)).toEqual(["postnatal", "newborn"]);
  });
});

describe("recipient identifiers", () => {
  it("never reuses an identifier already taken", () => {
    const existing = [person({ id: "r1" }), person({ id: "r2" })];
    expect(blankRecipient(existing).id).toBe("r3");
  });
});

describe("request intake seed", () => {
  it("fills request facts but preserves answers already saved by the family", () => {
    const seeded = mergeIntakeSeed({
      enquirer: { firstName: "Ada", lastName: "Eze", phone: "0801", email: "ada@example.com" },
      forWhom: "other",
      recipients: [person({ firstName: "John", lastName: "Brown", services: ["eldercare"] })],
    }, intakeWith([person({ firstName: "Jonathan", services: ["clinical_home_care"] })]));
    expect(seeded.enquirer.firstName).toBe("Ngozi");
    expect(seeded.recipients[0].firstName).toBe("Jonathan");
    expect(seeded.recipients[0].lastName).toBe("Okafor");
    expect(seeded.recipients[0].services).toEqual(["clinical_home_care"]);
  });

  it("identifies only genuinely incomplete intake steps", () => {
    expect(incompleteIntakeSteps(intakeWith([person()]))).toEqual([]);
    expect(incompleteIntakeSteps(emptyIntake())).toEqual(["enquirer", "for_whom"]);
  });
});
