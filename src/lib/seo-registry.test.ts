import { describe, expect, it } from "vitest";
import {
  claimEffectiveState, governedKeysIn, pageBlockers, PAGE_TYPES, INDEX_STATES, MODULE_TYPES,
} from "./seo-registry";

const base = {
  page_type: "service",
  publication_state: "ready",
  evidence_state: "sufficient",
  clinical_requirement: "not_required" as string | null,
  clinical_reviewed_at: null,
  clinical_reviewed_by: null,
  requiredClaims: [],
  requiredModules: [],
  markets: [],
};

describe("SEO governance vocabulary", () => {
  it("governs page types, index states and module types", () => {
    expect(PAGE_TYPES).toContain("location");
    expect(INDEX_STATES).toEqual(["candidate", "draft", "review", "indexable", "noindex", "retired"]);
    expect(MODULE_TYPES).toHaveLength(17);
  });
});

describe("Claim staleness", () => {
  it("treats an approved claim past its validity as stale", () => {
    expect(claimEffectiveState("approved", null, "2020-01-01T00:00:00Z")).toBe("stale");
  });
  it("leaves a current approved claim approved", () => {
    expect(claimEffectiveState("approved", null, "2999-01-01T00:00:00Z")).toBe("approved");
  });
  it("does not promote an unapproved claim", () => {
    expect(claimEffectiveState("draft", null, null)).toBe("draft");
  });
});

describe("Page indexability gate", () => {
  it("passes a complete page", () => {
    expect(pageBlockers(base)).toEqual([]);
  });

  it("does not block on evidence state alone", () => {
    expect(pageBlockers({ ...base, evidence_state: "missing" })).toEqual([]);
  });

  it("blocks a page that quotes a price without a governed fee", () => {
    expect(pageBlockers({ ...base, page_type: "pricing" })).toContain("Pricing not governed");
    expect(
      pageBlockers({ ...base, page_type: "pricing", governedFees: [{ state: "set" }] }),
    ).toEqual([]);
    expect(
      pageBlockers({ ...base, quotesPricing: true, governedFees: [{ state: "not_set" }] }),
    ).toContain("Pricing not governed");
  });

  it("blocks a page that is only planned", () => {
    expect(pageBlockers({ ...base, publication_state: "planned" })).toContain("Publication not ready");
  });

  it("does not block on clinical review, which is governance metadata only", () => {
    expect(pageBlockers({ ...base, clinical_requirement: "required" })).toEqual([]);
    expect(
      pageBlockers({ ...base, requiredModules: [{ review_state: "approved", requires_clinical_review: true }] }),
    ).toEqual([]);
    expect(
      pageBlockers({
        ...base,
        clinical_requirement: null,
        requiredClaims: [
          { state: "approved", valid_from: null, valid_until: null, requires_clinical_review: true },
        ],
      }),
    ).toEqual([]);
  });

  it("only accepts a current, publicly visible fee as governed pricing", () => {
    expect(
      pageBlockers({
        ...base,
        quotesPricing: true,
        governedFees: [{ state: "set", public_visibility: "internal", is_current: true }],
      }),
    ).toContain("Pricing not governed");
    expect(
      pageBlockers({
        ...base,
        quotesPricing: true,
        governedFees: [{ state: "set", public_visibility: "public", is_current: false }],
      }),
    ).toContain("Pricing not governed");
    expect(
      pageBlockers({
        ...base,
        quotesPricing: true,
        governedFees: [{ state: "set", public_visibility: "public", is_current: true }],
      }),
    ).toEqual([]);
  });

  it("blocks a page whose required claim is stale", () => {
    expect(
      pageBlockers({
        ...base,
        requiredClaims: [{ state: "approved", valid_from: null, valid_until: "2020-01-01T00:00:00Z" }],
      }),
    ).toContain("Required claim not approved");
  });

  it("blocks a page whose required module is not approved", () => {
    expect(pageBlockers({ ...base, requiredModules: [{ review_state: "draft" }] })).toContain(
      "Required module not approved",
    );
  });

  it("blocks a location page whose market is not serviceable", () => {
    const location = { ...base, page_type: "location" };
    expect(pageBlockers(location)).toContain("Market not serviceable");
    expect(
      pageBlockers({
        ...location,
        markets: [{ market_state: "available", safety_state: "restricted" }],
      }),
    ).toContain("Market not serviceable");
    expect(
      pageBlockers({
        ...location,
        markets: [{ market_state: "established", safety_state: "serviceable" }],
      }),
    ).toEqual([]);
  });

  it("checks market serviceability on any page with a market attached", () => {
    expect(
      pageBlockers({ ...base, markets: [{ market_state: "research", safety_state: "review" }] }),
    ).toContain("Market not serviceable");
  });
});

describe("Local context", () => {
  it("names governed facts that may not be overridden locally", () => {
    expect(governedKeysIn({ price: 1000, tone: "warm" })).toEqual(["price"]);
    expect(governedKeysIn({ landmark: "Ikoyi" })).toEqual([]);
  });
});
