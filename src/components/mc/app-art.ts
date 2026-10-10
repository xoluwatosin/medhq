/**
 * The Workforce and Client app illustrations from the Medic Connect design
 * system, trimmed and saved as WebP. None has a ground circle: stand them on
 * navy, tint or a backing square. Empty and welcome states go only on their
 * own screen state, with a short plain line under them saying what happens next.
 */
import gateCheckIn from "@/assets/mc/app/gate-check-in.webp";
import schoolGateHandover from "@/assets/mc/app/school-gate-handover.webp";
import doorCode from "@/assets/mc/app/door-code.webp";
import woundKit from "@/assets/mc/app/wound-kit.webp";
import newbornWeighing from "@/assets/mc/app/newborn-weighing.webp";
import paymentAlert from "@/assets/mc/app/payment-alert.webp";
import routePin from "@/assets/mc/app/route-pin.webp";
import workerLanyard from "@/assets/mc/app/worker-lanyard.webp";
import sickDayCare from "@/assets/mc/app/sick-day-care.webp";
import afterSchoolHomework from "@/assets/mc/app/after-school-homework.webp";
import respiteHandover from "@/assets/mc/app/respite-handover.webp";
import medicationRound from "@/assets/mc/app/medication-round.webp";
import shiftOffer from "@/assets/mc/app/shift-offer.webp";
import careTeamTwoCarers from "@/assets/mc/app/care-team-two-carers.webp";
import careTeamThreeCarers from "@/assets/mc/app/care-team-three-carers.webp";
import workforceWelcome from "@/assets/mc/app/workforce-welcome.webp";
import workforceNoVisitsToday from "@/assets/mc/app/workforce-no-visits-today.webp";
import workforceNoOpenShifts from "@/assets/mc/app/workforce-no-open-shifts.webp";
import workforceNoEarningsYet from "@/assets/mc/app/workforce-no-earnings-yet.webp";
import clientWelcome from "@/assets/mc/app/client-welcome.webp";
import clientNoUpdatesYet from "@/assets/mc/app/client-no-updates-yet.webp";
import clientNoUpcomingVisits from "@/assets/mc/app/client-no-upcoming-visits.webp";
import clientNothingToPay from "@/assets/mc/app/client-nothing-to-pay.webp";

export const appArt = {
  // Scenes
  gateCheckIn,
  schoolGateHandover,
  doorCode,
  woundKit,
  newbornWeighing,
  paymentAlert,
  routePin,
  workerLanyard,
  sickDayCare,
  afterSchoolHomework,
  respiteHandover,
  medicationRound,
  shiftOffer,
  careTeamTwoCarers,
  careTeamThreeCarers,
  // Empty and welcome states
  workforceWelcome,
  workforceNoVisitsToday,
  workforceNoOpenShifts,
  workforceNoEarningsYet,
  clientWelcome,
  clientNoUpdatesYet,
  clientNoUpcomingVisits,
  clientNothingToPay,
};

export type AppArtName = keyof typeof appArt;
