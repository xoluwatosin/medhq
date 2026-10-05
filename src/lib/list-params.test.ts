import { describe, expect, it } from "vitest";
import { memoryKey, restoreSearch, withParam, withoutParams } from "@/lib/list-params";

describe("withParam", () => {
  it("adds a non-default value", () => {
    expect(withParam("", "state", "lagos", "all")).toBe("?state=lagos");
  });
  it("leaves the default out of the address", () => {
    expect(withParam("?state=lagos", "state", "all", "all")).toBe("");
  });
  it("treats an empty value as cleared", () => {
    expect(withParam("?q=ada", "q", "", "")).toBe("");
  });
  it("keeps other filters and a stable order", () => {
    expect(withParam("?view=dormant&q=ada", "state", "oyo", "all")).toBe("?q=ada&state=oyo&view=dormant");
  });
  it("composes when applied one after another", () => {
    const a = withParam("?lga=ikeja&state=lagos", "state", "oyo", "all");
    expect(withParam(a, "lga", "", "")).toBe("?state=oyo");
  });
});

describe("withoutParams", () => {
  it("clears only the named filters", () => {
    expect(withoutParams("?q=ada&state=oyo&tab=x", ["q", "state"])).toBe("?tab=x");
  });
});

describe("restoreSearch", () => {
  it("restores the last-used filters on a bare address", () => {
    expect(restoreSearch("", "?state=oyo")).toBe("?state=oyo");
  });
  it("lets a shared or bookmarked address win", () => {
    expect(restoreSearch("?view=all", "?state=oyo")).toBeNull();
  });
  it("does nothing with no memory", () => {
    expect(restoreSearch("", null)).toBeNull();
    expect(restoreSearch("", "")).toBeNull();
  });
  it("accepts memory saved without the question mark", () => {
    expect(restoreSearch("", "q=ada")).toBe("?q=ada");
  });
});

it("keys memory by list", () => {
  expect(memoryKey("/admin/clients")).toBe("mc-list:/admin/clients");
});
