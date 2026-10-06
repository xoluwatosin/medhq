/**
 * Presentation-only layer for the governed SEO pages.
 *
 * Nothing here states a new fact: every audience line and card description is
 * taken from the approved page brief or the approved module wording already
 * held in `governed-pages.ts` and `governed-modules.ts`. Photographs are
 * existing site assets, reused on the nearest matching page.
 */
import clinicalHero from "@/assets/hero/clinical-hero.jpg";
import eldercareHero from "@/assets/hero/eldercare-hero.jpg";
import hospitalStaffingHero from "@/assets/hero/hospital-staffing-hero.webp";
import hospitalSupportHero from "@/assets/hero/hospital-support-hero.jpg";
import nannyHero from "@/assets/hero/nanny-hero.jpg";
import pediatricHero from "@/assets/hero/pediatric-hero.jpg";
import postnatalHero from "@/assets/hero/postnatal-hero.jpg";
import clinicalResearchHero from "@/assets/hero/clinical-research-hero.jpg";

import skilledNursing from "@/assets/services/skilled-nursing.jpg";
import woundCare from "@/assets/services/wound-care.jpg";
import ivTherapy from "@/assets/services/iv-therapy.jpg";
import postOperative from "@/assets/services/post-operative.jpg";
import catheterStoma from "@/assets/services/catheter-stoma.jpg";
import clinicalHomeCare from "@/assets/services/clinical-home-care.jpg";
import eldercareCompanionship from "@/assets/services/eldercare-companionship.jpg";
import eldercareDailyLiving from "@/assets/services/eldercare-daily-living.jpg";
import eldercareMobility from "@/assets/services/eldercare-mobility.jpg";
import eldercareMedication from "@/assets/services/eldercare-medication.jpg";
import eldercareMealPrep from "@/assets/services/eldercare-meal-prep.jpg";
import postnatalCare from "@/assets/services/postnatal-care.jpg";
import antenatalCare from "@/assets/services/antenatal-care.jpg";
import nannyInfant from "@/assets/services/nanny-infant-toddler.jpg";
import nannyAfterSchool from "@/assets/services/nanny-after-school.jpg";
import nannyEarlyLearning from "@/assets/services/nanny-early-learning.jpg";
import nannyHousehold from "@/assets/services/nanny-household.jpg";
import pediatricNursing from "@/assets/services/pediatric-nursing.jpg";
import pediatricDaily from "@/assets/services/pediatric-daily-living.jpg";
import hospitalLocum from "@/assets/services/hospital-locum-services.jpg";
import hospitalTemporary from "@/assets/services/hospital-temporary-staffing.jpg";
import hospitalPermanent from "@/assets/services/hospital-permanent-placements.jpg";
import hospitalStaffing from "@/assets/services/hospital-staffing.jpg";
import hospitalEventMedical from "@/assets/services/hospital-event-medical.jpg";
import clinicalResearch from "@/assets/services/clinical-research.jpg";

export interface PageCard {
  title: string;
  description: string;
  image: string;
}

export interface PageVisuals {
  heroImage: string;
  /** Who the service is for, in the words of the approved brief. */
  audience: string[];
  /** Parts of the service named in the approved wording. */
  cards: PageCard[];
}

export const PAGE_VISUALS: Record<string, PageVisuals> = {
  "/24-hour-nursing-care": {
    heroImage: clinicalHero,
    audience: [
      "People who need continuous nursing cover at home",
      "Families arranging care after a hospital discharge",
      "People whose care plan requires cover through the night",
      "Households coordinating a rostered team rather than one carer",
    ],
    cards: [
      { title: "Rostered shift cover", description: "Cover is provided by a rostered team working shifts, not one professional on duty for 24 hours.", image: skilledNursing },
      { title: "Structured handover", description: "Each shift hands over the record and the current clinical picture to the next.", image: clinicalHomeCare },
      { title: "Care plan and review", description: "The formal assessment sets the care plan, the professionals required and the shift pattern.", image: postOperative },
      { title: "Escalation", description: "Staff work to documented escalation procedures and coordinate transfer where one is needed.", image: ivTherapy },
    ],
  },
  "/careers": {
    heroImage: hospitalStaffingHero,
    audience: [
      "Doctors and nurses",
      "Allied health professionals",
      "Caregivers and childcare professionals",
      "Support staff",
    ],
    cards: [
      { title: "The candidate pool", description: "A reviewed profile so you can be considered for suitable work. It is not an offer of work.", image: hospitalTemporary },
      { title: "Advertised opportunities", description: "An application for one specific advertised role.", image: hospitalLocum },
      { title: "Types of engagement", description: "Temporary or locum shifts, contract work, employment, and permanent placements.", image: hospitalPermanent },
    ],
  },
  "/careers/nursing": {
    heroImage: hospitalStaffingHero,
    audience: [
      "Registered nurses",
      "Registered midwives",
      "Nurses seeking locum or shift work",
      "Nurses seeking permanent placement",
    ],
    cards: [
      { title: "Shifts and locum work", description: "Nursing shifts and locum cover, arranged assignment by assignment.", image: hospitalLocum },
      { title: "Home care assignments", description: "Managed home care assignments for registered nurses and midwives.", image: skilledNursing },
      { title: "Contracts, employment and permanent placements", description: "Nurses are engaged on contract, employed, or placed permanently with a client organisation.", image: hospitalPermanent },
    ],
  },
  "/caregiver": {
    heroImage: eldercareHero,
    audience: [
      "Older adults needing daily living support",
      "People recovering at home",
      "People who need companionship and routine",
      "Families needing appointment escort",
    ],
    cards: [
      { title: "Personal care", description: "Caregivers support personal care and daily routine, as set by the assessment.", image: eldercareDailyLiving },
      { title: "Mobility and meals", description: "Support with mobility and meals, at the hours agreed in the care plan.", image: eldercareMealPrep },
      { title: "Companionship", description: "Companionship and routine support from vetted caregivers.", image: eldercareCompanionship },
      { title: "Appointment escort", description: "Escort to appointments, arranged as part of the agreed duties.", image: eldercareMobility },
    ],
  },
  "/catheter-care-at-home": {
    heroImage: clinicalHero,
    audience: [
      "People living with a urinary catheter at home",
      "People discharged from hospital with a catheter",
      "Families arranging routine catheter care",
      "People needing nurse-led review at home",
    ],
    cards: [
      { title: "Catheter change", description: "Catheter change is carried out by a registered nurse, within clinical scope and the care plan.", image: catheterStoma },
      { title: "Catheter removal", description: "Removal is carried out by a registered nurse as set out in the care plan.", image: skilledNursing },
      { title: "Routine catheter care", description: "Routine catheter care is documented against the care plan.", image: clinicalHomeCare },
      { title: "Referral where needed", description: "Where a need falls outside what can safely be delivered at home, Medic Connect says so and coordinates the referral.", image: postOperative },
    ],
  },
  "/chronic-care-at-home": {
    heroImage: clinicalHero,
    audience: [
      "People living with diabetes or hypertension",
      "People with heart conditions",
      "People with respiratory conditions",
      "Families coordinating long-term care at home",
    ],
    cards: [
      { title: "Monitoring", description: "Observations and monitoring are documented against the care plan.", image: skilledNursing },
      { title: "Medication support", description: "Medicines are administered as prescribed by the treating doctor; Medic Connect does not prescribe.", image: eldercareMedication },
      { title: "Review", description: "Care is reviewed as the condition and circumstances change.", image: clinicalHomeCare },
      { title: "Escalation", description: "Concerns are escalated to the treating clinician rather than managed in isolation.", image: ivTherapy },
    ],
  },
  "/doctor-home-visits": {
    heroImage: clinicalHero,
    audience: [
      "People for whom attending a clinic is difficult",
      "Older adults needing review at home",
      "Families arranging a specialist opinion",
      "People who need a teleconsultation",
    ],
    cards: [
      { title: "GP home visit", description: "Assessment, review and diagnosis within what is possible at home.", image: clinicalHomeCare },
      { title: "Specialist home visit", description: "Specialist review at home, arranged after the request is scoped.", image: skilledNursing },
      { title: "Teleconsultation", description: "A consultation by call where a home visit is not required.", image: postOperative },
      { title: "Tests and prescriptions", description: "Laboratory tests and prescription supply are arranged through appropriately licensed laboratories and pharmacies.", image: ivTherapy },
    ],
  },
  "/event-medical-cover": {
    heroImage: hospitalSupportHero,
    audience: [
      "Schools and churches",
      "Sports events",
      "Conferences and corporate events",
      "Private events",
    ],
    cards: [
      { title: "Scoping", description: "Cover is planned from the event, the number of people attending, the activity and the risks.", image: hospitalEventMedical },
      { title: "On-site team", description: "The team and equipment required are planned and deployed for the agreed hours.", image: hospitalStaffing },
      { title: "First response and triage", description: "First response and triage are provided on site within professional scope.", image: skilledNursing },
      { title: "Transfer coordination", description: "An ambulance or hospital transfer is coordinated where one is needed; Medic Connect is not an ambulance service.", image: hospitalLocum },
    ],
  },
  "/guides/what-does-an-omugwo-caregiver-do": {
    heroImage: postnatalHero,
    audience: [
      "New mothers",
      "Families planning support after birth",
      "Families abroad arranging Omugwo at home",
      "Anyone comparing Omugwo with postnatal clinical care",
    ],
    cards: [
      { title: "Mother and baby care", description: "Support for the mother and the baby in the weeks after birth.", image: postnatalCare },
      { title: "Feeding and night support", description: "Feeding support and night support, as set out in the package agreed after assessment.", image: nannyInfant },
      { title: "Meals and household help", description: "Meals and household help delivered by paid nurses and caregivers rather than family members.", image: eldercareMealPrep },
    ],
  },
  "/newborn-care": {
    heroImage: pediatricHero,
    audience: [
      "Parents of a newborn",
      "Families who need night support",
      "Mothers recovering after birth",
      "Families needing newborn observations at home",
    ],
    cards: [
      { title: "Newborn observations", description: "Clinical observations for the newborn at home, where the assessment shows they are needed.", image: pediatricNursing },
      { title: "Feeding support", description: "Feeding support, clinical or practical, depending on what the assessment finds.", image: postnatalCare },
      { title: "Night support", description: "Night support at home from a newborn nurse or nanny.", image: nannyInfant },
      { title: "Escalation", description: "Where a concern is found, it is escalated to the treating clinician.", image: pediatricDaily },
    ],
  },
  "/ngo-healthcare-staffing": {
    heroImage: clinicalResearchHero,
    audience: [
      "NGOs and development partners",
      "Public health programmes",
      "Community health initiatives",
      "Research and trial teams needing operational support",
    ],
    cards: [
      { title: "Programme staffing", description: "Medic Connect staffs and delivers programmes under contract.", image: hospitalStaffing },
      { title: "Mobile and community clinics", description: "Delivery of mobile and community clinics, outreach and campaigns.", image: clinicalResearch },
      { title: "Research support", description: "Operational support for clinical research. Medic Connect is not the sponsor, ethics authority or protocol owner unless contracted in that role.", image: hospitalTemporary },
    ],
  },
  "/nurse-staffing": {
    heroImage: hospitalStaffingHero,
    audience: [
      "Hospitals and clinics",
      "Corporate clients",
      "Organisations needing locum cover",
      "Organisations recruiting permanent nurses",
    ],
    cards: [
      { title: "Locum shifts", description: "Nurses supplied for shifts, vetted before deployment.", image: hospitalLocum },
      { title: "Contract nurses", description: "Contract cover matched on registration, competency, experience and shift pattern.", image: hospitalTemporary },
      { title: "Permanent placements", description: "Permanent nursing placements, with responsibilities set by the engagement.", image: hospitalPermanent },
    ],
  },
  "/omugwo": {
    heroImage: postnatalHero,
    audience: [
      "New mothers",
      "Families planning support after birth",
      "Families abroad arranging support at home",
      "Households needing help through the night",
    ],
    cards: [
      { title: "Mother and baby support", description: "Organised mother-and-baby support after birth, delivered by professionals.", image: postnatalCare },
      { title: "Package set by assessment", description: "Support is arranged after an assessment that sets the package, the professionals and the hours.", image: antenatalCare },
      { title: "A professional service", description: "It is a professional service, not a family arrangement, and it is not limited to nursing.", image: nannyHousehold },
    ],
  },
  "/palliative-care-at-home": {
    heroImage: clinicalHero,
    audience: [
      "People receiving palliative care at home",
      "Families supporting a relative at home",
      "People needing symptom and medication support",
      "Families coordinating with a treating clinician",
    ],
    cards: [
      { title: "Symptom support", description: "Symptom management within nursing scope, documented against the care plan.", image: skilledNursing },
      { title: "Medication administration", description: "Medicines are administered as prescribed by the treating doctor.", image: eldercareMedication },
      { title: "Personal care", description: "Personal care delivered alongside clinical support at home.", image: eldercareDailyLiving },
      { title: "Family support", description: "Care is coordinated with the treating clinician, and concerns are escalated rather than managed in isolation.", image: eldercareCompanionship },
    ],
  },
  "/physiotherapy-at-home": {
    heroImage: clinicalHero,
    audience: [
      "People recovering from surgery or injury",
      "People with reduced mobility",
      "People needing chest physiotherapy",
      "People in neuro-rehabilitation",
    ],
    cards: [
      { title: "Physiotherapy assessment", description: "An assessment sets the programme, the frequency and the goals.", image: postOperative },
      { title: "Rehabilitation sessions", description: "Sessions delivered at home against the agreed programme.", image: eldercareMobility },
      { title: "Chest physiotherapy", description: "Chest physiotherapy is provided where clinically appropriate.", image: skilledNursing },
      { title: "Neuro-rehabilitation", description: "Neuro-rehabilitation is provided where clinically appropriate.", image: clinicalHomeCare },
    ],
  },
};
