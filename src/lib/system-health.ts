// System health: the shapes public.ops_overview() returns and the rules the
// screen, the header bell and the Overview strip share.
//
// The database decides every status; this file only names and orders them.
import type { StatusTone } from "@/components/field/Status";

export type HealthStatus = "ok" | "info" | "warning" | "critical";
export type AlertSeverity = Exclude<HealthStatus, "ok">;

export const HEALTH_PERMISSION = "system_health";

export interface CheckResult {
  subkey: string;
  status: HealthStatus;
  title: string;
  summary: string | null;
  detail: Record<string, unknown>;
  link: string | null;
  observed_at: string;
}

export interface HealthCheck {
  key: string;
  label: string;
  area: string;
  description: string;
  enabled: boolean;
  last_run_at: string | null;
  last_status: HealthStatus | "error" | null;
  last_error: string | null;
  results: CheckResult[];
}

export interface AdminAlert {
  id: string;
  kind: string;
  title: string;
  summary: string | null;
  detail: Record<string, unknown> | null;
  severity: AlertSeverity;
  source: string;
  area: string | null;
  link: string | null;
  occurrences: number;
  created_at: string;
  last_seen_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  email_count: number;
  last_emailed_at: string | null;
}

export interface JobRun {
  status: string;
  started: string | null;
  ended: string | null;
  message: string | null;
}

export interface ScheduledJob {
  name: string;
  schedule: string;
  active: boolean;
  runs: JobRun[];
}

export interface FunctionError {
  id: string;
  function_name: string;
  status: number;
  message: string | null;
  occurred_at: string;
}

export interface AlertEmail {
  kind: "alerts" | "digest";
  status: "sending" | "sent" | "failed";
  alerts: number;
  error: string | null;
  created_at: string;
}

export interface HealthOverview {
  generated_at: string;
  checks: HealthCheck[];
  alerts: AdminAlert[];
  recently_resolved: AdminAlert[];
  jobs: ScheduledJob[];
  function_errors: FunctionError[];
  emails: AlertEmail[];
}

/** Display order of the areas, which is also the order of the status strip. */
export const HEALTH_AREAS: { key: string; label: string }[] = [
  { key: "care", label: "Care delivery" },
  { key: "talent", label: "Talent" },
  { key: "email", label: "Email" },
  { key: "payments", label: "Payments" },
  { key: "jobs", label: "Scheduled jobs" },
  { key: "functions", label: "Back-end functions" },
  { key: "services", label: "Outside services" },
];

/** Alerts raised outside the checks name their source instead. */
const SOURCE_LABEL: Record<string, string> = { intake: "Candidate sign-up" };

export const areaLabel = (key: string | null | undefined, source?: string | null): string =>
  HEALTH_AREAS.find((a) => a.key === key)?.label ?? key ?? SOURCE_LABEL[source ?? ""] ?? "General";

const RANK: Record<HealthStatus, number> = { ok: 0, info: 1, warning: 2, critical: 3 };

export const worstStatus = (statuses: (HealthStatus | null | undefined)[]): HealthStatus =>
  statuses.reduce<HealthStatus>((worst, s) => (s && RANK[s] > RANK[worst] ? s : worst), "ok");

export const STATUS_LABEL: Record<HealthStatus, string> = {
  ok: "All clear",
  info: "Note",
  warning: "Needs a look",
  critical: "Needs action now",
};

/** Fits a narrow tile. */
export const STATUS_SHORT_LABEL: Record<HealthStatus, string> = {
  ok: "All clear",
  info: "Note",
  warning: "Needs a look",
  critical: "Act now",
};

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  info: "Note",
  warning: "Warning",
  critical: "Critical",
};

export const STATUS_TONE: Record<HealthStatus, StatusTone> = {
  ok: "good",
  info: "info",
  warning: "warning",
  critical: "bad",
};

/** Red is reserved for what needs action now; the shape says it too. */
export const STATUS_CLASS: Partial<Record<HealthStatus, string>> = {
  critical: "bg-status-alert-soft text-status-alert",
};

/**
 * One status per area: the worst current check result, raised by any open
 * alert in that area (an intake alert has no check behind it). Areas with no
 * checks are left out.
 */
export const areaStatuses = (
  checks: Pick<HealthCheck, "area" | "enabled" | "results" | "last_status">[],
  alerts: Pick<AdminAlert, "area" | "severity">[] = [],
): { key: string; label: string; status: HealthStatus }[] =>
  HEALTH_AREAS.flatMap((area) => {
    const inArea = checks.filter((c) => c.enabled && c.area === area.key);
    if (!inArea.length) return [];
    const fromChecks = inArea.flatMap((c) => [
      ...c.results.map((r) => r.status),
      c.last_status === "error" ? ("warning" as const) : null,
    ]);
    const fromAlerts = alerts.filter((a) => a.area === area.key).map((a) => a.severity);
    return [{ ...area, status: worstStatus([...fromChecks, ...fromAlerts]) }];
  });

/** Open, unacknowledged alerts: what the header bell counts. */
export const needsAttention = (alerts: Pick<AdminAlert, "acknowledged_at" | "resolved_at" | "severity">[]) =>
  alerts.filter((a) => !a.resolved_at && !a.acknowledged_at && a.severity !== "info");

/** Cron schedules in words, for the patterns this system uses. */
export const scheduleInWords = (schedule: string): string => {
  const f = schedule.trim().split(/\s+/);
  if (f.length !== 5) return schedule;
  const [min, hour, dom, mon, dow] = f;
  const pad = (n: string) => n.padStart(2, "0");
  // Cron runs in UTC; Lagos is UTC+1 all year.
  const lagos = (h: string, m: string) => `${pad(String((Number(h) + 1) % 24))}:${pad(m)}`;
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const everyDay = dom === "*" && mon === "*";

  if (/^\*\/\d+$/.test(min) && hour === "*" && everyDay && dow === "*") {
    const n = Number(min.slice(2));
    return n === 1 ? "Every minute" : `Every ${n} minutes`;
  }
  if (min === "*" && hour === "*" && everyDay && dow === "*") return "Every minute";
  if (/^\d+$/.test(min) && hour === "*" && everyDay && dow === "*") return `Hourly at :${pad(min)}`;
  if (/^\d+$/.test(min) && /^\*\/\d+$/.test(hour) && everyDay && dow === "*") return `Every ${hour.slice(2)} hours`;
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && everyDay && dow === "*") return `Daily at ${lagos(hour, min)}`;
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && everyDay && /^\d$/.test(dow)) {
    // A run late on Saturday UTC can fall on Sunday in Lagos.
    const shift = Number(hour) + 1 >= 24 ? 1 : 0;
    return `${days[(Number(dow) + shift) % 7]}s at ${lagos(hour, min)}`;
  }
  return schedule;
};

const LAGOS: Intl.DateTimeFormatOptions = { timeZone: "Africa/Lagos" };

export const formatWhen = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { ...LAGOS, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "Never";

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
export const timeAgo = (iso: string | null | undefined, now: Date = new Date()): string => {
  if (!iso) return "never";
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
};
