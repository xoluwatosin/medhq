// "I'm on my way" on the next-visit ticket. While on, a banner says the office
// can see where the worker is, and stays until check-in or Stop sharing.
// Reopening the app resumes an open journey for this visit.
import { useEffect, useRef, useState } from "react";
import {
  canStartJourney, myJourney, newJourneyEventId, startJourney, stopJourney, trackJourney, type Journey,
} from "@/lib/journey";
import type { CareVisit } from "@/lib/visits";
import { AppIcon } from "@/components/mc/AppIcon";

export const JourneyControl = ({ visit }: { visit: CareVisit }) => {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventId = useRef<string | null>(null);
  const stopWatch = useRef<(() => void) | null>(null);

  // Resume a journey already open for this visit.
  useEffect(() => {
    let live = true;
    myJourney()
      .then((j) => { if (live && j && j.visit_id === visit.id && !j.ended_at) setJourney(j); })
      .catch(() => {});
    return () => { live = false; };
  }, [visit.id]);

  // Watch the position only while a journey is open; stop when this unmounts
  // (check-in replaces the ticket's scheduled state).
  useEffect(() => {
    if (!journey) return;
    stopWatch.current = trackJourney(journey.id, () => setJourney(null));
    return () => { stopWatch.current?.(); stopWatch.current = null; };
  }, [journey]);

  const start = async () => {
    setBusy(true);
    setError(null);
    eventId.current ??= newJourneyEventId();
    try {
      setJourney(await startJourney(visit.id, eventId.current));
      eventId.current = null;
    } catch {
      setError("Could not start sharing. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (!journey) return;
    setBusy(true);
    try {
      stopWatch.current?.();
      await stopJourney(journey.id);
    } catch {
      // The server also ends it at check-in; the phone has already stopped.
    } finally {
      setJourney(null);
      setBusy(false);
    }
  };

  if (journey) {
    return (
      <div role="status" className="mb-3 flex items-center justify-between gap-3 bg-white/15 px-3 py-2 text-[14px]">
        <span>
          <span aria-hidden className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[#7CE3A1]" />
          Sharing your location with the office until you check in.
        </span>
        <button type="button" disabled={busy} onClick={stop} className="shrink-0 font-bold underline">
          Stop sharing
        </button>
      </div>
    );
  }

  if (!canStartJourney(visit)) return null;

  return (
    <div className="mb-3 space-y-1">
      <button
        type="button"
        disabled={busy}
        onClick={start}
        className="flex w-full items-center justify-center gap-2 border-2 border-white py-3 text-[16px] font-bold text-white disabled:opacity-60"
      >
        <AppIcon name="route" />{busy ? "Starting" : "I'm on my way"}
      </button>
      <p className="text-[12px] text-white/70">
        The office will see where you are until you check in. Keep the app open on the way.
      </p>
      {error && <p role="alert" className="text-[14px] font-bold text-[#FFD7D7]">{error}</p>}
    </div>
  );
};

export default JourneyControl;
