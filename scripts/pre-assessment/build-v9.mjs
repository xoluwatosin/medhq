// Builds the pre-assessment definition, version 9.
//
// Run with: node scripts/pre-assessment/build-v9.mjs
//
// Versions 1 to 8 stay exactly as published. A form already started keeps the
// questions it was started on, and every earlier record reads back unchanged.
//
// Version 9 is built from version 8 and closes the childcare gaps found in the
// audit of the approved plan:
//
//  1. The nursery or school questions are only asked where the duties expected
//     actually involve a school run, homework or taking the child to
//     appointments. The area it is in, and whether it runs in term time or all
//     year, are now asked.
//  2. Dietary requirements open with a plain yes, no or not sure, and the list
//     is grouped as agreed: food allergies, intolerances, medically advised
//     diets, religious or cultural, vegetarian or vegan, and texture and
//     feeding support. Allergies already recorded are shown beside it.
//  3. Sleep asks about waking in the night and about sleeping arrangements.
//  4. The role says live-in or live-out, and overnight care is asked as its own
//     question rather than being buried in a list of duties.
//  5. Each safety need chosen is followed by what happens and what helps, for
//     that need, rather than one box covering all of them.
import { readFileSync, writeFileSync } from "node:fs";

const v8 = JSON.parse(
  readFileSync(new URL("../../docs/care/pre-assessment-v8.json", import.meta.url), "utf8"),
);

const opts = (list) => list.map((entry) => {
  const [value, label, exclusive] = entry.split("|");
  return exclusive ? { value, label, exclusive: true } : { value, label };
});

const q = (id, record, asked, type, extra = {}) => ({ id, record, asked, type, ...extra });

const DAYS = opts([
  "mon|Monday", "tue|Tuesday", "wed|Wednesday", "thu|Thursday",
  "fri|Friday", "sat|Saturday", "sun|Sunday",
]);

/* ---- 1. the setting, asked only where the duties call for it ------------ */

const SETTING_DUTIES = { field: "nn_duties_child", contains: ["school_run", "homework", "outings"] };
const ATTENDS = { field: "nn_setting_attends", in: ["yes"] };
const settingShown = { allOf: [SETTING_DUTIES, ATTENDS] };

const SETTING_EXTRA = [
  q("nn_setting_area", "Area the setting is in", "Which area is it in?", "text", {
    help: "The part of town is enough.",
    showWhen: settingShown,
    carry: "operational",
  }),
  q("nn_setting_term", "When the setting runs",
    "Does it run in term time only, or all year?", "choice", {
      showWhen: settingShown,
      options: opts([
        "term_time|Term time only",
        "all_year|All year round",
        "varies|It varies",
      ]),
      carry: "operational",
    }),
];

/* ---- 2. dietary requirements -------------------------------------------- */

const DIET_GATE = q("nn_diet_has", "Dietary requirements held",
  "Are there any dietary requirements for {child}?", "choice", {
    options: opts(["yes|Yes", "no|No", "not_sure|Not sure"]),
    carry: "clinical_evidence",
  });

const DIET_GROUPS = [
  {
    label: "Food allergies",
    options: opts([
      "allergy_nuts|Nuts", "allergy_peanut|Peanuts", "allergy_dairy|Dairy", "allergy_egg|Egg",
      "allergy_wheat|Wheat", "allergy_soy|Soy", "allergy_fish|Fish", "allergy_shellfish|Shellfish",
      "allergy_sesame|Sesame",
    ]),
  },
  {
    label: "Intolerances",
    options: opts([
      "intol_lactose|Lactose", "intol_gluten|Gluten", "intol_fructose|Fructose",
      "intol_caffeine|Caffeine", "intol_spice|Spicy food", "intol_other_food|Another food",
    ]),
  },
  {
    label: "Medically advised diets",
    options: opts([
      "diet_diabetic|Diabetic diet", "diet_low_salt|Low salt", "diet_low_sugar|Low sugar",
      "diet_renal|Renal diet", "diet_high_protein|High protein", "diet_high_calorie|High calorie",
      "diet_sickle|Advised for sickle cell", "diet_weight|Weight management",
    ]),
  },
  {
    label: "Religious or cultural",
    options: opts([
      "halal|Halal", "kosher|Kosher", "no_pork|No pork", "no_beef|No beef",
      "no_alcohol_cooking|No alcohol in cooking", "fasting|Observes fasting",
    ]),
  },
  {
    label: "Vegetarian or vegan",
    options: opts([
      "vegetarian|Vegetarian", "vegan|Vegan", "pescatarian|Pescatarian",
      "no_red_meat|No red meat",
    ]),
  },
  {
    label: "Texture and feeding support",
    options: opts([
      "soft_food|Soft food", "pureed|Pureed food", "minced_moist|Minced and moist",
      "thickened_fluids|Thickened fluids", "small_portions|Small, frequent portions",
      "feeding_help|Needs help to eat", "tube_feeding|Tube feeding",
      "weaning|Weaning", "formula|Formula fed", "breast_milk|Breast milk",
    ]),
  },
];

const DIET_LIST = q("nn_diet", "Dietary requirements",
  "Which of these apply?", "tag_list", {
    help: "Choose anything that applies. Add anything else in your own words.",
    groups: DIET_GROUPS,
    source: "allergies",
    showWhen: { field: "nn_diet_has", in: ["yes", "not_sure"] },
    carry: "clinical_evidence",
  });

/* ---- 3. sleep ------------------------------------------------------------ */

const SLEEP_EXTRA = [
  q("nn_night_waking", "Wakes in the night", "Does {child} wake during the night?", "yes_no", {
    carry: "context",
  }),
  q("nn_night_waking_detail", "What happens at night",
    "What usually happens, and what helps?", "long_text", {
      showWhen: { field: "nn_night_waking", in: ["yes"] },
      carry: "context",
    }),
  q("nn_sleep_arrangement", "Sleeping arrangement", "Where does {child} sleep?", "choice", {
    options: opts([
      "own_room|Their own room",
      "shares_sibling|Shares a room with a brother or sister",
      "parent_room_cot|A cot in a parent's room",
      "shares_parent_bed|Shares a bed with a parent",
      "shares_carer|Shares a room with a carer",
      "other|Another arrangement",
    ]),
    carry: "context",
  }),
];

/* ---- 5. safety, one follow-up for each need chosen ----------------------- */

const SAFETY_AREAS = [
  ["allergy_risk", "an allergy"],
  ["choking_risk", "choking"],
  ["seizures", "seizures"],
  ["wandering", "wandering or running off"],
  ["climbing", "climbing"],
  ["water_safety", "water"],
  ["stairs", "stairs"],
  ["road_safety", "roads"],
  ["self_injury", "self-injury"],
  ["aggression", "hitting or biting"],
  ["medical_device", "a medical device"],
  ["constant_supervision", "needing constant supervision"],
];

const SAFETY_FOLLOW_UPS = SAFETY_AREAS.flatMap(([code, words]) => [
  q(`nn_safety_${code}_what`, `Safety: ${words}, what happens`,
    `What happens with ${words}?`, "long_text", {
      showWhen: { field: "nn_safety_areas", contains: [code] },
      carry: "clinical_evidence",
    }),
  q(`nn_safety_${code}_helps`, `Safety: ${words}, what helps`,
    `What helps with ${words}?`, "long_text", {
      showWhen: { field: "nn_safety_areas", contains: [code] },
      carry: "clinical_evidence",
    }),
]);

/* ---- 4. the role: overnight asked on its own ----------------------------- */

const ROLE_EXTRA = [
  q("nn_overnight", "Overnight care needed", "Is overnight care needed?", "yes_no", {
    carry: "operational",
  }),
  q("nn_overnight_nights", "Nights needed", "Which nights?", "multi", {
    showWhen: { field: "nn_overnight", in: ["yes"] },
    options: DAYS,
    carry: "operational",
  }),
];

/* ---- assembling version 9 ------------------------------------------------ */

const buildChildFields = (fields) => {
  const out = [];
  for (const field of fields) {
    if (field.id === "nn_setting_attends") {
      out.push({ ...field, showWhen: SETTING_DUTIES });
      continue;
    }
    if (field.id.startsWith("nn_setting_") || field.id === "nn_collection_people") {
      out.push({ ...field, showWhen: settingShown });
      if (field.id === "nn_setting_end") out.push(...SETTING_EXTRA);
      continue;
    }
    if (field.id === "nn_diet") {
      out.push(DIET_GATE, DIET_LIST);
      continue;
    }
    if (field.id === "nn_diet_notes") {
      out.push({ ...field, showWhen: { field: "nn_diet_has", in: ["yes", "not_sure"] } });
      continue;
    }
    if (field.id === "nn_sleep_notes") {
      out.push(...SLEEP_EXTRA, field);
      continue;
    }
    if (field.id === "nn_safety_detail") {
      out.push(...SAFETY_FOLLOW_UPS);
      continue;
    }
    out.push({ ...field });
  }
  return out;
};

const sections = v8.sections.map((section) => {
  if (section.id === "svc_nanny_children") {
    return { ...section, fields: buildChildFields(section.fields) };
  }
  if (section.id === "svc_nanny_role") {
    const fields = [];
    for (const field of section.fields) {
      if (field.id === "nn_pattern") {
        fields.push({ ...field, required: true }, ...ROLE_EXTRA);
        continue;
      }
      if (field.id === "nn_duties") {
        // Overnight is asked as its own question now.
        fields.push({ ...field, options: field.options.filter((o) => o.value !== "overnight") });
        continue;
      }
      fields.push({ ...field });
    }
    return { ...section, fields };
  }
  if (section.id === "core_support") {
    return {
      ...section,
      fields: section.fields.map((f) => (f.id === "alt_contact"
        // Every part of the alternative contact is needed, not just a name.
        ? { ...f, requiredParts: ["firstName", "lastName", "relationship", "phone"] }
        : f)),
    };
  }
  return section;
});

const definition = {
  ...v8,
  version: 9,
  source: "MC-FRM-09 pre-assessment specification, version 9, 15 September 2026",
  sections,
};

const path = new URL("../../docs/care/pre-assessment-v9.json", import.meta.url);
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
