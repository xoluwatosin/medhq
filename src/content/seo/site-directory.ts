import { EXPANSION_PAGE_BY_PATH } from "./expansion-pages";
import { GOVERNED_PAGE_BY_PATH } from "./governed-pages";

/**
 * Every public page, grouped the way a family or a facility looks for it.
 * The hub pages (care at home, for facilities, careers) list these groups, so
 * each page is linked from a page every visitor and crawler reaches. A test
 * fails when a registry page is missing from every group.
 */
export type DirectoryGroupKey = "clinical" | "maternity" | "children" | "older" | "guides" | "facilities" | "jobs";

export interface DirectoryGroup {
  key: DirectoryGroupKey;
  title: string;
  links: { label: string; path: string }[];
}

/** Hand-built pages have no registry heading, so their link text is set here. */
const LABELS: Record<string, string> = {
  "/clinical-home-care": "Clinical home care",
  "/post-surgical-care": "Post-surgical care",
  "/antenatal-care": "Antenatal care",
  "/postnatal-care": "Postnatal care",
  "/nanny-childcare": "Nanny and childcare",
  "/pediatric-care": "Paediatric and additional needs care",
  "/eldercare": "Eldercare",
  "/care-from-abroad": "Arranging care from abroad",
  "/agency-vs-private-nurse-lagos": "Agency or private nurse?",
  "/hospital-staffing": "Hospital staffing",
  "/hospital-support": "Hospital support services",
  "/clinical-research": "Clinical research staffing",
};

const GROUPS: { key: DirectoryGroupKey; title: string; paths: string[] }[] = [
  {
    key: "clinical",
    title: "Nursing and clinical care",
    paths: [
      "/clinical-home-care", "/24-hour-nursing-care", "/doctor-home-visits", "/post-surgical-care",
      "/care-after-hospital-discharge", "/wound-dressing-at-home", "/injection-at-home", "/iv-therapy-at-home",
      "/medication-administration-at-home", "/blood-sample-collection-at-home", "/catheter-care-at-home",
      "/continence-care-at-home", "/stoma-care-at-home", "/peg-feeding-support-at-home", "/tracheostomy-care-at-home",
      "/ventilator-care-at-home", "/chronic-care-at-home", "/diabetes-care-at-home", "/diabetic-foot-care-at-home",
      "/cancer-care-at-home", "/palliative-care-at-home", "/stroke-recovery-at-home", "/orthopaedic-recovery-at-home",
      "/physiotherapy-at-home",
    ],
  },
  {
    key: "maternity",
    title: "Pregnancy, mothers and babies",
    paths: [
      "/antenatal-care", "/high-risk-pregnancy-support-at-home", "/postnatal-care", "/omugwo", "/c-section-recovery-at-home",
      "/breastfeeding-support-at-home", "/newborn-care", "/night-nurse-for-newborn", "/nicu-to-home-support",
    ],
  },
  {
    key: "children",
    title: "Children",
    paths: [
      "/nanny-childcare", "/live-in-nanny", "/pediatric-care", "/shadow-teacher", "/autism-support-at-home",
      "/adhd-support-at-home", "/speech-therapist-for-children", "/occupational-therapy-for-children",
    ],
  },
  {
    key: "older",
    title: "Older adults and everyday support",
    paths: [
      "/eldercare", "/caregiver", "/live-in-caregiver", "/medical-escort-services", "/transport-to-medical-appointments",
      "/care-from-abroad",
    ],
  },
  {
    key: "guides",
    title: "Guides",
    paths: [
      "/how-medic-connect-home-care-works", "/agency-vs-private-nurse-lagos", "/home-care-vs-care-home", "/nurse-vs-caregiver",
      "/caregiver-cost-in-lagos", "/who-do-i-need-after-surgery", "/how-to-prepare-the-home-before-hospital-discharge",
      "/equipment-needed-after-hospital-discharge", "/who-should-i-hire-for-a-newborn", "/coming-to-nigeria-after-giving-birth",
      "/guides/what-does-an-omugwo-caregiver-do", "/what-does-a-shadow-teacher-do", "/how-to-verify-a-nurse-in-nigeria",
      "/how-to-verify-a-doctor-in-nigeria",
    ],
  },
  {
    key: "facilities",
    title: "For hospitals, clinics and organisations",
    paths: [
      "/for-facilities", "/hospital-staffing", "/nurse-staffing", "/doctor-staffing", "/pharmacist-staffing",
      "/laboratory-scientist-staffing", "/physiotherapist-staffing", "/school-healthcare-staffing",
      "/corporate-healthcare-staffing", "/ngo-healthcare-staffing", "/correctional-healthcare-support", "/event-medical-cover",
      "/hospital-support", "/healthcare-facility-management-support", "/clinical-research",
    ],
  },
  {
    key: "jobs",
    title: "Work with us",
    paths: [
      "/careers", "/careers/nursing", "/caregiver-jobs-and-opportunities", "/nanny-jobs-and-opportunities",
      "/doctor-jobs-and-opportunities", "/midwife-jobs-and-opportunities", "/pharmacist-jobs-and-opportunities",
      "/laboratory-scientist-jobs-and-opportunities", "/physiotherapist-jobs-and-opportunities",
    ],
  },
];

const labelFor = (path: string) =>
  LABELS[path] ?? GOVERNED_PAGE_BY_PATH[path]?.h1 ?? EXPANSION_PAGE_BY_PATH[path]?.h1 ?? path;

export const DIRECTORY: DirectoryGroup[] = GROUPS.map((g) => ({
  key: g.key,
  title: g.title,
  links: g.paths.map((path) => ({ label: labelFor(path), path })),
}));

export const directoryGroups = (...keys: DirectoryGroupKey[]) => DIRECTORY.filter((g) => keys.includes(g.key));

/** Pages in the same group as this one, for a page's own related links. */
export const siblingsOf = (path: string, limit = 6) => {
  const group = DIRECTORY.find((g) => g.links.some((l) => l.path === path));
  return group ? group.links.filter((l) => l.path !== path).slice(0, limit) : [];
};

export const DIRECTORY_PATHS = new Set(DIRECTORY.flatMap((g) => g.links.map((l) => l.path)));
