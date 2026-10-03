// The opening route and the universal core.
//
// Everything here decides who the care is for, how old they are and what is
// being asked for, and then asks only what is true of every route.
import {
  opts, q, yesNo, yesNoUnsure, when, all, any, not, section,
  SELF, OTHER, isGroup, isService, CHILD_RECIPIENT,
} from "./kit.mjs";

export const SERVICE_OPTIONS = opts([
  "antenatal|Antenatal care at home",
  "postnatal|Postnatal care and Omugwo",
  "post_surgical|Post-surgical care at home",
  "eldercare|Eldercare and companion care",
  "clinical_home_care|Clinical home care",
  "nanny|Nanny and childcare",
  "additional_needs|Children with additional needs",
  "other|Something else, or not sure",
]);

const route = section("route", "Who the care is for", "always", [
  q("who_for", "Who the care is for", "Who is this care for?", "choice", {
    required: true,
    options: opts(["myself|Myself", "someone_else|Someone else"]),
  }),
  q("self_name", "Name", "Is this your name?", "confirm", {
    required: true,
    prefill: "client.full_name",
    showWhen: when("who_for", ["myself"]),
  }),
  q("recipient_first_name", "First name", "First name", "text", {
    required: true,
    showWhen: when("who_for", ["someone_else"]),
  }),
  q("recipient_middle_name", "Middle name", "Middle name", "text", {
    showWhen: when("who_for", ["someone_else"]),
  }),
  q("recipient_last_name", "Last name", "Last name", "text", {
    required: true,
    showWhen: when("who_for", ["someone_else"]),
  }),
  q("recipient_preferred_name", "Preferred name", "What name should we use?", "text"),
  q("respondent_relationship", "Relationship to the person receiving care",
    "What is your relationship to {subject}?", "relationship", {
      required: true,
      showWhen: when("who_for", ["someone_else"]),
    }),
  yesNo("dob_known", "Date of birth known", "{Do} you know {possessive} date of birth?", {
    required: true,
  }),
  q("date_of_birth", "Date of birth", "Date of birth", "date", {
    required: true,
    showWhen: when("dob_known", ["yes"]),
  }),
  q("approx_age", "Approximate age", "Approximately how old {are} {subject}?", "number", {
    required: true,
    help: "In whole years.",
    showWhen: when("dob_known", ["no"]),
  }),
]);

const routeService = section("route_service", "The care you are asking for", "always", [
  q("service_requested", "Service requested", "Which support are you asking for?", "choice", {
    required: true,
    options: SERVICE_OPTIONS,
  }),
  q("service_confirmed", "Service confirmed",
    "Which type of support should we prepare for?", "choice", {
      required: true,
      help: "The request we hold and the answers here do not match, so please tell us which is right.",
      options: SERVICE_OPTIONS,
      showWhen: when("derived_service_conflict", ["yes"]),
    }),
]);

// Decisions and consent. A competent adult answering for themselves is not
// asked who may decide about their own care.
const decisionsAdult = section("decisions_adult", "Arranging care for someone else", {
  clientGroup: ["adult", "older_person", "maternal"],
  condition: OTHER,
}, [
  q("recipient_knows", "The person knows care is being arranged",
    "Does {subject} know you are arranging care?", "choice", {
      required: true,
      options: opts(["yes|Yes", "no|No", "cannot_discuss|We are not able to discuss it"]),
    }),
  q("recipient_feeling", "How the person feels about care",
    "How does {subject} feel about receiving care?", "choice", {
      options: opts([
        "comfortable|Comfortable with it",
        "unsure|Unsure",
        "declines|Does not want care",
        "cannot_express|Not able to express a view",
      ]),
    }),
  q("recipient_feeling_note", "More about how the person feels",
    "Is there anything we should know about that?", "long_text", {
      showWhen: when("recipient_feeling", ["unsure", "declines", "cannot_express"]),
    }),
  q("decision_authority", "Basis for arranging care",
    "What allows you to make or support decisions about {possessive} care?", "choice", {
      required: true,
      options: opts([
        "family|I am family and we agree it together",
        "recorded_authority|I hold a recorded authority",
        "professional|It is part of my professional role",
        "other|Another reason",
        "not_sure|Not sure",
      ]),
    }),
  q("decision_authority_other", "The reason given",
    "Please tell us more.", "long_text", {
      showWhen: when("decision_authority", ["other", "not_sure"]),
    }),
]);

const decisionsChild = section("decisions_child", "Parental responsibility", {
  clientGroup: ["child", "baby"],
}, [
  yesNo("is_parent_guardian", "Respondent is parent or guardian",
    "Are you {possessive} parent or legal guardian?", { required: true }),
  q("pr_holder_first_name", "Parental responsibility, first name",
    "First name of the parent or guardian", "text", {
      showWhen: when("is_parent_guardian", ["no"]),
    }),
  q("pr_holder_last_name", "Parental responsibility, last name",
    "Last name of the parent or guardian", "text", {
      showWhen: when("is_parent_guardian", ["no"]),
    }),
  q("pr_holder_relationship", "Parental responsibility, relationship to the child",
    "Their relationship to {child}", "relationship", {
      showWhen: when("is_parent_guardian", ["no"]),
    }),
  q("pr_holder_phone", "Parental responsibility, phone",
    "Their phone number", "phone", {
      showWhen: when("is_parent_guardian", ["no"]),
    }),
  q("child_knows_visit", "The child knows about the visit",
    "Does {child} know about the planned visit?", "choice", {
      options: opts([
        "yes|Yes",
        "no|Not yet",
        "not_appropriate|Not appropriate for their age or understanding",
      ]),
    }),
  q("child_feeling", "How the child feels about the visit",
    "How does {child} feel about the visit?", "choice", {
      showWhen: when("child_knows_visit", ["yes", "no"]),
      options: opts([
        "comfortable|Comfortable",
        "unsure|Unsure",
        "worried|Worried",
        "declines|Does not want it",
        "not_known|Not known",
      ]),
    }),
  q("child_feeling_note", "More about how the child feels",
    "Anything that would help us on the day?", "long_text", {
      showWhen: when("child_feeling", ["unsure", "worried", "declines"]),
    }),
]);

const coreSituation = section("core_situation", "What is happening", "always", [
  q("situation", "The request in the family's words",
    "In your own words, what is happening and how can we help?", "long_text", { required: true }),
  q("urgency", "How soon support is needed", "How soon do you need support?", "choice", {
    required: true,
    options: opts([
      "within_48h|Within 48 hours",
      "this_week|This week",
      "this_month|This month",
      "exploring|Just exploring for now",
    ]),
  }),
  yesNo("immediate_danger", "Immediate danger reported",
    "Is anyone in immediate danger, or in need of emergency medical help now?", {
      required: true,
      help: "Medic Connect is not an emergency service. If it is an emergency, call emergency services or go to the nearest hospital now.",
      routes: { to: "clinical_lead", unless: ["no"], sameDay: true },
    }),
  q("languages", "Languages the care professional should speak",
    "Which languages should the care professional speak?", "language_picker"),
  q("communication_support", "Communication support needed",
    "Is any communication support needed?", "multi", {
      options: opts([
        "hearing|Hearing support",
        "sight|Sight support",
        "speech|Speech support",
        "interpreter|An interpreter",
        "aid|A communication aid",
        "cognitive|Support with understanding or memory",
        "other|Something else",
        "none|None of these|x",
      ]),
    }),
  q("communication_detail", "What helps communication",
    "What would help communication?", "long_text", {
      showWhen: {
        field: "communication_support",
        contains: ["hearing", "sight", "speech", "interpreter", "aid", "cognitive", "other"],
      },
    }),
]);

const coreHealth = section("core_health", "Health and current care", "always", [
  yesNoUnsure("diagnosed_conditions", "Diagnosed conditions reported",
    "{Do} {subject} have any diagnosed medical conditions relevant to this request?"),
  q("condition_details", "Conditions", "Which conditions should we know about?", "long_text", {
    showWhen: when("diagnosed_conditions", ["yes"]),
  }),
  q("hospital_recent", "Hospital in the last three months",
    "{Have} {subject} been admitted to hospital in the last three months?", "choice", {
      options: opts([
        "no|No",
        "yes|Yes",
        "currently|Currently in hospital",
      ]),
    }),
  q("hospital_name", "Hospital", "Which hospital?", "text", {
    showWhen: when("hospital_recent", ["yes", "currently"]),
  }),
  q("admission_date", "Admission date", "When {was} {subject} admitted?", "date", {
    showWhen: when("hospital_recent", ["yes", "currently"]),
  }),
  q("discharge_status", "Discharge position", "What is the current discharge position?", "choice", {
    showWhen: when("hospital_recent", ["yes", "currently"]),
    options: opts([
      "discharged|Already discharged",
      "planned|Discharge planned",
      "no_date|No date yet",
    ]),
  }),
  q("discharge_date", "Discharge date", "When {was} {subject} discharged?", "date", {
    showWhen: when("discharge_status", ["discharged"]),
  }),
  q("expected_discharge", "Expected discharge date", "When is discharge expected?", "date", {
    showWhen: when("discharge_status", ["planned"]),
  }),
  q("discharge_letter", "Discharge letter", "Upload the discharge letter, if you have it", "upload", {
    showWhen: when("discharge_status", ["discharged", "planned"]),
  }),
  yesNo("professional_involved", "Health professional involved",
    "Is a doctor or other health professional currently involved?"),
  q("professional_details", "Professionals involved",
    "Who is involved, and where do they practise?", "repeatable", {
      items: ["Name", "Role", "Hospital or clinic", "Phone"],
      showWhen: when("professional_involved", ["yes"]),
    }),
  yesNoUnsure("regular_medicines", "Regular medicines",
    "{Do} {subject} take any regular medicines?"),
  yesNoUnsure("allergies", "Allergies", "{Do} {subject} have any known allergies?", {
    required: true,
  }),
  q("allergy_details", "Allergies, reactions and severity",
    "What is the allergy, and what happens?", "repeatable", {
      required: true,
      items: ["Allergy", "Reaction", "How severe"],
      showWhen: when("allergies", ["yes"]),
    }),
]);

const coreSupport = section("core_support", "Support already in place", "always", [
  q("support_now", "Help currently provided",
    "Who currently provides regular help?", "multi", {
      options: opts([
        "family|Family",
        "friend|A friend or neighbour",
        "caregiver|A paid caregiver",
        "nurse|A nurse or other health professional",
        "other|Someone else",
        "none|Nobody at the moment|x",
      ]),
      showWhen: not(isService("nanny")),
    }),
  q("childcare_now", "Childcare currently in place",
    "Does {child} currently have a nanny or regular childcare?", "choice", {
      options: opts([
        "nanny|Yes, a nanny",
        "family|Yes, family or a relative",
        "nursery|Yes, a nursery or daycare",
        "none|No regular childcare|x",
      ]),
      showWhen: isService("nanny"),
    }),
  q("support_detail", "What that help involves",
    "What help is given, and how often?", "long_text", {
      showWhen: any(
        { field: "support_now", contains: ["family", "friend", "caregiver", "nurse", "other"] },
        { field: "childcare_now", in: ["nanny", "family", "nursery"] },
      ),
    }),
  q("alt_contact_first_name", "Alternative contact, first name",
    "First name of someone else we can contact", "text"),
  q("alt_contact_last_name", "Alternative contact, last name",
    "Their last name", "text", { showWhen: { field: "alt_contact_first_name", empty: false } }),
  q("alt_contact_relationship", "Alternative contact, relationship",
    "Their relationship to {subject}", "relationship", {
      showWhen: { field: "alt_contact_first_name", empty: false },
    }),
  q("alt_contact_phone", "Alternative contact, phone", "Their phone number", "phone", {
    showWhen: { field: "alt_contact_first_name", empty: false },
  }),
]);

const coreArrangements = section("core_arrangements", "When and where", "always", [
  q("care_days", "Days support may be needed",
    "Which days may support be needed?", "multi", {
      options: opts([
        "mon|Monday", "tue|Tuesday", "wed|Wednesday", "thu|Thursday",
        "fri|Friday", "sat|Saturday", "sun|Sunday", "not_sure|Not sure yet|x",
      ]),
    }),
  q("care_times", "Times support may be needed",
    "What times may support be needed?", "multi", {
      options: opts([
        "morning|Mornings", "afternoon|Afternoons", "evening|Evenings",
        "overnight|Overnight", "live_in|Live-in", "not_sure|Not sure yet|x",
      ]),
    }),
  q("start_when", "When care should begin", "When would you like care to begin?", "choice", {
    options: opts([
      "asap|As soon as possible",
      "this_week|This week",
      "this_month|This month",
      "flexible|Flexible",
      "specific|On a specific date",
    ]),
  }),
  q("start_date", "Start date", "Which date?", "date", {
    showWhen: when("start_when", ["specific"]),
  }),
  q("duration", "How long support may be needed",
    "How long might support be needed?", "choice", {
      options: opts([
        "one_off|A one-off visit",
        "under_2_weeks|Less than two weeks",
        "2_6_weeks|Two to six weeks",
        "ongoing|Ongoing",
        "not_sure|Not sure yet",
      ]),
    }),
  q("visit_address", "Address for the assessment",
    "Where should the assessment take place?", "address", { required: true }),
  q("visit_lga", "State and area", "Which state and area is that in?", "lga", { required: true }),
  q("visit_landmark", "Nearby landmark", "Is there a nearby landmark?", "text"),
  q("visit_attendees", "Who will be present", "Who will be there for the assessment?", "multi", {
    options: opts([
      "recipient|The person receiving care",
      "respondent|Me",
      "family|Another family member",
      "caregiver|A caregiver already helping",
      "other|Someone else",
    ]),
  }),
  q("visit_days", "Days suitable for the visit", "Which days suit you for the visit?", "multi", {
    options: opts([
      "mon|Monday", "tue|Tuesday", "wed|Wednesday", "thu|Thursday",
      "fri|Friday", "sat|Saturday", "sun|Sunday",
    ]),
  }),
  q("visit_time", "Time of day suitable for the visit",
    "What time of day suits you?", "choice", {
      options: opts(["morning|Morning", "afternoon|Afternoon", "evening|Evening"]),
    }),
]);

const consent = section("consent", "Before you send this", "always", [
  q("consent_accurate", "Accuracy confirmed",
    "I confirm that the information I have provided is accurate to the best of my knowledge.",
    "checkbox", { blocking: true, required: true }),
  q("consent_use", "Consent to use the information",
    "I agree that Medic Connect may use this information to understand the care request, arrange an assessment and plan appropriate support.",
    "checkbox", { blocking: true, required: true }),
  q("consent_authority", "Authority to answer for someone else",
    "I confirm that I am authorised to provide this information, or have an appropriate reason for doing so.",
    "checkbox", { blocking: true, required: true, showWhen: when("who_for", ["someone_else"]) }),
]);

export const ROUTE_SECTIONS = [
  route, routeService, decisionsAdult, decisionsChild,
  coreSituation, coreHealth, coreSupport, coreArrangements,
];
export const CONSENT_SECTION = consent;
