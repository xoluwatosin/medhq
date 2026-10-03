// What students study, held as a list so the answer is a value we can match on.
// Anything outside the list is "Other", and the free text sits alongside it.

export const OTHER = "Other" as const;

export const STUDY_LEVELS = [
  "Certificate",
  "Diploma / OND",
  "HND",
  "Bachelor's degree",
  "Postgraduate diploma",
  "Master's degree",
  "Doctorate",
  "Professional training (school of nursing, midwifery or health technology)",
  OTHER,
] as const;

/** Health courses first, because most of our students are on one, then the
 *  wider degrees so a non-health student is never forced into "Other". */
export const COURSES = [
  // Nursing and midwifery
  "Nursing Science",
  "Midwifery",
  "Nursing and Midwifery (double qualification)",
  "Public Health Nursing",
  "Perioperative Nursing",
  "Paediatric Nursing",
  "Psychiatric / Mental Health Nursing",
  // Medicine and dentistry
  "Medicine and Surgery",
  "Dentistry",
  "Veterinary Medicine",
  // Allied health
  "Pharmacy",
  "Pharmacology",
  "Physiotherapy",
  "Occupational Therapy",
  "Speech and Language Therapy",
  "Medical Laboratory Science",
  "Radiography / Medical Imaging",
  "Optometry",
  "Audiology",
  "Prosthetics and Orthotics",
  "Community Health (CHEW / JCHEW)",
  "Environmental Health",
  "Public Health",
  "Epidemiology",
  "Health Information Management",
  "Health Administration / Hospital Management",
  "Nutrition and Dietetics",
  "Human Anatomy",
  "Human Physiology",
  "Biochemistry",
  "Microbiology",
  "Biomedical Science",
  "Biomedical Engineering",
  "Psychology",
  "Social Work",
  "Sociology",
  "Early Childhood Education",
  "Special Needs Education",
  "Education",
  // Non-health degrees, so office and support students have an honest answer
  "Accounting",
  "Banking and Finance",
  "Business Administration",
  "Economics",
  "Marketing",
  "Human Resource Management",
  "Mass Communication",
  "Law",
  "Computer Science",
  "Information Technology",
  "Software Engineering",
  "Data Science",
  "Cybersecurity",
  "Statistics",
  "Mathematics",
  "Engineering (any discipline)",
  "Architecture",
  "Estate Management",
  "Political Science",
  "International Relations",
  "English and Literary Studies",
  "History",
  "Linguistics",
  "Philosophy",
  "Theatre and Media Arts",
  "Agriculture",
  "Food Science and Technology",
  "Chemistry",
  "Physics",
  "Geology",
  "Urban and Regional Planning",
  OTHER,
] as const;

/** What a student is looking for from us. */
export const PLACEMENT_TYPES = [
  { code: "clinical_placement", label: "Clinical placement", help: "Supervised placement as part of your course." },
  { code: "internship", label: "Internship", help: "A fixed period of paid or unpaid work experience." },
  { code: "industrial_training", label: "Industrial training (SIWES)", help: "Your school's formal work attachment." },
  { code: "shadowing", label: "Shadowing and observation", help: "Time alongside a practitioner, watching and learning." },
  { code: "weekend_shifts", label: "Weekend or holiday shifts", help: "Paid work around your timetable." },
  { code: "volunteering", label: "Volunteering", help: "Community and outreach work." },
  { code: "graduate_role", label: "A role for when I finish", help: "Keep me in mind for my first job after graduation." },
  { code: "research", label: "Research support", help: "Data collection, trials and study coordination." },
] as const;

export const PLACEMENT_LABEL: Record<string, string> = Object.fromEntries(
  PLACEMENT_TYPES.map((p) => [p.code, p.label]),
);
