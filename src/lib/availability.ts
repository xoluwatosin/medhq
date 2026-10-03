// Availability calendar (ported from Hero Hub, keyed to Match Universe people).
//
// Three states only, and they mean different things:
//   available   - the candidate has said they are free in the window
//   unavailable - the candidate has said they are booked in the window
//   unknown     - the candidate has said nothing. Silence, not a "no".
// Unknown never excludes anyone from a shortlist; it only scores lower.
//
// Resolution rule: an explicit day always beats the weekly template.

export type BlockKey = "morning" | "afternoon" | "evening" | "night";

export const BLOCKS: { key: BlockKey; label: string; hours: number[] }[] = [
  { key: "morning", label: "Morning", hours: [7, 8, 9, 10, 11, 12] },
  { key: "afternoon", label: "Afternoon", hours: [13, 14, 15, 16, 17, 18] },
  { key: "evening", label: "Evening", hours: [19, 20, 21, 22] },
  { key: "night", label: "Night", hours: [23, 0, 1, 2, 3, 4, 5, 6] },
];

export const BLOCK_LABEL: Record<BlockKey, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

/** Hours the candidate has marked free, per block. An empty object means "booked all day". */
export type Blocks = Partial<Record<BlockKey, number[]>>;

export type AvailabilityState = "available" | "unavailable" | "unknown";

export interface DayRow {
  id?: string;
  person_id?: string;
  slot_date: string; // yyyy-mm-dd
  blocks: Blocks;
}

export interface RecurrenceRow {
  id?: string;
  person_id?: string;
  weekday: number; // 0 = Monday ... 6 = Sunday (isodow - 1, matching the SQL resolver)
  blocks: Blocks;
  active: boolean;
}

export const toISODate = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const addDays = (d: Date, n: number): Date => {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
};

/** Monday of the week containing d. */
export const startOfWeek = (d: Date): Date => {
  const out = new Date(d);
  const iso = (out.getDay() + 6) % 7; // 0 = Monday
  out.setDate(out.getDate() - iso);
  out.setHours(0, 0, 0, 0);
  return out;
};

export const weekdayOf = (d: Date): number => (d.getDay() + 6) % 7;

export const hasAnyHours = (blocks: Blocks | null | undefined): boolean =>
  !!blocks && BLOCKS.some((b) => (blocks[b.key]?.length ?? 0) > 0);

/** Explicit day wins; otherwise the active weekly template; otherwise nothing is known. */
export function resolveDay(
  date: Date,
  days: Map<string, Blocks>,
  recurrence: Map<number, Blocks>,
): { blocks: Blocks | null; source: "day" | "recurrence" | null } {
  const explicit = days.get(toISODate(date));
  if (explicit !== undefined) return { blocks: explicit, source: "day" };
  const template = recurrence.get(weekdayOf(date));
  if (template !== undefined) return { blocks: template, source: "recurrence" };
  return { blocks: null, source: null };
}

export function dayState(
  date: Date,
  days: Map<string, Blocks>,
  recurrence: Map<number, Blocks>,
): AvailabilityState {
  const { blocks } = resolveDay(date, days, recurrence);
  if (blocks === null) return "unknown";
  return hasAnyHours(blocks) ? "available" : "unavailable";
}

/** Same rule as public.mu_availability_state in the database. Keep the two in step. */
export function rangeState(
  from: Date,
  to: Date,
  days: Map<string, Blocks>,
  recurrence: Map<number, Blocks>,
): AvailabilityState {
  let touched = 0;
  let free = 0;
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    const s = dayState(d, days, recurrence);
    if (s === "unknown") continue;
    touched += 1;
    if (s === "available") free += 1;
  }
  if (touched === 0) return "unknown";
  return free > 0 ? "available" : "unavailable";
}

export const STATE_LABEL: Record<AvailabilityState, string> = {
  available: "Available",
  unavailable: "Not available",
  unknown: "Not told us yet",
};


/** A calendar nobody has touched in a fortnight is stale, not wrong. Say so. */
export const isFresh = (lastUpdate: string | null | undefined): boolean =>
  !!lastUpdate && Date.now() - new Date(lastUpdate).getTime() < 14 * 24 * 60 * 60 * 1000;

export const freshnessLabel = (lastUpdate: string | null | undefined): string => {
  if (!lastUpdate) return "Never updated";
  const days = Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 86400000);
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 14) return `Updated ${days} days ago`;
  return `Last updated ${days} days ago (stale)`;
};

export const toBlocks = (raw: unknown): Blocks => {
  if (!raw || typeof raw !== "object") return {};
  const out: Blocks = {};
  for (const b of BLOCKS) {
    const v = (raw as Record<string, unknown>)[b.key];
    if (Array.isArray(v)) out[b.key] = v.filter((h): h is number => typeof h === "number");
  }
  return out;
};
