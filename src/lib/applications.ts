// Application stages. One vocabulary for the office and the candidate, so the
// two sides never describe the same record differently.

export const APPLICATION_STAGES = [
  "applied",
  "shortlisted",
  "interview_offered",
  "interview_booked",
  "interview_held",
  "offer_made",
  "not_taken_forward",
  "withdrawn",
] as const;

export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

/** What the office sees. Record language, not conversation. */
export const STAGE_LABEL: Record<string, string> = {
  applied: "Applied",
  shortlisted: "Shortlisted",
  interview_offered: "Interview offered",
  interview_booked: "Interview booked",
  interview_held: "Interview held",
  offer_made: "Offer made",
  not_taken_forward: "Not taken forward",
  withdrawn: "Withdrawn",
};

/** What the candidate sees. Same state, addressed to them. */
export const STAGE_LABEL_CANDIDATE: Record<string, string> = {
  applied: "With our team",
  shortlisted: "Shortlisted",
  interview_offered: "Interview times offered",
  interview_booked: "Interview booked",
  interview_held: "Interview held",
  offer_made: "Offer made",
  not_taken_forward: "Not taken forward",
  withdrawn: "Withdrawn by you",
};

export const STAGE_TONE = (stage: string): "good" | "warning" | "neutral" =>
  stage === "offer_made" ? "good"
  : stage === "interview_offered" ? "warning"
  : stage === "not_taken_forward" || stage === "withdrawn" ? "neutral"
  : "neutral";

/** Stages an application can still be moved to from where it stands. */
export const nextStages = (stage: string): ApplicationStage[] =>
  APPLICATION_STAGES.filter((s) => s !== stage && s !== "withdrawn");

export interface InterviewSlot {
  id: string;
  starts_at: string;
  duration_minutes: number;
  mode: string;
  location: string | null;
  status: string;
}

export interface ApplicationRecord {
  id: string;
  kind: string;
  title: string;
  location: string | null;
  applied_at: string;
  stage: string;
  stage_at: string;
  stage_note: string | null;
  opportunity_id: string | null;
  can_withdraw: boolean;
  slots: InterviewSlot[];
}

export const slotSentence = (s: InterviewSlot) => {
  const when = new Date(s.starts_at).toLocaleString("en-GB", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
  const how = s.mode === "video" ? "Video call" : s.mode === "phone" ? "Telephone" : (s.location || "In person");
  return `${when}, ${s.duration_minutes} minutes. ${how}.`;
};
