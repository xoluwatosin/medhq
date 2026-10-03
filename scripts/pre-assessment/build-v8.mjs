// Builds the pre-assessment definition, version 8.
//
// Run with: node scripts/pre-assessment/build-v8.mjs
//
// Versions 1 to 7 stay exactly as published. A form already started keeps the
// questions it was started on, and every earlier record reads back unchanged.
//
// Version 8 is built from version 7 and changes four things:
//
//  1. Who will be at the assessment is chosen from the care recipients this
//     request actually holds, so "the person receiving care" and "me" can
//     never be offered as two contradictory answers.
//  2. The alternative contact is asked once, as one person's details, rather
//     than as a first name that opens four more boxes.
//  3. Childcare no longer asks how many children there are or for a written
//     paragraph about each of them. The people are already named at intake,
//     so these questions are asked once for each named child.
//  4. Childcare says whether it is clinical or not. Health, medicines,
//     allergies and safety are still asked either way; the hospital and
//     treating-professional questions are not asked of a family who said the
//     care is not clinical.
import { readFileSync, writeFileSync } from "node:fs";

const v7 = JSON.parse(
  readFileSync(new URL("../../docs/care/pre-assessment-v7.json", import.meta.url), "utf8"),
);

const opts = (list) => list.map((entry) => {
  const [value, label, exclusive] = entry.split("|");
  return exclusive ? { value, label, exclusive: true } : { value, label };
});

const q = (id, record, asked, type, extra = {}) => ({ id, record, asked, type, ...extra });

const shownWhen = (field, condition) => ({
  ...field,
  showWhen: field.showWhen ? { allOf: [condition, field.showWhen] } : condition,
});

/* ---- 1. who will be at the assessment ---------------------------------- */

const ATTENDEES = {
  optionsFrom: "care_recipients",
  asked: "Who will be there for the assessment?",
  help: "Choose everyone who will be at the visit.",
  options: opts([
    "family|Another family member",
    "caregiver|A caregiver already helping",
    "other|Someone else",
  ]),
};

/* ---- 2. the alternative contact, asked as one person -------------------- */

const ALT_CONTACT_REMOVED = new Set([
  "alt_contact_first_name", "alt_contact_last_name", "alt_contact_relationship",
  "alt_contact_phone", "alt_contact_email",
]);

const ALT_CONTACT = [
  q("alt_contact_has", "Alternative contact held",
    "Is there someone else we can contact about this care?", "yes_no", {
      help: "Somebody we can reach if we cannot reach you.",
      carry: "operational",
    }),
  q("alt_contact", "Alternative contact",
    "Their details", "contact_block", {
      required: true,
      help: "We need a first name, a last name, how they are related and a phone number.",
      showWhen: { field: "alt_contact_has", in: ["yes"] },
      carry: "operational",
    }),
];

/* ---- 3 and 4. childcare, asked once for each named child ---------------- */
//
// Every question below is asked for one child, under that child's own key.
// Nothing asks a family to describe several children in one box.

const DAYS = opts([
  "mon|Monday", "tue|Tuesday", "wed|Wednesday", "thu|Thursday",
  "fri|Friday", "sat|Saturday", "sun|Sunday",
]);

const DIET_GROUPS = [
  {
    label: "Religious or cultural",
    options: opts([
      "halal|Halal", "kosher|Kosher", "no_pork|No pork", "no_beef|No beef",
      "no_alcohol_cooking|No alcohol in cooking", "fasting|Observes fasting",
    ]),
  },
  {
    label: "Diet followed",
    options: opts([
      "vegetarian|Vegetarian", "vegan|Vegan", "pescatarian|Pescatarian",
      "low_sugar|Low sugar", "low_salt|Low salt", "high_protein|High protein",
      "weaning|Weaning", "formula|Formula fed", "breast_milk|Breast milk",
    ]),
  },
  {
    label: "Texture and feeding support",
    options: opts([
      "soft_food|Soft food", "pureed|Pureed food", "minced_moist|Minced and moist",
      "thickened_fluids|Thickened fluids", "small_portions|Small, frequent portions",
      "feeding_help|Needs help to eat", "tube_feeding|Tube feeding",
    ]),
  },
  {
    label: "Foods avoided",
    options: opts([
      "no_nuts|No nuts", "no_dairy|No dairy", "no_eggs|No eggs", "no_gluten|No gluten",
      "no_shellfish|No shellfish", "no_soy|No soy", "no_fish|No fish", "no_sesame|No sesame",
    ]),
  },
];

const ACTIVITY_GROUPS = [
  {
    label: "Play and games",
    options: opts([
      "building_blocks|Building blocks", "puzzles|Puzzles", "board_games|Board games",
      "pretend_play|Pretend play", "cars_trains|Cars and trains", "dolls|Dolls and figures",
      "outdoor_play|Outdoor play", "water_play|Water play",
    ]),
  },
  {
    label: "Sport and movement",
    options: opts([
      "football|Football", "swimming|Swimming", "cycling|Cycling", "running|Running and chasing",
      "dancing|Dancing", "gymnastics|Gymnastics", "walks|Walks",
    ]),
  },
  {
    label: "Creative",
    options: opts([
      "drawing|Drawing and colouring", "painting|Painting", "music|Music and singing",
      "instrument|Playing an instrument", "cooking|Helping in the kitchen", "crafts|Crafts",
    ]),
  },
  {
    label: "Quiet",
    options: opts([
      "reading|Books and stories", "screen_time|Television or tablet", "audio_stories|Audio stories",
      "counting_letters|Numbers and letters", "nature|Looking at plants and animals",
    ]),
  },
];

const COMFORT_GROUPS = [
  {
    label: "Objects",
    options: opts([
      "blanket|A particular blanket", "soft_toy|A soft toy", "dummy|A dummy",
      "bottle|A bottle or cup", "photo|A photograph of family",
    ]),
  },
  {
    label: "People and closeness",
    options: opts([
      "being_held|Being held", "rocking|Being rocked", "back_rub|A back rub",
      "hand_holding|Holding a hand", "familiar_person|One familiar person nearby",
    ]),
  },
  {
    label: "Sound and surroundings",
    options: opts([
      "singing|Singing", "quiet_voice|A quiet voice", "music_comfort|Music",
      "dim_light|Dimmed light", "night_light|A night light", "quiet_room|A quiet room",
      "routine|Keeping to the usual routine",
    ]),
  },
];

const nannyChildFields = [
  q("nn_care_kind", "Kind of childcare needed",
    "Is the childcare clinical or not?", "choice", {
      required: true,
      help: "Clinical means a nurse or another health professional is needed for health tasks.",
      options: opts([
        "non_clinical|Not clinical, everyday childcare",
        "clinical|Clinical, health tasks are needed",
        "both|Both",
      ]),
      carry: "clinical_evidence",
    }),
  q("nn_duties_child", "Duties expected for this child",
    "Which duties are expected for {child}?", "multi", {
      options: opts([
        "supervision|Supervision through the day", "meals|Preparing meals",
        "feeding_help|Helping with feeding", "bathing|Bathing and dressing",
        "nappies|Nappies or toileting", "naps|Settling for naps and bedtime",
        "school_run|School run", "homework|Homework support",
        "play|Play and activities", "outings|Outings", "laundry|Their laundry",
        "tidying|Tidying their room and toys", "medicines|Giving medicines",
        "health_tasks|Health tasks a nurse would do", "overnight|Overnight care",
      ]),
      carry: "operational",
    }),
  q("nn_setting_attends", "Attends a nursery or school",
    "Does {child} attend a nursery, school or other setting?", "yes_no", {
      carry: "operational",
    }),
  q("nn_setting_type", "Type of setting", "What kind of setting is it?", "choice", {
    showWhen: { field: "nn_setting_attends", in: ["yes"] },
    options: opts([
      "creche|Crèche or daycare",
      "nursery|Nursery or pre-school",
      "primary|Primary school",
      "secondary|Secondary school",
      "special|Special school or unit",
      "home_school|Home schooling",
      "therapy_centre|Therapy or early-intervention centre",
      "other|Another kind of setting",
    ]),
    carry: "operational",
  }),
  q("nn_setting_name", "Name of the setting", "What is it called?", "text", {
    showWhen: { field: "nn_setting_attends", in: ["yes"] },
    carry: "operational",
  }),
  q("nn_setting_days", "Days attended", "Which days does {child} attend?", "multi", {
    showWhen: { field: "nn_setting_attends", in: ["yes"] },
    options: DAYS,
    carry: "operational",
  }),
  q("nn_setting_start", "Setting start time", "What time does the day start?", "time", {
    showWhen: { field: "nn_setting_attends", in: ["yes"] },
    carry: "operational",
  }),
  q("nn_setting_end", "Setting finish time", "What time does the day finish?", "time", {
    showWhen: { field: "nn_setting_attends", in: ["yes"] },
    carry: "operational",
  }),
  q("nn_collection_people", "Authorised to collect",
    "Who else is authorised to collect {child}?", "repeatable", {
      showWhen: { field: "nn_setting_attends", in: ["yes"] },
      items: ["First name", "Last name", "Relationship", "Phone number"],
      help: "Add each person separately. Leave this empty if nobody else is authorised.",
      carry: "operational",
    }),
  q("nn_health", "Health conditions",
    "Does {child} have a health condition we should know about?", "yes_no", {
      carry: "clinical_evidence",
    }),
  q("nn_health_detail", "Health conditions", "What should we know?", "long_text", {
    showWhen: { field: "nn_health", in: ["yes"] },
    carry: "clinical_evidence",
  }),
  q("nn_medicines_detail", "Medicines for this child",
    "Which medicines does {child} take, and who gives them?", "long_text", {
      showWhen: { field: "regular_medicines", in: ["yes"] },
      carry: "clinical_evidence",
    }),
  q("nn_diet", "Dietary requirements",
    "Are there any dietary requirements for {child}?", "tag_list", {
      help: "Choose anything that applies. Add anything else in your own words.",
      groups: DIET_GROUPS,
      carry: "clinical_evidence",
    }),
  q("nn_diet_notes", "How meals usually work",
    "Is there anything else about meals we should know?", "long_text", {
      carry: "context",
    }),
  q("nn_naps", "Daytime naps", "Does {child} still nap during the day?", "yes_no", {
    carry: "context",
  }),
  q("nn_nap_start", "Usual nap time", "What time does the nap usually start?", "time", {
    showWhen: { field: "nn_naps", in: ["yes"] },
    carry: "context",
  }),
  q("nn_nap_length", "Usual nap length", "About how long does the nap last?", "choice", {
    showWhen: { field: "nn_naps", in: ["yes"] },
    options: opts([
      "under_30|Under 30 minutes", "30_60|30 minutes to an hour",
      "1_2|One to two hours", "over_2|More than two hours", "varies|It varies",
    ]),
    carry: "context",
  }),
  q("nn_bedtime", "Usual bedtime", "What time is bedtime?", "time", { carry: "context" }),
  q("nn_waking", "Usual waking time", "What time does {child} usually wake?", "time", {
    carry: "context",
  }),
  q("nn_sleep_settle", "How they settle", "What helps {child} settle to sleep?", "multi", {
    options: opts([
      "story|A story", "song|A song", "rocking|Rocking", "feed|A feed",
      "night_light|A night light", "dark_room|A dark room", "comfort_object|A comfort object",
      "someone_present|Someone staying in the room", "settles_alone|Settles alone",
    ]),
    carry: "context",
  }),
  q("nn_sleep_notes", "Anything else about sleep",
    "Is there anything else about sleep we should know?", "long_text", { carry: "context" }),
  q("nn_toileting", "Toileting", "Where is {child} with toileting?", "choice", {
    options: opts([
      "nappies|In nappies", "training|Toilet training",
      "independent|Independent", "night_support|Independent by day, support at night",
    ]),
    carry: "clinical_evidence",
  }),
  q("nn_languages", "Languages at home", "Which languages are spoken at home?", "language_picker", {
    carry: "context",
  }),
  q("nn_activities", "Activities enjoyed", "What does {child} enjoy?", "tag_list", {
    help: "Choose anything that applies. Add anything else in your own words.",
    groups: ACTIVITY_GROUPS,
    carry: "context",
  }),
  q("nn_comfort", "What comforts them", "What helps {child} feel settled?", "tag_list", {
    help: "Choose anything that applies. Add anything else in your own words.",
    groups: COMFORT_GROUPS,
    carry: "context",
  }),
  q("nn_safety_areas", "Safety and supervision needs",
    "Are there any safety or supervision needs?", "multi", {
      options: opts([
        "allergy_risk|Allergy risk", "choking_risk|Choking risk", "seizures|Seizures",
        "wandering|Wanders or runs off", "climbing|Climbs", "water_safety|Water safety",
        "stairs|Stairs", "road_safety|Road safety", "self_injury|Self-injury",
        "aggression|Hitting or biting", "medical_device|A medical device to keep safe",
        "constant_supervision|Needs constant supervision",
        "none|No particular safety needs|x",
      ]),
      routes: { to: "safeguarding", unless: ["none"] },
      carry: "clinical_evidence",
    }),
  q("nn_safety_detail", "What happens, and what helps",
    "For each of those, what happens and what helps?", "long_text", {
      showWhen: {
        field: "nn_safety_areas",
        contains: [
          "allergy_risk", "choking_risk", "seizures", "wandering", "climbing", "water_safety",
          "stairs", "road_safety", "self_injury", "aggression", "medical_device",
          "constant_supervision",
        ],
      },
      carry: "clinical_evidence",
    }),
];

/** Retired with the free-text child block and the old role questions. */
const REMOVED = new Set([
  "nn_children_count", "nn_children", "nn_feeding", "nn_sleep", "nn_safety",
  "nn_collection",
]);

/** Not asked of a family who said the childcare is not clinical. */
const CLINICAL_PATHWAY = new Set([
  "hospital_recent", "hospital_name", "admission_date", "discharge_status",
  "discharge_date", "expected_discharge", "discharge_letter",
  "professional_involved", "professional_details",
]);

const NOT_NON_CLINICAL_CHILDCARE = {
  not: {
    allOf: [
      { field: "nn_care_kind", in: ["non_clinical"] },
      { field: "derived_service", in: ["nanny"] },
    ],
  },
};

const sections = v7.sections.map((section) => {
  if (section.id === "svc_nanny_children") {
    return { ...section, title: "About this child", fields: nannyChildFields.map((f) => ({ ...f })) };
  }

  let fields = section.fields.filter((f) => !REMOVED.has(f.id) && !ALT_CONTACT_REMOVED.has(f.id));

  if (section.id === "core_support") fields = [...fields, ...ALT_CONTACT];
  if (section.id === "core_arrangements") {
    fields = fields.map((f) => (f.id === "visit_attendees" ? { ...f, ...ATTENDEES } : f));
  }
  if (section.id === "core_health") {
    fields = fields.map((f) =>
      (CLINICAL_PATHWAY.has(f.id) ? shownWhen(f, NOT_NON_CLINICAL_CHILDCARE) : f));
  }
  return { ...section, fields };
});

const definition = {
  ...v7,
  version: 8,
  source: "MC-FRM-08 pre-assessment specification, version 8, 15 September 2026",
  sections,
};

const path = new URL("../../docs/care/pre-assessment-v8.json", import.meta.url);
writeFileSync(path, `${JSON.stringify(definition, null, 2)}\n`);

const all = definition.sections.flatMap((s) => s.fields);
const ids = all.map((f) => f.id);
const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
if (duplicate) throw new Error(`Question ${duplicate} is used twice`);

const known = new Set(ids);
const check = (condition, where) => {
  if (!condition || typeof condition !== "object") return;
  for (const part of [...(condition.allOf ?? []), ...(condition.anyOf ?? []), condition.not].filter(Boolean)) {
    check(part, where);
  }
  if (condition.field && !known.has(condition.field) && !condition.field.startsWith("derived_")) {
    throw new Error(`${where} reads a question that is not in this definition: ${condition.field}`);
  }
};
for (const section of definition.sections) {
  for (const field of section.fields) check(field.showWhen, field.id);
  if (typeof section.when === "object") {
    check(section.when.condition, section.id);
    check(section.when.notWhen, section.id);
  }
}

console.log(`sections: ${definition.sections.length}, questions: ${all.length}`);
