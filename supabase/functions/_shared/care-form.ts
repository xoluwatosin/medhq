// Shared rules for the pre-assessment form, on the server side.
//
// A copy of src/lib/care.ts, because an edge function cannot import from src.
// If you change a rule in one, change it in the other: the loader, the saver
// and the screen the family sees must agree on what applies.

import {
  ACTIVE_ALLERGEN_CODES, ACTIVE_CONDITION_CODES, ACTIVE_MEDICINE_CODES,
  ALLERGY_REACTION_CODES, ALLERGY_SEVERITY_CODES,
} from "./care-clinical-codes.ts";

export type FillerType = "client" | "parent" | "family_member" | "referring_clinician";

export type FieldType =
  | "text" | "long_text" | "number" | "date" | "phone"
  | "choice" | "multi" | "checkbox" | "upload" | "confirm"
  | "person_name" | "relationship" | "address" | "lga"
  | "language_picker" | "budget_band"
  | "measurement" | "repeatable" | "matrix" | "weekly_pattern"
  | "condition_list" | "medicine_list" | "allergy_list" | "medicine_choice"
  | "hospital" | "professional" | "appointment_preference" | "care_upload"
  | "time" | "tag_list" | "contact_block";

/** A heading and the choices under it, for a grouped list. */
export interface FormOptionGroup {
  label: string;
  options: FormOption[];
}

export interface FormOption {
  value: string;
  label: string;
  exclusive?: boolean;
}

/**
 * A condition either names one question and applies tests to it, or it joins
 * other conditions with allOf, anyOf and not. Where several tests are written
 * on one condition, every one of them has to hold.
 */
export interface FormCondition {
  field?: string;
  in?: string[];
  notIn?: string[];
  contains?: string[];
  empty?: boolean;
  gte?: number;
  lt?: number;
  allOf?: FormCondition[];
  anyOf?: FormCondition[];
  not?: FormCondition;
}

export interface FormRoute {
  to: string;
  unless: string[];
  sameDay?: boolean;
}

/** How an answer travels to the professional visit. Mirrors src/lib/care.ts. */
export type FormCarry =
  | "clinical_evidence" | "context" | "operational" | "authority_consent" | "not_carried";

export interface FormField {
  id: string;
  record: string;
  asked: string;
  type: FieldType;
  required?: boolean;
  blocking?: boolean;
  help?: string | null;
  options?: FormOption[];
  /** The headings a grouped list offers its choices under. */
  groups?: FormOptionGroup[];
  /** A list read from the request rather than written into the definition. */
  optionsFrom?: string;
  /** The question whose entries this control is chosen from. */
  source?: string;
  /** The parts of a grouped person's details that have to be given. */
  requiredParts?: string[];
  showWhen?: FormCondition;
  prefill?: string;
  routes?: FormRoute;
  optionsGatedByFee?: Record<string, string>;
  /** Only clinical_evidence is confirmed or amended at the visit. */
  carry?: FormCarry;
}

export interface SectionWhen {
  clientGroup?: string[];
  service?: string[];
  module?: string;
  notWhen?: FormCondition;
  condition?: FormCondition;
}

export interface FormSection {
  id: string;
  title: string;
  when: "always" | SectionWhen;
  intro?: string;
  fields: FormField[];
}

export interface ModuleRule {
  always?: string[];
  whenAny?: FormCondition[];
}

export interface FormDefinition {
  version?: number;
  kind?: string;
  opening?: string;
  closing?: string;
  privacyUrl?: string;
  moduleRules?: Record<string, ModuleRule>;
  sections: FormSection[];
}

/** Section on the services table, to the service key the definition uses. */
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

export async function hashToken(plain: string): Promise<string> {
  const bytes = new TextEncoder().encode(plain);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Answered means a real answer. Null, an empty string and an empty list are not. */
export function isAnswered(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).some(isAnswered);
  return true;
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (value === null || value === undefined || value === "") return [];
  // A grouped list holds its chosen codes under `codes`, so a condition reads
  // the same values whether the control is a plain list or a grouped one.
  if (typeof value === "object") {
    const codes = (value as { codes?: unknown }).codes;
    return Array.isArray(codes) ? codes.map((v) => String(v)) : [];
  }
  return [String(value)];
}

/* ---------- derived routing facts ---------- */
//
// Who the care is for, how old they are and what is being asked for come from
// the answers, never from what was recorded before the form was opened. They
// are read like any other answer, under reserved identifiers, and they are
// never written to a record.

export const DERIVED_PREFIX = "derived_";

export const ageBandOf = (years: number | null, days: number | null): string => {
  if (years === null) return "unknown";
  if (days !== null && days < 28) return "newborn";
  if (years < 2) return "infant";
  if (years < 18) return "child";
  if (years < 65) return "adult";
  return "older_person";
};

export function ageFromDateOfBirth(
  value: unknown,
  now: Date = new Date(),
): { years: number; days: number } | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const born = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(born.getTime())) return null;
  const days = Math.floor((now.getTime() - born.getTime()) / 86_400_000);
  if (days < 0 || days > 120 * 366) return null;
  let years = now.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < born.getUTCMonth() ||
    (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) years -= 1;
  return { years: Math.max(years, 0), days };
}

export const CHILD_ONLY_SERVICES = ["nanny", "additional_needs"];
export const MATERNAL_SERVICES = ["antenatal", "postnatal"];

export function derivedFacts(
  responses: Record<string, unknown>,
  options: { recordedService?: string | null; now?: Date } = {},
): Record<string, unknown> {
  const now = options.now ?? new Date();
  const self = String(responses.who_for ?? "") === "myself";
  const age = ageFromDateOfBirth(responses.date_of_birth, now);
  const approx = Number(responses.approx_age);
  const years = age
    ? age.years
    : String(responses.dob_known ?? "") === "no" && Number.isFinite(approx) && approx >= 0 && approx <= 120
      ? Math.floor(approx)
      : null;
  const band = ageBandOf(years, age ? age.days : null);
  const answered =
    String(responses.service_confirmed ?? "") || String(responses.service_requested ?? "");
  const service = answered || String(options.recordedService ?? "") || "";

  const group =
    MATERNAL_SERVICES.includes(service) && band !== "newborn" && band !== "infant"
      ? "maternal"
      : band === "newborn" || band === "infant"
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
  const conflict =
    (!settled && !!recorded && !!answered && recorded !== answered) ||
    (self && (band === "newborn" || band === "infant" || band === "child")) ||
    (CHILD_ONLY_SERVICES.includes(service) && years !== null && years >= 18) ||
    (MATERNAL_SERVICES.includes(service) && (band === "child" || band === "newborn" || band === "infant"));

  return {
    derived_is_self: self ? "yes" : "no",
    derived_age_years: years,
    derived_age_band: band,
    derived_recipient_group: group,
    derived_service: service || "unknown",
    derived_is_parent: String(responses.is_parent_guardian ?? "") === "yes" ? "yes" : "no",
    derived_service_conflict: conflict ? "yes" : "no",
  };
}

export const withDerived = (
  responses: Record<string, unknown>,
  options: { recordedService?: string | null; now?: Date } = {},
): Record<string, unknown> => ({ ...responses, ...derivedFacts(responses, options) });

/** Answers only. Nothing derived is ever stored on a record. */
export const withoutDerived = (responses: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(responses).filter(([k]) => !k.startsWith(DERIVED_PREFIX)));

export function conditionMet(condition: FormCondition, responses: Record<string, unknown>): boolean {
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
}

export function fieldVisible(field: FormField, responses: Record<string, unknown>): boolean {
  return !field.showWhen || conditionMet(field.showWhen, responses);
}

export function activeModules(
  def: FormDefinition,
  serviceKey: string | null,
  responses: Record<string, unknown>,
): string[] {
  const rules = def.moduleRules ?? {};
  return Object.entries(rules)
    .filter(([, rule]) => {
      if (serviceKey && (rule.always ?? []).includes(serviceKey)) return true;
      return (rule.whenAny ?? []).some((c) => conditionMet(c, responses));
    })
    .map(([id]) => id);
}

export interface FilterContext {
  clientGroup: string | null;
  serviceKey: string | null;
  responses: Record<string, unknown>;
  modules: string[];
}

/** Older definitions name a broad group; the routed definition names the band. */
const GROUP_ALIASES: Record<string, string[]> = {
  adult: ["adult", "older_person"],
  child: ["child", "baby"],
  maternal: ["maternal"],
  older_person: ["older_person"],
  baby: ["baby"],
};

const groupMatches = (wanted: string[], group: string | null): boolean =>
  !!group && wanted.some((w) => w === group || (GROUP_ALIASES[w] ?? []).includes(group));

/** Every condition a section declares has to hold, not just the first one written. */
export function sectionApplies(section: FormSection, ctx: FilterContext): boolean {
  if (section.when === "always") return true;
  const when = section.when;
  if (!when || typeof when !== "object") return false;
  if (when.notWhen && conditionMet(when.notWhen, ctx.responses)) return false;
  if (when.clientGroup && !groupMatches(when.clientGroup, ctx.clientGroup)) return false;
  if (when.service && !(ctx.serviceKey && when.service.includes(ctx.serviceKey))) return false;
  if (when.module && !ctx.modules.includes(when.module)) return false;
  if (when.condition && !conditionMet(when.condition, ctx.responses)) return false;
  return true;
}

export function buildContext(
  def: FormDefinition,
  args: {
    clientGroup: string | null;
    serviceKey: string | null;
    responses: Record<string, unknown>;
    now?: Date;
  },
): FilterContext {
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
    modules: activeModules(def, serviceKey, responses),
  };
}

export function applicableSections(def: FormDefinition, ctx: FilterContext): FormSection[] {
  return (def.sections ?? []).filter((s) => sectionApplies(s, ctx));
}

/**
 * Required is a flag, never a block. This lists what is still missing so the
 * coordinator can see it, and the submission goes through regardless.
 */
/**
 * Whether a required question is answered in full. A grouped set of details is
 * only complete when each part it names is given.
 */
export function answerComplete(field: FormField, value: unknown): boolean {
  if (!isAnswered(value)) return false;
  const parts = field.requiredParts ?? [];
  if (parts.length === 0) return true;
  const held = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  return parts.every((part) => isAnswered(held[part]));
}

export function outstandingRequired(
  sections: FormSection[],
  responses: Record<string, unknown>,
): { id: string; section: string; record: string }[] {
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
}

/** The only answers that stop a submission. */
export function missingConsent(
  sections: FormSection[],
  responses: Record<string, unknown>,
): string[] {
  const missing: string[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      if (!field.blocking) continue;
      if (!fieldVisible(field, responses)) continue;
      if (!isAnswered(responses[field.id])) missing.push(field.id);
    }
  }
  return missing;
}

export interface RaisedFlag {
  field: string;
  record: string;
  to: string;
  sameDay: boolean;
  detail: string;
}

function readable(field: FormField, value: unknown): string {
  const label = (v: string) => field.options?.find((o) => o.value === v)?.label ?? v;
  if (Array.isArray(value)) return value.map((v) => label(String(v))).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return label(String(value));
}

/** Answers that have to reach somebody, and whether they cannot wait. */
export function raisedFlags(
  sections: FormSection[],
  responses: Record<string, unknown>,
): RaisedFlag[] {
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
        detail: `${field.record}: ${readable(field, value)}`,
      });
    }
  }
  return flags;
}

/** Nulls out blank answers so an unanswered question is never stored as false or "". */
export function cleanResponses(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = isAnswered(value) ? value : null;
  }
  return out;
}

/**
 * The link segment: a client reference and a short secret, for example
 * MC-2609-0142-K7M4. Only the whole segment is hashed, so knowing the
 * reference on its own opens nothing.
 */
export const LINK_SEGMENT = /^MC-\d{4}-\d{4,}-[A-Z0-9]{4}$/;

export function clientRefFromSegment(segment: string): string | null {
  if (!LINK_SEGMENT.test(segment)) return null;
  return segment.slice(0, segment.lastIndexOf("-"));
}

const SECRET_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Four characters, with nothing anybody could misread over the phone. */
export function newSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes).map((b) => SECRET_ALPHABET[b % SECRET_ALPHABET.length]).join("");
}

/* ---------- server side value validation ---------- */
//
// A control on a screen is not validation. Every controlled answer is checked
// against the published definition and the reference tables before it is
// written, so nothing that Care cannot read later reaches the document.

export interface ControlledRefs {
  /** Lower-cased language labels, as the picker stores them. */
  languages: Set<string>;
  /** Lower-cased relationship labels. */
  relationships: Set<string>;
  /** Lower-cased state label to state code. */
  states: Map<string, string>;
  /** State code to the lower-cased labels of its areas. */
  lgas: Map<string, Set<string>>;
  /** Budget band identifiers. */
  budgetBands: Set<string>;
}

export interface ValueProblem {
  field: string;
  message: string;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((v) => String(v)) : [];

const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const optionValues = (field: FormField) => new Set((field.options ?? []).map((o) => o.value));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_UPLOADS = 10;
const UPLOAD_KEYS = new Set(["id", "name"]);

/* ---- Structured clinical answers -------------------------------------- */
//
// A governed code has to be a live term in the same vocabulary the browser
// offered. Words a family typed themselves stay separate, under `other`, and
// are never quietly turned into a code. Nothing here infers a diagnosis, a
// prescription or a verified allergy: this is reported evidence.

const CLINICAL_KEYS: Record<string, Set<string>> = {
  condition_list: new Set(["code", "other", "since", "ongoing", "notes"]),
  medicine_list: new Set([
    "code", "other", "dose", "strength", "frequency", "reason", "since", "stopped", "notes",
  ]),
  allergy_list: new Set(["code", "other", "severity", "reaction", "notes"]),
};

const CLINICAL_CODES: Record<string, Set<string>> = {
  condition_list: ACTIVE_CONDITION_CODES,
  medicine_list: ACTIVE_MEDICINE_CODES,
  allergy_list: ACTIVE_ALLERGEN_CODES,
};

const isDateOnly = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());

const checkClinicalList = (type: string, value: unknown): string | null => {
  if (!Array.isArray(value)) return "That answer should be a list";
  if (value.length > 60) return "That is more entries than we can record here";
  const allowedKeys = CLINICAL_KEYS[type];
  const allowedCodes = CLINICAL_CODES[type];
  const seen = new Set<string>();

  for (const entry of value) {
    const record = obj(entry);
    for (const key of Object.keys(record)) {
      if (!allowedKeys.has(key)) return "That entry is not in a shape we can read";
    }

    const code = typeof record.code === "string" ? record.code.trim() : "";
    const other = typeof record.other === "string" ? record.other.trim() : "";
    if (record.code !== undefined && typeof record.code !== "string") {
      return "That entry is not one we hold";
    }
    if (record.other !== undefined && record.other !== null && typeof record.other !== "string") {
      return "Those words are not in a shape we can read";
    }
    if (code && other) return "That entry names both a code and free text";
    if (!code && !other) return "That entry is empty";
    if (code && !allowedCodes.has(code)) return "That entry is not one we hold";
    if (other.length > 200) return "That entry is longer than we can record";

    const key = code || `other:${other.toLowerCase()}`;
    if (seen.has(key)) return "That entry is listed twice";
    seen.add(key);

    for (const text of ["dose", "strength", "frequency", "reason", "notes"] as const) {
      const held = record[text];
      if (held === undefined || held === null) continue;
      if (typeof held !== "string") return "That detail is not in a shape we can read";
      if (held.length > 300) return "That detail is longer than we can record";
    }
    for (const flag of ["ongoing", "stopped"] as const) {
      const held = record[flag];
      if (held !== undefined && held !== null && typeof held !== "boolean") {
        return "That answer should be yes or no";
      }
    }
    if (record.since !== undefined && record.since !== null) {
      if (typeof record.since !== "string" || record.since.length > 40) {
        return "That is not a date we can read";
      }
    }
    if (type === "allergy_list") {
      const severity = record.severity;
      if (severity !== undefined && severity !== null) {
        if (typeof severity !== "string" || !ALLERGY_SEVERITY_CODES.has(severity)) {
          return "That is not a severity we hold";
        }
      }
      const reaction = record.reaction;
      if (reaction !== undefined && reaction !== null) {
        if (!Array.isArray(reaction)) return "That reaction is not in a shape we can read";
        for (const r of reaction) {
          if (typeof r !== "string" || !ALLERGY_REACTION_CODES.has(r)) {
            return "That is not a reaction we hold";
          }
        }
      }
    }
  }
  return null;
};

/**
 * Preferred dates for the assessment visit. Not roster availability: at most
 * three real future dates, each with one part of the day, in the order given.
 */
const checkAppointmentPreference = (value: unknown): string | null => {
  const record = obj(value);
  for (const key of Object.keys(record)) {
    if (key !== "slots" && key !== "notes") return "That answer is not in a shape we can read";
  }
  if (record.slots !== undefined && !Array.isArray(record.slots)) {
    return "That answer is not in a shape we can read";
  }
  const slots = Array.isArray(record.slots) ? record.slots : [];
  if (slots.length > 3) return "Choose at most three dates";

  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set<string>();
  for (const slot of slots) {
    const s = obj(slot);
    for (const key of Object.keys(s)) {
      if (!["date", "period", "start", "end", "time"].includes(key)) {
        return "That date is not in a shape we can read";
      }
    }
    for (const key of ["start", "end", "time"] as const) {
      const held = s[key];
      if (held === undefined || held === null || held === "") continue;
      if (typeof held !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(held.trim())) {
        return "That is not a time we offer";
      }
    }
    const date = typeof s.date === "string" ? s.date.trim() : "";
    if (!date) continue;
    if (!isDateOnly(date)) return "That is not a date";
    if (date <= today) return "Choose a date in the future";
    const period = s.period === null || s.period === undefined ? "" : String(s.period);
    if (period && !["morning", "afternoon", "evening"].includes(period)) {
      return "That is not a time of day we offer";
    }
    const key = `${date}|${period}|${String(s.start ?? "")}`;
    if (seen.has(key)) return "That date and time is already chosen";
    seen.add(key);
  }
  if (record.notes !== undefined && record.notes !== null && typeof record.notes !== "string") {
    return "That note is not in a shape we can read";
  }
  return null;
};


const checkField = (field: FormField, value: unknown, refs: ControlledRefs): string | null => {
  switch (field.type) {
    case "choice": {
      if (typeof value !== "string") return "That answer is not one of the choices";
      return optionValues(field).has(value) ? null : "That answer is not one of the choices";
    }
    case "budget_band": {
      if (typeof value !== "string") return "That is not a band we hold";
      return optionValues(field).has(value) || refs.budgetBands.has(value)
        ? null : "That is not a band we hold";
    }
    case "multi": {
      if (!Array.isArray(value)) return "That answer is not a list of choices";
      const allowed = optionValues(field);
      // A list built from the care recipients on this request also accepts
      // their keys. Which keys exist is checked against the intake elsewhere.
      const fromRecipients = field.optionsFrom === "care_recipients";
      return strings(value).every((v) => allowed.has(v) || (fromRecipients && /^r\d+$/.test(v)))
        ? null : "One of those is not a choice we offer";
    }
    // A clock time, as the browser records it.
    case "time": {
      if (typeof value !== "string") return "That is not a time";
      return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim()) ? null : "That is not a time";
    }
    // Choices grouped under headings. A code has to be one this question
    // offers; anything the person wrote themselves stays under `other`.
    case "tag_list": {
      const record = obj(value);
      for (const key of Object.keys(record)) {
        if (key !== "codes" && key !== "other") return "That answer is not in a shape we can read";
      }
      const allowed = new Set((field.groups ?? []).flatMap((g) => (g.options ?? []).map((o) => o.value)));
      const codes = record.codes;
      if (codes !== undefined && codes !== null) {
        if (!Array.isArray(codes)) return "That answer is not a list of choices";
        const seen = new Set<string>();
        for (const code of codes) {
          if (typeof code !== "string" || !allowed.has(code)) return "One of those is not a choice we offer";
          if (seen.has(code)) return "That choice is listed twice";
          seen.add(code);
        }
      }
      if (record.other !== undefined && record.other !== null) {
        if (typeof record.other !== "string") return "Those words are not in a shape we can read";
        if (record.other.length > 400) return "That is longer than we can record";
      }
      return null;
    }
    // One person's details, asked together.
    case "contact_block": {
      const record = obj(value);
      const keys = new Set(["firstName", "lastName", "relationship", "relationshipOther", "phone", "email"]);
      for (const key of Object.keys(record)) {
        if (!keys.has(key)) return "Those details are not in a shape we can read";
        const held = record[key];
        if (held === null || held === undefined) continue;
        if (typeof held !== "string") return "Those details are not in a shape we can read";
        if (held.length > 120) return "That detail is longer than we can record";
      }
      const email = String(record.email ?? "").trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "That is not an email address";
      return null;
    }
    case "checkbox":
      return value === true || value === false || value === null ? null : "That answer should be a tick";
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? null : "That should be a number";
    }
    case "date": {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return "That is not a date";
      return Number.isNaN(new Date(value).getTime()) ? "That is not a date" : null;
    }
    case "language_picker": {
      const list = typeof value === "string"
        ? value.split(",").map((v) => v.trim()).filter(Boolean)
        : strings(value);
      if (list.length === 0) return "That is not a language we hold";
      return list.every((l) => refs.languages.has(l.toLowerCase()))
        ? null : "That is not a language we hold";
    }
    case "relationship": {
      const record = obj(value);
      const picked = String(record.value ?? "").trim();
      if (!picked) return "Choose a relationship";
      if (picked.toLowerCase() === "other") {
        return String(record.other ?? "").trim() ? null : "Say how they are related";
      }
      return refs.relationships.has(picked.toLowerCase())
        ? null : "That is not a relationship we hold";
    }
    case "lga": {
      const record = obj(value);
      const state = String(record.state ?? "").trim();
      const area = String(record.lga ?? "").trim();
      if (!state) return "Choose a state";
      const stateCode = refs.states.get(state.toLowerCase());
      if (!stateCode) return "That is not a Nigerian state we hold";
      if (!area) return null;
      return refs.lgas.get(stateCode)?.has(area.toLowerCase())
        ? null : "That area is not in the chosen state";
    }
    case "person_name": {
      const record = obj(value);
      return Object.values(record).every((v) => v === null || typeof v === "string")
        ? null : "That name is not in a shape we can read";
    }
    case "confirm": {
      const record = obj(value);
      if (typeof record.confirmed !== "boolean") return "That confirmation is not in a shape we can read";
      return record.value === undefined || typeof record.value === "string"
        ? null : "That confirmation is not in a shape we can read";
    }
    case "condition_list":
    case "medicine_list":
    case "allergy_list":
      return checkClinicalList(field.type, value);
    // A choice made from medicines the family already entered. Only the keys
    // of those entries are accepted, so nothing new is named here.
    case "medicine_choice": {
      if (!Array.isArray(value)) return "Choose from the medicines already listed";
      if (value.some((v) => typeof v !== "string" || !v.trim())) {
        return "That choice is not in a shape we can read";
      }
      return null;
    }
    case "hospital":
    case "professional": {
      const record = obj(value);
      return Object.values(record).every((v) => v === null || typeof v === "string")
        ? null : "Those details are not in a shape we can read";
    }
    case "appointment_preference":
      return checkAppointmentPreference(value);
    case "care_upload": {
      if (!Array.isArray(value)) return "That answer should be a list of files";
      if (value.length > MAX_UPLOADS) return `Send at most ${MAX_UPLOADS} files for one question`;
      const seen = new Set<string>();
      for (const entry of value) {
        const record = obj(entry);
        // Only a reference the server itself issued counts as evidence: a
        // storage path sent by a browser proves nothing.
        const id = String(record.id ?? "").trim();
        if (!UUID.test(id)) return "That file is not one we hold";
        if (seen.has(id)) return "That file is listed twice";
        seen.add(id);
        if (record.name !== undefined && typeof record.name !== "string") {
          return "That file is not one we hold";
        }
        for (const key of Object.keys(record)) {
          if (!UPLOAD_KEYS.has(key)) return "That file is not in a shape we can read";
        }
      }
      return null;
    }

    case "text":
    case "long_text":
    case "address":
    case "phone":
      return typeof value === "string" ? null : "That answer should be text";
    default:
      return null;
  }
};


/* ---------- who an answer belongs to ---------- */
//
// A request can hold several care recipients. An answer that belongs to one of
// them is written under that person's own key, `r1__field_id`, so two people on
// one request can never overwrite each other. A request-wide answer keeps its
// plain identifier, which is also what every record written before this holds.

export const SCOPED_KEY = /^(r\d+)__(.+)$/;

export const readScopedKey = (key: string): { recipientId: string | null; fieldId: string } => {
  const match = SCOPED_KEY.exec(key);
  return match ? { recipientId: match[1], fieldId: match[2] } : { recipientId: null, fieldId: key };
};

/** Request-wide answers plus one recipient's answers, under plain field ids. */
export function answersForRecipient(
  responses: Record<string, unknown>,
  recipientId: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(responses)) {
    const scoped = readScopedKey(key);
    if (scoped.recipientId === null || scoped.recipientId === recipientId) {
      out[scoped.fieldId] = value;
    }
  }
  return out;
}

/** Answers that belong to the request itself, excluding recipient namespaces. */
export function requestAnswers(responses: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(responses).filter(([key]) => readScopedKey(key).recipientId === null),
  );
}

/** The care recipients this request actually has, from the stored intake. */
export function recipientIdsOf(responses: Record<string, unknown>): Set<string> {
  const intake = responses.care_intake;
  const list = intake && typeof intake === "object" && Array.isArray((intake as Record<string, unknown>).recipients)
    ? (intake as { recipients: unknown[] }).recipients
    : [];
  const ids = new Set<string>();
  for (const entry of list) {
    const id = entry && typeof entry === "object" ? (entry as Record<string, unknown>).id : null;
    if (typeof id === "string" && /^r\d+$/.test(id)) ids.add(id);
  }
  return ids;
}

/* ---------- the intake ---------- */

const SERVICE_VALUES = new Set([
  "antenatal", "postnatal_mother", "newborn", "paediatric", "additional_needs",
  "nanny", "post_surgical", "eldercare", "clinical_home_care", "other",
]);

const shortText = (value: unknown, limit = 120): boolean =>
  value === undefined || value === null || (typeof value === "string" && value.length <= limit);

/**
 * The intake says who is asking, who is receiving care and what each of them
 * needs. It is a structured answer rather than a free record, so it is checked
 * as strictly as any controlled field before it is written.
 */
export function validateIntake(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return "We cannot read those details";
  const intake = value as Record<string, unknown>;

  const enquirer = intake.enquirer;
  if (!enquirer || typeof enquirer !== "object" || Array.isArray(enquirer)) {
    return "We cannot read your details";
  }
  for (const key of ["firstName", "lastName", "phone", "email"]) {
    if (!shortText((enquirer as Record<string, unknown>)[key])) return "We cannot read your details";
  }

  if (intake.forWhom !== null && intake.forWhom !== undefined
    && !["myself", "other", "several"].includes(String(intake.forWhom))) {
    return "We cannot read who this request is for";
  }

  const recipients = intake.recipients;
  if (!Array.isArray(recipients)) return "We cannot read the care recipients";
  if (recipients.length > 12) return "That is more care recipients than one request can hold";

  const seen = new Set<string>();
  for (const entry of recipients) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "We cannot read the care recipients";
    const r = entry as Record<string, unknown>;
    if (typeof r.id !== "string" || !/^r\d+$/.test(r.id)) return "We cannot read the care recipients";
    if (seen.has(r.id)) return "A care recipient is listed twice";
    seen.add(r.id);
    for (const key of ["firstName", "lastName", "phone", "email", "relationship", "relationshipOther", "dateOfBirth"]) {
      if (!shortText(r[key])) return "We cannot read the care recipient details";
    }
    if (r.dobKnown !== undefined && r.dobKnown !== null && !["yes", "no"].includes(String(r.dobKnown))) {
      return "We cannot read the care recipient details";
    }
    if (r.approxAge !== undefined && r.approxAge !== null) {
      const age = Number(r.approxAge);
      if (!Number.isFinite(age) || age < 0 || age > 120) return "Enter an approximate age in years";
    }
    if (!Array.isArray(r.services) || r.services.some((s) => !SERVICE_VALUES.has(String(s)))) {
      return "We cannot read the services chosen";
    }
  }
  return null;
}

/** Every controlled answer in the payload, checked against the definition. */
export function validateResponses(
  sections: FormSection[],
  incoming: Record<string, unknown>,
  refs: ControlledRefs,
  recipientIds?: Set<string>,
): ValueProblem[] {
  const byId = new Map<string, FormField>();
  for (const section of sections) for (const field of section.fields ?? []) byId.set(field.id, field);

  const problems: ValueProblem[] = [];
  for (const [key, value] of Object.entries(incoming)) {
    if (key === "care_intake") {
      const message = validateIntake(value);
      if (message) problems.push({ field: key, message });
      continue;
    }
    if (!isAnswered(value)) continue;
    const { recipientId, fieldId } = readScopedKey(key);
    // An answer may only be filed under a care recipient this request holds.
    if (recipientId && recipientIds && !recipientIds.has(recipientId)) {
      problems.push({ field: key, message: "That answer is not for anyone on this request" });
      continue;
    }
    const field = byId.get(fieldId);
    if (!field) continue;
    const message = checkField(field, value, refs);
    if (message) problems.push({ field: key, message });
  }
  return problems;
}

