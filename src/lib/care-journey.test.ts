// The journey a family is actually walked through.
//
// These read the published pre-assessment the way the screen does: the answers
// decide who the care is for, how old they are and what is being asked for,
// and the sections follow from that. A person answering for themselves is
// never asked a question written about somebody else.
import { describe, expect, it } from "vitest";
import definitionJson from "../../docs/care/pre-assessment-v3.json";
import {
  applicableSections, buildContext, derivedFacts, fieldVisible, pruneHiddenFieldAnswers, withoutDerived,
  type CareDefinition, type CareResponses,
} from "@/lib/care";
import { resolveCopy, voiceFor } from "@/lib/care-copy";

const definition = definitionJson as unknown as CareDefinition;

const journey = (responses: CareResponses, serviceKey: string | null = null) => {
  const ctx = buildContext(definition, {
    clientGroup: null,
    serviceKey,
    responses,
    now: new Date("2026-01-01T00:00:00Z"),
  });
  const sections = applicableSections(definition, ctx);
  return {
    ctx,
    ids: sections.map((s) => s.id),
    fields: sections.flatMap((s) => s.fields.filter((f) => fieldVisible(f, ctx.responses))),
  };
};

describe("derived routing facts", () => {
  it("reads age from a date of birth, in bands", () => {
    const at = (dob: string) =>
      derivedFacts({ date_of_birth: dob }, { now: new Date("2026-01-01T00:00:00Z") }).derived_age_band;
    expect(at("2025-12-20")).toBe("newborn");
    expect(at("2025-06-01")).toBe("infant");
    expect(at("2020-01-01")).toBe("child");
    expect(at("1990-01-01")).toBe("adult");
    expect(at("1950-01-01")).toBe("older_person");
  });

  it("falls back to an approximate age only when the date is not known", () => {
    const facts = derivedFacts({ dob_known: "no", approx_age: 70 });
    expect(facts.derived_age_years).toBe(70);
    expect(facts.derived_age_band).toBe("older_person");
    expect(derivedFacts({ approx_age: 70 }).derived_age_band).toBe("unknown");
  });

  it("raises a disagreement rather than choosing between the service asked for and the one recorded", () => {
    const facts = derivedFacts({ service_requested: "eldercare" }, { recordedService: "nanny" });
    expect(facts.derived_service_conflict).toBe("yes");
    const settled = derivedFacts(
      { service_requested: "eldercare", service_confirmed: "eldercare" },
      { recordedService: "nanny" },
    );
    expect(settled.derived_service_conflict).toBe("no");
    expect(settled.derived_service).toBe("eldercare");
  });

  it("raises a disagreement when the service cannot belong to this person", () => {
    expect(
      derivedFacts({ who_for: "myself", date_of_birth: "2020-01-01" }).derived_service_conflict,
    ).toBe("yes");
    expect(
      derivedFacts({ service_requested: "nanny", date_of_birth: "1980-01-01" }, { now: new Date("2026-01-01T00:00:00Z") })
        .derived_service_conflict,
    ).toBe("yes");
  });

  it("never lets a derived fact be stored as an answer", () => {
    const stored = withoutDerived({ who_for: "myself", derived_is_self: "yes" });
    expect(stored).toEqual({ who_for: "myself" });
  });
});

describe("the journey a person answering for themselves is given", () => {
  const self: CareResponses = {
    who_for: "myself",
    date_of_birth: "1948-04-02",
    service_requested: "eldercare",
    service_confirmed: "eldercare",
  };

  it("is never asked about a nanny or a child", () => {
    const { ids } = journey(self);
    expect(ids).not.toContain("svc_nanny_children");
    expect(ids).not.toContain("svc_nanny_role");
    expect(ids).not.toContain("decisions_child");
    expect(ids).toContain("svc_eldercare");
  });

  it("is asked in the second person, with nothing left unresolved", () => {
    const voice = voiceFor(self);
    const { fields } = journey(self);
    for (const field of fields) {
      const asked = resolveCopy(field.asked, voice);
      expect(asked).not.toMatch(/\{[A-Za-z]+\}/);
      expect(asked.toLowerCase()).not.toMatch(/\bthe person receiving care\b/);
    }
  });
});

describe("the journey age controls", () => {
  it("takes a newborn down the baby route, not the adult one", () => {
    const { ids, ctx } = journey({
      who_for: "someone_else",
      date_of_birth: "2025-12-20",
      service_requested: "postnatal",
      service_confirmed: "postnatal",
      pn_delivery_date: "2025-12-20",
    });
    expect(ctx.responses.derived_recipient_group).toBe("baby");
    expect(ids).toContain("svc_postnatal_baby");
    expect(ids).not.toContain("decisions_adult");
  });

  it("asks who decides only when somebody is arranging care for another person", () => {
    expect(journey({ who_for: "myself", date_of_birth: "1990-01-01", service_confirmed: "clinical_home_care" }).ids)
      .not.toContain("decisions_adult");
    expect(journey({ who_for: "someone_else", date_of_birth: "1940-01-01", service_confirmed: "eldercare" }).ids)
      .toContain("decisions_adult");
    expect(journey({ who_for: "someone_else", date_of_birth: "2018-01-01", service_confirmed: "nanny" }).ids)
      .toContain("decisions_child");
  });
});

describe("the questions everybody is asked", () => {
  it("always opens on the routing questions and closes on consent", () => {
    const { ids } = journey({});
    expect(ids[0]).toBe("route");
    expect(ids[ids.length - 1]).toBe("consent");
  });

  it("does not open a service section before the service is settled", () => {
    const { ids } = journey({});
    expect(ids.filter((id) => id.startsWith("svc_"))).toHaveLength(0);
  });
});

describe("conditional answer cleanup", () => {
  it("removes an allergy detail after the answer changes to no", () => {
    const fields = [
      { id: "allergies", record: "Allergies", asked: "Do you have allergies?", type: "choice" as const },
      {
        id: "allergy_details",
        record: "Allergy details",
        asked: "What are the allergies?",
        type: "text" as const,
        showWhen: { field: "allergies", in: ["yes"] },
      },
    ];
    expect(pruneHiddenFieldAnswers(fields, { allergies: "no", allergy_details: "Penicillin" }))
      .toEqual({ allergies: "no", allergy_details: null });
  });

  it("keeps a follow-up while its opening answer still applies", () => {
    const fields = [
      { id: "medicines", record: "Medicines", asked: "Do you take medicines?", type: "choice" as const },
      {
        id: "medicine_details",
        record: "Medicine details",
        asked: "Which medicines?",
        type: "text" as const,
        showWhen: { field: "medicines", in: ["yes"] },
      },
    ];
    expect(pruneHiddenFieldAnswers(fields, { medicines: "yes", medicine_details: "Recorded medicine" }))
      .toEqual({ medicines: "yes", medicine_details: "Recorded medicine" });
  });
});
