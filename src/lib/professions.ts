// Deterministic profession taxonomy for Match Universe.
// The rule: logic decides. Where the logic cannot decide with confidence, the
// gap is handed to the candidate to fill in from their own profile — we never
// let a model invent a profession.

import type { TrackId } from "@/lib/join-tracks";

export const PROFESSIONS = [
  "Registered Nurse",
  "Nurse/Midwife",
  "Midwife",
  "Nursing Assistant",
  "Community Health Extension Worker",
  "Medical Doctor",
  "Pharmacist",
  "Pharmacy Technician",
  "Physiotherapist",
  "Medical Laboratory Scientist",
  "Radiographer",
  "Paramedic / Emergency Medical Technician",
  "Care Assistant",
  "Home Health Aide",
  "Nutritionist / Dietitian",
  "Occupational Therapist",
  "Speech and Language Therapist",
  "Psychologist / Counsellor",
  "Health Records Officer",
  "Clinical Research Associate",
  "Healthcare Administrator",
  "Non-clinical / Support",
] as const;

/** Professions grouped by the route the candidate chose. Students do not pick
 *  a profession at this stage; they record what they are studying instead. */
export const PROFESSIONS_BY_TRACK: Record<TrackId, readonly string[]> = {
  clinical: [
    "Registered Nurse",
    "Nurse/Midwife",
    "Midwife",
    "Medical Doctor",
    "Pharmacist",
    "Pharmacy Technician",
    "Physiotherapist",
    "Medical Laboratory Scientist",
    "Radiographer",
    "Paramedic / Emergency Medical Technician",
    "Nutritionist / Dietitian",
    "Occupational Therapist",
    "Speech and Language Therapist",
    "Psychologist / Counsellor",
    "Health Records Officer",
    "Clinical Research Associate",
  ],
  support: [
    "Nursing Assistant",
    "Care Assistant",
    "Home Health Aide",
    "Community Health Extension Worker",
    "Health Records Officer",
  ],
  non_clinical: [
    "Healthcare Administrator",
    "Health Records Officer",
    "Non-clinical / Support",
    "Clinical Research Associate",
  ],
  student: [],
};

export const professionsForTrack = (track?: string | null): readonly string[] => {
  const list = PROFESSIONS_BY_TRACK[(track ?? "") as TrackId];
  return list?.length ? list : PROFESSIONS;
};

export type Profession = (typeof PROFESSIONS)[number];

/** Ordered rules — the first match wins, so put the most specific first. */
const RULES: { re: RegExp; profession: Profession }[] = [
  { re: /(nurse[\s\S]{0,60}midwif|midwif[\s\S]{0,60}nurse|\brn\s*[/&+]\s*rm\b)/, profession: "Nurse/Midwife" },
  { re: /\b(midwife|midwifery|rm\b)/, profession: "Midwife" },
  { re: /\b(nursing assistant|assistant nurse|student nurse|auxiliary nurse|aux nurse|auxilliary nurse)\b/, profession: "Nursing Assistant" },
  { re: /\b(registered nurse|rn\b|nursing officer|staff nurse|\bnurse\b|bnsc|nmcn)\b/, profession: "Registered Nurse" },
  { re: /\b(chew|community health extension|community health officer|\bcho\b)\b/, profession: "Community Health Extension Worker" },
  { re: /\b(medical doctor|physician|mbbs|mbchb|house ?officer|medical officer|\bgp\b|surgeon)\b/, profession: "Medical Doctor" },
  { re: /\b(pharmacy technician|pharmacy tech)\b/, profession: "Pharmacy Technician" },
  { re: /\b(pharmacist|pharm\.?d|b\.?pharm)\b/, profession: "Pharmacist" },
  { re: /\b(physiotherap|physical therap)\w*/, profession: "Physiotherapist" },
  { re: /\b(medical laborator|lab scientist|medical lab|mls\b|phlebotom)\w*/, profession: "Medical Laboratory Scientist" },
  { re: /\b(radiograph|sonograph|imaging technolog)\w*/, profession: "Radiographer" },
  { re: /\b(paramedic|emergency medical technician|\bemt\b|ambulance)\b/, profession: "Paramedic / Emergency Medical Technician" },
  { re: /\b(care ?giver|caregiving|care assistant|carer|support worker)\b/, profession: "Care Assistant" },
  { re: /\b(home health aide|\bhha\b|domiciliary)\b/, profession: "Home Health Aide" },
  { re: /\b(nutrition|dietit|dietic)\w*/, profession: "Nutritionist / Dietitian" },
  { re: /\b(occupational therap)\w*/, profession: "Occupational Therapist" },
  { re: /\b(speech(\s|-)?(and\s)?language|speech therap)\w*/, profession: "Speech and Language Therapist" },
  { re: /\b(psycholog|counsell?or|therapist \(mental)\w*/, profession: "Psychologist / Counsellor" },
  { re: /\b(health records|medical records|health information)\b/, profession: "Health Records Officer" },
  { re: /\b(clinical research|research associate|\bcra\b|clinical trial)\b/, profession: "Clinical Research Associate" },
  { re: /\b(hospital administrator|healthcare administrator|practice manager|clinic manager|facility manager)\b/, profession: "Healthcare Administrator" },
  { re: /\b(virtual assistant|customer service|admin(istrative)? officer|receptionist|driver|accountant|marketer)\b/, profession: "Non-clinical / Support" },
];

/** Strings that tell us nothing and must never become a profession. */
const EMPTY = /^(n\/?a|nil|none|other|others|healthcare|health|medical|staff|worker|employee|professional|applicant|-{1,}|\.+)$/i;

export type ProfessionSource = "candidate_stated" | "cv_parsed" | "admin" | "unresolved";

export interface ProfessionResolution {
  profession: string | null;
  source: ProfessionSource;
  confidence: number;
  /** Set when we have text but the logic cannot map it cleanly. */
  ambiguous: boolean;
  /** Raw text the decision was made from. */
  raw: string | null;
  reason: string;
}

/** Map a free-text role onto the taxonomy. Returns null when nothing matches. */
export const matchProfession = (input?: string | null): Profession | null => {
  const s = (input || "").toLowerCase().trim();
  if (!s || EMPTY.test(s)) return null;
  for (const r of RULES) if (r.re.test(s)) return r.profession;
  return null;
};

/**
 * Deterministic precedence:
 *   1. An admin-confirmed profession always wins.
 *   2. What the candidate said about themselves on an application.
 *   3. What was parsed from their CV, only once an admin accepted the claim.
 *   4. Otherwise unresolved — the candidate is asked to pick it themselves.
 */
export function resolveProfession(input: {
  adminSet?: string | null;
  stated?: string | null;
  cvParsed?: string | null;
  cvParsedAccepted?: boolean;
  cvConfidence?: number | null;
}): ProfessionResolution {
  const { adminSet, stated, cvParsed, cvParsedAccepted, cvConfidence } = input;

  if (adminSet && !EMPTY.test(adminSet.trim()))
    return { profession: adminSet.trim(), source: "admin", confidence: 1, ambiguous: false, raw: adminSet, reason: "Set by an admin" };

  const statedMatch = matchProfession(stated);
  if (statedMatch)
    return { profession: statedMatch, source: "candidate_stated", confidence: 0.9, ambiguous: false, raw: stated ?? null, reason: "Mapped from what the candidate stated" };

  if (cvParsedAccepted) {
    const parsedMatch = matchProfession(cvParsed);
    if (parsedMatch)
      return { profession: parsedMatch, source: "cv_parsed", confidence: cvConfidence ?? 0.7, ambiguous: false, raw: cvParsed ?? null, reason: "Mapped from an accepted CV claim" };
  }

  const raw = (stated || cvParsed || "").trim() || null;
  return {
    profession: null,
    source: "unresolved",
    confidence: 0,
    ambiguous: Boolean(raw),
    raw,
    reason: raw ? `"${raw}" does not map to a known profession — candidate must confirm` : "No profession on record — candidate must supply it",
  };
}

/** Fields we expect a complete profile to carry. Anything missing becomes a
 *  gap the candidate fills in, not something we guess. */
export const CANDIDATE_GAP_FIELDS = [
  "profession",
  "years_experience",
  "state",
  "lga",
  "licensing_body",
  "license_number",
  "license_expiry",
  "availability",
] as const;

export const GAP_LABELS: Record<string, string> = {
  profession: "Profession",
  years_experience: "Years of experience",
  state: "State",
  lga: "LGA",
  licensing_body: "Licensing body",
  license_number: "Licence number",
  license_expiry: "Licence expiry",
  availability: "Availability",
  languages: "Languages",
  track: "Which route you are on",
  institution: "Where you study or studied",
  course_of_study: "Course",
  study_level: "Level of study",
  year_of_study: "Year of study",
  expected_graduation: "When you finish",
  joining_statement: "Why you are joining us",
};


export const PARSE_FIELD_LABELS: Record<string, string> = {
  ...GAP_LABELS,
  full_name: "Full name",
  email: "Email",
  phone: "Phone",
  current_position: "Current position",
  employer: "Current employer",
  qualification: "Highest qualification",
  specialisms: "Specialisms",
  certifications: "Certifications",
};
