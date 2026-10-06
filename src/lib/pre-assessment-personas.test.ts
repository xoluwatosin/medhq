// The pre-assessment as the people who actually fill it in.
//
// Each persona is assembled the way PreAssessment.tsx assembles the form: the
// request-wide pages, then each care recipient's pages, routed from the
// intake's facts and worded in that person's voice. The checks are the faults
// walk-throughs of these people found in versions 10 and 11. Set
// PERSONA_OUT to a folder to write each person's transcript for review.
import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  applicableSections, buildContext, withDerived, type CareDefinition, type CareField, type CareResponses, type CareSection,
} from "@/lib/care";
import {
  emptyIntake, intakeRoutingAnswers, sectionKeysFor, sectionScope, type CareIntake, type IntakeRecipient,
} from "@/lib/care-intake";
import { buildItinerary } from "@/lib/care-itinerary";
import { resolveCopy, voiceFor } from "@/lib/care-copy";

const def = JSON.parse(readFileSync("docs/care/pre-assessment-v14.json", "utf8")) as CareDefinition;
const NOW = new Date("2026-10-06");
const dob = (years: number) => `${2026 - years}-03-01`;

type R = Partial<IntakeRecipient> & { firstName: string; services: string[] };
interface Persona {
  id: string; clientGroup: string; service: string; recipients: R[]; request?: CareResponses;
  /** Answers given along the way that change what is asked next. */
  answers?: CareResponses;
}

const PERSONAS: Persona[] = [
  { id: "self-clinical", clientGroup: "adult", service: "clinical_home_care",
    recipients: [{ firstName: "Tosin", isEnquirer: true, dateOfBirth: dob(34), dobKnown: "yes", services: ["clinical_home_care"] }] },
  { id: "self-postnatal-and-baby", clientGroup: "maternal", service: "postnatal",
    recipients: [
      { firstName: "Ada", isEnquirer: true, dateOfBirth: dob(31), dobKnown: "yes", services: ["postnatal_mother"] },
      { firstName: "Zara", relationship: "Mother", dateOfBirth: "2026-09-20", dobKnown: "yes", services: ["newborn"] }] },
  { id: "self-antenatal", clientGroup: "maternal", service: "antenatal",
    recipients: [{ firstName: "Funmi", isEnquirer: true, dateOfBirth: dob(29), dobKnown: "yes", services: ["antenatal"] }] },
  { id: "daughter-for-mother", clientGroup: "older_person", service: "eldercare",
    recipients: [{ firstName: "Grace", relationship: "Daughter", dateOfBirth: dob(78), dobKnown: "yes", services: ["eldercare"] }] },
  { id: "son-abroad-for-father", clientGroup: "older_person", service: "eldercare", answers: { enquirer_location: "abroad" },
    recipients: [{ firstName: "Emeka", relationship: "Son", dobKnown: "no", approxAge: 80, services: ["eldercare"] }] },
  { id: "mother-nanny-two-children", clientGroup: "child", service: "nanny",
    recipients: [
      { firstName: "Tobi", relationship: "Mother", dateOfBirth: dob(4), dobKnown: "yes", services: ["nanny"] },
      { firstName: "Lola", relationship: "Mother", dateOfBirth: "2025-09-01", dobKnown: "yes", services: ["nanny"] }] },
  { id: "father-additional-needs", clientGroup: "child", service: "additional_needs",
    recipients: [{ firstName: "David", relationship: "Father", dateOfBirth: dob(7), dobKnown: "yes", services: ["additional_needs"] }] },
  { id: "grandmother-paediatric", clientGroup: "child", service: "paediatric",
    recipients: [{ firstName: "Obi", relationship: "Grandmother", dateOfBirth: dob(3), dobKnown: "yes", services: ["paediatric"] }] },
  { id: "wife-for-husband", clientGroup: "adult", service: "post_surgical",
    recipients: [{ firstName: "Tunde", relationship: "Wife", dateOfBirth: dob(52), dobKnown: "yes", services: ["post_surgical"] }] },
  { id: "self-post-surgical", clientGroup: "adult", service: "post_surgical",
    recipients: [{ firstName: "Segun", isEnquirer: true, dateOfBirth: dob(45), dobKnown: "yes", services: ["post_surgical"] }] },
  { id: "father-for-mother-and-baby", clientGroup: "maternal", service: "postnatal",
    recipients: [
      { firstName: "Ife", relationship: "Husband", dateOfBirth: dob(30), dobKnown: "yes", services: ["postnatal_mother"] },
      { firstName: "Ayo", relationship: "Father", dateOfBirth: "2026-09-25", dobKnown: "yes", services: ["newborn"] }] },
  { id: "neighbour-for-older-man", clientGroup: "older_person", service: "eldercare",
    recipients: [{ firstName: "Peter", relationship: "Neighbour", dobKnown: "no", approxAge: 85, services: ["eldercare"] }] },
  { id: "self-older-eldercare", clientGroup: "older_person", service: "eldercare",
    recipients: [{ firstName: "Folake", isEnquirer: true, dateOfBirth: dob(72), dobKnown: "yes", services: ["eldercare"] }] },
  { id: "self-undecided", clientGroup: "adult", service: "other",
    recipients: [{ firstName: "Yemi", isEnquirer: true, dateOfBirth: dob(40), dobKnown: "yes", services: ["other"] }] },
  // Omugwo: the new mother's own mother arranges care for her daughter and grandchild.
  { id: "grandmother-omugwo", clientGroup: "maternal", service: "postnatal",
    recipients: [
      { firstName: "Ada", relationship: "Mother", dateOfBirth: dob(31), dobKnown: "yes", services: ["postnatal_mother"] },
      { firstName: "Zara", relationship: "Grandmother", dateOfBirth: "2026-09-20", dobKnown: "yes", services: ["newborn"] }] },
  { id: "sister-for-mother-and-baby", clientGroup: "maternal", service: "postnatal",
    recipients: [
      { firstName: "Bisi", relationship: "Sister", dateOfBirth: dob(28), dobKnown: "yes", services: ["postnatal_mother"] },
      { firstName: "Tomi", relationship: "Aunt", dateOfBirth: "2026-09-28", dobKnown: "yes", services: ["newborn"] }] },
  { id: "self-postnatal-only", clientGroup: "maternal", service: "postnatal",
    recipients: [{ firstName: "Kemi", isEnquirer: true, dateOfBirth: dob(33), dobKnown: "yes", services: ["postnatal_mother"] }] },
  { id: "husband-for-wife-only", clientGroup: "maternal", service: "postnatal",
    recipients: [{ firstName: "Nkem", relationship: "Husband", dateOfBirth: dob(30), dobKnown: "yes", services: ["postnatal_mother"] }] },
  { id: "self-postnatal-twins", clientGroup: "maternal", service: "postnatal",
    recipients: [
      { firstName: "Joy", isEnquirer: true, dateOfBirth: dob(32), dobKnown: "yes", services: ["postnatal_mother"] },
      { firstName: "Taiwo", relationship: "Mother", dateOfBirth: "2026-09-22", dobKnown: "yes", services: ["newborn"] },
      { firstName: "Kehinde", relationship: "Mother", dateOfBirth: "2026-09-22", dobKnown: "yes", services: ["newborn"] }] },
  // A live-in newborn nanny, arranged before a baby born by surrogate arrives.
  { id: "surrogacy-newborn-nanny", clientGroup: "child", service: "nanny",
    request: { start_when: "specific", care_times: ["morning", "afternoon", "evening", "overnight"] },
    recipients: [{ firstName: "Baby", relationship: "Mother", dateOfBirth: "2026-11-20", dobKnown: "yes", expectedBirth: true, services: ["nanny"] }] },
  { id: "mother-newborn-nanny", clientGroup: "child", service: "nanny",
    recipients: [{ firstName: "Tobi", relationship: "Mother", dateOfBirth: "2026-09-28", dobKnown: "yes", services: ["nanny"] }] },
  { id: "mother-for-baby-only", clientGroup: "maternal", service: "postnatal",
    recipients: [{ firstName: "Dayo", relationship: "Mother", dateOfBirth: "2026-09-18", dobKnown: "yes", services: ["newborn"] }] },
];

interface Asked { recipient: string | null; field: CareField; text: string }

/** What one persona is asked, in order, worded for them. */
const walk = (p: Persona): Asked[] => {
  const intake: CareIntake = {
    ...emptyIntake(),
    recipients: p.recipients.map((r, i) => ({ id: `r${i + 1}`, lastName: "", ...r }) as IntakeRecipient),
  };
  const request: CareResponses = p.request ?? { start_when: "this_week" };
  const routing = (r: IntakeRecipient): CareResponses => withDerived({
    ...request, ...(p.answers ?? {}), ...intakeRoutingAnswers(intake, r), service_requested: sectionKeysFor(r)[0] ?? p.service,
  }, { recordedService: p.service, now: NOW });
  const sectionsFor = (r: IntakeRecipient): CareSection[] => {
    const found = new Map<string, CareSection>();
    for (const key of sectionKeysFor(r).length ? sectionKeysFor(r) : [p.service]) {
      const ctx = buildContext(def, {
        clientGroup: p.clientGroup, serviceKey: key, responses: { ...routing(r), service_requested: key }, now: NOW,
      });
      for (const s of applicableSections(def, ctx)) found.set(s.id, s);
    }
    return def.sections.filter((s) => found.has(s.id));
  };
  const out: Asked[] = [];
  const only = intake.recipients.length === 1 ? intake.recipients[0] : null;
  const requestVoice = only?.isEnquirer ? voiceFor({ who_for: "myself" }) : voiceFor(request, "the client");
  const groups = [
    { r: null as IntakeRecipient | null, sections: sectionsFor(intake.recipients[0]).filter((s) => sectionScope(s.id) === "request"), answers: request },
    ...intake.recipients.map((r) => ({ r, sections: sectionsFor(r).filter((s) => sectionScope(s.id) === "recipient"), answers: routing(r) })),
  ];
  for (const g of groups) {
    const voice = g.r
      ? voiceFor({
        who_for: g.r.isEnquirer ? "myself" : "someone_else",
        recipient_first_name: g.r.firstName,
        intake_newborn_names: g.answers.intake_newborn_names,
        is_parent_guardian: g.answers.intake_filler_parent === "yes" ? "yes" : undefined,
      })
      : requestVoice;
    for (const page of buildItinerary(g.sections, g.answers)) {
      if (page.kind === "cover") {
        out.push({ recipient: g.r?.firstName ?? null, field: { id: `section:${page.sectionId}` } as CareField, text: resolveCopy(page.title, voice) });
      }
      if (page.kind !== "questions") continue;
      for (const f of page.fields) {
        const text = [f.asked, f.help, ...(f.options ?? []).map((o) => o.label)].map((t) => resolveCopy(t ?? "", voice)).join(" | ");
        out.push({ recipient: g.r?.firstName ?? null, field: f, text });
      }
    }
  }
  return out;
};

const walks = Object.fromEntries(PERSONAS.map((p) => [p.id, walk(p)]));
const ids = (id: string, recipient?: string | null) =>
  walks[id].filter((a) => recipient === undefined || a.recipient === recipient).map((a) => a.field.id);

if (process.env.PERSONA_OUT) {
  mkdirSync(process.env.PERSONA_OUT, { recursive: true });
  for (const [id, asked] of Object.entries(walks)) {
    writeFileSync(`${process.env.PERSONA_OUT}/${id}.md`,
      asked.map((a) => (a.field.id.startsWith("section:") ? `\n## ${a.recipient ?? "Whole request"}: ${a.text}` : `- [${a.field.id}] ${a.text}`)).join("\n"));
  }
}

describe("pre-assessment v14, as the families who fill it in", () => {
  it("does not ask a mother, father or guardian whether they are the parent", () => {
    expect(ids("mother-nanny-two-children")).not.toContain("is_parent_guardian");
    expect(ids("father-additional-needs")).not.toContain("is_parent_guardian");
    expect(ids("father-for-mother-and-baby")).not.toContain("is_parent_guardian");
    expect(ids("self-postnatal-and-baby")).not.toContain("is_parent_guardian");
  });

  it("does not ask the baby's name or birth date again", () => {
    for (const id of ["self-postnatal-and-baby", "father-for-mother-and-baby"]) {
      expect(ids(id)).not.toContain("pn_baby_name");
      expect(ids(id)).not.toContain("pn_delivery_date");
    }
  });

  it("does not ask babies and toddlers about languages or knowing about the visit", () => {
    expect(ids("self-postnatal-and-baby", "Zara")).not.toContain("languages");
    expect(ids("self-postnatal-and-baby", "Zara")).not.toContain("child_knows_visit");
    expect(ids("mother-nanny-two-children", "Lola")).not.toContain("child_knows_visit");
    expect(ids("grandmother-paediatric", "Obi")).not.toContain("child_knows_visit");
    expect(ids("father-additional-needs", "David")).toContain("child_knows_visit");
  });

  it("asks household questions once, not for every person", () => {
    for (const id of ["self-postnatal-and-baby", "father-for-mother-and-baby", "mother-nanny-two-children"]) {
      for (const field of ["situation", "immediate_danger", "support_now", "alt_contact_has"]) {
        expect(ids(id).filter((f) => f === field).length, `${id} ${field}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("does not ask how soon support is needed after asking when care should begin", () => {
    for (const id of Object.keys(walks)) expect(ids(id), id).not.toContain("urgency");
  });

  it("never speaks of the person filling in by their own name", () => {
    const selfNames: Record<string, string> = {
      "self-clinical": "Tosin", "self-antenatal": "Funmi", "self-post-surgical": "Segun",
      "self-older-eldercare": "Folake", "self-undecided": "Yemi", "self-postnatal-and-baby": "Ada",
    };
    for (const [id, name] of Object.entries(selfNames)) {
      const named = walks[id].filter((a) => a.text.includes(name));
      expect(named.map((a) => a.field.id), id).toEqual([]);
      expect(walks[id].filter((a) => /the mother|the care recipient|we have noticed/i.test(a.text)).map((a) => a.field.id), id).toEqual([]);
    }
  });

  it("speaks to a mother about her own recovery, and about the baby by name", () => {
    const mother = walks["self-postnatal-and-baby"].find((a) => a.field.id === "pn_mother_recovery");
    expect(mother?.text).toContain("How is your recovery going?");
    const term = walks["self-postnatal-and-baby"].find((a) => a.field.id === "pn_baby_term");
    expect(term?.text).toContain("Was Zara born at term or early?");
    const wife = walks["father-for-mother-and-baby"].find((a) => a.field.id === "pn_mother_recovery");
    expect(wife?.text).toContain("How is Ife's recovery going?");
  });

  it("asks someone about their own falls in the second person", () => {
    const falls = walks["self-older-eldercare"].find((a) => a.field.id === "mb_falls");
    if (falls) expect(falls.text).toContain("Have you had a fall");
    const social = walks["self-older-eldercare"].find((a) => a.field.id === "ec_social");
    expect(social?.text).toContain("Who do you live with?");
  });
  it("does not ask a grandmother or aunt arranging omugwo who the baby's parent is", () => {
    for (const id of ["grandmother-omugwo", "sister-for-mother-and-baby"]) {
      expect(ids(id)).not.toContain("is_parent_guardian");
      expect(ids(id)).not.toContain("pr_holder_first_name");
    }
  });

  it("names the babies on the request in their mother's questions", () => {
    const text = (id: string, field: string) => walks[id].find((a) => a.field.id === field)?.text ?? "";
    expect(text("self-postnatal-and-baby", "pn_feeding")).toContain("How do you feed Zara?");
    expect(text("grandmother-omugwo", "pn_feeding")).toContain("How does Ada feed Zara?");
    expect(text("self-postnatal-twins", "pn_feeding")).toContain("How do you feed Taiwo and Kehinde?");
    expect(text("self-postnatal-and-baby", "pn_mother_support")).toContain("Care of Zara");
    expect(text("self-postnatal-only", "pn_delivery_date")).toContain("When was your baby born?");
    expect(text("husband-for-wife-only", "pn_delivery_date")).toContain("When was the baby born?");
    for (const id of Object.keys(walks)) {
      expect(walks[id].filter((a) => /\{[A-Za-z]+\}/.test(a.text)).map((a) => a.field.id), id).toEqual([]);
    }
  });
  it("asks someone who is not the parent whether the parents agree, not for their details", () => {
    expect(ids("grandmother-paediatric")).toContain("parent_consent");
    expect(ids("grandmother-paediatric")).not.toContain("is_parent_guardian");
    expect(ids("grandmother-paediatric")).not.toContain("pr_holder_first_name");
    for (const id of ["father-additional-needs", "mother-nanny-two-children", "grandmother-omugwo"]) {
      expect(ids(id), id).not.toContain("parent_consent");
    }
  });

  it("asks anyone arranging care for an adult one plain consent question", () => {
    for (const id of ["neighbour-for-older-man", "daughter-for-mother", "wife-for-husband", "grandmother-omugwo"]) {
      expect(ids(id).filter((f) => f === "recipient_consent").length, id).toBe(1);
      expect(ids(id), id).not.toContain("decision_authority");
    }
    expect(ids("self-clinical")).not.toContain("recipient_consent");
  });

  it("asks family abroad for their time zone and a local contact", () => {
    const abroad = ids("son-abroad-for-father");
    expect(abroad).toContain("enquirer_timezone");
    expect(abroad).toContain("local_contact");
    expect(abroad).not.toContain("alt_contact_has");
    expect(ids("daughter-for-mother")).toContain("enquirer_location");
    expect(ids("daughter-for-mother")).not.toContain("local_contact");
    expect(ids("self-older-eldercare")).not.toContain("enquirer_location");
  });

  it("asks older people how they like to be addressed", () => {
    expect(walks["self-older-eldercare"].find((a) => a.field.id === "address_as")?.text).toContain("How would you like to be addressed?");
    expect(walks["neighbour-for-older-man"].find((a) => a.field.id === "address_as")?.text).toContain("How would Peter like to be addressed?");
    expect(ids("self-clinical")).not.toContain("address_as");
  });

  it("helps someone unsure of the service say what is needed", () => {
    expect(ids("self-undecided")).toContain("ot_help_areas");
    expect(ids("self-undecided")).not.toContain("ot_what");
  });

  it("never asks the same question twice for one person", () => {
    for (const [id, asked] of Object.entries(walks)) {
      const seen = new Map<string, number>();
      for (const a of asked) {
        if (a.field.id.startsWith("section:")) continue;
        const key = `${a.recipient}:${a.field.id}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      expect([...seen].filter(([, n]) => n > 1).map(([k]) => k), id).toEqual([]);
    }
  });

  it("asks household and nanny-role questions once, however many people are on the request", () => {
    for (const field of ["childcare_now", "nn_pattern", "nn_priorities", "enquirer_location"]) {
      expect(ids("mother-nanny-two-children").filter((f) => f === field).length, field).toBeLessThanOrEqual(1);
    }
  });
  it("asks about a baby not born yet in a way that makes sense", () => {
    const asked = ids("surrogacy-newborn-nanny");
    for (const odd of ["nn_naps", "nn_toileting", "nn_activities", "nn_diet_has", "regular_medicines", "allergies",
      "hospital_recent", "languages", "communication_support", "child_knows_visit", "nn_duties_child", "nn_overnight"]) {
      expect(asked, odd).not.toContain(odd);
    }
    for (const needed of ["nb_start", "nb_birth_place", "nb_feeding", "nb_tasks", "nb_nights", "nb_sleep_place", "expected_notes", "nn_pattern", "nn_experience"]) {
      expect(asked, needed).toContain(needed);
    }
  });

  it("asks a newborn's nanny about feeds and nights, not a toddler's day", () => {
    const asked = ids("mother-newborn-nanny");
    expect(asked).toContain("nb_feeding");
    expect(asked).toContain("nb_nights");
    expect(asked).not.toContain("nb_start");
    expect(asked).not.toContain("nn_naps");
    expect(asked).toContain("regular_medicines");
    expect(ids("mother-nanny-two-children", "Tobi")).not.toContain("nb_feeding");
  });
});
