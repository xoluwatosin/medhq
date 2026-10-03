// The risk modules. These open from an answer, not from a service alone.
import { opts, q, yesNo, yesNoUnsure, when, section } from "./kit.mjs";

const medicines = section("mod_medicines", "Medicines", { module: "m_medicines" }, [
  q("md_list", "Medicines", "Please list the medicines {subject} {are} taking.", "repeatable", {
    items: ["Medicine", "Strength", "Dose", "How often", "What it is for"],
  }),
  q("md_manager", "Who manages the medicines", "Who manages the medicines?", "choice", {
    options: opts([
      "self|{Subject}", "family|Family", "caregiver|A caregiver",
      "nurse|A nurse", "other|Someone else",
    ]),
  }),
  q("md_help", "Help needed with medicines", "Is any help needed with medicines?", "multi", {
    options: opts([
      "reminders|Reminders", "prompting|Prompting", "packaging|Opening packaging",
      "administration|Giving the medicines", "injections|Injections",
      "collection|Collecting them", "reordering|Reordering", "none|No help needed|x",
      "not_sure|Not sure|x",
    ]),
  }),
  yesNoUnsure("md_missed", "Doses missed recently", "Have any doses been missed recently?"),
  q("md_missed_detail", "Which doses were missed", "Which ones, and what happened?", "long_text", {
    showWhen: when("md_missed", ["yes"]),
  }),
  yesNoUnsure("md_critical", "Time-critical or refrigerated medicines",
    "Are any of the medicines time-critical or kept in a fridge?"),
  q("md_critical_detail", "Time-critical medicines", "Which ones?", "long_text", {
    showWhen: when("md_critical", ["yes"]),
  }),
]);

const mobility = section("mod_mobility", "Moving about, falls and getting into the home",
  { module: "m_mobility" }, [
    q("mb_indoors", "How the person moves about indoors",
      "How {do} {subject} usually move about indoors?", "choice", {
        options: opts([
          "independent|Without help", "aid|With a walking aid",
          "with_person|With another person's help", "wheelchair|In a wheelchair",
          "in_bed|Mostly in bed", "other|Another way",
        ]),
      }),
    q("mb_aids", "Mobility aids used", "Which aids are used?", "multi", {
      showWhen: when("mb_indoors", ["aid", "with_person", "wheelchair", "other"]),
      options: opts([
        "stick|Walking stick", "frame|Walking frame", "crutches|Crutches",
        "wheelchair|Wheelchair", "rollator|Rollator", "other|Something else",
      ]),
    }),
    yesNoUnsure("mb_falls", "Falls in the last six months",
      "Has there been a fall in the last six months?"),
    q("mb_falls_count", "Number of falls", "How many falls?", "number", {
      showWhen: when("mb_falls", ["yes"]),
    }),
    q("mb_falls_last", "Date of the most recent fall", "When was the most recent one?", "date", {
      showWhen: when("mb_falls", ["yes"]),
    }),
    q("mb_falls_injury", "Injury from a fall", "Was there any injury?", "choice", {
      showWhen: when("mb_falls", ["yes"]),
      options: opts(["no|No injury", "minor|A minor injury", "serious|A serious injury"]),
      routes: { to: "nurse_review", unless: ["no", "minor"] },
    }),
    q("mb_falls_detail", "What happened", "What happened, and was it reviewed by anyone?", "long_text", {
      showWhen: when("mb_falls", ["yes"]),
    }),
    yesNo("mb_transfers", "Help needed with stairs or transfers",
      "Is help needed with stairs, or getting in and out of a bed or chair?"),
    q("mb_access", "Getting into the home", "Is anything difficult about getting into the home?", "multi", {
      options: opts([
        "stairs|Stairs", "no_lift|No lift", "narrow|A narrow entrance",
        "security|Security or a gate", "pets|Pets", "lighting|Poor lighting",
        "other|Something else", "none|Nothing difficult|x",
      ]),
    }),
    q("mb_equipment", "Equipment already in the home",
      "Which equipment is already in the home?", "multi", {
        options: opts([
          "bed|A hospital bed", "hoist|A hoist", "wheelchair|A wheelchair",
          "walker|A walker", "commode|A commode", "oxygen|Oxygen",
          "suction|Suction", "nebuliser|A nebuliser", "other|Something else", "none|None|x",
        ]),
      }),
  ]);

export const RISK_SECTIONS = [medicines, mobility];

/**
 * Which modules open. A service that always needs a module names it, and an
 * answer that raises the need opens it wherever it is given.
 */
export const MODULE_RULES = {
  m_medicines: {
    always: ["post_surgical", "clinical_home_care", "additional_needs"],
    whenAny: [{ field: "regular_medicines", in: ["yes"] }],
  },
  m_mobility: {
    always: ["eldercare", "post_surgical"],
    whenAny: [
      { field: "ps_mobility_change", in: ["reduced", "much_reduced", "bedbound"] },
      { field: "ad_mobility", in: ["aid", "help", "wheelchair"] },
      { field: "ch_need", contains: ["physio"] },
    ],
  },
  m_wound: {
    whenAny: [
      { field: "ch_need", contains: ["wound_care"] },
      { field: "ps_wound", in: ["yes"] },
    ],
  },
  m_device: {
    whenAny: [
      { field: "ch_need", contains: ["catheter_stoma", "iv", "feeding_tube"] },
      { field: "ps_devices", contains: ["drain", "catheter", "stoma", "iv", "oxygen"] },
      { field: "ad_equipment", contains: ["oxygen", "suction", "feeding_pump"] },
    ],
  },
  m_respiratory: {
    whenAny: [
      { field: "ch_need", contains: ["respiratory"] },
      { field: "ad_equipment", contains: ["oxygen", "suction"] },
    ],
  },
  m_nutrition: {
    whenAny: [
      { field: "ch_need", contains: ["feeding_tube"] },
      { field: "ad_eating_method", in: ["tube", "mixed", "modified"] },
    ],
  },
  m_palliative: {
    whenAny: [{ field: "ch_need", contains: ["palliative"] }],
  },
};
