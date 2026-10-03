// The care proposal: what the client is actually shown.
//
// It is a separate, versioned document projected from the operational care
// plan by the server. Internal risk and safeguarding material never reaches it,
// and once it has been sent it is a record that cannot be changed.
import { adminDb } from "@/lib/admin-utils";
import { planSections } from "@/lib/care-plan";

export type ProposalStatus = "draft" | "sent" | "withdrawn" | "superseded";

export type Proposal = {
  id: string;
  client_id: string;
  plan_document_id: string;
  version: number;
  status: ProposalStatus;
  content: Record<string, unknown>;
  created_at: string;
  sent_at: string | null;
  withdrawn_at: string | null;
};

export type ProposalSend = {
  id: string;
  proposal_id: string;
  person_id: string;
  sent_at: string;
};

export type ProposalComment = {
  id: string;
  proposal_id: string;
  person_id: string | null;
  body: string;
  created_at: string;
};

export const proposalStatusLabel: Record<ProposalStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  withdrawn: "Withdrawn",
  superseded: "Replaced",
};

export const proposalStatusTone = (
  status: ProposalStatus,
): "neutral" | "good" | "warning" =>
  status === "sent" ? "good" : status === "withdrawn" ? "warning" : "neutral";

export const clientProposals = async (clientId: string): Promise<Proposal[]> => {
  const { data, error } = await adminDb()
    .from("care_proposals")
    .select("id, client_id, plan_document_id, version, status, content, created_at, sent_at, withdrawn_at")
    .eq("client_id", clientId)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Proposal[];
};

export const proposalSends = async (proposalId: string): Promise<ProposalSend[]> => {
  const { data, error } = await adminDb()
    .from("care_proposal_sends")
    .select("id, proposal_id, person_id, sent_at")
    .eq("proposal_id", proposalId)
    .order("sent_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ProposalSend[];
};

export const proposalComments = async (proposalId: string): Promise<ProposalComment[]> => {
  const { data, error } = await adminDb()
    .from("care_proposal_comments")
    .select("id, proposal_id, person_id, body, created_at")
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ProposalComment[];
};

/**
 * A proposal is drafted from the care plan built from one accepted assessment.
 * The assessment is named so the lineage is exact.
 */
export const draftProposal = async (
  clientId: string, assessmentDocumentId?: string,
): Promise<void> => {
  const { error } = await adminDb().rpc("care_proposal_draft", {
    _client_id: clientId,
    ...(assessmentDocumentId ? { _assessment_document_id: assessmentDocumentId } : {}),
  } as never);
  if (error) throw error;
};

/** Only people who hold clinical access to this client can be sent a proposal. */
export const proposalRecipients = async (
  clientId: string,
): Promise<{ person_id: string; full_name: string }[]> => {
  const { data, error } = await adminDb().rpc("care_proposal_recipients", { _client_id: clientId });
  if (error) throw error;
  return (data ?? []) as { person_id: string; full_name: string }[];
};

export type ProposalResponseKind = "agreed" | "changes_requested" | "call_requested";

export const RESPONSE_CHOICES: { value: ProposalResponseKind; label: string }[] = [
  { value: "agreed", label: "Agree" },
  { value: "changes_requested", label: "Request changes" },
  { value: "call_requested", label: "Need a call" },
];

/** The safe status of each proposal, with no clinical content in it. */
export interface ProposalStatusRow {
  proposal_id: string;
  version: number;
  status: ProposalStatus;
  sent_at: string | null;
  withdrawn_at: string | null;
  response: ProposalResponseKind | null;
  responded_at: string | null;
}

export const proposalStatuses = async (clientId: string): Promise<ProposalStatusRow[]> => {
  const { data, error } = await adminDb().rpc("care_proposal_status", { _client_id: clientId });
  if (error) throw error;
  return (data ?? []) as unknown as ProposalStatusRow[];
};

/** The answer belongs to this version alone. It never starts care. */
export const respondToProposal = async (
  id: string, response: ProposalResponseKind, comment?: string,
): Promise<void> => {
  const body = comment?.trim();
  if (response === "changes_requested" && !body) throw new Error("Say what should change");
  const { error } = await adminDb().rpc("care_proposal_respond", {
    _proposal_id: id, _response: response, ...(body ? { _comment: body } : {}),
  });
  if (error) throw error;
};


export const sendProposal = async (id: string, personIds: string[]): Promise<void> => {
  const { error } = await adminDb().rpc("care_proposal_send", {
    _proposal_id: id, _person_ids: personIds,
  });
  if (error) throw error;
};

export const withdrawProposal = async (id: string, reason: string): Promise<void> => {
  const { error } = await adminDb().rpc("care_proposal_withdraw", {
    _proposal_id: id, _reason: reason,
  });
  if (error) throw error;
};

export const commentOnProposal = async (id: string, body: string): Promise<void> => {
  const { error } = await adminDb().rpc("care_proposal_comment", {
    _proposal_id: id, _body: body,
  });
  if (error) throw error;
};

/** Reads one proposal in the plan's own order, using the plan's own headings. */
export const proposalParts = async (
  content: Record<string, unknown>,
  formDefinitionId: string,
): Promise<{ id: string; title: string; note: string }[]> => {
  const sections = await planSections(formDefinitionId);
  return sections
    .filter((section) => content[section.id] !== undefined)
    .map((section) => {
      const held = content[section.id];
      const note = typeof held === "object" && held !== null
        ? String((held as Record<string, unknown>).note ?? "")
        : String(held ?? "");
      return { id: section.id, title: section.title, note };
    })
    .filter((part) => part.note.trim() !== "");
};
