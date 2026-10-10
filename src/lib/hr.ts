// Staff HR: leave, checklists and reviews.
//
// Every write goes through a database function that checks who is asking: the
// person themselves, their manager (anyone above them in the reporting line),
// an admin with the Workforce area, or the owner. The screens only decide what
// to show; the database decides what is allowed.
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export type LeaveType = "annual" | "sick" | "compassionate" | "maternity" | "paternity" | "study" | "unpaid" | "other";

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: "Annual leave",
  sick: "Sick leave",
  compassionate: "Compassionate leave",
  maternity: "Maternity leave",
  paternity: "Paternity leave",
  study: "Study leave",
  unpaid: "Unpaid leave",
  other: "Other",
};

export type LeaveStatus = "requested" | "approved" | "declined" | "withdrawn";

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  requested: "Waiting for a decision",
  approved: "Approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

export interface LeaveRow {
  id: string;
  person_id: string;
  full_name: string;
  leave_type: LeaveType;
  from_date: string;
  to_date: string;
  working_days: number;
  reason: string | null;
  status: LeaveStatus;
  decision_note: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  created_at: string;
  can_decide: boolean;
}

export interface LeaveBalance {
  year: number;
  allowance: number | null;
  taken: number;
  booked: number;
  pending: number;
  remaining: number | null;
}

type Result = { ok: boolean; error?: string };

const call = async (fn: string, args: Record<string, unknown>): Promise<Result & Record<string, unknown>> => {
  const { data, error } = await db().rpc(fn, args);
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false, error: "No answer" }) as Result & Record<string, unknown>;
};

export const listLeave = async (personId: string | null, onlyPending = false): Promise<LeaveRow[]> => {
  const { data, error } = await db().rpc("hr_leave_list", { _person: personId, _only_pending: onlyPending });
  if (error) throw error;
  return (data ?? []) as LeaveRow[];
};

export const leaveBalance = async (personId: string, year?: number): Promise<LeaveBalance | null> => {
  const res = await call("hr_leave_balance", { _person: personId, _year: year ?? null });
  return res.ok ? (res as unknown as LeaveBalance) : null;
};

export const requestLeave = (from: string, to: string, type: LeaveType, reason: string) =>
  call("hr_leave_request", { _from: from, _to: to, _type: type, _reason: reason || null });

export const decideLeave = (id: string, action: "approve" | "decline" | "withdraw", note?: string) =>
  call("hr_leave_decide", { _id: id, _action: action, _note: note || null });

export const workingDays = async (from: string, to: string): Promise<number | null> => {
  if (!from || !to || to < from) return null;
  const { data, error } = await db().rpc("hr_working_days", { _from: from, _to: to });
  return error ? null : (data as number);
};

/* ---- Checklists ---------------------------------------------------------- */

export type ChecklistKind = "onboarding" | "offboarding";

export interface ChecklistItem {
  id: string;
  person_id: string;
  kind: ChecklistKind;
  title: string;
  position: number;
  done_at: string | null;
  done_by_name: string | null;
  note: string | null;
}

export const loadChecklist = async (personId: string): Promise<ChecklistItem[]> => {
  const { data, error } = await db().from("hr_checklist_items").select("*").eq("person_id", personId).order("kind").order("position");
  if (error) throw error;
  return (data ?? []) as ChecklistItem[];
};

export const startChecklist = (personId: string, kind: ChecklistKind) =>
  call("hr_checklist_start", { _person: personId, _kind: kind });

export const tickChecklist = (id: string, done: boolean, note?: string) =>
  call("hr_checklist_tick", { _id: id, _done: done, _note: note || null });

/* ---- Reviews ------------------------------------------------------------- */

export type ReviewKind = "probation" | "one_to_one" | "quarterly" | "annual";
export type ReviewStatus = "scheduled" | "draft" | "shared" | "acknowledged";
export type ProbationOutcome = "passed" | "extended" | "not_passed";

export const REVIEW_KIND_LABELS: Record<ReviewKind, string> = {
  probation: "Probation review",
  one_to_one: "One to one",
  quarterly: "Quarterly review",
  annual: "Annual appraisal",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  scheduled: "Booked",
  draft: "Being written",
  shared: "Shared, waiting for them",
  acknowledged: "Done",
};

export const OUTCOME_LABELS: Record<ProbationOutcome, string> = {
  passed: "Passed probation",
  extended: "Probation extended",
  not_passed: "Did not pass probation",
};

export const PROBATION_LABELS: Record<string, string> = {
  in_probation: "In probation",
  passed: "Passed",
  extended: "Extended",
  not_passed: "Did not pass",
};

export const RATING_LABELS: Record<number, string> = {
  1: "1, well below expectations",
  2: "2, below expectations",
  3: "3, meets expectations",
  4: "4, above expectations",
  5: "5, outstanding",
};

export interface Review {
  id: string;
  person_id: string;
  reviewer_person_id: string | null;
  kind: ReviewKind;
  period_label: string | null;
  due_date: string | null;
  status: ReviewStatus;
  rating: number | null;
  achievements: string | null;
  development: string | null;
  objectives: string | null;
  outcome: ProbationOutcome | null;
  employee_comments: string | null;
  shared_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export const loadReviews = async (personId: string): Promise<Review[]> => {
  const { data, error } = await db().from("hr_reviews").select("*").eq("person_id", personId).order("due_date", { ascending: false, nullsFirst: true });
  if (error) throw error;
  return (data ?? []) as Review[];
};

/** Reviews still to be written that are due by a date, across everyone the caller may manage. */
export const loadDueReviews = async (by: string): Promise<Review[]> => {
  const { data, error } = await db().from("hr_reviews").select("*").in("status", ["scheduled", "draft"]).lte("due_date", by).order("due_date");
  if (error) throw error;
  return (data ?? []) as Review[];
};

export const saveReview = async (review: Partial<Review> & { person_id: string }): Promise<Result> => {
  const { id, ...fields } = review;
  const clean = {
    ...fields,
    status: fields.status === "scheduled" && (fields.achievements || fields.objectives || fields.development) ? "draft" : fields.status,
    updated_at: new Date().toISOString(),
  };
  const { error } = id
    ? await db().from("hr_reviews").update(clean).eq("id", id)
    : await db().from("hr_reviews").insert(clean);
  return error ? { ok: false, error: error.message } : { ok: true };
};

export const shareReview = (id: string) => call("hr_review_share", { _id: id });

export const acknowledgeReview = (id: string, comments: string) =>
  call("hr_review_acknowledge", { _id: id, _comments: comments || null });

/* ---- Team ---------------------------------------------------------------- */

export interface TeamMember {
  id: string;
  full_name: string;
  job_title: string | null;
  reports_to: string | null;
  direct: boolean;
  staff_start_date: string | null;
  probation_end: string | null;
  probation_status: string | null;
  pending_leave: number;
  next_review: string | null;
}

export const loadMyTeam = async (): Promise<TeamMember[]> => {
  const { data, error } = await db().rpc("hr_my_team");
  if (error) throw error;
  return (data ?? []) as TeamMember[];
};

/** "16 to 20 Nov 2026", or a single day. */
export const formatLeaveDates = (from: string, to: string): string => {
  const f = new Date(`${from}T12:00:00`);
  const t = new Date(`${to}T12:00:00`);
  const day = (d: Date, withMonth: boolean, withYear: boolean) =>
    d.toLocaleDateString("en-GB", { day: "numeric", ...(withMonth ? { month: "short" } : {}), ...(withYear ? { year: "numeric" } : {}) });
  if (from === to) return day(f, true, true);
  const sameYear = f.getFullYear() === t.getFullYear();
  const sameMonth = sameYear && f.getMonth() === t.getMonth();
  return `${day(f, !sameMonth, !sameYear)} to ${day(t, true, true)}`;
};

/** Days until a date, from today; negative once it has passed. */
export const daysUntil = (date: string): number => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((new Date(`${date}T12:00:00`).getTime() - today.getTime()) / 86_400_000);
};
