// The care plan as the screens see it.
//
// The plan is a versioned document. A version that has been issued is never
// edited: a change starts a successor, and the earlier version stays on the
// record. Beneath the written sections sits the structured layer of needs,
// goals and tasks, held against one version.
import { adminDb } from "@/lib/admin-utils";

export type PlanStatus = "draft" | "submitted" | "superseded" | "abandoned";

export interface PlanDocument {
  id: string;
  client_id: string;
  status: PlanStatus;
  version: number | null;
  responses: Record<string, Record<string, unknown>>;
  built_from_id: string | null;
  supersedes_id: string | null;
  reissue_reason: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  form_definition_id: string;
}

export interface PlanApproval {
  id: string;
  document_id: string;
  content_hash: string;
  decision: "approved" | "withdrawn";
  reason: string | null;
  actor_name: string | null;
  actor_role: "clinical" | "coordinator" | "super_admin";
  created_at: string;
}

export interface PlanSection {
  id: string;
  title: string;
  order: number;
}

export interface PlanNeed {
  id: string; document_id: string; section_id: string; ordering: number;
  title: string; detail: string | null;
}
export interface PlanGoal {
  id: string; document_id: string; need_id: string | null; ordering: number;
  title: string; detail: string | null; measure: string | null;
}
export interface PlanTask {
  id: string; document_id: string; goal_id: string | null; section_id: string;
  ordering: number; title: string; detail: string | null; frequency: string | null;
}

export const PLAN_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Issued",
  superseded: "Superseded",
  abandoned: "Withdrawn",
};

export const planStatusLabel = (status: string) => PLAN_STATUS_LABELS[status] ?? status;

export const planVersionLabel = (doc: Pick<PlanDocument, "version">) =>
  doc.version ? `Version ${doc.version}` : "Version not set yet";

/** Every plan version on a client, newest first. */
export const clientPlans = async (clientId: string): Promise<PlanDocument[]> => {
  const { data, error } = await adminDb()
    .from("care_documents")
    .select("*")
    .eq("client_id", clientId)
    .eq("kind", "care_plan")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PlanDocument[];
};

/** The version being worked on, or the one currently issued. */
export const currentPlan = (rows: PlanDocument[]): PlanDocument | null =>
  rows.find((r) => r.status === "draft") ?? rows.find((r) => r.status === "submitted") ?? rows[0] ?? null;

export const planSections = async (formDefinitionId: string): Promise<PlanSection[]> => {
  const { data, error } = await adminDb()
    .from("form_definitions").select("definition").eq("id", formDefinitionId).maybeSingle();
  if (error) throw error;
  const definition = (data?.definition ?? {}) as { sections?: PlanSection[] };
  return [...(definition.sections ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

export interface PlanStructure { needs: PlanNeed[]; goals: PlanGoal[]; tasks: PlanTask[] }

export const planStructure = async (documentId: string): Promise<PlanStructure> => {
  const [needs, goals, tasks] = await Promise.all([
    adminDb().from("care_plan_needs").select("*").eq("document_id", documentId).order("ordering"),
    adminDb().from("care_plan_goals").select("*").eq("document_id", documentId).order("ordering"),
    adminDb().from("care_plan_tasks").select("*").eq("document_id", documentId).order("ordering"),
  ]);
  return {
    needs: (needs.data ?? []) as unknown as PlanNeed[],
    goals: (goals.data ?? []) as unknown as PlanGoal[],
    tasks: (tasks.data ?? []) as unknown as PlanTask[],
  };
};

export const planApprovals = async (documentId: string): Promise<PlanApproval[]> => {
  const { data, error } = await adminDb().from("care_plan_approvals").select("*")
    .eq("document_id", documentId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PlanApproval[];
};

export const approvePlan = async (documentId: string): Promise<void> => {
  const { error } = await adminDb().rpc("care_plan_approve", {
    _document_id: documentId, _decision: "approved", _reason: null,
  });
  if (error) throw error;
};

export const planIsApproved = async (documentId: string): Promise<boolean> => {
  const { data, error } = await adminDb().rpc("care_plan_is_approved", { _document_id: documentId });
  if (error) throw error;
  return data === true;
};

export const sectionNote = (doc: PlanDocument | null, sectionId: string): string => {
  const value = doc?.responses?.[sectionId] as { note?: unknown } | undefined;
  return typeof value?.note === "string" ? value.note : "";
};
