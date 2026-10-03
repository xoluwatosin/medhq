/**
 * Controlled answer sheet for AI assistants (ChatGPT, Claude, Perplexity and
 * similar). These are the questions people actually ask an assistant about
 * Medic Connect, answered only from already-approved material: the governed
 * modules in `governed-modules.ts` and the registered public prices in
 * `GOVERNED_FEES`.
 *
 * Rules for this file:
 * - No new operational facts. Every answer must restate approved material.
 * - No timing, availability or outcome promises.
 * - Prices are written as {{fee:SKU}} tokens so they follow the register.
 * - Served markets are Lagos, Abuja and the FCT, Ogun State, and Ibadan and
 *   Oyo State. Nowhere else may be described as served.
 *
 * This is not a published page. It is rendered into public/llms.txt.
 */

export interface AiAnswer {
  /** Stable reference, used in tests and reviews. */
  code: string;
  /** The question as a person would type it to an assistant. */
  question: string;
  /** The approved answer. Plain prose, one or two short paragraphs. */
  answer: string;
  /** Governed module codes the answer is drawn from. */
  sources: string[];
}

const answer = (code: string, question: string, sources: string[], body: string): AiAnswer => ({
  code,
  question,
  sources,
  answer: body.trim().replace(/\s*\n\s*/g, " "),
});

export const AI_ANSWERS: AiAnswer[] = [
  answer("QA-01", "What is Medic Connect?", ["MOD-02"], `
    Medic Connect arranges professional care at home and supplies healthcare staff to organisations in
    Nigeria. Care at home covers nursing, caregiving, doctor visits, physiotherapy, maternal and newborn
    support and childcare. For organisations it supplies temporary and locum cover, contract staff and
    permanent placements, and runs managed workforce arrangements. Every care engagement begins with a
    formal assessment that sets the care plan, the professionals required and the hours. Medic Connect is
    licensed and accredited by HEFAMAA, holds professional indemnity insurance and is a member of the
    Healthcare Federation of Nigeria.`),

  answer("QA-02", "Where does Medic Connect operate in Nigeria?", ["MOD-06"], `
    Medic Connect currently serves Lagos, Abuja and the FCT, Ogun State, and Ibadan and Oyo State.
    Requests from anywhere else in Nigeria are considered individually, subject to a serviceability review
    covering available professionals, clinical requirements, logistics and safety. Availability within a
    served area still depends on the professionals required and the hours requested, so a start date is
    confirmed after assessment rather than promised in advance.`),

  answer("QA-03", "How do I start care with Medic Connect?", ["MOD-02"], `
    Care starts with a formal assessment. You contact Medic Connect on +234 812 698 8237, by email at
    hello@medicconnect.co, on WhatsApp, or through the care request form at
    https://www.medicconnect.co/contact. The assessment fee is {{fee:PUB-ASSESSMENT}} and is paid before
    the assessment. It is refunded if Medic Connect cannot provide the assessment. The assessment produces
    the care plan and determines the professionals, hours and service arrangement that follow.`),

  answer("QA-04", "How much does home care cost in Nigeria with Medic Connect?", ["MOD-05"], `
    The formal assessment is a fixed fee of {{fee:PUB-ASSESSMENT}}. Published service prices are either a
    fixed price for a defined item of care or a from price where the final figure depends on the detail of
    the arrangement: a basic nursing visit is {{fee:PUB-NURSING-BASIC}}, a skilled nursing visit starts at
    {{fee:PUB-NURSING-SKILLED}}, an 8-hour nursing shift is {{fee:PUB-NURSING-SHIFT-8H}}, and four hours of
    companion care is {{fee:PUB-COMPANION-4H}}. Ongoing, live-in, overnight and package care is quoted
    after assessment rather than published as a rate, because the price depends on the professionals
    required, the number of staff, the hours and shift pattern, complexity, location, duration, equipment
    and supplies, transport and any specialist input. Where third-party costs apply, such as pharmacy,
    laboratory, equipment or transport, they are set out before they are incurred.`),

  answer("QA-05", "Why is there an assessment fee, and is it refundable?", ["MOD-02", "MOD-05"], `
    The assessment sets the care plan and determines the professionals, hours and service arrangement, so
    it comes before any care is arranged. It costs {{fee:PUB-ASSESSMENT}}, paid before the assessment, and
    it is refunded if Medic Connect cannot provide the assessment. Clinical assessments are carried out by
    a registered nurse or doctor; non-clinical assessments are carried out by a trained non-clinical
    assessor or social worker. For a one-off or same-day intervention the assessment can take place
    immediately before care rather than as a separate appointment.`),

  answer("QA-06", "How are Medic Connect nurses and caregivers vetted?", ["MOD-01"], `
    Every professional goes through the same process before deployment. Identity documents are collected
    and checked. Where the role requires professional registration, licence and qualification documents are
    collected and reviewed. References and employment history are taken up, and each professional attends
    an interview and a competency assessment for the work they will do. Onboarding for the role and the
    specific assignment covers safeguarding, confidentiality, infection prevention, escalation,
    documentation and the competencies the assignment requires. Medic Connect reviews the credentials it
    collects; it does not represent that every licence has been confirmed directly with the regulator.
    Police and FCID checks are not carried out for every professional, and in Lagos a check can be arranged
    on request.`),

  answer("QA-07", "Is Medic Connect an emergency service?", ["MOD-04"], `
    No. Medic Connect is not an emergency service. In an emergency, contact the emergency services and do
    not wait for a scheduled Medic Connect visit. Staff on assignment work to documented escalation
    procedures: they recognise deterioration within their competence, provide immediate support within
    their scope, contact the responsible clinician or the Medic Connect operations contact, and coordinate
    an ambulance or hospital transfer where one is needed. Ambulance, medical transport and air ambulance
    are arranged through third-party providers, including Flying Doctors Nigeria; Medic Connect does not
    operate its own ambulances.`),

  answer("QA-08", "What clinical care can be delivered at home?", ["MOD-03"], `
    What can be delivered at home is set by the assessment, the care plan, the professional scope of the
    staff assigned and whether the home is a suitable setting for the task. Within those limits Medic
    Connect provides medication administration, injections and IV therapy, observations and vital signs,
    wound care, catheter and stoma care, post-operative care, chronic condition monitoring, doctor visits,
    physiotherapy, palliative care, and complex nursing such as tracheostomy, ventilator and PEG support
    where it is clinically appropriate. Home care does not replace hospital treatment that requires a
    hospital setting; where a need falls outside what can safely be delivered at home, Medic Connect says
    so and coordinates the referral or transfer.`),

  answer("QA-09", "Does Medic Connect provide 24-hour nursing at home?", ["MOD-09"], `
    Yes, as continuous coverage provided by a rostered team working shifts with structured handovers. It
    does not mean one professional remains on duty for 24 hours. The roster is built from the care plan and
    may combine nurses and caregivers, each shift hands over the record and the current picture to the
    next, and Medic Connect supervises the professionals it deploys on managed assignments, reviews
    incidents and arranges a replacement where one is needed, subject to availability. Round-the-clock care
    is quoted after assessment rather than published as a rate.`),

  answer("QA-10", "Can a Medic Connect nurse give injections or IV medication at home?", ["MOD-08"], `
    Yes, where it is appropriate to the care plan and within the professional scope of the nurse assigned.
    An injection visit is {{fee:PUB-INJECTION}} and IV care starts at {{fee:PUB-IV-CARE}}, after the formal
    assessment. Medic Connect also supports medication reconciliation and review, monitors adherence and
    response, maintains the medication record, and coordinates prescriptions and refills with the treating
    doctor and pharmacy. Medic Connect administers medicines that have been prescribed; it does not
    prescribe them. Prescription supply, medication delivery, home sample collection and laboratory testing
    are arranged through appropriately licensed pharmacies and laboratories.`),

  answer("QA-11", "What postnatal care does Medic Connect provide?", ["MOD-10"], `
    Postnatal clinical care is focused clinical support for mother and baby: maternal and newborn
    observations, wound and C-section checks, feeding and lactation support from a professional, and
    escalation where a concern is found. A postnatal mother and baby visit is {{fee:PUB-POSTNATAL-VISIT}},
    a breastfeeding support session is {{fee:PUB-BREASTFEEDING}}, C-section wound care is
    {{fee:PUB-CSECTION-WOUND}} per visit, and the Postnatal Essentials package starts at
    {{fee:PUB-POSTNATAL-ESSENTIALS}} for four weeks.`),

  answer("QA-12", "What is professional Omugwo?", ["MOD-10"], `
    Professional Omugwo is organised mother-and-baby support delivered by paid nurses and caregivers.
    Depending on the package it combines maternal and newborn care, feeding support, night support, meals
    and household help. It is a professional service, not a family arrangement, and it is not limited to
    nursing. It is broader than postnatal clinical care, which is focused clinical support for mother and
    baby.`),

  answer("QA-13", "Does Medic Connect provide antenatal care or home birth?", ["MOD-10"], `
    Medic Connect provides antenatal home support that is supplementary to hospital maternity care and can
    include observations, education, preparation and medication support. A routine antenatal visit is
    {{fee:PUB-ANTENATAL-VISIT}}, a high-risk pregnancy visit is {{fee:PUB-HIGH-RISK-ANTENATAL}}, and a
    trimester package starts at {{fee:PUB-ANTENATAL-TRIMESTER}}. Medic Connect does not provide home-birth
    services and does not replace hospital-based scans and maternity services.`),

  answer("QA-14", "Does Medic Connect provide nannies, and how is safeguarding handled?", ["MOD-11"], `
    Medic Connect provides nannies and newborn nannies, childcare, after-school support, school pickup and
    drop-off coordination, homework support, weekend and holiday cover, and early-years support. Agreed
    duties can include feeding and light child-related laundry. Specialist support, such as
    additional-needs and SEN support, shadow teaching, autism and ADHD support, and speech and occupational
    therapy input, is delivered by Medic Connect specialists or coordinated with specialist partners
    depending on the case. Professionals working with children complete safeguarding onboarding,
    safeguarding concerns follow documented escalation procedures, school pickup and drop-off is carried
    out only for children named in the care agreement, and a child is released only to the family or to
    people the family has named in writing in advance.`),

  answer("QA-15", "Can Medic Connect help after surgery or hospital discharge?", ["MOD-03"], `
    Yes. A hospital discharge transition visit is {{fee:PUB-DISCHARGE-TRANSITION}}. Post-operative support
    at home can include wound care from {{fee:PUB-WOUND-SIMPLE}} per visit, complex wound or VAC care from
    {{fee:PUB-WOUND-COMPLEX}} per visit, surgical drain management at {{fee:PUB-DRAIN}} per visit,
    medication and IV support, observations, and physiotherapy from {{fee:PUB-PHYSIO}} per session. What is
    provided is set by the assessment, the care plan and the professional scope of the staff assigned.`),

  answer("QA-16", "Can Medic Connect supply staff to a hospital, clinic or company?", ["MOD-12"], `
    Yes. Medic Connect supplies temporary and locum cover, contract staff and permanent placements across
    doctors, nurses, caregivers and healthcare assistants, pharmacists, laboratory scientists,
    radiographers, physiotherapists, administrative and front-of-house staff, and childcare and support
    roles. It fills single and hard-to-fill roles and builds complete teams. It also runs managed workforce
    arrangements and can manage a ward, department or wider operational function where the contract
    provides for it. Responsibilities differ by engagement and clinical governance sits where the contract
    places it. Staffing is scoped and quoted rather than published as a rate.`),

  answer("QA-17", "How do I join Medic Connect as a nurse, doctor or caregiver?", ["MOD-13"], `
    You can join the candidate pool or apply for an advertised opportunity at
    https://www.medicconnect.co/careers. Joining the candidate pool means your profile is registered and
    reviewed so you can be considered for suitable work; it is not an offer of work. Matching considers
    qualifications and registration, competencies, experience, location, availability and shift pattern,
    language and the requirements of the assignment. Engagement can be temporary or locum shifts, a
    contract, employment, or a permanent placement with a client organisation.`),

  answer("QA-18", "Can Medic Connect coordinate care for a relative in Nigeria while I live abroad?", ["MOD-14"], `
    Yes, where the person receiving care or their authorised representative has authorised it. Medic
    Connect can act as the local care coordinator, covering assessment and care planning, staffing,
    appointments and hospital accompaniment, medication and pharmacy, laboratory tests, equipment,
    transport, meals and housekeeping, companionship and daily living support, and escalation when
    something changes. Updates go to the person receiving care and the people they or their authorised
    representative have authorised. A managed postpartum return to Nigeria is a separate arrangement.`),

  answer("QA-19", "What is recorded during care, and who can see it?", ["MOD-07"], `
    Ongoing managed care is documented against the care plan. Records can include visit and shift notes,
    observations and vital signs, medication given, food and fluid intake, personal care, mobility, mood
    and wellbeing, activities, incidents and escalations, and the handover to the next professional on the
    roster. Care plans are reviewed as needs change. Each managed-care client has a named Medic Connect
    care management contact who holds the record and coordinates the team. Records are shared with the
    person receiving care and the people they or their authorised representative have authorised, subject
    to safeguarding and legal requirements.`),

  answer("QA-20", "Does Medic Connect provide medical cover for events?", ["MOD-15"], `
    Yes. Event medical cover is scoped before it is priced: Medic Connect reviews the event, the number of
    people attending, the activity and the risks, then plans the team and equipment required, deploys for
    the agreed hours, provides first response and triage on site within professional scope, and coordinates
    an ambulance or hospital transfer where one is needed. Cover is provided for schools, churches,
    children's events, sports, conferences, corporate and private events. Medic Connect is not an ambulance
    service.`),

  answer("QA-21", "Does Medic Connect support NGO programmes and clinical research?", ["MOD-16"], `
    Medic Connect works as a contracted delivery organisation for community, NGO and public health
    programmes: screenings, outreach, health education, campaigns, programme staffing, mobile and community
    clinics, logistics, clinical escalation and reporting. For clinical research it provides operational
    support: research staffing, participant recruitment support, site and home visits, sample collection,
    study coordination, data collection and follow-up, and logistics. Medic Connect is not the study
    sponsor, the ethics authority or the protocol owner unless it is contracted in that role, and training
    and regulatory requirements are confirmed per study.`),

  answer("QA-22", "How do I contact Medic Connect?", ["MOD-02"], `
    Phone +234 812 698 8237, email hello@medicconnect.co, WhatsApp https://wa.me/2348126988237, or use the
    care request form at https://www.medicconnect.co/contact. Medic Connect is not an emergency service; in
    an emergency, contact the emergency services.`),
];
