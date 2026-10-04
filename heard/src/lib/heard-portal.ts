import { supabase } from "@/integrations/supabase/client";

export const HEARD_ROLE_LABELS: Record<string, string> = {
  peer_listener: "Peer Listener",
  social_media_volunteer: "Social Media Volunteer",
  professional: "Counsellor, psychologist or clinician",
};

export const HEARD_APPLICATION_STATUS: Record<string, string> = {
  application_started: "Application started",
  submitted: "Submitted",
  under_review: "Under review",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const PROFICIENCY_LABELS = {
  native: "Native or bilingual",
  fluent: "Fluent",
  conversational: "Conversational",
  basic: "Basic",
} as const;
export type Proficiency = keyof typeof PROFICIENCY_LABELS;
export interface SpokenLanguage { language: string; proficiency: Proficiency }

export interface VolunteerProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  country_code: string | null;
  subdivision_code: string | null;
  subdivision_name: string | null;
  lga: string | null;
  city: string | null;
  timezone: string | null;
  languages: SpokenLanguage[];
  adjustments: string | null;
  adjustments_discuss_privately: boolean;
  role_interest: string;
  created_at: string;
}

export interface VolunteerApplication { id: string; role: string; status: string; created_at: string }

/** Role chosen before signing in, carried through to profile creation. */
const PENDING_KEY = "heard_pending_volunteer";
export interface PendingVolunteer { role: string; firstName?: string; lastName?: string }
export const setPendingVolunteer = (p: PendingVolunteer) => { try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch { /* ignore */ } };
export const takePendingVolunteer = (): PendingVolunteer | null => {
  try { const raw = sessionStorage.getItem(PENDING_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
export const clearPendingVolunteer = () => { try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ } };

/** Finds or creates the caller's profile and open application. Safe to repeat. */
export const bootstrapVolunteer = async (pending?: PendingVolunteer | null) => {
  const { data, error } = await supabase.rpc("heard_bootstrap_volunteer", {
    p_role: pending?.role ?? undefined,
    p_first_name: pending?.firstName ?? undefined,
    p_last_name: pending?.lastName ?? undefined,
  });
  if (error) throw error;
  clearPendingVolunteer();
  const profile = data as unknown as VolunteerProfile;
  const { data: apps } = await supabase
    .from("heard_volunteer_applications")
    .select("id, role, status, created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });
  return { profile, application: (apps?.[0] as VolunteerApplication | undefined) ?? null };
};

export type ProfileUpdate = Omit<VolunteerProfile, "id" | "user_id" | "email" | "role_interest" | "created_at">;

export const saveVolunteerProfile = async (p: ProfileUpdate) => {
  const { data, error } = await supabase.rpc("heard_update_volunteer_profile", {
    p_first_name: p.first_name,
    p_last_name: p.last_name,
    p_preferred_name: p.preferred_name ?? "",
    p_phone: p.phone ?? "",
    p_country_code: p.country_code ?? "",
    p_subdivision_code: p.subdivision_code ?? "",
    p_subdivision_name: p.subdivision_name ?? "",
    p_lga: p.lga ?? "",
    p_city: p.city ?? "",
    p_timezone: p.timezone ?? "",
    p_languages: p.languages as unknown as never,
    p_adjustments: p.adjustments ?? "",
    p_adjustments_discuss_privately: p.adjustments_discuss_privately,
  });
  if (error) throw error;
  return data as unknown as VolunteerProfile;
};
