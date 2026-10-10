// The coordinator's side of visits: the Today board, the schedule for each
// piece of running care, and the emergency button's alerts.
//
// Every write goes through a database function that checks the coordinator or
// clinical area and the worker rules (app access, assignment on the date, no
// clash), so the screens only offer and the server decides.
import { adminDb } from "@/lib/admin-utils";
import type { CareVisit } from "@/lib/visits";

export type VisitAlert = "overdue_checkout" | "not_started" | "unassigned" | "location";

export interface BoardVisit extends CareVisit {
  person_id: string | null;
  person_name: string | null;
  check_in_distance_m: number | null;
  check_out_distance_m: number | null;
  check_out_note: string | null;
  close_reason: string | null;
  alert: VisitAlert | null;
}

export interface WorkerEmergency {
  id: string;
  status: "open" | "acknowledged";
  raised_at: string;
  person_id: string;
  person_name: string;
  visit_id: string | null;
  client_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  note: string | null;
  acknowledged_at: string | null;
}

export interface Board {
  day: string;
  visits: BoardVisit[];
  emergencies: WorkerEmergency[];
}

export interface ScheduleEpisode {
  episode_id: string;
  status: string;
  service_code: string | null;
  client_id: string;
  client_name: string;
  primary_carer: string | null;
  patterns: number;
  workers: number;
  next_visit: string | null;
  open_visits: number;
  has_pin: boolean;
}

export interface EpisodeWorker {
  person_id: string;
  name: string;
  assignment_status: "planned" | "active";
  effective_from: string;
  effective_to: string | null;
  app_access: boolean;
}

export interface RosterPattern {
  id: string;
  person_id: string | null;
  person_name: string | null;
  is_primary: boolean;
  kind: "visit" | "shift" | "day_24h";
  weekdays: number[];
  start_time: string;
  duration_minutes: number;
  valid_from: string;
  valid_until: string | null;
  notes: string | null;
}

export interface EpisodeSchedule {
  episode_id: string;
  status: string;
  service_code: string | null;
  client_id: string;
  client_name: string;
  home_id: string | null;
  place: { address: string | null; landmark: string | null; lat: number | null; lng: number | null; access_notes: string | null } | null;
  workers: EpisodeWorker[];
  patterns: RosterPattern[];
  visits: (CareVisit & { person_id: string | null; person_name: string | null; pattern_id: string | null })[];
}

export interface PatternInput {
  person_id?: string | null;
  is_primary?: boolean;
  weekdays: number[];
  start_time: string;
  duration_minutes: number;
  valid_from?: string;
  valid_until?: string | null;
  notes?: string;
}

const call = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await adminDb().rpc(fn, args ?? {});
  if (error) throw error;
  return data as T;
};

export const visitsBoard = (day?: string) => call<Board | null>("care_visits_board", { _day: day ?? null });
export const scheduleEpisodes = async () => (await call<ScheduleEpisode[] | null>("care_schedule_episodes")) ?? [];
export const episodeSchedule = (episodeId: string) =>
  call<EpisodeSchedule | null>("care_episode_schedule", { _episode_id: episodeId });

export const assignVisit = (visitId: string, personId: string | null) =>
  call<void>("care_visit_assign", { _visit_id: visitId, _person_id: personId });
export const closeVisit = (visitId: string, outcome: "cancelled" | "missed", reason: string) =>
  call<void>("care_visit_close", { _visit_id: visitId, _outcome: outcome, _reason: reason });
export const createVisit = (episodeId: string, v: { scheduled_start: string; duration_minutes: number; person_id?: string | null; notes?: string }) =>
  call<string>("care_visit_create", {
    _episode_id: episodeId,
    _visit: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== null && x !== "")),
  });
export const createPattern = (episodeId: string, p: PatternInput) =>
  call<string>("care_roster_pattern_create", {
    _episode_id: episodeId,
    _pattern: Object.fromEntries(Object.entries(p).filter(([, x]) => x !== undefined && x !== null && x !== "")),
  });
export const endPattern = (patternId: string, reason: string) =>
  call<number>("care_roster_pattern_end", { _pattern_id: patternId, _reason: reason });
export const generateVisits = (episodeId: string, until: string) =>
  call<{ created: number; open: number }>("care_visits_generate", { _episode_id: episodeId, _until: until });
export const setHomePin = (homeId: string, lat: number, lng: number, accessNotes: string) =>
  call<void>("care_home_pin_set", { _home_id: homeId, _lat: lat, _lng: lng, _access_notes: accessNotes || null });
export const updateEmergency = (alertId: string, status: "acknowledged" | "resolved", note?: string) =>
  call<void>("care_worker_alert_update", { _alert_id: alertId, _status: status, _note: note ?? null });

export const ALERT_LABEL: Record<VisitAlert, string> = {
  overdue_checkout: "Not checked out",
  not_started: "Not started",
  unassigned: "No one assigned",
  location: "Location flag",
};

export const WEEKDAYS: { value: number; short: string }[] = [
  { value: 1, short: "Mon" }, { value: 2, short: "Tue" }, { value: 3, short: "Wed" },
  { value: 4, short: "Thu" }, { value: 5, short: "Fri" }, { value: 6, short: "Sat" }, { value: 7, short: "Sun" },
];

/** "Mon, Wed, Fri" or "Every day" or "Weekdays". */
export const weekdaysLabel = (days: number[]): string => {
  const set = [...new Set(days)].sort();
  if (set.length === 7) return "Every day";
  if (set.join() === "1,2,3,4,5") return "Weekdays";
  if (set.join() === "6,7") return "Weekends";
  return set.map((d) => WEEKDAYS.find((w) => w.value === d)?.short ?? String(d)).join(", ");
};

/** A Lagos calendar date (YYYY-MM-DD) shifted by whole days. */
export const shiftDay = (day: string, by: number): string => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
};

/** Today's date in Lagos. */
export const lagosToday = (now = new Date()): string => now.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

/** Board order: emergencies are separate; visits needing action first, then by time. */
export const sortBoard = (visits: BoardVisit[]): BoardVisit[] => {
  const rank: Record<VisitAlert, number> = { overdue_checkout: 0, not_started: 1, unassigned: 2, location: 3 };
  return [...visits].sort((a, b) => {
    const ra = a.alert ? rank[a.alert] : 9;
    const rb = b.alert ? rank[b.alert] : 9;
    return ra - rb || Date.parse(a.scheduled_start) - Date.parse(b.scheduled_start);
  });
};

export interface WorkerOption { person_id: string; full_name: string; app_access: boolean }
export interface StartOptions {
  clients: { client_id: string; name: string; reference: string | null; stage: string | null }[];
  services: { code: string; name: string | null; configured: boolean }[];
}

export const workerOptions = async () => (await call<WorkerOption[] | null>("care_worker_options")) ?? [];
export const startOptions = async () =>
  (await call<StartOptions | null>("care_schedule_start_options")) ?? { clients: [], services: [] };

/** Opens planned care for a client. It runs once started (needs the service set up). */
export const startCareEpisode = (clientId: string, serviceCode: string) =>
  call<string>("care_episode_create", { _client_id: clientId, _service_code: serviceCode });
export const activateEpisode = (episodeId: string) => call<void>("care_episode_activate", { _episode_id: episodeId });

/** Puts a care worker on this care from a date; active straight away when the date has come. */
export const addWorkerToCare = async (episodeId: string, personId: string, from: string) => {
  const id = await call<string>("care_assignment_plan", {
    _episode_id: episodeId, _person_id: personId, _capability_code: "care_worker", _effective_from: from,
  });
  if (from <= lagosToday()) await call<void>("care_assignment_activate", { _assignment_id: id });
  return id;
};

export interface LiveMapData {
  at: string;
  travelling: {
    journey_id: string; person_id: string; person_name: string; started_at: string;
    lat: number | null; lng: number | null; accuracy_m: number | null; last_at: string | null;
    visit_id: string; scheduled_start: string; client_name: string; address: string | null;
    dest_lat: number | null; dest_lng: number | null;
  }[];
  on_visit: {
    visit_id: string; person_id: string; person_name: string; client_name: string; address: string | null;
    check_in_at: string | null; scheduled_end: string; lat: number | null; lng: number | null; overdue: boolean;
  }[];
  emergencies: {
    id: string; person_name: string; raised_at: string; status: string; lat: number | null; lng: number | null; note: string | null;
  }[];
}

export const liveMap = () => call<LiveMapData | null>("care_live_map");

/** "3 minutes ago" for a worker's last position. */
export const minutesAgo = (iso: string | null, now = Date.now()): string => {
  if (!iso) return "no position yet";
  const m = Math.round((now - Date.parse(iso)) / 60000);
  if (m <= 0) return "just now";
  return m === 1 ? "1 minute ago" : `${m} minutes ago`;
};
