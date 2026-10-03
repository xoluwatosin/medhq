// The assessment as the screens see it.
//
// Two things are kept apart on purpose. Scheduling, assignment and state live
// on care_assessment_work. What the assessor writes lives on a care document.
// Moving a visit never touches the clinical record.
//
// Note on content: the questions come from the published assessment
// definition and nowhere else. Alongside them the workspace carries the
// family's pre-assessment answers as evidence to confirm or amend, plus the
// assessor's own written account of each part of the visit.
import { adminDb } from "@/lib/admin-utils";
import { supabase } from "@/integrations/supabase/client";
import { fieldVisible, isAnswered, type CareField } from "@/lib/care";
import type { StatusTone } from "@/components/field/Status";

export type AssessmentStatus = "requested" | "scheduled" | "in_progress" | "submitted" | "cancelled";

/** A reviewer's decision on one check. The server accepts nothing else. */
export type CheckDecision = "met" | "not_met" | "not_applicable";
export type ReviewChecklist = Record<string, { decision?: CheckDecision; note?: string }>;

/**
 * The twelve checks a clinical review makes. The same twelve are held by the
 * database, so a review cannot be accepted on a different set.
 */
export const REVIEW_CHECKS: { key: string; label: string }[] = [
  { key: "identity_and_consent", label: "Identity, consent and the basis for sharing are recorded" },
  { key: "capacity_and_participation", label: "Decision-making and participation are properly assessed" },
  { key: "carried_evidence_decided", label: "Every carried family answer is confirmed or amended with a reason" },
  { key: "clinical_history_complete", label: "Clinical history and current condition are sufficient" },
  { key: "medicines_and_allergies_safe", label: "Medicines and allergies are reconciled and safe" },
  { key: "daily_living_and_mobility", label: "Daily living, mobility and the environment are assessed" },
  { key: "nutrition_hydration_continence", label: "Nutrition, hydration and continence are assessed" },
  { key: "skin_wounds_and_pain", label: "Skin, wounds and pain are assessed" },
  { key: "risks_and_safeguarding", label: "Risks and safeguarding are identified with controls" },
  { key: "escalation_and_monitoring", label: "Escalation and monitoring requirements are clear" },
  { key: "recommendation_supported", label: "The recommended model and capabilities follow from the evidence" },
  { key: "suitable_to_proceed", label: "It is clinically suitable to proceed" },
];

export const CHECK_DECISIONS: { value: CheckDecision; label: string }[] = [
  { value: "met", label: "Met" },
  { value: "not_met", label: "Not met" },
  { value: "not_applicable", label: "Not applicable" },
];

/** Why an assessment is being returned. The server accepts nothing else. */
export type ReturnCategory =
  | "incomplete" | "clinical_detail" | "evidence_not_decided" | "risk_or_safeguarding"
  | "medicines" | "recommendation" | "other";

export const RETURN_CATEGORIES: { value: ReturnCategory; label: string }[] = [
  { value: "incomplete", label: "Sections left incomplete" },
  { value: "clinical_detail", label: "Clinical detail insufficient" },
  { value: "evidence_not_decided", label: "Carried answers not decided" },
  { value: "risk_or_safeguarding", label: "Risk or safeguarding" },
  { value: "medicines", label: "Medicines or allergies" },
  { value: "recommendation", label: "Recommendation not supported" },
  { value: "other", label: "Other" },
];

export type ReturnPriority = "routine" | "important" | "urgent";

export const RETURN_PRIORITIES: { value: ReturnPriority; label: string }[] = [
  { value: "routine", label: "Routine" },
  { value: "important", label: "Important" },
  { value: "urgent", label: "Urgent" },
];

export const checklistDecided = (checklist: ReviewChecklist): number =>
  REVIEW_CHECKS.filter((check) => checklist[check.key]?.decision).length;

/** A check that is not met has to say what is wrong with it. */
export const checkNeedsNote = (entry: { decision?: CheckDecision; note?: string } | undefined): boolean =>
  entry?.decision === "not_met" && !entry.note?.trim();

export const checklistNotesComplete = (checklist: ReviewChecklist): boolean =>
  REVIEW_CHECKS.every((check) => !checkNeedsNote(checklist[check.key]));

/** Accepting needs every check decided, and none left unmet. */
export const checklistAllowsAccept = (checklist: ReviewChecklist): boolean =>
  REVIEW_CHECKS.every((check) => {
    const decision = checklist[check.key]?.decision;
    return decision === "met" || decision === "not_applicable";
  });

export const saveReviewChecklist = async (id: string, checklist: ReviewChecklist): Promise<void> => {
  const { error } = await adminDb().rpc("care_review_checklist_save", {
    _id: id, _checklist: checklist as never,
  });
  if (error) throw error;
};

/** One review, bound to the exact assessment version it judged. */
export interface AssessmentReview {
  id: string;
  assessment_work_id: string;
  assessment_document_id: string;
  client_id: string;
  status: "open" | "accepted" | "returned";
  checklist: ReviewChecklist;
  decision: "accepted" | "returned" | null;
  decision_reason: string | null;
  return_category: ReturnCategory | null;
  return_instructions: string | null;
  return_priority: ReturnPriority | null;
  decision_notes: string | null;
  reviewer_user_id: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface ReviewRecord {
  current: AssessmentReview | null;
  history: AssessmentReview[];
}

/**
 * The review of the version being read, plus the reviews of the versions
 * before it. Earlier reviews are history: they are never merged into the
 * current checklist.
 */
export const reviewRecord = async (workId: string): Promise<ReviewRecord> => {
  const { data, error } = await adminDb().rpc("care_review_record", { _work: workId });
  if (error) throw error;
  const held = (data ?? {}) as unknown as Partial<ReviewRecord>;
  return { current: held.current ?? null, history: held.history ?? [] };
};

export interface ReturnDecision {
  reason: string;
  category: ReturnCategory;
  instructions: string;
  priority: ReturnPriority;
}

/** Everything the return contract requires, together. */
export const returnAssessment = async (id: string, decision: ReturnDecision): Promise<void> => {
  const { error } = await adminDb().rpc("care_assessment_return", {
    _id: id,
    _reason: decision.reason.trim(),
    _category: decision.category,
    _instructions: decision.instructions.trim(),
    _priority: decision.priority,
  });
  if (error) throw error;
};

export const returnReady = (decision: Partial<ReturnDecision>): boolean =>
  !!decision.category && !!decision.priority
  && !!decision.reason?.trim() && !!decision.instructions?.trim();


export interface AssessmentWork {
  id: string;
  client_id: string;
  status: AssessmentStatus;
  appointment_at: string | null;
  appointment_ends_at: string | null;
  location_kind: string;
  notes: string | null;
  assessor_person_id: string | null;
  assigned_at: string | null;
  document_id: string | null;
  started_at: string | null;
  submitted_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  /** Clinical review of the sent assessment. Null until a reviewer decides. */
  review_decision: "accepted" | "returned" | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  /** The twelve checks, as the reviewer left them. Null until one is recorded. */
  review_checklist: ReviewChecklist | null;
  created_at: string;
  updated_at: string;
}

export interface AssessorOption {
  person_id: string;
  full_name: string;
  profession: string | null;
  has_account: boolean;
}

export const ASSESSMENT_STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  in_progress: "In progress",
  submitted: "Submitted",
  cancelled: "Cancelled",
};

export const assessmentStatusLabel = (status: string) => ASSESSMENT_STATUS_LABELS[status] ?? status;

export const assessmentStatusTone = (status: string): StatusTone => {
  if (status === "submitted") return "good";
  if (status === "cancelled") return "neutral";
  if (status === "in_progress") return "progress";
  if (status === "scheduled") return "info";
  return "warning";
};

export const LOCATION_KINDS = [
  { value: "home", label: "At home" },
  { value: "clinic", label: "At a clinic" },
  { value: "virtual", label: "By video call" },
] as const;

export const locationLabel = (kind: string) =>
  LOCATION_KINDS.find((l) => l.value === kind)?.label ?? kind;

/** Every assessment on a client, newest first. */
export const clientAssessments = async (clientId: string): Promise<AssessmentWork[]> => {
  const { data, error } = await adminDb()
    .from("care_assessment_work")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AssessmentWork[];
};

export const liveAssessment = (rows: AssessmentWork[]): AssessmentWork | null =>
  rows.find((r) => ["requested", "scheduled", "in_progress"].includes(r.status)) ?? null;

export const assessorOptions = async (): Promise<AssessorOption[]> => {
  const { data, error } = await adminDb().rpc("care_assessor_options");
  if (error) throw error;
  return (data ?? []) as unknown as AssessorOption[];
};

/** One sent assessment, whole, for reading only. */
export interface AssessmentRecord {
  document: {
    id: string;
    client_id: string;
    status: string;
    version: number | null;
    responses: Record<string, unknown>;
    built_from_id: string | null;
    supersedes_id: string | null;
    submitted_at: string | null;
    content_hash: string | null;
    /** What was required, applicable and still unanswered when it was sent. */
    outstanding_required?: unknown[];
    assessment_work_id?: string | null;
    resolved_modules?: string[];
  };
  author: string | null;
  source_document_id: string | null;
  /** The exact definition this assessment document was written against. */
  definition: import("@/lib/care").CareDefinition;
  definition_version: number | null;
  /** The modules frozen onto the document when the visit was started. */
  resolved_modules: string[];
  pre_assessment: Record<string, unknown>;
  pre_assessment_definition: { sections?: import("@/lib/care").CareSection[] };
  pre_assessment_version: number | null;
  flags: { id: string; kind: string; severity: string | null; detail: string | null; cleared_at: string | null }[];
}

export const assessmentRecord = async (workId: string): Promise<AssessmentRecord | null> => {
  const { data, error } = await adminDb().rpc("care_assessment_record", { _id: workId });
  if (error) throw error;
  return (data ?? null) as unknown as AssessmentRecord | null;
};

/** The assessments assigned to the signed-in professional. */
export const myAssessments = async (): Promise<AssessmentWork[]> => {
  const { data, error } = await supabase
    .from("care_assessment_work")
    .select("*")
    .in("status", ["scheduled", "in_progress"])
    .order("appointment_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as AssessmentWork[];
};

export interface EvidenceItem {
  field_id: string;
  record: string;
  answer: string;
  /**
   * A controlled answer stays controlled when it is amended, so the options
   * the family chose from travel with the evidence.
   */
  options?: { value: string; label: string }[];
}

/**
 * A carried answer the assessor reads but does not judge: context the family
 * gave, or the authority and consent recorded with it.
 */
export interface CarriedNote {
  field_id: string;
  record: string;
  answer: string;
}

export interface AssessmentSection {
  id: string;
  title: string;
  /** Carried pre-assessment answers, each needing a decision. */
  evidence: EvidenceItem[];
  /** What the family said, for reading only. Never confirmed or amended. */
  context: CarriedNote[];
  /** Who authorised this and what was consented to. Read only. */
  authority: CarriedNote[];
  /**
   * The assessor's own questions, taken from the published assessment
   * definition this document was written against. Never invented here.
   */
  questions: CareField[];
  /** Whether this section takes the assessor's written account. */
  note: boolean;
}


/** What an assessor decided about one carried answer. */
export interface ConfirmAmend {
  decision: "confirmed" | "amended";
  /** An amended answer keeps the shape of the question it replaces. */
  value?: unknown;
  /** Why it was amended. Required by the server before an amendment is held. */
  reason?: string;
  /** Stamped by the server: when, by whom, and what it replaces. */
  at?: string;
  by?: string;
  replaces?: unknown;
  source_document_id?: string;
}

export const confirmFieldId = (fieldId: string) => `confirm.${fieldId}`;
export const noteFieldId = (sectionId: string) => `note.${sectionId}`;

export const readConfirm = (value: unknown): ConfirmAmend | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.decision !== "confirmed" && record.decision !== "amended") return null;
  const text = (key: string) => (typeof record[key] === "string" ? (record[key] as string) : undefined);
  return {
    decision: record.decision,
    value: record.value,
    reason: text("reason"),
    at: text("at"),
    by: text("by"),
    replaces: record.replaces,
    source_document_id: text("source_document_id"),
  };
};

/** An amendment is only settled once it says what is different and why. */
export const confirmSettled = (decision: ConfirmAmend | null): boolean => {
  if (!decision) return false;
  if (decision.decision === "confirmed") return true;
  return isAnswered(decision.value) && !!decision.reason?.trim();
};

/**
 * How much of a section the assessor has dealt with: every carried answer
 * needs a decision, and every required clinical question needs an answer.
 */
export const sectionProgress = (
  section: AssessmentSection,
  responses: Record<string, unknown>,
): { decided: number; total: number } => {
  const questions = (section.questions ?? []).filter((f) => f.required && fieldVisible(f, responses));
  return {
    decided:
      section.evidence.filter((e) => confirmSettled(readConfirm(responses[confirmFieldId(e.field_id)]))).length +
      questions.filter((f) => isAnswered(responses[f.id])).length,
    total: section.evidence.length + questions.length,
  };
};

export const assessmentComplete = (
  sections: AssessmentSection[],
  responses: Record<string, unknown>,
): boolean =>
  sections.every((s) => {
    const { decided, total } = sectionProgress(s, responses);
    return decided === total;
  });

