// What the family sees of a care proposal, and what they can say back.
//
// The content itself is clinical: it only loads for a person who holds clinical
// access to this client and who this exact version was sent to. Anyone else
// sees the safe status only. Agreeing does not start care, issue a care plan
// or agree a price, and a new version carries no agreement forward.
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, MessageSquareText, PhoneCall, Send } from "lucide-react";
import {
  FamilyCard, FamilyHeading, FamilyLoading, FamilyNote, FamilySection, FamilyShell, FamilyText,
  familyInput, familyOnNavy, familyPrimary, familySecondary,
} from "@/components/care/FamilyShell";
import { art } from "@/components/mc/art";
import { ClipArt, NotchTag } from "@/components/mc/brand";
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

const inputClass = `${familyInput} py-3`;

const CHOICE_ICONS: Record<ProposalResponseKind, typeof Check> = {
  agreed: Check,
  changes_requested: MessageSquareText,
  call_requested: PhoneCall,
};

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
      accent={[1]}
      art={art.charDoctor}
      lead="This is what we propose after the assessment. It is not the final care plan, and nothing starts until we have spoken with you."
      path="/care/proposal"
      action={<Link to="/care" className={familyOnNavy}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Your care</Link>}
    >
      {clients.length > 1 && (
        <FamilyCard>
          <label className="label-caps block text-[12px] text-label" htmlFor="proposal-person">Who this is about</label>
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
          <div className="flex items-center gap-5">
            <div className="min-w-0 flex-1">
              <FamilyHeading>No proposal yet</FamilyHeading>
              <FamilyText className="mt-2">
                We write the proposal after the care needs assessment. We will tell you when it is ready to read.
              </FamilyText>
            </div>
            <ClipArt src={art.objCarePlan} size={104} className="hidden sm:block" />
          </div>
        </FamilyCard>
      ) : !current ? (
        <FamilyCard>
          <FamilyHeading>This version has been replaced</FamilyHeading>
          <FamilyText className="mt-2">The proposal you were sent has been replaced or withdrawn. The care team will send the new one.</FamilyText>
        </FamilyCard>
      ) : content === null ? (
        <FamilyCard>
          <FamilyHeading>Version {current.version}</FamilyHeading>
          <FamilyText className="mt-2">
            A proposal was sent{current.sent_at ? ` on ${formatDateTime(current.sent_at)}` : ""}, but it is not shared
            with you. Ask the care team if you should be able to read it.
          </FamilyText>
        </FamilyCard>
      ) : (
        <>
          <FamilyCard>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="inline-flex"><NotchTag tone="navy" size="sm">Version {current.version}</NotchTag></span>
              {current.sent_at && <span className="text-[13.5px] text-body">Sent {formatDateTime(current.sent_at)}</span>}
            </div>
            <ol className="mt-5 flex flex-col">
              {parts.map((part, i) => (
                <li key={part.key} className="flex gap-4 border-t-2 border-tint py-5 first:border-t-0 first:pt-1 last:pb-0">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center bg-navy text-[13px] font-extrabold tabular-nums text-white"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[18px] font-extrabold leading-tight tracking-[-0.02em] text-navy">{sectionTitle(part.key)}</h2>
                    <p className="mt-2 whitespace-pre-wrap text-[15.5px] leading-[1.65] text-body">{part.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </FamilyCard>

          <FamilyNote title="About cost" art={art.objPriceTagNaira}>
            The cost is set out separately in your quotation.
          </FamilyNote>

          <FamilyCard className="shadow-offset-blue">
            <FamilyHeading>What would you like to do?</FamilyHeading>
            <div className="mt-5 grid gap-3 sm:grid-cols-3" role="group" aria-label="Your reply">
              {RESPONSE_CHOICES.map((option) => {
                const Icon = CHOICE_ICONS[option.value];
                const on = choice === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setChoice(option.value)}
                    className={cn(
                      "flex min-h-14 items-center gap-3 border-2 border-navy px-4 text-left text-[15px] font-extrabold transition-all duration-150",
                      on
                        ? "translate-x-[2px] translate-y-[2px] bg-brand text-white"
                        : "bg-card text-navy shadow-offset-sm hover:bg-tint",
                    )}
                  >
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center", on ? "bg-white text-brand" : "bg-tint text-navy")}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    {option.label}
                  </button>
                );
              })}
            </div>

            {choice && (
              <label className="mt-5 block">
                <span className="label-caps block text-[12px] text-label">
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

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className={familyPrimary} disabled={busy || !choice || needsComment} onClick={() => void respond()}>
                <Send className="h-4 w-4" aria-hidden="true" /> Send my reply
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
        <FamilySection label="Earlier versions">
          <ul className="flex flex-col gap-2">
            {earlier.map((row) => (
              <li key={row.proposal_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-2 border-tint-deep bg-card px-4 py-3">
                <b className="text-[14.5px] font-extrabold text-navy">Version {row.version}</b>
                <span className="text-[14.5px] text-body">
                  {proposalStatusLabel[row.status] ?? row.status}
                  {row.responded_at ? `, you replied on ${formatDateTime(row.responded_at)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </FamilySection>
      )}
    </FamilyShell>
  );
};

export default CareProposalView;
