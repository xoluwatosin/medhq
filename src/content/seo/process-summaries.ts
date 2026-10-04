/** Concise answers shown when a governed "How this works" step is opened. */
export const PROCESS_SUMMARIES: Record<string, string> = {
  "MOD-01": "We check identity, qualifications, registration where required, references and competency before deployment.",
  "MOD-02": "An assessor reviews the person’s needs, home, routines and risks, then confirms the care plan, professionals and hours required.",
  "MOD-03": "Care is delivered at home only when the assessment, professional scope and home environment make it safe and appropriate.",
  "MOD-04": "Staff follow a documented escalation process, but emergencies must go directly to the emergency services.",
  "MOD-05": "The assessment is fixed-price; defined services use published prices, live-in care has a from price, and other ongoing and package care is quoted after assessment.",
  "MOD-06": "We confirm professional availability and a safe start date in Lagos, Abuja/FCT, Ogun or Ibadan/Oyo after reviewing the request.",
  "MOD-07": "Managed care is recorded against the care plan and reviewed when needs, risks or circumstances change.",
  "MOD-08": "A nurse can administer prescribed medicines and maintain the medication record within the agreed care plan and professional scope.",
  "MOD-09": "A rostered team covers the agreed hours, records each shift and gives a structured handover to the next professional.",
  "MOD-10": "The assessment separates clinical mother-and-baby care from broader Omugwo, night, meal and household support.",
  "MOD-11": "Childcare duties, specialist support, safeguarding and authorised collection arrangements are agreed in writing before support begins.",
  "MOD-12": "We agree the roles and responsibilities, vet suitable staff and deploy them for locum, contract, managed or permanent work.",
  "MOD-13": "Candidates join the pool or apply for a role, complete review and vetting, then receive suitable shifts, contracts, employment or placements when available.",
  "MOD-14": "With authorisation, Medic Connect coordinates local care, appointments, updates and practical arrangements for families living abroad.",
  "MOD-15": "We assess the event risks, agree the team and equipment, provide on-site first response and coordinate transfer when required.",
  "MOD-16": "We agree the programme or research scope, supply the required team and logistics, and report delivery within the contracted role.",
};

export const processSummary = (code: string, fallback: string) => PROCESS_SUMMARIES[code] ?? fallback;