// Which regulator licenses which profession in Nigeria. The candidate should
// never have to work this out: once they tell us what they do, the licensing
// body either answers itself or narrows to a short, real list.

export const ALL_LICENSING_BODIES = [
  "NMCN", // Nursing and Midwifery Council of Nigeria
  "MDCN", // Medical and Dental Council of Nigeria
  "PCN", // Pharmacy Council of Nigeria
  "MLSCN", // Medical Laboratory Science Council of Nigeria
  "MRTB", // Medical Rehabilitation Therapists Board (physio, OT, SLT)
  "RRBN", // Radiographers Registration Board of Nigeria
  "CHPRBN", // Community Health Practitioners Registration Board of Nigeria
  "DRCN", // Dietitians Registration Council of Nigeria
  "NBTE", // technician-level awards
  "MHPCN", // Medical Health Practitioners (psychology / counselling)
  "HRORBN", // Health Records Officers Registration Board of Nigeria
  "None applicable",
  "Other",
] as const;

/** Bodies that can plausibly license each profession, most likely first. */
const BY_PROFESSION: Record<string, string[]> = {
  "Registered Nurse": ["NMCN"],
  "Nurse/Midwife": ["NMCN"],
  "Midwife": ["NMCN"],
  "Nursing Assistant": ["None applicable"],
  "Community Health Extension Worker": ["CHPRBN"],
  "Medical Doctor": ["MDCN"],
  "Pharmacist": ["PCN"],
  "Pharmacy Technician": ["PCN", "NBTE"],
  "Physiotherapist": ["MRTB"],
  "Medical Laboratory Scientist": ["MLSCN"],
  "Radiographer": ["RRBN"],
  "Paramedic / Emergency Medical Technician": ["CHPRBN", "None applicable"],
  "Care Assistant": ["None applicable"],
  "Home Health Aide": ["None applicable"],
  "Nutritionist / Dietitian": ["DRCN"],
  "Occupational Therapist": ["MRTB"],
  "Speech and Language Therapist": ["MRTB"],
  "Psychologist / Counsellor": ["MHPCN"],
  "Health Records Officer": ["HRORBN"],
  "Clinical Research Associate": ["None applicable"],
  "Healthcare Administrator": ["None applicable"],
  "Non-clinical / Support": ["None applicable"],
};

/** Long name, so the answer can be shown in plain English. */
export const LICENSING_BODY_NAMES: Record<string, string> = {
  NMCN: "Nursing and Midwifery Council of Nigeria",
  MDCN: "Medical and Dental Council of Nigeria",
  PCN: "Pharmacy Council of Nigeria",
  MLSCN: "Medical Laboratory Science Council of Nigeria",
  MRTB: "Medical Rehabilitation Therapists Board of Nigeria",
  RRBN: "Radiographers Registration Board of Nigeria",
  CHPRBN: "Community Health Practitioners Registration Board of Nigeria",
  DRCN: "Dietitians Registration Council of Nigeria",
  NBTE: "National Board for Technical Education",
  MHPCN: "Medical Health Practitioners Council of Nigeria",
  HRORBN: "Health Records Officers Registration Board of Nigeria",
  "None applicable": "No licence applies to this role",
  Other: "Another body",
};

/**
 * The choices we offer someone in this profession. "Other" always stays on the
 * end so nobody is trapped, and an unknown profession keeps the full list.
 */
export const licensingBodiesFor = (profession?: string | null): string[] => {
  const key = (profession || "").trim();
  const narrowed = BY_PROFESSION[key];
  if (!narrowed) return [...ALL_LICENSING_BODIES];
  return [...narrowed, "Other"];
};

/** True when the profession answers the question by itself. */
export const licensingBodyIsSettled = (profession?: string | null): string | null => {
  const key = (profession || "").trim();
  const narrowed = BY_PROFESSION[key];
  return narrowed && narrowed.length === 1 ? narrowed[0] : null;
};
