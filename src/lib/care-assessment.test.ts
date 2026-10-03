// What counts as dealt with in a visit, and what a decision is allowed to be.
import { describe, expect, it } from "vitest";
import {
  assessmentComplete, confirmFieldId, noteFieldId, readConfirm, sectionProgress,
  type AssessmentSection,
} from "@/lib/care-assessment";

const section: AssessmentSection = {
  id: "core_a",
  title: "About the person receiving care",
  evidence: [
    { field_id: "who_for", record: "Care is for", answer: "Someone else" },
    { field_id: "first_name", record: "First name", answer: "Ada" },
  ],
  context: [{ field_id: "how_soon", record: "How soon", answer: "This week" }],
  authority: [],
  questions: [],
  note: true,
};

// A section of the assessor's own questions, as the published definition holds
// them: one required, one optional, one only asked when an answer opens it.
const clinical: AssessmentSection = {
  id: "clinical",
  title: "Clinical observations",
  evidence: [],
  context: [],
  authority: [],
  note: true,
  questions: [
    { id: "c.pressure", record: "Blood pressure", asked: "What is the blood pressure?", type: "measurement", required: true },
    { id: "c.notes", record: "Anything else", asked: "Anything else to record?", type: "long_text" },
    {
      id: "c.wound_site",
      record: "Where is the wound",
      asked: "Where is the wound?",
      type: "text",
      required: true,
      showWhen: { field: "c.wound", in: ["yes"] },
    },
  ],
};

describe("assessment decisions", () => {
  it("names captured fields the way the server expects", () => {
    expect(confirmFieldId("who_for")).toBe("confirm.who_for");
    expect(noteFieldId("core_a")).toBe("note.core_a");
  });

  it("accepts only a confirmed or amended decision", () => {
    expect(readConfirm({ decision: "confirmed" })).toEqual({ decision: "confirmed", value: undefined });
    expect(readConfirm({ decision: "amended", value: "Now lives alone" }))
      .toEqual({ decision: "amended", value: "Now lives alone" });
    expect(readConfirm({ decision: "maybe" })).toBeNull();
    expect(readConfirm("confirmed")).toBeNull();
    expect(readConfirm(null)).toBeNull();
  });

  it("counts only real decisions as progress", () => {
    expect(sectionProgress(section, {})).toEqual({ decided: 0, total: 2 });
    expect(sectionProgress(section, { "confirm.who_for": { decision: "confirmed" } }))
      .toEqual({ decided: 1, total: 2 });
    expect(sectionProgress(section, { "confirm.who_for": "yes" })).toEqual({ decided: 0, total: 2 });
  });

  it("is complete only when every carried answer has been decided", () => {
    expect(assessmentComplete([section], { "confirm.who_for": { decision: "confirmed" } })).toBe(false);
    expect(assessmentComplete([section], {
      "confirm.who_for": { decision: "confirmed" },
      "confirm.first_name": { decision: "amended", value: "Adaeze", reason: "Name given in full at the visit" },
    })).toBe(true);
  });

  it("does not treat an amendment without a reason as settled", () => {
    expect(assessmentComplete([section], {
      "confirm.who_for": { decision: "confirmed" },
      "confirm.first_name": { decision: "amended", value: "Adaeze" },
    })).toBe(false);
    expect(assessmentComplete([section], {
      "confirm.who_for": { decision: "confirmed" },
      "confirm.first_name": { decision: "amended", value: "", reason: "Wrong before" },
    })).toBe(false);
  });
});

describe("the assessor's own questions", () => {
  it("counts a required question as work, and an optional one as none", () => {
    expect(sectionProgress(clinical, {})).toEqual({ decided: 0, total: 1 });
    expect(sectionProgress(clinical, { "c.pressure": { systolic: "120" } }))
      .toEqual({ decided: 1, total: 1 });
  });

  it("only asks a conditional question once the answer opens it", () => {
    expect(sectionProgress(clinical, { "c.wound": "yes" })).toEqual({ decided: 0, total: 2 });
    expect(sectionProgress(clinical, { "c.wound": "yes", "c.wound_site": "Left heel" }))
      .toEqual({ decided: 1, total: 2 });
  });

  it("is complete only when the carried answers and the required questions are done", () => {
    expect(assessmentComplete([clinical], {})).toBe(false);
    expect(assessmentComplete([clinical], { "c.pressure": { systolic: "120" } })).toBe(true);
  });

  it("keeps an amended answer in the shape of the question it replaces", () => {
    expect(readConfirm({ decision: "amended", value: ["oxygen", "hoist"] }))
      .toEqual({ decision: "amended", value: ["oxygen", "hoist"] });
  });
});
