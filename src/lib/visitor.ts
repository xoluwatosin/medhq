// What we remember about a visitor, on their own device.
//
// Nothing here leaves the browser by itself. It exists so a returning person is
// greeted by name, is not asked the same four questions again, and so the care
// they looked at last week can ride along with the request they send today.

export interface VisitorInterest {
  line: string;
  at: string;
}

export interface VisitorRecord {
  name: string;
  firstName: string;
  lastName: string;
  dial: string;
  phone: string;
  email: string;
  consent: boolean;
  interests: VisitorInterest[];
  lastRequestAt: string | null;
  greetedAt: string | null;
}

const KEY = "mc_visitor_v2";
const LEGACY_VISITOR = "mc_visitor_v1";
const LEGACY_WA_LEAD = "mc_wa_lead_v1";

const EMPTY: VisitorRecord = {
  name: "",
  firstName: "",
  lastName: "",
  dial: "+234",
  phone: "",
  email: "",
  consent: false,
  interests: [],
  lastRequestAt: null,
  greetedAt: null,
};

const safeParse = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

/** Split a stored phone that may already carry its dialling code. */
const splitPhone = (raw: string): { dial: string; phone: string } => {
  const t = (raw || "").trim();
  const m = t.match(/^(\+\d{1,3})\s*(.*)$/);
  if (m) return { dial: m[1], phone: m[2].trim() };
  return { dial: "+234", phone: t };
};

/** Older keys held a flat lead; fold them in once so nobody starts from scratch. */
function migrateLegacy(): Partial<VisitorRecord> {
  const out: Partial<VisitorRecord> = {};
  const old = safeParse(localStorage.getItem(LEGACY_VISITOR)) ?? {};
  const wa = safeParse(localStorage.getItem(LEGACY_WA_LEAD)) ?? {};
  const name = (old.name as string) || (wa.name as string) || "";
  const phoneRaw = (old.phone as string) || (wa.phone as string) || "";
  const email = (old.email as string) || "";
  if (name) out.name = name;
  if (email) out.email = email;
  if (phoneRaw) {
    const { dial, phone } = splitPhone(phoneRaw);
    out.dial = dial;
    out.phone = phone;
  }
  return out;
}

export function readVisitor(): VisitorRecord {
  if (typeof window === "undefined") return { ...EMPTY };
  const stored = safeParse(localStorage.getItem(KEY));
  if (stored) {
    return {
      ...EMPTY,
      ...stored,
      interests: Array.isArray(stored.interests) ? (stored.interests as VisitorInterest[]) : [],
    };
  }
  const migrated = { ...EMPTY, ...migrateLegacy() };
  if (migrated.name || migrated.phone || migrated.email) writeVisitor(migrated);
  return migrated;
}

export function writeVisitor(patch: Partial<VisitorRecord>): VisitorRecord {
  if (typeof window === "undefined") return { ...EMPTY, ...patch };
  const current = safeParse(localStorage.getItem(KEY)) ? readVisitor() : { ...EMPTY, ...migrateLegacy() };
  const next: VisitorRecord = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private browsing, nothing to do */
  }
  return next;
}

/** Note that someone showed interest in a service line, keeping the last eight. */
export function rememberInterest(line: string): VisitorRecord {
  if (!line) return readVisitor();
  const v = readVisitor();
  const interests = [{ line, at: new Date().toISOString() }, ...v.interests.filter((i) => i.line !== line)].slice(0, 8);
  return writeVisitor({ interests });
}

/** True once we hold enough to skip the contact questions. */
export const knowsVisitor = (v: VisitorRecord) =>
  v.name.trim().length > 1 && v.phone.trim().length > 5 && v.email.trim().length > 3 && v.consent;

export const visitorFirstName = (v: VisitorRecord) =>
  v.firstName.trim() || v.name.trim().split(/\s+/)[0] || "";

/** The lines they have shown interest in, newest first, excluding one. */
export const priorInterests = (v: VisitorRecord, exclude?: string) =>
  v.interests.filter((i) => i.line !== exclude).map((i) => i.line);
