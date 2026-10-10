/**
 * Approved canonical content blocks, mirrored from the governed SEO registry
 * (`seo_modules`). Wording is changed in the SEO workspace first and mirrored
 * here; never edit the copy directly to say something the registry does not.
 */
export interface GovernedModule {
  code: string;
  heading: string;
  paragraphs: string[];
}

const block = (code: string, heading: string, body: string): GovernedModule => ({
  code,
  heading,
  paragraphs: body.trim().split(/\n\s*\n/).map((paragraph) => paragraph.trim()),
});

export const GOVERNED_MODULES: Record<string, GovernedModule> = Object.fromEntries(
  [
    block("MOD-01", "How our professionals are vetted", `
Every Medic Connect professional goes through the same process before they are deployed. Identity documents are collected and checked. Where the role requires professional registration, licence and qualification documents are collected and reviewed. References and employment history are taken up, and each professional attends an interview and a competency assessment for the work they will do. Onboarding for the role and the specific assignment is completed before deployment and covers safeguarding, confidentiality, infection prevention, escalation, documentation and the competencies the assignment requires.

Medic Connect reviews the credentials it collects. It does not represent that every licence has been confirmed directly with the regulator. Police and FCID checks are not carried out for every professional; in Lagos a check can be arranged on request.

Medic Connect is licensed and accredited by HEFAMAA, holds professional indemnity insurance and is a member of the Healthcare Federation of Nigeria.`),

    block("MOD-02", "The home assessment", `
Care starts with a formal assessment. The assessor reviews what support is needed, the home environment, current routines, risks and any clinical requirements. The assessment produces the care plan and determines the professionals, hours and service arrangement that follow.

Clinical assessments are carried out by a registered nurse or doctor. Non-clinical assessments are carried out by a trained non-clinical assessor or social worker. The assessment is proportionate to the service requested: for a one-off or same-day intervention it can take place immediately before care rather than as a separate appointment.

The assessment fee is {{fee:PUB-ASSESSMENT}}, paid before the assessment. It is refunded if Medic Connect cannot provide the assessment.`),

    block("MOD-03", "What can be delivered at home", `
What can be delivered at home is set by the assessment, the care plan, the professional scope of the staff assigned and whether the home is a suitable setting for the task.

Within those limits, Medic Connect provides medication administration, injections and IV therapy, observations and vital signs, wound care, catheter and stoma care, post-operative care, chronic condition monitoring, doctor visits, physiotherapy, palliative care, and complex nursing such as tracheostomy, ventilator and PEG support where it is clinically appropriate.

Home care does not replace hospital treatment that requires a hospital setting. Where a need falls outside what can safely be delivered at home, Medic Connect says so and coordinates the referral or transfer.`),

    block("MOD-04", "Escalation and the emergency boundary", `
Medic Connect is not an emergency service. In an emergency, contact the emergency services. Do not wait for a scheduled Medic Connect visit.

Staff on assignment work to documented escalation procedures. They recognise deterioration within their competence, provide immediate support within their scope, contact the responsible clinician or the Medic Connect operations contact, and coordinate an ambulance or hospital transfer where one is needed. Ambulance, medical transport and air ambulance are arranged through third-party providers, including Flying Doctors Nigeria; Medic Connect does not operate its own ambulances.

Safeguarding concerns and serious incidents follow the same documented route and may involve external authorities, subject to safeguarding and legal requirements.`),

    block("MOD-05", "How pricing works", `
Two things determine what a service costs: what the care requires, and how it is delivered.

The formal assessment is a fixed fee, paid before the assessment. Published service prices are either a fixed price for a defined item of care, or a from price where the final figure depends on the detail of the arrangement. A live-in caregiver has a from price, set in full after the assessment. Other ongoing, overnight and package care is quoted after assessment rather than published as a rate, because the price depends on the professionals required, the number of staff, the hours and shift pattern, complexity, location, duration, equipment and supplies, transport and any specialist input.

Where third-party costs apply, such as pharmacy, laboratory, equipment or transport, they are set out for the customer before they are incurred.`),

    block("MOD-06", "Where we work", `
Medic Connect currently serves Lagos, Abuja and the FCT, Ogun State, and Ibadan and Oyo State.

Requests from elsewhere in Nigeria are considered individually, subject to a serviceability review covering available professionals, clinical requirements, logistics and safety. Availability within a served area still depends on the professionals required and the hours requested, so a start date is confirmed after assessment rather than promised in advance.`),

    block("MOD-07", "What is recorded during care", `
Ongoing managed care is documented against the care plan. Records can include visit and shift notes, observations and vital signs, medication given, food and fluid intake, personal care, mobility, mood and wellbeing, activities, incidents and escalations, and the handover to the next professional on the roster.

Care plans are reviewed as needs change and when condition, circumstances or risks change. Each managed-care client has a named Medic Connect care management contact who holds the record and coordinates the team. Records are shared with the person receiving care and the people they or their authorised representative have authorised, subject to safeguarding and legal requirements.`),

    block("MOD-08", "Medication", `
Where it is appropriate to the care plan and within the professional scope of the nurse assigned, Medic Connect supports medication reconciliation and review, administers prescribed medicines including injections and IV medication, monitors adherence and response, maintains the medication record, and coordinates prescriptions and refills with the treating doctor and pharmacy.

Medic Connect administers medicines that have been prescribed; it does not prescribe them. Prescription supply, medication delivery, home sample collection and laboratory testing are arranged through appropriately licensed pharmacies and laboratories.`),

    block("MOD-09", "Shifts, handover and supervision", `
Twenty-four-hour care is continuous coverage provided by a rostered team working shifts with structured handovers. It does not mean one professional remains on duty for 24 hours.

The roster is built from the care plan and may combine nurses and caregivers. Each shift hands over the record and the current picture to the next. Medic Connect supervises the professionals it deploys on managed assignments, reviews incidents, and arranges a replacement where one is needed, subject to availability.`),

    block("MOD-10", "Postnatal care and Omugwo", `
Postnatal clinical care is focused clinical support for mother and baby: maternal and newborn observations, wound and C-section checks, feeding and lactation support from a professional, and escalation where a concern is found.

Professional Omugwo is broader. It is organised mother-and-baby support delivered by paid nurses and caregivers, and depending on the package it combines maternal and newborn care, feeding support, night support, meals and household help. It is a professional service, not a family arrangement, and it is not limited to nursing.

Antenatal home support is supplementary to hospital maternity care and can include observations, education, preparation and medication support. Medic Connect does not provide home-birth services and does not replace hospital-based scans and maternity services.`),

    block("MOD-11", "Childcare and safeguarding", `
Medic Connect provides nannies and newborn nannies, childcare, after-school support, school pickup and drop-off coordination, homework support, weekend and holiday cover, and early-years support. Agreed duties can include feeding and light child-related laundry.

Specialist support, such as additional-needs and SEN support, shadow teaching, autism and ADHD support, and speech and occupational therapy input, is delivered by Medic Connect specialists or coordinated with specialist partners depending on the case.

Professionals working with children complete safeguarding onboarding, and safeguarding concerns follow documented escalation procedures. School pickup and drop-off is carried out only for children named in the care agreement, and a child is released only to the family or to people the family has named in writing in advance.`),

    block("MOD-12", "Staffing and managed workforce", `
Medic Connect supplies temporary and locum cover, contract staff and permanent placements across doctors, nurses, caregivers and healthcare assistants, pharmacists, laboratory scientists, radiographers, physiotherapists, administrative and front-of-house staff, and childcare and support roles. It fills single and hard-to-fill roles and builds complete teams.

Beyond supply, Medic Connect runs managed workforce arrangements and can manage a ward, department or wider operational function where the contract provides for it, including housekeeping, laundry, waste management, supplies, workflows and administration, up to full operational facility management.

Responsibilities differ by engagement. Clinical governance sits where the contract places it: in a supply engagement it remains with the client organisation.`),

    block("MOD-13", "Working with Medic Connect", `
There are three distinct routes into work with Medic Connect.

Joining the candidate pool means your profile is registered and reviewed so you can be considered for suitable work. It is not an offer of work. Applying for an advertised opportunity is an application for that specific role. Engagement follows: temporary or locum shifts, a contract, employment, or a permanent placement with a client organisation.

Matching considers qualifications and registration, competencies, experience, location, availability and shift pattern, language and the requirements of the assignment. On managed assignments Medic Connect supervises the professional; on a permanent placement, day-to-day management passes to the client. Performance concerns may lead to removal from an assignment, retraining or review.`),

    block("MOD-14", "Coordinating care from abroad", `
For families living abroad, Medic Connect can act as the local care coordinator, where the person receiving care or their authorised representative has authorised it. Depending on the package this covers assessment and care planning, staffing, appointments and hospital accompaniment, medication and pharmacy, laboratory tests, equipment, transport, meals and housekeeping, companionship and daily living support, and escalation when something changes.

Updates go to the person receiving care and the people they or their authorised representative have authorised.

A managed postpartum return to Nigeria is a separate arrangement and can include accommodation, airport transfer, maternal and newborn care, Omugwo, night support, meals and housekeeping, appointments, pharmacy and laboratory work, transport and departure arrangements, taken as a full package or as selected elements.`),

    block("MOD-15", "How event cover is scoped", `
Event medical cover is scoped before it is priced. Medic Connect reviews the event, the number of people attending, the activity and the risks, then plans the team and equipment required, deploys for the agreed hours, provides first response and triage on site within professional scope, and coordinates an ambulance or hospital transfer where one is needed.

Cover is provided for schools, churches, children's events, sports, conferences, corporate and private events. Medic Connect is not an ambulance service; ambulances and medical transport are arranged through third-party providers.`),

    block("MOD-16", "Programme and research delivery", `
Medic Connect works as a contracted delivery organisation for community, NGO and public health programmes: screenings, outreach, health education, campaigns, programme staffing, mobile and community clinics, logistics, clinical escalation and reporting. It also supports healthcare in justice and correctional settings, subject to institutional permission and contract.

For clinical research, Medic Connect provides operational support: research staffing, participant recruitment support, site and home visits, sample collection, study coordination, data collection and follow-up, and logistics. Medic Connect is not the study sponsor, the ethics authority or the protocol owner unless it is contracted in that role.`),
  ].map((module) => [module.code, module]),
);

export interface GovernedFee {
  sku: string;
  label: string;
  amountNaira: number;
  treatment: "fixed" | "from";
  unit: string;
}

const fee = (sku: string, label: string, amountNaira: number, treatment: "fixed" | "from", unit: string): GovernedFee =>
  ({ sku, label, amountNaira, treatment, unit });

export const GOVERNED_FEES: Record<string, GovernedFee> = Object.fromEntries(
  [
    fee("PUB-ASSESSMENT", "Formal care assessment", 35000, "fixed", "per assessment"),
    fee("PUB-NURSING-BASIC", "Basic nursing visit", 20000, "fixed", "per visit"),
    fee("PUB-NURSING-SKILLED", "Skilled nursing visit", 25000, "from", "per visit"),
    fee("PUB-LIVE-IN", "Monthly live-in caregiver", 300000, "from", "per month"),
    fee("PUB-NURSING-SHIFT-8H", "8-hour nursing shift", 60000, "fixed", "per shift"),
    fee("PUB-COMPANION-4H", "Companion care, 4 hours", 18000, "fixed", "per 4 hours"),
    fee("PUB-ESCORT", "Hospital appointment escort", 24000, "fixed", "per visit"),
    fee("PUB-CATHETER", "Catheter change or removal", 25000, "from", "per visit"),
    fee("PUB-STOMA", "Stoma care", 40000, "from", "per visit"),
    fee("PUB-CHRONIC-MONTHLY", "Chronic disease home management", 90000, "from", "per month"),
    fee("PUB-GP-HOME-VISIT", "GP home visit", 40000, "fixed", "per visit"),
    fee("PUB-SPECIALIST-HOME-VISIT", "Specialist doctor home visit", 75000, "from", "per visit"),
    fee("PUB-TELE-DOCTOR", "Doctor teleconsultation", 7500, "fixed", "per call"),
    fee("PUB-TELE-NURSE", "Nurse tele-check-in", 3500, "fixed", "per call"),
    fee("PUB-PHYSIO", "Physiotherapy assessment or session", 30000, "fixed", "per session"),
    fee("PUB-CHEST-PHYSIO", "Chest physiotherapy", 35000, "from", "per session"),
    fee("PUB-NEURO-REHAB", "Neuro-rehabilitation session", 45000, "from", "per session"),
    fee("PUB-WOUND-SIMPLE", "Simple wound dressing", 25000, "from", "per visit"),
    fee("PUB-WOUND-COMPLEX", "Complex wound or VAC care", 70000, "from", "per visit"),
    fee("PUB-DISCHARGE-TRANSITION", "Hospital discharge transition", 50000, "fixed", "per visit"),
    fee("PUB-POSTNATAL-VISIT", "Postnatal mother and baby visit", 30000, "fixed", "per visit"),
    fee("PUB-BREASTFEEDING", "Breastfeeding support", 28000, "fixed", "per session"),
    fee("PUB-CSECTION-WOUND", "C-section wound care", 20000, "fixed", "per visit"),
    fee("PUB-POSTNATAL-ESSENTIALS", "Postnatal Essentials", 195000, "from", "per 4 weeks"),
    fee("PUB-INJECTION", "Injection", 18000, "fixed", "per visit"),
    fee("PUB-IV-CARE", "IV care", 45000, "from", "per visit"),
    fee("PUB-WELLNESS-CHECK", "Wellness check", 18000, "fixed", "per visit"),
    fee("PUB-ANTENATAL-VISIT", "Routine antenatal visit", 30000, "fixed", "per visit"),
    fee("PUB-ANTENATAL-TRIMESTER", "Trimester antenatal package", 140000, "from", "per package"),
    fee("PUB-HIGH-RISK-ANTENATAL", "High-risk pregnancy visit", 40000, "fixed", "per visit"),
    fee("PUB-DRAIN", "Surgical drain management", 25000, "fixed", "per visit"),
    fee("PUB-ECG", "ECG", 40000, "fixed", "per visit"),
    fee("PUB-HOLTER", "Holter monitoring", 70000, "from", "per visit"),
    fee("PUB-PHLEBOTOMY", "Phlebotomy", 22000, "fixed", "per visit"),
    fee("PUB-SPECIALIST-CONSULT", "Specialist home consultation", 50000, "from", "per consultation"),
  ].map((record) => [record.sku, record]),
);

export const formatFee = (record: GovernedFee): string => {
  const amount = `₦${record.amountNaira.toLocaleString("en-NG")}`;
  return record.treatment === "from" ? `From ${amount}` : amount;
};

/** Replaces {{fee:SKU}} tokens with the governed public price. */
export const renderFeeTokens = (text: string): string =>
  text.replace(/\{\{fee:([A-Z0-9-]+)\}\}/g, (match, sku: string) => {
    const record = GOVERNED_FEES[sku];
    return record ? `₦${record.amountNaira.toLocaleString("en-NG")}` : match;
  });
