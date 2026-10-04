/**
 * Expansion pages composed only from approved modules and governed public fees.
 * Each URL has a distinct purpose; the established Hospital Staffing page is not duplicated.
 */
import clinicalHero from "@/assets/hero/clinical-hero.jpg";
import eldercareHero from "@/assets/hero/eldercare-hero.jpg";
import hospitalStaffingHero from "@/assets/hero/hospital-staffing-hero.jpg";
import nannyHero from "@/assets/hero/nanny-hero.jpg";
import pediatricHero from "@/assets/hero/pediatric-hero.jpg";
import postnatalHero from "@/assets/hero/postnatal-hero.jpg";
import antenatalHero from "@/assets/hero/antenatal-hero.jpg";
import researchHero from "@/assets/hero/clinical-research-hero.jpg";

import skilledNursing from "@/assets/services/skilled-nursing.jpg";
import woundCare from "@/assets/services/wound-care.jpg";
import postOperative from "@/assets/services/post-operative.jpg";
import eldercareDailyLiving from "@/assets/services/eldercare-daily-living.jpg";
import eldercareCompanionship from "@/assets/services/eldercare-companionship.jpg";
import eldercareMobility from "@/assets/services/eldercare-mobility.jpg";
import pediatricSchool from "@/assets/services/pediatric-school.jpg";
import pediatricDevelopment from "@/assets/services/pediatric-development.jpg";
import pediatricTherapy from "@/assets/services/pediatric-therapy.jpg";
import hospitalLocum from "@/assets/services/hospital-locum-services.jpg";
import hospitalTemporary from "@/assets/services/hospital-temporary-staffing.jpg";
import hospitalPermanent from "@/assets/services/hospital-permanent-placements.jpg";
import nannyInfant from "@/assets/services/nanny-infant-toddler.jpg";
import postnatalCare from "@/assets/services/postnatal-care.jpg";
import antenatalCare from "@/assets/services/antenatal-care.jpg";
import clinicalResearch from "@/assets/services/clinical-research.jpg";
import { EXPANSION_PAGE_ANSWERS } from "@/content/seo/expansion-page-answers";
import { EXPANSION_REDIRECTS } from "@/content/seo/index-policy";
import { PROCESS_SUMMARIES } from "@/content/seo/process-summaries";

export type ExpansionTemplate = "care" | "childcare" | "staffing" | "jobs" | "guide";
export interface ExpansionCard { title: string; description: string; image: string; }
export interface ExpansionPage { path: string; template: ExpansionTemplate; title: string; metaDescription: string; h1: string; promise: string; answerHeading: string; intro: string[]; answerPoints: string[]; audience: string[]; cards: ExpansionCard[]; heroImage: string; moduleCodes: string[]; feeSkus: string[]; comparison?: { heading: string; rows: { label: string; left: string; right: string }[]; leftLabel: string; rightLabel: string }; checklist?: { heading: string; items: string[] }; related: { label: string; path: string }[]; }

type PageSeed = { slug: string; h1: string; template: ExpansionTemplate; focus: string; audience: string[]; modules: string[]; fees: string[] };
const seed = (slug: string, h1: string, template: ExpansionTemplate, focus: string, audience: string, modules: string, fees: string): PageSeed => ({ slug, h1, template, focus, audience: audience ? audience.split("|") : [], modules: modules.split(",").filter(Boolean), fees: fees.split(",").filter(Boolean) });

const PAGE_SEEDS: PageSeed[] = [
  seed("autism-support-at-home", "Autism support at home", "childcare", "structured home support for an autistic child", "Children who need predictable support|Families coordinating home and school routines|Children building daily-living skills|Families seeking specialist input", "MOD-02,MOD-11,MOD-06", "PUB-ASSESSMENT"),
  seed("shadow-teacher", "Shadow teacher", "childcare", "one-to-one support for a child in school", "Children with additional learning needs|Children who need classroom support|Families agreeing a school support plan|Schools arranging support for a named pupil", "MOD-02,MOD-11,MOD-01", "PUB-ASSESSMENT"),
  seed("speech-therapist-for-children", "Speech therapist for children", "childcare", "speech and communication support for children", "Children with speech or language needs|Children needing communication support|Families following a therapy plan|Schools coordinating specialist support", "MOD-02,MOD-11,MOD-06", "PUB-ASSESSMENT"),
  seed("what-does-a-shadow-teacher-do", "What does a shadow teacher do?", "guide", "a clear account of one-to-one classroom support", "", "MOD-11,MOD-02", ""),
  seed("wound-dressing-at-home", "Wound dressing at home", "care", "nurse-led wound dressing and review at home", "People recovering from surgery|People with pressure or diabetic wounds|People discharged with a dressing regime|Families arranging regular dressing changes", "MOD-02,MOD-03,MOD-04,MOD-05", "PUB-ASSESSMENT,PUB-WOUND-SIMPLE,PUB-WOUND-COMPLEX"),
  seed("community-health-outreach-services", "Community health outreach services", "staffing", "staffed community screening, education and outreach programmes", "NGOs and foundations|Public health programmes|Community organisations|Employers commissioning outreach", "MOD-16,MOD-12,MOD-01,MOD-06", ""),
  seed("hospital-to-home-care", "Hospital-to-home care", "care", "a planned transition from hospital into care at home", "People preparing for discharge|People recovering after admission|Families coordinating follow-up care|People needing equipment or skilled support", "MOD-02,MOD-03,MOD-04,MOD-07", "PUB-ASSESSMENT,PUB-DISCHARGE-TRANSITION"),
  seed("live-in-caregiver", "Live-in caregiver", "care", "one trusted caregiver living in the home, for daily living, company and routine", "Older people living at home|Adults needing daily-living support|Families arranging continuous presence|People needing companionship and routine", "MOD-02,MOD-05,MOD-07,MOD-09", "PUB-ASSESSMENT"),
  seed("managed-postpartum-stay-in-nigeria", "Managed postpartum stay in Nigeria", "care", "a coordinated return-to-Nigeria and postpartum support arrangement", "Mothers returning to Nigeria after birth|Families arranging mother-and-baby support|Parents needing night support|Families coordinating appointments and logistics", "MOD-10,MOD-14,MOD-02,MOD-05", "PUB-ASSESSMENT,PUB-POSTNATAL-VISIT,PUB-BREASTFEEDING"),
  seed("stroke-recovery-at-home", "Stroke recovery at home", "care", "nursing, rehabilitation and daily-living support after stroke", "People returning home after stroke|People needing neuro-rehabilitation|Families arranging mobility support|People needing nursing observations", "MOD-02,MOD-03,MOD-07,MOD-09", "PUB-ASSESSMENT,PUB-NURSING-SKILLED,PUB-NEURO-REHAB"),
  seed("clinical-research-staffing", "Clinical research staffing", "staffing", "operational research staff for site, home and community delivery", "Research sponsors and delivery partners|Clinical research sites|Community research programmes|Organisations needing field teams", "MOD-16,MOD-12,MOD-01,MOD-06", ""),
  seed("medic-connect-talent-pool", "Medic Connect candidate pool", "jobs", "registration for consideration for suitable healthcare and support work", "Doctors and nurses|Allied health professionals|Caregivers and healthcare assistants|Childcare and support professionals", "MOD-13,MOD-01,MOD-06", ""),
  seed("additional-needs-childcare", "Additional needs childcare", "childcare", "childcare planned around a child’s additional needs", "Children needing structured routines|Children needing one-to-one support|Families coordinating specialist input|Families requiring respite support", "MOD-02,MOD-11,MOD-07", "PUB-ASSESSMENT"),
  seed("speech-delay-support", "Speech delay support", "childcare", "coordinated support for a child with delayed speech", "Children with delayed speech|Families awaiting or following assessment|Children practising communication routines|Schools coordinating support", "MOD-02,MOD-11,MOD-07", "PUB-ASSESSMENT"),
  seed("blood-sample-collection-at-home", "Blood sample collection at home", "care", "home phlebotomy coordinated with an appropriately licensed laboratory", "People with limited mobility|People needing ordered laboratory tests|Families arranging home collection|People needing follow-up monitoring", "MOD-02,MOD-03,MOD-04,MOD-08", "PUB-ASSESSMENT,PUB-PHLEBOTOMY"),
  seed("iv-therapy-at-home", "IV therapy at home", "care", "prescribed IV care delivered by a nurse where home is suitable", "People with a prescribed IV treatment plan|People discharged with continuing IV care|Families arranging a skilled nursing visit|People assessed as suitable for home treatment", "MOD-02,MOD-03,MOD-04,MOD-08", "PUB-ASSESSMENT,PUB-IV-CARE"),
  seed("injection-at-home", "Injection at home", "care", "a prescribed injection administered at home by a nurse", "People with a prescribed injection|People with limited mobility|Families arranging a nursing visit|People assessed as suitable for home administration", "MOD-02,MOD-03,MOD-04,MOD-08", "PUB-ASSESSMENT,PUB-INJECTION"),
  seed("ngo-health-programme-implementation", "NGO health programme implementation", "staffing", "contracted delivery support for community and public health programmes", "Health NGOs|Foundations|Public health programmes|Development partners", "MOD-16,MOD-12,MOD-01,MOD-06", ""),
  seed("home-care-vs-care-home", "Home care vs care home", "guide", "a practical comparison of support at home and residential care", "", "MOD-02,MOD-03,MOD-05,MOD-07", "PUB-ASSESSMENT"),
  seed("nurse-vs-caregiver", "Nurse vs caregiver", "guide", "the difference between clinical nursing and daily-living support", "", "MOD-02,MOD-03,MOD-05", "PUB-ASSESSMENT,PUB-NURSING-BASIC,PUB-COMPANION-4H"),
  seed("who-do-i-need-after-surgery", "Who do I need after surgery?", "guide", "how clinical needs and daily-living needs determine the right support", "", "MOD-02,MOD-03,MOD-07,MOD-09", "PUB-ASSESSMENT,PUB-DISCHARGE-TRANSITION,PUB-WOUND-SIMPLE"),
  seed("who-should-i-hire-for-a-newborn", "Who should I hire for a newborn?", "guide", "the difference between postnatal clinical care, a newborn nanny and professional Omugwo", "", "MOD-10,MOD-11,MOD-02,MOD-05", "PUB-ASSESSMENT,PUB-POSTNATAL-VISIT"),
  seed("how-medic-connect-home-care-works", "How Medic Connect home care works", "guide", "the steps from formal assessment to a documented care plan and managed care", "", "MOD-02,MOD-01,MOD-07,MOD-09", "PUB-ASSESSMENT"),
  seed("care-for-elderly-parents", "Care for elderly parents", "care", "planned nursing, caregiver and companionship support for older parents", "Older people living independently|Parents needing daily-living support|Families coordinating care from abroad|Older people with clinical needs", "MOD-02,MOD-03,MOD-07,MOD-14", "PUB-ASSESSMENT,PUB-COMPANION-4H"),
  seed("healthcare-facility-management-support", "Healthcare facility management support", "staffing", "managed workforce and operational support for healthcare facilities", "Hospitals and clinics|Diagnostic centres|Facilities needing managed departments|Organisations commissioning operational support", "MOD-12,MOD-01,MOD-06", ""),
  seed("hospital-support-services", "Hospital support services", "staffing", "clinical, administrative and facilities support for hospitals", "Hospitals|Clinics and day-case centres|Diagnostic centres|Healthcare organisations building support teams", "MOD-12,MOD-01,MOD-06", ""),
  seed("coming-to-nigeria-after-giving-birth", "Coming to Nigeria after giving birth", "guide", "how to plan postpartum care, travel, accommodation and local support", "", "MOD-10,MOD-14,MOD-02,MOD-05", "PUB-ASSESSMENT,PUB-POSTNATAL-VISIT"),
  seed("night-nurse-for-newborn", "Night nurse for a newborn", "care", "overnight newborn support, so parents can rest while a professional watches, feeds and settles the baby", "New parents needing overnight support|Mothers recovering after birth|Families establishing feeding routines|Newborns needing professional observation", "MOD-10,MOD-02,MOD-07,MOD-09", "PUB-ASSESSMENT,PUB-POSTNATAL-VISIT"),
  seed("live-in-nanny", "Live-in nanny", "childcare", "a nanny who lives in your home, with hours, rest days and duties agreed in writing before they start", "Families needing daily childcare|Parents needing consistent routines|Families with infants or young children|Families requiring agreed household support", "MOD-02,MOD-11,MOD-05,MOD-07", "PUB-ASSESSMENT"),
  seed("c-section-recovery-at-home", "C-section recovery at home", "care", "postnatal nursing and practical support after a Caesarean birth", "Mothers recovering from a Caesarean birth|Families needing wound checks|Parents arranging feeding support|Families needing practical newborn support", "MOD-10,MOD-02,MOD-03,MOD-04", "PUB-ASSESSMENT,PUB-CSECTION-WOUND,PUB-POSTNATAL-VISIT"),
  seed("care-after-hospital-discharge", "Care after hospital discharge", "care", "assessment-led care for a safe return home after hospital treatment", "People preparing to leave hospital|People needing wound or medicine support|Families arranging equipment and routines|People needing rehabilitation at home", "MOD-02,MOD-03,MOD-07,MOD-09", "PUB-ASSESSMENT,PUB-DISCHARGE-TRANSITION"),
  seed("equipment-needed-after-hospital-discharge", "Equipment needed after hospital discharge", "guide", "an assessment-led checklist for equipment and supplies at home", "", "MOD-02,MOD-03,MOD-05,MOD-07", "PUB-ASSESSMENT"),
  seed("how-to-prepare-the-home-before-hospital-discharge", "How to prepare the home before hospital discharge", "guide", "a practical home-readiness checklist before discharge", "", "MOD-02,MOD-03,MOD-04,MOD-07", "PUB-ASSESSMENT,PUB-DISCHARGE-TRANSITION"),
  seed("physiotherapy-after-stroke", "Physiotherapy after stroke", "care", "home neuro-rehabilitation planned around mobility and recovery goals", "People recovering after stroke|People rebuilding mobility|Families supporting rehabilitation|People needing coordinated nursing and therapy", "MOD-02,MOD-03,MOD-07", "PUB-ASSESSMENT,PUB-NEURO-REHAB"),
  seed("caregiver-jobs-and-opportunities", "Caregiver jobs and opportunities", "jobs", "caregiver shifts, live-in assignments, contracts, employment and permanent placements", "Experienced caregivers|Care assistants and support workers|Caregivers seeking live-in assignments|Caregivers seeking permanent placement", "MOD-13,MOD-01,MOD-06", ""),
  seed("nanny-jobs-and-opportunities", "Nanny jobs and opportunities", "jobs", "nanny and childcare work through assignments, employment and permanent placements", "Experienced nannies|Newborn nannies|After-school childcare professionals|Childcare professionals seeking placement", "MOD-13,MOD-11,MOD-01,MOD-06", ""),
  seed("adhd-support-at-home", "ADHD support at home", "childcare", "structured routines and specialist-coordinated support for a child with ADHD", "Children who need support with routines|Children building daily-living skills|Families coordinating school and home plans|Families seeking specialist input", "MOD-02,MOD-11,MOD-07", "PUB-ASSESSMENT"),
  seed("school-companion", "School companion", "childcare", "one-to-one practical support for a named child during the school day", "Children needing support at school|Children with additional needs|Families agreeing duties with a school|Schools arranging support for a named pupil", "MOD-02,MOD-11,MOD-01", "PUB-ASSESSMENT"),
  seed("occupational-therapy-for-children", "Occupational therapy for children", "childcare", "occupational therapy input coordinated around a child’s assessed needs", "Children developing daily-living skills|Children with sensory or motor needs|Families following a therapy plan|Schools coordinating specialist support", "MOD-02,MOD-11,MOD-07", "PUB-ASSESSMENT"),
  seed("early-intervention-support", "Early intervention support", "childcare", "coordinated early-years support for identified developmental needs", "Young children with developmental needs|Families seeking early support|Children following a specialist plan|Families coordinating home and nursery", "MOD-02,MOD-11,MOD-07", "PUB-ASSESSMENT"),
  seed("behaviour-support", "Behaviour support", "childcare", "structured support based on a child’s needs, routines and agreed plan", "Children needing structured support|Families managing challenging situations|Children following a specialist plan|Schools coordinating consistent routines", "MOD-02,MOD-11,MOD-07", "PUB-ASSESSMENT"),
  seed("stoma-care-at-home", "Stoma care at home", "care", "nurse-led stoma care, review and documentation at home", "People living with a stoma|People recently discharged after surgery|Families arranging skilled nursing visits|People needing review of the care routine", "MOD-02,MOD-03,MOD-04,MOD-07", "PUB-ASSESSMENT,PUB-STOMA"),
  seed("peg-feeding-support-at-home", "PEG feeding support at home", "care", "PEG support by appropriately skilled nurses where home care is suitable", "People with a PEG feeding plan|People discharged with enteral feeding|Families arranging skilled nursing|People needing documented ongoing support", "MOD-02,MOD-03,MOD-04,MOD-07", "PUB-ASSESSMENT,PUB-NURSING-SKILLED"),
  seed("tracheostomy-care-at-home", "Tracheostomy care at home", "care", "complex tracheostomy support at home where clinically appropriate", "People discharged with a tracheostomy|Families arranging complex nursing|People needing continuous observation|People assessed as suitable for home care", "MOD-02,MOD-03,MOD-04,MOD-09", "PUB-ASSESSMENT,PUB-NURSING-SKILLED"),
  seed("ventilator-care-at-home", "Ventilator care at home", "care", "complex ventilator support at home where clinically appropriate", "People using assisted ventilation|Families arranging complex nursing|People needing rostered observation|People assessed as suitable for home care", "MOD-02,MOD-03,MOD-04,MOD-09", "PUB-ASSESSMENT,PUB-NURSING-SKILLED"),
  seed("medication-administration-at-home", "Medication administration at home", "care", "prescribed medicines administered at home within nursing scope", "People with prescribed medicines|People needing a nursing visit|Families coordinating medicine routines|People needing a documented medication record", "MOD-02,MOD-03,MOD-04,MOD-08", "PUB-ASSESSMENT,PUB-NURSING-BASIC"),
  seed("blood-pressure-monitoring-at-home", "Blood pressure monitoring at home", "care", "home observations recorded against an agreed care plan", "People monitoring hypertension|People recovering after illness|Older people needing regular checks|Families coordinating ongoing observations", "MOD-02,MOD-03,MOD-04,MOD-07", "PUB-ASSESSMENT,PUB-WELLNESS-CHECK"),
  seed("blood-sugar-monitoring-at-home", "Blood sugar monitoring at home", "care", "home blood glucose observations recorded against the care plan", "People living with diabetes|People needing regular observations|Older people needing monitoring|Families coordinating ongoing care", "MOD-02,MOD-03,MOD-04,MOD-07", "PUB-ASSESSMENT,PUB-WELLNESS-CHECK"),
  seed("continence-care-at-home", "Continence care at home", "care", "private, dignified help with continence for a parent or relative at home", "Older people living at home|People with mobility limitations|People needing catheter support|Families arranging personal care", "MOD-02,MOD-03,MOD-07,MOD-09", "PUB-ASSESSMENT,PUB-CATHETER"),
  seed("diabetes-care-at-home", "Diabetes care at home", "care", "nursing observations, medicine support and daily routines for diabetes", "People living with diabetes|People needing medicine support|People needing foot or wound review|Families coordinating chronic care", "MOD-02,MOD-03,MOD-07,MOD-08", "PUB-ASSESSMENT,PUB-CHRONIC-MONTHLY"),
  seed("cancer-care-at-home", "Cancer care at home", "care", "supportive nursing and daily-living care at home alongside hospital treatment", "People receiving cancer treatment|People needing symptom support|Families arranging daily-living care|People transitioning between hospital and home", "MOD-02,MOD-03,MOD-04,MOD-07", "PUB-ASSESSMENT,PUB-NURSING-SKILLED"),
  seed("diabetic-foot-care-at-home", "Diabetic foot care at home", "care", "nurse-led wound care for diabetic foot problems where home treatment is suitable", "People living with diabetic foot wounds|People needing regular dressing changes|Families arranging nursing visits|People needing escalation when a wound changes", "MOD-02,MOD-03,MOD-04,MOD-07", "PUB-ASSESSMENT,PUB-WOUND-COMPLEX"),
  seed("orthopaedic-recovery-at-home", "Recovery at home after a hip replacement or fracture", "care", "nursing, physiotherapy and mobility help after a hip or knee replacement or a broken bone", "People recovering after orthopaedic surgery|People rebuilding mobility|Families arranging home support|People needing wound or medicine care", "MOD-02,MOD-03,MOD-07,MOD-09", "PUB-ASSESSMENT,PUB-DISCHARGE-TRANSITION,PUB-PHYSIO"),
  seed("antenatal-care-at-home", "Antenatal care at home", "care", "supplementary antenatal observations, education and preparation at home", "Pregnant women needing routine support|Families preparing for birth|Women needing prescribed medicine support|People coordinating home and hospital maternity care", "MOD-10,MOD-02,MOD-03,MOD-04", "PUB-ASSESSMENT,PUB-ANTENATAL-VISIT,PUB-ANTENATAL-TRIMESTER"),
  seed("high-risk-pregnancy-support-at-home", "High-risk pregnancy support at home", "care", "supplementary home support alongside hospital-led high-risk maternity care", "Women under high-risk maternity care|Families coordinating hospital appointments|Women needing prescribed observations|Families preparing support at home", "MOD-10,MOD-02,MOD-03,MOD-04", "PUB-ASSESSMENT,PUB-HIGH-RISK-ANTENATAL"),
  seed("breastfeeding-support-at-home", "Breastfeeding support at home", "care", "professional feeding support for mother and baby at home", "Mothers establishing breastfeeding|Families needing feeding guidance|Mothers recovering after birth|Parents coordinating newborn support", "MOD-10,MOD-02,MOD-07", "PUB-ASSESSMENT,PUB-BREASTFEEDING"),
  seed("nicu-to-home-support", "NICU-to-home support", "care", "assessment-led preparation and support after neonatal intensive care discharge", "Babies preparing to leave NICU|Parents arranging skilled support|Families coordinating hospital follow-up|Newborns with documented care needs", "MOD-10,MOD-02,MOD-03,MOD-04", "PUB-ASSESSMENT,PUB-DISCHARGE-TRANSITION"),
  seed("medical-escort-services", "Medical escort services", "care", "professional accompaniment and coordination for medical appointments", "Older people attending appointments|People with mobility needs|Families arranging hospital accompaniment|People needing a documented handover", "MOD-02,MOD-04,MOD-07,MOD-14", "PUB-ASSESSMENT,PUB-ESCORT"),
  seed("transport-to-medical-appointments", "Transport to medical appointments", "guide", "how Medic Connect coordinates third-party transport and appointment support", "", "MOD-04,MOD-14,MOD-05", "PUB-ESCORT"),
  seed("doctor-staffing", "Doctor staffing", "staffing", "locum, contract and permanent doctor staffing for organisations", "Hospitals and clinics|Diagnostic centres|Health programmes|Organisations recruiting doctors", "MOD-12,MOD-01,MOD-06", ""),
  seed("pharmacist-staffing", "Pharmacist staffing", "staffing", "contract and permanent pharmacist staffing for healthcare organisations", "Hospitals and clinics|Community and hospital pharmacies|Health programmes|Organisations recruiting pharmacists", "MOD-12,MOD-01,MOD-06", ""),
  seed("laboratory-scientist-staffing", "Laboratory scientist staffing", "staffing", "contract and permanent laboratory scientist staffing", "Hospitals and clinics|Diagnostic laboratories|Research programmes|Organisations recruiting laboratory scientists", "MOD-12,MOD-01,MOD-06", ""),
  seed("physiotherapist-staffing", "Physiotherapist staffing", "staffing", "contract and permanent physiotherapist staffing", "Hospitals and clinics|Rehabilitation services|Home care programmes|Organisations recruiting physiotherapists", "MOD-12,MOD-01,MOD-06", ""),
  seed("school-healthcare-staffing", "School healthcare staffing", "staffing", "healthcare and support staff for school health services", "Schools|Nurseries and early-years settings|Education groups|School health programmes", "MOD-12,MOD-11,MOD-01,MOD-06", ""),
  seed("corporate-healthcare-staffing", "Corporate healthcare staffing", "staffing", "healthcare staff and managed support for workplace health services", "Employers|Corporate clinics|Occupational health programmes|Organisations planning workplace cover", "MOD-12,MOD-01,MOD-06", ""),
  seed("correctional-healthcare-support", "Correctional healthcare support", "staffing", "contracted healthcare programme support in justice and correctional settings", "Justice institutions|Correctional facilities|Public health partners|Contracted programme operators", "MOD-16,MOD-12,MOD-01,MOD-06", ""),
  seed("doctor-jobs-and-opportunities", "Doctor jobs and opportunities", "jobs", "doctor locum shifts, contracts, employment and permanent placements", "Registered doctors|General practitioners|Specialist doctors|Doctors seeking locum or permanent work", "MOD-13,MOD-01,MOD-06", ""),
  seed("midwife-jobs-and-opportunities", "Midwife jobs and opportunities", "jobs", "midwifery shifts, contracts, employment and permanent placements", "Registered midwives|Midwives seeking shifts|Midwives seeking home care assignments|Midwives seeking permanent placement", "MOD-13,MOD-01,MOD-06", ""),
  seed("pharmacist-jobs-and-opportunities", "Pharmacist jobs and opportunities", "jobs", "pharmacist contracts, employment and permanent placements", "Registered pharmacists|Hospital pharmacists|Community pharmacists|Pharmacists seeking permanent placement", "MOD-13,MOD-01,MOD-06", ""),
  seed("laboratory-scientist-jobs-and-opportunities", "Laboratory scientist jobs and opportunities", "jobs", "laboratory scientist contracts, employment and permanent placements", "Registered laboratory scientists|Diagnostic laboratory professionals|Research laboratory staff|Scientists seeking permanent placement", "MOD-13,MOD-01,MOD-06", ""),
  seed("physiotherapist-jobs-and-opportunities", "Physiotherapist jobs and opportunities", "jobs", "physiotherapy assignments, contracts, employment and permanent placements", "Registered physiotherapists|Neuro-rehabilitation therapists|Home care physiotherapists|Therapists seeking permanent placement", "MOD-13,MOD-01,MOD-06", ""),
  seed("how-to-verify-a-nurse-in-nigeria", "How to verify a nurse in Nigeria", "guide", "what to check when reviewing a nurse’s identity, registration and suitability", "", "MOD-01,MOD-13", ""),
  seed("how-to-verify-a-doctor-in-nigeria", "How to verify a doctor in Nigeria", "guide", "what to check when reviewing a doctor’s identity, registration and suitability", "", "MOD-01,MOD-13", ""),
  seed("caregiver-cost-in-lagos", "Caregiver cost in Lagos", "guide", "how assessed needs, hours, shift pattern and service arrangement affect caregiver cost", "", "MOD-02,MOD-05,MOD-06,MOD-09", "PUB-ASSESSMENT,PUB-COMPANION-4H"),
];

const visualSet = (page: PageSeed) => {
  const text = `${page.slug} ${page.focus}`;
  if (page.template === "staffing" || page.template === "jobs") return { hero: text.includes("research") || text.includes("programme") || text.includes("outreach") ? researchHero : hospitalStaffingHero, images: [hospitalLocum, hospitalTemporary, hospitalPermanent] };
  if (page.template === "childcare") return { hero: text.includes("nanny") ? nannyHero : pediatricHero, images: [pediatricSchool, pediatricDevelopment, pediatricTherapy] };
  if (/postpartum|newborn|nicu|breastfeeding|c-section|giving-birth/.test(text)) return { hero: postnatalHero, images: [postnatalCare, nannyInfant, skilledNursing] };
  if (/antenatal|pregnancy/.test(text)) return { hero: antenatalHero, images: [antenatalCare, skilledNursing, postOperative] };
  if (/elderly|caregiver|continence|care-home/.test(text)) return { hero: eldercareHero, images: [eldercareDailyLiving, eldercareCompanionship, eldercareMobility] };
  return { hero: clinicalHero, images: [skilledNursing, woundCare, postOperative] };
};

const cardsFor = (page: PageSeed, images: string[]): ExpansionCard[] => {
  const answerRecord = EXPANSION_PAGE_ANSWERS[page.slug];
  if (page.template === "guide") return [];
  if (page.slug === "medic-connect-talent-pool") return [
    { title: "Register your profile", description: "Provide your profession, experience, location and availability for review.", image: images[0] },
    { title: "Complete vetting", description: "Identity, qualifications, registration where required, references and competency are reviewed.", image: images[1] },
    { title: "Be considered", description: "Suitable profiles may be considered for advertised roles or matching opportunities; registration is not an offer.", image: images[2] },
  ];
  const summaries = page.modules.slice(0, 3).map((code) => PROCESS_SUMMARIES[code]).filter(Boolean);
  const headings = page.template === "jobs"
    ? ["Available work routes", "How matching works", "Before engagement"]
    : page.template === "staffing"
      ? ["The requirement", "Suitable professionals", "Delivery and governance"]
      : ["The service", "Assessment and scope", "Records and escalation"];
  const fallback = answerRecord?.answer ?? page.focus;
  return headings.map((title, index) => ({ title, description: index === 0 ? fallback : summaries[index] ?? fallback, image: images[index] }));
};

const guideChecklist = (page: PageSeed) => {
  const record = EXPANSION_PAGE_ANSWERS[page.slug];
  if (!record?.points?.length) return undefined;
  return { heading: page.h1.endsWith("?") ? "How to decide" : "What to check", items: record.points };
};

/** Narrow pages link to the governed page that owns the wider topic. */
const RELATED_OVERRIDES: Record<string, ExpansionPage["related"]> = {
  "diabetes-care-at-home": [{ label: "Chronic condition care at home", path: "/chronic-care-at-home" }, { label: "Diabetic foot care at home", path: "/diabetic-foot-care-at-home" }],
  "night-nurse-for-newborn": [{ label: "Newborn care at home", path: "/newborn-care" }, { label: "Postnatal care at home", path: "/postnatal-care" }],
  "live-in-nanny": [{ label: "Professional nanny services", path: "/professional-nanny" }, { label: "Nanny and childcare", path: "/nanny-childcare" }],
  "live-in-caregiver": [{ label: "24-hour nursing care", path: "/24-hour-nursing-care" }, { label: "Caregiver services", path: "/caregiver" }],
  "continence-care-at-home": [{ label: "Catheter care at home", path: "/catheter-care-at-home" }, { label: "Eldercare at home", path: "/eldercare" }],
  "orthopaedic-recovery-at-home": [{ label: "Post-surgical care at home", path: "/post-surgical-care" }, { label: "Physiotherapy at home", path: "/physiotherapy-at-home" }],
  "midwife-jobs-and-opportunities": [{ label: "Nursing careers", path: "/careers/nursing" }, { label: "Careers", path: "/careers" }],
  "c-section-recovery-at-home": [{ label: "Postnatal care at home", path: "/postnatal-care" }, { label: "Night nurse for a newborn", path: "/night-nurse-for-newborn" }],
  "breastfeeding-support-at-home": [{ label: "Postnatal care at home", path: "/postnatal-care" }, { label: "Newborn care at home", path: "/newborn-care" }],
  "nicu-to-home-support": [{ label: "Newborn care at home", path: "/newborn-care" }, { label: "Postnatal care at home", path: "/postnatal-care" }],
  "coming-to-nigeria-after-giving-birth": [{ label: "Professional Omugwo", path: "/professional-omugwo" }, { label: "Care from abroad", path: "/care-from-abroad" }],
  "who-should-i-hire-for-a-newborn": [{ label: "Newborn care at home", path: "/newborn-care" }, { label: "Professional Omugwo", path: "/professional-omugwo" }],
  "equipment-needed-after-hospital-discharge": [{ label: "Post-surgical care at home", path: "/post-surgical-care" }, { label: "How to prepare the home before discharge", path: "/how-to-prepare-the-home-before-hospital-discharge" }],
  "how-to-prepare-the-home-before-hospital-discharge": [{ label: "Post-surgical care at home", path: "/post-surgical-care" }, { label: "Equipment needed after discharge", path: "/equipment-needed-after-hospital-discharge" }],
  "shadow-teacher": [{ label: "Nanny and childcare", path: "/nanny-childcare" }, { label: "Pediatric care", path: "/pediatric-care" }],
  "stroke-recovery-at-home": [{ label: "Physiotherapy at home", path: "/physiotherapy-at-home" }, { label: "Clinical home care", path: "/clinical-home-care" }],
  "cancer-care-at-home": [{ label: "Palliative care at home", path: "/palliative-care-at-home" }, { label: "Clinical home care", path: "/clinical-home-care" }],
};

const toPage = (page: PageSeed): ExpansionPage => {
  const visuals = visualSet(page);
  const marketText = page.slug === "caregiver-cost-in-lagos" ? "in Lagos" : "in Lagos, Abuja/FCT, Ogun and Ibadan/Oyo";
  const answerRecord = EXPANSION_PAGE_ANSWERS[page.slug];
  if (!answerRecord) throw new Error(`Missing direct answer for /${page.slug}`);
  const action = answerRecord.answer;
  return {
    path: `/${page.slug}`,
    template: page.template,
    title: `${page.h1} in Nigeria | Medic Connect`,
    metaDescription: `${page.h1}: ${answerRecord.answer} ${marketText}.`.slice(0, 157),
    h1: page.h1,
    promise: page.focus.charAt(0).toUpperCase() + page.focus.slice(1) + ".",
    answerHeading: answerRecord.heading,
    intro: [action],
    answerPoints: answerRecord.points ?? [],
    audience: page.audience,
    cards: cardsFor(page, visuals.images),
    heroImage: visuals.hero,
    moduleCodes: page.modules,
    feeSkus: page.fees,
    checklist: page.template === "guide" ? guideChecklist(page) : undefined,
    related: RELATED_OVERRIDES[page.slug] ?? (page.template === "jobs" ? [{ label: "Careers", path: "/careers" }, { label: "Candidate applications", path: "/join" }] : page.template === "staffing" ? [{ label: "Hospital staffing", path: "/hospital-staffing" }, { label: "For facilities", path: "/for-facilities" }] : [{ label: "Clinical home care", path: "/clinical-home-care" }, { label: "Care at home", path: "/care-at-home" }]),
  };
};

export const EXPANSION_PAGES = PAGE_SEEDS.map(toPage).filter((page) => !(page.path in EXPANSION_REDIRECTS));
export const EXPANSION_PAGE_BY_PATH: Record<string, ExpansionPage> = Object.fromEntries(EXPANSION_PAGES.map((page) => [page.path, page]));
export const EXPANSION_PAGE_PATHS = EXPANSION_PAGES.map((page) => page.path);

