// A care worker's own visits, and checking in and out of them.
//
// Location is read from the device only at check-in and check-out, never in
// between. When the device gives none (refused, no signal, timed out) the visit
// still checks in; the server flags it for the coordinator instead of blocking.
// Each tap gets one event id, reused if the same tap is retried, so a retry
// after a dropped connection is recorded once.
import { supabase } from "@/integrations/supabase/client";

export type VisitStatus = "scheduled" | "in_progress" | "completed" | "missed" | "cancelled";

export interface CareVisit {
  id: string;
  episode_id: string;
  kind: "visit" | "shift" | "day_24h";
  scheduled_start: string;
  scheduled_end: string;
  status: VisitStatus;
  notes: string | null;
  client_name: string;
  service_code: string | null;
  address: string | null;
  landmark: string | null;
  lat: number | null;
  lng: number | null;
  access_notes: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  location_flags: string[];
}

export interface DeviceLocation {
  lat: number;
  lng: number;
  accuracy_m: number;
}

/** Check-in opens this long before the visit starts (matches the server). */
export const CHECK_IN_OPENS_MS = 60 * 60 * 1000;

export async function myVisits(fromDate?: string, days = 7): Promise<CareVisit[]> {
  const { data, error } = await supabase.rpc("care_my_visits", { _from: fromDate, _days: days });
  if (error) throw error;
  return (data ?? []) as unknown as CareVisit[];
}

/** The device's position, or null when it cannot be had within the timeout. */
export function readDeviceLocation(timeoutMs = 10000): Promise<DeviceLocation | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({
        lat: Number(p.coords.latitude.toFixed(6)),
        lng: Number(p.coords.longitude.toFixed(6)),
        accuracy_m: Math.round(p.coords.accuracy),
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}

export function newEventId(): string {
  return crypto.randomUUID();
}

export async function checkIn(visitId: string, eventId: string, loc: DeviceLocation | null): Promise<CareVisit> {
  const { data, error } = await supabase.rpc("care_visit_check_in", {
    _visit_id: visitId,
    _client_event_id: eventId,
    _lat: loc?.lat,
    _lng: loc?.lng,
    _accuracy_m: loc?.accuracy_m,
  });
  if (error) throw error;
  return data as unknown as CareVisit;
}

export async function checkOut(
  visitId: string, eventId: string, loc: DeviceLocation | null, note: string,
): Promise<CareVisit> {
  const { data, error } = await supabase.rpc("care_visit_check_out", {
    _visit_id: visitId,
    _client_event_id: eventId,
    _lat: loc?.lat,
    _lng: loc?.lng,
    _accuracy_m: loc?.accuracy_m,
    _note: note.trim() || undefined,
  });
  if (error) throw error;
  return data as unknown as CareVisit;
}

/** Whether the check-in button should be offered at this moment. */
export function canCheckIn(v: CareVisit, now = Date.now()): boolean {
  return v.status === "scheduled"
    && now >= Date.parse(v.scheduled_start) - CHECK_IN_OPENS_MS
    && now <= Date.parse(v.scheduled_end);
}

/** The visit to show first: one in progress, else the next one not yet over. */
export function nextVisit(visits: CareVisit[], now = Date.now()): CareVisit | null {
  return visits.find((v) => v.status === "in_progress")
    ?? visits.find((v) => v.status === "scheduled" && Date.parse(v.scheduled_end) >= now)
    ?? null;
}

/** Days as Lagos sees them, so a list groups the same way the roster was made. */
export function lagosDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}

export function mapsUrl(v: Pick<CareVisit, "lat" | "lng" | "address">): string | null {
  if (v.lat != null && v.lng != null) return `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`;
  if (v.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.address)}`;
  return null;
}

export interface OpenAlert {
  id: string;
  status: "open" | "acknowledged";
  raised_at: string;
  acknowledged_at: string | null;
}

/**
 * The emergency button. Sends whatever the phone can give within a few
 * seconds; with no location it still goes. Reuse the same event id when
 * retrying one press, so the office is told once.
 */
export async function raiseEmergency(
  eventId: string, visitId: string | null, loc: DeviceLocation | null, note: string,
): Promise<OpenAlert> {
  const { data, error } = await supabase.rpc("care_worker_alert_raise", {
    _client_event_id: eventId,
    _visit_id: visitId ?? undefined,
    _lat: loc?.lat,
    _lng: loc?.lng,
    _accuracy_m: loc?.accuracy_m,
    _note: note.trim() || undefined,
  });
  if (error) throw error;
  return data as unknown as OpenAlert;
}

export async function myOpenAlert(): Promise<OpenAlert | null> {
  const { data, error } = await supabase.rpc("care_my_open_alert");
  if (error) throw error;
  return (data ?? null) as unknown as OpenAlert | null;
}
