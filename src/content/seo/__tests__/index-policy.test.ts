import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { EXPANSION_REDIRECTS, INDEXABLE_EXPANSION_PATHS, canonicalOwnerFor, isExpansionIndexable } from "@/content/seo/index-policy";
import { EXPANSION_PAGE_PATHS } from "@/content/seo/expansion-pages";

describe("expansion indexing policy", () => {
  it("does not render a page for a route that is merged into an established page", () => {
    for (const path of Object.keys(EXPANSION_REDIRECTS)) {
      expect(EXPANSION_PAGE_PATHS).not.toContain(path);
    }
  });

  it("points each merged route at the established page that owns the topic", () => {
    expect(canonicalOwnerFor("/antenatal-care-at-home")).toBe("/antenatal-care");
    expect(canonicalOwnerFor("/clinical-research-staffing")).toBe("/clinical-research");
    expect(canonicalOwnerFor("/hospital-support-services")).toBe("/hospital-support");
    expect(canonicalOwnerFor("/ngo-health-programme-implementation")).toBe("/ngo-healthcare-staffing");
    expect(canonicalOwnerFor("/community-health-outreach-services")).toBe("/ngo-healthcare-staffing");
    expect(canonicalOwnerFor("/physiotherapy-after-stroke")).toBe("/stroke-recovery-at-home");
    expect(canonicalOwnerFor("/managed-postpartum-stay-in-nigeria")).toBe("/omugwo");
    expect(canonicalOwnerFor("/professional-omugwo")).toBe("/omugwo");
    expect(canonicalOwnerFor("/professional-nanny")).toBe("/nanny-childcare");
    expect(canonicalOwnerFor("/medic-connect-talent-pool")).toBe("/careers");
  });

  it("treats a route as indexable only when the policy lists it", () => {
    for (const path of EXPANSION_PAGE_PATHS) {
      expect(isExpansionIndexable(path)).toBe(INDEXABLE_EXPANSION_PATHS.includes(path));
    }
  });

  it("keeps every unreviewed expansion route out of the index", () => {
    const unreviewed = EXPANSION_PAGE_PATHS.filter((path) => !INDEXABLE_EXPANSION_PATHS.includes(path));
    for (const path of unreviewed) {
      expect(isExpansionIndexable(path)).toBe(false);
    }
  });

  it("serves every merged route as a permanent server redirect", () => {
    const config = JSON.parse(readFileSync(resolve("vercel.json"), "utf8"));
    const served = Object.fromEntries(
      (config.redirects ?? []).map((r: { source: string; destination: string; permanent: boolean }) => {
        expect(r.permanent).toBe(true);
        return [r.source, r.destination];
      }),
    );
    expect(served).toEqual(EXPANSION_REDIRECTS);
  });

  it("never redirects to a route that itself redirects", () => {
    for (const to of Object.values(EXPANSION_REDIRECTS)) expect(EXPANSION_REDIRECTS[to]).toBeUndefined();
  });
});
