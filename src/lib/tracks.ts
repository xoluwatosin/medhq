// One place that says what each route asks for. Every screen reads this rather
// than testing the track string itself, so a rule only ever changes in one file.
import type { TrackId } from "@/lib/join-tracks";

export interface TrackRules {
  id: TrackId;
  label: string;
  /** Short tag the office reads on a list. */
  tag: string;
  /** Rostered work, so we need the dates they can take. */
  needsAvailability: boolean;
  /** The care questions only make sense for people who deliver care. */
  needsCarePreferences: boolean;
  /** Office and administrative work, so we ask for function and employer. */
  needsFunctionAreas: boolean;
  /** In training, so we ask what kind of placement they want. */
  needsPlacement: boolean;
  /** Institution, course, level and finish date. */
  needsStudy: boolean;
  /** NYSC is asked of every qualified professional. Students are not there yet. */
  needsNysc: boolean;
  /** A practising licence is expected. */
  expectsLicence: boolean;
  /** The cover note students write in place of a second referee. */
  needsJoiningStatement: boolean;
}

export const TRACK_RULES: Record<TrackId, TrackRules> = {
  clinical: {
    id: "clinical",
    label: "Clinical professional",
    tag: "Clinical",
    needsAvailability: true,
    needsCarePreferences: true,
    needsFunctionAreas: false,
    needsPlacement: false,
    needsStudy: false,
    needsNysc: true,
    expectsLicence: true,
    needsJoiningStatement: false,
  },
  support: {
    id: "support",
    label: "Support and care worker",
    tag: "Support",
    needsAvailability: true,
    needsCarePreferences: true,
    needsFunctionAreas: false,
    needsPlacement: false,
    needsStudy: false,
    needsNysc: true,
    expectsLicence: false,
    needsJoiningStatement: false,
  },
  non_clinical: {
    id: "non_clinical",
    label: "Non-clinical professional",
    tag: "Non-clinical",
    needsAvailability: false,
    needsCarePreferences: false,
    needsFunctionAreas: true,
    needsPlacement: false,
    needsStudy: false,
    needsNysc: true,
    expectsLicence: false,
    needsJoiningStatement: false,
  },
  student: {
    id: "student",
    label: "Student",
    tag: "Student",
    needsAvailability: true,
    needsCarePreferences: false,
    needsFunctionAreas: false,
    needsPlacement: true,
    needsStudy: true,
    needsNysc: false,
    expectsLicence: false,
    needsJoiningStatement: true,
  },
};

const FALLBACK: TrackRules = TRACK_RULES.clinical;

export const trackRules = (track?: string | null): TrackRules =>
  TRACK_RULES[(track ?? "") as TrackId] ?? FALLBACK;

/** Whether we actually know the route, rather than falling back to clinical. */
export const trackKnown = (track?: string | null): boolean =>
  Boolean(track && track in TRACK_RULES);

export const TRACK_TAGS: { id: TrackId; tag: string; label: string }[] =
  (Object.values(TRACK_RULES) as TrackRules[]).map((r) => ({ id: r.id, tag: r.tag, label: r.label }));
