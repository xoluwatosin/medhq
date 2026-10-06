// Version 13: consent asked plainly, family abroad, older people addressed as
// they prefer, help for the undecided, and no question asked twice.
//
// Decisions from the owner on 6 October 2026:
// - Someone who is not a child's parent is asked whether the parents agree,
//   not for the parents' details. Anyone arranging care for an adult is asked
//   whether that person agrees.
// - Family abroad give their country and city, so we call at a sensible time,
//   and someone we can reach locally.
// - Older people are asked how they would like to be addressed.
// - Someone unsure which service they need is helped to say what is needed.
// - Antenatal care asks where the birth is booked.
// - Questions that repeat one asked elsewhere are merged into it.
// Version 12 stays exactly as published.
import { readFileSync, writeFileSync } from "node:fs";

const v12 = JSON.parse(readFileSync(new URL("../../docs/care/pre-assessment-v12.json", import.meta.url), "utf8"));

const and = (field, condition) => ({
  ...field,
  showWhen: field.showWhen ? { allOf: [field.showWhen, condition] } : condition,
});
const firstOnly = { not: { field: "intake_first_recipient", in: ["no"] } };
const notService = (...services) => ({ not: { field: "derived_service", in: services } });

/** Answered elsewhere already: the merged question is named alongside. */
const REMOVE = {
  recipient_knows: "recipient_consent",
  recipient_feeling: "recipient_consent",
  decision_authority: "recipient_consent",
  decision_authority_other: "recipient_consent",
  pn_home_support: "support_now",
  an_home_support: "support_now",
  ps_household: "support_now",
  pn_feeding_help: "pn_mother_support (feeding support)",
  nn_health: "diagnosed_conditions",
  nn_health_detail: "condition_details",
  nn_medicines_detail: "md_list and md_manager",
  nn_languages: "languages",
  ps_wound_detail: "wd_sites and wd_dressing",
  ec_eating: "ec_independence (eating)",
  ot_what: "situation",
  ot_who: "the intake",
  ot_concern: "immediate_danger",
  ot_concern_detail: "immediate_danger",
};

const SHOW = {
  // The intake records how the person filling in is related to each child.
  is_parent_guardian: { field: "intake_relationship", empty: true },
  // Household questions, asked once.
  childcare_now: firstOnly,
  ec_home_safety: firstOnly,
  mb_access: firstOnly,
  nn_pattern: firstOnly,
  nn_overnight: firstOnly,
  nn_duties: firstOnly,
  nn_experience: firstOnly,
  nn_household: firstOnly,
  nn_priorities: firstOnly,
  nn_existing_reason: firstOnly,
  // Family abroad give a local contact instead.
  alt_contact_has: { not: { field: "enquirer_location", in: ["abroad"] } },
  // The surgery questions already ask about the hospital and the treating team.
  hospital_recent: notService("post_surgical"),
  // The service pages ask who is involved in their own terms.
  professional_involved: notService("antenatal", "additional_needs", "post_surgical"),
  // Asked already in the surgery questions, or in the child's needs.
  dv_items: notService("post_surgical"),
  mb_indoors: notService("additional_needs"),
  mb_equipment: notService("additional_needs"),
};

const REPLACE_SHOW = {
  dv_instructions: {
    anyOf: [
      { field: "dv_items", contains: ["catheter", "stoma", "feeding_tube", "iv", "tracheostomy", "oxygen", "suction", "nebuliser", "other"] },
      { field: "ps_devices", contains: ["drain", "catheter", "stoma", "iv", "oxygen", "other"] },
    ],
  },
  recipient_feeling_note: { field: "recipient_consent", in: ["not_asked", "unsure", "declines", "cannot_say"] },
};

const ASKED = {
  childcare_now: "Is there a nanny or regular childcare at the moment?",
  recipient_feeling_note: "Is there anything we should know about that?",
};

const RECORD = {
  recipient_feeling_note: "About the person's agreement to care",
};

const base = (id, record, asked, extra) => ({
  id, record, asked, carry: "authority_consent", subject: "care_recipient", displayContext: "person", cardinality: "recipient", ...extra,
});

/** New questions, each placed after the one named. */
const ADD = [
  ["is_parent_guardian", base("parent_consent", "The child's parents agree to this care",
    "Do {possessive} parents know about this care, and agree to it?", {
      type: "choice",
      required: true,
      subject: "enquirer",
      options: [
        { value: "yes", label: "Yes, they agree" },
        { value: "not_yet", label: "Not yet" },
        { value: "cannot", label: "It is not possible to ask them" },
      ],
      showWhen: { allOf: [
        { not: { field: "intake_relationship", empty: true } },
        { not: { field: "intake_filler_parent", in: ["yes"] } },
        { not: { field: "intake_parent_on_request", in: ["yes"] } },
      ] },
    })],
  ["parent_consent", base("parent_consent_note", "About the parents' agreement", "Please tell us more.", {
    type: "long_text",
    subject: "enquirer",
    showWhen: { field: "parent_consent", in: ["not_yet", "cannot"] },
  })],
  [null, base("recipient_consent", "The person agrees to this care", "Does {subject} agree to you arranging this care?", {
    type: "choice",
    required: true,
    options: [
      { value: "yes", label: "Yes" },
      { value: "not_asked", label: "Not asked yet" },
      { value: "unsure", label: "Unsure about it" },
      { value: "declines", label: "Does not want care" },
      { value: "cannot_say", label: "Not able to say" },
    ],
  }), "decisions_adult"],
  ["languages", {
    id: "address_as",
    record: "How they like to be addressed",
    asked: "How would {subject} like to be addressed?",
    help: "For example Mummy, Daddy, Chief, Mrs Adeyemi or a first name.",
    type: "text",
    carry: "context",
    subject: "care_recipient",
    displayContext: "person",
    cardinality: "recipient",
    showWhen: { field: "derived_recipient_group", in: ["older_person"] },
  }],
  ["support_detail", {
    id: "enquirer_location",
    record: "Where the person arranging care is based",
    asked: "Where are you based?",
    type: "choice",
    required: true,
    options: [
      { value: "lagos", label: "In Lagos" },
      { value: "nigeria", label: "Elsewhere in Nigeria" },
      { value: "abroad", label: "Outside Nigeria" },
    ],
    carry: "operational",
    subject: "enquirer",
    displayContext: "person",
    cardinality: "request",
    showWhen: { allOf: [firstOnly, { field: "who_for", in: ["someone_else"] }] },
  }],
  ["enquirer_location", {
    id: "enquirer_timezone",
    record: "Country and city, for the time zone",
    asked: "Which country and city are you in?",
    help: "So we call you at a sensible time.",
    type: "text",
    required: true,
    carry: "operational",
    subject: "enquirer",
    displayContext: "person",
    cardinality: "request",
    showWhen: { field: "enquirer_location", in: ["abroad"] },
  }],
  ["enquirer_timezone", {
    id: "local_contact",
    record: "Local contact",
    asked: "Who can we reach in Nigeria, close to {subject}?",
    help: "We need a first name, a last name, how they are related and a phone number.",
    type: "contact_block",
    required: true,
    carry: "operational",
    subject: "household",
    displayContext: "household",
    cardinality: "household",
    showWhen: { field: "enquirer_location", in: ["abroad"] },
  }],
  ["an_place_of_birth", {
    id: "an_booking_hospital",
    record: "Where the birth is booked",
    asked: "Which hospital or birth centre?",
    type: "hospital",
    carry: "clinical_evidence",
    subject: "care_recipient",
    displayContext: "assessment",
    cardinality: "recipient",
    showWhen: { field: "an_place_of_birth", in: ["hospital", "birth_centre"] },
  }],
  [null, {
    id: "ot_help_areas",
    record: "Kinds of help that sound closest",
    asked: "Which of these sound closest to what is needed?",
    help: "Choose any that fit. We will help work out the right care with you.",
    type: "multi",
    required: true,
    options: [
      { value: "personal_care", label: "Help with washing, dressing or getting about" },
      { value: "nursing", label: "Nursing, such as injections, wound care or medicines" },
      { value: "after_hospital", label: "Support after a hospital stay or an operation" },
      { value: "older_relative", label: "Day-to-day support for an older relative" },
      { value: "pregnancy_baby", label: "Care in pregnancy, or after a baby is born" },
      { value: "childcare", label: "A nanny or care for a child" },
      { value: "additional_needs", label: "Support for a child with additional needs" },
      { value: "company", label: "Company and someone to check in" },
      { value: "not_sure", label: "Not sure, we would like advice", exclusive: true },
    ],
    carry: "context",
    subject: "care_recipient",
    displayContext: "assessment",
    cardinality: "request",
  }, "svc_other"],
];

// Move the household questions ahead of the alternative contact, so the
// location decides which contact question is asked.
const ORDER = { core_support: ["support_now", "childcare_now", "support_detail", "enquirer_location", "enquirer_timezone", "local_contact", "alt_contact_has", "alt_contact"] };

const correct = (field) => {
  let next = { ...field };
  if (ASKED[field.id]) next.asked = ASKED[field.id];
  if (RECORD[field.id]) next.record = RECORD[field.id];
  if (REPLACE_SHOW[field.id]) next.showWhen = REPLACE_SHOW[field.id];
  if (SHOW[field.id]) next = and(next, SHOW[field.id]);
  return next;
};

const sections = v12.sections.map((section) => {
  let fields = section.fields.filter((f) => !REMOVE[f.id]).map(correct);
  for (const [after, field, sectionId] of ADD) {
    if (sectionId) {
      if (sectionId === section.id) fields = [field, ...fields];
      continue;
    }
    const at = fields.findIndex((f) => f.id === after);
    if (at >= 0) fields.splice(at + 1, 0, field);
  }
  if (ORDER[section.id]) {
    const rank = (id) => { const i = ORDER[section.id].indexOf(id); return i < 0 ? 999 : i; };
    fields = [...fields].sort((a, b) => rank(a.id) - rank(b.id));
  }
  return { ...section, fields };
});

// Someone unsure of the service is helped straight after saying what is
// happening, before the health questions.
const helper = sections.findIndex((s) => s.id === "svc_other");
const [other] = sections.splice(helper, 1);
sections.splice(sections.findIndex((s) => s.id === "core_situation") + 1, 0, other);

const definition = {
  ...v12,
  version: 13,
  source: "MC-FRM-09 pre-assessment specification, version 13, 6 October 2026",
  sections,
};

// Every change must land, and nothing may still read a removed question.
const ids = new Set(sections.flatMap((s) => s.fields.map((f) => f.id)));
const v12ids = new Set(v12.sections.flatMap((s) => s.fields.map((f) => f.id)));
for (const id of [...Object.keys(REMOVE), ...Object.keys(SHOW), ...Object.keys(REPLACE_SHOW), ...Object.keys(ASKED)]) {
  if (!v12ids.has(id)) throw new Error(`v13 changes a field that does not exist: ${id}`);
}
for (const [, field] of ADD) if (!ids.has(field.id)) throw new Error(`v13 did not place ${field.id}`);
const reads = (c, out = []) => {
  if (!c || typeof c !== "object") return out;
  if (typeof c.field === "string") out.push(c.field);
  for (const k of ["allOf", "anyOf"]) for (const x of c[k] ?? []) reads(x, out);
  if (c.not) reads(c.not, out);
  return out;
};
const allConditions = [
  ...sections.flatMap((s) => s.fields.map((f) => f.showWhen)),
  ...sections.map((s) => (typeof s.when === "object" ? s.when.condition : null)),
  ...Object.values(v12.moduleRules ?? {}).flatMap((r) => r.whenAny ?? []),
];
for (const c of allConditions) {
  for (const id of reads(c)) if (REMOVE[id]) throw new Error(`a condition still reads removed question ${id}`);
}
for (const s of sections) if (s.fields.length === 0) throw new Error(`section ${s.id} is empty`);

writeFileSync(new URL("../../docs/care/pre-assessment-v13.json", import.meta.url), `${JSON.stringify(definition, null, 2)}\n`);
console.log(`sections: ${sections.length}, questions: ${ids.size} (v12: ${v12ids.size})`);
