import { describe, expect, it } from "vitest";
import type { CareField, CareSection } from "@/lib/care";
import { buildItinerary, clustersForSection, pagesForSection, presentationParts, resolvePosition } from "@/lib/care-itinerary";

const field = (id: string, extra: Partial<CareField> = {}): CareField => ({
  id,
  record: id,
  asked: id,
  type: "text",
  ...extra,
});

const section = (fields: CareField[], id = "s1"): CareSection => ({
  id,
  title: "A section",
  when: "always",
  fields,
});

describe("page grouping", () => {
  it("puts nothing on a page when nothing is visible", () => {
    const s = section([field("a", { showWhen: { field: "z", in: ["yes"] } })]);
    expect(pagesForSection(s, {})).toHaveLength(0);
  });

  it("keeps one or two simple questions on one page", () => {
    for (const count of [1, 2]) {
      const s = section(Array.from({ length: count }, (_, i) => field(`q${i}`)));
      const pages = pagesForSection(s, {});
      expect(pages).toHaveLength(1);
      expect(pages[0].fields).toHaveLength(count);
    }
  });

  it("splits further simple questions into pairs", () => {
    const s = section(["a", "b", "c", "d"].map((id) => field(id)));
    const pages = pagesForSection(s, {});
    expect(pages.map((p) => p.fields.map((f) => f.id))).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("keeps a question and the follow-ups it opens together, on their own page", () => {
    const s = section([
      field("meds", { type: "choice", options: [{ value: "yes", label: "Yes" }] }),
      field("meds_detail", { showWhen: { field: "meds", in: ["yes"] } }),
      field("other"),
    ]);
    const pages = pagesForSection(s, { meds: "yes" });
    expect(pages.map((p) => p.fields.map((f) => f.id))).toEqual([["meds", "meds_detail"], ["other"]]);
  });

  it("gives a large structured control its own page", () => {
    const s = section([field("a"), field("meds", { type: "medicine_list" }), field("b")]);
    expect(pagesForSection(s, {}).map((p) => p.fields.map((f) => f.id)))
      .toEqual([["a"], ["meds"], ["b"]]);
  });

  it("leaves no empty page when a branch is closed", () => {
    const s = section([
      field("meds", { type: "choice", options: [{ value: "yes", label: "Yes" }] }),
      field("meds_detail", { showWhen: { field: "meds", in: ["yes"] } }),
    ]);
    const pages = pagesForSection(s, { meds: "no" });
    expect(pages).toHaveLength(1);
    expect(pages[0].fields.map((f) => f.id)).toEqual(["meds"]);
  });

  it("gathers a chain of follow-ups into one cluster", () => {
    const s = section([
      field("a"),
      field("b", { showWhen: { field: "a", contains: ["x"] } }),
      field("c", { showWhen: { field: "b", contains: ["y"] } }),
    ]);
    const clusters = clustersForSection(s, { a: "x", b: "y" });
    expect(clusters).toHaveLength(1);
    expect(clusters[0].fields.map((f) => f.id)).toEqual(["a", "b", "c"]);
  });
});

describe("the itinerary", () => {
  const s1 = section([field("a"), field("b")], "one");
  const s2 = section([field("c", { type: "care_upload" })], "two");

  it("runs welcome, cover, questions, review", () => {
    const pages = buildItinerary([s1, s2], {});
    expect(pages.map((p) => p.kind)).toEqual([
      "welcome", "cover", "questions", "cover", "questions", "review",
    ]);
    expect(pages[1].sectionNumber).toBe(1);
    expect(pages[3].sectionCount).toBe(2);
  });

  it("drops a section with nothing left to ask", () => {
    const hidden = section([field("d", { showWhen: { field: "a", in: ["never"] } })], "three");
    const pages = buildItinerary([s1, hidden], {});
    expect(pages.some((p) => p.sectionId === "three")).toBe(false);
  });

  it("keeps page keys stable when branching changes", () => {
    const branching = section([
      field("a"),
      field("a_more", { showWhen: { field: "a", contains: ["x"] } }),
      field("b"),
    ], "one");
    const closed = buildItinerary([branching], {});
    const open = buildItinerary([branching], { a: "x" });
    expect(closed.find((p) => p.kind === "questions")?.key).toBe("one#a");
    expect(open.find((p) => p.kind === "questions")?.key).toBe("one#a");
  });

  it("resolves a saved position, falling back to the section then the start", () => {
    const pages = buildItinerary([s1, s2], {});
    expect(resolvePosition(pages, { key: "two#c" })).toBe(4);
    expect(resolvePosition(pages, { key: "gone#x", sectionId: "two" })).toBe(3);
    expect(resolvePosition(pages, { key: "gone#x", sectionId: "missing" })).toBe(0);
    expect(resolvePosition(pages, null)).toBe(0);
  });
});

describe("presentation groups", () => {
  it("breaks health into coherent navigable groups", () => {
    const health = section([
      field("diagnosed_conditions"), field("condition_details"), field("hospital_recent"),
      field("professional_involved"), field("regular_medicines"), field("allergies"),
    ], "core_health");
    expect(presentationParts(health).map((part) => part.title)).toEqual([
      "Health conditions", "Recent hospital care", "Health professionals", "Medicines and allergies",
    ]);
  });
});
