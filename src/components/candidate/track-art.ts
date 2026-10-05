import { art } from "@/components/mc/art";

/** The figure for each join route, on the route picker and through sign-up. */
export const TRACK_ART: Record<string, string> = {
  "clinical-professional": art.charNurse,
  "support-care-worker": art.caregiverSuitcase,
  "non-clinical-professional": art.receptionistFrontDesk,
  student: art.nursingStudentTextbooks,
};

/** The same figures, keyed by the track id stored on a candidate. */
export const TRACK_ART_BY_ID: Record<string, string> = {
  clinical: art.charNurse,
  support: art.caregiverSuitcase,
  non_clinical: art.receptionistFrontDesk,
  student: art.nursingStudentTextbooks,
};
