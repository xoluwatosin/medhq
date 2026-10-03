import { describe, expect, it } from "vitest";
import { screenEdgesForPath } from "./IPhoneScreenEdges";

describe("screenEdgesForPath", () => {
  it("continues the pre-assessment heading and form into their iPhone edges", () => {
    expect(screenEdgesForPath("/pre-assessment/example")).toEqual({ top: "navy", bottom: "card" });
    expect(screenEdgesForPath("/care/start/example")).toEqual({ top: "navy", bottom: "card" });
  });

  it("keeps candidate sign-in entirely navy", () => {
    expect(screenEdgesForPath("/portal/login")).toEqual({ top: "navy", bottom: "navy" });
  });

  it("continues candidate onboarding from its navy heading to its desk", () => {
    expect(screenEdgesForPath("/join/nurse/account")).toEqual({ top: "navy", bottom: "desk" });
    expect(screenEdgesForPath("/portal/start")).toEqual({ top: "navy", bottom: "desk" });
  });

  it("continues the candidate header and tab bar independently", () => {
    expect(screenEdgesForPath("/portal/documents")).toEqual({ top: "navy", bottom: "card" });
  });

  it("uses each operating shell's light surface", () => {
    expect(screenEdgesForPath("/admin/care/requests")).toEqual({ top: "card", bottom: "muted" });
    expect(screenEdgesForPath("/assessor/visit-id")).toEqual({ top: "page", bottom: "page" });
  });

  it("continues the public navy opening while retaining a light page ending", () => {
    expect(screenEdgesForPath("/")).toEqual({ top: "navy", bottom: "page" });
    expect(screenEdgesForPath("/care-at-home")).toEqual({ top: "navy", bottom: "page" });
  });
});