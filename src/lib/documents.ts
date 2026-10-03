// The document lifecycle, shared by admin and the candidate portal.
//
// A document is never "verified" because somebody ticked a box. It is uploaded,
// it waits for review, and an admin either accepts it or rejects it with a
// reason. A person is verified only when every document we require of them is
// accepted and in date, and nothing is missing from their profile. That whole
// judgement lives in the database (mu_document_status / mu_derive_verification)
// and is only rendered here.
import { supabase } from "@/integrations/supabase/client";

export const DOC_STATUSES = ["missing", "pending", "accepted", "conditional", "rejected", "expired"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export interface DocumentRequirement {
  doc_type: string;
  label: string;
  helper: string | null;
  required: boolean;
  status: DocStatus;
  document_id: string | null;
  document_label: string | null;
  document_url: string | null;
  expires_at: string | null;
  review_reason: string | null;
  reviewed_at: string | null;
  source_note: string | null;
  conditional_until?: string | null;
  conditional_reason?: string | null;
}

export const STATUS_LABELS: Record<DocStatus, string> = {
  missing: "Not received",
  pending: "Awaiting review",
  accepted: "Accepted",
  conditional: "Accepted for now",
  rejected: "Not accepted",
  expired: "Expired",
};

/** What the candidate is told, in plain words. */
export const STATUS_HELP: Record<DocStatus, string> = {
  missing: "We do not hold this yet.",
  pending: "Received. Our team is checking it.",
  accepted: "Checked and accepted by our team.",
  conditional: "Accepted for the time being. We still need an in date copy before the review date.",
  rejected: "We could not accept the copy we received.",
  expired: "The copy we hold has passed its expiry date.",
};

export const statusVariant = (s: DocStatus): "default" | "secondary" | "outline" | "destructive" =>
  s === "accepted" ? "default" : s === "pending" || s === "conditional" ? "secondary" : s === "missing" ? "outline" : "destructive";

/** Plain sentence for a conditional acceptance, or null when it is not one. */
export function conditionalLine(r: Pick<DocumentRequirement, "status" | "conditional_until" | "conditional_reason">): string | null {
  if (r.status !== "conditional") return null;
  const until = r.conditional_until
    ? new Date(r.conditional_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const why = r.conditional_reason ? ` ${r.conditional_reason}` : "";
  return until ? `Accepted until ${until}.${why}` : `Accepted for now.${why}`;
}


/** Open a stored document. Handles both full URLs and bucket paths. */
export async function openDocument(url: string): Promise<string | null> {
  const raw = url || "";
  if (/^https?:\/\//.test(raw) && !raw.includes("/storage/v1/object/")) return raw;
  const path = raw.includes("/applications/")
    ? decodeURIComponent(raw.split("/applications/")[1])
    : raw.replace(/^applications\//, "");
  const { data } = await supabase.storage.from("applications").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

/**
 * Open a stored document in a new tab.
 *
 * The signed URL takes a round trip, so the tab must be opened synchronously
 * inside the click handler. Opening it after the await is treated as a popup
 * by every browser and silently blocked, which is why the buttons looked dead.
 */
export async function openDocumentTab(url: string): Promise<boolean> {
  // Note: passing "noopener" makes window.open return null, which would send us
  // down the same-tab fallback every time. Open plainly and sever the opener.
  const tab = window.open("about:blank", "_blank");
  if (tab) { try { tab.opener = null; } catch { /* cross-origin, ignore */ } }
  const signed = await openDocument(url);
  if (!signed) {
    tab?.close();
    return false;
  }
  if (tab) {
    tab.location.href = signed;
  } else {
    // Popups blocked outright: fall back to a same-tab navigation.
    window.location.href = signed;
  }
  return true;
}


/** Every requirement for a person, with the best document we hold against it. */
export async function loadRequirements(personId: string): Promise<DocumentRequirement[]> {
  const { data } = await (supabase as any).rpc("mu_document_status", { _person_id: personId });
  return (data ?? []) as DocumentRequirement[];
}

/** One line explaining why somebody is not verified yet. */
export function verificationReasons(reqs: DocumentRequirement[], gaps: string[] = []): string[] {
  const out = reqs
    .filter((r) => r.required && r.status !== "accepted")
    .map((r) => `${r.label}: ${STATUS_LABELS[r.status].toLowerCase()}`);
  gaps.forEach((g) => out.push(`${g.replace(/_/g, " ")} missing from the profile`));
  return out;
}
