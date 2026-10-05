import {
  FileText, Users, Megaphone, LayoutDashboard, Mail, UserPlus, Archive, MailOpen,
  Palette, Settings, Shield, HelpCircle, CheckCircle, Receipt, Orbit, HeartPulse,
  Briefcase, ShieldCheck, Inbox, CalendarDays, Copy, ClipboardList, UserCog, IdCard,
  BarChart3, KeyRound, FileSignature, Library, Layers, Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * One source of truth for admin navigation.
 *
 * The Admin is organised by business domain. The permanent rail answers "which
 * part of Medic Connect am I working in?" and nothing else; each domain then
 * carries its own local destinations, plus the specialist pages that are
 * reachable from the screen they belong to and from search.
 *
 * The rail, the phone navigator, the domain-local nav, the breadcrumb and the
 * command palette all read this file, so a page can never appear in one and go
 * missing from another.
 */
export interface AdminNavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Permission key. Omitted items are always shown (already gated elsewhere). */
  perm?: string;
  /** Only super admins may see this destination. */
  superAdmin?: boolean;
  /** `exact` stops parent routes lighting up when a child route is open. */
  exact?: boolean;
  /** Search-only text; never rendered. */
  keywords?: string;
}

export interface AdminDomain {
  /** Stable key, used for the phone navigator state. */
  key: string;
  label: string;
  icon: LucideIcon;
  /** Canonical landing route for the domain. */
  url: string;
  /** Destinations shown inside the domain. */
  items: AdminNavItem[];
  /**
   * Reachable, but not worth a line in the domain nav: the page already has a
   * door on the screen it belongs to. Still answers to search and breadcrumbs.
   */
  aside?: AdminNavItem[];
}

export const adminDomains: AdminDomain[] = [
  {
    key: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    url: "/admin",
    items: [
      { title: "Overview", url: "/admin", icon: LayoutDashboard, perm: "dashboard", exact: true, keywords: "home dashboard work needing attention" },
    ],
  },
  {
    key: "care",
    label: "Care",
    icon: HeartPulse,
    url: "/admin/care/requests",
    items: [
      { title: "Requests", url: "/admin/care/requests", icon: ClipboardList, perm: "dashboard", exact: true, keywords: "care requests families groups recipients enquirer preparation" },
      { title: "Clients", url: "/admin/clients", icon: HeartPulse, perm: "dashboard", keywords: "care clients recipients assessments" },
      { title: "Duplicates", url: "/admin/care/duplicates", icon: Copy, perm: "dashboard", keywords: "care duplicates same person merge entered twice families" },
    ],
  },
  {
    key: "talent",
    label: "Talent",
    icon: Orbit,
    url: "/admin/match-universe",
    items: [
      { title: "Talent Pool", url: "/admin/match-universe", icon: Orbit, perm: "match_universe", exact: true, keywords: "Candidates candidate pool Match Universe register nurses talent" },
      { title: "Intake", url: "/admin/match-universe/intake", icon: Inbox, perm: "match_universe", keywords: "Candidate intake front of funnel parsing new arrivals applications" },
      { title: "Opportunities", url: "/admin/match-universe/opportunities", icon: Briefcase, perm: "match_universe", keywords: "Match Universe jobs roles vacancies recruitment" },
      { title: "Staffing requests", url: "/admin/match-universe/requests", icon: ClipboardList, perm: "match_universe", keywords: "Client requests staffing brief client need matching" },
      { title: "Availability", url: "/admin/match-universe/availability", icon: CalendarDays, perm: "match_universe", keywords: "who is free calendar shifts" },
    ],
    aside: [
      { title: "Document review", url: "/admin/match-universe/verification", icon: ShieldCheck, perm: "match_universe", keywords: "verification evidence licence queue" },
      { title: "Duplicates", url: "/admin/match-universe/merges", icon: Copy, perm: "match_universe", keywords: "merge duplicate people" },
      { title: "Candidate applications", url: "/admin/applications", icon: UserPlus, perm: "applications", keywords: "legacy historical join network apply raw applications" },
    ],
  },
  {
    key: "workforce",
    label: "Workforce",
    icon: IdCard,
    url: "/admin/workforce",
    items: [
      { title: "Workforce", url: "/admin/workforce", icon: IdCard, perm: "workforce", keywords: "staff register contracts compliance employees" },
    ],
    aside: [
      { title: "Contract templates", url: "/admin/contracts/templates", icon: FileSignature, perm: "workforce", keywords: "contract template employment letter" },
      { title: "Annex library", url: "/admin/contracts/annexes", icon: Library, perm: "workforce", keywords: "annex schedule contract clause" },
    ],
  },
  {
    key: "programmes",
    label: "Programmes",
    icon: Layers,
    url: "/admin/programmes",
    items: [
      { title: "All programmes", url: "/admin/programmes", icon: Layers, exact: true, keywords: "programmes register Creator" },

      { title: "Creator", url: "/admin/creator-applications", icon: Palette, perm: "creator_applications", keywords: "Creator applications content partners" },
    ],
  },
  {
    key: "inbox",
    label: "Inbox",
    icon: Mail,
    url: "/admin/enquiries",
    items: [
      { title: "Enquiries", url: "/admin/enquiries", icon: Mail, perm: "enquiries", exact: true, keywords: "messages contact form leads" },
    ],
    aside: [
      { title: "Enquiry setup", url: "/admin/enquiries/setup", icon: HelpCircle, perm: "enquiries", keywords: "service lines brochures reply questions" },
    ],
  },
  {
    key: "communications",
    label: "Communications",
    icon: Megaphone,
    url: "/admin/communications",
    items: [
      { title: "Campaigns", url: "/admin/campaigns", icon: Megaphone, perm: "campaigns", keywords: "email send broadcast" },
      { title: "Audience", url: "/admin/audience", icon: Users, perm: "audience", keywords: "subscribers groups lists" },
      { title: "Email Library", url: "/admin/email-templates", icon: MailOpen, perm: "email_templates", keywords: "email templates kit recipes transactional" },
    ],
  },
  {
    key: "content",
    label: "Content",
    icon: FileText,
    url: "/admin/posts",
    items: [
      { title: "Blog posts", url: "/admin/posts", icon: FileText, perm: "blog", keywords: "bridge articles writing" },
      { title: "SEO", url: "/admin/seo", icon: Search, perm: "blog", keywords: "search pages modules claims markets schema indexing evidence" },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    icon: Receipt,
    url: "/admin/finance",
    items: [
      { title: "Invoices", url: "/admin/invoices", icon: Receipt, perm: "invoices", keywords: "billing payment quote catalogue" },
    ],
  },
  {
    key: "insights",
    label: "Insights",
    icon: BarChart3,
    url: "/admin/intelligence",
    items: [
      { title: "Insights", url: "/admin/intelligence", icon: BarChart3, perm: "dashboard", keywords: "Intelligence analytics funnel behaviour reports" },
    ],
  },
  {
    key: "administration",
    label: "Administration",
    icon: Shield,
    url: "/admin/control-centre",
    // One Administration page: its three parts are tabs on the domain rail.
    items: [
      { title: "People and access", url: "/admin/control-centre", icon: Shield, perm: "admin_access", keywords: "Access control admins permissions Control Centre" },
      { title: "Notifications", url: "/admin/settings", icon: Settings, perm: "settings", keywords: "settings configuration notifications emails" },
      { title: "Alert keys", url: "/admin/alert-keys", icon: KeyRound, perm: "settings", keywords: "secrets run key rotate admin alert test audit job keys" },
    ],
    aside: [
      { title: "Archive", url: "/admin/archives", icon: Archive, perm: "archives", keywords: "archives archived deleted" },
      { title: "Approvals", url: "/admin/approvals", icon: CheckCircle, superAdmin: true, keywords: "pending review publish" },
    ],
  },
];

/**
 * Staff whose whole admin is their own record get this single domain. Everyone
 * else reaches their profile from the account menu in the header.
 */
export const myProfileDomain: AdminDomain = {
  key: "me",
  label: "My profile",
  icon: UserCog,
  url: "/admin/me",
  items: [{ title: "My profile", url: "/admin/me", icon: UserCog, keywords: "account my record" }],
};

export const isNavItemActive = (pathname: string, url: string, exact?: boolean) =>
  exact ? pathname === url : pathname === url || pathname.startsWith(`${url}/`);

export interface AdminAccess {
  isSuperAdmin: boolean;
  permissions: string[];
}

const canSee = (item: AdminNavItem, access: AdminAccess) => {
  if (item.superAdmin) return access.isSuperAdmin;
  return access.isSuperAdmin || !item.perm || access.permissions.includes(item.perm);
};

/**
 * Domains the signed-in admin may work in. A domain disappears entirely when
 * none of its destinations are permitted.
 */
export const visibleDomains = (access: AdminAccess): AdminDomain[] =>
  adminDomains
    .map((domain) => ({
      ...domain,
      items: domain.items.filter((item) => canSee(item, access)),
      aside: (domain.aside ?? []).filter((item) => canSee(item, access)),
    }))
    .filter((domain) => domain.items.length > 0 || (domain.aside ?? []).length > 0);

/** Where the rail sends you: the canonical landing, or the first allowed page. */
export const domainLanding = (domain: AdminDomain): string => {
  if (domain.items.some((item) => item.url === domain.url)) return domain.url;
  if (domain.url.startsWith("/admin/") && domain.items.length > 1) return domain.url;
  return domain.items[0]?.url ?? domain.aside?.[0]?.url ?? domain.url;
};

export const domainDestinations = (domain: AdminDomain): AdminNavItem[] => [
  ...domain.items,
  ...(domain.aside ?? []),
];

/** Longest matching destination in a domain, if the route belongs to it. */
const matchIn = (domain: AdminDomain, pathname: string): AdminNavItem | null =>
  domainDestinations(domain)
    .filter((item) => isNavItemActive(pathname, item.url, item.exact))
    .sort((a, b) => b.url.length - a.url.length)[0] ?? null;

export interface AdminLocation {
  domain: AdminDomain | null;
  item: AdminNavItem | null;
  /** The route runs deeper than the destination we know about. */
  deeper: boolean;
  /** Contextual back target for the phone header. */
  backUrl: string;
}

export const locateRoute = (domains: AdminDomain[], pathname: string): AdminLocation => {
  let best: { domain: AdminDomain; item: AdminNavItem } | null = null;
  for (const domain of domains) {
    const item = matchIn(domain, pathname);
    if (item && (!best || item.url.length > best.item.url.length)) best = { domain, item };
  }
  if (!best) {
    // A detail route under a domain landing, e.g. a person record: the domain
    // is known, the destination is not, so the header offers the way back up.
    const byLanding = domains.find((d) => isNavItemActive(pathname, d.url, d.url === "/admin"));
    const landing = byLanding ? domainLanding(byLanding) : "/admin";
    return { domain: byLanding ?? null, item: null, deeper: Boolean(byLanding) && pathname !== landing, backUrl: landing };
  }

  return {
    domain: best.domain,
    item: best.item,
    deeper: pathname !== best.item.url,
    backUrl: best.item.url,
  };
};

/** Detail routes that live outside any listed destination but belong to one. */
const ROUTE_PERMISSION_EXTRAS: { url: string; perm?: string; superAdmin?: boolean }[] = [
  { url: "/admin/contracts", perm: "workforce" },
];

/**
 * Whether the signed-in admin may open this route at all. The rail hides what
 * they cannot reach; this stops a typed or bookmarked address from opening it
 * anyway. Routes nobody has mapped stay open, the same as before, and the
 * database policies still decide what data comes back.
 */
export const canOpenRoute = (pathname: string, access: AdminAccess): boolean => {
  if (access.isSuperAdmin) return true;
  const candidates = [
    ...adminDomains.flatMap((d) => domainDestinations(d)),
    ...ROUTE_PERMISSION_EXTRAS,
  ].filter((item) => item.url !== "/admin" && (pathname === item.url || pathname.startsWith(`${item.url}/`)));
  // Every destination that covers this path must allow it; the most specific
  // one decides when they disagree.
  const best = candidates.sort((a, b) => b.url.length - a.url.length)[0];
  if (!best) return true;
  if (best.superAdmin) return false;
  return !best.perm || access.permissions.includes(best.perm);
};
