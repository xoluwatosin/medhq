// Offers, engagements and leave.
//
// An offer is one record whether it is a run of dated shifts or an ongoing
// role. Accepting a role opens an engagement; accepting shifts simply books
// the hours. Nothing here writes over the candidate's own availability: booked
// shifts and approved leave are worked out live by mu_system_blocks and shown
// on top of the calendar.

export type OfferKind = "shift" | "role";
export type OfferStatus =
  | "draft" | "sent" | "viewed" | "accepted" | "declined" | "withdrawn" | "expired";

export interface OfferShift {
  slot_date: string;
  start_hour: number;
  end_hour: number;
  location?: string | null;
}

/**
 * The terms of an offer.
 *
 * An offer is not a message with a rate scribbled on it. These are the things
 * a person needs before they can say yes, written once by us and read back
 * unchanged by them.
 */
export interface OfferTerms {
  basis?: string;              // Full time, part time, locum, live-in
  pay_amount?: string;         // The figure, as typed
  pay_currency?: string;       // NGN by default
  pay_frequency?: string;      // per hour, per shift, per month
  pay_extras?: string;         // Allowances, transport, feeding
  weekly_hours?: string;
  end_date?: string;
  site?: string;               // Household, clinic or ward
  reports_to?: string;
  duties?: string;
  provided?: string;           // What we provide
  probation?: string;
  notice_period?: string;
  next_steps?: string;
}

export interface Offer {
  id: string;
  person_id?: string;
  opportunity_id?: string | null;
  kind: OfferKind;
  /** Which layer this belongs to: an engagement, or work under one. */
  engagement_type?: string | null;
  /** The engagement this work sits under. */
  parent_offer_id?: string | null;
  title: string;
  location: string | null;
  rate_note: string | null;
  message: string | null;
  pattern: string | null;
  start_date: string | null;
  status: OfferStatus;
  expires_at: string | null;
  created_at: string;
  responded_at: string | null;
  decline_reason: string | null;
  terms?: OfferTerms | null;
  /** In the bin: kept on the record but out of the way. */
  deleted_at?: string | null;
  deleted_by?: string | null;
  shifts?: OfferShift[];
}



export interface Engagement {
  id: string;
  person_id: string;
  title: string;
  pattern: string | null;
  location: string | null;
  rate_note: string | null;
  start_date: string;
  end_date: string | null;
  status: "active" | "ended";
  notes: string | null;
}

export interface LeaveRequest {
  id: string;
  person_id: string;
  from_date: string;
  to_date: string;
  reason: string | null;
  status: "requested" | "approved" | "declined" | "withdrawn";
  decision_note: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  created_at: string;
}

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  draft: "Not sent",
  sent: "Waiting on you",
  viewed: "Opened",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn by us",
  expired: "Expired",
};

export const OFFER_STATUS_ADMIN_LABEL: Record<OfferStatus, string> = {
  draft: "Not sent",
  sent: "Sent, no answer yet",
  viewed: "Opened, no answer yet",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

export const LEAVE_STATUS_LABEL: Record<LeaveRequest["status"], string> = {
  requested: "Waiting on us",
  approved: "Approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

export const OPEN_OFFER_STATUSES: OfferStatus[] = ["sent", "viewed"];

export const isOfferOpen = (o: Offer) =>
  OPEN_OFFER_STATUSES.includes(o.status) &&
  (!o.expires_at || new Date(o.expires_at).getTime() > Date.now());

export const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export const shiftLabel = (s: OfferShift) =>
  `${new Date(`${s.slot_date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  })} · ${hourLabel(s.start_hour)}–${hourLabel(s.end_hour)}`;

export const dateLabel = (d: string | null | undefined) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

/** Shift presets, matching the ones on the availability calendar. */
export const SHIFT_PRESETS = [
  { label: "Day 08:00–20:00", start: 8, end: 20 },
  { label: "Night 20:00–08:00", start: 20, end: 8 },
  { label: "Morning 07:00–13:00", start: 7, end: 13 },
  { label: "Afternoon 13:00–19:00", start: 13, end: 19 },
  { label: "Full 24 hours", start: 0, end: 0 },
];

export interface SystemBlock {
  slot_date: string;
  hours: number[];
  reason: "booked" | "leave";
  label: string | null;
}

/** The pay line, written the way a person says it out loud. */
export const payLine = (t?: OfferTerms | null, fallback?: string | null) => {
  if (!t) return fallback || "";
  const figure = (t.pay_amount || "").trim();
  if (!figure) return fallback || "";
  const cur = (t.pay_currency || "NGN").trim();
  const freq = (t.pay_frequency || "").trim();
  return [`${cur} ${figure}`, freq].filter(Boolean).join(" ");
};

/** Terms as label and value pairs, skipping anything we did not say. */
export function offerTermRows(o: Offer): { label: string; value: string }[] {
  const t = o.terms || {};
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value?: string | null) => {
    if (value && String(value).trim()) rows.push({ label, value: String(value).trim() });
  };
  add("Basis", t.basis);
  add("Pay", payLine(t, o.rate_note));
  add("On top of pay", t.pay_extras);
  add("Hours a week", t.weekly_hours);
  add("Pattern", o.pattern);
  add("Starts", o.start_date ? dateLabel(o.start_date) : "");
  add("Runs until", t.end_date ? dateLabel(t.end_date) : "");
  add("Where", o.location);
  add("Site", t.site);
  add("Reports to", t.reports_to);
  add("Probation", t.probation);
  add("Notice", t.notice_period);
  return rows;
}
