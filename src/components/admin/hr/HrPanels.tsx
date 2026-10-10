// The HR panels a staff member, their manager and Workforce share: leave,
// onboarding and offboarding checklists, reviews, and the team below someone.
// Each panel asks the database what it may do; nothing here grants anything.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/field";
import { CareSheet } from "@/components/admin/care/CareSurface";
import { MuEmpty, MuSection, MuStatus, type MuTone } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { cn } from "@/lib/utils";
import {
  acknowledgeReview, ChecklistItem, ChecklistKind, daysUntil, decideLeave, formatLeaveDates, LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS, LeaveBalance, leaveBalance, LeaveRow, LeaveType, listLeave, loadChecklist, loadDueReviews, loadMyTeam,
  loadReviews, OUTCOME_LABELS, PROBATION_LABELS, ProbationOutcome, RATING_LABELS, requestLeave, Review, ReviewKind,
  REVIEW_KIND_LABELS, REVIEW_STATUS_LABELS, saveReview, shareReview, startChecklist, TeamMember, tickChecklist,
  workingDays,
} from "@/lib/hr";

const leaveTone = (s: LeaveRow["status"]): MuTone =>
  s === "approved" ? "good" : s === "requested" ? "warning" : "neutral";

const reviewTone = (s: Review["status"]): MuTone =>
  s === "acknowledged" ? "good" : s === "shared" ? "info" : "warning";

const fmtDate = (d: string | null) =>
  d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

/* ---- Leave balance ------------------------------------------------------- */

export const LeaveBalanceTiles = ({ balance }: { balance: LeaveBalance | null }) => {
  if (!balance) return null;
  const tiles = [
    { label: "Allowance", value: balance.allowance ?? "Not set", hint: `working days, ${balance.year}` },
    { label: "Taken", value: balance.taken, hint: "days so far" },
    { label: "Booked", value: balance.booked, hint: "approved, to come" },
    { label: "Left", value: balance.remaining ?? "–", hint: balance.pending ? `${balance.pending} waiting for approval` : "to book" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="border-2 border-navy/15 bg-card px-4 py-3">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-label">{t.label}</p>
          <p className="mt-1 text-[24px] font-extrabold leading-none tracking-[-0.03em] text-navy">{t.value}</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">{t.hint}</p>
        </div>
      ))}
    </div>
  );
};

/* ---- Leave list ---------------------------------------------------------- */

const LeaveList = ({
  rows, showName, onChanged, mine,
}: { rows: LeaveRow[]; showName?: boolean; onChanged: () => void; mine?: boolean }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const act = async (row: LeaveRow, action: "approve" | "decline" | "withdraw") => {
    setBusy(row.id);
    const res = await decideLeave(row.id, action, notes[row.id]);
    setBusy(null);
    if (!res.ok) { toast.error(res.error ?? "That did not work"); return; }
    toast.success(action === "approve" ? "Leave approved" : action === "decline" ? "Leave declined" : "Leave withdrawn");
    onChanged();
  };
  if (rows.length === 0) return null;
  return (
    <ul className="divide-y divide-line-soft">
      {rows.map((r) => {
        const canWithdraw = mine && (r.status === "requested" || (r.status === "approved" && daysUntil(r.from_date) > 0));
        return (
          <li key={r.id} className="flex flex-col gap-3 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold tracking-[-0.02em] text-navy">
                  {showName ? `${r.full_name}: ` : ""}{LEAVE_TYPE_LABELS[r.leave_type]}
                </p>
                <p className="mt-0.5 text-[14px] text-body">
                  {formatLeaveDates(r.from_date, r.to_date)}, {r.working_days} working day{r.working_days === 1 ? "" : "s"}
                </p>
                {r.reason && <p className="mt-1 text-[13.5px] text-muted-foreground">“{r.reason}”</p>}
                {r.decided_by_name && r.status !== "requested" && (
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {LEAVE_STATUS_LABELS[r.status]} by {r.decided_by_name}{r.decided_at ? ` on ${fmtDate(r.decided_at)}` : ""}
                    {r.decision_note ? `: ${r.decision_note}` : ""}
                  </p>
                )}
              </div>
              <MuStatus label={LEAVE_STATUS_LABELS[r.status]} tone={leaveTone(r.status)} />
            </div>
            {r.can_decide && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  placeholder="A note for them (optional)"
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  className="sm:max-w-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy === r.id} onClick={() => void act(r, "approve")}>Approve</Button>
                  <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => void act(r, "decline")}>Decline</Button>
                </div>
              </div>
            )}
            {canWithdraw && (
              <div>
                <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => void act(r, "withdraw")}>Withdraw this request</Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

/* ---- My leave ------------------------------------------------------------ */

export const MyLeave = ({ personId }: { personId: string }) => {
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ type: LeaveType; from: string; to: string; reason: string }>({ type: "annual", from: "", to: "", reason: "" });
  const [days, setDays] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, bal] = await Promise.all([listLeave(personId), leaveBalance(personId)]);
      setRows(list.filter((r) => r.person_id === personId));
      setBalance(bal);
    } catch { /* shown as empty */ }
    setLoading(false);
  }, [personId]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let live = true;
    void workingDays(form.from, form.to || form.from).then((d) => { if (live) setDays(d); });
    return () => { live = false; };
  }, [form.from, form.to]);

  const submit = async () => {
    setSaving(true);
    const res = await requestLeave(form.from, form.to || form.from, form.type, form.reason);
    setSaving(false);
    if (!res.ok) { toast.error(res.error ?? "Could not send the request"); return; }
    toast.success("Request sent to your manager");
    setOpen(false);
    setForm({ type: "annual", from: "", to: "", reason: "" });
    void load();
  };

  return (
    <MuSection
      title="Your leave"
      description="Ask for time off here. Your manager approves it, and you will see their answer here."
      actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Ask for leave</Button>}
    >
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="flex flex-col gap-5">
          <LeaveBalanceTiles balance={balance} />
          {rows.length === 0
            ? <MuEmpty art={art.objCalendar} title="No leave yet" description="Requests you make appear here with their answer." />
            : <LeaveList rows={rows} mine onChanged={() => void load()} />}
        </div>
      )}

      <CareSheet
        open={open}
        onOpenChange={setOpen}
        title="Ask for leave"
        description="Weekends and public holidays are not counted."
        onSave={() => void submit()}
        saveLabel="Send to my manager"
        saving={saving}
        saveDisabled={!form.from || (days ?? 0) === 0}
      >
        <SelectField
          label="Kind of leave"
          value={form.type}
          placeholder={false}
          onChange={(v) => setForm({ ...form, type: v as LeaveType })}
          options={Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>First day off</Label>
            <Input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value, to: form.to && form.to < e.target.value ? e.target.value : form.to })} />
          </div>
          <div className="space-y-1.5">
            <Label>Last day off</Label>
            <Input type="date" min={form.from || undefined} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
          </div>
        </div>
        {form.from && days !== null && (
          <p className="text-[14px] font-bold text-navy">
            {days === 0 ? "Those days are all weekends or public holidays." : `${days} working day${days === 1 ? "" : "s"}`}
            {form.type === "annual" && balance?.remaining != null && days > 0 ? `, leaving ${balance.remaining - days} of your allowance` : ""}
          </p>
        )}
        <div className="space-y-1.5">
          <Label>Anything your manager should know (optional)</Label>
          <Textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </div>
      </CareSheet>
    </MuSection>
  );
};

/* ---- Someone's leave, for their manager or Workforce ---------------------- */

export const PersonLeave = ({ personId, title = "Leave" }: { personId: string; title?: string }) => {
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const load = useCallback(async () => {
    try {
      const [list, bal] = await Promise.all([listLeave(personId), leaveBalance(personId)]);
      setRows(list);
      setBalance(bal);
    } catch { setRows([]); }
  }, [personId]);
  useEffect(() => { void load(); }, [load]);
  return (
    <MuSection title={title} description="Requests waiting for a decision come first. Set the yearly allowance on Employment details.">
      <div className="flex flex-col gap-5">
        <LeaveBalanceTiles balance={balance} />
        {rows.length === 0
          ? <MuEmpty art={art.objCalendar} title="No leave requested" description="Requests they make from My profile appear here." />
          : <LeaveList rows={rows} onChanged={() => void load()} />}
      </div>
    </MuSection>
  );
};

/** Every request waiting for the signed-in person to decide. Renders nothing when there are none. */
export const LeaveToDecide = ({ onChanged }: { onChanged?: () => void }) => {
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const load = useCallback(async () => {
    try { setRows((await listLeave(null, true)).filter((r) => r.can_decide)); } catch { setRows([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (rows.length === 0) return null;
  return (
    <MuSection title="Leave waiting for you" description="From the people who report to you.">
      <LeaveList rows={rows} showName onChanged={() => { void load(); onChanged?.(); }} />
    </MuSection>
  );
};

/* ---- Checklists ---------------------------------------------------------- */

const CHECKLIST_TITLES: Record<ChecklistKind, string> = { onboarding: "Onboarding", offboarding: "Offboarding" };

export const Checklists = ({ personId, manage }: { personId: string; manage: boolean }) => {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setItems(await loadChecklist(personId)); } catch { setItems([]); }
  }, [personId]);
  useEffect(() => { void load(); }, [load]);

  const start = async (kind: ChecklistKind) => {
    setBusy(kind);
    const res = await startChecklist(personId, kind);
    setBusy(null);
    if (!res.ok) { toast.error(res.error ?? "Could not start it"); return; }
    void load();
  };
  const tick = async (item: ChecklistItem) => {
    setBusy(item.id);
    const res = await tickChecklist(item.id, !item.done_at);
    setBusy(null);
    if (!res.ok) { toast.error(res.error ?? "Could not save that"); return; }
    void load();
  };

  const kinds: ChecklistKind[] = ["onboarding", "offboarding"];
  const started = kinds.filter((k) => items.some((i) => i.kind === k));
  if (!manage && started.length === 0) return null;

  return (
    <MuSection
      title="Checklists"
      description={manage ? "The standard steps for joining and leaving, ticked as they are done." : "Where your joining steps stand."}
      actions={manage ? (
        <div className="flex flex-wrap gap-2">
          {kinds.filter((k) => !started.includes(k)).map((k) => (
            <Button key={k} size="sm" variant="outline" disabled={busy === k} onClick={() => void start(k)}>
              <Plus className="mr-1.5 h-4 w-4" />Start {CHECKLIST_TITLES[k].toLowerCase()}
            </Button>
          ))}
        </div>
      ) : undefined}
    >
      {started.length === 0 ? (
        <MuEmpty art={art.objClipboard} title="No checklist started" description="Start onboarding for someone new, or offboarding when someone is leaving." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {started.map((k) => {
            const list = items.filter((i) => i.kind === k);
            const done = list.filter((i) => i.done_at).length;
            return (
              <div key={k}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="text-[15px] font-extrabold tracking-[-0.02em] text-navy">{CHECKLIST_TITLES[k]}</h3>
                  <span className="text-[13px] font-bold text-muted-foreground">{done} of {list.length} done</span>
                </div>
                <div className="mb-3 h-1.5 bg-tint"><div className="h-full bg-brand transition-[width]" style={{ width: `${(done / Math.max(1, list.length)) * 100}%` }} /></div>
                <ul className="flex flex-col">
                  {list.map((i) => (
                    <li key={i.id}>
                      <button
                        type="button"
                        disabled={!manage || busy === i.id}
                        onClick={() => void tick(i)}
                        className={cn("flex w-full items-start gap-3 py-2 text-left", manage && "hover:bg-tint/50")}
                      >
                        <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-2", i.done_at ? "border-brand bg-brand text-white" : "border-navy/30 bg-card")}>
                          {i.done_at && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0">
                          <span className={cn("block text-[14px]", i.done_at ? "text-muted-foreground line-through" : "font-semibold text-ink")}>{i.title}</span>
                          {i.done_at && <span className="block text-[12px] text-muted-foreground">{i.done_by_name ? `${i.done_by_name}, ` : ""}{fmtDate(i.done_at)}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </MuSection>
  );
};

/* ---- Reviews ------------------------------------------------------------- */

const blankReview = (personId: string, reviewer: string | null): Partial<Review> & { person_id: string } => ({
  person_id: personId, reviewer_person_id: reviewer, kind: "one_to_one", status: "scheduled",
  due_date: "", period_label: "", achievements: "", development: "", objectives: "", rating: null, outcome: null,
});

export const Reviews = ({
  personId, manage, myPersonId,
}: { personId: string; manage: boolean; myPersonId: string | null }) => {
  const [rows, setRows] = useState<Review[]>([]);
  const [editing, setEditing] = useState<(Partial<Review> & { person_id: string }) | null>(null);
  const [answering, setAnswering] = useState<Review | null>(null);
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const isSelf = myPersonId === personId;

  const load = useCallback(async () => {
    try { setRows(await loadReviews(personId)); } catch { setRows([]); }
  }, [personId]);
  useEffect(() => { void load(); }, [load]);

  const save = async (andShare: boolean) => {
    if (!editing) return;
    setSaving(true);
    const res = await saveReview({ ...editing, due_date: editing.due_date || null, period_label: editing.period_label || null });
    if (!res.ok) { setSaving(false); toast.error(res.error ?? "Could not save the review"); return; }
    if (andShare && editing.id) {
      const shared = await shareReview(editing.id);
      if (!shared.ok) { setSaving(false); toast.error(shared.error ?? "Saved, but not shared"); void load(); return; }
      toast.success("Review shared with them");
    } else {
      toast.success("Review saved");
    }
    setSaving(false);
    setEditing(null);
    void load();
  };

  const acknowledge = async () => {
    if (!answering) return;
    setSaving(true);
    const res = await acknowledgeReview(answering.id, comments);
    setSaving(false);
    if (!res.ok) { toast.error(res.error ?? "Could not send that"); return; }
    toast.success("Thank you. Your manager can see your comments.");
    setAnswering(null);
    setComments("");
    void load();
  };

  const canWrite = manage && !isSelf;
  const visible = rows;
  const e = editing;

  return (
    <MuSection
      title="Reviews"
      description={canWrite
        ? "Probation reviews, one to ones and appraisals. Write it, then share it: they add their comments and confirm they have read it."
        : "Reviews your manager has shared with you. Add your comments and confirm you have read each one."}
      actions={canWrite ? <Button size="sm" onClick={() => setEditing(blankReview(personId, myPersonId))}><Plus className="mr-1.5 h-4 w-4" />Book a review</Button> : undefined}
    >
      {visible.length === 0 ? (
        <MuEmpty art={art.objCarePlan} title="No reviews yet" description={canWrite ? "Book a probation review, a one to one or an appraisal." : "When your manager shares a review, it appears here."} />
      ) : (
        <ul className="divide-y divide-line-soft">
          {visible.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-extrabold tracking-[-0.02em] text-navy">
                    {REVIEW_KIND_LABELS[r.kind]}{r.period_label ? `, ${r.period_label}` : ""}
                  </p>
                  <p className="mt-0.5 text-[13.5px] text-muted-foreground">
                    {r.due_date ? `Due ${fmtDate(r.due_date)}` : "No date set"}
                    {r.rating ? ` · Rated ${r.rating} of 5` : ""}
                    {r.outcome ? ` · ${OUTCOME_LABELS[r.outcome]}` : ""}
                  </p>
                </div>
                <MuStatus label={REVIEW_STATUS_LABELS[r.status]} tone={reviewTone(r.status)} />
              </div>
              {(r.status === "shared" || r.status === "acknowledged" || isSelf) && (r.achievements || r.objectives || r.development) && (
                <div className="grid gap-3 border-l-4 border-brand/40 bg-tint/40 px-4 py-3 text-[14px] leading-relaxed text-body sm:grid-cols-3">
                  {r.achievements && <div><p className="text-[12px] font-bold uppercase tracking-[0.06em] text-label">Went well</p><p className="mt-1 whitespace-pre-line">{r.achievements}</p></div>}
                  {r.development && <div><p className="text-[12px] font-bold uppercase tracking-[0.06em] text-label">To develop</p><p className="mt-1 whitespace-pre-line">{r.development}</p></div>}
                  {r.objectives && <div><p className="text-[12px] font-bold uppercase tracking-[0.06em] text-label">Objectives</p><p className="mt-1 whitespace-pre-line">{r.objectives}</p></div>}
                </div>
              )}
              {r.employee_comments && (
                <p className="text-[13.5px] text-body"><b className="text-navy">Their comments: </b>{r.employee_comments}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {canWrite && (r.status === "scheduled" || r.status === "draft") && (
                  <Button size="sm" variant="outline" onClick={() => setEditing({ ...r, person_id: r.person_id })}>
                    {r.status === "scheduled" ? "Write it" : "Carry on writing"}
                  </Button>
                )}
                {isSelf && r.status === "shared" && (
                  <Button size="sm" onClick={() => { setAnswering(r); setComments(""); }}>Add comments and confirm</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <CareSheet
        open={!!e}
        onOpenChange={(v) => { if (!v) setEditing(null); }}
        title={e?.id ? REVIEW_KIND_LABELS[(e.kind ?? "one_to_one") as ReviewKind] : "Book a review"}
        description={e?.id ? "Save as you go. Sharing sends it to them to read and comment on; after that it cannot be changed." : "Book it now and write it nearer the time."}
        onSave={() => void save(false)}
        saveLabel={e?.id ? "Save" : "Book it"}
        saving={saving}
      >
        {e && (
          <>
            <SelectField
              label="Kind"
              value={e.kind ?? "one_to_one"}
              placeholder={false}
              onChange={(v) => setEditing({ ...e, kind: v as ReviewKind })}
              options={Object.entries(REVIEW_KIND_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Due</Label>
                <Input type="date" value={e.due_date ?? ""} onChange={(ev) => setEditing({ ...e, due_date: ev.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Period (optional)</Label>
                <Input placeholder="e.g. Q4 2026" value={e.period_label ?? ""} onChange={(ev) => setEditing({ ...e, period_label: ev.target.value })} />
              </div>
            </div>
            {e.id && (
              <>
                <div className="space-y-1.5">
                  <Label>What went well</Label>
                  <Textarea rows={4} value={e.achievements ?? ""} onChange={(ev) => setEditing({ ...e, achievements: ev.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>What to develop</Label>
                  <Textarea rows={3} value={e.development ?? ""} onChange={(ev) => setEditing({ ...e, development: ev.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Objectives for the next period</Label>
                  <Textarea rows={3} value={e.objectives ?? ""} onChange={(ev) => setEditing({ ...e, objectives: ev.target.value })} />
                </div>
                <SelectField
                  label="Overall"
                  value={e.rating ? String(e.rating) : ""}
                  placeholder="No rating"
                  onChange={(v) => setEditing({ ...e, rating: v ? Number(v) : null })}
                  options={Object.entries(RATING_LABELS).map(([value, label]) => ({ value, label }))}
                />
                {e.kind === "probation" && (
                  <SelectField
                    label="Probation outcome"
                    value={e.outcome ?? ""}
                    placeholder="Choose before sharing"
                    onChange={(v) => setEditing({ ...e, outcome: (v || null) as ProbationOutcome | null })}
                    options={Object.entries(OUTCOME_LABELS).map(([value, label]) => ({ value, label }))}
                  />
                )}
                <Button type="button" variant="outline" disabled={saving} onClick={() => void save(true)}>
                  Save and share with them
                </Button>
              </>
            )}
          </>
        )}
      </CareSheet>

      <CareSheet
        open={!!answering}
        onOpenChange={(v) => { if (!v) setAnswering(null); }}
        title="Your comments"
        description="Anything you would like to add. Confirming tells your manager you have read the review."
        onSave={() => void acknowledge()}
        saveLabel="Confirm I have read it"
        saving={saving}
      >
        <Textarea rows={6} value={comments} onChange={(ev) => setComments(ev.target.value)} placeholder="Optional" />
      </CareSheet>
    </MuSection>
  );
};

/* ---- My team ------------------------------------------------------------- */

export const MyTeam = ({ myPersonId, openPersonId, onClosePerson }: {
  myPersonId: string | null;
  /** Opens this person's sheet once the team has loaded, e.g. from a notification. */
  openPersonId?: string | null;
  onClosePerson?: () => void;
}) => {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [open, setOpen] = useState<TeamMember | null>(null);
  const load = useCallback(async () => {
    try { setTeam(await loadMyTeam()); } catch { setTeam([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!openPersonId) return;
    const member = team.find((t) => t.id === openPersonId);
    if (member) setOpen(member);
  }, [openPersonId, team]);
  const direct = useMemo(() => team.filter((t) => t.direct), [team]);
  if (team.length === 0) return null;

  return (
    <>
      <LeaveToDecide onChanged={() => void load()} />
      <MuSection title="Your team" description="People who report to you. Open someone for their leave, checklist and reviews.">
        <ul className="divide-y divide-line-soft">
          {team.map((t) => {
            const probationSoon = t.probation_end && (!t.probation_status || t.probation_status === "in_probation" || t.probation_status === "extended") && daysUntil(t.probation_end) <= 30;
            return (
              <li key={t.id}>
                <button type="button" onClick={() => setOpen(t)} className="flex w-full flex-col gap-2 py-3 text-left hover:bg-tint/40 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="block text-[15px] font-extrabold tracking-[-0.02em] text-navy">{t.full_name}</span>
                    <span className="block text-[13px] text-muted-foreground">
                      {t.job_title || "No job title"}{!t.direct ? " · through your team" : ""}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-2">
                    {t.pending_leave > 0 && <MuStatus label={`${t.pending_leave} leave to decide`} tone="warning" />}
                    {probationSoon && <MuStatus label={`Probation ends ${fmtDate(t.probation_end)}`} tone="warning" />}
                    {t.probation_status && !probationSoon && <MuStatus label={PROBATION_LABELS[t.probation_status] ?? t.probation_status} tone="neutral" />}
                    {t.next_review && <MuStatus label={`Review ${fmtDate(t.next_review)}`} tone="info" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {direct.length === 0 && <p className="mt-2 text-[13px] text-muted-foreground">No one reports to you directly.</p>}
      </MuSection>

      <CareSheet open={!!open} onOpenChange={(v) => { if (!v) { setOpen(null); onClosePerson?.(); void load(); } }} title={open?.full_name ?? ""} description={open?.job_title ?? undefined}>
        {open && (
          <div className="-mx-1 flex flex-col gap-6 [&_section]:shadow-none">
            <PersonLeave personId={open.id} />
            <Reviews personId={open.id} manage myPersonId={myPersonId} />
            <Checklists personId={open.id} manage />
          </div>
        )}
      </CareSheet>
    </>
  );
};

/* ---- Needs attention, across the office ---------------------------------- */

interface AttentionPerson { id: string; full_name: string; probation_end: string | null; probation_status: string | null }

/** Leave to decide, probations ending soon and reviews coming up, for Workforce. */
export const HrAttention = ({ people }: { people: AttentionPerson[] }) => {
  const [leave, setLeave] = useState<LeaveRow[]>([]);
  const [reviews, setReviews] = useState<(Review & { full_name: string })[]>([]);
  const load = useCallback(async () => {
    try { setLeave(await listLeave(null, true)); } catch { setLeave([]); }
    try {
      const soon = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
      const names = new Map(people.map((p) => [p.id, p.full_name]));
      setReviews((await loadDueReviews(soon)).map((r) => ({ ...r, full_name: names.get(r.person_id) ?? "Someone" })));
    } catch { setReviews([]); }
  }, [people]);
  useEffect(() => { void load(); }, [load]);

  const probation = people
    .filter((p) => p.probation_end && (!p.probation_status || p.probation_status === "in_probation" || p.probation_status === "extended"))
    .filter((p) => daysUntil(p.probation_end as string) <= 30)
    .sort((a, b) => (a.probation_end as string).localeCompare(b.probation_end as string));

  const items = [
    ...leave.map((l) => ({ key: `l${l.id}`, to: `/admin/workforce/${l.person_id}`, text: `${l.full_name}: ${LEAVE_TYPE_LABELS[l.leave_type].toLowerCase()}, ${formatLeaveDates(l.from_date, l.to_date)}`, tag: "Leave to decide" })),
    ...probation.map((p) => {
      const d = daysUntil(p.probation_end as string);
      return { key: `p${p.id}`, to: `/admin/workforce/${p.id}`, text: `${p.full_name}: probation ${d < 0 ? "ended" : "ends"} ${fmtDate(p.probation_end)}`, tag: d < 0 ? "Probation overdue" : "Probation ending" };
    }),
    ...reviews.map((r) => ({ key: `r${r.id}`, to: `/admin/workforce/${r.person_id}`, text: `${r.full_name}: ${REVIEW_KIND_LABELS[r.kind].toLowerCase()} due ${fmtDate(r.due_date)}`, tag: "Review due" })),
  ];
  if (items.length === 0) return null;
  return (
    <MuSection title="Needs attention" description="Leave waiting for a decision, probations ending in the next 30 days, and reviews due in the next two weeks.">
      <ul className="divide-y divide-line-soft">
        {items.map((i) => (
          <li key={i.key}>
            <Link to={i.to} className="flex flex-col gap-1 py-2.5 hover:bg-tint/40 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[14.5px] font-semibold text-ink">{i.text}</span>
              <MuStatus label={i.tag} tone="warning" />
            </Link>
          </li>
        ))}
      </ul>
    </MuSection>
  );
};
