// The schedule for each piece of running care: weekly patterns (with one
// primary carer), visits made from them up to 62 days ahead, one-off visits,
// and the home's map pin that check-in distances are measured from.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MapPin, Star } from "lucide-react";
import { toast } from "sonner";
import { CareConfirm, CareField, CareSheet, careGhost, carePrimary } from "@/components/admin/care/CareSurface";
import { DateField, DateTimeField, SelectField, Status, TimeField } from "@/components/field";
import { MuEmpty } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { careErrorMessage } from "@/lib/care-errors";
import {
  WEEKDAYS, activateEpisode, addWorkerToCare, assignVisit, createPattern, createVisit, endPattern, episodeSchedule,
  generateVisits, lagosToday, scheduleEpisodes, setHomePin, shiftDay, startCareEpisode, startOptions, weekdaysLabel,
  workerOptions, type EpisodeSchedule, type ScheduleEpisode, type StartOptions, type WorkerOption,
} from "@/lib/care-schedule";

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos",
  });

const serviceLabel = (code: string | null) =>
  code ? code.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Care";

const PatternSheet = ({ s, open, onOpenChange, onDone }: {
  s: EpisodeSchedule; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void;
}) => {
  const [person, setPerson] = useState("");
  const [primary, setPrimary] = useState(false);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState("08:00");
  const [minutes, setMinutes] = useState("60");
  const [from, setFrom] = useState(shiftDay(lagosToday(), 1));
  const [until, setUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await createPattern(s.episode_id, {
        person_id: person || null, is_primary: primary && !!person, weekdays: days, start_time: start,
        duration_minutes: Number(minutes), valid_from: from, valid_until: until || null, notes,
      });
      toast.success("Pattern added. Make the visits when you are ready.");
      onDone();
    } catch (err) {
      toast.error(careErrorMessage(err, "The pattern could not be added."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CareSheet open={open} onOpenChange={onOpenChange} title="Add a weekly pattern"
      description={`${s.client_name}. Times are Lagos time.`} onSave={save} saveLabel="Add pattern" saving={saving}
      saveDisabled={days.length === 0 || !start || !(Number(minutes) >= 15)}>
      <CareField label="Days">
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((w) => (
            <label key={w.value} className="flex items-center gap-1.5 text-[14px]">
              <Checkbox
                checked={days.includes(w.value)}
                onCheckedChange={(c) => setDays((d) => (c ? [...d, w.value] : d.filter((x) => x !== w.value)))}
              />
              {w.short}
            </label>
          ))}
        </div>
      </CareField>
      <TimeField label="Start" value={start} onChange={setStart} />
      <CareField label="Length in minutes" help="15 minutes to 24 hours (1440).">
        <Input type="number" min={15} max={1440} step={15} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      </CareField>
      <SelectField
        label="Worker"
        value={person}
        onChange={setPerson}
        placeholder="No one yet (visits stay open)"
        options={s.workers.map((w) => ({
          value: w.person_id, label: w.app_access ? w.name : `${w.name} (no app access)`, disabled: !w.app_access,
        }))}
      />
      {person && (
        <label className="flex items-center gap-2 text-[14px]">
          <Checkbox checked={primary} onCheckedChange={(c) => setPrimary(c === true)} />
          This is the client's primary carer
        </label>
      )}
      <DateField label="From" value={from} onChange={setFrom} min={lagosToday()} />
      <DateField label="Until (optional)" value={until} onChange={setUntil} min={from} />
      <CareField label="Notes (optional)">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </CareField>
    </CareSheet>
  );
};

const VisitSheet = ({ s, open, onOpenChange, onDone }: {
  s: EpisodeSchedule; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void;
}) => {
  const [when, setWhen] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [person, setPerson] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await createVisit(s.episode_id, { scheduled_start: when, duration_minutes: Number(minutes), person_id: person || null, notes });
      toast.success("Visit booked");
      onDone();
    } catch (err) {
      toast.error(careErrorMessage(err, "The visit could not be booked."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CareSheet open={open} onOpenChange={onOpenChange} title="Book a one-off visit" description={s.client_name}
      onSave={save} saveLabel="Book visit" saving={saving} saveDisabled={!when || !(Number(minutes) >= 15)}>
      <DateTimeField label="Starts" value={when} onChange={setWhen} min={lagosToday()} />
      <CareField label="Length in minutes">
        <Input type="number" min={15} max={1440} step={15} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      </CareField>
      <SelectField
        label="Worker"
        value={person}
        onChange={setPerson}
        placeholder="No one yet (leave open)"
        options={s.workers.map((w) => ({
          value: w.person_id, label: w.app_access ? w.name : `${w.name} (no app access)`, disabled: !w.app_access,
        }))}
      />
      <CareField label="Notes for the worker (optional)">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </CareField>
    </CareSheet>
  );
};

const PinSheet = ({ s, open, onOpenChange, onDone }: {
  s: EpisodeSchedule; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void;
}) => {
  const [lat, setLat] = useState(s.place?.lat != null ? String(s.place.lat) : "");
  const [lng, setLng] = useState(s.place?.lng != null ? String(s.place.lng) : "");
  const [notes, setNotes] = useState(s.place?.access_notes ?? "");
  const [saving, setSaving] = useState(false);
  const valid = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && lat !== "" && lng !== ""
    && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;

  const save = async () => {
    if (!s.home_id) return;
    setSaving(true);
    try {
      await setHomePin(s.home_id, Number(lat), Number(lng), notes);
      toast.success("Home pin saved. New visits will use it.");
      onDone();
    } catch (err) {
      toast.error(careErrorMessage(err, "The pin could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CareSheet open={open} onOpenChange={onOpenChange} title="Home map pin"
      description="Check-in and check-out distances are measured from here. In Google Maps, long-press the gate and copy the two numbers."
      onSave={save} saveLabel="Save pin" saving={saving} saveDisabled={!valid}>
      {s.place?.address && <p className="text-[14px] text-body">{s.place.address}{s.place.landmark ? `, ${s.place.landmark}` : ""}</p>}
      <CareField label="Latitude" help="For Lagos, about 6.4 to 6.7.">
        <Input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value.trim())} placeholder="6.428055" />
      </CareField>
      <CareField label="Longitude" help="For Lagos, about 3.0 to 3.7.">
        <Input inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value.trim())} placeholder="3.421955" />
      </CareField>
      <CareField label="Access notes (optional)" help="Gate colour, which bell, where to park.">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} />
      </CareField>
    </CareSheet>
  );
};

const AddWorkerSheet = ({ s, open, onOpenChange, onDone }: {
  s: EpisodeSchedule; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void;
}) => {
  const [options, setOptions] = useState<WorkerOption[] | null>(null);
  const [person, setPerson] = useState("");
  const [from, setFrom] = useState(lagosToday());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPerson("");
    workerOptions().then(setOptions).catch(() => setOptions([]));
  }, [open]);

  const already = new Set(s.workers.map((w) => w.person_id));
  const choices = (options ?? []).filter((o) => !already.has(o.person_id));

  const save = async () => {
    setSaving(true);
    try {
      await addWorkerToCare(s.episode_id, person, from);
      toast.success("Worker added to this care");
      onDone();
    } catch (err) {
      toast.error(careErrorMessage(err, "That worker could not be added."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CareSheet open={open} onOpenChange={onOpenChange} title="Add a worker to this care" description={s.client_name}
      onSave={save} saveLabel="Add worker" saving={saving} saveDisabled={!person || !from}>
      {options === null ? <Loader2 className="h-5 w-5 animate-spin text-muted-copy" /> : choices.length === 0 ? (
        <p className="text-[14px] text-body">
          No one else holds the care worker capability. Grant it on the Workforce staff page first.
        </p>
      ) : (
        <SelectField
          label="Worker"
          value={person}
          onChange={setPerson}
          placeholder="Choose a care worker"
          options={choices.map((o) => ({ value: o.person_id, label: o.app_access ? o.full_name : `${o.full_name} (no app access yet)` }))}
          help="Only people holding the care worker capability. Without app access they cannot be booked on visits."
        />
      )}
      <DateField label="From" value={from} onChange={setFrom} min={lagosToday()} />
    </CareSheet>
  );
};

const StartCareSheet = ({ open, onOpenChange, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; onDone: (episodeId: string) => void;
}) => {
  const [options, setOptions] = useState<StartOptions | null>(null);
  const [client, setClient] = useState("");
  const [service, setService] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClient("");
    setService("");
    startOptions().then(setOptions).catch(() => setOptions({ clients: [], services: [] }));
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const id = await startCareEpisode(client, service);
      toast.success("Care opened. Add workers and a schedule.");
      onDone(id);
    } catch (err) {
      toast.error(careErrorMessage(err, "Care could not be opened."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CareSheet open={open} onOpenChange={onOpenChange} title="Open care for a client"
      description="Opens the care as planned. You can add workers and a schedule straight away; visits can be checked into once the care has started."
      onSave={save} saveLabel="Open care" saving={saving} saveDisabled={!client || !service}>
      {options === null ? <Loader2 className="h-5 w-5 animate-spin text-muted-copy" /> : (
        <>
          <SelectField
            label="Client"
            value={client}
            onChange={setClient}
            placeholder="Choose a client"
            options={options.clients.map((c) => ({ value: c.client_id, label: c.reference ? `${c.name} (${c.reference})` : c.name }))}
            help="Clients whose care is already running are not listed."
          />
          <SelectField
            label="Service"
            value={service}
            onChange={setService}
            placeholder="Choose a service"
            options={options.services.map((x) => ({
              value: x.code, label: x.configured ? (x.name ?? x.code) : `${x.name ?? x.code} (not set up to start yet)`,
            }))}
          />
        </>
      )}
    </CareSheet>
  );
};

const EpisodePanel = ({ episodeId, onChanged }: { episodeId: string; onChanged: () => void }) => {
  const [s, setS] = useState<EpisodeSchedule | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState<"pattern" | "visit" | "pin" | "worker" | null>(null);
  const [ending, setEnding] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState(shiftDay(lagosToday(), 14));
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setS(await episodeSchedule(episodeId));
    } catch {
      setFailed(true);
    }
  }, [episodeId]);

  useEffect(() => { setS(null); setFailed(false); void load(); }, [load]);

  const refresh = () => { setSheet(null); void load(); onChanged(); };

  const generate = async () => {
    setBusy(true);
    try {
      const r = await generateVisits(episodeId, until);
      toast.success(r.created === 0 ? "Nothing new to make: every visit up to that date exists."
        : `${r.created} visit${r.created === 1 ? "" : "s"} made${r.open ? `, ${r.open} left open because the worker was not free` : ""}.`);
      refresh();
    } catch (err) {
      toast.error(careErrorMessage(err, "The visits could not be made."));
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    if (!ending) return;
    setBusy(true);
    try {
      const n = await endPattern(ending, reason);
      toast.success(`Pattern ended${n ? `; ${n} future visit${n === 1 ? "" : "s"} cancelled` : ""}.`);
      setEnding(null);
      setReason("");
      refresh();
    } catch (err) {
      toast.error(careErrorMessage(err, "The pattern could not be ended."));
    } finally {
      setBusy(false);
    }
  };

  const unassign = async (visitId: string, personId: string) => {
    try {
      await assignVisit(visitId, personId || null);
      toast.success(personId ? "Worker assigned" : "Visit left open");
      refresh();
    } catch (err) {
      toast.error(careErrorMessage(err, "That worker could not be assigned."));
    }
  };

  const start = async () => {
    setBusy(true);
    try {
      await activateEpisode(episodeId);
      toast.success("Care started. Workers can now check in to visits.");
      refresh();
    } catch (err) {
      toast.error(careErrorMessage(err, "Care could not be started."));
    } finally {
      setBusy(false);
    }
  };

  if (failed) return <p className="text-[14px] text-body">This schedule could not be loaded.</p>;
  if (!s) return <Loader2 className="h-5 w-5 animate-spin text-muted-copy" />;

  const workerOptions = s.workers.filter((w) => w.app_access).map((w) => ({ value: w.person_id, label: w.name }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-ink">{s.client_name}</h3>
          <p className="text-[14px] text-body">
            {serviceLabel(s.service_code)}. <Link className="font-bold text-brand" to={`/admin/clients/${s.client_id}`}>Client record</Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={careGhost} onClick={() => setSheet("visit")}>Book a visit</button>
          <button type="button" className={carePrimary} onClick={() => setSheet("pattern")}>Add a pattern</button>
        </div>
      </header>

      {s.status === "planned" && (
        <section className="flex flex-wrap items-center justify-between gap-3 border border-line bg-warn-bg p-4">
          <p className="text-[14px] text-body">
            This care is planned, not started. Visits can be booked now, but workers can check in only once it starts.
            Starting needs the service to be set up first.
          </p>
          <button type="button" className={carePrimary} disabled={busy} onClick={start}>Start this care</button>
        </section>
      )}

      <section className="flex flex-col gap-2 border border-line-soft p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-1.5 text-[14px] font-bold text-ink"><MapPin className="h-4 w-4" /> Home</h4>
          {s.home_id ? (
            <button type="button" className={careGhost} onClick={() => setSheet("pin")}>
              {s.place?.lat != null ? "Change pin" : "Add map pin"}
            </button>
          ) : null}
        </div>
        <p className="text-[14px] text-body">
          {s.place?.address ?? "No address on the client record."}
          {s.place?.landmark ? `, ${s.place.landmark}` : ""}
        </p>
        {s.place?.lat == null && (
          <p className="text-[13px] text-muted-copy">
            {s.home_id ? "No map pin yet: check-ins will be flagged until one is set."
              : "This client has no home record, so a pin cannot be set yet."}
          </p>
        )}
        {s.place?.access_notes && <p className="text-[13px] text-body">Access: {s.place.access_notes}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[13px] font-bold uppercase tracking-wide text-muted-copy">Workers on this care</h4>
          <button type="button" className={careGhost} onClick={() => setSheet("worker")}>Add a worker</button>
        </div>
        {s.workers.length === 0 ? (
          <p className="text-[14px] text-body">No one is on this care yet. Add a worker before booking visits for them.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {s.workers.map((w) => (
              <li key={w.person_id}>
                <Status label={w.app_access ? w.name : `${w.name}: no app access`} tone={w.app_access ? "good" : "warning"} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-[13px] font-bold uppercase tracking-wide text-muted-copy">Weekly patterns</h4>
        {s.patterns.length === 0 ? (
          <p className="text-[14px] text-body">No patterns yet. Add one to make regular visits.</p>
        ) : s.patterns.map((p) => (
          <article key={p.id} className="flex flex-wrap items-start justify-between gap-3 border border-line-soft p-3">
            <div>
              <p className="text-[14px] font-bold text-ink">
                {weekdaysLabel(p.weekdays)}, {p.start_time} for {p.duration_minutes} min
              </p>
              <p className="flex items-center gap-1 text-[13.5px] text-body">
                {p.is_primary && <Star aria-label="Primary carer" className="h-3.5 w-3.5 fill-current text-brand" />}
                {p.person_name ?? "No one yet"}
                {p.valid_until ? `, until ${p.valid_until}` : ""}
              </p>
            </div>
            <button type="button" className={careGhost} onClick={() => setEnding(p.id)}>End</button>
          </article>
        ))}
        {s.patterns.length > 0 && (
          <div className="flex flex-wrap items-end gap-2">
            <DateField label="Make visits up to" value={until} onChange={setUntil} min={lagosToday()} max={shiftDay(lagosToday(), 62)} />
            <button type="button" className={carePrimary} disabled={busy || !until} onClick={generate}>
              {busy ? "Making visits" : "Make visits"}
            </button>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-[13px] font-bold uppercase tracking-wide text-muted-copy">Next 14 days</h4>
        {s.visits.length === 0 ? (
          <p className="text-[14px] text-body">No visits booked.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft border border-line-soft">
            {s.visits.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                <span className="text-[14px] tabular-nums text-ink">{dateTime(v.scheduled_start)}</span>
                {v.status === "scheduled" ? (
                  <SelectField
                    label={`Worker for ${dateTime(v.scheduled_start)}`}
                    hideLabel
                    value={v.person_id ?? ""}
                    onChange={(id) => { void unassign(v.id, id); }}
                    placeholder="Open"
                    options={workerOptions}
                    className="min-w-[12rem]"
                  />
                ) : (
                  <Status label={`${v.person_name ?? ""} in progress`} tone="progress" />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <PatternSheet s={s} open={sheet === "pattern"} onOpenChange={(o) => setSheet(o ? "pattern" : null)} onDone={refresh} />
      <AddWorkerSheet s={s} open={sheet === "worker"} onOpenChange={(o) => setSheet(o ? "worker" : null)} onDone={refresh} />
      <VisitSheet s={s} open={sheet === "visit"} onOpenChange={(o) => setSheet(o ? "visit" : null)} onDone={refresh} />
      {sheet === "pin" && <PinSheet s={s} open onOpenChange={(o) => setSheet(o ? "pin" : null)} onDone={refresh} />}
      <CareConfirm
        open={ending !== null}
        onOpenChange={(o) => { if (!o) { setEnding(null); setReason(""); } }}
        title="End this pattern"
        description="Its visits that have not started are cancelled. Visits already done stay on the record."
        confirmLabel={busy ? "Ending" : "End pattern"}
        confirmDisabled={busy || !reason.trim()}
        onConfirm={end}
      >
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} aria-label="Reason" />
      </CareConfirm>
    </div>
  );
};

export const ScheduleTab = () => {
  const [list, setList] = useState<ScheduleEpisode[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await scheduleEpisodes());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startSheet = (
    <StartCareSheet
      open={starting}
      onOpenChange={setStarting}
      onDone={(id) => { setStarting(false); setSelected(id); void load(); }}
    />
  );

  if (failed) return <p className="border border-line-soft p-4 text-[14px] text-body">The schedule could not be loaded.</p>;
  if (!list) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-copy" />;
  if (list.length === 0) {
    return (
      <>
        <MuEmpty art={art.objMagnifier} title="No running care yet"
          description="Open care for a client to add workers and a schedule."
          action={<button type="button" className={carePrimary} onClick={() => setStarting(true)}>Open care for a client</button>} />
        {startSheet}
      </>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(16rem,22rem)_1fr]">
      <div className="flex justify-end lg:col-span-2">
        <button type="button" className={careGhost} onClick={() => setStarting(true)}>Open care for a client</button>
      </div>
      <ul className="flex flex-col gap-2" aria-label="Running care">
        {list.map((e) => (
          <li key={e.episode_id}>
            <button
              type="button"
              onClick={() => setSelected(e.episode_id)}
              aria-current={selected === e.episode_id}
              className={`w-full border p-3 text-left ${selected === e.episode_id ? "border-navy bg-desk/60" : "border-line-soft bg-card hover:bg-desk/40"}`}
            >
              <p className="text-[14px] font-bold text-ink">{e.client_name}</p>
              <p className="text-[13px] text-body">
                {serviceLabel(e.service_code)}{e.primary_carer ? `, ${e.primary_carer}` : ""}
              </p>
              <p className="mt-1 flex flex-wrap gap-1.5">
                {e.open_visits > 0 && <Status label={`${e.open_visits} open`} tone="warning" />}
                {e.status === "planned" && <Status label="Not started" tone="warning" />}
                {e.patterns === 0 && <Status label="No schedule" tone="neutral" />}
                {!e.has_pin && <Status label="No map pin" tone="neutral" />}
              </p>
            </button>
          </li>
        ))}
      </ul>
      <div>
        {selected ? <EpisodePanel episodeId={selected} onChanged={load} /> : (
          <p className="text-[14px] text-body">Choose a client to see and change their schedule.</p>
        )}
      </div>
      {startSheet}
    </div>
  );
};

export default ScheduleTab;
