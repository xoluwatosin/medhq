// Talent and Workforce are two states of one person, not two records.
//
// Ownership boundary:
//   Talent owns  - professional profile, qualifications, candidate verification,
//                  Talent availability and preferences, opportunities,
//                  applications, hiring history.
//   Workforce owns - the active employment relationship, staff status, staff
//                  contracts, Workforce compliance, professional capabilities,
//                  assignments and work.
//   The person owns - identity (mu_people.id), the single sign-in
//                  (auth_user_id), canonical contact details, history and
//                  provenance. None of these change when the state changes.
//
// Employment state never grants a capability. Clinical Assessor stays
// "active Workforce + sign-in + explicit assessor capability".
import { supabase } from "@/integrations/supabase/client";

const db = () => supabase as any;

export type LifecycleState = "talent" | "workforce";
export type PortalMode = "talent" | "workforce" | "none";

export interface PortalModeResult {
  person_id: string | null;
  full_name?: string | null;
  mode: PortalMode;
  staff_status?: string | null;
  assessor?: boolean;
  /** Field carer with the care_worker capability: the workforce app is open. */
  care_worker?: boolean;
}

/** The one transition into Workforce. Admin action at a signed contract. */
export async function becomeWorkforce(personId: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await db().rpc("mu_become_workforce", { _person_id: personId, _payload: payload });
  if (error) throw error;
  return data as { ok: boolean; changed: boolean };
}

/** The one way back to Talent. Blocked while live commitments exist. */
export async function returnToTalent(personId: string, reason?: string) {
  const { data, error } = await db().rpc("mu_return_to_talent", {
    _person_id: personId,
    _reason: reason ?? null,
  });
  if (error) throw error;
  return data as { ok: boolean; changed: boolean };
}

/** What currently stands in the way of offboarding. */
export async function workforceBlockers(personId: string) {
  const { data, error } = await db().rpc("mu_workforce_blockers", { _person_id: personId });
  if (error) throw error;
  return (data ?? { assignments: 0, assessments: 0, contracts: 0 }) as {
    assignments: number;
    assessments: number;
    contracts: number;
  };
}

/** One login, resolved to the mode this person is operating in today. */
export interface CareWorkerAssignment {
  id: string;
  episode_id: string;
  status: "planned" | "active";
  effective_from: string;
  effective_to: string | null;
  service_code: string | null;
  episode_status: string;
}

/** The signed-in carer's live care assignments. Empty unless they have app access. */
export async function myCareAssignments(): Promise<CareWorkerAssignment[]> {
  const { data, error } = await db().rpc("care_worker_my_assignments");
  if (error) throw error;
  return (data ?? []) as CareWorkerAssignment[];
}

export async function resolvePortalMode(): Promise<PortalModeResult> {
  const { data, error } = await db().rpc("mu_portal_mode");
  if (error) throw error;
  return (data ?? { person_id: null, mode: "none" }) as PortalModeResult;
}
