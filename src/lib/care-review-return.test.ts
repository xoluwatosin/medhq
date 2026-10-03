// Returning an assessment, and answering a proposal. The screen applies the
// same rules the database applies.
import { describe, expect, it } from "vitest";
import {
  checkNeedsNote, checklistAllowsAccept, checklistNotesComplete, RETURN_CATEGORIES,
  RETURN_PRIORITIES, REVIEW_CHECKS, returnReady, type ReviewChecklist,
} from "@/lib/care-assessment";
import { RESPONSE_CHOICES } from "@/lib/care-proposal";
import { fieldCarry, type CareCarry, type CareField } from "@/lib/care";

const all = (decision: "met" | "not_met" | "not_applicable"): ReviewChecklist =>
  Object.fromEntries(REVIEW_CHECKS.map((c) => [c.key, { decision }]));

describe("a check that is not met", () => {
  it("needs a note, and only then", () => {
    expect(checkNeedsNote({ decision: "not_met" })).toBe(true);
    expect(checkNeedsNote({ decision: "not_met", note: "  " })).toBe(true);
    expect(checkNeedsNote({ decision: "not_met", note: "Medicines missing" })).toBe(false);
    expect(checkNeedsNote({ decision: "met" })).toBe(false);
    expect(checkNeedsNote(undefined)).toBe(false);
  });

  it("holds up the whole checklist until it is written", () => {
    const checklist = { ...all("met"), [REVIEW_CHECKS[2].key]: { decision: "not_met" as const } };
    expect(checklistNotesComplete(checklist)).toBe(false);
    expect(checklistAllowsAccept(checklist)).toBe(false);
  });
});

describe("returning an assessment", () => {
  const full = {
    reason: "Medicines are not complete",
    category: RETURN_CATEGORIES[4].value,
    instructions: "List every medicine with its dose",
    priority: RETURN_PRIORITIES[1].value,
  };

  it("needs a category, a reason, instructions and a priority", () => {
    expect(returnReady(full)).toBe(true);
    expect(returnReady({ ...full, category: undefined })).toBe(false);
    expect(returnReady({ ...full, reason: "   " })).toBe(false);
    expect(returnReady({ ...full, instructions: "" })).toBe(false);
  });

  it("offers the seven categories and three priorities the server accepts", () => {
    expect(RETURN_CATEGORIES).toHaveLength(7);
    expect(RETURN_PRIORITIES.map((p) => p.value)).toEqual(["routine", "important", "urgent"]);
  });
});

describe("answering a proposal", () => {
  it("offers exactly agree, request changes and need a call", () => {
    expect(RESPONSE_CHOICES.map((c) => c.value))
      .toEqual(["agreed", "changes_requested", "call_requested"]);
    expect(RESPONSE_CHOICES.map((c) => c.label))
      .toEqual(["Agree", "Request changes", "Need a call"]);
  });
});

describe("carried answers are grouped by what the definition says they are", () => {
  const field = (id: string, carry?: CareCarry): CareField =>
    ({ id, record: id, asked: id, type: "text", ...(carry ? { carry } : {}) });

  it("keeps operational and consent answers out of clinical evidence", () => {
    const fields = [
      field("obs", "clinical_evidence"), field("why", "context"),
      field("when", "operational"), field("consent", "authority_consent"),
      field("plain"),
    ];
    const of = (kind: CareCarry) => fields.filter((f) => fieldCarry(f) === kind).map((f) => f.id);
    expect(of("clinical_evidence")).toEqual(["obs"]);
    expect(of("context")).toEqual(["why", "plain"]);
    expect(of("operational")).toEqual(["when"]);
    expect(of("authority_consent")).toEqual(["consent"]);
  });
});
