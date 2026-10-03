// The credential evidence ladder.
//
// One column used to answer three separate questions: what did the person
// claim, what evidence do we hold, and did anybody check it. Collapsing them
// produced false positives ("confirmed" licences with no licence number on
// file). The three axes are now stored separately in mu_credentials and the
// state below is DERIVED at read time. Nothing in this codebase may write it.

export const CREDENTIAL_TYPES = ["licence", "right_to_work", "nysc", "qualification", "id"] as const;
export type CredentialType = (typeof CREDENTIAL_TYPES)[number];

export const CREDENTIAL_LABELS: Record<CredentialType, string> = {
  licence: "Licence to practise",
  right_to_work: "Right to work",
  nysc: "NYSC",
  qualification: "Qualification",
  id: "Identity document",
};

export const EVIDENCE_TIERS = ["none", "self_declared", "documented", "verified"] as const;
export type EvidenceTier = (typeof EVIDENCE_TIERS)[number];

export const CREDENTIAL_STATES = [
  "unknown",
  "declined",
  "self_declared",
  "documented",
  "verified",
  "expired",
  "rejected",
] as const;
export type CredentialState = (typeof CREDENTIAL_STATES)[number];

export const STATE_LABELS: Record<CredentialState, string> = {
  unknown: "Not asked",
  declined: "Says no",
  self_declared: "Self declared",
  documented: "Document on file",
  verified: "Verified",
  expired: "Expired",
  rejected: "Failed review",
};

/** One line explaining exactly what the tier does and does not mean. */
export const STATE_MEANING: Record<CredentialState, string> = {
  unknown: "Never claimed and no document held. Scores lower, never excludes.",
  declined: "The candidate stated they do not hold this.",
  self_declared: "The candidate ticked yes on a form. No document, nobody has checked it.",
  documented: "A document is on file and is waiting for an admin to review it.",
  verified: "An admin reviewed the document and passed it, with a name and a timestamp.",
  expired: "Reviewed and passed, but the credential lapsed. Needs a fresh document.",
  rejected: "An admin reviewed the document and failed it.",
};

export const TIER_LABELS: Record<EvidenceTier, string> = {
  none: "Not required",
  self_declared: "Self declared or better",
  documented: "Document on file or better",
  verified: "Verified only",
};

/** Ordinal ladder, mirroring public.mu_evidence_rank. Negative disqualifies. */
export const stateRank = (state: string): number =>
  ({ verified: 3, documented: 2, self_declared: 1, unknown: 0, none: 0 } as Record<string, number>)[state] ?? -1;

export type BadgeTone = "verified" | "documented" | "claim" | "muted" | "bad";

export const stateTone = (state: string): BadgeTone =>
  state === "verified"
    ? "verified"
    : state === "documented"
      ? "documented"
      : state === "self_declared"
        ? "claim"
        : state === "unknown"
          ? "muted"
          : "bad";

/** Derive the state client-side from the three axes, matching the SQL exactly. */
export function deriveState(c: {
  claim?: string | null;
  evidence_document_id?: string | null;
  verification_outcome?: string | null;
  expires_at?: string | null;
}): CredentialState {
  if (c.verification_outcome === "fail") return "rejected";
  if (c.verification_outcome === "pass") {
    if (c.expires_at && new Date(c.expires_at) < new Date(new Date().toDateString())) return "expired";
    return "verified";
  }
  if (c.evidence_document_id) return "documented";
  if (c.claim === "no") return "declined";
  if (c.claim === "yes") return "self_declared";
  return "unknown";
}

// One shared provenance vocabulary for every promoted field, so a derived
// value can never lose its provenance on the way to a screen.
export const PROVENANCE = ["self_declared", "form", "cv_parsed", "parsed", "admin_entered", "admin_verified"] as const;
export type Provenance = (typeof PROVENANCE)[number];

export const PROVENANCE_LABELS: Record<string, string> = {
  self_declared: "Self declared",
  form: "From the application form",
  cv_parsed: "Parsed from CV",
  parsed: "Parsed from CV",
  admin_entered: "Entered by an admin",
  admin_verified: "Verified by an admin",
};

export const provenanceLabel = (source?: string | null) =>
  PROVENANCE_LABELS[source ?? ""] ?? "Self declared";

export interface CredentialRow {
  id: string;
  person_id: string;
  credential_type: CredentialType;
  claim: "yes" | "no" | null;
  claim_source: string | null;
  claim_at: string | null;
  evidence_document_id: string | null;
  evidence_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  verification_method: string | null;
  verification_outcome: "pass" | "fail" | null;
  expires_at: string | null;
  note: string | null;
}
