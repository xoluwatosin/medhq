// One source of truth for what an admin can be given access to.
//
// The access checkboxes are derived from the same navigation model the rail
// uses, so the two can never drift: every permission key that gates a
// destination appears here, grouped under the domain it belongs to.
import { adminDomains } from "./admin-nav";

export interface AccessArea {
  key: string;
  label: string;
}

export interface AccessGroup {
  key: string;
  label: string;
  areas: AccessArea[];
}

/** Holding this permission lets someone manage other admins' access. */
export const ACCESS_DELEGATE_PERMISSION = "admin_access";

/** Keys that gate behaviour rather than a navigation destination. */
const CARE_GROUP: AccessGroup = {
  key: "care_responsibilities",
  label: "Care responsibilities",
  areas: [
    { key: "care_coordinator", label: "Care coordination" },
    { key: "care_clinical", label: "Care clinical" },
  ],
};

const ACCOUNT_GROUP: AccessGroup = {
  key: "account",
  label: "Account",
  areas: [{ key: "profile_only", label: "Own profile only" }],
};

/** A few keys open more than one destination; name them for what they cover. */
const LABEL_OVERRIDES: Record<string, string> = {
  dashboard: "Overview, Care and Insights",
  blog: "Blog posts and SEO",
  match_universe: "Talent Pool and everything inside it",
  workforce: "Workforce, contracts and annexes",
  enquiries: "Enquiries and enquiry setup",
  settings: "Settings and alert keys",
  admin_access: "Manage admin access",
};

const buildGroups = (): AccessGroup[] => {
  const seen = new Set<string>();
  const groups: AccessGroup[] = [];

  for (const domain of adminDomains) {
    const areas: AccessArea[] = [];
    for (const item of [...domain.items, ...(domain.aside ?? [])]) {
      if (!item.perm || seen.has(item.perm)) continue;
      seen.add(item.perm);
      areas.push({ key: item.perm, label: LABEL_OVERRIDES[item.perm] ?? item.title });
    }
    if (areas.length) groups.push({ key: domain.key, label: domain.label, areas });
  }

  groups.push(CARE_GROUP, ACCOUNT_GROUP);
  return groups;
};

export const ACCESS_GROUPS: AccessGroup[] = buildGroups();

export const ALL_ACCESS_AREAS: AccessArea[] = ACCESS_GROUPS.flatMap((group) => group.areas);

export const accessLabel = (key: string): string =>
  ALL_ACCESS_AREAS.find((area) => area.key === key)?.label ?? key;

/** Areas a person currently holds, named and in catalogue order. */
export const namedAreas = (permissions: string[] | null | undefined): string[] =>
  ALL_ACCESS_AREAS.filter((area) => (permissions ?? []).includes(area.key)).map((a) => a.label);

export const canManageAccess = (access: { isSuperAdmin: boolean; permissions: string[] }): boolean =>
  access.isSuperAdmin || access.permissions.includes(ACCESS_DELEGATE_PERMISSION);
