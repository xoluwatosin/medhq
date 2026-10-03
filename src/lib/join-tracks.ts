// The four routes into the Medic Connect candidate pool. Everyone who joins
// creates a candidate profile; the track tells us which questions to ask and
// how the person is tagged once they are in the pool.

export type TrackId = "clinical" | "support" | "non_clinical" | "student";

export interface TrackDocument {
  label: string;
  /** Whether the document is required to be put forward for work. */
  required: boolean;
}

export interface JoinTrack {
  id: TrackId;
  slug: string;
  label: string;
  blurb: string;
  examples: string;
  /** Number of build questions the route asks. */
  questionsCount: number;
  /** Estimated minutes to create the profile. */
  minutes: number;
  /** Documents we will ask for before the user commits. */
  documents: TrackDocument[];
  /** What creating a profile involves for this track. */
  steps: string[];
}

export const JOIN_TRACKS: JoinTrack[] = [
  {
    id: "clinical",
    slug: "clinical-professional",
    label: "Clinical professional",
    blurb: "Licensed practitioners who deliver hands-on clinical care.",
    examples: "Nurses, midwives, doctors, physiotherapists, laboratory scientists, pharmacists",
    questionsCount: 11,
    minutes: 8,
    documents: [
      { label: "Practising licence", required: true },
      { label: "CV", required: true },
      { label: "ID", required: true },
      { label: "Qualification", required: true },
    ],
    steps: [
      "Create your account",
      "Upload your CV and licence",
      "Set your availability and work preferences",
    ],
  },
  {
    id: "support",
    slug: "support-care-worker",
    label: "Support and care worker",
    blurb: "Hands-on care that does not require a practising licence.",
    examples: "Caregivers, healthcare assistants, nannies, home health aides, early years educators",
    questionsCount: 9,
    minutes: 5,
    documents: [
      { label: "ID", required: true },
      { label: "CV or work history", required: true },
      { label: "Two referees", required: true },
      { label: "No licence required", required: false },
    ],
    steps: [
      "Create your account",
      "Upload your CV or training certificates",
      "Set your availability and the families you prefer to work with",
    ],
  },
  {
    id: "non_clinical",
    slug: "non-clinical-professional",
    label: "Non-clinical professional",
    blurb: "The people who keep care organisations running.",
    examples: "HR, finance, operations, admin, technology, marketing, health records",
    questionsCount: 6,
    minutes: 4,
    documents: [
      { label: "CV", required: true },
      { label: "ID", required: true },
    ],
    steps: [
      "Create your account",
      "Upload your CV",
      "Tell us the roles and organisations you are open to",
    ],
  },
  {
    id: "student",
    slug: "student",
    label: "Student",
    blurb: "In training and looking for placements, internships or your first role.",
    examples: "Nursing, midwifery, medical, allied health and early years students",
    questionsCount: 7,
    minutes: 4,
    documents: [
      { label: "Student ID", required: true },
      { label: "Course letter", required: true },
    ],
    steps: [
      "Create your account",
      "Tell us where you study and when you finish",
      "Add your availability around your timetable",
    ],
  },
];

export const trackBySlug = (slug?: string): JoinTrack | undefined =>
  JOIN_TRACKS.find((t) => t.slug === slug);

export const trackLabel = (id?: string | null): string =>
  JOIN_TRACKS.find((t) => t.id === id)?.label || "Candidate";

export const YEAR_OF_STUDY = [
  "Year 1",
  "Year 2",
  "Year 3",
  "Year 4",
  "Year 5",
  "Year 6",
  "Internship / housemanship",
  "Graduated, awaiting licence",
] as const;

export const JOIN_PENDING_KEY = "mc_join_pending_v1";
