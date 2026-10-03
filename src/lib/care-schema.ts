// The governed questionnaire engine.
//
// A Care questionnaire is data, not code. A definition is published once,
// frozen, and every document written against it names the version it used.
// This file is the contract that data has to satisfy before it can be
// published, plus the one deterministic reading of which modules apply.
//
// Two promises are kept here.
//
//   A definition is either valid in full or not published at all. Every
//   problem is reported with the exact place it was found, so a malformed
//   definition can never reach a family or an assessor.
//
//   The same definition and the same answers always resolve to the same
//   modules, in the same order. The database resolves them the same way
//   (private.care_resolve_modules), so what a screen shows and what a record
//   holds can never disagree.
import {
  CARE_CARRY_KINDS,
  CareDefinition, CareField, CareFieldType, CareResponses,
  CareSection, conditionMet, DERIVED_FIELDS, DERIVED_PREFIX,
} from "@/lib/care";
import { COPY_TOKENS } from "@/lib/care-copy";

/** Every control the engine can draw. Anything else is rejected. */
export const CARE_FIELD_TYPES: CareFieldType[] = [
  "text", "textarea", "long_text", "number", "date", "phone",
  "choice", "multi", "checkbox", "upload", "confirm", "contact",
  "person_name", "relationship", "address", "lga",
  "language_picker", "budget_band",
  "yes_no", "measurement", "repeatable", "matrix", "weekly_pattern",
  "condition_list", "medicine_list", "allergy_list", "medicine_choice",
  "hospital", "professional", "appointment_preference", "care_upload",
  "time", "tag_list", "contact_block",
];

/**
 * Controls that cannot be drawn without a list to pick from. A budget band
 * reads the bands held in the system, so it carries no list of its own.
 */
const NEEDS_OPTIONS: CareFieldType[] = ["choice", "multi", "matrix"];

/** The only tests a condition may use. The database reads exactly these. */
export const CARE_CONDITION_OPERATORS = ["in", "notIn", "contains", "empty", "gte", "lt"] as const;

/** The only destinations an escalation may name. The server decides the rest. */
export const CARE_ESCALATION_TARGETS = ["clinical_lead", "nurse_review", "safeguarding", "coordinator"];

const CARE_AUDIENCES = ["client", "internal", "restricted"];
const CARE_ANSWER_SUBJECTS = ["enquirer", "care_recipient", "household", "care_request", "service_intention", "appointment", "finance"];
const CARE_DISPLAY_CONTEXTS = ["person", "household", "care_request", "assessment", "finance"];
const CARE_ANSWER_CARDINALITIES = ["request", "household", "recipient", "recipient_service", "repeatable"];

export interface DefinitionIssue {
  /** Where the problem is, for example sections[2].fields[4].options. */
  path: string;
  problem: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: DefinitionIssue[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);



/**
 * A condition either names one question and tests it, or composes other
 * conditions with allOf, anyOf or not. Every test it names has to be one the
 * engine reads, and every question it names has to exist.
 */
const conditionIssues = (condition: unknown, path: string, known: Set<string>): DefinitionIssue[] => {
  const issues: DefinitionIssue[] = [];
  if (!isRecord(condition)) {
    return [{ path, problem: "A condition names the question it reads" }];
  }

  for (const composer of ["allOf", "anyOf"] as const) {
    const list = condition[composer];
    if (list === undefined) continue;
    if (!Array.isArray(list) || list.length === 0) {
      issues.push({ path: `${path}.${composer}`, problem: `${composer} holds the conditions it joins` });
      continue;
    }
    for (const [index, inner] of list.entries()) {
      issues.push(...conditionIssues(inner, `${path}.${composer}[${index}]`, known));
    }
  }
  if (condition.not !== undefined) {
    issues.push(...conditionIssues(condition.not, `${path}.not`, known));
  }

  const composed = condition.allOf !== undefined || condition.anyOf !== undefined || condition.not !== undefined;
  const tests = Object.keys(condition).filter(
    (key) => !["field", "allOf", "anyOf", "not"].includes(key),
  );

  if (condition.field === undefined) {
    if (!composed) issues.push({ path, problem: "A condition names the question it reads" });
    if (tests.length > 0) {
      issues.push({ path, problem: "A test needs the question it reads" });
    }
    return issues;
  }

  if (typeof condition.field !== "string") {
    return [...issues, { path: `${path}.field`, problem: "A condition names the question it reads" }];
  }
  if (!known.has(condition.field)) {
    issues.push({ path: `${path}.field`, problem: `${condition.field} is not a question in this definition` });
  }
  if (tests.length === 0) issues.push({ path, problem: "A condition applies at least one test" });
  for (const test of tests) {
    if (!(CARE_CONDITION_OPERATORS as readonly string[]).includes(test)) {
      issues.push({ path, problem: `${test} is not a test the engine can read` });
    }
  }
  return issues;
};

const repeated = (values: string[]): boolean => new Set(values).size !== values.length;


const fieldIssues = (
  field: CareField,
  path: string,
  known: Set<string>,
  seen: Map<string, string>,
): DefinitionIssue[] => {
  const issues: DefinitionIssue[] = [];
  if (!field.id || typeof field.id !== "string") {
    issues.push({ path: `${path}.id`, problem: "A question needs a stable identifier" });
  } else if (seen.has(field.id)) {
    issues.push({ path: `${path}.id`, problem: `The identifier ${field.id} is already used at ${seen.get(field.id)}` });
  } else if (field.id.startsWith(DERIVED_PREFIX)) {
    issues.push({ path: `${path}.id`, problem: `${DERIVED_PREFIX} is reserved for the facts the engine derives` });
  } else {
    seen.set(field.id, path);
  }

  // Wording carries tokens so one question is asked in one voice. A token the
  // resolver does not know would reach a family unresolved.
  for (const [key, text] of [["asked", field.asked], ["help", field.help], ["record", field.record]] as const) {
    for (const token of String(text ?? "").matchAll(/\{([A-Za-z]+)\}/g)) {
      if (!COPY_TOKENS.includes(token[1])) {
        issues.push({ path: `${path}.${key}`, problem: `${token[0]} is not wording this engine can resolve` });
      }
    }
  }


  if (!field.record?.trim()) issues.push({ path: `${path}.record`, problem: "A question needs a name for the record" });
  if (!field.asked?.trim()) issues.push({ path: `${path}.asked`, problem: "A question needs the words it is asked in" });

  if (!CARE_FIELD_TYPES.includes(field.type)) {
    issues.push({ path: `${path}.type`, problem: `${String(field.type)} is not a control this engine can draw` });
  }

  if (NEEDS_OPTIONS.includes(field.type) && !(field.options ?? []).length && !field.optionsFrom) {
    issues.push({ path: `${path}.options`, problem: "This control needs a list to pick from" });
  }

  // A medicine follow-up is answered from medicines already entered, so it
  // names the question those entries came from.
  if (field.type === "medicine_choice") {
    if (!field.source) {
      issues.push({ path: `${path}.source`, problem: "This control names the question it is chosen from" });
    } else if (!known.has(field.source)) {
      issues.push({ path: `${path}.source`, problem: `${field.source} is not a question in this definition` });
    }
  }


  const values = new Set<string>();
  for (const [index, option] of (field.options ?? []).entries()) {
    if (!option?.value) {
      issues.push({ path: `${path}.options[${index}].value`, problem: "An option needs a stored value" });
      continue;
    }
    if (values.has(option.value)) {
      issues.push({ path: `${path}.options[${index}].value`, problem: `The value ${option.value} is repeated` });
    }
    values.add(option.value);
    if (!option.label?.trim()) {
      issues.push({ path: `${path}.options[${index}].label`, problem: "An option needs words to read" });
    }
  }

  if (field.type === "measurement" && !(field.measures ?? []).length) {
    issues.push({ path: `${path}.measures`, problem: "A measurement needs its measures and their fixed units" });
  }
  for (const [index, measure] of (field.measures ?? []).entries()) {
    if (!measure?.key || !measure.label?.trim() || !measure.unit?.trim()) {
      issues.push({ path: `${path}.measures[${index}]`, problem: "A measure needs a key, a name and a fixed unit" });
    }
  }
  if (repeated((field.measures ?? []).map((m) => m?.key))) {
    issues.push({ path: `${path}.measures`, problem: "Each measure needs its own key" });
  }

  if (field.type === "repeatable" && !(field.items ?? []).length) {
    issues.push({ path: `${path}.items`, problem: "A repeatable item needs the parts each entry records" });
  }
  if (repeated(field.items ?? [])) {
    issues.push({ path: `${path}.items`, problem: "Each part of an entry needs its own name" });
  }
  if (field.type === "matrix" && !(field.rows ?? []).length) {
    issues.push({ path: `${path}.rows`, problem: "A matrix needs its rows" });
  }
  if (repeated(field.rows ?? [])) {
    issues.push({ path: `${path}.rows`, problem: "Each row needs its own name" });
  }

  if (field.audience !== undefined && !CARE_AUDIENCES.includes(field.audience)) {
    issues.push({ path: `${path}.audience`, problem: "That is not a reading audience" });
  }
  if (field.assessorOnly !== undefined && typeof field.assessorOnly !== "boolean") {
    issues.push({ path: `${path}.assessorOnly`, problem: "Assessor-only is yes or no" });
  }
  if (field.carry !== undefined && !CARE_CARRY_KINDS.includes(field.carry)) {
    issues.push({ path: `${path}.carry`, problem: "That is not a way an answer can be carried" });
  }
  if (field.subject !== undefined && !CARE_ANSWER_SUBJECTS.includes(field.subject)) {
    issues.push({ path: `${path}.subject`, problem: "That is not a valid answer subject" });
  }
  if (field.displayContext !== undefined && !CARE_DISPLAY_CONTEXTS.includes(field.displayContext)) {
    issues.push({ path: `${path}.displayContext`, problem: "That is not a valid display context" });
  }
  if (field.cardinality !== undefined && !CARE_ANSWER_CARDINALITIES.includes(field.cardinality)) {
    issues.push({ path: `${path}.cardinality`, problem: "That is not a valid answer cardinality" });
  }

  if (field.routes) {
    for (const [index, value] of (field.routes.unless ?? []).entries()) {
      if (values.size > 0 && !values.has(value)) {
        issues.push({
          path: `${path}.routes.unless[${index}]`,
          problem: `${value} is not one of this question's answers`,
        });
      }
    }
    if (!CARE_ESCALATION_TARGETS.includes(field.routes.to?.trim() ?? "")) {
      issues.push({ path: `${path}.routes.to`, problem: "An escalation must reach an allowed destination" });
    }
    if (field.routes.sameDay !== undefined && typeof field.routes.sameDay !== "boolean") {
      issues.push({ path: `${path}.routes.sameDay`, problem: "Same day is yes or no" });
    }
  }

  if (field.showWhen !== undefined) {
    issues.push(...conditionIssues(field.showWhen, `${path}.showWhen`, known));
  }


  return issues;
};

/**
 * The whole definition, checked before anything is published against it.
 * Nothing is repaired here: a definition either passes or is sent back.
 */
export const validateDefinition = (candidate: unknown): ValidationResult => {
  const issues: DefinitionIssue[] = [];
  if (!isRecord(candidate)) {
    return { ok: false, issues: [{ path: "definition", problem: "A definition must be an object" }] };
  }
  const definition = candidate as unknown as CareDefinition;
  const sections = definition.sections;
  if (!Array.isArray(sections) || sections.length === 0) {
    return { ok: false, issues: [{ path: "sections", problem: "A definition needs at least one section" }] };
  }

  // The derived routing facts are read like questions, so a condition may
  // name one of them. Nothing may be authored under that prefix.
  const known = new Set<string>(DERIVED_FIELDS);
  for (const section of sections) {
    for (const field of section?.fields ?? []) if (field?.id) known.add(field.id);
  }

  const sectionIds = new Set<string>();
  const fieldPaths = new Map<string, string>();
  const declaredModules = new Set<string>();

  for (const [index, section] of sections.entries()) {
    const path = `sections[${index}]`;
    if (!section?.id) {
      issues.push({ path: `${path}.id`, problem: "A section needs a stable identifier" });
    } else if (sectionIds.has(section.id)) {
      issues.push({ path: `${path}.id`, problem: `The section ${section.id} appears twice` });
    } else {
      sectionIds.add(section.id);
    }

    if (!section?.title?.trim()) issues.push({ path: `${path}.title`, problem: "A section needs a title" });

    const when = section?.when;
    if (when !== "always" && !isRecord(when)) {
      issues.push({ path: `${path}.when`, problem: "A section applies always, or on a stated condition" });
    } else if (isRecord(when)) {
      if (typeof when.module === "string") declaredModules.add(when.module);
      if (when.notWhen !== undefined) {
        issues.push(...conditionIssues(when.notWhen, `${path}.when.notWhen`, known));
      }
      if (when.condition !== undefined) {
        issues.push(...conditionIssues(when.condition, `${path}.when.condition`, known));
      }
    }

    if (!Array.isArray(section?.fields)) {
      issues.push({ path: `${path}.fields`, problem: "A section needs its questions" });
      continue;
    }
    // A confirm_amend section carries the family's answers, not questions of its own.
    if (section.fields.length === 0 && section.mode !== "confirm_amend") {
      issues.push({ path: `${path}.fields`, problem: "A section needs at least one question" });
      continue;
    }
    for (const [fieldIndex, field] of section.fields.entries()) {
      issues.push(...fieldIssues(field, `${path}.fields[${fieldIndex}]`, known, fieldPaths));
      if (definition.kind === "pre_assessment" && Number(definition.version) >= 10) {
        if (!field.subject) issues.push({ path: `${path}.fields[${fieldIndex}].subject`, problem: "A question needs an answer subject" });
        if (!field.displayContext) issues.push({ path: `${path}.fields[${fieldIndex}].displayContext`, problem: "A question needs a display context" });
        if (!field.cardinality) issues.push({ path: `${path}.fields[${fieldIndex}].cardinality`, problem: "A question needs a cardinality" });
      }
    }
  }

  for (const [key, rule] of Object.entries(definition.moduleRules ?? {})) {
    if (!declaredModules.has(key)) {
      issues.push({ path: `moduleRules.${key}`, problem: "No section attaches to this module" });
    }
    for (const [index, condition] of (rule?.whenAny ?? []).entries()) {
      issues.push(...conditionIssues(condition, `moduleRules.${key}.whenAny[${index}]`, known));
    }
  }


  for (const module of declaredModules) {
    if (!definition.moduleRules?.[module]) {
      issues.push({ path: `moduleRules.${module}`, problem: "A module used by a section has no rule that opens it" });
    }
  }

  return { ok: issues.length === 0, issues };
};

/**
 * Which modules apply, resolved once and frozen onto the document.
 * Sorted, so the same inputs always produce the same list in the same order.
 */
export const resolveModules = (
  definition: CareDefinition,
  serviceKey: string | null,
  responses: CareResponses,
): string[] =>
  Object.entries(definition.moduleRules ?? {})
    .filter(([, rule]) => {
      if (serviceKey && (rule.always ?? []).includes(serviceKey)) return true;
      return (rule.whenAny ?? []).some((condition) => conditionMet(condition, responses));
    })
    .map(([id]) => id)
    .sort((a, b) => a.localeCompare(b));

/** The sections a frozen set of modules actually opens, in definition order. */
export const sectionsForModules = (
  definition: CareDefinition,
  modules: string[],
): CareSection[] => {
  const open = new Set(modules);
  return (definition.sections ?? []).filter((section) => {
    if (section.when === "always") return true;
    if (!isRecord(section.when)) return false;
    const module = (section.when as { module?: string }).module;
    return !module || open.has(module);
  });
};
