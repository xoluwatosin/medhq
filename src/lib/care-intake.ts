// Who the care is for, and what each person needs, settled before any
// question is asked.
//
// The pre-assessment used to assume one care recipient and one service. A
// request can hold a family: a mother and her newborn, a grandmother and a
// child with additional needs, or one person needing two services. This module
// holds that logic on its own so it can be read and tested without a screen:
// the steps, the branches, the rules each step enforces, and how the answers
// map onto the request, recipient and service-intention records Admin already
// keeps.
//
// Nothing here writes to a record and nothing here decides clinical matters.
// It decides only which questions are asked, of whom, and once or many times.
import { ageBandOf, ageFromDateOfBirth } from "@/lib/care";

/* ---------- the service list ---------- */

/**
 * Services are listed independently rather than grouped, so routing is exact.
 * `sectionKey` is the key the published questionnaire already uses for its
 * service sections; several listed services legitimately open the same
 * section, distinguished by the recipient's own age band.
 */
export interface CareServiceOption {
  value: string;
  label: string;
  /** The questionnaire service key this opens. */
  sectionKey: string;
  /** Age bands this service can apply to. Empty means any. */
  bands?: string[];
}

export const CARE_SERVICES: CareServiceOption[] = [
  { value: "antenatal", label: "Antenatal care at home", sectionKey: "antenatal", bands: ["adult"] },
  {
    value: "postnatal_mother",
    label: "Postnatal care and Omugwo (mother)",
    sectionKey: "postnatal",
    bands: ["adult"],
  },
  { value: "newborn", label: "Newborn care", sectionKey: "newborn", bands: ["newborn", "infant"] },
  {
    value: "paediatric",
    label: "Paediatric care",
    sectionKey: "paediatric",
    bands: ["newborn", "infant", "child"],
  },
  {
    value: "additional_needs",
    label: "Children with additional needs",
    sectionKey: "additional_needs",
    bands: ["newborn", "infant", "child"],
  },
  {
    value: "nanny",
    label: "Nanny and childcare",
    sectionKey: "nanny",
    // Childcare is for a child. Attaching it to an adult is a conflict the
    // respondent resolves, exactly as every other age rule is resolved.
    bands: ["newborn", "infant", "child"],
  },
  { value: "post_surgical", label: "Post-surgical care at home", sectionKey: "post_surgical" },
  { value: "eldercare", label: "Eldercare and companion care", sectionKey: "eldercare", bands: ["older_person", "adult"] },
  { value: "clinical_home_care", label: "Clinical home care", sectionKey: "clinical_home_care" },
  { value: "other", label: "Another service, or not yet decided", sectionKey: "other" },
];

export const serviceOption = (value: string): CareServiceOption | undefined =>
  CARE_SERVICES.find((s) => s.value === value);

export const serviceLabel = (value: string): string => serviceOption(value)?.label ?? value;

/* ---------- the shape of an intake ---------- */

export interface IntakePerson {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
}

export interface IntakeRecipient extends IntakePerson {
  /** Stable within one request, so answers never move between people. */
  id: string;
  /** What the person asking is to this recipient, e.g. "Mother". Absent when they are the same person. */
  relationship?: string;
  relationshipOther?: string;
  /** True when the person asking is also receiving care. */
  isEnquirer?: boolean;
  dobKnown?: "yes" | "no";
  dateOfBirth?: string;
  approxAge?: number | null;
  services: string[];
  /** The recipient whose service brought this person into the request. */
  addedFor?: { recipientId: string; service: string };
}

export type IntakeForWhom = "myself" | "other" | "several";

export interface CareIntake {
  enquirer: IntakePerson;
  forWhom: IntakeForWhom | null;
  /** Only asked when the care is for several people. */
  enquirerReceivesCare?: "yes" | "no";
  recipients: IntakeRecipient[];
  confirmed?: boolean;
}

/** Structured facts already held on the care request. Saved form answers always win. */
export type CareIntakeSeed = Partial<CareIntake>;

export const emptyIntake = (): CareIntake => ({
  enquirer: { firstName: "", lastName: "", phone: "", email: "" },
  forWhom: null,
  recipients: [],
});

const hasText = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;

const mergePerson = <T extends IntakePerson>(seed: T, saved?: Partial<T>): T => {
  if (!saved) return seed;
  const merged = { ...seed, ...saved };
  for (const key of ["firstName", "lastName", "phone", "email"] as const) {
    if (!hasText(saved[key]) && hasText(seed[key])) merged[key] = seed[key];
  }
  return merged;
};

/**
 * Adds request facts without replacing anything the family has already saved.
 * Recipient identifiers are the durable join between answers and request rows.
 */
export const mergeIntakeSeed = (
  seed: CareIntakeSeed | null | undefined,
  saved: CareIntake | null | undefined,
): CareIntake => {
  const base = emptyIntake();
  if (!seed && !saved) return base;
  const seededRecipients = seed?.recipients ?? [];
  const savedRecipients = saved?.recipients ?? [];
  const savedById = new Map(savedRecipients.map((recipient) => [recipient.id, recipient]));
  const recipients = seededRecipients.map((recipient) => {
    const held = savedById.get(recipient.id);
    if (!held) return recipient;
    return {
      ...recipient,
      ...held,
      ...mergePerson(recipient, held),
      services: held.services.length > 0 ? held.services : recipient.services,
    };
  });
  for (const recipient of savedRecipients) {
    if (!recipients.some((item) => item.id === recipient.id)) recipients.push(recipient);
  }
  return {
    ...base,
    ...seed,
    ...saved,
    enquirer: mergePerson(
      { ...base.enquirer, ...(seed?.enquirer ?? {}) },
      saved?.enquirer,
    ),
    forWhom: saved?.forWhom ?? seed?.forWhom ?? null,
    recipients,
  };
};

/** Steps that still need family input. Confirmation itself is not an omission. */
export const incompleteIntakeSteps = (intake: CareIntake): IntakeStepId[] =>
  intakeSteps(intake)
    .filter((step) => step.id !== "confirm" && !stepComplete(intake, step.id))
    .map((step) => step.id);

/** Stable, readable and never reused within one request. */
export const newRecipientId = (existing: IntakeRecipient[]): string => {
  let n = existing.length + 1;
  const taken = new Set(existing.map((r) => r.id));
  while (taken.has(`r${n}`)) n += 1;
  return `r${n}`;
};

export const blankRecipient = (existing: IntakeRecipient[]): IntakeRecipient => ({
  id: newRecipientId(existing),
  firstName: "",
  lastName: "",
  services: [],
});

export const recipientName = (r: IntakeRecipient): string =>
  [r.firstName, r.lastName].map((p) => (p ?? "").trim()).filter(Boolean).join(" ");

/* ---------- age, and what a service may apply to ---------- */

export const recipientAgeYears = (r: IntakeRecipient, now: Date = new Date()): number | null => {
  const fromDob = ageFromDateOfBirth(r.dateOfBirth, now);
  if (fromDob) return fromDob.years;
  const approx = Number(r.approxAge);
  return Number.isFinite(approx) && approx >= 0 && approx <= 120 ? Math.floor(approx) : null;
};

export const recipientBand = (r: IntakeRecipient, now: Date = new Date()): string => {
  const fromDob = ageFromDateOfBirth(r.dateOfBirth, now);
  if (fromDob) return ageBandOf(fromDob.years, fromDob.days);
  return ageBandOf(recipientAgeYears(r, now), null);
};

/**
 * Where a chosen service cannot apply to the age recorded for that person.
 * The conflict is shown and the respondent resolves it. Nothing is reassigned
 * and nothing is removed automatically.
 */
export const serviceConflicts = (
  r: IntakeRecipient,
  now: Date = new Date(),
): { service: string; message: string }[] => {
  const band = recipientBand(r, now);
  if (band === "unknown") return [];
  const who = recipientName(r) || "this person";
  return r.services
    .map((value) => {
      const option = serviceOption(value);
      if (!option?.bands || option.bands.includes(band)) return null;
      return {
        service: value,
        message: `${option.label} is not usually provided for ${who} at the age recorded. Change the age or the service.`,
      };
    })
    .filter((c): c is { service: string; message: string } => c !== null);
};

/* ---------- the steps, and how they branch ---------- */

export type IntakeStepId =
  | "enquirer"
  | "for_whom"
  | "enquirer_receives_care"
  | "recipients"
  | "confirm";

export interface IntakeStep {
  id: IntakeStepId;
  title: string;
}

/** Fixed positions keep the opening journey understandable when step 3 is conditional. */
export const INTAKE_STAGE_NUMBER: Record<IntakeStepId, number> = {
  enquirer: 1,
  for_whom: 2,
  enquirer_receives_care: 3,
  recipients: 4,
  confirm: 5,
};

/**
 * The steps this intake actually has, in order.
 *
 *   1. Your details
 *   2. Who is this request for?            myself | other | several
 *   2a. Are you also receiving care?       only when several
 *   3. Care recipient details              skipped when the answer is myself
 *   4. Confirm
 */
export const intakeSteps = (intake: CareIntake): IntakeStep[] => {
  const steps: IntakeStep[] = [
    { id: "enquirer", title: "Your details" },
    { id: "for_whom", title: "Who is this request for?" },
  ];
  if (intake.forWhom === "several") {
    steps.push({ id: "enquirer_receives_care", title: "Are you also receiving care?" });
  }
  if (intake.forWhom === "other" || intake.forWhom === "several") {
    steps.push({ id: "recipients", title: "Care recipient details" });
  }
  if (intake.forWhom === "myself") {
    steps.push({ id: "recipients", title: "Your care" });
  }
  steps.push({ id: "confirm", title: "Confirm" });
  return steps;
};

/* ---------- what each step requires ---------- */

const filled = (value: unknown) => typeof value === "string" && value.trim().length > 0;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Problems on one step, keyed so a screen can show them beside the field. */
export const stepProblems = (
  intake: CareIntake,
  step: IntakeStepId,
  now: Date = new Date(),
): Record<string, string> => {
  const problems: Record<string, string> = {};

  if (step === "enquirer") {
    if (!filled(intake.enquirer.firstName)) problems.firstName = "Enter your first name";
    if (!filled(intake.enquirer.lastName)) problems.lastName = "Enter your last name";
    if (!filled(intake.enquirer.phone)) problems.phone = "Enter a phone number we can reach you on";
    // Email is required throughout the care-request journey.
    if (!filled(intake.enquirer.email)) problems.email = "Enter your email address";
    else if (!EMAIL.test(String(intake.enquirer.email).trim())) problems.email = "Enter a valid email address";
  }

  if (step === "for_whom" && !intake.forWhom) {
    problems.forWhom = "Choose who this request is for";
  }

  if (step === "enquirer_receives_care" && !intake.enquirerReceivesCare) {
    problems.enquirerReceivesCare = "Choose yes or no";
  }

  if (step === "recipients") {
    if (intake.recipients.length === 0) {
      problems.recipients = "Add at least one care recipient";
    }
    for (const r of intake.recipients) {
      if (!filled(r.firstName)) problems[`${r.id}.firstName`] = "Enter a first name";
      if (!filled(r.lastName)) problems[`${r.id}.lastName`] = "Enter a last name";
      if (!r.isEnquirer && !filled(r.relationship)) {
        problems[`${r.id}.relationship`] = "Choose a relationship";
      }
      if (r.dobKnown === "yes" && !filled(r.dateOfBirth)) {
        problems[`${r.id}.dateOfBirth`] = "Enter a date of birth";
      }
      if (r.dobKnown === "no" && recipientAgeYears(r, now) === null) {
        problems[`${r.id}.approxAge`] = "Enter an approximate age in years";
      }
      if (!r.dobKnown) problems[`${r.id}.dobKnown`] = "Enter a date of birth, or an approximate age";
      if (r.services.length === 0) {
        problems[`${r.id}.services`] = "Choose the support this person needs";
      }
      for (const conflict of serviceConflicts(r, now)) {
        problems[`${r.id}.services`] = conflict.message;
      }
    }
  }

  return problems;
};

export const stepComplete = (intake: CareIntake, step: IntakeStepId, now?: Date): boolean =>
  Object.keys(stepProblems(intake, step, now)).length === 0;

export const intakeComplete = (intake: CareIntake, now?: Date): boolean =>
  intakeSteps(intake).every((s) => s.id === "confirm" || stepComplete(intake, s.id, now));

/* ---------- what the intake means for the request ---------- */

/** A service chosen for more than one care recipient is recorded as shared. */
export interface ServiceIntention {
  service: string;
  recipientIds: string[];
  shared: boolean;
}

export const serviceIntentions = (intake: CareIntake): ServiceIntention[] => {
  const map = new Map<string, string[]>();
  for (const r of intake.recipients) {
    for (const service of r.services) {
      map.set(service, [...(map.get(service) ?? []), r.id]);
    }
  }
  return [...map.entries()]
    .map(([service, recipientIds]) => ({ service, recipientIds, shared: recipientIds.length > 1 }))
    .sort((a, b) => a.service.localeCompare(b.service));
};

/** One plain line per care recipient, for the confirmation screen. */
export const intakeSummary = (intake: CareIntake): { recipientId: string; line: string }[] =>
  intake.recipients.map((r) => {
    const name = recipientName(r) || "This person";
    const services = r.services.map(serviceLabel);
    const list =
      services.length === 0
        ? "no service chosen yet"
        : services.length === 1
          ? services[0]
          : `${services.slice(0, -1).join(", ")} and ${services[services.length - 1]}`;
    return { recipientId: r.id, line: `${list} for ${name}` };
  });

/* ---------- which questions are asked, of whom ---------- */

/**
 * Sections asked once for the whole request rather than once per person.
 * Everything else belongs either to one care recipient or to one recipient and
 * one service together.
 */
export const REQUEST_WIDE_SECTIONS = [
  "core_arrangements",
  "consent",
];

/** These facts are captured by the opening intake and must not be asked again. */
export const INTAKE_SECTIONS = ["route", "route_service"];

export type AnswerScope = "intake" | "request" | "recipient";

export const sectionScope = (sectionId: string): AnswerScope =>
  INTAKE_SECTIONS.includes(sectionId)
    ? "intake"
    : REQUEST_WIDE_SECTIONS.includes(sectionId)
      ? "request"
      : "recipient";

/**
 * A recipient's answer is held under its own key, so two people on one request
 * can never overwrite each other. Request-wide answers keep their plain field
 * identifier, which is also what every existing v5 record holds.
 */
export const NAMESPACE = /^(r\d+)__(.+)$/;

export const scopedKey = (recipientId: string | null, fieldId: string): string =>
  recipientId ? `${recipientId}__${fieldId}` : fieldId;

export const readScopedKey = (key: string): { recipientId: string | null; fieldId: string } => {
  const match = NAMESPACE.exec(key);
  return match ? { recipientId: match[1], fieldId: match[2] } : { recipientId: null, fieldId: key };
};

/** Every answer belonging to one care recipient, read under plain identifiers. */
export const answersForRecipient = (
  responses: Record<string, unknown>,
  recipientId: string,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(responses)) {
    const { recipientId: owner, fieldId } = readScopedKey(key);
    if (owner === null) out[fieldId] = value;
    else if (owner === recipientId) out[fieldId] = value;
  }
  return out;
};

/** The person asking is this recipient's parent or legal guardian. */
export const PARENT_RELATIONSHIPS = ["Mother", "Father", "Guardian"];

/**
 * What the intake already settles about one care recipient, in the terms the
 * questions' conditions read. The page and the server both build routing from
 * this, so they always agree on what is asked: a question the intake answers
 * is not asked again, and a household question is asked once, not per person.
 * Saved answers never override these facts.
 */
export const intakeRoutingAnswers = (intake: CareIntake, r: IntakeRecipient): Record<string, unknown> => {
  const others = intake.recipients.filter((x) => x.id !== r.id);
  const newborn = others.find((x) => x.services.includes("newborn") && x.dateOfBirth);
  return {
    who_for: r.isEnquirer ? "myself" : "someone_else",
    recipient_first_name: r.firstName,
    dob_known: r.dobKnown ?? null,
    date_of_birth: r.dateOfBirth ?? null,
    approx_age: r.approxAge ?? null,
    intake_relationship: r.relationship ?? "",
    intake_filler_parent: !r.isEnquirer && PARENT_RELATIONSHIPS.includes(r.relationship ?? "") ? "yes" : "no",
    intake_first_recipient: intake.recipients[0]?.id === r.id ? "yes" : "no",
    intake_sole_self: intake.recipients.length === 1 && !!r.isEnquirer ? "yes" : "no",
    intake_newborn_dob: newborn?.dateOfBirth ?? "",
  };
};

/** The questionnaire service key a care recipient's services open. */
export const sectionKeysFor = (r: IntakeRecipient): string[] => [
  ...new Set(r.services.map((s) => serviceOption(s)?.sectionKey).filter((s): s is string => !!s)),
];

export type RecipientProgress = "not_started" | "in_progress" | "complete";

/** Complete, in progress or not started, from answers alone. */
export const recipientProgress = (
  answered: number,
  total: number,
): RecipientProgress => {
  if (total > 0 && answered >= total) return "complete";
  return answered > 0 ? "in_progress" : "not_started";
};

export const PROGRESS_LABELS: Record<RecipientProgress, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
};
