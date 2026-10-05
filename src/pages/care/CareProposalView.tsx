// What the family sees of a care proposal, and what they can say back.
//
// The content itself is clinical: it only loads for a person who holds clinical
// access to this client and who this exact version was sent to. Anyone else
// sees the safe status only. Agreeing does not start care, issue a care plan
// or agree a price, and a new version carries no agreement forward.
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  FamilyCard, FamilyHeading, FamilyLoading, FamilyNote, FamilyShell, FamilyText,
  familyOnNavy, familyPrimary, familySecondary,
} from "@/components/care/FamilyShell";
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

// The care plan's section titles, so each part of the proposal is headed the
// way the care team wrote it. Families cannot read form definitions.
const SECTION_TITLES: Record<string, string> = {
  front_sheet: "About this plan",
  goals: "What we are trying to achieve",
  the_day: "The day",
  the_week: "The week",
  personal_care: "Personal care",
  moving_about: "Moving about",
  skin_food_continence: "Skin, food and continence",
  medicines: "Medicines",
  how_to_be: "How to be with this person",
  risks: "Risks and what we do about them",
  boundaries: "Boundaries",
  who_is_coming: "Who is coming",
  review: "Review",
  agreement: "Agreement",
};

const sectionTitle = (key: string) =>
  SECTION_TITLES[key] ?? (key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()));

const inputClass =
  "w-full rounded-[10px] border border-[#C9C5BC] bg-card px-4 py-3 text-[16px] text-ink placeholder:text-label focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

const CareProposalView = () => {
  const [params] = useSearchParams();
  const wanted = params.get("client");
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
      const first = mine.find((c) => c.client_id === wanted) ?? mine[0];
      if (first) {
        setClientId(first.client_id);
        await load(first.client_id);
      } else {
        setLoading(false);
      }
    })();
  }, [load, wanted]);

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

  const person = clients.find((c) => c.client_id === clientId);
  const earlier = rows.filter((r) => r.proposal_id !== current?.proposal_id);
  const parts = content
    ? Object.entries(content)
        .map(([key, value]) => ({
          key,
          note: typeof value === "object" && value !== null
            ? String((value as Record<string, unknown>).note ?? "")
            : String(value ?? ""),
        }))
        .filter((part) => part.note.trim() !== "")
    : [];

  return (
    <FamilyShell
      eyebrow="Care proposal"
      title={person ? `Proposed care for ${person.display_name}` : "Proposed care and support"}
      lead="This is what we propose after the assessment. It is not the final care plan, and nothing starts until we have spoken with you."
      path="/care/proposal"
      action={<Link to="/care" className={familyOnNavy}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Your care</Link>}
    >
      {clients.length > 1 && (
        <FamilyCard>
          <label className="block text-[14.5px] font-semibold text-ink" htmlFor="proposal-person">Who this is about</label>
          <select
            id="proposal-person"
            className={`${inputClass} mt-2 min-h-12`}
            value={clientId}
            onChange={(e) => { setClientId(e.target.value); void load(e.target.value); }}
          >
            {clients.map((c) => (
              <option key={c.client_id} value={c.client_id}>{c.display_name}</option>
            ))}
          </select>
        </FamilyCard>
      )}

      {loading ? (
        <FamilyCard><FamilyLoading label="Loading the care proposal" /></FamilyCard>
      ) : rows.length === 0 ? (
        <FamilyCard>
          <FamilyHeading>No proposal yet</FamilyHeading>
          <FamilyText className="mt-1">
            We write the proposal after the home care needs assessment. We will tell you when it is ready to read.
          </FamilyText>
        </FamilyCard>
      ) : !current ? (
        <FamilyCard>
          <FamilyHeading>This version has been replaced</FamilyHeading>
          <FamilyText className="mt-1">The proposal you were sent has been replaced or withdrawn. The care team will send the new one.</FamilyText>
        </FamilyCard>
      ) : content === null ? (
        <FamilyCard>
          <FamilyHeading>Version {current.version}</FamilyHeading>
          <FamilyText className="mt-1">
            A proposal was sent{current.sent_at ? ` on ${formatDateTime(current.sent_at)}` : ""}, but it is not shared
            with you. Ask the care team if you should be able to read it.
          </FamilyText>
        </FamilyCard>
      ) : (
        <>
          <FamilyCard>
            <span className="label-caps text-[11px] text-label">
              Version {current.version}{current.sent_at ? `, sent ${formatDateTime(current.sent_at)}` : ""}
            </span>
            <div className="mt-3 flex flex-col divide-y divide-hairline-warm">
              {parts.map((part) => (
                <div key={part.key} className="py-4 first:pt-1 last:pb-0">
                  <h2 className="text-[17px] font-semibold text-ink">{sectionTitle(part.key)}</h2>
                  <p className="mt-1.5 whitespace-pre-wrap text-[15.5px] leading-relaxed text-body">{part.note}</p>
                </div>
              ))}
            </div>
          </FamilyCard>

          <FamilyNote title="About cost">
            The cost is set out separately in your quotation.
          </FamilyNote>

          <FamilyCard>
            <FamilyHeading>What would you like to do?</FamilyHeading>
            <div className="mt-4 grid gap-2 sm:grid-cols-3" role="group" aria-label="Your reply">
              {RESPONSE_CHOICES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={choice === option.value}
                  onClick={() => setChoice(option.value)}
                  className={cn(
                    "min-h-12 rounded-[10px] px-4 text-[15px] font-semibold transition-colors",
                    choice === option.value
                      ? "border-[1.5px] border-brand bg-tint text-navy"
                      : "border border-hairline-warm bg-card text-ink hover:border-brand/50",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {choice && (
              <label className="mt-4 block">
                <span className="text-[14.5px] font-semibold text-ink">
                  {choice === "changes_requested" ? "What should change?" : "Anything you want to add (optional)"}
                </span>
                <textarea
                  className={`${inputClass} mt-2 min-h-28`}
                  placeholder={choice === "changes_requested" ? "Tell us what should change" : "If you like"}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </label>
            )}
            {needsComment && <p className="mt-2 text-[14px] text-warn-ink">Tell us what should change before you send.</p>}

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={familyPrimary} disabled={busy || !choice || needsComment} onClick={() => void respond()}>
                Send my reply
              </button>
              {choice && (
                <button type="button" className={familySecondary} onClick={() => { setChoice(""); setComment(""); }}>
                  Cancel
                </button>
              )}
            </div>
            <FamilyText className="mt-4 text-[14px]">
              Agreeing applies to this version only. It does not start care or agree a price.
            </FamilyText>
          </FamilyCard>
        </>
      )}

      {!loading && earlier.length > 0 && (
        <FamilyCard>
          <FamilyHeading>Earlier versions</FamilyHeading>
          <ul className="mt-2 flex flex-col gap-1">
            {earlier.map((row) => (
              <li key={row.proposal_id} className="text-[14.5px] text-body">
                Version {row.version}: {(proposalStatusLabel[row.status] ?? row.status).toLowerCase()}
                {row.responded_at ? `, you replied on ${formatDateTime(row.responded_at)}` : ""}
              </li>
            ))}
          </ul>
        </FamilyCard>
      )}
    </FamilyShell>
  );
};

export default CareProposalView;
