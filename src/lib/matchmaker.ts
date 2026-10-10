// Shared helpers and type system for the Healthcare Matchmakers programme.
import { adminDb } from "@/lib/admin-utils";

export const HM_BASE_PATH = "/hm";

/** Slugify a title: lowercase, hyphenated, ascii only. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

/**
 * Ensure the proposed slug is unique. If taken, append -2, -3, …
 * Optionally exclude an opportunity id (when editing an existing row).
 */
export async function ensureUniqueSlug(proposed: string, excludeId?: string): Promise<string> {
  const base = slugify(proposed) || "opportunity";
  let candidate = base;
  let n = 1;
  while (n < 50) {
    let q = adminDb().from("matchmaker_opportunities").select("id").eq("slug", candidate);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

export function buildShareUrl(slug: string | null, linkTarget: "detail" | "landing") {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.medicconnect.co";
  if (linkTarget === "landing" || !slug) return `${origin}${HM_BASE_PATH}`;
  return `${origin}${HM_BASE_PATH}/${slug}`;
}

export function buildPreviewUrl(slug: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.medicconnect.co";
  return `${origin}${HM_BASE_PATH}/${slug}?preview=1`;
}

export async function logShare(opportunityId: string | null, channel: "whatsapp" | "email" | "copy" | "native") {
  try {
    await adminDb().from("matchmaker_share_events").insert({ opportunity_id: opportunityId, channel });
  } catch {
    // analytics-only, never block the user
  }
}

export interface DocumentField {
  key: string;
  label: string;
  required: boolean;
}

// ─── Standard applicant fields ────────────────────────────────────────────────
export type StandardFieldState = "off" | "optional" | "required";
export type StandardFieldKey = "phone" | "current_position" | "years_experience" | "cover_note";

export interface StandardFieldsConfig {
  phone: StandardFieldState;
  current_position: StandardFieldState;
  years_experience: StandardFieldState;
  cover_note: StandardFieldState;
}

export const DEFAULT_STANDARD_FIELDS: StandardFieldsConfig = {
  phone: "optional",
  current_position: "optional",
  years_experience: "optional",
  cover_note: "optional",
};

export const STANDARD_FIELD_LABELS: Record<StandardFieldKey, string> = {
  phone: "Phone number",
  current_position: "Current role",
  years_experience: "Years of experience",
  cover_note: "Cover note",
};

export function normaliseStandardFields(input: any): StandardFieldsConfig {
  const merged = { ...DEFAULT_STANDARD_FIELDS, ...(input && typeof input === "object" ? input : {}) };
  const valid = (v: any): StandardFieldState =>
    v === "off" || v === "optional" || v === "required" ? v : "optional";
  return {
    phone: valid(merged.phone),
    current_position: valid(merged.current_position),
    years_experience: valid(merged.years_experience),
    cover_note: valid(merged.cover_note),
  };
}

// ─── Question builder (Monday.com style) ──────────────────────────────────────

export type QuestionType =
  | "short_text"
  | "long_text"
  | "single_select"
  | "multi_select"
  | "number"
  | "date"
  | "yes_no"
  | "file";

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  help?: string;
  required: boolean;
  options?: string[]; // for single/multi select
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  single_select: "Single select",
  multi_select: "Multi select",
  number: "Number",
  date: "Date",
  yes_no: "Yes / No",
  file: "File upload",
};

export const newQuestion = (type: QuestionType = "short_text"): Question => ({
  id: `q-${Math.random().toString(36).slice(2, 10)}`,
  type,
  label: "",
  required: false,
  options: type === "single_select" || type === "multi_select" ? ["Option 1"] : undefined,
});

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
  archived: "Archived",
};

// Application status is retired in the office: the stage list in
// src/lib/applications.ts is the one vocabulary, and mu_set_application_stage
// keeps the old status column in step for anything still reading it.
