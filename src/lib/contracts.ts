// The contract document: what a contract is made of, and how it is worked on.
//
// A contract is data, not markup. It carries a set of named fields, an ordered
// list of clauses whose wording is editable, and a list of annexes. At the
// moment it is issued the wording is frozen and fingerprinted, so what somebody
// signed can always be reproduced exactly, even if the clause library moves on.
import { supabase } from "@/integrations/supabase/client";
import type { Offer } from "@/lib/offers";

const db = () => supabase as any;

export interface ContractClause {
  key: string;
  heading: string;
  body: string;
  section: "main" | "additional" | string;
  locked?: boolean;
}

export interface ContractAnnex {
  code: string;
  title: string;
  clinical_only?: boolean;
  /** Left off this contract when false. */
  include?: boolean;
  /** A line of explanation printed under the title. */
  note?: string;
  /** The wording of the annex, when it is a document written in the app. */
  body?: string;
  /** The library item this came from, so a template can be refreshed. */
  library_code?: string;
  /** The person is asked to sign this annex alongside the letter. */
  requires_signature?: boolean;
  /** The attached document, in the applications bucket. */
  attachment_path?: string;
  attachment_name?: string;
}



export type ContractFields = Record<string, string>;

export interface ContractFieldDef {
  key: string;
  label: string;
  help?: string;
  type?: "text" | "textarea" | "date";
}

/** The variables a contract needs before it can be issued. */
export const CONTRACT_FIELDS: ContractFieldDef[] = [
  { key: "offer_date", label: "Date of offer", type: "date" },
  { key: "employee_name", label: "Employee's name" },
  { key: "employee_address", label: "Employee's address", type: "textarea" },
  { key: "employee_email", label: "Email address" },
  { key: "job_title", label: "Job title" },
  { key: "reports_to", label: "Reports to" },
  {
    key: "primary_responsibilities",
    label: "Primary responsibilities",
    help: "One sentence, written per role. It reads inside clause 1.",
    type: "textarea",
  },
  { key: "acceptance_window", label: "Acceptance window", help: "For example, seven days." },
  {
    key: "job_description_groups",
    label: "Job description",
    help: "Headed groups of duties. Written per role and editable before issue.",
    type: "textarea",
  },
  {
    key: "clause_commencement",
    label: "Commencement wording",
    help: "A straightforward start date, a fixed term, or a reinstatement of an earlier agreement.",
    type: "textarea",
  },
  { key: "salary_figure", label: "Salary figure", help: "For example, NGN 450,000." },
  { key: "salary_words", label: "Salary in words" },
  { key: "employment_basis", label: "Basis of engagement", help: "Full time, part time, contract, locum." },
  { key: "weekly_hours", label: "Weekly hours", help: "For example, 40 hours." },
  { key: "work_model", label: "Work model", help: "On site, hybrid, remote." },
  { key: "notice_period", label: "Notice period", help: "For example, one month." },
  { key: "primary_place_of_work", label: "Primary place of work" },
  { key: "signatory_name", label: "Company signatory", help: "Name and position of the person signing for Medic Connect Limited." },
];

// Who signs for the company by default.
export const COMPANY_SIGNATORY = "Francisca Abosede, Chief Executive Officer";

export const DEFAULT_ANNEXES: ContractAnnex[] = [
  { code: "Annex A", title: "Job description" },
  { code: "Annex B", title: "Code of conduct", requires_signature: true },
  { code: "Annex C", title: "Disciplinary and grievance procedure" },
  { code: "Annex D", title: "Confidentiality undertaking", requires_signature: true },
  { code: "Annex E", title: "Data protection notice" },
  { code: "Annex F", title: "Scope of practice, clinical roles only", clinical_only: true },
];


export interface ContractRecord {
  id: string;
  person_id: string;
  contract_type: string;
  job_title: string | null;
  department: string | null;
  start_date: string | null;
  end_date: string | null;
  notice_period: string | null;
  pay_amount: number | null;
  pay_currency: string;
  pay_frequency: string;
  working_pattern: string | null;
  location: string | null;
  status: string;
  fields: ContractFields;
  clauses: ContractClause[];
  annexes: ContractAnnex[];
  issued_clauses: ContractClause[] | null;
  issued_fields: ContractFields | null;
  issued_hash: string | null;
  issued_annexes?: ContractAnnex[] | null;
  template_id?: string | null;

  is_clinical: boolean;
  sign_token: string | null;
  signature_method: string | null;
  signed_name: string | null;
  signature_image: string | null;
  signed_at: string | null;
  countersigned_at: string | null;
  countersigned_name: string | null;
  countersignature_image: string | null;
  /** Per-document signatures and ticks, keyed by annex code. */
  annex_signatures?: Record<string, AnnexSignature> | null;
  annex_acknowledgements?: Record<string, AnnexSignature> | null;

  pdf_path: string | null;
  issued_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface ContractEvent {
  id: string;
  contract_id: string;
  event_type: string;
  actor_name: string | null;
  actor_role: string | null;
  detail: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

interface ContractPerson {
  full_name?: string | null;
  email?: string | null;
  work_email?: string | null;
  lga?: string | null;
  state?: string | null;
  employment_type?: string | null;
  job_title?: string | null;
  current_position?: string | null;
  profession?: string | null;
  department?: string | null;
}

const readableTerm = (value?: string | null) =>
  value ? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "";

const numericPay = (value?: string | null) => {
  const cleaned = value?.replace(/[^\d.]/g, "") || "";
  return cleaned && Number.isFinite(Number(cleaned)) ? cleaned : undefined;
};

/** One mapping from an accepted offer and person into every contract entry point. */
export function contractPayloadFromOffer(
  person: ContractPerson,
  offer?: Offer,
  actorName?: string | null,
) {
  const terms = offer?.terms || {};
  const address = [person.lga, person.state].filter(Boolean).join(", ");
  const title = offer?.title || person.job_title || person.current_position || person.profession || "";
  const location = offer?.location || terms.site || address;
  const basis = terms.basis || person.employment_type || "full_time";
  const payAmount = numericPay(terms.pay_amount);
  const payCurrency = terms.pay_currency || "NGN";
  const payFrequency = terms.pay_frequency || "monthly";

  return {
    offer_id: offer?.id,
    contract_type: basis.toLowerCase().replace(/[\s-]+/g, "_"),
    job_title: title,
    department: person.department || undefined,
    start_date: offer?.start_date || undefined,
    end_date: terms.end_date || undefined,
    notice_period: terms.notice_period || undefined,
    pay_amount: payAmount,
    pay_currency: payCurrency,
    pay_frequency: payFrequency.toLowerCase().replace(/[\s-]+/g, "_"),
    working_pattern: offer?.pattern || undefined,
    location: location || undefined,
    created_by_name: actorName || undefined,
    fields: {
      offer_date: new Date().toISOString().slice(0, 10),
      employee_name: person.full_name || "",
      employee_email: person.work_email || person.email || "",
      employee_address: address,
      job_title: title,
      reports_to: terms.reports_to || "",
      primary_responsibilities: terms.duties || "",
      job_description_groups: terms.duties || "",
      employment_basis: readableTerm(basis),
      weekly_hours: terms.weekly_hours || "",
      work_model: offer?.pattern || terms.site || "",
      notice_period: terms.notice_period || "",
      primary_place_of_work: location || "",
      salary_figure: payAmount ? `${payCurrency} ${payAmount}` : offer?.rate_note || "",
      signatory_name: COMPANY_SIGNATORY,
    },
  };
}

export const EVENT_LABELS: Record<string, string> = {
  created: "Contract drafted",
  edited: "Contract edited",
  issued: "Issued for signature",
  emailed: "Sent by email",
  viewed: "Opened by the recipient",
  signed: "Signed",
  countersigned: "Countersigned",
  pdf: "PDF produced",
  filed: "Filed on the profile",
  voided: "Withdrawn",
};

/** The wording that governs: the frozen copy once issued, the working copy before. */
export function effectiveClauses(c: ContractRecord): ContractClause[] {
  return (c.issued_clauses?.length ? c.issued_clauses : c.clauses) ?? [];
}

export function effectiveFields(c: ContractRecord): ContractFields {
  return (c.issued_fields && Object.keys(c.issued_fields).length ? c.issued_fields : c.fields) ?? {};
}

/** The annex pack that governs: frozen once issued, the working set before. */
export function effectiveAnnexes(c: ContractRecord): ContractAnnex[] {
  return (c.issued_annexes?.length ? c.issued_annexes : c.annexes) ?? [];
}



export async function loadClauseLibrary(): Promise<ContractClause[]> {
  const { data, error } = await db()
    .from("mu_contract_clause_library")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as ContractClause[];
}

export async function saveLibraryClause(key: string, patch: Record<string, unknown>) {
  const { error } = await db().from("mu_contract_clause_library").update(patch).eq("key", key);
  if (error) throw error;
}

export async function loadContract(id: string): Promise<ContractRecord> {
  const { data, error } = await db().from("mu_contracts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as ContractRecord;
}

/**
 * The home address as the person themselves wrote it in their account.
 * A contract should carry where they live, not the local government area we
 * inferred from a CV, so this reads the profile fields and nothing else.
 */
export async function personHomeAddress(personId: string): Promise<string> {
  const { data, error } = await db()
    .from("mu_people")
    .select("address_line, address_landmark, address_area, lga, state")
    .eq("id", personId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return "";
  const p = data as Record<string, string | null>;
  return [p.address_line, p.address_landmark, p.address_area, p.lga, p.state]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(", ");
}


export async function loadContractEvents(id: string): Promise<ContractEvent[]> {
  const { data, error } = await db()
    .from("mu_contract_events")
    .select("*")
    .eq("contract_id", id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContractEvent[];
}

export async function createContractFromLibrary(personId: string, payload: Record<string, unknown>) {
  const { data, error } = await db().rpc("mu_contract_create_from_library", {
    _person_id: personId,
    _payload: payload,
  });
  if (error) throw error;
  return data as string;
}

export async function saveContractDraft(id: string, payload: Record<string, unknown>) {
  const { error } = await db().rpc("mu_contract_save_draft", { _contract_id: id, _payload: payload });
  if (error) throw error;
}

export async function issueContractDocument(id: string, actorName?: string | null) {
  const { data, error } = await db().rpc("mu_contract_issue", {
    _contract_id: id,
    _actor_name: actorName ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function signContractInApp(
  id: string,
  signedName: string,
  method: "typed" | "drawn",
  signatureImage?: string | null,
) {
  const { error } = await db().rpc("mu_contract_sign", {
    _contract_id: id,
    _signed_name: signedName,
    _method: method,
    _signature_image: signatureImage ?? null,
    _user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });
  if (error) throw error;
}

export async function countersignContract(id: string, name: string, signatureImage?: string | null) {
  const { data, error } = await db().rpc("mu_contract_countersign", {
    _contract_id: id,
    _name: name,
    _signature_image: signatureImage ?? null,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function voidContract(id: string, reason: string, actorName?: string | null) {
  const { error } = await db().rpc("mu_contract_void", {
    _contract_id: id,
    _reason: reason,
    _actor_name: actorName ?? null,
  });
  if (error) throw error;
}

export function signingLink(token: string) {
  return `${window.location.origin}/contract/${token}`;
}

/** Attach a document to an annex. Stored beside the person's other files. */
export async function uploadAnnexFile(contractId: string, file: File) {
  const safe = file.name.replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-");
  const path = `contracts/${contractId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("applications").upload(path, file, { upsert: false });
  if (error) throw error;
  return { path, name: file.name };
}

export const DEFAULT_ANNEX_SIGNED = ["Annex B", "Annex D"];

// ---------------------------------------------------------------------------
// The candidate's own view. A person reads, acknowledges and signs their
// contract inside their account, so everything is behind their own login and
// nothing depends on an emailed token surviving a forwarded inbox.

export interface PortalContract {
  id: string;
  status: string;
  job_title: string | null;
  start_date: string | null;
  issued_at: string | null;
  fields: ContractFields;
  clauses: ContractClause[];
  annexes: ContractAnnex[];
  is_clinical: boolean;
  signed_name: string | null;
  signed_at: string | null;
  signature_image: string | null;
  countersigned_name: string | null;
  countersigned_at: string | null;
  countersignature_image: string | null;
  annex_acknowledgements: Record<string, { at: string; name: string | null }>;
  annex_signatures: Record<string, AnnexSignature>;
  required_annexes: string[];
  pdf_path: string | null;
}

export interface AnnexSignature {
  at: string;
  name: string | null;
  method?: "typed" | "drawn" | string;
  image?: string | null;
}

export async function loadMyContracts(): Promise<PortalContract[]> {
  const { data, error } = await db().rpc("mu_my_contracts");
  if (error) throw error;
  return (data ?? []) as PortalContract[];
}

export async function loadMyContract(id: string): Promise<PortalContract | null> {
  const { data, error } = await db().rpc("mu_my_contract", { _contract_id: id });
  if (error) throw error;
  return (data ?? null) as PortalContract | null;
}

export async function acknowledgeAnnex(id: string, code: string, acknowledged = true) {
  const { data, error } = await db().rpc("mu_contract_acknowledge_annex", {
    _contract_id: id,
    _code: code,
    _acknowledged: acknowledged,
  });
  if (error) throw error;
  return data as PortalContract;
}

export async function signMyContract(
  id: string,
  signedName: string,
  method: "typed" | "drawn",
  signatureImage?: string | null,
) {
  const { data, error } = await db().rpc("mu_contract_sign_in_portal", {
    _contract_id: id,
    _signed_name: signedName,
    _method: method,
    _signature_image: signatureImage ?? null,
  });
  if (error) throw error;
  return data as PortalContract;
}

/** The annexes on this contract that are actually printed and readable. */
export function visibleAnnexes(c: PortalContract): ContractAnnex[] {
  return (c.annexes || []).filter(
    (a) => a.include !== false && (!a.clinical_only || c.is_clinical),
  );
}

/** Sign one document in the pack, on its own. */
export async function signAnnex(
  id: string,
  code: string,
  signedName: string,
  method: "typed" | "drawn",
  signatureImage?: string | null,
) {
  const { data, error } = await db().rpc("mu_contract_sign_annex", {
    _contract_id: id,
    _code: code,
    _signed_name: signedName,
    _method: method,
    _signature_image: signatureImage ?? null,
  });
  if (error) throw error;
  return data as PortalContract;
}

export async function unsignAnnex(id: string, code: string) {
  const { data, error } = await db().rpc("mu_contract_unsign_annex", {
    _contract_id: id,
    _code: code,
  });
  if (error) throw error;
  return data as PortalContract;
}

// The pack, as a person sees it: the letter first, then each document, each
// with the one thing it wants from them.
export type PackAction = "sign" | "acknowledge" | "read";

export interface PackItem {
  /** "main" for the letter, otherwise the annex code. */
  key: string;
  code: string | null;
  title: string;
  note?: string | null;
  action: PackAction;
  done: boolean;
  /** Plain sentence for the row. */
  status: string;
  doneAt: string | null;
  doneName: string | null;
}

const day = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

export function packItems(c: PortalContract): PackItem[] {
  const required = new Set(c.required_annexes || []);
  const sigs = c.annex_signatures || {};
  const acks = c.annex_acknowledgements || {};

  const letterDone = c.status !== "issued";
  const items: PackItem[] = [
    {
      key: "main",
      code: null,
      title: "Your contract",
      note: c.fields?.job_title || c.job_title || "Offer of employment",
      action: "sign",
      done: letterDone,
      status: letterDone
        ? c.signed_at
          ? `Signed on ${day(c.signed_at)}`
          : "Signed"
        : "Needs your signature",
      doneAt: c.signed_at,
      doneName: c.signed_name,
    },
  ];

  for (const a of visibleAnnexes(c)) {
    const mustSign = required.has(a.code);
    const sig = sigs[a.code];
    const ack = acks[a.code];
    const done = mustSign ? !!(sig || ack) : true;
    items.push({
      key: a.code,
      code: a.code,
      title: a.title,
      note: a.note,
      action: mustSign ? "sign" : "read",
      done,
      status: mustSign
        ? sig
          ? `Signed on ${day(sig.at)}`
          : ack
            ? `Acknowledged on ${day(ack.at)}`
            : "Needs your signature"
        : "For reading",
      doneAt: sig?.at || ack?.at || null,
      doneName: sig?.name || ack?.name || null,
    });
  }

  return items;
}

/** How many documents still want something from the person. */
export function packOutstanding(c: PortalContract): PackItem[] {
  return packItems(c).filter((i) => i.key !== "main" && !i.done);
}

export function packDocLink(contractId: string, key: string) {
  return `/portal/offers/contract/${contractId}/doc/${encodeURIComponent(key)}`;
}

export function portalContractLink(id: string) {
  return `${window.location.origin}/portal/offers/contract/${id}`;
}
