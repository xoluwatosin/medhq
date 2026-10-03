import { describe, expect, it } from "vitest";
import { adminDomains } from "./admin-nav";
import {
  ACCESS_DELEGATE_PERMISSION, ACCESS_GROUPS, ALL_ACCESS_AREAS, canManageAccess, namedAreas,
} from "./admin-access";

describe("Admin access catalogue", () => {
  it("offers every permission key the navigation gates on", () => {
    const navPerms = new Set(
      adminDomains
        .flatMap((domain) => [...domain.items, ...(domain.aside ?? [])])
        .map((item) => item.perm)
        .filter(Boolean) as string[],
    );
    const offered = new Set(ALL_ACCESS_AREAS.map((area) => area.key));
    for (const perm of navPerms) expect(offered.has(perm)).toBe(true);
  });

  it("offers nothing that no longer exists", () => {
    const keys = ALL_ACCESS_AREAS.map((a) => a.key);
    expect(keys).not.toContain("care_permissions");
    expect(keys).toContain("invoices");
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("groups areas under the admin domains", () => {
    const labels = ACCESS_GROUPS.map((g) => g.label);
    expect(labels).toContain("Finance");
    expect(labels).toContain("Administration");
    expect(labels).toContain("Care responsibilities");
  });

  it("names the areas a person holds", () => {
    expect(namedAreas(["invoices"])).toEqual(["Invoices"]);
    expect(namedAreas([])).toEqual([]);
  });

  it("lets the super admin and named delegates manage access", () => {
    expect(canManageAccess({ isSuperAdmin: true, permissions: [] })).toBe(true);
    expect(canManageAccess({ isSuperAdmin: false, permissions: [ACCESS_DELEGATE_PERMISSION] })).toBe(true);
    expect(canManageAccess({ isSuperAdmin: false, permissions: ["settings"] })).toBe(false);
  });
});
