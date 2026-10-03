// Arranging the assessment visit: when it is, who is carrying it out, and
// what happened to it. The clinical content is not here and never will be.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CareConfirm, CareField as CareFormRow, CareSheet } from "@/components/admin/care/CareSurface";
import { cxInputClass } from "@/components/candidate/primitives";
import { adminDb } from "@/lib/admin-utils";
import { careErrorMessage } from "@/lib/care-errors";
import { DateTimeField, SearchableSelect, SelectField, Status } from "@/components/field";
import { MuEmpty, MuRow, MuSection, MuTable } from "@/components/admin/mu/MuShell";
import { formatDateTime } from "@/lib/format";
import {
  assessmentStatusLabel, assessmentStatusTone, assessorOptions, clientAssessments,
  liveAssessment, locationLabel, LOCATION_KINDS,
  type AssessmentWork, type AssessorOption,
} from "@/lib/care-assessment";

interface HistoryRow { id: string; event: string; detail: Record<string, unknown>; created_at: string }

const EVENT_LABELS: Record<string, string> = {
  scheduled: "Visit arranged",
  rescheduled: "Visit moved",
  cancelled: "Visit cancelled",
  assigned: "Assessor assigned",
  reassigned: "Assessor changed",
  started: "Assessment opened",
  submitted: "Assessment sent",
};

const AssessmentSection = ({
  clientId, canArrange, preAssessmentReturned, onChanged,
}: {
  clientId: string;
  canArrange: boolean;
  preAssessmentReturned: boolean;
  onChanged?: () => void;
}) => {
  const [rows, setRows] = useState<AssessmentWork[]>([]);
  const [assessors, setAssessors] = useState<AssessorOption[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState("");
  const [locationKind, setLocationKind] = useState("home");
  const [notes, setNotes] = useState("");
  const [moveReason, setMoveReason] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assessorId, setAssessorId] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await clientAssessments(clientId);
      setRows(list);
      const live = liveAssessment(list);
      if (live) {
        const { data } = await adminDb()
          .from("care_assessment_events").select("*").eq("assessment_id", live.id)
          .order("created_at", { ascending: false }).limit(20);
        setHistory((data ?? []) as unknown as HistoryRow[]);
      } else {
        setHistory([]);
      }
      const ids = list.map((r) => r.assessor_person_id).filter(Boolean) as string[];
      if (ids.length > 0) {
        const { data } = await adminDb().from("mu_people").select("id, full_name").in("id", ids);
        setNames(Object.fromEntries(((data ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name])));
      }
      if (canArrange) setAssessors(await assessorOptions());
    } catch {
      toast.error("Could not load the assessment");
    }
    setLoading(false);
  }, [clientId, canArrange]);

  useEffect(() => { void load(); }, [load]);

  const after = async (message: string) => {
    toast.success(message);
    await load();
    onChanged?.();
  };

  const live = liveAssessment(rows);
  const assessorName = (id: string | null) => (id ? names[id] ?? "Assessor" : "No assessor assigned");

  const schedule = async () => {
    if (!when) return;
    const payload = {
      _client_id: clientId,
      _appointment_at: new Date(when).toISOString(),
      _appointment_ends_at: null,
      _location_kind: locationKind,
      _notes: notes.trim() || null,
    };
    const { error } = live
      ? await adminDb().rpc("care_assessment_reschedule", {
          _id: live.id,
          _appointment_at: payload._appointment_at,
          _appointment_ends_at: null,
          // Why the visit moved is an audit fact. What the assessor needs to
          // know on the day is a separate one, and neither stands in for the
          // other.
          _reason: moveReason.trim() || null,
          _location_kind: locationKind,
          _notes: notes,
        })
      : await adminDb().rpc("care_assessment_schedule", payload);
    if (error) {
      toast.error(careErrorMessage(error, live
        ? "We couldn't move the visit. Try again."
        : "We couldn't arrange the visit. Try again."));
      return;
    }
    setScheduling(false);
    setWhen("");
    setNotes("");
    setMoveReason("");
    void after(live ? "Visit moved" : "Visit arranged");
  };

  const assign = async () => {
    if (!live || !assessorId) return;
    const { error } = await adminDb().rpc("care_assessment_assign", {
      _id: live.id, _assessor_person_id: assessorId, _reason: null,
    });
    if (error) { toast.error(careErrorMessage(error, "We couldn't assign the assessor. Try again.")); return; }
    setAssigning(false);
    setAssessorId("");
    void after("Assessor assigned");
  };

  const cancel = async () => {
    if (!live) return;
    const { error } = await adminDb().rpc("care_assessment_cancel", { _id: live.id, _reason: cancelReason });
    if (error) { toast.error(careErrorMessage(error, "We couldn't cancel the visit. Try again.")); return; }
    setCancelling(false);
    setCancelReason("");
    void after("Visit cancelled");
  };

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading the assessment</p>;

  return (
    <>
      <MuSection
        title="Assessment"
        description="When the visit is, and who is carrying it out."
        actions={canArrange ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-10"
              disabled={!preAssessmentReturned}
              onClick={() => {
                setWhen(live?.appointment_at ? live.appointment_at.slice(0, 16) : "");
                setLocationKind(live?.location_kind ?? "home");
                setNotes(live?.notes ?? "");
                setMoveReason("");
                setScheduling(true);
              }}
            >
              {live ? "Move the visit" : "Arrange the visit"}
            </Button>
            {live && (
              <Button type="button" variant="outline" className="h-10" onClick={() => setAssigning(true)}>
                {live.assessor_person_id ? "Change assessor" : "Assign assessor"}
              </Button>
            )}
            {live && (
              <Button type="button" variant="outline" className="h-10" onClick={() => { setCancelReason(""); setCancelling(true); }}>
                Cancel visit
              </Button>
            )}
          </div>
        ) : undefined}
      >
        {!live ? (
          <MuEmpty
            title="No assessment arranged"
            description={preAssessmentReturned
              ? "Arrange the visit and assign an assessor."
              : "The pre-assessment has to come back before a visit can be arranged."}
          />
        ) : (
          <MuTable
            emptyLabel="Not set"
            rows={[
              { label: "State", value: <Status label={assessmentStatusLabel(live.status)} tone={assessmentStatusTone(live.status)} /> },
              { label: "Appointment", value: live.appointment_at ? formatDateTime(live.appointment_at) : "" },
              { label: "Where", value: locationLabel(live.location_kind) },
              { label: "Assessor", value: assessorName(live.assessor_person_id) },
              { label: "Notes for the assessor", value: live.notes ?? "" },
            ]}
          />
        )}
      </MuSection>

      {history.length > 0 && (
        <MuSection title="Assessment history" padded={false}>
          <div className="divide-y divide-line-soft">
            {history.map((row) => (
              <MuRow
                key={row.id}
                title={EVENT_LABELS[row.event] ?? row.event.replace(/_/g, " ")}
                state={formatDateTime(row.created_at)}
              />
            ))}
          </div>
        </MuSection>
      )}

      {rows.filter((r) => r.status === "cancelled" || r.status === "submitted").length > 0 && (
        <MuSection title="Earlier assessments" padded={false}>
          <div className="divide-y divide-line-soft">
            {rows.filter((r) => r.status === "cancelled" || r.status === "submitted").map((row) => (
              <MuRow
                key={row.id}
                title={row.appointment_at ? formatDateTime(row.appointment_at) : "No appointment recorded"}
                state={
                  <span className="flex flex-col gap-0.5">
                    <span>{assessorName(row.assessor_person_id)}</span>
                    {row.cancel_reason && <span>Reason: {row.cancel_reason}</span>}
                  </span>
                }
                status={<Status label={assessmentStatusLabel(row.status)} tone={assessmentStatusTone(row.status)} />}
              />
            ))}
          </div>
        </MuSection>
      )}

      <CareSheet
        open={scheduling}
        onOpenChange={setScheduling}
        title={live ? "Move the assessment visit" : "Arrange the assessment visit"}
        description="The family is expecting somebody at this time."
        onSave={schedule}
        saveDisabled={!when || (!!live && !moveReason.trim())}
      >
        <DateTimeField label="Appointment" value={when} onChange={setWhen} />
        {live && (
          <CareFormRow label="Why the visit is moving">
            <input className={cxInputClass()} value={moveReason} onChange={(e) => setMoveReason(e.target.value)} />
          </CareFormRow>
        )}
        <SelectField
          label="Where"
          value={locationKind}
          onChange={setLocationKind}
          options={LOCATION_KINDS.map((l) => ({ value: l.value, label: l.label }))}
        />
        <CareFormRow label="Notes for the assessor">
          <input className={cxInputClass()} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </CareFormRow>
      </CareSheet>

      <CareSheet
        open={assigning}
        onOpenChange={setAssigning}
        title="Assign an assessor"
        description="Only an approved assessor can be assigned."
        onSave={assign}
        saveLabel="Assign"
        saveDisabled={!assessorId}
      >
        {assessors.length === 0 ? (
          <p className="text-[14.5px] text-body">
            No approved assessors. Approve a professional as an assessor first.
          </p>
        ) : (
          <SearchableSelect
            label="Assessor"
            value={assessorId}
            onChange={setAssessorId}
            options={assessors.map((a) => ({
              value: a.person_id,
              label: a.profession ? `${a.full_name} (${a.profession})` : a.full_name,
            }))}
          />
        )}
      </CareSheet>

      <CareConfirm
        open={cancelling}
        onOpenChange={setCancelling}
        title="Cancel the assessment visit"
        description="Booking work comes back so the visit can be rearranged."
        confirmLabel="Cancel visit"
        confirmDisabled={!cancelReason.trim()}
        onConfirm={cancel}
      >
        <input
          className={cxInputClass()}
          aria-label="Why the visit is being cancelled"
          placeholder="Why is the visit not going ahead?"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </CareConfirm>
    </>
  );
};

export default AssessmentSection;
