import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHAPTER_ORDER, chapterOf, chapterTitle, inChapterOrder, minutesFor } from "./care-chapters";

const definition = JSON.parse(readFileSync("docs/care/pre-assessment-v16.json", "utf8")) as { sections: { id: string }[] };

describe("pre-assessment chapters", () => {
  it("puts every asked section in a chapter, and consent in none", () => {
    for (const s of definition.sections) {
      if (s.id === "route" || s.id === "route_service") continue;
      if (s.id === "consent") expect(chapterOf(s.id)).toBeNull();
      else expect(CHAPTER_ORDER).toContain(chapterOf(s.id));
    }
  });

  it("asks about the person before the practical arrangements", () => {
    const ordered = inChapterOrder(definition.sections.filter((s) => chapterOf(s.id))).map((s) => s.id);
    expect(ordered.indexOf("core_situation")).toBeLessThan(ordered.indexOf("core_health"));
    expect(ordered.indexOf("core_health")).toBeLessThan(ordered.indexOf("svc_eldercare"));
    expect(ordered.indexOf("mod_mobility")).toBeLessThan(ordered.indexOf("core_support"));
    expect(ordered[ordered.length - 1]).toBe("core_arrangements");
  });

  it("names chapters for the person, or for you", () => {
    expect(chapterTitle("health", "Folake")).toBe("Folake’s health");
    expect(chapterTitle("about", null)).toBe("About you");
  });

  it("estimates time at about twenty seconds a question", () => {
    expect(minutesFor(3)).toBe(2);
    expect(minutesFor(39)).toBe(13);
  });
});
