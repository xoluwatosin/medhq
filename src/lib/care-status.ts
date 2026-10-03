// What a Care state looks like, decided once.
//
// The words come from CLIENT_STAGE_LABELS and the tones follow the Match
// Universe vocabulary, so a colour means the same thing on a client record as
// it does on a candidate record. Screens render this; they never invent their
// own colour map and never invent a state.
import type { StatusTone } from "@/components/field/Status";
import { CLIENT_STAGE_LABELS } from "@/lib/care";

const STAGE_TONE: Record<string, StatusTone> = {
  enquiry: "warning",
  callback_due: "warning",
  awaiting_pre_assessment: "progress",
  pre_assessment_sent: "progress",
  pre_assessment_received: "good",
  responses_returned: "good",
  assessment_booked: "info",
  assessment_in_progress: "progress",
  assessment_complete: "info",
  clinical_review: "info",
  care_plan_preparation: "progress",
  care_setup: "progress",
  plan_preparation: "progress",
  plan_issued: "good",
  care_running: "good",
  paused: "warning",
  closed: "neutral",
};

export const careStageTone = (stage: string): StatusTone => STAGE_TONE[stage] ?? "neutral";

export const careStageLabel = (stage: string): string => CLIENT_STAGE_LABELS[stage] ?? stage;

/** Severity on a flag, in the same vocabulary. */
export const careFlagTone = (severity: string): StatusTone =>
  severity === "urgent" ? "bad" : "warning";

/** The state of a pre-assessment document. */
export const careDocumentTone = (status: string | null | undefined): StatusTone =>
  status === "submitted" ? "good" : status ? "progress" : "neutral";
