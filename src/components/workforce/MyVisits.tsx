// "My visits" for a field carer: the next visit as a ticket with "I'm on my
// way", check-in and check-out, the emergency button, then the rest of the
// week by day. Location is read at check-in and check-out, on the emergency
// button, and during a journey the worker started; the screen says so.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  canCheckIn, checkIn, checkOut, lagosDayKey, mapsUrl, myVisits, newEventId, nextVisit,
  readDeviceLocation, type CareVisit,
} from "@/lib/visits";
import { EmergencyButton } from "./EmergencyButton";
import { JourneyControl } from "./JourneyControl";

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

const dayLabel = (key: string) => {
  const today = lagosDayKey(new Date().toISOString());
  const tomorrow = lagosDayKey(new Date(Date.now() + 86400000).toISOString());
  if (key === today) return "Today";
  if (key === tomorrow) return "Tomorrow";
  return new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
};

const statusLabel: Record<CareVisit["status"], string> = {
  scheduled: "Booked",
  in_progress: "In progress",
  completed: "Done",
  missed: "Missed",
  cancelled: "Cancelled",
};

const errorText = (e: unknown) =>
  (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string")
    ? (e as { message: string }).message
    : "That did not go through. Check your connection and try again.";

const VisitTicket = ({ visit, onChanged }: { visit: CareVisit; onChanged: (v: CareVisit) => void }) => {
  const [busy, setBusy] = useState<"in" | "out" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  // One event id per action, kept across retries of that action.
  const eventIds = useRef<{ in?: string; out?: string }>({});
  const map = mapsUrl(visit);

  const act = async (which: "in" | "out") => {
    setBusy(which);
    setError(null);
    eventIds.current[which] ??= newEventId();
    try {
      const loc = await readDeviceLocation();
      const next = which === "in"
        ? await checkIn(visit.id, eventIds.current.in!, loc)
        : await checkOut(visit.id, eventIds.current.out!, loc, note);
      onChanged({ ...visit, ...next });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="Next visit" className="border-2 border-white/80 px-4 py-4 text-white">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[22px] font-bold tabular-nums">{time(visit.scheduled_start)} to {time(visit.scheduled_end)}</p>
        <span className="shrink-0 bg-white px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-navy">
          {statusLabel[visit.status]}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-white/75">{dayLabel(lagosDayKey(visit.scheduled_start))}</p>
      <p className="mt-3 text-[18px] font-bold">{visit.client_name}</p>
      {visit.address && <p className="text-[15px]">{visit.address}</p>}
      {visit.landmark && <p className="text-[14px] text-white/80">{visit.landmark}</p>}
      {visit.access_notes && <p className="mt-1 text-[14px] text-white/80">Access: {visit.access_notes}</p>}
      {visit.notes && <p className="mt-2 text-[14px]">{visit.notes}</p>}
      {map && (
        <a className="mt-2 inline-block text-[14px] font-bold underline" href={map} target="_blank" rel="noreferrer">
          Open in Maps
        </a>
      )}

      <div className="mt-4 border-t border-dashed border-white/50 pt-4">
        {visit.status === "scheduled" && <JourneyControl visit={visit} />}
        {visit.status === "scheduled" && (canCheckIn(visit) ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => act("in")}
            className="w-full bg-white py-3 text-[16px] font-bold text-navy disabled:opacity-60"
          >
            {busy === "in" ? "Checking in" : "Check in"}
          </button>
        ) : (
          <p className="text-[14px] text-white/80">Check-in opens an hour before the visit.</p>
        ))}
        {visit.status === "in_progress" && (
          <div className="space-y-3">
            <p className="text-[14px]">Checked in at {time(visit.check_in_at!)}.</p>
            <label className="block text-[14px]">
              <span className="font-bold">Note for the coordinator (optional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                rows={3}
                className="mt-1 w-full bg-white/10 px-3 py-2 text-[15px] text-white placeholder:text-white/50"
                placeholder="How the visit went, anything to follow up"
              />
            </label>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => act("out")}
              className="w-full bg-white py-3 text-[16px] font-bold text-navy disabled:opacity-60"
            >
              {busy === "out" ? "Checking out" : "Check out"}
            </button>
          </div>
        )}
        {visit.status === "completed" && (
          <p className="text-[14px]">Done. Checked out at {time(visit.check_out_at!)}.</p>
        )}
        {error && <p role="alert" className="mt-3 text-[14px] font-bold text-[#FFD7D7]">{error}</p>}
        <p className="mt-3 text-[12px] text-white/70">
          Your location is taken when you check in and out, and on the way if you tap I'm on my way.
        </p>
      </div>
    </section>
  );
};

export const MyVisits = () => {
  const [visits, setVisits] = useState<CareVisit[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    myVisits(undefined, 7)
      .then(setVisits)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (failed) {
    return (
      <p className="text-[15px] text-white/90">
        Your visits could not be loaded.{" "}
        <button type="button" className="font-bold underline" onClick={load}>Try again</button>
      </p>
    );
  }
  if (!visits) return <p className="text-[15px] text-white/80">Loading your visits</p>;

  const next = nextVisit(visits);
  const rest = visits.filter((v) => v.id !== next?.id && v.status !== "completed" && v.status !== "missed"
    && Date.parse(v.scheduled_end) >= Date.now());
  const byDay = rest.reduce<Record<string, CareVisit[]>>((acc, v) => {
    (acc[lagosDayKey(v.scheduled_start)] ??= []).push(v);
    return acc;
  }, {});

  const replace = (v: CareVisit) => setVisits((list) => (list ?? []).map((x) => (x.id === v.id ? v : x)));

  return (
    <div className="space-y-5">
      <p className="text-[15px] font-bold text-white">My visits</p>
      {next ? <VisitTicket key={next.id} visit={next} onChanged={replace} /> : (
        <p className="text-[15px] text-white/90">No visits booked in the next seven days.</p>
      )}
      <EmergencyButton visitId={visits.find((v) => v.status === "in_progress")?.id ?? null} />
      {Object.entries(byDay).map(([day, list]) => (
        <div key={day} className="space-y-2">
          <p className="text-[13px] font-bold uppercase tracking-wide text-white/75">{dayLabel(day)}</p>
          <ul className="space-y-2">
            {list.map((v) => (
              <li key={v.id} className="flex items-baseline justify-between gap-3 bg-white/10 px-4 py-3 text-[15px] text-white">
                <span>
                  <span className="font-bold tabular-nums">{time(v.scheduled_start)}</span>{" "}
                  {v.client_name}
                  {v.landmark ? <span className="text-white/75">, {v.landmark}</span> : null}
                </span>
                <span className="shrink-0 text-[13px] text-white/75">{statusLabel[v.status]}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};
