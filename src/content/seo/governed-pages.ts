/**
 * The Priority 1 page briefs, mirrored from the governed SEO registry
 * (`seo_pages`). Each page is composed only of approved modules and governed
 * public fees; nothing here states a fact that is not held in the registry.
 */
export interface GovernedPage {
  path: string;
  title: string;
  h1: string;
  metaDescription: string;
  /** The single promise sentence shown under the H1. */
  promise: string;
  intro: string[];
  moduleCodes: string[];
  feeSkus: string[];
  /** Set for paths that already have a hand-built public page. */
  hasExistingPage?: boolean;
}

export const GOVERNED_PAGES: GovernedPage[] = [
  {
    path: "/24-hour-nursing-care",
    title: "24-Hour Nursing Care at Home in Nigeria | Medic Connect",
    h1: "24-hour nursing care at home",
    metaDescription:
      "Continuous nursing cover at home from a rostered team working shifts with structured handovers. Assessment first, from ₦35,000. Lagos, Abuja, Ogun and Oyo.",
    promise: "Continuous cover at home, staffed by a rostered team rather than one person on duty all day.",
    intro: [
      "Twenty-four-hour nursing care is arranged after a formal assessment, which sets the care plan, the professionals required and the shift pattern.",
      "Cover is provided by a rostered team. Each shift hands over the record and the current clinical picture to the next.",
    ],
    moduleCodes: ["MOD-02", "MOD-09", "MOD-03", "MOD-08", "MOD-07", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT"],
  },
  {
    path: "/care-at-home",
    title: "Home Care Services in Nigeria | Medic Connect",
    h1: "Care at home",
    metaDescription:
      "Nursing, caregiving and doctor visits at home in Lagos, Abuja, Ogun and Oyo. Care follows a formal assessment, fixed at ₦35,000.",
    promise: "Nursing, caregiving and medical support delivered at home, set by a formal assessment.",
    intro: [
      "Medic Connect arranges nursing, caregiving, doctor visits and specialist support in the home.",
      "What is delivered is set by the assessment, the care plan and the professional scope of the staff assigned.",
    ],
    moduleCodes: ["MOD-02", "MOD-03", "MOD-09", "MOD-07", "MOD-08", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT", "PUB-NURSING-BASIC", "PUB-COMPANION-4H"],
    hasExistingPage: true,
  },
  {
    path: "/care-from-abroad",
    title: "Arranging Care in Nigeria from Abroad | Medic Connect",
    h1: "Care from abroad",
    metaDescription:
      "Medic Connect acts as local care coordinator for families living abroad: assessment, staffing, appointments, medication and escalation in Nigeria.",
    promise: "A local care coordinator in Nigeria for families who live overseas.",
    intro: [
      "Where the person receiving care or their authorised representative has authorised it, Medic Connect coordinates care on the ground in Nigeria.",
      "Updates go to the person receiving care and the people they have authorised.",
    ],
    moduleCodes: ["MOD-14", "MOD-02", "MOD-03", "MOD-07", "MOD-09", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT"],
    hasExistingPage: true,
  },
  {
    path: "/careers",
    title: "Healthcare Jobs and Careers in Nigeria | Medic Connect",
    h1: "Careers with Medic Connect",
    metaDescription:
      "Join the Medic Connect candidate pool or apply for an advertised opportunity. Nursing, medical, allied health, childcare and support roles across Nigeria.",
    promise: "Work with Medic Connect on locum shifts, contract work, employment or a permanent placement.",
    intro: [
      "Medic Connect engages doctors, nurses, caregivers, allied health professionals, childcare professionals and support staff.",
      "Joining the candidate pool registers your profile for consideration. It is not an offer of work.",
      "Work is offered as locum shifts, contract work, employment or a permanent placement.",
    ],
    moduleCodes: ["MOD-13", "MOD-01", "MOD-06"],
    feeSkus: [],
  },
  {
    path: "/careers/nursing",
    title: "Nursing Jobs in Nigeria | Medic Connect",
    h1: "Nursing careers",
    metaDescription:
      "Nursing work with Medic Connect: locum shifts, contracts, employment and permanent placements. Registration, competency and onboarding required.",
    promise: "Nursing work across shifts, contracts, employment and permanent placements.",
    intro: [
      "Registered nurses and midwives are engaged for home care, managed assignments and client organisations.",
      "Work is offered as locum shifts, contract work, employment or a permanent placement.",
    ],
    moduleCodes: ["MOD-13", "MOD-01", "MOD-06"],
    feeSkus: [],
  },
  {
    path: "/caregiver",
    title: "Professional Caregivers in Nigeria | Medic Connect",
    h1: "Caregiver services",
    metaDescription:
      "Vetted caregivers for personal care, companionship, mobility and appointment escort at home. Companion care from ₦18,000 per four hours.",
    promise: "Daily living support from vetted caregivers, supervised on managed assignments.",
    intro: [
      "Caregivers support personal care, mobility, meals, companionship, routine and appointment escort.",
      "The assessment sets the duties, the hours and the level of professional required.",
    ],
    moduleCodes: ["MOD-02", "MOD-09", "MOD-07", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT", "PUB-COMPANION-4H", "PUB-ESCORT"],
  },
  {
    path: "/catheter-care-at-home",
    title: "Catheter Care at Home in Nigeria | Medic Connect",
    h1: "Catheter care at home",
    metaDescription:
      "Nurse-led urinary catheter change, removal and ongoing catheter care at home. From ₦25,000 per visit after a formal assessment.",
    promise: "Nurse-led catheter care in the home, within clinical scope and the care plan.",
    intro: [
      "Catheter change, removal and routine catheter care are carried out by a registered nurse.",
      "Where a need falls outside what can safely be delivered at home, Medic Connect says so and coordinates the referral.",
    ],
    moduleCodes: ["MOD-03", "MOD-02", "MOD-08", "MOD-07", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT", "PUB-CATHETER", "PUB-NURSING-SKILLED"],
  },
  {
    path: "/chronic-care-at-home",
    title: "Chronic Disease Care at Home in Nigeria | Medic Connect",
    h1: "Chronic condition care at home",
    metaDescription:
      "Home management for diabetes, hypertension, heart and respiratory conditions: monitoring, medication support and escalation. From ₦90,000 per month.",
    promise: "Ongoing monitoring, medication support and escalation for long-term conditions.",
    intro: [
      "Chronic condition care is documented against the care plan and reviewed as the condition and circumstances change.",
      "Medicines are administered as prescribed by the treating doctor; Medic Connect does not prescribe.",
    ],
    moduleCodes: ["MOD-03", "MOD-08", "MOD-07", "MOD-02", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT", "PUB-CHRONIC-MONTHLY", "PUB-NURSING-BASIC"],
  },
  {
    path: "/clinical-home-care",
    title: "Clinical Home Nursing Care in Nigeria | Medic Connect",
    h1: "Clinical home care",
    metaDescription:
      "Registered nurses at home for medication, injections, IV therapy, wounds, observations and post-operative care. Visits from ₦20,000.",
    promise: "Registered nursing care at home, within the care plan and professional scope.",
    intro: [
      "Clinical home care covers medication and injections, IV therapy, observations, wound care, catheter and stoma care and post-operative support.",
      "Home care does not replace hospital treatment that requires a hospital setting.",
    ],
    moduleCodes: ["MOD-03", "MOD-02", "MOD-08", "MOD-09", "MOD-07", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT", "PUB-NURSING-BASIC", "PUB-NURSING-SKILLED", "PUB-NURSING-SHIFT-8H"],
    hasExistingPage: true,
  },
  {
    path: "/doctor-home-visits",
    title: "Doctor Home Visits in Nigeria | Medic Connect",
    h1: "Doctor home visits",
    metaDescription:
      "GP and specialist doctor visits at home, plus teleconsultation. GP home visit ₦40,000, teleconsultation ₦7,500.",
    promise: "A doctor at home, or on a call, when attending a clinic is difficult.",
    intro: [
      "Home visits cover assessment, review, diagnosis within what is possible at home, and prescribing by the attending doctor.",
      "Laboratory tests and prescription supply are arranged through appropriately licensed laboratories and pharmacies.",
    ],
    moduleCodes: ["MOD-03", "MOD-02", "MOD-08", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT", "PUB-GP-HOME-VISIT", "PUB-SPECIALIST-HOME-VISIT", "PUB-TELE-DOCTOR"],
  },
  {
    path: "/eldercare",
    title: "Eldercare at Home in Nigeria | Medic Connect",
    h1: "Eldercare at home",
    metaDescription:
      "Nursing and caregiver support for older adults at home: personal care, companionship, medication, monitoring and appointment escort.",
    promise: "Support for older adults at home, from companionship to nursing care.",
    intro: [
      "Eldercare combines daily living support with clinical care where the assessment shows it is needed.",
      "A named care management contact holds the record and coordinates the team.",
    ],
    moduleCodes: ["MOD-02", "MOD-03", "MOD-07", "MOD-09", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT", "PUB-COMPANION-4H", "PUB-ESCORT", "PUB-NURSING-BASIC"],
    hasExistingPage: true,
  },
  {
    path: "/event-medical-cover",
    title: "Event Medical Cover in Nigeria | Medic Connect",
    h1: "Event medical cover",
    metaDescription:
      "On-site medical cover for schools, churches, sports, conferences and private events. Scoped to the event, then quoted.",
    promise: "On-site first response and triage, scoped to the event before it is priced.",
    intro: [
      "Cover is planned from the event, the number of people attending, the activity and the risks.",
      "Medic Connect is not an ambulance service; ambulances and medical transport are arranged through third-party providers.",
    ],
    moduleCodes: ["MOD-15", "MOD-09", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: [],
  },
  {
    path: "/for-facilities",
    title: "Healthcare Staffing for Facilities in Nigeria | Medic Connect",
    h1: "For hospitals and facilities",
    metaDescription:
      "Locum cover, contract staff, permanent placements and managed workforce arrangements for hospitals, clinics and corporate clients.",
    promise: "Staff supply and managed workforce arrangements, with responsibility set by contract.",
    intro: [
      "Medic Connect fills single and hard-to-fill roles, builds complete teams and runs managed workforce arrangements.",
      "In a supply engagement, clinical governance remains with the client organisation.",
    ],
    moduleCodes: ["MOD-12", "MOD-13", "MOD-09", "MOD-01", "MOD-05", "MOD-06"],
    feeSkus: [],
    hasExistingPage: true,
  },
  {
    path: "/guides/what-does-an-omugwo-caregiver-do",
    title: "What Does an Omugwo Caregiver Do? | Medic Connect",
    h1: "What does an Omugwo caregiver do?",
    metaDescription:
      "Professional Omugwo explained: mother and baby care, feeding support, night support, meals and household help, delivered by paid nurses and caregivers.",
    promise: "A plain explanation of professional Omugwo and how it differs from postnatal clinical care.",
    intro: [
      "Omugwo is the traditional period of support after birth. Professional Omugwo delivers that support through paid nurses and caregivers rather than family members.",
      "What is included depends on the package agreed after assessment.",
    ],
    moduleCodes: ["MOD-10", "MOD-11", "MOD-02", "MOD-01"],
    feeSkus: [],
  },
  {
    path: "/nanny-childcare",
    title: "Professional Nanny and Childcare Services in Nigeria | Medic Connect",
    h1: "Nanny and childcare services",
    metaDescription:
      "Vetted nannies, newborn nannies, after-school and holiday cover, with safeguarding onboarding and written authorisation for school pickup.",
    promise: "Vetted childcare professionals, with safeguarding onboarding and named pickup authorisation.",
    intro: [
      "Duties are agreed in the care agreement and can include feeding, routine, homework support and light child-related laundry.",
      "A child is released only to the family or to people the family has named in writing in advance.",
    ],
    moduleCodes: ["MOD-11", "MOD-02", "MOD-09", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT"],
    hasExistingPage: true,
  },
  {
    path: "/newborn-care",
    title: "Newborn Care at Home in Nigeria | Medic Connect",
    h1: "Newborn care at home",
    metaDescription:
      "Newborn nurses and nannies at home: newborn observations, feeding support, night support and escalation where a concern is found.",
    promise: "Professional support for a newborn at home, clinical or practical as needed.",
    intro: [
      "Newborn care can be clinical, practical, or both, depending on what the assessment finds.",
      "Where a concern is found, it is escalated to the treating clinician.",
    ],
    moduleCodes: ["MOD-10", "MOD-11", "MOD-02", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT"],
  },
  {
    path: "/ngo-healthcare-staffing",
    title: "NGO and Programme Healthcare Staffing in Nigeria | Medic Connect",
    h1: "NGO and programme healthcare staffing",
    metaDescription:
      "Contracted delivery for community, NGO and public health programmes: screenings, outreach, staffing, mobile clinics, logistics and reporting.",
    promise: "A contracted delivery organisation for community and public health programmes.",
    intro: [
      "Medic Connect staffs and delivers programmes, including mobile and community clinics, outreach and campaigns.",
      "For clinical research, Medic Connect provides operational support and is not the sponsor, ethics authority or protocol owner unless contracted in that role.",
    ],
    moduleCodes: ["MOD-16", "MOD-12", "MOD-13", "MOD-01", "MOD-06"],
    feeSkus: [],
  },
  {
    path: "/nurse-staffing",
    title: "Nurse Staffing and Locum Cover in Nigeria | Medic Connect",
    h1: "Nurse staffing",
    metaDescription:
      "Locum shifts, contract nurses and permanent nursing placements for hospitals, clinics and corporate clients across Nigeria.",
    promise: "Nurses supplied for shifts, contracts and permanent roles, vetted before deployment.",
    intro: [
      "Requirements are matched on registration, competency, experience, location, availability and shift pattern.",
      "Responsibilities differ by engagement, and clinical governance sits where the contract places it.",
    ],
    moduleCodes: ["MOD-12", "MOD-13", "MOD-09", "MOD-01", "MOD-05", "MOD-06"],
    feeSkus: [],
  },
  {
    path: "/omugwo",
    title: "Omugwo Services in Nigeria | Medic Connect",
    h1: "Omugwo",
    metaDescription:
      "Professional Omugwo: mother and baby care, feeding and night support, meals and household help from paid nurses and caregivers.",
    promise: "Organised mother-and-baby support after birth, delivered by professionals.",
    intro: [
      "Omugwo support is arranged after an assessment that sets the package, the professionals and the hours.",
      "It is a professional service, not a family arrangement, and it is not limited to nursing.",
    ],
    moduleCodes: ["MOD-10", "MOD-02", "MOD-09", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT"],
  },
  {
    path: "/palliative-care-at-home",
    title: "Palliative Care at Home in Nigeria | Medic Connect",
    h1: "Palliative care at home",
    metaDescription:
      "Nurse-led comfort, symptom and medication support at home, documented against the care plan and escalated to the treating clinician.",
    promise: "Comfort, symptom and medication support at home, within the care plan.",
    intro: [
      "Palliative support covers symptom management within nursing scope, medication administration, personal care and family support.",
      "Care is coordinated with the treating clinician, and concerns are escalated rather than managed in isolation.",
    ],
    moduleCodes: ["MOD-03", "MOD-08", "MOD-07", "MOD-02", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT"],
  },
  {
    path: "/physiotherapy-at-home",
    title: "Physiotherapy at Home in Nigeria | Medic Connect",
    h1: "Physiotherapy at home",
    metaDescription:
      "Home physiotherapy assessment and sessions, chest physiotherapy and neuro-rehabilitation. Sessions from ₦30,000.",
    promise: "Physiotherapy delivered at home, from assessment through to rehabilitation sessions.",
    intro: [
      "A physiotherapy assessment sets the programme, the frequency and the goals.",
      "Chest physiotherapy and neuro-rehabilitation are provided where clinically appropriate.",
    ],
    moduleCodes: ["MOD-03", "MOD-02", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT", "PUB-PHYSIO", "PUB-CHEST-PHYSIO", "PUB-NEURO-REHAB"],
  },
  {
    path: "/post-surgical-care",
    title: "Post-Surgical Care at Home in Nigeria | Medic Connect",
    h1: "Post-surgical care at home",
    metaDescription:
      "Discharge transition, wound care, drain and medication management at home after surgery. Discharge transition visit ₦50,000.",
    promise: "Recovery support at home after surgery, from discharge through wound healing.",
    intro: [
      "Post-surgical care covers the discharge transition, wound and dressing care, medication, observations and escalation.",
      "Complex wound and VAC care is provided where it is clinically appropriate at home.",
    ],
    moduleCodes: ["MOD-03", "MOD-08", "MOD-07", "MOD-02", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT", "PUB-DISCHARGE-TRANSITION", "PUB-WOUND-SIMPLE", "PUB-WOUND-COMPLEX"],
    hasExistingPage: true,
  },
  {
    path: "/postnatal-care",
    title: "Postnatal Care at Home in Nigeria | Medic Connect",
    h1: "Postnatal care at home",
    metaDescription:
      "Maternal and newborn observations, C-section wound care and professional breastfeeding support at home. Visits from ₦30,000.",
    promise: "Clinical support for mother and baby in the weeks after birth.",
    intro: [
      "Postnatal clinical care covers maternal and newborn observations, wound and C-section checks and feeding support.",
      "Antenatal home support is supplementary to hospital maternity care; Medic Connect does not provide home-birth services.",
    ],
    moduleCodes: ["MOD-10", "MOD-03", "MOD-08", "MOD-02", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT", "PUB-POSTNATAL-VISIT", "PUB-CSECTION-WOUND", "PUB-BREASTFEEDING"],
    hasExistingPage: true,
  },
  {
    path: "/professional-nanny",
    title: "Professional Nanny Services in Nigeria | Medic Connect",
    h1: "Professional nanny services",
    metaDescription:
      "Trained, vetted nannies for newborns, toddlers and school-age children, with safeguarding onboarding and named pickup authorisation.",
    promise: "A trained nanny, matched to the household and the children named in the care agreement.",
    intro: [
      "Nannies are matched on experience, the ages of the children, the routine and the hours required.",
      "Specialist child support is delivered by Medic Connect specialists or coordinated with specialist partners.",
    ],
    moduleCodes: ["MOD-11", "MOD-02", "MOD-09", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT"],
  },
  {
    path: "/professional-omugwo",
    title: "Professional Omugwo Care in Nigeria | Medic Connect",
    h1: "Professional Omugwo",
    metaDescription:
      "Paid nurses and caregivers delivering Omugwo: maternal and newborn care, feeding and night support, meals and household help.",
    promise: "Omugwo delivered as a managed professional service, documented and supervised.",
    intro: [
      "Professional Omugwo combines clinical and practical support, depending on the package agreed.",
      "Managed care is documented against the care plan, with a named care management contact.",
    ],
    moduleCodes: ["MOD-10", "MOD-02", "MOD-07", "MOD-09", "MOD-01", "MOD-04", "MOD-05", "MOD-06"],
    feeSkus: ["PUB-ASSESSMENT"],
  },
];

export const GOVERNED_PAGE_BY_PATH: Record<string, GovernedPage> = Object.fromEntries(
  GOVERNED_PAGES.map((page) => [page.path, page]),
);

/** Paths that need a rendered route: the hand-built pages keep their own. */
export const GENERATED_PAGE_PATHS = GOVERNED_PAGES.filter((page) => !page.hasExistingPage).map((page) => page.path);
