import { describe, expect, it } from "vitest";
import {
  adminDomains, domainDestinations, domainLanding, isNavItemActive, locateRoute, visibleDomains,
} from "./admin-nav";

const everything = { isSuperAdmin: true, permissions: [] as string[] };

describe("Admin navigation", () => {
  it("uses the approved business-domain order", () => {
    expect(adminDomains.map((domain) => domain.label)).toEqual([
      "Overview", "Care", "Talent", "Workforce", "Programmes", "Inbox",
      "Communications", "Content", "Finance", "Insights", "Administration",
    ]);
  });

  it("keeps care and staffing requests distinct", () => {
    const items = adminDomains.flatMap(domainDestinations);
    expect(items.find((item) => item.title === "Care list")?.url).toBe("/admin/clients");
    expect(items.find((item) => item.title === "Staffing requests")?.url).toBe("/admin/match-universe/requests");
  });

  it("keeps historical terminology searchable", () => {
    const items = adminDomains.flatMap(domainDestinations);
    expect(items.find((item) => item.title === "Talent pool")?.keywords).toContain("Match Universe");
    expect(items.find((item) => item.title === "Insights")?.keywords).toContain("Intelligence");
    expect(items.find((item) => item.title === "Email library")?.keywords).toContain("email templates");
    expect(items.find((item) => item.title === "People and access")?.keywords).toContain("Access control");
    expect(items.find((item) => item.title === "Intake")?.keywords).toContain("Candidate intake");
  });

  it("keeps legacy candidate applications reachable but out of the domain nav", () => {
    const talent = adminDomains.find((domain) => domain.key === "talent")!;
    expect(talent.items.map((item) => item.url)).not.toContain("/admin/applications");
    expect((talent.aside ?? []).map((item) => item.url)).toContain("/admin/applications");
  });

  it("gives every domain a landing route", () => {
    for (const domain of visibleDomains(everything)) {
      expect(domainLanding(domain)).toMatch(/^\/admin/);
    }
  });

  it("hides domains the admin cannot reach", () => {
    const keys = visibleDomains({ isSuperAdmin: false, permissions: ["dashboard"] }).map((d) => d.key);
    expect(keys).toContain("overview");
    expect(keys).not.toContain("workforce");
    expect(keys).not.toContain("administration");
  });

  it("locates a route inside its domain, including detail routes", () => {
    const domains = visibleDomains(everything);
    expect(locateRoute(domains, "/admin/match-universe/intake").domain?.key).toBe("talent");
    const person = locateRoute(domains, "/admin/match-universe/abc");
    expect(person.domain?.key).toBe("talent");
    expect(person.deeper).toBe(true);
    expect(person.backUrl).toBe("/admin/match-universe");
    expect(locateRoute(domains, "/admin/care/duplicates").domain?.key).toBe("care");
    expect(locateRoute(domains, "/admin/seo/claims").domain?.key).toBe("content");
    expect(locateRoute(domains, "/admin/seo/pages/abc").domain?.key).toBe("content");
  });

  it("lists SEO inside Content", () => {
    const content = visibleDomains(everything).find((domain) => domain.key === "content");
    expect(content?.items.map((item) => item.url)).toContain("/admin/seo");
  });

  it("does not let the Overview route absorb child routes", () => {
    expect(isNavItemActive("/admin", "/admin", true)).toBe(true);
    expect(isNavItemActive("/admin/care/duplicates", "/admin", true)).toBe(false);
    expect(isNavItemActive("/admin/clients/123", "/admin/clients")).toBe(true);
  });
});
