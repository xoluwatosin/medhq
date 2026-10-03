// What the family sees of a care proposal, and what they can say back.
//
// The content itself is clinical: it only loads for a person who holds clinical
// access to this client and who this exact version was sent to. Anyone else
// sees the safe status only. Agreeing does not start care, issue a care plan
// or agree a price, and a new version carries no agreement forward.
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import { cxInputClass } from "@/components/candidate/primitives";
import { supabase } from "@/integrations/supabase/client";
import { careErrorMessage } from "@/lib/care-errors";
import { formatDateTime } from "@/lib/format";
import {
  proposalStatusLabel, RESPONSE_CHOICES, respondToProposal,
  type ProposalResponseKind, type ProposalStatusRow,
} from "@/lib/care-proposal";
import { cn } from "@/lib/utils";

interface MyClient {
  client_id: string;
  client_reference: string;
  display_name: string;
}

const primary =
  "cx-control min-h-11 bg-navy px-4 text-[14px] font-bold text-white hover:bg-navy/90 disabled:opacity-50";
const ghost =
  "cx-control min-h-11 border border-line bg-white px-4 text-[14px] font-bold text-ink hover:bg-desk/60 disabled:opacity-50";

const CareProposalView = () => {
  const [clients, setClients] = useState<MyClient[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [rows, setRows] = useState<ProposalStatusRow[]>([]);
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<ProposalResponseKind | "">("");
  const [comment, setComment] = useState("");

  const current = useMemo(() => rows.find((r) => r.status === "sent") ?? null, [rows]);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("care_proposal_status", { _client_id: id });
      if (error) throw error;
      const held = (data ?? []) as unknown as ProposalStatusRow[];
      setRows(held);

      const sent = held.find((r) => r.status === "sent");
      if (sent) {
        // Readable only with clinical access to this client and this exact send.
        const { data: body } = await supabase
          .from("care_proposals").select("content").eq("id", sent.proposal_id).maybeSingle();
        setContent((body as { content?: Record<string, unknown> } | null)?.content ?? null);
      } else {
        setContent(null);
      }
    } catch (error) {
      toast.error(careErrorMessage(error, "We could not load your care proposal."));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc("care_my_clients");
      const mine = (data ?? []) as unknown as MyClient[];
      setClients(mine);
      if (mine[0]) {
        setClientId(mine[0].client_id);
        await load(mine[0].client_id);
      } else {
        setLoading(false);
      }
    })();
  }, [load]);

  const respond = async () => {
    if (!current || !choice) return;
    setBusy(true);
    try {
      await respondToProposal(current.proposal_id, choice, comment);
      toast.success("Thank you. We have recorded what you said.");
      setChoice(""); setComment("");
      await load(clientId);
    } catch (error) {
      toast.error(careErrorMessage(error, "We could not record that. Try again."));
    }
    setBusy(false);
  };

  const needsComment = choice === "changes_requested" && comment.trim() === "";

  return (
    <div className="min-h-dvh bg-desk">
      <MedicHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink">Proposed care and support</h1>
        <p className="mt-2 text-[15px] text-body">
          This is what we propose. It is not the final care plan, and nothing starts until we have spoken.
        </p>

        {clients.length > 1 && (
          <label className="mt-5 block text-[14px] font-bold text-ink">
            Who this is about
            <select
              className={cn(cxInputClass(), "mt-1")}
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); void load(e.target.value); }}
            >
              {clients.map((c) => (
                <option key={c.client_id} value={c.client_id}>{c.display_name}</option>
              ))}
            </select>
          </label>
        )}

        {loading && <p className="mt-8 text-[15px] text-body">Loading.</p>}

        {!loading && rows.length === 0 && (
          <p className="mt-8 text-[15px] text-body">There is no care proposal to read yet.</p>
        )}

        {!loading && rows.length > 0 && (
          <section className="mt-8 border border-line bg-white p-5">
            <h2 className="text-[18px] font-bold text-ink">
              {current ? `Version ${current.version}` : "No current version"}
            </h2>
            <p className="mt-1 text-[13.5px] text-body">
              {current
                ? `${proposalStatusLabel.sent}${current.sent_at ? ` on ${formatDateTime(current.sent_at)}` : ""}`
                : "The version you were sent has been replaced or withdrawn."}
            </p>

            {current && content === null && (
              <p className="mt-4 text-[15px] text-body">
                You can see that a proposal was sent, but not what it says. Ask the care team for access.
              </p>
            )}

            {current && content && (
              <div className="mt-4 flex flex-col gap-4">
                {Object.entries(content).map(([key, value]) => {
                  const note = typeof value === "object" && value !== null
                    ? String((value as Record<string, unknown>).note ?? "")
                    : String(value ?? "");
                  if (!note.trim()) return null;
                  return (
                    <div key={key}>
                      <p className="whitespace-pre-wrap text-[15px] text-ink">{note}</p>
                    </div>
                  );
                })}
                <p className="text-[13.5px] text-body">
                  Costs are set out separately in your quotation.
                </p>
              </div>
            )}

            {current && content && (
              <div className="mt-6 border-t border-line-soft pt-5">
                <p className="text-[15px] font-bold text-ink">What would you like to do?</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {RESPONSE_CHOICES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={choice === option.value}
                      onClick={() => setChoice(option.value)}
                      className={cn(
                        "cx-control min-h-11 px-4 text-[14.5px] font-bold transition-colors",
                        choice === option.value
                          ? "border-[1.5px] border-navy bg-tint text-navy"
                          : "border border-line bg-white text-ink hover:bg-desk/60",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {choice && (
                  <textarea
                    className={cn(cxInputClass(), "mt-3 min-h-24")}
                    aria-label={choice === "changes_requested" ? "What should change" : "Anything you want to add"}
                    placeholder={choice === "changes_requested"
                      ? "Tell us what should change"
                      : "Anything you want to add, if you like"}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button" className={primary}
                    disabled={busy || !choice || needsComment}
                    onClick={() => void respond()}
                  >
                    Send
                  </button>
                  {choice && (
                    <button type="button" className={ghost} onClick={() => { setChoice(""); setComment(""); }}>
                      Cancel
                    </button>
                  )}
                </div>
                {needsComment && (
                  <p className="mt-2 text-[13.5px] text-warn-ink">Tell us what should change.</p>
                )}
                <p className="mt-3 text-[13.5px] text-body">
                  Agreeing applies to this version only. It does not start care or agree a price.
                </p>
              </div>
            )}

            {rows.length > 1 && (
              <div className="mt-6 border-t border-line-soft pt-4">
                <p className="text-[14px] font-bold text-ink">Earlier versions</p>
                {rows.filter((r) => r.proposal_id !== current?.proposal_id).map((row) => (
                  <p key={row.proposal_id} className="mt-1 text-[13.5px] text-body">
                    Version {row.version} · {proposalStatusLabel[row.status] ?? row.status}
                    {row.responded_at ? ` · you replied on ${formatDateTime(row.responded_at)}` : ""}
                  </p>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default CareProposalView;
