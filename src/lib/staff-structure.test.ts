import { describe, expect, it } from "vitest";
import { reportsBelow } from "./staff";

// Oluwatosin <- Munachim <- Muminat; Oluwatosin <- Shalom
const rows = [
  { id: "olu", reports_to: null },
  { id: "muna", reports_to: "olu" },
  { id: "mumi", reports_to: "muna" },
  { id: "shalom", reports_to: "olu" },
];

describe("reporting lines", () => {
  it("finds everyone below a person, however far down", () => {
    expect([...reportsBelow(rows, "olu")].sort()).toEqual(["mumi", "muna", "shalom"]);
    expect([...reportsBelow(rows, "muna")]).toEqual(["mumi"]);
    expect(reportsBelow(rows, "mumi").size).toBe(0);
  });

  it("never loops on a bad reporting line", () => {
    const loop = [{ id: "a", reports_to: "b" }, { id: "b", reports_to: "a" }];
    expect([...reportsBelow(loop, "a")].sort()).toEqual(["a", "b"]);
  });
});
