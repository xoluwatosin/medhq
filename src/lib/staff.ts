// Internal staff and their contracts.
//
// A staff member is not a second kind of person. It is the same mu_people row,
// flagged as staff, so somebody hired out of the candidate pool keeps one
// identity, one document set and one credential ladder. Everything here is the
// employment layer that sits on top of that record: job title, contract, and
// the compliance paperwork we are obliged to hold.
import { supabase } from "@/integrations/supabase/client";
import { issueAndSendContract, issuedMessage } from "@/lib/contract-issue";

const db = () => supabase as any;

export type StaffStatus = "pending" | "active" | "on_notice" | "exited" | "none";
export type EmploymentType = "full_time" | "part_time" | "contract" | "locum" | "intern";
export type ContractStatus = "draft" | "issued" | "signed" | "active" | "ended" | "withdrawn";

export const STAFF_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  active: "Active",
  on_notice: "On notice",
  exited: "Exited",
  none: "Not staff",
};

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
  locum: "Locum",
  intern: "Intern",
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  issued: "Issued, awaiting signature",
  signed: "Signed",
  active: "Active",
  ended: "Ended",
  withdrawn: "Withdrawn",
};

/** What the contract state means for the person: has it been agreed or not. */
export const CONTRACT_SETTLED = (s?: string | null) => s === "signed" || s === "active";

export const PAY_FREQUENCIES = ["monthly", "weekly", "daily", "hourly", "per_shift", "annual"] as const;

export const PAY_FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Monthly",
  weekly: "Weekly",
  daily: "Daily",
  hourly: "Hourly",
  per_shift: "Per shift",
  annual: "Annual",
};

export interface StaffRow {
  id: string;
  full_name: string;
  email: string | null;
  work_email: string | null;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  employment_type: string | null;
  staff_status: string;
  staff_start_date: string | null;
  auth_user_id: string | null;
  contract_status: string | null;
  contract_id: string | null;
  docs_required: number;
  docs_accepted: number;
  docs_missing: number;
}

export interface Contract {
  id: string;
  person_id: string;
  contract_type: string;
  job_title: string | null;
  department: string | null;
  start_date: string | null;
  end_date: string | null;
  probation_end: string | null;
  notice_period: string | null;
  pay_amount: number | null;
  pay_currency: string;
  pay_frequency: string;
  working_pattern: string | null;
  location: string | null;
  document_url: string | null;
  status: ContractStatus;
  /** In the bin: kept on the record but out of the way. */
  deleted_at?: string | null;
  deleted_by?: string | null;

  signature_method: string | null;
  signed_name: string | null;
  issued_at: string | null;
  signed_at: string | null;
  notes: string | null;
  created_by_name: string | null;
  issued_by_name: string | null;
  created_at: string;
}

export interface EmergencyContact {
  id: string;
  person_id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_next_of_kin: boolean;
}

export async function loadStaff(): Promise<StaffRow[]> {
  const { data, error } = await db().rpc("mu_staff_list");
  if (error) throw error;
  return (data ?? []) as StaffRow[];
}

export async function binContract(contractId: string, binned = true) {
  const { data, error } = await db().rpc("mu_bin_contract", {
    _contract_id: contractId,
    _bin: binned,
  } as any);
  if (error) throw error;
  const res = data as any;
  if (res?.ok === false) throw new Error(res.error);
}

export async function loadContracts(personId: string): Promise<Contract[]> {
  const { data, error } = await db()
    .from("mu_contracts")
    .select("*")
    .eq("person_id", personId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Contract[];
}

export async function createContract(personId: string, payload: Record<string, unknown>) {
  const { data, error } = await db().rpc("mu_create_contract", { _person_id: personId, _payload: payload });
  if (error) throw error;
  return data as string;
}

/** Issue a contract: checks, freeze, and the signing email. Returns the line to show. */
export async function issueContract(id: string, actorName?: string | null) {
  return issuedMessage(await issueAndSendContract(id, actorName));
}

export async function setContractStatus(id: string, status: ContractStatus, note?: string) {
  const { error } = await db().rpc("mu_set_contract_status", {
    _contract_id: id,
    _status: status,
    _note: note ?? null,
  });
  if (error) throw error;
}

export async function convertToStaff(personId: string, payload: Record<string, unknown>) {
  const { error } = await db().rpc("mu_convert_to_staff", { _person_id: personId, _payload: payload });
  if (error) throw error;
}

export async function loadEmergencyContacts(personId: string): Promise<EmergencyContact[]> {
  const { data } = await db()
    .from("mu_staff_emergency_contacts")
    .select("*")
    .eq("person_id", personId)
    .order("created_at");
  return (data ?? []) as EmergencyContact[];
}
