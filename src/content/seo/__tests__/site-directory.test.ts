import { describe, expect, it } from "vitest";
import { DIRECTORY, DIRECTORY_PATHS } from "../site-directory";
import { EXPANSION_PAGE_PATHS } from "../expansion-pages";
import { GOVERNED_PAGES } from "../governed-pages";

describe("site directory", () => {
  it("links every registry page from a hub", () => {
    const hubs = new Set(["/care-at-home"]);
    const registry = [...EXPANSION_PAGE_PATHS, ...GOVERNED_PAGES.map((p) => p.path)].filter((p) => !hubs.has(p));
    const missing = registry.filter((p) => !DIRECTORY_PATHS.has(p));
    expect(missing).toEqual([]);
  });

  it("has readable labels, not paths", () => {
    const raw = DIRECTORY.flatMap((g) => g.links).filter((l) => l.label.startsWith("/"));
    expect(raw).toEqual([]);
  });
});
