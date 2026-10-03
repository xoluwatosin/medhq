// Shared types and helpers for Match Universe — the consolidated people layer.
import { adminDb } from "@/lib/admin-utils";

export interface Person {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  current_position: string | null;
  years_experience: number | null;
  state: string | null;
  lga: string | null;
  licensing_body: string | null;
  license_number: string | null;
  license_expiry: string | null;
  languages: any;
  availability: any;
  right_to_work: boolean | null;
  status: string;
  verification_state: string;
  admin_notes: string | null;
  last_activity_at: string;
  last_availability_update?: string | null;
  created_at: string;
  auth_user_id?: string | null;
  invited_at?: string | null;
  claimed_at?: string | null;
}


export interface PersonDocument {
  id: string;
  person_id: string;
  source_table: string;
  source_id: string | null;
  label: string;
  url: string;
  verified: boolean;
  rejected: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface MergeCandidate {
  id: string;
  person_a: string;
  person_b: string;
  reason: string;
  score: number;
  status: string;
  created_at: string;
}

// Match Universe is a talent pool, not a pipeline. People are never "rejected"
// here — only their documents and claims carry state.
export const VERIFICATION_LABELS: Record<string, string> = {
  unverified: "Unverified",
  in_review: "In review",
  verified: "Verified",
  failed: "Needs attention",
};

/** Document categories we recognise across every upload path. The codes match
 *  the ones used by document requirements and requests. */
export const DOC_TYPES = [
  "CV",
  "CoverLetter",
  "Licence",
  "RegistrationCertificate",
  "Certificate",
  "TrainingCertificate",
  "Transcript",
  "ID",
  "NYSC",
  "ProofOfAdmission",
  "ProofOfAddress",
  "RightToWork",
  "Reference",
  "ServiceLetter",
  "Payslip",
  "MedicalFitness",
  "BackgroundCheck",
  "BankDetails",
  "TaxID",
  "Contract",
  "Other",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

/** Plain wording for each kind, used everywhere a kind is shown or chosen. */
export const DOC_TYPE_LABELS: Record<DocType, string> = {
  CV: "CV",
  CoverLetter: "Cover letter",
  Licence: "Practising licence",
  RegistrationCertificate: "Registration certificate",
  Certificate: "Qualification certificate",
  TrainingCertificate: "Training certificate",
  Transcript: "Transcript",
  ID: "Government ID",
  NYSC: "NYSC certificate or exemption",
  ProofOfAdmission: "Proof of admission",
  ProofOfAddress: "Proof of address",
  RightToWork: "Right to work or visa",
  Reference: "Reference",
  ServiceLetter: "Employment or service letter",
  Payslip: "Payslip",
  MedicalFitness: "Medical fitness report",
  BackgroundCheck: "Police or background check",
  BankDetails: "Bank details",
  TaxID: "Tax identification",
  Contract: "Signed contract",
  Other: "Something else",
};

/** Wording for a kind, including kinds held on older records. */
export const docTypeLabel = (code?: string | null): string =>
  (code && DOC_TYPE_LABELS[code as DocType]) || code || "Kind not recorded";

/** Classify a document from its label / stored path. */
export const docTypeOf = (label: string, url = ""): DocType => {
  const s = `${label} ${url}`.toLowerCase();
  if (/\bcv\b|resume|curriculum/.test(s)) return "CV";
  if (/cover letter|covering letter/.test(s)) return "CoverLetter";
  if (/nysc|national youth service|call[- ]?up|exemption|exclusion/.test(s)) return "NYSC";
  if (/registration certificate|council registration/.test(s)) return "RegistrationCertificate";
  if (/licen[cs]e|practis|nmcn|mdcn|pcn|mlscn|rrbn|mrtb/.test(s)) return "Licence";
  if (/\bbls\b|\bacls\b|\bpals\b|\bnrp\b|training|workshop|safeguarding|infection control/.test(s))
    return "TrainingCertificate";
  if (/transcript/.test(s)) return "Transcript";
  if (/certificate|cert\b|diploma|degree|bnsc|hnd\b/.test(s)) return "Certificate";
  if (/passport|nin\b|national id|\bid\b|voter|driver/.test(s)) return "ID";
  if (/admission|matriculation|student id/.test(s)) return "ProofOfAdmission";
  if (/proof of address|utility bill|bank statement/.test(s)) return "ProofOfAddress";
  if (/visa|residence permit|work permit|right to work/.test(s)) return "RightToWork";
  if (/reference|referee|recommendation/.test(s)) return "Reference";
  if (/appointment letter|service letter|confirmation letter|employment letter/.test(s))
    return "ServiceLetter";
  if (/payslip|pay slip|salary slip/.test(s)) return "Payslip";
  if (/medical fitness|fitness to work|pre[- ]?employment medical/.test(s)) return "MedicalFitness";
  if (/police|background check|character certificate/.test(s)) return "BackgroundCheck";
  if (/bank detail|account details/.test(s)) return "BankDetails";
  if (/\btin\b|tax id|tax identification/.test(s)) return "TaxID";
  if (/contract|offer letter/.test(s)) return "Contract";
  return "Other";
};

/** Which credential a document category counts as evidence for. Anything not
 *  listed here is filed but is not evidence for a credential. */
export const DOC_CREDENTIAL: Record<string, string | undefined> = {
  Licence: "licence",
  RegistrationCertificate: "licence",
  Certificate: "qualification",
  TrainingCertificate: "qualification",
  ID: "id",
};



/** What a person actually does, taken from their own profile rather than the
 *  role they happened to apply to. */
export const professionOf = (p: { current_position?: string | null }) =>
  p.current_position?.trim() || null;


/** Initials for the avatar chip. */
export const initialsOf = (name: string) =>
  (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

/** Normalise an attribution row down to a single channel label. */
export const sourceOf = (a: { utm_source?: string | null; referrer?: string | null }) => {
  if (a.utm_source) return a.utm_source.toLowerCase();
  if (a.referrer) {
    try {
      return new URL(a.referrer).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "direct";
    }
  }
  return "direct";
};

/** Record an entry on the person's activity trail. Never blocks the caller. */
export async function logActivity(
  personId: string,
  action: string,
  detail: Record<string, any> = {},
  actor?: { id?: string | null; name?: string | null },
) {
  try {
    await adminDb().from("mu_activity").insert({
      person_id: personId,
      action,
      detail,
      actor_id: actor?.id ?? null,
      actor_name: actor?.name ?? null,
    });
  } catch {
    // audit trail is best-effort, never block the admin action
  }
}
