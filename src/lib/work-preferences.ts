// What kind of work someone wants, in their own words rather than ours.
//
// The catalogue below is taken from the services Medic Connect actually sells:
// maternity and newborn, childcare (including additional needs), paediatric,
// elderly and dementia, post-surgical recovery, chronic conditions, palliative,
// rehabilitation, personal care, hospital shifts and clinical research. Adding a
// service to the site means adding it here so the pool can be matched to it.
import { supabase } from "@/integrations/supabase/client";
import { trackRules } from "@/lib/tracks";

export interface CareTypeOption {
  code: string;
  label: string;
  help: string;
}

export const CARE_TYPES: CareTypeOption[] = [
  { code: "newborn_maternity", label: "Newborn and maternity", help: "Antenatal, postnatal and newborn support at home." },
  { code: "childcare", label: "Childcare and nanny work", help: "Day-to-day care of well children." },
  { code: "childcare_send", label: "Children with additional needs", help: "Learning disabilities, autism, complex or clinical needs." },
  { code: "paediatric_clinical", label: "Paediatric clinical care", help: "Nursing care for unwell children at home." },
  { code: "elderly", label: "Elderly care", help: "Companionship, personal care and daily support for older adults." },
  { code: "dementia", label: "Dementia care", help: "Dementia, Alzheimer's and memory-related care." },
  { code: "post_surgical", label: "Post-surgical recovery", help: "Wound care, mobility and recovery after an operation." },
  { code: "chronic", label: "Long-term conditions", help: "Stroke, diabetes, hypertension, cancer and similar." },
  { code: "palliative", label: "Palliative and end of life", help: "Comfort-focused care and family support." },
  { code: "rehab", label: "Rehabilitation and physio support", help: "Working alongside a rehabilitation plan." },
  { code: "personal_care", label: "Personal care and mobility", help: "Washing, dressing, feeding, transfers." },
  { code: "adult_disability", label: "Adult disability and complex needs", help: "Long-term support for disabled adults." },
  { code: "mental_health", label: "Mental health support", help: "Supervision, companionship and recovery support." },
  { code: "hospital_shifts", label: "Hospital and clinic shifts", help: "Bank or contract shifts on a ward or in a clinic." },
  { code: "clinical_research", label: "Clinical research support", help: "Trial coordination, data and site work." },
  { code: "family_abroad", label: "Clients with family abroad", help: "Reporting to relatives overseas on a regular schedule." },
];

export const CARE_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  CARE_TYPES.map((c) => [c.code, c.label]),
);

export const LIVE_IN_OPTIONS: { code: string; label: string; help: string }[] = [
  { code: "live_in", label: "Live-in only", help: "You stay with the client." },
  { code: "live_out", label: "Live-out only", help: "You travel in and go home." },
  { code: "either", label: "Either suits me", help: "Happy with both." },
  { code: "unknown", label: "Not said yet", help: "We will not assume." },
];

export const SHIFT_PATTERNS: { code: string; label: string }[] = [
  { code: "days", label: "Day shifts" },
  { code: "nights", label: "Night shifts" },
  { code: "waking_night", label: "Waking nights" },
  { code: "sleep_in", label: "Sleep-ins" },
  { code: "weekends", label: "Weekends" },
  { code: "twelve_hour", label: "12-hour shifts" },
  { code: "twenty_four_hour", label: "24-hour cover" },
  { code: "short_visits", label: "Short visits" },
];

export const ENGAGEMENT_TYPES: { code: string; label: string }[] = [
  { code: "long_term", label: "Long-term placement" },
  { code: "short_term", label: "Short-term placement" },
  { code: "respite", label: "Respite cover" },
  { code: "ad_hoc", label: "Ad-hoc days" },
  { code: "emergency", label: "Emergency cover" },
  { code: "travel_escort", label: "Travel and escort work" },
];

export const NOTICE_PERIODS: { code: string; label: string }[] = [
  { code: "immediate", label: "Available immediately" },
  { code: "one_week", label: "One week" },
  { code: "two_weeks", label: "Two weeks" },
  { code: "one_month", label: "One month" },
  { code: "longer", label: "More than a month" },
];

/** Who the person is. Held on mu_people because it is a fact about them, not a preference. */
export const SEX_OPTIONS: { code: string; label: string }[] = [
  { code: "female", label: "Female" },
  { code: "male", label: "Male" },
  { code: "other", label: "Other" },
  { code: "prefer_not_to_say", label: "Prefer not to say" },
];

/** Whether they are looking right now. They control this themselves. */
export const LOOKING_OPTIONS: { code: string; label: string; help: string }[] = [
  { code: "looking", label: "Looking for work", help: "Put me forward for anything that fits." },
  { code: "open", label: "Open to the right role", help: "Only get in touch for a strong match." },
  { code: "placed", label: "Currently placed", help: "Working now, not taking on more." },
  { code: "paused", label: "Paused", help: "Not available at the moment." },
];

/** Household comfort. "Any" is a stated answer; "unknown" is silence. */
export const CLIENT_SEX_OPTIONS: { code: string; label: string }[] = [
  { code: "any", label: "Any client" },
  { code: "female", label: "Female clients only" },
  { code: "male", label: "Male clients only" },
];

export const CLIENT_RELIGION_OPTIONS: { code: string; label: string }[] = [
  { code: "any", label: "Any household" },
  { code: "same_as_mine", label: "Same faith as mine" },
  { code: "christian", label: "Christian households" },
  { code: "muslim", label: "Muslim households" },
];

export const PETS_OPTIONS: { code: string; label: string }[] = [
  { code: "fine", label: "Pets are fine" },
  { code: "no_dogs", label: "No dogs" },
  { code: "no_pets", label: "No pets at all" },
  { code: "unknown", label: "Not said" },
];

export const SMOKING_OPTIONS: { code: string; label: string }[] = [
  { code: "fine", label: "Fine with smokers" },
  { code: "outdoor_only", label: "Only if they smoke outside" },
  { code: "no", label: "Non-smoking household only" },
  { code: "unknown", label: "Not said" },
];

export interface WorkPreferences {
  person_id: string;
  care_types: string[];
  live_in: string;
  shift_patterns: string[];
  engagement_types: string[];
  travel_states: string[];
  travel_lgas: string[];
  max_travel_minutes: number | null;
  willing_to_relocate: boolean | null;
  notice_period: string | null;
  notes: string | null;
  client_sex: string;
  religion: string | null;
  client_religion: string;
  pets: string;
  smoking_household: string;
  deal_breakers: string | null;
  /** Non-clinical route. */
  function_areas: string[];
  employer_types: string[];
  work_setting: string | null;
  contract_types: string[];
  salary_band: string | null;
  roles_wanted: string[];
  roles_wanted_other: string | null;
  /** Student route. */
  placement_types: string[];
  updated_at?: string | null;
  updated_by_name?: string | null;
}

export const emptyPreferences = (personId: string): WorkPreferences => ({
  person_id: personId,
  care_types: [],
  live_in: "unknown",
  shift_patterns: [],
  engagement_types: [],
  travel_states: [],
  travel_lgas: [],
  max_travel_minutes: null,
  willing_to_relocate: null,
  notice_period: null,
  notes: null,
  client_sex: "any",
  religion: null,
  client_religion: "any",
  pets: "unknown",
  smoking_household: "unknown",
  deal_breakers: null,
  function_areas: [],
  employer_types: [],
  work_setting: null,
  contract_types: [],
  salary_band: null,
  roles_wanted: [],
  roles_wanted_other: null,
  placement_types: [],
});

export async function loadPreferences(personId: string): Promise<WorkPreferences> {
  const { data } = await supabase
    .from("mu_work_preferences" as any)
    .select("*")
    .eq("person_id", personId)
    .maybeSingle();
  if (!data) return emptyPreferences(personId);
  const row = data as any;
  return {
    ...emptyPreferences(personId),
    ...row,
    care_types: row.care_types ?? [],
    shift_patterns: row.shift_patterns ?? [],
    engagement_types: row.engagement_types ?? [],
    travel_states: row.travel_states ?? [],
    travel_lgas: row.travel_lgas ?? [],
    client_sex: row.client_sex ?? "any",
    client_religion: row.client_religion ?? "any",
    pets: row.pets ?? "unknown",
    smoking_household: row.smoking_household ?? "unknown",
    function_areas: row.function_areas ?? [],
    employer_types: row.employer_types ?? [],
    contract_types: row.contract_types ?? [],
    roles_wanted: row.roles_wanted ?? [],
    placement_types: row.placement_types ?? [],
  };
}

export async function savePreferences(
  prefs: WorkPreferences,
  updatedByName?: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("mu_work_preferences" as any).upsert(
    {
      person_id: prefs.person_id,
      care_types: prefs.care_types,
      live_in: prefs.live_in,
      shift_patterns: prefs.shift_patterns,
      engagement_types: prefs.engagement_types,
      travel_states: prefs.travel_states,
      travel_lgas: prefs.travel_lgas,
      max_travel_minutes: prefs.max_travel_minutes,
      willing_to_relocate: prefs.willing_to_relocate,
      notice_period: prefs.notice_period,
      notes: prefs.notes,
      client_sex: prefs.client_sex,
      religion: prefs.religion,
      client_religion: prefs.client_religion,
      pets: prefs.pets,
      smoking_household: prefs.smoking_household,
      deal_breakers: prefs.deal_breakers,
      function_areas: prefs.function_areas,
      employer_types: prefs.employer_types,
      work_setting: prefs.work_setting,
      contract_types: prefs.contract_types,
      salary_band: prefs.salary_band,
      roles_wanted: prefs.roles_wanted,
      roles_wanted_other: prefs.roles_wanted_other,
      placement_types: prefs.placement_types,
      updated_by_name: updatedByName ?? null,
    },
    { onConflict: "person_id" },
  );
  return { error: error?.message ?? null };
}

/**
 * Preferences are mandatory, but what counts as complete follows the route.
 * A finance officer cannot honestly answer a live-in question, and a student
 * on placement is not choosing between night and day shifts.
 */
export const preferencesComplete = (p: WorkPreferences, track?: string | null): boolean => {
  const rules = trackRules(track);
  if (rules.needsFunctionAreas) return p.function_areas.length > 0 && p.contract_types.length > 0;
  if (rules.needsPlacement) return p.placement_types.length > 0;
  return p.care_types.length > 0 && p.live_in !== "unknown" && p.shift_patterns.length > 0;
};

