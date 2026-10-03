// What needs to happen on this client, in the order the work engine ranks it.
//
// The order, the reason and the stage all come from the database. This screen
// only shows them and records what a coordinator did.
//
// Every fact has its own place: the task and its explanation, when it is due,
// who owns it, which team holds it. Nothing is joined into a sentence, on a
// desk or on a phone.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { cxInputClass } from "@/components/candidate/primitives";
import {
  CareConfirm, CareSheet, careGhost, carePrimary,
} from "@/components/admin/care/CareSurface";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { adminDb } from "@/lib/admin-utils";
import { workKindLabel } from "@/lib/care";
import { careErrorMessage } from "@/lib/care-errors";
import { DateTimeField, SearchableSelect, SelectField, Status } from "@/components/field";
import {
  dueText, outstandingWork, staffOptions, teamLabel, workTone, WORK_TEAMS,
  type StaffOption, type WorkItem,
} from "@/lib/care-work";
import { MuSection } from "@/components/admin/mu/MuShell";
import { formatDateTime } from "@/lib/format";

interface FinishedItem {
  id: string;
  kind: string;
  title: string;
  status: string;
  outcome: string | null;
  cancel_reason: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

const OPEN_COLUMNS = "md:grid-cols-[minmax(0,2.6fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]";
const DONE_COLUMNS = "md:grid-cols-[minmax(0,2.6fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_auto]";

/**
 * Work the assessment owns. The database refuses to let these be completed,
 * cancelled, reassigned or moved on their own, so the screen does not offer it.
 */
const DOMAIN_MANAGED = new Set(["book", "assign", "conduct"]);

const HeadRow = ({ columns, labels }: { columns: string; labels: string[] }) => (
  <div className={`hidden gap-4 border-b border-line-soft px-5 py-2.5 md:grid ${columns}`}>
    {labels.map((l) => (
      <span key={l} className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {l}
      </span>
    ))}
  </div>
);

/** One fact in a row: labelled on a phone, bare in its column on a desk. */
const Cell = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground md:hidden">
      {label}
    </span>
    <span className="mt-0.5 block break-words text-[14px] leading-snug text-ink md:mt-0">{children}</span>
  </div>
);

const WorkSection = ({ clientId, onChanged }: { clientId: string; onChanged?: () => void }) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [finished, setFinished] = useState<FinishedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<WorkItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduling, setRescheduling] = useState<WorkItem | null>(null);
  const [newDue, setNewDue] = useState("");
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [assigning, setAssigning] = useState<WorkItem | null>(null);
  const [owner, setOwner] = useState("");
  const [team, setTeam] = useState("");

  const ownerName = (id: string | null) =>
    id ? staff.find((s) => s.user_id === id)?.display_name ?? "A member of staff" : "No owner";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [open, done, people] = await Promise.all([
        outstandingWork(clientId),
        adminDb()
          .from("care_work_items")
          .select("id, kind, title, status, outcome, cancel_reason, completed_at, cancelled_at")
          .eq("client_id", clientId)
          .in("status", ["completed", "cancelled"])
          .order("updated_at", { ascending: false })
          .limit(8),
        staffOptions(),
      ]);
      setItems(open);
      setFinished((done.data ?? []) as FinishedItem[]);
      setStaff(people);
    } catch {
      toast.error("Could not load the work on this client");
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  const after = async (message: string) => {
    toast.success(message);
    await load();
    onChanged?.();
  };

  const complete = async (item: WorkItem, outcome?: string) => {
    const { error } = await adminDb().rpc("care_work_complete", { _id: item.id, _outcome: outcome ?? null });
    if (error) { toast.error(careErrorMessage(error, "We couldn't update this work item. Try again.")); return; }
    void after("Work completed");
  };

  const cancel = async () => {
    if (!cancelling) return;
    const { error } = await adminDb().rpc("care_work_cancel", { _id: cancelling.id, _reason: cancelReason });
    if (error) { toast.error(careErrorMessage(error, "We couldn't cancel this work item. Try again.")); return; }
    setCancelling(null);
    setCancelReason("");
    void after("Work cancelled");
  };

  const reopen = async (item: FinishedItem) => {
    const { error } = await adminDb().rpc("care_work_reopen", { _id: item.id, _reason: "Reopened by a coordinator" });
    if (error) { toast.error(careErrorMessage(error, "We couldn't reopen this work item. Try again.")); return; }
    void after("Work reopened");
  };

  const reschedule = async () => {
    if (!rescheduling || !newDue) return;
    const { error } = await adminDb().rpc("care_work_set", {
      _id: rescheduling.id,
      _assignee_user_id: null,
      _team: null,
      _due_at: new Date(newDue).toISOString(),
    });
    if (error) { toast.error(careErrorMessage(error, "We couldn't change the due date. Try again.")); return; }
    setRescheduling(null);
    setNewDue("");
    void after("Due date changed");
  };

  const saveOwner = async () => {
    if (!assigning) return;
    const { error } = await adminDb().rpc("care_work_assign", {
      _id: assigning.id,
      _assignee_user_id: owner || null,
      _team: team || null,
    });
    if (error) { toast.error(careErrorMessage(error, "We couldn't change the owner. Try again.")); return; }
    setAssigning(null);
    void after(owner ? "Owner changed" : "Owner removed");
  };

  return (
    <>
      <MuSection
        title="Work"
        description="What needs to happen, most important first."
        padded={false}
      >
        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Loading work</p>
        ) : items.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No outstanding work</p>
        ) : (
          <>
            <HeadRow columns={OPEN_COLUMNS} labels={["Task", "Due", "Owner", "Team", ""]} />
            <div className="divide-y divide-line-soft">
              {items.map((item, index) => {
                const overdue = !!item.due_at && new Date(item.due_at).getTime() < Date.now();
                return (
                  <div key={item.id} className={`grid gap-4 px-5 py-4 md:items-start ${OPEN_COLUMNS}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-bold leading-snug tracking-[-0.01em] text-ink">
                          {item.title}
                        </span>
                        {index === 0 && <Status label="Next" tone={workTone(item)} />}
                      </div>
                      {item.detail && (
                        <p className="mt-1 text-[13.5px] leading-relaxed text-body">{item.detail}</p>
                      )}
                      {item.rank_reason && (
                        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                          <span className="font-bold">Why this is next: </span>{item.rank_reason}
                        </p>
                      )}
                    </div>

                    <Cell label="Due">
                      <span className={overdue ? "font-bold text-warn-ink" : undefined}>
                        {dueText(item.due_at).replace(/^Due\s+/i, "")}
                      </span>
                    </Cell>
                    <Cell label="Owner">{ownerName(item.assignee_user_id)}</Cell>
                    <Cell label="Team">{teamLabel(item.team)}</Cell>

                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      {DOMAIN_MANAGED.has(item.kind) ? (
                        // Booking, assigning and the visit itself are facts
                        // about the assessment. They finish when the
                        // assessment moves, and cannot be ticked off here.
                        <span className="text-[12.5px] leading-snug text-muted-foreground md:text-right">
                          Follows the assessment
                        </span>
                      ) : (
                        <>
                          {item.kind === "callback" ? (
                            <>
                              <button type="button" className={`${carePrimary} min-h-9 px-3 text-[13.5px]`}
                                      onClick={() => complete(item, "proceeding")}>
                                Spoke, proceeding
                              </button>
                              <button type="button" className={`${careGhost} min-h-9 px-3 text-[13.5px]`}
                                      onClick={() => complete(item, "no answer recorded")}>
                                Done
                              </button>
                            </>
                          ) : (
                            <button type="button" className={`${carePrimary} min-h-9 px-3 text-[13.5px]`}
                                    onClick={() => complete(item)}>
                              Done
                            </button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" className={`${careGhost} min-h-9 w-9 px-0`} aria-label="More actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onSelect={() => {
                                setAssigning(item);
                                setOwner(item.assignee_user_id ?? "");
                                setTeam(item.team ?? "");
                              }}>
                                {item.assignee_user_id ? "Reassign" : "Assign"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => { setRescheduling(item); setNewDue(""); }}>
                                Change due date
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => { setCancelling(item); setCancelReason(""); }}>
                                Cancel work
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </MuSection>

      {finished.length > 0 && (
        <MuSection title="Finished work" padded={false}>
          <HeadRow columns={DONE_COLUMNS} labels={["Task", "Outcome", "When", ""]} />
          <div className="divide-y divide-line-soft">
            {finished.map((item) => (
              <div key={item.id} className={`grid gap-4 px-5 py-4 md:items-start ${DONE_COLUMNS}`}>
                <div className="min-w-0">
                  <span className="block text-[15px] font-bold leading-snug tracking-[-0.01em] text-ink">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-[12.5px] text-muted-foreground">{workKindLabel(item.kind)}</span>
                </div>
                <Cell label={item.status === "cancelled" ? "Cancelled because" : "Outcome"}>
                  {item.status === "cancelled"
                    ? item.cancel_reason || "No reason recorded"
                    : item.outcome || "Completed"}
                </Cell>
                <Cell label={item.status === "cancelled" ? "Cancelled" : "Completed"}>
                  {formatDateTime(item.completed_at ?? item.cancelled_at) || "Not recorded"}
                </Cell>
                <div className="flex items-center gap-2 md:justify-end">
                  <Status label={item.status === "cancelled" ? "Cancelled" : "Completed"} tone="neutral" />
                  <button type="button" className={`${careGhost} min-h-9 px-3 text-[13.5px]`} onClick={() => reopen(item)}>
                    Reopen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </MuSection>
      )}

      <CareConfirm
        open={!!cancelling}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="Cancel work"
        description={cancelling?.title}
        confirmLabel="Cancel work"
        confirmDisabled={!cancelReason.trim()}
        onConfirm={cancel}
      >
        <input
          className={cxInputClass()}
          aria-label="Why this work is being cancelled"
          placeholder="Why is this no longer needed?"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </CareConfirm>

      <CareSheet
        open={!!rescheduling}
        onOpenChange={(open) => !open && setRescheduling(null)}
        title="Change when this is due"
        description={rescheduling?.title}
        onSave={reschedule}
        saveDisabled={!newDue}
      >
        <DateTimeField label="Due" value={newDue} onChange={setNewDue} />
      </CareSheet>

      <CareSheet
        open={!!assigning}
        onOpenChange={(open) => !open && setAssigning(null)}
        title="Who owns this work"
        description={assigning?.title}
        onSave={saveOwner}
      >
        <SearchableSelect
          label="Owner"
          value={owner}
          onChange={setOwner}
          placeholder="No owner"
          options={[
            { value: "", label: "No owner" },
            ...staff.map((s) => ({ value: s.user_id, label: s.display_name })),
          ]}
        />
        <SelectField
          label="Team"
          value={team}
          onChange={setTeam}
          placeholder="No team"
          options={WORK_TEAMS.map((t) => ({ value: t.value, label: t.label }))}
        />
      </CareSheet>
    </>
  );
};

export default WorkSection;
