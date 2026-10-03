// The family and care group: one container joining the people who asked, the
// people receiving care, the services intended for each of them, and the visit
// that covers them all. Membership and relationship are facts about people and
// never grant access to anything.
import { adminDb } from "@/lib/admin-utils";
import { supabase } from "@/integrations/supabase/client";

export interface GroupMember {
  id: string;
  role: string;
  person_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

export interface GroupRelationship {
  id: string;
  from_person_id: string;
  to_person_id: string;
  relationship_code: string;
  other_label: string | null;
}

export interface GroupRecipient {
  id: string;
  client_id: string;
  person_id: string | null;
  full_name: string;
  display_order: number;
  address_line: string | null;
}

export interface GroupServiceRecipient {
  request_recipient_id: string;
  needs_clinical_resolution: boolean;
  conflict_reason: string | null;
}

export interface GroupService {
  id: string;
  service_id: string;
  service_name: string;
  service_slug: string;
  state: "proposed" | "confirmed" | "declined";
  is_shared: boolean;
  reason: string | null;
  recipients: GroupServiceRecipient[];
}

export interface GroupRequest {
  id: string;
  status: string;
  source: string;
  enquirer_person_id: string | null;
  created_at: string;
  recipients: GroupRecipient[];
  services: GroupService[];
}

export interface GroupVisit {
  id: string;
  appointment_at: string | null;
  location_kind: string;
  status: string;
  assessor_person_id: string | null;
  work_ids: string[];
}

export interface CareGroupOverview {
  group: {
    id: string;
    display_name: string;
    address_line: string | null;
    landmark: string | null;
    state_code: string | null;
    lga_code: string | null;
    status: string;
  };
  members: GroupMember[];
  relationships: GroupRelationship[];
  requests: GroupRequest[];
  visits: GroupVisit[];
}

export interface CoverageGap {
  intention_id: string;
  service_id: string;
  service_name: string;
  service_slug: string;
  state: string;
  top_up_sent: boolean;
}

export interface CoverageRecipient {
  request_recipient_id: string;
  client_id: string;
  name: string;
  submitted_at: string | null;
  gaps: CoverageGap[];
}

export interface RequestCoverage {
  visit_started: boolean;
  amendable: boolean;
  gap_count: number;
  recipients: CoverageRecipient[];
}

export interface RequestReadiness {
  recipients: number;
  recipients_without_person: number;
  services: number;
  recipients_without_service: number;
  conflicts: number;
  enquirer_set: boolean;
  ready: boolean;
}

/** Selects the requested request from a group's requests, falling back to the first. */
export const selectRequest = (
  requests: GroupRequest[],
  requestedId: string | null | undefined,
): GroupRequest | null => {
  if (requestedId) {
    const found = requests.find((r) => r.id === requestedId);
    if (found) return found;
  }
  return requests[0] ?? null;
};

/** The compatibility group for a care record, created on first use. */
export const groupForClient = async (clientId: string): Promise<string> => {
  const { data, error } = await adminDb().rpc("care_group_ensure", { _client_id: clientId });
  if (error) throw error;
  return data as string;
};

export const groupOverview = async (groupId: string): Promise<CareGroupOverview> => {
  const { data, error } = await adminDb().rpc("care_group_overview", { _group_id: groupId });
  if (error) throw error;
  return data as CareGroupOverview;
};

/**
 * Which services the pre-assessment has not asked about. A service recorded
 * after a person sent their answers is not covered until a top-up comes back.
 */
export const requestCoverage = async (requestId: string): Promise<RequestCoverage> => {
  const { data, error } = await adminDb().rpc("care_request_coverage", { _request_id: requestId });
  if (error) throw error;
  return data as unknown as RequestCoverage;
};

/** Sends the short set of questions for the services added later. */
export const sendTopUp = async (input: {
  clientId: string; requestRecipientId: string; intentionIds: string[];
}): Promise<{ link: string; emailed: boolean; emailError: string | null }> => {
  const { data: created, error } = await supabase.functions.invoke("care-token-create", {
    body: {
      client_id: input.clientId,
      scope: "top_up",
      request_recipient_id: input.requestRecipientId,
      intention_ids: input.intentionIds,
    },
  });
  if (error || !created?.ok) throw new Error(created?.error ?? "Could not create the top-up link");

  const { data: sent, error: sendError } = await supabase.functions.invoke("care-token-send", {
    body: { token_id: created.token_id, delivery_method: "email", token: created.token },
  });
  if (sendError || !sent?.ok) {
    throw new Error(sent?.error ?? "The top-up link was created but the email could not be sent");
  }
  return {
    link: sent.link,
    emailed: !!sent?.emailed,
    emailError: sent?.email_error ?? null,
  };
};

export const requestReadiness = async (requestId: string): Promise<RequestReadiness> => {
  const { data, error } = await adminDb().rpc("care_request_readiness", { _request_id: requestId });
  if (error) throw error;
  return data as RequestReadiness;
};

export const saveGroup = async (input: {
  groupId: string; displayName: string; addressLine?: string | null;
  landmark?: string | null; stateCode?: string | null; lgaCode?: string | null;
}) => {
  const { error } = await adminDb().rpc("care_group_save", {
    _group_id: input.groupId,
    _display_name: input.displayName,
    _address_line: input.addressLine ?? null,
    _landmark: input.landmark ?? null,
    _state_code: input.stateCode ?? null,
    _lga_code: input.lgaCode ?? null,
  });
  if (error) throw error;
};

export const saveRequest = async (input: {
  requestId: string | null; groupId: string; enquirerPersonId?: string | null;
  status?: string | null; source?: string | null; enquiryNotes?: string | null;
}) => {
  const { data, error } = await adminDb().rpc("care_request_save", {
    _request_id: input.requestId,
    _group_id: input.groupId,
    _enquirer_person_id: input.enquirerPersonId ?? null,
    _status: input.status ?? null,
    _source: input.source ?? null,
    _enquiry_notes: input.enquiryNotes ?? null,
  });
  if (error) throw error;
  return data as string;
};

/** A person record is created because a member of staff typed it, never matched. */
export const createPerson = async (input: {
  fullName: string; preferredName?: string | null; email?: string | null; phone?: string | null;
}) => {
  const { data, error } = await adminDb().rpc("care_person_create", {
    _full_name: input.fullName,
    _preferred_name: input.preferredName ?? null,
    _email: input.email ?? null,
    _phone: input.phone ?? null,
  });
  if (error) throw error;
  return data as string;
};

export const addRecipient = async (input: {
  requestId: string; fullName: string; personId?: string | null;
  dateOfBirth?: string | null; ageYears?: number | null; sexCode?: string | null;
  addressLine?: string | null; phone?: string | null; email?: string | null;
}) => {
  const { data, error } = await adminDb().rpc("care_recipient_create", {
    _request_id: input.requestId,
    _full_name: input.fullName,
    _person_id: input.personId ?? null,
    _date_of_birth: input.dateOfBirth || null,
    _age_years: input.ageYears ?? null,
    _sex_code: input.sexCode ?? null,
    _address_line: input.addressLine ?? null,
    _phone: input.phone ?? null,
    _email: input.email ?? null,
  });
  if (error) throw error;
  return data as { recipient_id: string; client_id: string; person_id: string };
};

export const linkRecipientPerson = async (recipientId: string, personId: string) => {
  const { error } = await adminDb().rpc("care_recipient_person_link", {
    _recipient_id: recipientId,
    _person_id: personId,
  });
  if (error) throw error;
};

export const setGroupMember = async (groupId: string, personId: string, role: string) => {
  const { error } = await adminDb().rpc("care_group_member_set", {
    _group_id: groupId, _person_id: personId, _role: role,
  });
  if (error) throw error;
};

export const setRelationship = async (input: {
  groupId: string; fromPersonId: string; toPersonId: string; code: string; otherLabel?: string | null;
}) => {
  const { error } = await adminDb().rpc("care_relationship_set", {
    _group_id: input.groupId,
    _from_person_id: input.fromPersonId,
    _to_person_id: input.toPersonId,
    _relationship_code: input.code,
    _other_label: input.otherLabel ?? null,
  });
  if (error) throw error;
};

export const removeRelationship = async (id: string) => {
  const { error } = await adminDb().rpc("care_relationship_remove", { _id: id });
  if (error) throw error;
};

export const setServiceIntention = async (input: {
  intentionId: string | null; requestId: string; serviceId: string; recipientIds: string[];
  state?: string | null; isShared?: boolean | null; reason?: string | null;
}) => {
  const { error } = await adminDb().rpc("care_service_intention_set", {
    _intention_id: input.intentionId,
    _request_id: input.requestId,
    _service_id: input.serviceId,
    _recipient_ids: input.recipientIds,
    _state: input.state ?? null,
    _is_shared: input.isShared ?? null,
    _reason: input.reason ?? null,
  });
  if (error) throw error;
};

export const removeServiceIntention = async (id: string) => {
  const { error } = await adminDb().rpc("care_service_intention_remove", { _id: id });
  if (error) throw error;
};

export const saveVisit = async (input: {
  visitId: string | null; groupId: string; requestId: string | null;
  appointmentAt: string | null; locationKind: string; addressLine?: string | null;
  assessorPersonId?: string | null; status?: string | null; notes?: string | null;
}) => {
  const { data, error } = await adminDb().rpc("care_visit_set", {
    _visit_id: input.visitId,
    _group_id: input.groupId,
    _request_id: input.requestId,
    _appointment_at: input.appointmentAt,
    _appointment_ends_at: null,
    _location_kind: input.locationKind,
    _address_line: input.addressLine ?? null,
    _assessor_person_id: input.assessorPersonId ?? null,
    _status: input.status ?? null,
    _notes: input.notes ?? null,
  });
  if (error) throw error;
  return data as string;
};

export const serviceOptions = async () => {
  const { data, error } = await adminDb()
    .from("services").select("id, name, slug").order("name");
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; slug: string }[];
};

export const relationshipTerms = async () => {
  const { data, error } = await adminDb()
    .from("care_group_relationship_terms")
    .select("code, label, requires_text").order("label");
  if (error) throw error;
  return (data ?? []) as { code: string; label: string; requires_text: boolean }[];
};

/** Plain sentences for what still has to be true before anything is sent. */
export const readinessSentences = (r: RequestReadiness): string[] => {
  const out: string[] = [];
  if (!r.enquirer_set) out.push("No enquirer recorded on the request.");
  if (r.recipients === 0) out.push("No one is recorded as receiving care.");
  if (r.recipients_without_person > 0) {
    out.push(
      r.recipients_without_person === 1
        ? "One recipient is not yet attached to a person record."
        : `${r.recipients_without_person} recipients are not yet attached to a person record.`,
    );
  }
  if (r.services === 0) out.push("No service has been recorded.");
  if (r.recipients_without_service > 0) {
    out.push(
      r.recipients_without_service === 1
        ? "One recipient has no service."
        : `${r.recipients_without_service} recipients have no service.`,
    );
  }
  if (r.conflicts > 0) {
    out.push(
      r.conflicts === 1
        ? "One service and recipient pairing is waiting on a clinical decision."
        : `${r.conflicts} service and recipient pairings are waiting on a clinical decision.`,
    );
  }
  return out;
};
