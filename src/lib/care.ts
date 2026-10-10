// The rules the pre-assessment obeys, written once.
//
// The same rules run on the edge functions, so what the person filling the
// form sees and what the record holds can never disagree: which sections
// apply, which fields are visible, what an exclusive option does, what counts
// as an answer, and which answers raise a flag.
import {
  ALLERGY_REACTIONS, ALLERGY_SEVERITIES, CLINICAL_LISTS, clinicalLabel, groupLabel,
  type ClinicalListName,
} from "@/lib/care-clinical-lists";


export type FillerType = "client" | "parent" | "family_member" | "referring_clinician";

export type CareFieldType =
  | "text" | "textarea" | "long_text" | "number" | "date" | "phone"
  | "choice" | "multi" | "checkbox" | "upload" | "confirm" | "contact"
  | "person_name" | "relationship" | "address" | "lga"
  | "language_picker" | "budget_band"
  // Professional controls. A measurement always carries its fixed unit, a
  // repeatable item is validated entry by entry, and a matrix records one
  // level of support per activity.
  | "yes_no" | "measurement" | "repeatable" | "matrix" | "weekly_pattern"
  // Structured clinical controls. Each is a list of entries picked from a
  // universal list (src/lib/care-clinical-lists.ts), with free text held
  // separately so nothing a person writes is coerced onto a code.
  | "condition_list" | "medicine_list" | "allergy_list"
  // A choice made from the medicines already entered, never typed again.
  | "medicine_choice"
  // Where care is followed up, and who follows it up.
  | "hospital" | "professional"
  // Real future dates and the part of the day they suit.
  | "appointment_preference"
  // A file sent from the person's own phone into private Care storage.
  | "care_upload"
  // A clock time, recorded as HH:MM.
  | "time"
  // Choices grouped under headings, with the person's own words held apart.
  | "tag_list"
  // One person's details, asked together rather than one box at a time.
  | "contact_block";

/** A heading and the choices under it, for a grouped list. */
export interface CareOptionGroup {
  label: string;
  options: CareOption[];
}

/** One measure inside a measurement, with the unit it is always recorded in. */
export interface CareMeasure {
  key: string;
  label: string;
  unit: string;
}

/** Who an answer may be read by once it is on a record. */
export type CareAudience = "client" | "internal" | "restricted";

/** Whose information an answer describes. */
export type CareAnswerSubject =
  | "enquirer" | "care_recipient" | "household" | "care_request"
  | "service_intention" | "appointment" | "finance";

/** The record area where submitted evidence is relevant when staff read it. */
export type CareDisplayContext = "person" | "household" | "care_request" | "assessment" | "finance";

/** How often an answer can occur within one coordinated request. */
export type CareAnswerCardinality = "request" | "household" | "recipient" | "recipient_service" | "repeatable";

export interface CareOption {
  value: string;
  label: string;
  /** Clears every other selection, and is cleared by any other selection. */
  exclusive?: boolean;
}

/**
 * Every condition the definition uses, on a field or on a section.
 *
 * A condition either names one question and applies one test to it, or it
 * composes other conditions with allOf, anyOf or not. Composition is explicit:
 * nothing is inferred from the order the keys happen to be written in.
 */
export interface CareCondition {
  field?: string;
  in?: string[];
  notIn?: string[];
  contains?: string[];
  empty?: boolean;
  gte?: number;
  lt?: number;
  allOf?: CareCondition[];
  anyOf?: CareCondition[];
  not?: CareCondition;
}

export interface CareRoute {
  to: string;
  unless: string[];
  sameDay?: boolean;
}

export interface CareField {
  id: string;
  record: string;
  asked: string;
  type: CareFieldType;
  required?: boolean;
  /** The only two answers that can stop a submission. */
  blocking?: boolean;
  help?: string | null;
  options?: CareOption[];
  /** A list read from the system rather than written into the definition. */
  optionsFrom?: string;
  /** The question whose entries this control is chosen from. */
  source?: string;
  showWhen?: CareCondition;
  /** Something we already hold, so it is shown to confirm and never asked again. */
  prefill?: string;
  routes?: CareRoute;
  optionsGatedByFee?: Record<string, string>;
  /** A measurement's measures, each with the unit it is always recorded in. */
  measures?: CareMeasure[];
  /** The headings a grouped list offers its choices under. */
  groups?: CareOptionGroup[];
  /** The parts of a grouped person's details that have to be given. */
  requiredParts?: string[];
  /** The parts each entry of a repeatable item records. */
  items?: string[];
  /** The activities a matrix asks about, one level of support each. */
  rows?: string[];
  /** Who may read this answer once it is on a record. Client by default. */
  audience?: CareAudience;
  /**
   * An assessor's own clinical question, asked at the visit. Carried family
   * evidence is never marked this way: it is confirmed or amended instead.
   */
  assessorOnly?: boolean;
  /**
   * What this answer is to the assessment that follows it. Only
   * clinical_evidence is confirmed or amended; the rest is read, not judged.
   */
  carry?: CareCarry;
  /** Required on published pre-assessment definitions. Display metadata only. */
  subject?: CareAnswerSubject;
  displayContext?: CareDisplayContext;
  cardinality?: CareAnswerCardinality;
}

/** How an answer travels from the family's form to the professional visit. */
export type CareCarry =
  | "clinical_evidence"
  | "context"
  | "operational"
  | "authority_consent"
  | "not_carried";

export const CARE_CARRY_KINDS: CareCarry[] = [
  "clinical_evidence", "context", "operational", "authority_consent", "not_carried",
];

/** Nothing is carried as evidence unless the definition says so. */
export const fieldCarry = (field: CareField): CareCarry => field.carry ?? "context";

export interface CareSectionWhen {
  clientGroup?: string[];
  service?: string[];
  module?: string;
  notWhen?: CareCondition;
  /** Any further test the section applies, composed as the definition writes it. */
  condition?: CareCondition;
}

export interface CareSection {
  id: string;
  title: string;
  when: "always" | CareSectionWhen;
  intro?: string;
  /** confirm_amend sections carry the family's answers, not questions of their own. */
  mode?: string;
  fields: CareField[];
}

export interface CareModuleRule {
  always?: string[];
  whenAny?: CareCondition[];
}

export interface CareDefinition {
  version?: number;
  kind?: string;
  opening?: string;
  closing?: string;
  privacyUrl?: string;
  moduleRules?: Record<string, CareModuleRule>;
  sections: CareSection[];
}

export type CareResponses = Record<string, unknown>;

/**
 * The questionnaire names its service sections s1 to s8 and refers to them by
 * a service key. One mapping, so the services table stores the section and the
 * definition keeps its own words.
 */
export const SERVICE_KEY_BY_SECTION: Record<string, string> = {
  s1: "antenatal",
  s2: "postnatal",
  s3: "post_surgical",
  s4: "eldercare",
  s5: "clinical_home_care",
  s6: "nanny",
  s7: "additional_needs",
  s8: "other",
};

export const isAnswered = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).some(isAnswered);
  return true;
};

const asList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (value === null || value === undefined || value === "") return [];
  // A grouped list holds its chosen codes under `codes`, so a condition reads
  // the same values whether the control is a plain list or a grouped one.
  if (typeof value === "object") {
    const codes = (value as { codes?: unknown }).codes;
    if (Array.isArray(codes)) return codes.map((v) => String(v));
    return [];
  }
  return [String(value)];
};

/** Every choice a grouped list offers, flattened, in the order written. */
export const groupedOptions = (field: CareField): CareOption[] =>
  (field.groups ?? []).flatMap((group) => group.options);

/* ---------- derived routing facts ---------- */
//
// Who the care is for, how old they are and which service is being asked for
// are worked out from the answers themselves, never from a value recorded
// before the form was opened. They are read like any other answer, under
// reserved identifiers, and they are never stored as answers.

/** The facts the definition may route on. Nothing else may use this prefix. */
export const DERIVED_FIELDS = [
  "derived_is_self",
  "derived_age_years",
  "derived_age_band",
  "derived_recipient_group",
  "derived_service",
  "derived_is_parent",
  "derived_service_conflict",
] as const;

export const DERIVED_PREFIX = "derived_";

/**
 * Facts the intake settles about each care recipient (intakeRoutingAnswers in
 * care-intake.ts). Conditions may read them like answers; nobody answers them.
 */
export const INTAKE_FACTS = [
  "intake_relationship",
  "intake_filler_parent",
  "intake_first_recipient",
  "intake_sole_self",
  "intake_newborn_dob",
  "intake_newborn_names",
  "intake_parent_on_request",
];

/** Age bands for routing, never for a clinical judgement. */
export const ageBandOf = (years: number | null, days: number | null): string => {
  if (years === null) return "unknown";
  if (days !== null && days < 28) return "newborn";
  if (years < 2) return "infant";
  if (years < 18) return "child";
  if (years < 65) return "adult";
  return "older_person";
};

const daysBetween = (from: Date, to: Date) =>
  Math.floor((to.getTime() - from.getTime()) / 86_400_000);

export const ageFromDateOfBirth = (
  value: unknown,
  now: Date = new Date(),
): { years: number; days: number } | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const born = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(born.getTime())) return null;
  const days = daysBetween(born, now);
  if (days < 0 || days > 120 * 366) return null;
  let years = now.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < born.getUTCMonth() ||
    (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) years -= 1;
  return { years: Math.max(years, 0), days };
};

/** A baby, born or expected. */
export const BABY_BANDS = ["newborn", "infant", "expected"];

/** Services that only make sense for a child. */
export const CHILD_ONLY_SERVICES = ["nanny", "additional_needs"];
/** Services that only make sense for a pregnancy or a new mother. */
export const MATERNAL_SERVICES = ["antenatal", "postnatal"];

/**
 * Every derived fact, from the answers alone. The recorded service is only a
 * suggestion: it is used until the person answers, and a disagreement between
 * the two raises derived_service_conflict rather than a silent choice.
 */
export const derivedFacts = (
  responses: CareResponses,
  options: { recordedService?: string | null; now?: Date } = {},
): CareResponses => {
  const now = options.now ?? new Date();
  const self = String(responses.who_for ?? "") === "myself";
  const age = ageFromDateOfBirth(responses.date_of_birth, now);
  const approx = Number(responses.approx_age);
  const dobKnown = String(responses.dob_known ?? "");
  // A baby not born yet is held with the expected date. Once that date has
  // passed the baby is simply a newborn.
  const expected = dobKnown === "expected" && !age;
  const years = expected ? null : age
    ? age.years
    : dobKnown === "no" && Number.isFinite(approx) && approx >= 0 && approx <= 120
      ? Math.floor(approx)
      : null;
  const band = expected ? "expected" : ageBandOf(years, age ? age.days : null);
  // Where the recorded service and the answer disagree, the person is asked
  // once which support to prepare for. That answer settles it.
  const answeredService =
    String(responses.service_confirmed ?? "") || String(responses.service_requested ?? "");
  const service = answeredService || String(options.recordedService ?? "") || "";

  // The group the questions are actually written for. A maternal journey is
  // the service, not the age; a baby is the age, not the service.
  const group =
    MATERNAL_SERVICES.includes(service) && !BABY_BANDS.includes(band)
      ? "maternal"
      : BABY_BANDS.includes(band)
        ? "baby"
        : band === "child"
          ? "child"
          : band === "older_person"
            ? "older_person"
            : band === "adult"
              ? "adult"
              : "unknown";

  const recorded = String(options.recordedService ?? "");
  const settled = !!String(responses.service_confirmed ?? "");
  const conflictWithRecorded =
    !settled && !!recorded && !!answeredService && recorded !== answeredService;
  const impossible =
    (self && (BABY_BANDS.includes(band) || band === "child")) ||
    (CHILD_ONLY_SERVICES.includes(service) && years !== null && years >= 18) ||
    (MATERNAL_SERVICES.includes(service) && (band === "child" || BABY_BANDS.includes(band)));

  return {
    derived_is_self: self ? "yes" : "no",
    derived_age_years: years,
    derived_age_band: band,
    derived_recipient_group: group,
    derived_service: service || "unknown",
    derived_is_parent: String(responses.is_parent_guardian ?? "") === "yes" || String(responses.intake_filler_parent ?? "") === "yes" ? "yes" : "no",
    derived_service_conflict: conflictWithRecorded || impossible ? "yes" : "no",
  };
};

/** The answers as the conditions read them: what was answered, plus the facts. */
export const withDerived = (
  responses: CareResponses,
  options: { recordedService?: string | null; now?: Date } = {},
): CareResponses => ({ ...responses, ...derivedFacts(responses, options) });

/** Answers only. Nothing derived is ever written to a record. */
export const withoutDerived = (responses: CareResponses): CareResponses =>
  Object.fromEntries(Object.entries(responses).filter(([key]) => !key.startsWith(DERIVED_PREFIX)));

/**
 * One reading of every condition shape the definition uses.
 *
 * A condition either tests one question, or composes other conditions. Where
 * several tests are written on one condition, every one of them must hold.
 */
export const conditionMet = (condition: CareCondition, responses: CareResponses): boolean => {
  if (!condition || typeof condition !== "object") return true;
  if (condition.allOf && !condition.allOf.every((c) => conditionMet(c, responses))) return false;
  if (condition.anyOf && !condition.anyOf.some((c) => conditionMet(c, responses))) return false;
  if (condition.not && conditionMet(condition.not, responses)) return false;
  if (condition.field === undefined) {
    return !!(condition.allOf || condition.anyOf || condition.not);
  }

  const value = responses[condition.field];
  const list = asList(value);
  let tested = false;

  if (condition.empty !== undefined) {
    tested = true;
    if (condition.empty ? isAnswered(value) : !isAnswered(value)) return false;
  }
  if (condition.gte !== undefined) {
    tested = true;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n < condition.gte) return false;
  }
  if (condition.lt !== undefined) {
    tested = true;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n >= condition.lt) return false;
  }
  if (condition.contains) {
    tested = true;
    if (!condition.contains.some((v) => list.includes(v))) return false;
  }
  if (condition.notIn) {
    tested = true;
    if (list.length === 0 || list.some((v) => condition.notIn!.includes(v))) return false;
  }
  if (condition.in) {
    tested = true;
    if (!list.some((v) => condition.in!.includes(v))) return false;
  }
  return tested ? true : isAnswered(value);
};

export const fieldVisible = (field: CareField, responses: CareResponses): boolean =>
  !field.showWhen || conditionMet(field.showWhen, responses);

/**
 * Remove answers whose deterministic follow-up is no longer visible. Repeat
 * until stable because hiding one answer can close a later branch.
 */
export const pruneHiddenFieldAnswers = (
  fields: CareField[],
  responses: CareResponses,
): CareResponses => {
  let current = { ...responses };
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    for (const field of fields) {
      if (fieldVisible(field, current) || !isAnswered(current[field.id])) continue;
      current[field.id] = null;
      changed = true;
    }
    if (!changed) break;
  }
  return current;
};

/** Which extra modules attach, from the service and from what has been answered. */
export const activeModules = (
  definition: CareDefinition,
  serviceKey: string | null,
  responses: CareResponses,
): string[] => {
  const rules = definition.moduleRules ?? {};
  return Object.entries(rules)
    .filter(([, rule]) => {
      if (serviceKey && (rule.always ?? []).includes(serviceKey)) return true;
      return (rule.whenAny ?? []).some((c) => conditionMet(c, responses));
    })
    .map(([id]) => id);
};

export interface CareContext {
  /** adult, child or maternal. */
  clientGroup: string | null;
  /** The definition's own service key, from the service section on the client. */
  serviceKey: string | null;
  responses: CareResponses;
  modules: string[];
}

/**
 * Older definitions say adult, child or maternal. The routed definition says
 * which group the questions are written for. Both read the same way.
 */
const GROUP_ALIASES: Record<string, string[]> = {
  adult: ["adult", "older_person"],
  child: ["child", "baby"],
  maternal: ["maternal"],
  older_person: ["older_person"],
  baby: ["baby"],
};

const groupMatches = (wanted: string[], group: string | null): boolean => {
  if (!group) return false;
  return wanted.some((w) => w === group || (GROUP_ALIASES[w] ?? []).includes(group));
};

/**
 * A section applies when every condition it declares holds. Nothing returns
 * early on the first key it happens to find: a section naming both a group and
 * a service is filtered by both.
 */
export const sectionApplies = (section: CareSection, ctx: CareContext): boolean => {
  if (section.when === "always") return true;
  const when = section.when;
  if (!when || typeof when !== "object") return false;
  if (when.notWhen && conditionMet(when.notWhen, ctx.responses)) return false;
  if (when.clientGroup && !groupMatches(when.clientGroup, ctx.clientGroup)) return false;
  if (when.service && !(ctx.serviceKey && when.service.includes(ctx.serviceKey))) return false;
  if (when.module && !ctx.modules.includes(when.module)) return false;
  if (when.condition && !conditionMet(when.condition, ctx.responses)) return false;
  return true;
};

/**
 * The context every applicability decision is made in.
 *
 * The answers carry the derived facts with them, and the group and service are
 * taken from what the person answered. What was recorded on the enquiry is
 * only the starting point, kept while the routing questions are unanswered.
 */
export const buildContext = (
  definition: CareDefinition,
  args: {
    clientGroup: string | null;
    serviceKey: string | null;
    responses: CareResponses;
    now?: Date;
  },
): CareContext => {
  const responses = withDerived(args.responses, {
    recordedService: args.serviceKey,
    now: args.now,
  });
  const derivedGroup = String(responses.derived_recipient_group ?? "unknown");
  const derivedService = String(responses.derived_service ?? "unknown");
  const clientGroup = derivedGroup === "unknown" ? args.clientGroup : derivedGroup;
  const serviceKey = derivedService === "unknown" ? args.serviceKey : derivedService;
  return {
    clientGroup,
    serviceKey,
    responses,
    modules: activeModules(definition, serviceKey, responses),
  };
};

export const applicableSections = (definition: CareDefinition, ctx: CareContext): CareSection[] =>
  (definition.sections ?? []).filter((s) => sectionApplies(s, ctx));

/**
 * None of these, Not sure and their kind clear everything else, and are
 * cleared by anything else.
 */
export const toggleMulti = (field: CareField, current: unknown, value: string): string[] => {
  const list = Array.isArray(current) ? (current as string[]) : [];
  const option = field.options?.find((o) => o.value === value);
  if (list.includes(value)) return list.filter((v) => v !== value);
  if (option?.exclusive) return [value];
  const exclusives = new Set((field.options ?? []).filter((o) => o.exclusive).map((o) => o.value));
  return [...list.filter((v) => !exclusives.has(v)), value];
};

export const sectionAnswered = (section: CareSection, responses: CareResponses): number =>
  section.fields.filter((f) => fieldVisible(f, responses) && isAnswered(responses[f.id])).length;

/** Required is a flag and never a block. This is what is still missing. */
export const outstandingRequired = (
  sections: CareSection[],
  responses: CareResponses,
): { id: string; section: string; record: string }[] => {
  const out: { id: string; section: string; record: string }[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      if (!field.required || field.blocking) continue;
      if (!fieldVisible(field, responses)) continue;
      if (!answerComplete(field, responses[field.id])) {
        out.push({ id: field.id, section: section.id, record: field.record });
      }
    }
  }
  return out;
};

/**
 * Whether a required question is answered in full. A grouped set of details is
 * only complete when each part it names is given, so a contact cannot be left
 * as a name with no way of reaching the person.
 */
export const answerComplete = (field: CareField, value: unknown): boolean => {
  if (!isAnswered(value)) return false;
  const parts = field.requiredParts ?? [];
  if (parts.length === 0) return true;
  const held = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  return parts.every((part) => isAnswered(held[part]));
};

export const missingConsent = (sections: CareSection[], responses: CareResponses): string[] => {
  const missing: string[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      if (!field.blocking) continue;
      if (!fieldVisible(field, responses)) continue;
      if (!isAnswered(responses[field.id])) missing.push(field.id);
    }
  }
  return missing;
};

export interface RaisedFlag {
  field: string;
  record: string;
  to: string;
  sameDay: boolean;
  detail: string;
}

/** Answers that have to reach somebody today, or before the visit. */
export const raisedFlags = (
  sections: CareSection[],
  responses: CareResponses,
  labelOf: (field: CareField, value: unknown) => string,
): RaisedFlag[] => {
  const flags: RaisedFlag[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      if (!field.routes) continue;
      if (!fieldVisible(field, responses)) continue;
      const value = responses[field.id];
      if (!isAnswered(value)) continue;
      const chosen = asList(value);
      const concerning = chosen.filter((v) => !field.routes!.unless.includes(v));
      if (concerning.length === 0) continue;
      flags.push({
        field: field.id,
        record: field.record,
        to: field.routes.to,
        sameDay: !!field.routes.sameDay,
        detail: `${field.record}: ${labelOf(field, value)}`,
      });
    }
  }
  return flags;
};

/**
 * The structured clinical controls and the universal list each one picks
 * from. A control not named here holds no list.
 */
export const CLINICAL_LIST_FIELDS: Partial<Record<CareFieldType, ClinicalListName>> = {
  condition_list: "condition",
  medicine_list: "medicine",
  allergy_list: "allergen",
};

/** The parts of the day an appointment can be asked for. */
export const APPOINTMENT_PERIODS = [
  { value: "morning", label: "Morning (8am to 12pm)" },
  { value: "afternoon", label: "Afternoon (12pm to 4pm)" },
  { value: "evening", label: "Evening (4pm to 8pm)" },
] as const;

const listFor = (type: CareFieldType) => {
  const name = CLINICAL_LIST_FIELDS[type];
  return name ? CLINICAL_LISTS[name].terms : [];
};

/** One entry of a condition, medicine or allergy list, read back as words. */
export const readClinicalEntry = (type: CareFieldType, entry: unknown): string => {
  if (!entry || typeof entry !== "object") return "";
  const e = entry as Record<string, unknown>;
  const named = e.code
    ? clinicalLabel(listFor(type), String(e.code))
    : String(e.other ?? "").trim();
  const extras: string[] = [];
  if (type === "medicine_list") {
    if (isAnswered(e.dose)) extras.push(String(e.dose));
    if (isAnswered(e.frequency)) extras.push(String(e.frequency));
    if (e.stopped === true) extras.push("no longer taken");
  }
  if (type === "allergy_list") {
    if (isAnswered(e.severity)) {
      extras.push(groupLabel(ALLERGY_SEVERITIES, String(e.severity)).toLowerCase());
    }
    const reactions = Array.isArray(e.reaction) ? (e.reaction as unknown[]) : [];
    if (reactions.length) {
      extras.push(reactions.map((r) => groupLabel(ALLERGY_REACTIONS, String(r)).toLowerCase()).join(", "));
    }
  }
  if (type === "condition_list") {
    if (isAnswered(e.since)) extras.push(`since ${String(e.since)}`);
    if (e.ongoing === false) extras.push("in the past");
  }
  if (isAnswered(e.notes)) extras.push(String(e.notes));
  return extras.length ? `${named} (${extras.join("; ")})` : named;
};

export const readClinicalEntries = (type: CareFieldType, entries: unknown[]): string =>
  entries.map((e) => readClinicalEntry(type, e)).filter(Boolean).join("\n");

/** Chosen dates and the part of the day each suits. */
export const readAppointmentPreference = (value: unknown): string => {
  if (!value || typeof value !== "object") return "Not answered";
  const v = value as { slots?: unknown; notes?: unknown };
  const slots = Array.isArray(v.slots) ? v.slots : [];
  const lines = slots
    .map((slot) => {
      const s = (slot ?? {}) as Record<string, unknown>;
      if (!isAnswered(s.date)) return "";
      const period = APPOINTMENT_PERIODS.find((p) => p.value === s.period)?.label;
      const interval = isAnswered(s.start) && isAnswered(s.end)
        ? `${String(s.start)}–${String(s.end)}`
        : isAnswered(s.time) ? String(s.time) : "";
      if (interval) return `${String(s.date)}, ${interval}${period ? ` (${period.toLowerCase()})` : ""}`;
      return period ? `${String(s.date)}, ${period.toLowerCase()}` : String(s.date);
    })
    .filter(Boolean);
  if (isAnswered(v.notes)) lines.push(String(v.notes));
  return lines.length ? lines.join("\n") : "Not answered";
};

/** How an answer reads back on the client record. */
export const readAnswer = (
  field: CareField,
  value: unknown,
  bandLabels?: Record<string, string>,
): string => {
  if (!isAnswered(value)) return "Not answered";
  const label = (v: string) => {
    if (field.type === "budget_band") return bandLabels?.[v] ?? v;
    return field.options?.find((o) => o.value === v)?.label ?? v;
  };
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (CLINICAL_LIST_FIELDS[field.type] && Array.isArray(value)) {
    return readClinicalEntries(field.type, value);
  }
  if (field.type === "appointment_preference") return readAppointmentPreference(value);
  const entryLine = (entry: Record<string, unknown>) =>
    Object.entries(entry)
      .filter(([, v]) => isAnswered(v))
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(", ");
  if (Array.isArray(value)) {
    // A repeatable item reads entry by entry; every other list is a set of
    // chosen options.
    return value
      .map((v, index) =>
        v && typeof v === "object" && !Array.isArray(v)
          ? `${index + 1}. ${entryLine(v as Record<string, unknown>)}`
          : label(String(v)))
      .join(field.type === "repeatable" ? "\n" : ", ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (field.type === "upload" || obj.path) return "A file was uploaded with this answer";
    // An area reads as people say it: "Ikeja, Lagos".
    if (field.type === "lga" && (obj.lga || obj.state)) return [obj.lga, obj.state].filter(Boolean).map(String).join(", ");
    if (field.type === "measurement") {
      // A measurement is never read without the unit it was recorded in.
      return (field.measures ?? [])
        .filter((m) => isAnswered(obj[m.key]))
        .map((m) => `${m.label}: ${String(obj[m.key])} ${m.unit}`)
        .join(", ");
    }
    if (field.type === "matrix" || field.type === "weekly_pattern") {
      return Object.entries(obj)
        .filter(([, v]) => isAnswered(v))
        .map(([k, v]) => `${k}: ${label(String(v))}`)
        .join(", ");
    }
    if (field.type === "confirm") {
      const text = String(obj.value ?? "");
      return obj.confirmed ? text : `${text}, corrected by the person answering`;
    }
    if (field.type === "person_name") {
      return [obj.first, obj.middle, obj.last].filter(Boolean).join(" ");
    }
    if (field.type === "relationship") {
      return String(obj.other || obj.value || "");
    }
    if (field.type === "tag_list") {
      const all = groupedOptions(field);
      const codes = Array.isArray(obj.codes) ? (obj.codes as unknown[]) : [];
      const named = codes.map((c) => all.find((o) => o.value === String(c))?.label ?? String(c));
      if (isAnswered(obj.other)) named.push(String(obj.other));
      return named.join(", ");
    }
    if (field.type === "contact_block") {
      const name = [obj.firstName, obj.lastName].filter(Boolean).join(" ");
      const rest = [obj.relationship, obj.phone, obj.email].filter(Boolean).map(String);
      return [name, ...rest].filter(Boolean).join(", ");
    }
    return Object.entries(obj)
      .filter(([, v]) => isAnswered(v))
      .map(([k, v]) => `${k.charAt(0).toUpperCase()}${k.slice(1)}: ${String(v)}`)
      .join(", ");
  }
  if (field.type === "yes_no") return String(value) === "yes" ? "Yes" : "No";
  if (field.type === "choice" || field.type === "budget_band") return label(String(value));
  return String(value);
};

export const CLIENT_GROUPS = [
  { value: "adult", label: "An adult" },
  { value: "child", label: "A child" },
  { value: "maternal", label: "Pregnancy or a new mother" },
] as const;

export const FILLER_TYPES = [
  { value: "client", label: "The person receiving care" },
  { value: "parent", label: "A parent or guardian" },
  { value: "family_member", label: "A family member" },
  { value: "referring_clinician", label: "A referring clinician" },
] as const;

/**
 * Where a client actually is. Every one of these is derived in the database by
 * care_derive_stage(); no screen and no person chooses one. The older keys are
 * kept so historical records still read properly.
 */
export const CLIENT_STAGE_LABELS: Record<string, string> = {
  enquiry: "New enquiry",
  awaiting_pre_assessment: "Awaiting responses",
  pre_assessment_received: "Responses returned",
  assessment_booked: "Assessment booked",
  assessment_in_progress: "Assessment in progress",
  clinical_review: "Clinical review",
  care_plan_preparation: "Care plan being prepared",
  care_setup: "Care being set up",
  care_running: "Care running",
  paused: "Paused",
  closed: "Closed",
  // Historical keys, still readable on old records.
  callback_due: "Callback due",
  pre_assessment_sent: "Awaiting responses",
  responses_returned: "Responses returned",
  assessment_complete: "Assessment completed",
  plan_preparation: "Care plan being prepared",
  plan_issued: "Plan issued",
};

/** The stages a coordinator can filter by, in journey order. */
export const CLIENT_STAGE_ORDER = [
  "enquiry",
  "awaiting_pre_assessment",
  "pre_assessment_received",
  "assessment_booked",
  "assessment_in_progress",
  "clinical_review",
  "care_plan_preparation",
  "care_setup",
  "care_running",
  "paused",
  "closed",
] as const;

/** Staff-facing wording for a kind of work. One name per action. */
export const WORK_KIND_LABELS: Record<string, string> = {
  callback: "Call back",
  send_pre_assessment: "Send pre-assessment",
  chase: "Chase",
  book: "Book",
  assign: "Assign",
  conduct: "Conduct",
  clinical_review: "Clinical review",
  prepare_plan: "Prepare care plan",
  agree_package: "Agree package",
  staff_package: "Staff package",
  issue_contract: "Issue contract",
  first_visit_check: "First visit check",
  review_due: "Review due",
  invoice_due: "Invoice due",
  chase_payment: "Chase payment",
  resolve_escalation: "Resolve escalation",
  other: "Other",
};

export const workKindLabel = (kind: string) => WORK_KIND_LABELS[kind] ?? kind;

/**
 * Relationships we hold a list for, so a relationship is picked rather than
 * typed and what comes back is always a value we can match on.
 */
export const RELATIONSHIPS = [
  "Aunt", "Brother", "Brother-in-law", "Case manager", "Cousin", "Daughter",
  "Daughter-in-law", "Employer", "Family friend", "Father", "Father-in-law",
  "Friend", "Granddaughter", "Grandfather", "Grandmother", "Grandson",
  "Guardian", "Husband", "Mother", "Mother-in-law", "Neighbour", "Nephew",
  "Niece", "Nurse", "Partner", "Referring doctor", "Sister", "Sister-in-law",
  "Son", "Son-in-law", "Spouse", "Stepdaughter", "Stepfather", "Stepmother",
  "Stepson", "Uncle", "Wife",
] as const;

export const RELATIONSHIP_OTHER = "Other";

/**
 * Creating the human behind a client contact.
 *
 * A Care person is a human being with an immutable id. Email is a way of
 * reaching them, never who they are, so nothing here matches or merges on an
 * address. Where a person is already known, pass the id instead of calling
 * this.
 */
export const createCarePerson = async (
  db: { from: (table: string) => any },
  person: {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    country?: string | null;
    created_by?: string | null;
  },
): Promise<string | null> => {
  const { data, error } = await db
    .from("care_people")
    .insert({
      full_name: person.full_name,
      email: person.email ?? null,
      phone: person.phone ?? null,
      whatsapp: person.whatsapp ?? null,
      country: person.country ?? null,
      created_by: person.created_by ?? null,
      source: "staff",
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
};
