// Deno copy of the profession taxonomy used by the CV parser.
// Keep in sync with src/lib/professions.ts.

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

const RULES: { re: RegExp; profession: string }[] = [
  { re: /(nurse[\s\S]{0,60}midwif|midwif[\s\S]{0,60}nurse|\brn\s*[/&+]\s*rm\b)/, profession: "Nurse/Midwife" },
  { re: /\b(midwife|midwifery|rm)\b/, profession: "Midwife" },
  { re: /\b(nursing assistant|assistant nurse|student nurse|auxiliary nurse|aux nurse|auxilliary nurse)\b/, profession: "Nursing Assistant" },
  { re: /\b(registered nurse|rn|nursing officer|staff nurse|nurse|bnsc|nmcn)\b/, profession: "Registered Nurse" },
  { re: /\b(chew|community health extension|community health officer|cho)\b/, profession: "Community Health Extension Worker" },
  { re: /\b(medical doctor|physician|mbbs|mbchb|house ?officer|medical officer|gp|surgeon)\b/, profession: "Medical Doctor" },
  { re: /\b(pharmacy technician|pharmacy tech)\b/, profession: "Pharmacy Technician" },
  { re: /\b(pharmacist|pharm\.?d|b\.?pharm)\b/, profession: "Pharmacist" },
  { re: /\b(physiotherap|physical therap)\w*/, profession: "Physiotherapist" },
  { re: /\b(medical laborator|lab scientist|medical lab|mls|phlebotom)\w*/, profession: "Medical Laboratory Scientist" },
  { re: /\b(radiograph|sonograph|imaging technolog)\w*/, profession: "Radiographer" },
  { re: /\b(paramedic|emergency medical technician|emt|ambulance)\b/, profession: "Paramedic / Emergency Medical Technician" },
  { re: /\b(care ?giver|caregiving|care assistant|carer|support worker)\b/, profession: "Care Assistant" },
  { re: /\b(home health aide|hha|domiciliary)\b/, profession: "Home Health Aide" },
  { re: /\b(nutrition|dietit|dietic)\w*/, profession: "Nutritionist / Dietitian" },
  { re: /\b(occupational therap)\w*/, profession: "Occupational Therapist" },
  { re: /\b(speech(\s|-)?(and\s)?language|speech therap)\w*/, profession: "Speech and Language Therapist" },
  { re: /\b(psycholog|counsell?or)\w*/, profession: "Psychologist / Counsellor" },
  { re: /\b(health records|medical records|health information)\b/, profession: "Health Records Officer" },
  { re: /\b(clinical research|research associate|cra|clinical trial)\b/, profession: "Clinical Research Associate" },
  { re: /\b(hospital administrator|healthcare administrator|practice manager|clinic manager|facility manager)\b/, profession: "Healthcare Administrator" },
  { re: /\b(virtual assistant|customer service|administrative officer|receptionist|driver|accountant|marketer)\b/, profession: "Non-clinical / Support" },
];

const EMPTY = /^(n\/?a|nil|none|other|others|healthcare|health|medical|staff|worker|employee|professional|applicant|-{1,}|\.+)$/i;

export const matchProfession = (input?: string | null): string | null => {
  const s = (input || "").toLowerCase().trim();
  if (!s || EMPTY.test(s)) return null;
  for (const r of RULES) if (r.re.test(s)) return r.profession;
  return null;
};
