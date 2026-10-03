// The Care work engine, as screens see it.
//
// Ranking lives in the database (care_work_ranked) so the list, the record and
// anything later all agree on what is next. Nothing here decides an order.
import { adminDb } from "@/lib/admin-utils";
import { formatDateTime } from "@/lib/format";
import type { StatusTone } from "@/components/field/Status";

export interface WorkItem {
  id: string;
  client_id: string;
  kind: string;
  title: string;
  detail: string | null;
  status: string;
  priority: string;
  is_blocker: boolean;
  due_at: string | null;
  assignee_user_id: string | null;
  team: string | null;
  blocked_by: string | null;
  created_at: string;
  rank_order: number;
  rank_reason: string;
}

export interface NextAction {
  client_id: string;
  work_id: string;
  kind: string;
  title: string;
  status: string;
  priority: string;
  is_blocker: boolean;
  due_at: string | null;
  assignee_user_id: string | null;
  team: string | null;
  rank_order: number;
  rank_reason: string;
}

/** Outstanding work for one client, most important first. */
export const outstandingWork = async (clientId: string): Promise<WorkItem[]> => {
  const { data, error } = await adminDb().rpc("care_work_ranked", { _client_id: clientId });
  if (error) throw error;
  return (data ?? []) as unknown as WorkItem[];
};

/** The one next action for every client that has any. */
export const nextActions = async (): Promise<NextAction[]> => {
  const { data, error } = await adminDb().from("care_client_next_action").select("*");
  if (error) throw error;
  return (data ?? []) as unknown as NextAction[];
};

/** When a piece of work is due, read plainly. */
export const dueText = (due: string | null | undefined): string => {
  if (!due) return "No date set";
  const when = new Date(due);
  const hours = (when.getTime() - Date.now()) / 3600000;
  if (hours < 0) return `Overdue since ${formatDateTime(due)}`;
  if (hours < 24) return `Due ${formatDateTime(due)}`;
  return `Due ${formatDateTime(due)}`;
};

export const workTone = (item: { rank_order: number; status: string }): StatusTone => {
  if (item.status === "blocked") return "neutral";
  if (item.rank_order <= 2) return "bad";
  if (item.rank_order === 3) return "warning";
  if (item.rank_order === 4) return "progress";
  return "info";
};

export interface StaffOption {
  user_id: string;
  display_name: string;
  email: string | null;
}

/** Who work can be given to: active staff, by their stable identity. */
export const staffOptions = async (): Promise<StaffOption[]> => {
  const { data, error } = await adminDb()
    .from("admin_permissions")
    .select("user_id, display_name, email")
    .eq("is_active", true)
    .order("display_name");
  if (error) throw error;
  return (data ?? []) as unknown as StaffOption[];
};

/** The teams work can sit with while it waits for a person. */
export const WORK_TEAMS = [
  { value: "care", label: "Care coordination" },
  { value: "clinical", label: "Clinical" },
  { value: "finance", label: "Finance" },
] as const;

export const teamLabel = (team: string | null | undefined) =>
  team ? WORK_TEAMS.find((t) => t.value === team)?.label ?? team : "No team";

/** True where a client needs somebody now rather than later. */
export const needsAttention = (action?: { rank_order: number } | null) =>
  !!action && action.rank_order <= 3;
