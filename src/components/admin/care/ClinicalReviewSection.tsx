// Clinical review of a sent assessment.
//
// A review belongs to one sent version. The checklist on screen is the
// checklist of the version being read, and the reviews of earlier versions are
// shown as history rather than merged into it. The sent record is never edited
// here. A reviewer with clinical authority either accepts it, which opens the
// care plan and the package work, or returns it with a category, a reason,
// instructions and a priority, which gives the assessor a fresh draft.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CareConfirm, CareField as CareFormRow, careGhost, carePrimary } from "@/components/admin/care/CareSurface";
import AssessmentRecordView from "@/components/admin/care/AssessmentRecordView";
import { cxInputClass } from "@/components/candidate/primitives";
import { adminDb } from "@/lib/admin-utils";
import { careErrorMessage } from "@/lib/care-errors";
import { MuEmpty, MuSection, MuTable } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { Status } from "@/components/field";
import { formatDateTime } from "@/lib/format";
import {
  assessmentRecord, checkNeedsNote, checklistAllowsAccept, checklistDecided, checklistNotesComplete,
  CHECK_DECISIONS, clientAssessments, readConfirm, RETURN_CATEGORIES, RETURN_PRIORITIES,
  REVIEW_CHECKS, returnAssessment, returnReady, reviewRecord, saveReviewChecklist,
  type AssessmentRecord, type AssessmentReview, type AssessmentWork, type CheckDecision,
  type ReturnCategory, type ReturnPriority, type ReviewChecklist,
} from "@/lib/care-assessment";
import { cn } from "@/lib/utils";

interface DocRow {
  id: string;
  status: string;
  version: number | null;
  submitted_at: string | null;
}

const reviewState = (review: AssessmentReview | null): { label: string; tone: "good" | "warning" | "info" } => {
  if (review?.status === "accepted") return { label: "Accepted", tone: "good" };
  if (review?.status === "returned") return { label: "Returned for clarification", tone: "warning" };
  return { label: "Awaiting review", tone: "info" };
};

const categoryLabel = (value: string | null) =>
  RETURN_CATEGORIES.find((c) => c.value === value)?.label ?? "";

const priorityLabel = (value: string | null) =>
  RETURN_PRIORITIES.find((p) => p.value === value)?.label ?? "";

const ClinicalReviewSection = ({
  clientId, canReview, onChanged,
}: {
  clientId: string;
  canReview: boolean;
  onChanged?: () => void;
}) => {
  const [work, setWork] = useState<AssessmentWork | null>(null);
  const [record, setRecord] = useState<AssessmentRecord | null>(null);
  const [review, setReview] = useState<AssessmentReview | null>(null);
  const [history, setHistory] = useState<AssessmentReview[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [returning, setReturning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checklist, setChecklist] = useState<ReviewChecklist>({});

  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<ReturnCategory | "">("");
  const [instructions, setInstructions] = useState("");
  const [priority, setPriority] = useState<ReturnPriority>("routine");

  const clearReturn = () => {
    setReason(""); setCategory(""); setInstructions(""); setPriority("routine");
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await clientAssessments(clientId);
      const latest = rows[0] ?? null;
      setWork(latest);
      setRecord(latest ? await assessmentRecord(latest.id) : null);

      // The checklist comes from the review bound to the version being read.
      if (latest) {
        const held = await reviewRecord(latest.id);
        setReview(held.current);
        setHistory(held.history);
        setChecklist(held.current?.checklist ?? {});
      } else {
        setReview(null); setHistory([]); setChecklist({});
      }

      const { data } = await adminDb()
        .from("care_documents")
        .select("id, status, version, submitted_at")
        .eq("client_id", clientId).eq("kind", "assessment")
        .order("created_at", { ascending: false });
      setDocs((data ?? []) as unknown as DocRow[]);
    } catch {
      toast.error("Could not load the assessment for review");
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  const responses = record?.document.responses ?? {};
  const decided = Object.entries(responses)
    .filter(([key, value]) => key.startsWith("confirm.") && readConfirm(value)).length;
  const amended = Object.entries(responses)
    .filter(([key, value]) => key.startsWith("confirm.") && readConfirm(value)?.decision === "amended").length;

  const awaiting = work?.status === "submitted" && review?.status === "open";

  /** A check is held as soon as it is decided, so no review work is lost. */
  const setCheck = async (key: string, patch: { decision?: CheckDecision; note?: string }) => {
    if (!work) return;
    const next: ReviewChecklist = { ...checklist, [key]: { ...checklist[key], ...patch } };
    setChecklist(next);
    if (checkNeedsNote(next[key])) return; // Held once the note is written.
    try {
      await saveReviewChecklist(work.id, next);
    } catch (error) {
      toast.error(careErrorMessage(error, "We couldn't record that check. Try again."));
    }
  };

  const accept = async () => {
    if (!work) return;
    setBusy(true);
    const { error } = await adminDb().rpc("care_assessment_accept", { _id: work.id });
    setBusy(false);
    if (error) {
      toast.error(careErrorMessage(error, "We couldn't accept the assessment. Try again."));
      return;
    }
    setAccepting(false);
    toast.success("Assessment accepted");
    await load();
    onChanged?.();
  };

  const returnForClarification = async () => {
    if (!work || !category) return;
    setBusy(true);
    try {
      await returnAssessment(work.id, { reason, category, instructions, priority });
      setReturning(false);
      clearReturn();
      toast.success("Assessment returned for clarification");
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(careErrorMessage(error, "We couldn't return the assessment. Try again."));
    }
    setBusy(false);
  };

  if (loading) return <MuSection title="Clinical review"><p className="text-sm text-body">Loading.</p></MuSection>;

  if (!work || !record) {
    return (
      <MuSection title="Clinical review">
        <MuEmpty art={art.objClipboardChecks} title="No assessment to review" description="A review opens once an assessor sends an assessment." />
      </MuSection>
    );
  }

  const state = reviewState(review);
  const notesComplete = checklistNotesComplete(checklist);

  return (
    <div className="flex flex-col gap-4">
      <MuSection
        title="Clinical review"
        description="Shown as sent. Not edited here."
        actions={<Status label={state.label} tone={state.tone} />}
      >
        <MuTable
          rows={[
            { label: "Assessor", value: record.author ?? "Not recorded" },
            { label: "Sent", value: record.document.submitted_at ? formatDateTime(record.document.submitted_at) : "" },
            { label: "Version", value: record.document.version ? `Version ${record.document.version}` : "" },
            { label: "Carried answers decided", value: String(decided) },
            { label: "Carried answers amended", value: String(amended) },
            { label: "Reviewed", value: review?.completed_at ? formatDateTime(review.completed_at) : "" },
            { label: "Reason given", value: review?.decision_reason ?? "" },
            { label: "Return category", value: categoryLabel(review?.return_category ?? null) },
            { label: "Instructions", value: review?.return_instructions ?? "" },
            { label: "Priority", value: priorityLabel(review?.return_priority ?? null) },
          ]}
        />

        {canReview && awaiting && (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className={carePrimary}
              disabled={!checklistAllowsAccept(checklist) || !notesComplete}
              title={!checklistAllowsAccept(checklist) ? "Decide every check first. A check not met is returned, not accepted." : undefined}
              onClick={() => setAccepting(true)}
            >
              Accept assessment
            </button>
            <button type="button" className={careGhost} onClick={() => setReturning(true)}>
              Return for clarification
            </button>
          </div>
        )}
        {!canReview && awaiting && (
          <p className="mt-5 text-[13.5px] text-body">Only clinical staff can accept or return an assessment.</p>
        )}
      </MuSection>

      <MuSection
        title="Review checklist"
        actions={
          <Status
            label={`${checklistDecided(checklist)} of ${REVIEW_CHECKS.length} decided`}
            tone={checklistAllowsAccept(checklist) ? "good" : "warning"}
          />
        }
        padded={false}
      >
        <div className="divide-y divide-line-soft">
          {REVIEW_CHECKS.map((check) => {
            const held = checklist[check.key] ?? {};
            const needsNote = checkNeedsNote(held);
            return (
              <div key={check.key} className="px-5 py-4">
                <p className="text-[14px] font-bold text-ink">{check.label}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CHECK_DECISIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!canReview || !awaiting}
                      aria-pressed={held.decision === option.value}
                      onClick={() => void setCheck(check.key, { decision: option.value })}
                      className={cn(
                        "cx-control min-h-11 px-4 text-[14px] font-bold transition-colors disabled:opacity-50",
                        held.decision === option.value
                          ? "border-[1.5px] border-navy bg-tint text-navy"
                          : "border border-line bg-white text-ink hover:bg-desk/60",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {canReview && awaiting && (
                  <>
                    <textarea
                      className={`${cxInputClass()} mt-2 min-h-16`}
                      aria-label={`Note on: ${check.label}`}
                      placeholder={held.decision === "not_met" ? "Say what is wrong" : "Note, if one is needed"}
                      defaultValue={held.note ?? ""}
                      onBlur={(e) => void setCheck(check.key, { note: e.target.value })}
                    />
                    {needsNote && (
                      <p className="mt-1 text-[13px] text-warn-ink">
                        Say what is wrong before this is saved.
                      </p>
                    )}
                  </>
                )}
                {(!canReview || !awaiting) && held.note?.trim() && (
                  <p className="mt-2 whitespace-pre-wrap text-[13.5px] text-body">{held.note}</p>
                )}
              </div>
            );
          })}
        </div>
      </MuSection>

      <AssessmentRecordView record={record} />

      {history.length > 0 && (
        <MuSection
          title="Earlier reviews"
          padded={false}
        >
          <div className="divide-y divide-line-soft">
            {history.map((row) => (
              <div key={row.id} className="px-5 py-4">
                <p className="text-[14px] font-bold text-ink">
                  {row.status === "accepted" ? "Accepted" : row.status === "returned" ? "Returned" : "Open"}
                  {row.completed_at ? ` on ${formatDateTime(row.completed_at)}` : ""}
                </p>
                {row.decision_reason && (
                  <p className="mt-1 whitespace-pre-wrap text-[13.5px] text-body">{row.decision_reason}</p>
                )}
                {row.return_category && (
                  <p className="mt-1 text-[13px] text-body">
                    {categoryLabel(row.return_category)}
                    {row.return_priority ? `, ${priorityLabel(row.return_priority)}` : ""}
                  </p>
                )}
                {row.return_instructions && (
                  <p className="mt-1 whitespace-pre-wrap text-[13.5px] text-body">{row.return_instructions}</p>
                )}
                <p className="mt-1 text-[13px] text-body">
                  {REVIEW_CHECKS.filter((c) => row.checklist?.[c.key]?.decision).length} of {REVIEW_CHECKS.length} checks decided
                </p>
              </div>
            ))}
          </div>
        </MuSection>
      )}

      {docs.length > 1 && (
        <MuSection title="Earlier versions">
          <MuTable
            rows={docs
              .filter((d) => d.status !== "draft")
              .map((d) => ({
                label: d.version ? `Version ${d.version}` : "Version not set yet",
                value: `${d.status === "submitted" ? "Current" : "Superseded"}${d.submitted_at ? `, sent ${formatDateTime(d.submitted_at)}` : ""}`,
              }))}
          />
        </MuSection>
      )}

      <CareConfirm
        open={accepting}
        onOpenChange={setAccepting}
        title="Accept this assessment"
        description="The care plan draft and the package work open together. The sent assessment stays on the record."
        confirmLabel={busy ? "Accepting" : "Accept assessment"}
        confirmDisabled={busy}
        onConfirm={accept}
        keepLabel="Not yet"
      />

      <CareConfirm
        open={returning}
        onOpenChange={(open) => { setReturning(open); if (!open) clearReturn(); }}
        title="Return for clarification"
        description="The assessor gets a fresh draft to work on. What was sent stays exactly as it was sent."
        confirmLabel={busy ? "Returning" : "Return assessment"}
        confirmDisabled={busy || !returnReady({ reason, category: category || undefined, instructions, priority })}
        onConfirm={returnForClarification}
        keepLabel="Cancel"
      >
        <CareFormRow label="Return category">
          <select
            className={cxInputClass()}
            value={category}
            onChange={(e) => setCategory(e.target.value as ReturnCategory)}
          >
            <option value="">Choose a category</option>
            {RETURN_CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </CareFormRow>

        <CareFormRow label="Reason">
          <textarea
            className={`${cxInputClass()} min-h-20`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </CareFormRow>

        <CareFormRow label="Instructions to the assessor">
          <textarea
            className={`${cxInputClass()} min-h-20`}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </CareFormRow>

        <CareFormRow label="Priority">
          <select
            className={cxInputClass()}
            value={priority}
            onChange={(e) => setPriority(e.target.value as ReturnPriority)}
          >
            {RETURN_PRIORITIES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </CareFormRow>
      </CareConfirm>
    </div>
  );
};

export default ClinicalReviewSection;
