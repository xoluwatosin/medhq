// "I'm on my way": the phone shares its position with the office during the
// trip to a visit, and at no other time. Positions are read with high accuracy,
// held on the phone and sent in small batches every 30 seconds (and straight
// away when the app goes to the background). Sharing stops when the worker
// checks in, taps Stop, or the server says the journey has ended.
//
// The web app can only read the position while it is open; with the screen
// locked the phone stops reporting until the app is opened again.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { newEventId, readDeviceLocation } from "@/lib/visits";

export interface Journey {
  id: string;
  visit_id: string;
  started_at: string;
  ended_at: string | null;
}

export interface JourneyPoint {
  at: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  speed_mps?: number | null;
  heading?: number | null;
}

/** The trip can be shared from this long before the visit (matches the server). */
export const JOURNEY_OPENS_MS = 3 * 60 * 60 * 1000;
const FLUSH_EVERY_MS = 30000;

export async function startJourney(visitId: string, eventId: string): Promise<Journey> {
  const loc = await readDeviceLocation(5000);
  const { data, error } = await supabase.rpc("care_journey_start", {
    _visit_id: visitId, _client_event_id: eventId,
    _lat: loc?.lat, _lng: loc?.lng, _accuracy_m: loc?.accuracy_m,
  });
  if (error) throw error;
  return data as unknown as Journey;
}

export async function sendPoints(journeyId: string, points: JourneyPoint[]): Promise<{ open: boolean; added: number }> {
  const { data, error } = await supabase.rpc("care_journey_points_add", {
    _journey_id: journeyId, _points: points as unknown as Json,
  });
  if (error) throw error;
  return data as unknown as { open: boolean; added: number };
}

export async function stopJourney(journeyId: string): Promise<void> {
  const { error } = await supabase.rpc("care_journey_stop", { _journey_id: journeyId });
  if (error) throw error;
}

export async function myJourney(): Promise<Journey | null> {
  const { data, error } = await supabase.rpc("care_my_journey");
  if (error) throw error;
  return (data ?? null) as unknown as Journey | null;
}

export const newJourneyEventId = newEventId;

/**
 * Watches the position and sends it for one journey. Returns a stop function.
 * `onEnded` is called once when the server says the journey is over, so the
 * screen can drop its "sharing" banner.
 */
export function trackJourney(journeyId: string, onEnded: () => void): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) return () => {};
  let buffer: JourneyPoint[] = [];
  let stopped = false;
  let sending = false;

  const flush = async () => {
    if (sending || buffer.length === 0 || stopped) return;
    sending = true;
    const batch = buffer;
    buffer = [];
    try {
      const r = await sendPoints(journeyId, batch);
      if (!r.open) { stop(); onEnded(); }
    } catch {
      buffer = [...batch, ...buffer].slice(-500); // keep for the next try
    } finally {
      sending = false;
    }
  };

  const watchId = navigator.geolocation.watchPosition(
    (p) => {
      buffer.push({
        at: new Date(p.timestamp).toISOString(),
        lat: Number(p.coords.latitude.toFixed(6)),
        lng: Number(p.coords.longitude.toFixed(6)),
        accuracy_m: Math.round(p.coords.accuracy),
        speed_mps: p.coords.speed,
        heading: p.coords.heading == null || Number.isNaN(p.coords.heading) ? null : Math.round(p.coords.heading),
      });
      if (buffer.length > 500) buffer = buffer.slice(-500);
    },
    () => { /* no fix this time; keep watching */ },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 },
  );
  const timer = window.setInterval(() => { void flush(); }, FLUSH_EVERY_MS);
  const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
  document.addEventListener("visibilitychange", onHide);

  function stop() {
    if (stopped) return;
    void flush();
    stopped = true;
    navigator.geolocation.clearWatch(watchId);
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onHide);
  }
  return stop;
}

/** Whether "I'm on my way" should be offered for a visit at this moment. */
export function canStartJourney(v: { status: string; scheduled_start: string; scheduled_end: string }, now = Date.now()) {
  return v.status === "scheduled"
    && now >= Date.parse(v.scheduled_start) - JOURNEY_OPENS_MS
    && now <= Date.parse(v.scheduled_end);
}
