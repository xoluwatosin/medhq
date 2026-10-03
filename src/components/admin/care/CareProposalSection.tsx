// The care proposal: what the family is actually sent.
//
// It is prepared from the care plan by the server, which leaves internal risk
// and safeguarding material out. Once it has been sent it is a record: it is
// replaced by a new version rather than edited.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CareSheet } from "@/components/admin/care/CareSurface";
import { cxInputClass } from "@/components/candidate/primitives";
import { adminDb } from "@/lib/admin-utils";
import { careErrorMessage } from "@/lib/care-errors";
import { MuEmpty, MuRow, MuSection, MuTable } from "@/components/admin/mu/MuShell";
import { Status } from "@/components/field";
import { formatDateTime } from "@/lib/format";
import {
  clientProposals, commentOnProposal, draftProposal, proposalComments, proposalParts,
  proposalRecipients, proposalSends, proposalStatusLabel, proposalStatusTone, sendProposal,
  withdrawProposal,
  type Proposal, type ProposalComment, type ProposalSend,
} from "@/lib/care-proposal";
import { clientPlans, currentPlan, planIsApproved } from "@/lib/care-plan";

import { cn } from "@/lib/utils";

const carePrimary =
  "cx-control min-h-11 bg-navy px-4 text-[14px] font-bold text-white hover:bg-navy/90 disabled:opacity-50";
const careGhost =
  "cx-control min-h-11 border border-line bg-white px-4 text-[14px] font-bold text-ink hover:bg-desk/60 disabled:opacity-50";

type Reader = { person_id: string; name: string };

const CareProposalSection = ({
  clientId, canPrepare, onChanged,
}: {
  clientId: string;
  canPrepare: boolean;
  onChanged?: () => void;
}) => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [current, setCurrent] = useState<Proposal | null>(null);
  const [parts, setParts] = useState<{ id: string; title: string; note: string }[]>([]);
  const [sends, setSends] = useState<ProposalSend[]>([]);
  const [comments, setComments] = useState<ProposalComment[]>([]);
  const [readers, setReaders] = useState<Reader[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [planApproved, setPlanApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, plans] = await Promise.all([clientProposals(clientId), clientPlans(clientId)]);
      const activePlan = currentPlan(plans);
      setPlanApproved(activePlan ? await planIsApproved(activePlan.id) : false);
      setProposals(rows);
      const latest = rows[0] ?? null;
      setCurrent(latest);

      if (latest) {
        const plan = await adminDb()
          .from("care_documents").select("form_definition_id")
          .eq("id", latest.plan_document_id).maybeSingle();
        setParts(await proposalParts(
          latest.content ?? {},
          String((plan.data as { form_definition_id?: string } | null)?.form_definition_id ?? ""),
        ));
        setSends(await proposalSends(latest.id));
        setComments(await proposalComments(latest.id));
      } else {
        setParts([]); setSends([]); setComments([]);
      }

      // Only people who hold clinical access to this client can be sent a
      // proposal. Journey access on its own is not enough to read one.
      const eligible = await proposalRecipients(clientId);
      setReaders(eligible
        .map((row) => ({ person_id: row.person_id, name: row.full_name ?? "Name not recorded" })));

    } catch {
      toast.error("Could not load the care proposal");
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  const run = async (work: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await work();
      toast.success(done);
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(careErrorMessage(error, "That did not go through. Try again."));
    }
    setBusy(false);
  };

  if (loading) return <MuSection title="Care proposal"><MuEmpty title="Loading" /></MuSection>;

  const draft = current?.status === "draft";

  return (
    <>
      <MuSection
        title="Care proposal"
        description="This is the version the family reads. Risks and safeguarding notes stay on the operational plan."
        actions={current
          ? <Status label={proposalStatusLabel[current.status]} tone={proposalStatusTone(current.status)} />
          : null}
      >
        {!current && (
          <MuEmpty
            title="No care proposal"
            description={planApproved ? "Prepare one from the approved working plan." : "Approve the current working plan before preparing a client proposal."}
          />
        )}

        {current && (
          <MuTable
            rows={[
              { label: "Version", value: `Version ${current.version}` },
              { label: "Prepared", value: formatDateTime(current.created_at) },
              { label: "Sent", value: current.sent_at ? formatDateTime(current.sent_at) : "" },
              { label: "People sent to", value: String(sends.length) },
            ]}
          />
        )}

        {canPrepare && (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
               type="button" className={carePrimary} disabled={busy || !planApproved}
              onClick={() => void run(() => draftProposal(clientId), "Care proposal prepared")}
            >
              {current ? "Rebuild from the care plan" : "Prepare care proposal"}
            </button>
            {current && current.status !== "withdrawn" && (
              <button type="button" className={careGhost} disabled={busy} onClick={() => setSending(true)}>
                {draft ? "Send to family" : "Send to another person"}
              </button>
            )}
            {current && current.status === "sent" && (
              <button type="button" className={careGhost} disabled={busy} onClick={() => setWithdrawing(true)}>
                Withdraw proposal
              </button>
            )}
          </div>
        )}
        {!canPrepare && (
          <p className="mt-5 text-[13.5px] text-body">Only coordinators can prepare or send a care proposal.</p>
        )}
      </MuSection>

      {current && (
        <MuSection title="What the family reads" padded={false}>
          {parts.length === 0
            ? <MuEmpty title="Nothing written yet" description="The care plan sections are still empty." />
            : (
              <div className="divide-y divide-line-soft">
                {parts.map((part) => (
                  <div key={part.id} className="px-5 py-4">
                    <p className="text-[14px] font-bold text-ink">{part.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-[14px] text-body">{part.note}</p>
                  </div>
                ))}
              </div>
            )}
        </MuSection>
      )}

      {current && (
        <MuSection title="Sent to" padded={false}>
          {sends.length === 0
            ? <MuEmpty title="Not sent yet" />
            : (
              <div className="divide-y divide-line-soft">
                {sends.map((send) => (
                  <MuRow
                    key={send.id}
                    title={readers.find((r) => r.person_id === send.person_id)?.name ?? "Person on the record"}
                    state={formatDateTime(send.sent_at)}
                  />
                ))}
              </div>
            )}
        </MuSection>
      )}

      {current && (
        <MuSection title="Comments" description="What the family said about this proposal, and the replies.">
          {comments.length === 0
            ? <MuEmpty title="No comments" />
            : (
              <div className="flex flex-col gap-3">
                {comments.map((row) => (
                  <div key={row.id} className="rounded-none border border-line bg-white p-3">
                    <p className="text-[13px] text-body">{formatDateTime(row.created_at)}</p>
                    <p className="mt-1 whitespace-pre-wrap text-[14px] text-ink">{row.body}</p>
                  </div>
                ))}
              </div>
            )}

          {canPrepare && (
            <div className="mt-4">
              <textarea
                className={cn(cxInputClass(), "min-h-20")}
                aria-label="Reply to the family"
                placeholder="Reply to the family"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button
                type="button" className={`${carePrimary} mt-2`} disabled={busy || comment.trim() === ""}
                onClick={() => void run(async () => {
                  await commentOnProposal(current.id, comment);
                  setComment("");
                }, "Comment added")}
              >
                Add comment
              </button>
            </div>
          )}
        </MuSection>
      )}

      {proposals.length > 1 && (
        <MuSection title="Earlier versions" padded={false}>
          <div className="divide-y divide-line-soft">
            {proposals.slice(1).map((row) => (
              <MuRow
                key={row.id}
                title={`Version ${row.version}`}
                state={`${proposalStatusLabel[row.status]} · ${formatDateTime(row.sent_at ?? row.created_at)}`}
              />
            ))}
          </div>
        </MuSection>
      )}

      <CareSheet
        open={sending}
        onOpenChange={(open) => { setSending(open); if (!open) setChosen([]); }}
        title="Send the care proposal"
        description="Only people who hold clinical access to this client can be sent it."
      >
        {readers.length === 0
          ? <MuEmpty title="No one holds clinical access" description="Grant clinical access on the Access tab first." />

          : (
            <div className="flex flex-col gap-2">
              {readers.map((reader) => (
                <label key={reader.person_id} className="flex min-h-11 items-center gap-3 text-[14px] text-ink">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={chosen.includes(reader.person_id)}
                    onChange={(e) => setChosen((prev) => e.target.checked
                      ? [...prev, reader.person_id]
                      : prev.filter((id) => id !== reader.person_id))}
                  />
                  {reader.name}
                </label>
              ))}
            </div>
          )}
        <button
          type="button" className={`${carePrimary} mt-4`}
          disabled={busy || chosen.length === 0 || !current}
          onClick={() => void run(async () => {
            await sendProposal(current!.id, chosen);
            setChosen([]); setSending(false);
          }, "Care proposal sent")}
        >
          Send proposal
        </button>
      </CareSheet>

      <CareSheet
        open={withdrawing}
        onOpenChange={(open) => { setWithdrawing(open); if (!open) setReason(""); }}
        title="Withdraw the care proposal"
        description="The family will no longer be able to open it. Say why."
      >
        <textarea
          className={cn(cxInputClass(), "min-h-24")}
          aria-label="Reason for withdrawing"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button
          type="button" className={`${carePrimary} mt-4`}
          disabled={busy || reason.trim() === "" || !current}
          onClick={() => void run(async () => {
            await withdrawProposal(current!.id, reason);
            setReason(""); setWithdrawing(false);
          }, "Care proposal withdrawn")}
        >
          Withdraw proposal
        </button>
      </CareSheet>
    </>
  );
};

export default CareProposalSection;
