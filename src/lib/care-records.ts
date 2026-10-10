// The care record spine: the household a record belongs to, the people linked
// to it, the state of the file, and how a website care request becomes a care
// record. Every write goes through a database function, never a direct table
// write from the browser.
import { adminDb } from "@/lib/admin-utils";

export interface LinkedRelationship {
  id: string;
  to_person_id: string;
  code: string;
  other_label: string | null;
  label: string | null;
  to_name: string;
}

export interface LinkedPerson {
  person_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  roles: string[];
  client_id: string | null;
  relationships: LinkedRelationship[];
}

export interface Household {
  id: string;
  display_name: string;
  address_line: string | null;
  landmark: string | null;
  state_code: string | null;
  lga_code: string | null;
  status: string;
}

export interface ClientLinks {
  household: Household | null;
  people: LinkedPerson[];
}

export const ROLE_LABELS: Record<string, string> = {
  enquirer: "Enquirer",
  care_recipient: "Care recipient",
  contact: "Contact",
  next_of_kin: "Next of kin",
  emergency_contact: "Emergency contact",
  payer: "Payer",
};

export const roleText = (roles: string[]) =>
  roles.map((role) => ROLE_LABELS[role] ?? role).join(", ");

/** The household a care record sits in, and everyone linked to it. */
export const clientLinks = async (clientId: string): Promise<ClientLinks> => {
  const { data, error } = await adminDb().rpc("care_client_links", { _client_id: clientId });
  if (error) throw error;
  return data as unknown as ClientLinks;
};

export type ClientLifecycleAction = "hold" | "resume" | "close" | "reopen" | "archive" | "restore";

export interface ClientLifecycleResult {
  stage: string | null;
  closed_at: string | null;
  paused_at: string | null;
  archived_at: string | null;
}

/** Puts a care record on hold, closes it, archives it, or brings it back. */
export const clientLifecycle = async (
  clientId: string,
  action: ClientLifecycleAction,
  reason?: string | null,
): Promise<ClientLifecycleResult> => {
  const { data, error } = await adminDb().rpc("care_client_lifecycle", {
    _client_id: clientId,
    _action: action,
    _reason: reason?.trim() || null,
  });
  if (error) throw error;
  return data as unknown as ClientLifecycleResult;
};

/** Closes or reopens a care request. */
export const requestLifecycle = async (
  requestId: string,
  action: "close" | "reopen",
  reason?: string | null,
): Promise<{ request_id: string; status: string }> => {
  const { data, error } = await adminDb().rpc("care_request_lifecycle", {
    _request_id: requestId,
    _action: action,
    _reason: reason?.trim() || null,
  });
  if (error) throw error;
  return data as unknown as { request_id: string; status: string };
};

export interface EnquiryMatch {
  person_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  matched_on: "email" | "phone";
  group_id: string | null;
  group_name: string | null;
}

/**
 * People who look like the person behind a website care request. A signal
 * only: staff decide what to attach, nothing attaches itself.
 */
export const enquiryMatches = async (submissionId: string): Promise<EnquiryMatch[]> => {
  const { data, error } = await adminDb().rpc("care_enquiry_matches", { _submission_id: submissionId });
  if (error) throw error;
  return (data ?? []) as unknown as EnquiryMatch[];
};

export interface EnquiryConversion {
  client_id: string;
  request_id?: string;
  group_id?: string;
  person_id?: string;
  recipient_id?: string;
  already_converted: boolean;
}

/** Turns a website care request into a care record and a care request. */
export const convertEnquiry = async (input: {
  submissionId: string;
  serviceId?: string | null;
  clientGroup?: string | null;
  groupId?: string | null;
  personId?: string | null;
}): Promise<EnquiryConversion> => {
  const { data, error } = await adminDb().rpc("care_enquiry_convert", {
    _submission_id: input.submissionId,
    _service_id: input.serviceId || null,
    _client_group: input.clientGroup || null,
    _group_id: input.groupId || null,
    _person_id: input.personId || null,
  });
  if (error) throw error;
  return data as unknown as EnquiryConversion;
};

// A home is an address. Care records under one roof share one, so the
// address is entered once and every record in it follows a change.
export interface HomeMate {
  client_id: string;
  full_name: string;
  enquiry_number: string | null;
}

export interface HomeOverview {
  home_id: string | null;
  /** Other care records in this home. */
  housemates: HomeMate[];
  /** Care records in the same family living elsewhere. */
  family: (HomeMate & { address_line: string | null; has_address: boolean })[];
}

export const homeOverview = async (clientId: string): Promise<HomeOverview> => {
  const { data, error } = await adminDb().rpc("care_home_overview", { _client_id: clientId });
  if (error) throw error;
  return data as HomeOverview;
};

export const shareHome = async (clientId: string, withClientId: string) => {
  const { error } = await adminDb().rpc("care_home_share", { _client_id: clientId, _with_client_id: withClientId });
  if (error) throw error;
};

export const separateHome = async (clientId: string) => {
  const { error } = await adminDb().rpc("care_home_separate", { _client_id: clientId });
  if (error) throw error;
};

// The same human entered twice. Matches are offered, never merged on their
// own: families share emails and phones, so staff decide.
export interface MatchCard {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  created_at: string;
  source: string;
  has_sign_in: boolean;
  care_records: { client_id: string; full_name: string; enquiry_number: string | null; date_of_birth: string | null }[];
  contact_for: { client_id: string; full_name: string; enquiry_number: string | null }[];
  families: { id: string; display_name: string }[];
}

export interface PersonMatch {
  person_a: MatchCard;
  person_b: MatchCard;
  matched_on: ("email" | "phone" | "name_and_birth")[];
}

export const MATCH_REASONS: Record<string, string> = {
  email: "email",
  phone: "phone",
  name_and_birth: "name and date of birth",
};

export const matchReason = (m: PersonMatch) =>
  `Same ${m.matched_on.map((k) => MATCH_REASONS[k] ?? k).join(" and ")}`;

/** Every open match, or only those touching one care record. */
export const personMatches = async (clientId?: string): Promise<PersonMatch[]> => {
  const { data, error } = await adminDb().rpc("care_person_matches", { _client_id: clientId ?? null });
  if (error) throw error;
  return (data ?? []) as PersonMatch[];
};

export const dismissMatch = async (personA: string, personB: string) => {
  const { error } = await adminDb().rpc("care_person_match_dismiss", { _person_a: personA, _person_b: personB });
  if (error) throw error;
};

export const mergePeople = async (keep: string, drop: string, combineFamilies: boolean) => {
  const { data, error } = await adminDb().rpc("care_people_merge", {
    _keep: keep, _drop: drop, _combine_families: combineFamilies,
  });
  if (error) throw error;
  return data as { kept: string; rows_moved: number; families_combined: number };
};

/** What a link opens, worked out from the link itself. */
export interface LinkScope {
  kind: "form" | "top_up" | "document";
  sent_to: { full_name: string; relationship: string | null } | null;
  covers: string[];
  gives_portal_access: boolean;
}

export const linkScope = async (tokenId: string): Promise<LinkScope> => {
  const { data, error } = await adminDb().rpc("care_link_scope", { _token_id: tokenId });
  if (error) throw error;
  return data as LinkScope;
};

// Who pays for a care record: people or organisations, with shares that add
// up to 100. Paying gives no access by itself.
export const ORGANISATION_KINDS: Record<string, string> = {
  employer: "Employer",
  hmo_insurer: "HMO or insurer",
  faith: "Church or mosque",
  ngo: "NGO or charity",
  government: "Government body",
  other: "Other organisation",
};

export interface PayerRow {
  id: string;
  share_percent: number;
  person: { id: string; full_name: string; email: string | null; phone: string | null } | null;
  organisation: {
    id: string; name: string; kind: string; billing_email: string | null; billing_phone: string | null;
    people: { id: string; full_name: string; email: string | null; role: string }[];
  } | null;
}

export interface PayersOverview {
  payers: PayerRow[];
  people: { id: string; full_name: string }[];
  organisations: { id: string; name: string; kind: string }[];
}

export const payersOverview = async (clientId: string): Promise<PayersOverview> => {
  const { data, error } = await adminDb().rpc("care_payers_overview", { _client_id: clientId });
  if (error) throw error;
  return data as PayersOverview;
};

export const setPayers = async (
  clientId: string,
  payers: { person_id?: string; organisation_id?: string; share_percent: number }[],
) => {
  const { error } = await adminDb().rpc("care_payers_set", { _client_id: clientId, _payers: payers });
  if (error) throw error;
};

export const saveOrganisation = async (input: {
  name: string; kind: string; billingEmail?: string | null; billingPhone?: string | null;
}) => {
  const { data, error } = await adminDb().rpc("care_organisation_save", {
    _id: null, _name: input.name, _kind: input.kind,
    _billing_email: input.billingEmail ?? null, _billing_phone: input.billingPhone ?? null,
    _billing_address: null, _notes: null,
  });
  if (error) throw error;
  return data as string;
};

export const addOrganisationPerson = async (organisationId: string, fullName: string, email?: string | null) => {
  const { error } = await adminDb().rpc("care_organisation_person_add", {
    _organisation_id: organisationId, _person_id: null, _full_name: fullName,
    _email: email ?? null, _phone: null, _role: "billing_contact",
  });
  if (error) throw error;
};
