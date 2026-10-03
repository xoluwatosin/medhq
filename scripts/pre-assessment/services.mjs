// The service pathways. Each one opens only for its own service, and only for
// a recipient the questions make sense for.
import {
  opts, q, yesNo, yesNoUnsure, when, all, any, not, section,
  isGroup, isService, CHILD_RECIPIENT, ADULT_RECIPIENT,
} from "./kit.mjs";

const antenatal = section("svc_antenatal", "About the pregnancy", {
  service: ["antenatal"],
  clientGroup: ["maternal", "adult", "older_person"],
}, [
  q("an_due_date", "Expected due date", "What is the expected due date?", "date"),
  q("an_weeks", "Weeks of pregnancy", "How many weeks pregnant {are} {subject}?", "number", {
    help: "Leave this if you are not sure.",
  }),
  q("an_multiple", "Single or multiple pregnancy", "Is this a single or multiple pregnancy?", "choice", {
    options: opts(["single|One baby", "multiple|More than one baby", "not_known|Not known"]),
  }),
  yesNo("an_clinician", "Pregnancy overseen by a clinician",
    "Is an obstetrician, midwife or clinic overseeing the pregnancy?"),
  q("an_clinician_details", "Who oversees the pregnancy",
    "Who is overseeing it, and where?", "long_text", { showWhen: when("an_clinician", ["yes"]) }),
  q("an_place_of_birth", "Planned place of birth", "Where is the birth planned?", "choice", {
    options: opts([
      "hospital|Hospital", "birth_centre|Birth centre", "home|At home", "undecided|Not decided yet",
    ]),
  }),
  yesNoUnsure("an_high_risk", "Pregnancy described as high risk",
    "Has this pregnancy been described as high risk?"),
  q("an_high_risk_reason", "Why the pregnancy is high risk",
    "What reason were you given?", "long_text", { showWhen: when("an_high_risk", ["yes"]) }),
  q("an_concerns", "Pregnancy concerns raised", "Have any of these been raised?", "multi", {
    options: opts([
      "bp|Raised blood pressure or pre-eclampsia",
      "diabetes|Diabetes in pregnancy",
      "bleeding|Bleeding",
      "pain|Pain",
      "reduced_movements|Reduced baby movements",
      "anaemia|Anaemia",
      "placenta|A placenta problem",
      "infection|Infection",
      "growth|A concern about the baby's growth",
      "previous|A complication in a previous pregnancy",
      "other|Something else",
      "none|None of these|x",
    ]),
    routes: { to: "nurse_review", unless: ["none", "previous", "other"], sameDay: true },
    help: "If there is bleeding, severe pain or reduced movements now, contact your maternity unit or emergency services straight away.",
  }),
  q("an_previous_pregnancies", "Previous pregnancies", "How many previous pregnancies?", "number"),
  q("an_previous_births", "Previous births", "How many previous births?", "number", {
    showWhen: { field: "an_previous_pregnancies", gte: 1 },
  }),
  yesNo("an_previous_complications", "Previous pregnancy or birth complications",
    "Were there complications in a previous pregnancy or birth?", {
      showWhen: { field: "an_previous_pregnancies", gte: 1 },
    }),
  q("an_previous_complications_detail", "Previous complications",
    "What happened?", "long_text", { showWhen: when("an_previous_complications", ["yes"]) }),
  q("an_support_wanted", "Support wanted now", "What support would help now?", "multi", {
    options: opts([
      "observations|Checks and observations at home",
      "education|Advice and preparation",
      "birth_prep|Preparing for the birth",
      "medicines|Medicines or injections",
      "nutrition|Nutrition",
      "emotional|Emotional support",
      "after_birth|Help after the birth",
      "other|Something else",
    ]),
  }),
  q("an_home_support", "Support available at home",
    "Who is available to help at home?", "long_text"),
]);

const postnatalMother = section("svc_postnatal_mother", "The mother's recovery", {
  service: ["postnatal"],
}, [
  q("pn_delivery_date", "Date of delivery", "When was the baby born?", "date"),
  q("pn_delivery_type", "Type of delivery", "How was the baby born?", "choice", {
    options: opts([
      "vaginal|Vaginal birth",
      "assisted|Assisted birth",
      "caesarean|Caesarean section",
      "not_say|Prefer not to say",
    ]),
  }),
  yesNoUnsure("pn_complications", "Delivery complications", "Were there any complications at the birth?"),
  q("pn_complications_detail", "What the complications were",
    "What happened?", "long_text", { showWhen: when("pn_complications", ["yes"]) }),
  q("pn_mother_recovery", "How the mother's recovery is going",
    "How is the mother's recovery going?", "choice", {
      options: opts([
        "well|Well", "slowly|Slowly", "difficult|It is difficult", "not_sure|Not sure",
      ]),
    }),
  q("pn_mother_concerns", "Concerns about the mother", "Does the mother have any of these now?", "multi", {
    options: opts([
      "heavy_bleeding|Heavy bleeding",
      "fever|Fever",
      "wound|A wound or stitches that are painful, red or leaking",
      "severe_headache|Severe headache or blurred vision",
      "breast_pain|Breast pain or a hard, hot area",
      "calf_pain|Calf pain or swelling",
      "breathless|Breathlessness or chest pain",
      "low_mood|Very low mood, or frightening thoughts",
      "other|Something else",
      "none|None of these|x",
    ]),
    routes: { to: "clinical_lead", unless: ["none", "other"], sameDay: true },
    help: "Medic Connect is not an emergency service. With heavy bleeding, chest pain, a severe headache or frightening thoughts, contact emergency services or the maternity unit now.",
  }),
  q("pn_feeding", "How the baby is fed", "How is the baby being fed?", "choice", {
    options: opts([
      "breast|Breastfeeding", "formula|Formula", "mixed|Both", "expressed|Expressed milk", "other|Another way",
    ]),
  }),
  q("pn_feeding_help", "Feeding support wanted", "Is help with feeding wanted?", "choice", {
    options: opts(["yes|Yes", "no|No", "not_sure|Not sure"]),
  }),
  q("pn_mother_support", "Support the mother wants", "What support would help the mother most?", "multi", {
    options: opts([
      "recovery|Recovery checks",
      "feeding|Feeding support",
      "rest|Help so she can rest",
      "meals|Meals and household help",
      "emotional|Emotional support",
      "baby_care|Care of the baby",
      "other|Something else",
    ]),
  }),
  q("pn_home_support", "Who is helping at home", "Who else is helping at home?", "long_text"),
]);

const postnatalBaby = section("svc_postnatal_baby", "The baby", {
  service: ["postnatal"],
  condition: { field: "pn_delivery_date", empty: false },
}, [
  q("pn_baby_name", "The baby's name", "What is the baby's name?", "text"),
  q("pn_baby_weight", "Birth weight", "What was the birth weight?", "measurement", {
    measures: [{ key: "birth_weight", label: "Birth weight", unit: "kg" }],
  }),
  q("pn_baby_term", "Born at term or early", "Was the baby born at term or early?", "choice", {
    options: opts(["term|At term", "early|Early (before 37 weeks)", "not_sure|Not sure"]),
  }),
  yesNo("pn_baby_scbu", "Baby needed special care",
    "Did the baby need special or intensive care after birth?"),
  yesNoUnsure("pn_baby_jaundice", "Jaundice", "Has the baby been yellow in the skin or eyes?"),
  q("pn_baby_jaundice_treated", "Jaundice treatment",
    "Has that been checked or treated?", "choice", {
      showWhen: when("pn_baby_jaundice", ["yes"]),
      options: opts(["yes|Yes", "no|Not yet", "not_sure|Not sure"]),
    }),
  q("pn_baby_feeding_frequency", "How often the baby feeds",
    "How often is the baby feeding?", "choice", {
      options: opts([
        "frequent|Every two to three hours",
        "less_often|Less often than that",
        "difficult|Feeding is difficult",
        "not_sure|Not sure",
      ]),
    }),
  q("pn_baby_output", "Wet and dirty nappies",
    "How many wet nappies in the last day?", "choice", {
      options: opts(["six_or_more|Six or more", "three_to_five|Three to five", "fewer|Fewer than three", "not_sure|Not sure"]),
      routes: { to: "nurse_review", unless: ["six_or_more", "three_to_five", "not_sure"] },
    }),
  q("pn_baby_warning", "Warning signs in the baby", "Does the baby have any of these now?", "multi", {
    options: opts([
      "not_feeding|Not feeding",
      "very_sleepy|Very sleepy or hard to wake",
      "fever|Fever, or feels cold",
      "breathing|Fast or difficult breathing",
      "fits|Fits or jerking",
      "cord|A red, smelly or leaking cord",
      "vomiting|Repeated vomiting",
      "other|Something else",
      "none|None of these|x",
    ]),
    routes: { to: "clinical_lead", unless: ["none", "other"], sameDay: true },
    help: "Medic Connect is not an emergency service. If the baby is not feeding, is hard to wake, has a fever or is struggling to breathe, go to a hospital now.",
  }),
  yesNo("pn_baby_readmitted", "Baby readmitted since birth",
    "Has the baby been back in hospital since going home?"),
  q("pn_baby_checks", "Newborn checks done", "Which checks have been done?", "multi", {
    options: opts([
      "newborn_exam|Newborn examination",
      "immunisations|First immunisations",
      "heel_prick|Heel prick or newborn screening",
      "hearing|Hearing check",
      "none|None yet|x",
      "not_sure|Not sure|x",
    ]),
  }),
]);

const postSurgical = section("svc_post_surgical", "The surgery and coming home", {
  service: ["post_surgical"],
}, [
  q("ps_procedure", "Procedure", "What operation or procedure was carried out?", "text"),
  q("ps_date", "Date of surgery", "When was it?", "date"),
  q("ps_hospital", "Hospital and treating team", "Which hospital, and who is the treating team?", "long_text"),
  q("ps_location", "Where the person is now", "Where {are} {subject} now?", "choice", {
    options: opts(["hospital|In hospital", "home|At home", "other|Somewhere else"]),
  }),
  q("ps_discharge_instructions", "Discharge instructions",
    "Upload the discharge instructions, if you have them", "upload"),
  q("ps_followup", "Follow-up appointment",
    "When is the follow-up appointment, and with whom?", "long_text"),
  yesNo("ps_wound", "Wound or dressing present", "Is there a wound or dressing?"),
  q("ps_wound_detail", "Wound details",
    "Where is it, and what are the dressing instructions?", "long_text", {
      showWhen: when("ps_wound", ["yes"]),
    }),
  q("ps_devices", "Drains, catheters or other devices", "Is any of this in place?", "multi", {
    options: opts([
      "drain|A drain", "catheter|A catheter", "stoma|A stoma",
      "iv|An IV line", "oxygen|Oxygen", "other|Something else",
      "none|None of these|x",
    ]),
  }),
  q("ps_pain", "Current pain", "How much pain {are} {subject} in?", "choice", {
    options: opts(["none|None", "mild|Mild", "moderate|Moderate", "severe|Severe"]),
    routes: { to: "nurse_review", unless: ["none", "mild", "moderate"] },
  }),
  yesNoUnsure("ps_pain_plan", "Pain management plan", "Is there a plan for managing the pain?"),
  q("ps_mobility_change", "Mobility compared with usual",
    "How {are} {subject} moving compared with usual?", "choice", {
      options: opts([
        "usual|As usual", "reduced|Less than usual",
        "much_reduced|Much less than usual", "bedbound|Staying in bed",
      ]),
    }),
  q("ps_help_needed", "Help needed at home", "What help is needed at home?", "multi", {
    options: opts([
      "bathing|Bathing", "dressing|Dressing", "toileting|Toileting", "transfers|Getting in and out of bed or chairs",
      "meals|Meals", "medicines|Medicines", "wound_care|Wound care", "exercises|Therapy exercises",
      "overnight|Overnight observation", "other|Something else",
    ]),
  }),
  q("ps_warning", "Warning signs now", "{Do} {subject} have any of these now?", "multi", {
    options: opts([
      "fever|Fever", "bleeding|Heavy bleeding", "redness|Increasing redness or swelling",
      "wound_open|The wound opening or leaking", "chest_pain|Chest pain",
      "breathless|Breathlessness", "confusion|New confusion",
      "uncontrolled_pain|Pain that is not controlled", "other|Something else",
      "none|None of these|x",
    ]),
    routes: { to: "clinical_lead", unless: ["none", "other"], sameDay: true },
    help: "Medic Connect is not an emergency service. With chest pain, breathlessness, heavy bleeding or new confusion, contact emergency services or go to hospital now.",
  }),
  q("ps_household", "Who is at home during recovery",
    "Who will be at home during the recovery?", "long_text"),
]);

const eldercare = section("svc_eldercare", "Day-to-day life", {
  service: ["eldercare"],
}, [
  q("ec_support_wanted", "Support that would help most",
    "What support would be most useful?", "multi", {
      options: opts([
        "companionship|Companionship", "meals|Meals", "shopping|Shopping",
        "appointments|Getting to appointments", "personal_care|Personal care",
        "medicines|Medicines", "mobility|Moving about", "overnight|Overnight support",
        "respite|Respite for the family", "clinical|Clinical visits", "other|Something else",
      ]),
    }),
  q("ec_independence", "Independence with daily activities",
    "How much help {are} {subject} needing with these?", "matrix", {
      rows: ["Washing", "Dressing", "Using the toilet", "Eating"],
      options: opts([
        "independent|Manages alone",
        "prompt|Needs a reminder",
        "some_help|Needs some help",
        "hands_on|Needs hands-on help",
        "full|Needs full help",
      ]),
    }),
  q("ec_memory", "Memory or thinking changes",
    "{Have} {subject} had changes in memory or thinking?", "choice", {
      options: opts([
        "no|No", "yes|Yes, we have noticed changes",
        "diagnosed|Yes, with a diagnosis", "not_sure|Not sure",
      ]),
    }),
  q("ec_memory_detail", "What has been noticed", "What have you noticed?", "long_text", {
    showWhen: when("ec_memory", ["yes", "diagnosed"]),
  }),
  yesNo("ec_sudden_change", "Recent confusion or sudden change",
    "Has there been new confusion or a sudden change recently?", {
      routes: { to: "clinical_lead", unless: ["no"], sameDay: true },
      help: "A sudden change can need medical attention the same day.",
    }),
  q("ec_eating", "Eating and drinking", "How {are} {subject} managing eating and drinking?", "choice", {
    options: opts([
      "independent|Independently", "some_help|With some help", "full_help|With full help",
    ]),
  }),
  q("ec_eating_concern", "Appetite or swallowing concerns",
    "Any concerns about appetite, weight or swallowing?", "long_text"),
  q("ec_continence", "Continence support", "Is any support needed with continence?", "multi", {
    options: opts([
      "toileting|Help getting to the toilet", "pads|Pads", "catheter|A catheter",
      "stoma|A stoma", "other|Something else", "none|None needed|x",
    ]),
  }),
  yesNo("ec_overnight_concern", "Sleep or overnight concerns",
    "Are there concerns overnight?"),
  q("ec_overnight_detail", "Overnight concerns", "What happens overnight?", "long_text", {
    showWhen: when("ec_overnight_concern", ["yes"]),
  }),
  q("ec_social", "Living arrangement and contact", "Who {are} {subject} living with?", "choice", {
    options: opts([
      "alone|Lives alone", "with_family|With family", "with_staff|With household staff", "other|Another arrangement",
    ]),
  }),
  q("ec_routine", "Routine and what matters",
    "What does a good day look like, and what matters most?", "long_text"),
  q("ec_home_safety", "Home safety concerns", "Are there any safety concerns at home?", "multi", {
    options: opts([
      "stairs|Stairs", "bathroom|The bathroom", "lighting|Poor lighting", "clutter|Clutter or trip hazards",
      "cooking|Cooking safety", "wandering|Leaving the house unsafely", "other|Something else",
      "none|None of these|x",
    ]),
  }),
  q("ec_goals", "What the family would like to improve or preserve",
    "What would you most like to improve or keep the same?", "long_text"),
]);

const clinical = section("svc_clinical", "The clinical support needed", {
  service: ["clinical_home_care"],
}, [
  q("ch_need", "Clinical help requested", "What clinical help is being asked for?", "multi", {
    required: true,
    options: opts([
      "observations|Nursing observations",
      "injections|Injections",
      "iv|IV therapy",
      "wound_care|Wound care",
      "medicines|Medicines",
      "catheter_stoma|Catheter or stoma care",
      "feeding_tube|Feeding tube care",
      "respiratory|Respiratory care, oxygen or tracheostomy",
      "physio|Physiotherapy",
      "chronic|Support with a long-term condition",
      "palliative|Palliative support",
      "other|Something else",
    ]),
  }),
  q("ch_prescriber", "Who advised or prescribed the care",
    "Who advised or prescribed this care?", "long_text", {
      help: "Write 'No one yet' if this has not been advised by a clinician.",
    }),
  q("ch_instructions", "Written clinical instructions",
    "Upload any written clinical instructions", "upload"),
  q("ch_frequency", "How often care is required", "How often is the care needed?", "choice", {
    options: opts([
      "one_off|A one-off visit", "daily|Daily", "multiple_daily|More than once a day",
      "weekly|Weekly", "other|Another pattern", "not_sure|Not sure",
    ]),
  }),
  q("ch_observations", "Monitoring requested", "Has any monitoring been asked for?", "multi", {
    options: opts([
      "bp|Blood pressure", "temperature|Temperature", "pulse|Pulse",
      "oxygen|Oxygen levels", "blood_sugar|Blood sugar", "weight|Weight",
      "fluids|Fluids in and out", "other|Something else", "none|None|x", "not_sure|Not sure|x",
    ]),
  }),
  yesNo("ch_escalation_plan", "Escalation instructions already given",
    "Has the treating team given instructions on who to contact if things change?"),
  q("ch_escalation_detail", "Escalation instructions",
    "What were you told to do?", "long_text", { showWhen: when("ch_escalation_plan", ["yes"]) }),
  q("ch_warning", "Warning signs now", "{Do} {subject} have any of these now?", "multi", {
    options: opts([
      "breathless|Breathlessness", "chest_pain|Chest pain", "fever|Fever",
      "bleeding|Bleeding", "confusion|New confusion", "unresponsive|Very drowsy or hard to rouse",
      "not_eating|Not eating or drinking", "other|Something else", "none|None of these|x",
    ]),
    routes: { to: "clinical_lead", unless: ["none", "other"], sameDay: true },
    help: "Medic Connect is not an emergency service. If someone is struggling to breathe, has chest pain or cannot be roused, call emergency services now.",
  }),
]);

const palliative = section("mod_palliative", "Palliative support", { module: "m_palliative" }, [
  q("pal_goals", "What matters most now",
    "What matters most to {subject} and the family at the moment?", "long_text"),
  q("pal_team", "Team already involved",
    "Which team is already involved in this care?", "long_text"),
  q("pal_symptoms", "Symptoms causing concern",
    "Which symptoms are causing concern?", "multi", {
      options: opts([
        "pain|Pain", "breathlessness|Breathlessness", "sickness|Sickness",
        "appetite|Appetite", "sleep|Sleep", "agitation|Agitation or distress",
        "other|Something else", "none|None at the moment|x",
      ]),
    }),
  q("pal_place", "Preferred place of care",
    "Has a preferred place of care been discussed?", "choice", {
      options: opts(["home|At home", "hospital|Hospital", "hospice|Hospice", "not_discussed|Not discussed"]),
    }),
]);

const wound = section("mod_wound", "Wounds", { module: "m_wound" }, [
  q("wd_sites", "Wound sites and type", "Where are the wounds, and what kind are they?", "long_text"),
  q("wd_dressing", "Dressing regime", "What dressings are used, and how often are they changed?", "long_text"),
  q("wd_signs", "Signs around the wound", "Is any of this happening around the wound?", "multi", {
    options: opts([
      "redness|Spreading redness", "smell|An unpleasant smell", "discharge|Discharge",
      "pain|Increasing pain", "opening|The wound opening", "none|None of these|x",
    ]),
    routes: { to: "nurse_review", unless: ["none"] },
  }),
]);

const device = section("mod_device", "Devices and equipment", { module: "m_device" }, [
  q("dv_items", "Devices in place", "Which of these are in place?", "multi", {
    options: opts([
      "catheter|Catheter", "stoma|Stoma", "feeding_tube|Feeding tube", "iv|IV line",
      "tracheostomy|Tracheostomy", "oxygen|Oxygen", "suction|Suction",
      "nebuliser|Nebuliser", "other|Something else", "none|None|x",
    ]),
  }),
  q("dv_instructions", "Instructions for the device",
    "What instructions were given for looking after it?", "long_text", {
      showWhen: {
        field: "dv_items",
        contains: ["catheter", "stoma", "feeding_tube", "iv", "tracheostomy", "oxygen", "suction", "nebuliser", "other"],
      },
    }),
]);

const respiratory = section("mod_respiratory", "Breathing support", { module: "m_respiratory" }, [
  q("rp_support", "Breathing support in use", "Which breathing support is used?", "multi", {
    options: opts([
      "oxygen|Oxygen", "nebuliser|Nebuliser", "suction|Suction",
      "tracheostomy|Tracheostomy", "ventilator|A ventilator", "other|Something else",
    ]),
  }),
  q("rp_pattern", "When it is needed", "When is it needed?", "choice", {
    options: opts(["continuous|All the time", "night|Mainly at night", "as_needed|As needed"]),
  }),
  q("rp_recent_change", "Recent change in breathing",
    "Has the breathing changed recently?", "choice", {
      options: opts(["no|No", "yes|Yes", "not_sure|Not sure"]),
      routes: { to: "nurse_review", unless: ["no", "not_sure"] },
    }),
]);

const nutrition = section("mod_nutrition", "Feeding and nutrition", { module: "m_nutrition" }, [
  q("nu_method", "How feeding is given", "How is feeding given?", "choice", {
    options: opts([
      "oral|By mouth", "modified|By mouth, with modified textures",
      "tube|By feeding tube", "mixed|Both by mouth and by tube",
    ]),
  }),
  q("nu_regime", "Feeding regime", "What is the feeding regime?", "long_text", {
    showWhen: when("nu_method", ["tube", "mixed"]),
  }),
  yesNoUnsure("nu_swallow", "Swallowing or choking concern",
    "Is there any concern about swallowing or choking?", {
      routes: { to: "nurse_review", unless: ["no", "not_sure"] },
    }),
  q("nu_swallow_plan", "Swallowing plan",
    "Has a speech and language therapist or dietitian given a plan?", "long_text", {
      showWhen: when("nu_swallow", ["yes"]),
    }),
]);

const nannyChildren = section("svc_nanny_children", "The children", {
  service: ["nanny"],
  clientGroup: ["child", "baby"],
}, [
  q("nn_children_count", "Number of children needing care",
    "How many children need care?", "number", { required: true }),
  q("nn_children", "Each child", "Tell us about each child", "repeatable", {
    required: true,
    items: ["First name", "Last name", "Date of birth", "Nursery or school", "Usual schedule"],
  }),
  yesNo("nn_health", "Health conditions", "Does any child have a health condition we should know about?"),
  q("nn_health_detail", "Health conditions", "Which child, and what should we know?", "long_text", {
    showWhen: when("nn_health", ["yes"]),
  }),
  q("nn_medicines_detail", "Medicines for the children",
    "Which medicines, and who gives them?", "long_text", {
      showWhen: when("regular_medicines", ["yes"]),
    }),
  q("nn_feeding", "Meals and dietary requirements",
    "What are the usual meals and any dietary requirements?", "long_text"),
  q("nn_sleep", "Sleep and naps", "What is the sleep or nap routine?", "long_text"),
  q("nn_toileting", "Toileting", "Where is each child with toileting?", "choice", {
    options: opts([
      "nappies|In nappies", "training|Toilet training", "independent|Independent", "mixed|It varies by child",
    ]),
  }),
  q("nn_languages", "Languages at home", "Which languages are spoken at home?", "language_picker"),
  q("nn_activities", "Activities and comfort",
    "What do they enjoy, and what comforts them?", "long_text"),
  q("nn_safety", "Safety or supervision needs",
    "Are there any safety or supervision needs?", "long_text"),
]);

const nannyRole = section("svc_nanny_role", "The role", {
  service: ["nanny"],
  clientGroup: ["child", "baby"],
}, [
  q("nn_pattern", "Live-in or live-out", "Would you like live-in or live-out care?", "choice", {
    options: opts(["live_in|Live-in", "live_out|Live-out", "no_preference|No preference"]),
  }),
  q("nn_duties", "Duties expected", "Which duties are expected?", "multi", {
    options: opts([
      "childcare|Childcare", "child_meals|Meals for the children", "school_run|School run",
      "homework|Homework support", "activities|Activities", "child_laundry|Children's laundry",
      "travel|Travel with the family", "overnight|Overnight care", "other|Something else",
    ]),
  }),
  q("nn_collection", "Authorised collection",
    "Who is authorised to collect the children?", "long_text"),
  q("nn_existing_reason", "Why further childcare is needed",
    "Why is further or different childcare needed?", "long_text", {
      showWhen: when("childcare_now", ["nanny", "family", "nursery"]),
    }),
  q("nn_experience", "Experience wanted", "Which experience matters for this role?", "multi", {
    options: opts([
      "newborn|Newborn care", "early_years|Early years", "school_age|School age",
      "first_aid|First aid", "clinical|A clinical background",
      "additional_needs|Additional needs", "driving|Driving", "swimming|Swimming supervision",
      "other|Something else",
    ]),
  }),
  q("nn_household", "Household context", "Anything about the household we should know?", "multi", {
    options: opts([
      "pets|Pets", "other_staff|Other household staff", "travel|Regular travel",
      "stairs|Stairs", "pool|A pool", "other|Something else", "none|None of these|x",
    ]),
  }),
  q("nn_priorities", "What matters most in choosing a nanny",
    "What matters most to you when choosing a nanny?", "long_text"),
]);

const additionalNeeds = section("svc_additional_needs", "About your child's needs", {
  service: ["additional_needs"],
  clientGroup: ["child", "baby"],
}, [
  q("ad_support_sought", "Support the family is seeking",
    "What support is the family looking for?", "multi", {
      required: true,
      options: opts([
        "daily_care|Daily care", "school_support|School support or shadowing",
        "communication|Communication", "mobility|Moving about", "feeding|Feeding",
        "personal_care|Personal care", "behaviour|Support with distress or behaviour",
        "respite|Respite", "therapy|Carrying on therapy at home",
        "clinical|Clinical care", "other|Something else",
      ]),
    }),
  q("ad_diagnosis", "Diagnosed conditions or ongoing assessment",
    "Does {child} have a diagnosis, or is an assessment under way?", "choice", {
      options: opts(["yes|Yes, diagnosed", "assessment|Assessment is ongoing", "no|No"]),
    }),
  q("ad_diagnosis_detail", "Diagnoses", "What has been said so far?", "long_text", {
    showWhen: when("ad_diagnosis", ["yes", "assessment"]),
  }),
  q("ad_professionals", "Professionals involved",
    "Which professionals are involved?", "repeatable", {
      items: ["Name or service", "Role", "How often they are seen"],
    }),
  q("ad_communication", "How the child communicates",
    "How does {child} communicate?", "multi", {
      options: opts([
        "speech|Speech", "signs|Signs", "gestures|Gestures",
        "pictures|Pictures or a communication device", "behaviour|Through behaviour and body language",
        "other|Another way",
      ]),
    }),
  q("ad_understanding", "What helps the child understand",
    "What helps {child} understand?", "multi", {
      options: opts([
        "short_language|Short, simple sentences", "visual|A visual schedule",
        "demonstration|Being shown", "time|Extra time to process", "other|Something else",
      ]),
    }),
  q("ad_mobility", "Moving about", "How does {child} move about?", "choice", {
    options: opts([
      "independent|Independently", "aid|With an aid", "help|With help from someone",
      "wheelchair|Uses a wheelchair", "other|Another way",
    ]),
  }),
  q("ad_personal_care", "Personal care support",
    "How much support does {child} need with these?", "matrix", {
      rows: ["Washing", "Dressing", "Using the toilet", "Eating"],
      options: opts([
        "independent|Manages alone", "prompt|Needs a reminder",
        "some_help|Needs some help", "full|Needs full help",
      ]),
    }),
  q("ad_eating_method", "How the child eats and drinks",
    "How does {child} eat and drink?", "choice", {
      options: opts([
        "oral|By mouth", "modified|Modified textures", "tube|By feeding tube",
        "mixed|Both by mouth and by tube", "other|Another way",
      ]),
    }),
  yesNoUnsure("ad_swallow", "Swallowing, choking or aspiration concern",
    "Is there any concern about swallowing or choking?", {
      routes: { to: "nurse_review", unless: ["no", "not_sure"] },
    }),
  q("ad_swallow_detail", "The swallowing plan",
    "What has a professional advised?", "long_text", { showWhen: when("ad_swallow", ["yes"]) }),
  yesNo("ad_seizures", "Seizures", "Does {child} have seizures?"),
  q("ad_seizure_detail", "Seizures, frequency and plan",
    "What do they look like, how often do they happen, and what is the plan?", "long_text", {
      showWhen: when("ad_seizures", ["yes"]),
      routes: { to: "clinical_lead", unless: [] },
    }),
  q("ad_equipment", "Equipment depended on", "Which equipment does {child} depend on?", "multi", {
    options: opts([
      "wheelchair|Wheelchair", "standing_frame|Standing frame", "hoist|Hoist",
      "seating|Special seating", "oxygen|Oxygen", "suction|Suction",
      "feeding_pump|Feeding pump", "communication_device|Communication device",
      "other|Something else", "none|None|x",
    ]),
  }),
  q("ad_sensory", "Sensory preferences and sensitivities",
    "Is {child} sensitive to any of these?", "multi", {
      options: opts([
        "noise|Noise", "light|Light", "touch|Touch", "smell|Smells",
        "movement|Movement", "textures|Food textures", "other|Something else", "none|None of these|x",
      ]),
    }),
  q("ad_distress_triggers", "Situations that may cause distress",
    "Which situations tend to cause distress?", "long_text"),
  q("ad_distress_presentation", "How distress shows",
    "How does that distress usually show?", "multi", {
      options: opts([
        "withdraws|Becomes quiet or withdraws", "cries|Cries", "shouts|Shouts",
        "moves_away|Moves away or leaves", "repetitive|Repetitive movements",
        "self_injury|Hurts themselves", "hits_out|Hits out", "other|Something else",
      ]),
    }),
  q("ad_what_helps", "What usually helps", "What usually helps?", "long_text"),
  q("ad_plans", "Written plans", "Upload any written support, therapy, feeding, seizure or behaviour plan", "upload"),
  q("ad_school", "Nursery, school or programme",
    "Which nursery, school or programme, and what is the schedule?", "long_text"),
  q("ad_safety", "Safety considerations", "Which of these need care around safety?", "multi", {
    options: opts([
      "wandering|Leaving without warning", "roads|Road awareness", "water|Water",
      "falls|Falls", "self_injury|Self-injury", "hits_out|Hitting out",
      "choking|Choking", "seizures|Seizures", "equipment|Equipment", "other|Something else",
      "none|None of these|x",
    ]),
  }),
  q("ad_strengths", "Strengths and interests",
    "What is {child} good at, and what do they enjoy?", "long_text"),
  q("ad_goals", "What the family would like support to achieve",
    "What would you most like this support to achieve?", "long_text"),
]);

const other = section("svc_other", "A little more", { service: ["other"] }, [
  q("ot_what", "What is happening",
    "What is happening, and what support may be needed?", "long_text", { required: true }),
  q("ot_who", "Who needs support", "Who needs the support?", "long_text"),
  yesNo("ot_concern", "Immediate clinical or safety concern",
    "Is there anything happening now that worries you clinically, or about safety?", {
      routes: { to: "coordinator", unless: ["no"] },
    }),
  q("ot_concern_detail", "The concern", "What is it?", "long_text", {
    showWhen: when("ot_concern", ["yes"]),
  }),
  q("ot_callback", "Best way to arrange the next step",
    "When is the best time for us to call?", "long_text"),
]);

export const SERVICE_SECTIONS = [
  antenatal, postnatalMother, postnatalBaby, postSurgical, eldercare,
  clinical, wound, device, respiratory, nutrition, palliative,
  nannyChildren, nannyRole, additionalNeeds, other,
];
