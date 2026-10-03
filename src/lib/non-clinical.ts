// The non-clinical route. These people are not rostered on visits, so what
// matters is the function they work in, the kind of employer they want, and the
// shape of the contract, rather than shifts and care types.

export const FUNCTION_AREAS = [
  { code: "admin", label: "Administration and office management", help: "Front desk, records, scheduling, office running." },
  { code: "finance", label: "Finance and accounts", help: "Bookkeeping, payroll, billing, audit." },
  { code: "hr", label: "Human resources and recruitment", help: "Hiring, onboarding, employee relations." },
  { code: "operations", label: "Operations and service delivery", help: "Running the day-to-day of a care service." },
  { code: "quality", label: "Quality, compliance and governance", help: "Standards, audits, incident reviews, policy." },
  { code: "health_records", label: "Health records and information", help: "Medical records, coding, data quality." },
  { code: "technology", label: "Technology and systems", help: "Software, support, data, IT infrastructure." },
  { code: "data", label: "Data and analysis", help: "Reporting, dashboards, monitoring and evaluation." },
  { code: "marketing", label: "Marketing and communications", help: "Brand, content, social, campaigns." },
  { code: "sales", label: "Sales and business development", help: "Partnerships, corporate accounts, growth." },
  { code: "customer_care", label: "Customer care and client relations", help: "Enquiries, complaints, family liaison." },
  { code: "supply", label: "Supply chain, procurement and logistics", help: "Stock, suppliers, deliveries, stores." },
  { code: "facilities", label: "Facilities and maintenance", help: "Premises, equipment, cleaning, catering." },
  { code: "security", label: "Security", help: "Access control, patrol, safeguarding of premises." },
  { code: "transport", label: "Transport and driving", help: "Patient transport, logistics driving." },
  { code: "legal", label: "Legal and contracts", help: "Agreements, regulatory filings, disputes." },
  { code: "programme", label: "Programme and project management", help: "Grants, donor programmes, delivery plans." },
  { code: "training", label: "Training and learning", help: "Course delivery, competency, continuing education." },
  { code: "research_admin", label: "Research administration", help: "Ethics, study coordination, reporting." },
  { code: "executive", label: "Executive and leadership", help: "Director and head-of-function roles." },
] as const;

export const FUNCTION_AREA_LABEL: Record<string, string> = Object.fromEntries(
  FUNCTION_AREAS.map((f) => [f.code, f.label]),
);

export const EMPLOYER_TYPES = [
  { code: "hospital", label: "Hospitals and clinics" },
  { code: "home_care", label: "Home care providers" },
  { code: "diagnostics", label: "Diagnostic and laboratory services" },
  { code: "pharma", label: "Pharmaceutical and medical supply" },
  { code: "hmo", label: "HMOs and health insurers" },
  { code: "ngo", label: "NGOs and donor programmes" },
  { code: "government", label: "Government and public health" },
  { code: "health_tech", label: "Health technology companies" },
  { code: "education", label: "Training schools and universities" },
  { code: "corporate", label: "Corporate organisations outside health" },
] as const;

export const EMPLOYER_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  EMPLOYER_TYPES.map((e) => [e.code, e.label]),
);

export const WORK_SETTINGS = [
  { code: "onsite", label: "On site", help: "In the office or facility every working day." },
  { code: "hybrid", label: "Hybrid", help: "Some days on site, some days at home." },
  { code: "remote", label: "Remote", help: "Fully from home, wherever the employer is." },
] as const;

export const CONTRACT_TYPES = [
  { code: "permanent", label: "Permanent" },
  { code: "fixed_term", label: "Fixed term contract" },
  { code: "part_time", label: "Part time" },
  { code: "consultancy", label: "Consultancy or retainer" },
  { code: "internship", label: "Internship" },
] as const;

export const CONTRACT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  CONTRACT_TYPES.map((c) => [c.code, c.label]),
);

/** Monthly, gross, in naira. A band rather than a figure, so nobody has to
 *  name a number before a conversation has happened. */
export const SALARY_BANDS = [
  { code: "under_150k", label: "Under ₦150,000 a month" },
  { code: "150_300k", label: "₦150,000 to ₦300,000 a month" },
  { code: "300_500k", label: "₦300,000 to ₦500,000 a month" },
  { code: "500_800k", label: "₦500,000 to ₦800,000 a month" },
  { code: "800k_1_2m", label: "₦800,000 to ₦1.2 million a month" },
  { code: "over_1_2m", label: "Over ₦1.2 million a month" },
  { code: "open", label: "Open to discussion" },
] as const;

export const SALARY_BAND_LABEL: Record<string, string> = Object.fromEntries(
  SALARY_BANDS.map((s) => [s.code, s.label]),
);
