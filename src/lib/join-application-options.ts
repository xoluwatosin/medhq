// Centralised options for the Join Network application wizard

export const ROLES = [
  "Registered Nurse",
  "Registered Midwife",
  "Nurse/Midwife (Dual)",
  "Doctor",
  "Caregiver / Healthcare Assistant",
  "Nanny",
  "Early Childhood Educator",
  "Physiotherapist",
  "Other",
] as const;

export const QUALIFICATIONS_BY_ROLE: Record<string, string[]> = {
  "Registered Nurse": ["RN", "BNSc", "MSc Nursing", "Diploma in Nursing", "Other"],
  "Registered Midwife": ["RM", "BNSc", "MSc Nursing", "Diploma in Midwifery", "Other"],
  "Nurse/Midwife (Dual)": ["RNRM", "BNSc", "MSc Nursing", "Diploma in Nursing", "Other"],
  "Doctor": ["MBBS", "MBChB", "MD", "Specialist (FMCS/FWACS)", "Other"],
  "Caregiver / Healthcare Assistant": ["NVQ/Certificate in Care", "Diploma in Healthcare", "Trained on-the-job", "Other"],
  "Nanny": ["Childcare Certificate", "Montessori Certified", "ECCE Diploma", "Trained on-the-job", "Other"],
  "Early Childhood Educator": ["NCE", "B.Ed Early Childhood", "Montessori Diploma", "PGDE", "Other"],
  "Physiotherapist": ["B.PT", "MSc Physiotherapy", "Diploma in Physiotherapy", "Other"],
};

export const LICENSING_BODIES_BY_ROLE: Record<string, string[]> = {
  "Registered Nurse": ["NMCN", "Other"],
  "Registered Midwife": ["NMCN", "Other"],
  "Nurse/Midwife (Dual)": ["NMCN", "Other"],
  "Doctor": ["MDCN", "Other"],
  "Caregiver / Healthcare Assistant": ["None applicable", "Other"],
  "Nanny": ["TRCN", "NECO", "None applicable", "Other"],
  "Early Childhood Educator": ["TRCN", "NECO", "None applicable", "Other"],
  "Physiotherapist": ["MRTB", "Other"],
};

export const LANGUAGES = [
  "English", "Yoruba", "Igbo", "Hausa", "Pidgin",
  "French", "Arabic", "Edo", "Efik", "Ibibio",
  "Tiv", "Ijaw", "Nupe", "Kanuri", "Fulfulde",
  "Urhobo", "Isoko", "Itsekiri", "Igala", "Idoma",
  "Ebira", "Annang", "Portuguese", "Spanish", "Other",
] as const;

export const FLUENCY_LEVELS = ["Basic", "Conversational", "Fluent", "Native"] as const;

export const AVAILABILITY_OPTIONS = ["Full-time", "Part-time", "Shifts", "Live-in", "Weekends only"] as const;

export const START_WINDOW_OPTIONS = [
  { value: "immediately", label: "Immediately" },
  { value: "within_1_week", label: "Within 1 week" },
  { value: "within_1_month", label: "Within 1 month" },
  { value: "future", label: "Sometime in the future" },
] as const;

export const NYSC_OPTIONS = [
  { value: "completed", label: "Yes, completed" },
  { value: "exempt", label: "Yes, I have a certificate of exemption" },
  { value: "no", label: "No" },
  { value: "not_applicable", label: "Not applicable" },
] as const;

// Logic helpers — centralised so all steps + validation agree on which questions to show.

const CLINICAL_ROLES = new Set<string>([
  "Registered Nurse",
  "Registered Midwife",
  "Nurse/Midwife (Dual)",
  "Doctor",
  "Physiotherapist",
]);

// Roles whose only licensing option is "None applicable" — never ask licence questions.
const NON_LICENSED_ROLES = new Set<string>([
  "Caregiver / Healthcare Assistant",
]);

export const isClinicalRole = (role: string): boolean => CLINICAL_ROLES.has(role);

// Should we show the "Do you have a licence to practise?" question for this role?
// - Known clinical roles: yes
// - Nanny / Educator: yes (TRCN/NECO are real options alongside "None applicable")
// - Caregiver: no (no licensing body applies)
// - Other: yes (we ask the user directly since we can't infer)
// - Empty: no
export const roleRequiresLicenceQuestion = (role: string): boolean => {
  if (!role) return false;
  if (NON_LICENSED_ROLES.has(role)) return false;
  return true;
};

// Does the chosen "license to practice" answer mean we should ask for the body & expiry?
export const licenceAnswerNeedsBody = (answer: string): boolean =>
  answer === "yes" || answer === "in_progress";
