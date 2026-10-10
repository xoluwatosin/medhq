import { art } from "@/components/mc/art";
import aboutMoment from "@/assets/photos/about-moment.webp";
import abroadMoment from "@/assets/photos/abroad-moment.webp";
import antenatalMoment from "@/assets/photos/antenatal-moment.webp";
import clinicalMoment from "@/assets/photos/clinical-moment.webp";
import eldercareMoment from "@/assets/photos/eldercare-moment.webp";
import nannyMoment from "@/assets/photos/nanny-moment.webp";
import paediatricMoment from "@/assets/photos/paediatric-moment.webp";
import postSurgicalMoment from "@/assets/photos/post-surgical-moment.webp";
import postnatalMoment from "@/assets/photos/postnatal-moment.webp";
import researchMoment from "@/assets/photos/research-moment.webp";
import staffingMoment from "@/assets/photos/staffing-moment.webp";
import supportMoment from "@/assets/photos/support-moment.webp";

/**
 * Presentation for the SEO pages: the person in each hero and the one photo
 * beside the answer. Nothing here is copy; the words stay in the registry
 * mirrors.
 */

/** The person (or two) standing in the hero, by path. */
export const HERO_ART: Record<string, string[]> = {
  "/24-hour-nursing-care": [art.proNurseCoat],
  "/careers": [art.carerManJacket, art.nurseWomanCoat],
  "/careers/nursing": [art.nurseMan2],
  "/caregiver": [art.charCaregiver],
  "/catheter-care-at-home": [art.nurseManKit],
  "/chronic-care-at-home": [art.nurseWomanBpCuff],
  "/doctor-home-visits": [art.doctorWelcomedDoor],
  "/event-medical-cover": [art.eventMedicFirstAidCutout],
  "/guides/what-does-an-omugwo-caregiver-do": [art.postnatalSpecialist],
  "/newborn-care": [art.nightNurseCot],
  "/ngo-healthcare-staffing": [art.communityBpCheckCutout],
  "/nurse-staffing": [art.hospitalManagerClipboard],
  "/omugwo": [art.postnatalSpecialist2],
  "/palliative-care-at-home": [art.bedsideHandholding],
  "/physiotherapy-at-home": [art.physiotherapistLegExercise],

  "/autism-support-at-home": [art.therapistBoyBlocks],
  "/shadow-teacher": [art.tutorBoyDeskCutout],
  "/speech-therapist-for-children": [art.speechTherapyAppleCardCutout],
  "/what-does-a-shadow-teacher-do": [art.tutorBoyDeskCutout],
  "/wound-dressing-at-home": [art.nurseWoundKit],
  "/community-health-outreach-services": [art.communityBpCheckCutout],
  "/hospital-to-home-care": [art.carerSupportsManCarCutout],
  "/live-in-caregiver": [art.caregiverSuitcase],
  "/managed-postpartum-stay-in-nigeria": [art.motherNewbornSuitcaseCutout],
  "/stroke-recovery-at-home": [art.elderWalkingFrame],
  "/clinical-research-staffing": [art.researchCoordinatorTablet],
  "/medic-connect-talent-pool": [art.doctorNurseHandshake],
  "/additional-needs-childcare": [art.nurseBlocksChild],
  "/speech-delay-support": [art.speechTherapyAppleCardCutout],
  "/blood-sample-collection-at-home": [art.nurseLabellingSample],
  "/iv-therapy-at-home": [art.proNurseKit],
  "/injection-at-home": [art.nurseManKit],
  "/ngo-health-programme-implementation": [art.communityBpCheckCutout],
  "/home-care-vs-care-home": [art.familyDoorNurse],
  "/nurse-vs-caregiver": [art.charNurse, art.charCaregiver],
  "/who-do-i-need-after-surgery": [art.manCrutches],
  "/who-should-i-hire-for-a-newborn": [art.carerPlayBaby],
  "/how-medic-connect-home-care-works": [art.assessmentMotherSon],
  "/care-for-elderly-parents": [art.carerElderVideoCallCutout],
  "/healthcare-facility-management-support": [art.housekeeperMopBucket],
  "/hospital-support-services": [art.porterWheelchair],
  "/coming-to-nigeria-after-giving-birth": [art.motherNewbornSuitcaseCutout],
  "/night-nurse-for-newborn": [art.nightNurseCot],
  "/live-in-nanny": [art.nannyReading],
  "/c-section-recovery-at-home": [art.postnatalSpecialist],
  "/care-after-hospital-discharge": [art.carerSupportsManCarCutout],
  "/equipment-needed-after-hospital-discharge": [art.manForearmCrutches],
  "/how-to-prepare-the-home-before-hospital-discharge": [art.familyDoorNurse],
  "/physiotherapy-after-stroke": [art.physiotherapistLegExercise],
  "/caregiver-jobs-and-opportunities": [art.carerManJacket],
  "/nanny-jobs-and-opportunities": [art.carerPlayBaby],
  "/adhd-support-at-home": [art.carerTableChild],
  "/school-companion": [art.schoolRun],
  "/occupational-therapy-for-children": [art.therapistBoyBlocks],
  "/early-intervention-support": [art.nurseBlocksChild],
  "/behaviour-support": [art.carerTableChild],
  "/stoma-care-at-home": [art.nurseWomanCoat],
  "/peg-feeding-support-at-home": [art.nurseMan2],
  "/tracheostomy-care-at-home": [art.proNurseCoat],
  "/ventilator-care-at-home": [art.nurseWomanCoat],
  "/medication-administration-at-home": [art.nurseManKit],
  "/blood-pressure-monitoring-at-home": [art.nurseWomanBpCuff],
  "/blood-sugar-monitoring-at-home": [art.charNurse],
  "/continence-care-at-home": [art.charNurse],
  "/diabetes-care-at-home": [art.nurseWomanBpCuff],
  "/cancer-care-at-home": [art.bedsideHandholding],
  "/diabetic-foot-care-at-home": [art.nurseFootCheckCutout],
  "/orthopaedic-recovery-at-home": [art.manForearmCrutches],
  "/antenatal-care-at-home": [art.midwifePregnantBp],
  "/high-risk-pregnancy-support-at-home": [art.midwifePregnantBp],
  "/breastfeeding-support-at-home": [art.postnatalSpecialist2],
  "/nicu-to-home-support": [art.newbornIncubator],
  "/medical-escort-services": [art.carerSupportsManCarCutout],
  "/transport-to-medical-appointments": [art.porterWheelchair],
  "/doctor-staffing": [art.locumDoctorBag],
  "/pharmacist-staffing": [art.pharmacistMedicineCarton],
  "/laboratory-scientist-staffing": [art.scientistSampleRack],
  "/physiotherapist-staffing": [art.physiotherapistLegExercise],
  "/school-healthcare-staffing": [art.schoolNurseKneePlaster],
  "/corporate-healthcare-staffing": [art.workplaceNurseBp],
  "/correctional-healthcare-support": [art.doctorWoman],
  "/doctor-jobs-and-opportunities": [art.doctorWoman],
  "/midwife-jobs-and-opportunities": [art.midwifePregnantBp],
  "/pharmacist-jobs-and-opportunities": [art.pharmacistMedicineCarton],
  "/laboratory-scientist-jobs-and-opportunities": [art.scientistSampleRack],
  "/physiotherapist-jobs-and-opportunities": [art.physiotherapistLegExercise],
  "/how-to-verify-a-nurse-in-nigeria": [art.proNurseCoat],
  "/how-to-verify-a-doctor-in-nigeria": [art.proDoctor],
  "/caregiver-cost-in-lagos": [art.charCaregiver],
};

const PHOTOS = {
  about: { src: aboutMoment, alt: "The Medic Connect team together" },
  abroad: { src: abroadMoment, alt: "A carer showing an older woman a tablet at home" },
  antenatal: { src: antenatalMoment, alt: "A midwife checking a pregnant woman's blood pressure at home" },
  clinical: { src: clinicalMoment, alt: "A nurse going through a care plan with an older man at home" },
  eldercare: { src: eldercareMoment, alt: "A carer and an older woman laughing together at home" },
  nanny: { src: nannyMoment, alt: "A Medic Connect nanny playing with a toddler" },
  paediatric: { src: paediatricMoment, alt: "A therapist supporting a child during a play session" },
  postSurgical: { src: postSurgicalMoment, alt: "A nurse helping a woman walk with crutches at home" },
  postnatal: { src: postnatalMoment, alt: "A grandmother, a mother and her baby laughing together at home" },
  research: { src: researchMoment, alt: "A research coordinator working at a laboratory computer" },
  staffing: { src: staffingMoment, alt: "A team of nurses and doctors reviewing notes on a hospital ward" },
  support: { src: supportMoment, alt: "Medic Connect support staff collecting hospital linen" },
};

/** The one photo beside the answer, matched to the topic by the words in its path. */
export const photoFor = (path: string, template: string) => {
  const p = path;
  if (/research/.test(p)) return PHOTOS.research;
  if (/support-services|facility-management|correctional/.test(p)) return PHOTOS.support;
  if (template === "staffing" || /staffing|outreach|programme/.test(p)) return PHOTOS.staffing;
  if (template === "jobs" || /careers|talent/.test(p)) return PHOTOS.about;
  if (/autism|adhd|speech|occupational|early-intervention|behaviour|additional-needs|shadow/.test(p)) return PHOTOS.paediatric;
  if (/nanny|school-companion/.test(p)) return PHOTOS.nanny;
  if (/antenatal|pregnancy/.test(p)) return PHOTOS.antenatal;
  if (/postnatal|postpartum|omugwo|newborn|breastfeeding|c-section|nicu|after-giving-birth/.test(p)) return PHOTOS.postnatal;
  if (/surgery|discharge|hospital-to-home|orthopaedic|wound|stroke|physio/.test(p)) return PHOTOS.postSurgical;
  if (/abroad/.test(p)) return PHOTOS.abroad;
  if (/elderly|caregiver|palliative|escort|transport|care-home|cancer/.test(p)) return PHOTOS.eldercare;
  return PHOTOS.clinical;
};
