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
  payer: "Payer",
  representative: "Representative",
  contact: "Contact",
  other: "Other",
};

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
