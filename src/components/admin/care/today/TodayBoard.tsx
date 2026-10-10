// One Lagos day for coordinators: emergencies first, then visits that need
// someone to act (not checked out, not started, no one assigned, a location
// flag), then the rest in time order. Refreshes every minute while open.
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Siren } from "lucide-react";
import { toast } from "sonner";
import { Status, type StatusTone } from "@/components/field";
import { MuEmpty } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { CareConfirm, CareSheet, careGhost } from "@/components/admin/care/CareSurface";
import { SelectField } from "@/components/field";
import { Textarea } from "@/components/ui/textarea";
import { careErrorMessage } from "@/lib/care-errors";
import { mapsUrl } from "@/lib/visits";
import {
  ALERT_LABEL, assignVisit, closeVisit, episodeSchedule, lagosToday, shiftDay, sortBoard, updateEmergency,
  visitsBoard, type Board, type BoardVisit, type EpisodeWorker, type WorkerEmergency,
} from "@/lib/care-schedule";

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

const dayTitle = (day: string) => {
  const today = lagosToday();
  if (day === today) return "Today";
  if (day === shiftDay(today, 1)) return "Tomorrow";
  if (day === shiftDay(today, -1)) return "Yesterday";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
};

const STATUS: Record<BoardVisit["status"], { label: string; tone: StatusTone }> = {
  scheduled: { label: "Booked", tone: "neutral" },
  in_progress: { label: "In progress", tone: "progress" },
  completed: { label: "Done", tone: "good" },
  missed: { label: "Missed", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const ALERT_TONE: Record<NonNullable<BoardVisit["alert"]>, StatusTone> = {
  overdue_checkout: "bad",
  not_started: "bad",
  unassigned: "warning",
  location: "warning",
};

const FLAG_LABEL: Record<string, string> = {
  far_at_check_in: "Far from home at check-in",
  far_at_check_out: "Far from home at check-out",
  no_location_at_check_in: "No location at check-in",
  no_location_at_check_out: "No location at check-out",
  no_home_pin: "Home has no map pin",
};

const EmergencyCard = ({ e, onChanged }: { e: WorkerEmergency; onChanged: () => void }) => {
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const map = e.lat != null && e.lng != null ? mapsUrl({ lat: e.lat, lng: e.lng, address: null }) : null;

  const act = async (status: "acknowledged" | "resolved") => {
    setBusy(true);
    try {
      await updateEmergency(e.id, status, status === "resolved" ? note : undefined);
      toast.success(status === "resolved" ? "Emergency resolved" : "Emergency acknowledged");
      setResolving(false);
      onChanged();
    } catch (err) {
      toast.error(careErrorMessage(err, "That did not save. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="border-2 border-destructive bg-destructive/5 p-4" aria-label={`Emergency from ${e.person_name}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Siren aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="text-[15px] font-bold text-ink">
              {e.person_name} pressed the emergency button at {time(e.raised_at)}
            </p>
            <p className="text-[13.5px] text-body">
              {e.client_name ? `During the visit to ${e.client_name}${e.address ? `, ${e.address}` : ""}.` : "Not on a visit."}{" "}
              {map ? <a className="font-bold text-brand underline" href={map} target="_blank" rel="noreferrer">Where they were</a>
                : "The phone gave no location."}
            </p>
            {e.note && <p className="mt-1 text-[13.5px] text-body">“{e.note}”</p>}
          </div>
        </div>
        <Status label={e.status === "open" ? "Not yet acknowledged" : "Acknowledged"} tone={e.status === "open" ? "bad" : "progress"} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {e.status === "open" && (
          <button type="button" className={careGhost} disabled={busy} onClick={() => act("acknowledged")}>
            Acknowledge
          </button>
        )}
        <button type="button" className={careGhost} disabled={busy} onClick={() => setResolving(true)}>
          Resolve
        </button>
      </div>
      <CareConfirm
        open={resolving}
        onOpenChange={setResolving}
        title="Resolve this emergency"
        description="Say what happened and what was done. This stays on the record."
        confirmLabel={busy ? "Saving" : "Resolve"}
        confirmDisabled={busy || !note.trim()}
        onConfirm={() => act("resolved")}
        keepLabel="Not yet"
      >
        <Textarea value={note} onChange={(ev) => setNote(ev.target.value)} rows={3} aria-label="What happened" />
      </CareConfirm>
    </article>
  );
};

const AssignSheet = ({ visit, onClose, onDone }: { visit: BoardVisit | null; onClose: () => void; onDone: () => void }) => {
  const [workers, setWorkers] = useState<EpisodeWorker[] | null>(null);
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visit) return;
    setWorkers(null);
    setPick(visit.person_id ?? "");
    episodeSchedule(visit.episode_id)
      .then((s) => setWorkers(s?.workers ?? []))
      .catch(() => setWorkers([]));
  }, [visit]);

  const save = async () => {
    if (!visit) return;
    setSaving(true);
    try {
      await assignVisit(visit.id, pick || null);
      toast.success(pick ? "Worker assigned" : "Visit left open");
      onDone();
    } catch (err) {
      toast.error(careErrorMessage(err, "That worker could not be assigned."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CareSheet
      open={visit !== null}
      onOpenChange={(o) => { if (!o) onClose(); }}
      title="Assign a worker"
      description={visit ? `${visit.client_name}, ${time(visit.scheduled_start)} to ${time(visit.scheduled_end)}` : undefined}
      onSave={save}
      saveLabel="Assign"
      saving={saving}
      saveDisabled={workers === null}
    >
      {workers === null ? <Loader2 className="h-5 w-5 animate-spin text-muted-copy" /> : workers.length === 0 ? (
        <p className="text-[14px] text-body">
          No one is assigned to this care yet. Add a worker to the care first, from the client record.
        </p>
      ) : (
        <SelectField
          label="Worker"
          value={pick}
          onChange={setPick}
          placeholder="No one (leave open)"
          options={workers.map((w) => ({
            value: w.person_id,
            label: w.app_access ? w.name : `${w.name} (no app access)`,
            disabled: !w.app_access,
          }))}
          help="Only workers assigned to this care, with app access, on that date and not already booked."
        />
      )}
    </CareSheet>
  );
};

const CloseVisitDialog = ({ visit, onClose, onDone }: { visit: BoardVisit | null; onClose: () => void; onDone: () => void }) => {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const missed = visit ? Date.parse(visit.scheduled_start) <= Date.now() : false;

  useEffect(() => { setReason(""); }, [visit]);

  const confirm = async () => {
    if (!visit) return;
    setBusy(true);
    try {
      await closeVisit(visit.id, missed ? "missed" : "cancelled", reason);
      toast.success(missed ? "Marked as missed" : "Visit cancelled");
      onDone();
    } catch (err) {
      toast.error(careErrorMessage(err, "That did not save. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CareConfirm
      open={visit !== null}
      onOpenChange={(o) => { if (!o) onClose(); }}
      title={missed ? "Mark this visit as missed" : "Cancel this visit"}
      description={missed
        ? "The visit time has passed and no one checked in. Say why, so the family and pay are right."
        : "The worker will no longer see it. Say why."}
      confirmLabel={busy ? "Saving" : missed ? "Mark missed" : "Cancel visit"}
      confirmDisabled={busy || !reason.trim()}
      onConfirm={confirm}
    >
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} aria-label="Reason" />
    </CareConfirm>
  );
};

const VisitRow = ({ v, onAssign, onClose }: { v: BoardVisit; onAssign: () => void; onClose: () => void }) => {
  const s = STATUS[v.status];
  const flags = v.location_flags.filter((f) => FLAG_LABEL[f]);
  return (
    <article className={`border bg-card p-4 ${v.alert && v.alert !== "location" ? "border-destructive/60" : "border-line-soft"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-bold tabular-nums text-ink">
            {time(v.scheduled_start)} to {time(v.scheduled_end)}
          </p>
          <p className="text-[14px] text-body">
            <span className="font-bold">{v.client_name}</span>
            {v.landmark ? `, ${v.landmark}` : v.address ? `, ${v.address}` : ""}
          </p>
          <p className="text-[13.5px] text-muted-copy">{v.person_name ?? "No one assigned"}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {v.alert && <Status label={ALERT_LABEL[v.alert]} tone={ALERT_TONE[v.alert]} />}
          <Status label={s.label} tone={s.tone} />
        </div>
      </div>
      {(v.check_in_at || flags.length > 0 || v.check_out_note || v.close_reason) && (
        <ul className="mt-2 flex flex-col gap-0.5 text-[13px] text-body">
          {v.check_in_at && (
            <li>
              Checked in {time(v.check_in_at)}
              {v.check_in_distance_m != null ? `, ${v.check_in_distance_m} m from home` : ""}
              {v.check_out_at ? `; out ${time(v.check_out_at)}${v.check_out_distance_m != null ? `, ${v.check_out_distance_m} m` : ""}` : ""}
            </li>
          )}
          {flags.map((f) => <li key={f}>{FLAG_LABEL[f]}</li>)}
          {v.check_out_note && <li>Note: {v.check_out_note}</li>}
          {v.close_reason && <li>Reason: {v.close_reason}</li>}
        </ul>
      )}
      {v.status === "scheduled" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={careGhost} onClick={onAssign}>
            {v.person_id ? "Change worker" : "Assign a worker"}
          </button>
          <button type="button" className={careGhost} onClick={onClose}>
            {Date.parse(v.scheduled_start) <= Date.now() ? "Mark missed" : "Cancel"}
          </button>
        </div>
      )}
    </article>
  );
};

export const TodayBoard = ({ onOpenSchedule }: { onOpenSchedule?: () => void }) => {
  const [day, setDay] = useState(lagosToday());
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);
  const [assigning, setAssigning] = useState<BoardVisit | null>(null);
  const [closing, setClosing] = useState<BoardVisit | null>(null);

  const load = useCallback(async () => {
    try {
      const b = await visitsBoard(day);
      setBoard(b);
      setFailed(b === null);
    } catch {
      setFailed(true);
    }
  }, [day]);

  useEffect(() => {
    setBoard(null);
    void load();
    const t = window.setInterval(() => { void load(); }, 60000);
    return () => window.clearInterval(t);
  }, [load]);

  const visits = board ? sortBoard(board.visits) : [];
  const needs = visits.filter((v) => v.alert);
  const rest = visits.filter((v) => !v.alert);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={careGhost} aria-label="Previous day" onClick={() => setDay((d) => shiftDay(d, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="min-w-[10rem] text-center text-lg font-bold text-ink">{dayTitle(day)}</h2>
        <button type="button" className={careGhost} aria-label="Next day" onClick={() => setDay((d) => shiftDay(d, 1))}>
          <ChevronRight className="h-4 w-4" />
        </button>
        {day !== lagosToday() && (
          <button type="button" className={careGhost} onClick={() => setDay(lagosToday())}>Back to today</button>
        )}
      </div>

      {failed && (
        <p className="border border-line-soft p-4 text-[14px] text-body">
          The board could not be loaded. You need the care coordinator or clinical area to see it.
        </p>
      )}
      {!board && !failed && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-copy" />}

      {board && (
        <>
          {board.emergencies.length > 0 && (
            <section aria-label="Emergencies" className="flex flex-col gap-3">
              {board.emergencies.map((e) => <EmergencyCard key={e.id} e={e} onChanged={load} />)}
            </section>
          )}

          {needs.length > 0 && (
            <section aria-labelledby="needs" className="flex flex-col gap-3">
              <h3 id="needs" className="text-[13px] font-bold uppercase tracking-wide text-muted-copy">
                Needs attention ({needs.length})
              </h3>
              {needs.map((v) => (
                <VisitRow key={v.id} v={v} onAssign={() => setAssigning(v)} onClose={() => setClosing(v)} />
              ))}
            </section>
          )}

          <section aria-labelledby="all" className="flex flex-col gap-3">
            <h3 id="all" className="text-[13px] font-bold uppercase tracking-wide text-muted-copy">
              {needs.length > 0 ? "Everything else" : "Visits"}
            </h3>
            {visits.length === 0 ? (
              <MuEmpty
                art={art.objMagnifier}
                title="No visits on this day"
                description="Visits come from each client's schedule."
                action={onOpenSchedule && (
                  <button type="button" className={careGhost} onClick={onOpenSchedule}>Open the schedule</button>
                )}
              />
            ) : rest.length === 0 ? (
              <p className="text-[14px] text-body">Nothing else on this day.</p>
            ) : rest.map((v) => (
              <VisitRow key={v.id} v={v} onAssign={() => setAssigning(v)} onClose={() => setClosing(v)} />
            ))}
          </section>
        </>
      )}

      <AssignSheet visit={assigning} onClose={() => setAssigning(null)} onDone={() => { setAssigning(null); void load(); }} />
      <CloseVisitDialog visit={closing} onClose={() => setClosing(null)} onDone={() => { setClosing(null); void load(); }} />
    </div>
  );
};

export default TodayBoard;
