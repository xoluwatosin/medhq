import { art } from "@/components/mc/art";

/** The figure for each join route, on the route picker and through sign-up. */
export const TRACK_ART: Record<string, string> = {
  "clinical-professional": art.charNurse,
  "support-care-worker": art.caregiverSuitcase,
  "non-clinical-professional": art.receptionistFrontDesk,
  student: art.nursingStudentTextbooks,
};
