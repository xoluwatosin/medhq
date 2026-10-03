// The care plan: fourteen sections, the structured layer beneath them, and the
// version history.
//
// A draft is written section by section and each save is acknowledged. It is
// not issued here: a plan is issued once the package is agreed and staffing is
// arranged. Once a version is issued it is never edited.
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CareEditButton, CareField as CareFormRow, CareSheet,
} from "@/components/admin/care/CareSurface";
import { cxInputClass } from "@/components/candidate/primitives";
import { adminDb } from "@/lib/admin-utils";
import { careErrorMessage } from "@/lib/care-errors";
import { MuEmpty, MuRow, MuSection, MuTable } from "@/components/admin/mu/MuShell";
import { SaveState, Status, type SaveStatus } from "@/components/field";
import { formatDateTime } from "@/lib/format";
import {
  clientPlans, currentPlan, planSections, planStatusLabel, planStructure, planVersionLabel,
  sectionNote, planApprovals, planIsApproved, approvePlan, type PlanApproval, type PlanDocument, type PlanSection, type PlanStructure,
} from "@/lib/care-plan";

const EMPTY: PlanStructure = { needs: [], goals: [], tasks: [] };

type ItemKind = "need" | "goal" | "task";

const ITEM_LABELS: Record<ItemKind, string> = {
  need: "Need",
  goal: "Goal",
  task: "Task",
};

const CarePlanSection = ({
  clientId, canWrite, canApprove, onChanged,
}: {
  clientId: string;
  canWrite: boolean;
  canApprove: boolean;
  onChanged?: () => void;
}) => {
  const [plans, setPlans] = useState<PlanDocument[]>([]);
  const [sections, setSections] = useState<PlanSection[]>([]);
  const [structure, setStructure] = useState<PlanStructure>(EMPTY);
  const [approvals, setApprovals] = useState<PlanApproval[]>([]);
  const [approvalActive, setApprovalActive] = useState(false);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<PlanSection | null>(null);
  const [note, setNote] = useState("");
  const [saveState, setSaveState] = useState<SaveStatus>("idle");

  const [item, setItem] = useState<{ kind: ItemKind; id: string | null } | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [itemDetail, setItemDetail] = useState("");
  const [itemExtra, setItemExtra] = useState("");

  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await clientPlans(clientId);
      setPlans(rows);
      const plan = currentPlan(rows);
      if (plan) {
        const [defSections, struct, approvalRows, approvalActive] = await Promise.all([
          planSections(plan.form_definition_id),
          planStructure(plan.id),
          planApprovals(plan.id),
          planIsApproved(plan.id),
        ]);
        setSections(defSections);
        setStructure(struct);
        setApprovals(approvalRows);
        setApprovalActive(approvalActive);
      } else {
        setSections([]);
        setStructure(EMPTY);
        setApprovals([]);
        setApprovalActive(false);
      }
    } catch {
      toast.error("Could not load the care plan");
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  const plan = useMemo(() => currentPlan(plans), [plans]);
  const isDraft = plan?.status === "draft";
  const editable = canWrite && isDraft;
  const latestApproval = approvals[0] ?? null;
  const approved = approvalActive;

  const approve = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      await approvePlan(plan.id);
      toast.success("Working plan approved");
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(careErrorMessage(error, "The working plan could not be approved."));
    }
    setBusy(false);
  };

  const openSection = (section: PlanSection) => {
    setEditing(section);
    setNote(sectionNote(plan, section.id));
    setSaveState("idle");
  };

  const saveSection = async () => {
    if (!plan || !editing) return;
    setSaveState("saving");
    const { error } = await adminDb().rpc("care_plan_save_section", {
      _document_id: plan.id,
      _section_id: editing.id,
      _value: { note },
    });
    if (error) {
      setSaveState("error");
      toast.error(careErrorMessage(error, "We couldn't save that section. Try again."));
      return;
    }
    setSaveState("saved");
    await load();
    onChanged?.();
    setEditing(null);
  };

  const openItem = (kind: ItemKind, id: string | null) => {
    setItem({ kind, id });
    if (!id) { setItemTitle(""); setItemDetail(""); setItemExtra(""); return; }
    if (kind === "need") {
      const row = structure.needs.find((n) => n.id === id);
      setItemTitle(row?.title ?? ""); setItemDetail(row?.detail ?? ""); setItemExtra("");
    } else if (kind === "goal") {
      const row = structure.goals.find((g) => g.id === id);
      setItemTitle(row?.title ?? ""); setItemDetail(row?.detail ?? ""); setItemExtra(row?.measure ?? "");
    } else {
      const row = structure.tasks.find((t) => t.id === id);
      setItemTitle(row?.title ?? ""); setItemDetail(row?.detail ?? ""); setItemExtra(row?.frequency ?? "");
    }
  };

  const saveItem = async () => {
    if (!plan || !item || !itemTitle.trim()) return;
    const payload: Record<string, string> = { title: itemTitle.trim(), detail: itemDetail.trim() };
    if (item.kind === "goal") payload.measure = itemExtra.trim();
    if (item.kind === "task") payload.frequency = itemExtra.trim();
    setBusy(true);
    const { error } = await adminDb().rpc("care_plan_item_save", {
      _document_id: plan.id, _kind: item.kind, _id: item.id, _payload: payload,
    });
    setBusy(false);
    if (error) {
      toast.error(careErrorMessage(error, "We couldn't save that entry. Try again."));
      return;
    }
    setItem(null);
    await load();
  };

  const removeItem = async (kind: ItemKind, id: string) => {
    if (!plan) return;
    const { error } = await adminDb().rpc("care_plan_item_remove", {
      _document_id: plan.id, _kind: kind, _id: id,
    });
    if (error) {
      toast.error(careErrorMessage(error, "We couldn't remove that entry. Try again."));
      return;
    }
    await load();
  };

  if (loading) return <MuSection title="Care plan"><p className="text-sm text-body">Loading.</p></MuSection>;

  if (!plan) {
    return (
      <MuSection title="Care plan">
        <MuEmpty
          title="No care plan yet"
          description="The plan opens once a clinician accepts the assessment."
        />
      </MuSection>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <MuSection
        title="Working plan"
        description={isDraft
          ? "A draft is written section by section. It is issued later, once the package is agreed and staffing is arranged."
          : "This version has been issued. A change starts a new version."}
        actions={<div className="flex flex-wrap items-center gap-2">
          <Status label={approved ? "Approved" : planStatusLabel(plan.status)} tone={approved || plan.status === "submitted" ? "good" : "progress"} />
          {isDraft && canApprove && !approved && (
            <Button type="button" disabled={busy} onClick={() => void approve()}>
              Approve working plan
            </Button>
          )}
        </div>}
      >
        <MuTable
          rows={[
            { label: "Version", value: planVersionLabel(plan) },
            { label: "Issued", value: plan.submitted_at ? formatDateTime(plan.submitted_at) : "" },
            { label: "Built from", value: plan.built_from_id ? "The accepted assessment" : "" },
            { label: "Replaces", value: plan.supersedes_id ? "An earlier version" : "" },
            { label: "Reason for the new version", value: plan.reissue_reason ?? "" },
            { label: "Approval", value: approved && latestApproval ? `${latestApproval.actor_name ?? "Authorised staff"} (${latestApproval.actor_role.replace(/_/g, " ")}), ${formatDateTime(latestApproval.created_at)}` : "Not approved" },
          ]}
        />

      </MuSection>

      <MuSection title="Sections" padded={false}>
        <div className="divide-y divide-line-soft">
          {sections.map((section) => {
            const written = sectionNote(plan, section.id);
            return (
              <MuRow
                key={section.id}
                title={`${section.order}. ${section.title}`}
                state={written || "Nothing written yet."}
                action={editable ? <CareEditButton label="Write" onClick={() => openSection(section)} /> : undefined}
              />
            );
          })}
        </div>
      </MuSection>

      {(["need", "goal", "task"] as ItemKind[]).map((kind) => {
        const rows = kind === "need" ? structure.needs : kind === "goal" ? structure.goals : structure.tasks;
        return (
          <MuSection
            key={kind}
            title={kind === "need" ? "Needs" : kind === "goal" ? "Goals" : "Tasks"}
            padded={false}
            actions={editable
              ? <CareEditButton label={`Add ${ITEM_LABELS[kind].toLowerCase()}`} onClick={() => openItem(kind, null)} />
              : undefined}
          >
            {rows.length === 0 ? (
              <div className="px-5 py-5">
                <MuEmpty title={`No ${kind}s recorded`} />
              </div>
            ) : (
              <div className="divide-y divide-line-soft">
                {rows.map((row) => (
                  <MuRow
                    key={row.id}
                    title={row.title}
                    state={
                      kind === "goal"
                        ? (row as { measure?: string | null }).measure ?? row.detail ?? undefined
                        : kind === "task"
                          ? (row as { frequency?: string | null }).frequency ?? row.detail ?? undefined
                          : row.detail ?? undefined
                    }
                    action={editable ? (
                      <div className="flex gap-2">
                        <CareEditButton onClick={() => openItem(kind, row.id)} />
                        <CareEditButton label="Remove" onClick={() => void removeItem(kind, row.id)} />
                      </div>
                    ) : undefined}
                  />
                ))}
              </div>
            )}
          </MuSection>
        );
      })}

      {plans.length > 1 && (
        <MuSection title="Earlier versions" description="Every issued version stays on the record.">
          <MuTable
            rows={plans.filter((p) => p.id !== plan.id).map((p) => ({
              label: planVersionLabel(p),
              value: `${planStatusLabel(p.status)}${p.submitted_at ? `, issued ${formatDateTime(p.submitted_at)}` : ""}`,
            }))}
          />
        </MuSection>
      )}

      <CareSheet
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing ? editing.title : "Care plan section"}
        description="What is written here is read by the people delivering care."
        onSave={saveSection}
        saving={saveState === "saving"}
      >
        <CareFormRow label="What this section says">
          <textarea className={`${cxInputClass()} min-h-44`} value={note} onChange={(e) => setNote(e.target.value)} />
        </CareFormRow>
        <SaveState status={saveState} />
      </CareSheet>

      <CareSheet
        open={!!item}
        onOpenChange={(open) => !open && setItem(null)}
        title={item ? `${item.id ? "Edit" : "Add"} ${ITEM_LABELS[item.kind].toLowerCase()}` : ""}
        onSave={saveItem}
        saving={busy}
        saveDisabled={!itemTitle.trim()}
      >
        <CareFormRow label="Short title">
          <input className={cxInputClass()} value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} />
        </CareFormRow>
        <CareFormRow label="Detail">
          <textarea className={`${cxInputClass()} min-h-28`} value={itemDetail} onChange={(e) => setItemDetail(e.target.value)} />
        </CareFormRow>
        {item?.kind === "goal" && (
          <CareFormRow label="How we will know" help="What tells us this goal has been met.">
            <input className={cxInputClass()} value={itemExtra} onChange={(e) => setItemExtra(e.target.value)} />
          </CareFormRow>
        )}
        {item?.kind === "task" && (
          <CareFormRow label="How often">
            <input className={cxInputClass()} value={itemExtra} onChange={(e) => setItemExtra(e.target.value)} />
          </CareFormRow>
        )}
      </CareSheet>

    </div>
  );
};

export default CarePlanSection;
