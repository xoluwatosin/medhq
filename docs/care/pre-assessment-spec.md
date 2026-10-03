# Medic Connect Pre-assessment Questionnaire Specification

**Document:** MC-FRM-07 replacement specification  
**Prepared:** 13 September 2026  
**Status:** Implementation attachment  
**Scope:** Family/client pre-assessment only

## 1. Purpose

This document defines the questions, order, controls, branching, wording and safety behaviour for the Medic Connect pre-assessment. It is completed after the initial Request Care enquiry and before the professional home/clinical assessment.

The pre-assessment must collect enough information to understand the request, prepare the assessor and identify matters needing urgent review. It must not reproduce the full professional assessment or invite a family member to make clinical determinations.

## 2. Core principles

- One coherent journey must be generated from the recipient, age, service and answers.
- Questions which do not apply must not be displayed, counted in progress or submitted as current evidence.
- `Myself` uses **you/your** throughout.
- `Someone else` uses the recipient's preferred or first name where natural; otherwise use **the person receiving care**.
- Child wording uses the child's name. Use **your child** only when the respondent is the parent or guardian.
- Mother and baby questions must always identify their subject.
- First name and last name are separate fields.
- Dates use a calendar/date control.
- Yes/no answers use buttons or radios, not dropdowns.
- Detailed follow-ups appear only after the relevant answer.
- The form is not an emergency service and must say so when urgent answers are selected.

## 3. Routing data

The renderer must maintain the following derived context from live answers:

| Context value | Source |
|---|---|
| `who_for` | `myself` or `someone_else` |
| `recipient_name` | confirmed account name or entered recipient name |
| `dob_known` | explicit answer |
| `date_of_birth` | date input |
| `age_years` | calculated from DOB, or approximate age when DOB is unknown |
| `age_band` | `newborn`, `infant`, `child`, `adult`, `older_person` |
| `respondent_relationship` | relationship to recipient |
| `decision_authority` | self, parent/guardian, authorised representative, other |
| `service` | selected/confirmed care service |
| `applicable_modules` | calculated from service and answers |

Suggested age bands for routing, not clinical diagnosis:

| Band | Rule |
|---|---|
| Newborn | under 28 days |
| Infant | 28 days to under 2 years |
| Child | 2 to under 18 years |
| Adult | 18 to under 65 years |
| Older person | 65 years and over |

Age alone must not imply frailty, incapacity or need. The older-person pathway is activated by an older recipient plus an eldercare request or relevant needs.

## 4. Opening route

### R1. Who is the care for?

- **Control:** two radio cards/buttons
- **Required:** yes
- Myself
- Someone else

### R2A. Identity when care is for myself

1. **Is this your name?** — confirmation control showing separate first and last name; required.
2. **What name would you like us to use?** — short text; optional.

### R2B. Identity when care is for someone else

1. **First name** — short text; required.
2. **Middle name** — short text; optional.
3. **Last name** — short text; required.
4. **What name do they prefer to use?** — short text; optional.
5. **What is your relationship to [Name]?** — controlled relationship picker; required.

### R3. Date of birth and age

1. **Do you know [your / Name's] date of birth?** — Yes/No; required.
2. If Yes: **Date of birth** — calendar/date control; required.
3. If No: **Approximately how old [are you / is Name]?** — whole number; required; range 0–120.

Calculate age and age band immediately. If `who_for = myself`, a child or newborn age is an invalid combination and must be resolved before continuing.

### R4. Decision and consent context

Hide this section for a competent adult completing it for themselves.

For another adult:

1. **Does [Name] know you are arranging care?** — Yes/No/Unable to discuss; required.
2. **How does [Name] feel about receiving care?** — Comfortable/Unsure/Does not want care/Unable to express a view; optional note when needed.
3. **What allows you to make or support decisions about [Name's] care?** — Family support/Recorded authority/Professional role/Other/Not sure; required.
4. If recorded authority: request type and evidence later through the appropriate secure process; do not infer portal access.

For a child:

1. **Are you [Name's] parent or legal guardian?** — Yes/No; required.
2. If No: parental-responsibility holder's First name, Last name, relationship and phone.
3. **Does [Name] know about the planned visit?** — Yes/No/Not appropriate for their age or understanding.
4. When appropriate: **How does [Name] feel about the visit?** — Comfortable/Unsure/Worried/Does not want it/Not known, with optional note.

### R5. Confirm the type of care

- **Control:** radio cards with short descriptors
- **Required:** yes

| Key | Label | Eligibility |
|---|---|---|
| `antenatal` | Antenatal care at home | pregnant recipient |
| `postnatal` | Postnatal care and Omugwo | mother/newborn context |
| `post_surgical` | Post-surgical care at home | child or adult |
| `eldercare` | Eldercare and companion care | older person/relevant circumstances |
| `clinical_home_care` | Clinical home care | any age, age-appropriate branch |
| `nanny` | Nanny and childcare | child recipient |
| `additional_needs` | Children with additional needs | child recipient |
| `other` | Something else / not sure | all |

If the stored enquiry service contradicts the live recipient profile, show: **We have this request recorded as [service]. Which type of support should we prepare for?** Do not silently choose.

## 5. Universal core

These questions appear in every route, with respondent-aware wording.

| ID | Question | Control | Required | Condition/follow-up |
|---|---|---|---|---|
| `situation` | In your own words, what is happening and how can we help? | Long text | Yes | Always |
| `urgency` | How soon do you need support? | Radio: within 48 hours/this week/this month/just exploring | Yes | Always |
| `immediate_danger` | Is anyone in immediate danger or in need of emergency medical help now? | Yes/No | Yes | If Yes, show emergency instruction; form may be retained but must not imply dispatch |
| `languages` | Which languages should the care professional speak? | Language picker | No | Always |
| `communication_support` | Is any communication support needed? | Multi-select | No | Options: hearing, sight, speech, interpreter, communication aid, cognitive support, other, none |
| `communication_detail` | What would help communication? | Long text | No | If any support selected except none |
| `diagnosed_conditions` | [Do you/Does Name] have any diagnosed medical conditions relevant to this request? | Yes/No/Not sure | No | Ask details if Yes |
| `condition_details` | Which conditions should we know about? | Condition picker plus Other | No | If Yes |
| `hospital_recent` | [Have you/Has Name] been admitted to hospital in the last three months? | No/Yes/Currently in hospital | No | Hospital branch |
| `hospital_name` | Which hospital? | Text | No | Yes/currently |
| `admission_date` | When [were you/was Name] admitted? | Date | No | Yes/currently |
| `discharge_status` | What is the current discharge position? | Discharged/Discharge planned/No date yet | No | Yes/currently |
| `discharge_date` | When [were you/was Name] discharged? | Date | No | Discharged |
| `expected_discharge` | When is discharge expected? | Date | No | Discharge planned |
| `discharge_letter` | Upload the discharge letter, if available | Secure upload | No | Discharged/planned |
| `professional_involved` | Is a doctor or other health professional currently involved? | Yes/No | No | Details if Yes |
| `professional_details` | Who is involved and where do they practise? | Repeatable professional/contact group | No | If Yes |
| `regular_medicines` | [Do you/Does Name] take regular medicines? | Yes/No/Not sure | No | Activates medicines module if Yes |
| `allergies` | [Do you/Does Name] have any known allergies? | Yes/No/Not sure | Yes | Details if Yes |
| `allergy_details` | Allergy, reaction and severity | Repeatable structured group | Yes when shown | If Yes |
| `support_now` | Who currently provides regular help? | Multi-select | No | Family/friend/caregiver/nurse/nanny/other/none; service-aware labels |
| `support_detail` | What help do they provide and how often? | Long text + frequency | No | If support is selected |
| `alternative_contact` | Who should we contact if we cannot reach you? | First name, Last name, relationship, phone | No | Always |
| `care_days` | Which days may support be needed? | Day multi-select/Not sure | No | Always |
| `care_times` | What times may support be needed? | Morning/afternoon/evening/overnight/live-in/not sure | No | Always |
| `start_when` | When would you like care to begin? | ASAP/this week/this month/flexible/specific date | No | Date if specific |
| `duration` | How long might support be needed? | One-off/under 2 weeks/2–6 weeks/ongoing/not sure | No | Always |
| `visit_address` | Where should the assessment take place? | Structured address | Yes | Always |
| `lga` | LGA/area | Controlled LGA picker | Yes | Derived/confirmed from address |
| `landmark` | Nearby landmark | Text | No | Always |
| `visit_attendees` | Who will be present for the assessment? | Multi-select | No | Service/recipient-aware |
| `visit_days` | Which days are suitable? | Day multi-select | No | Always |
| `visit_time` | What time of day is suitable? | Morning/afternoon/evening | No | Always |

Do not ask a generic unconditional question combining nanny, caregiver and household staff.

## 6. Medicines module

Activate when regular medicines = Yes, or where the service requires medicine screening.

1. **Please list the medicines [you take/Name takes].** — repeatable structured row: medicine name, strength if known, dose, route if known, frequency, reason if known.
2. **Who currently manages the medicines?** — self/family/caregiver/nurse/other.
3. **Is any help needed with medicines?** — reminders/prompting/opening packaging/administration/injections/collection/reordering/none/not sure.
4. **Have any doses been missed recently?** — No/Yes/Not sure; details if Yes.
5. **Are any medicines time-critical or refrigerated?** — No/Yes/Not sure; details if Yes.

## 7. Mobility, falls and home-access module

Activate for eldercare, post-surgical care, reported mobility difficulty, falls, or relevant clinical home care.

1. **How does [Name/the respondent] usually move around indoors?** — independently/with an aid/with another person's help/wheelchair/mostly in bed/other.
2. **Which mobility aids are used?** — multi-select; if applicable.
3. **Has there been a fall in the last six months?** — No/Yes/Not sure.
4. If Yes: number of falls, most recent date, injury, circumstances, medical review.
5. **Is help needed with stairs or transfers?** — No/Yes; details.
6. **Are there access issues at the home?** — stairs/lift unavailable/narrow entrance/security/gate/pets/poor lighting/other/none.
7. **Is any equipment already in the home?** — bed/hoist/wheelchair/walker/commode/oxygen/suction/nebuliser/other/none.

## 8. Antenatal pathway

Only for an adult receiving pregnancy-related support.

1. Expected due date — date.
2. Current gestation — calculated from due date where possible; confirm weeks if uncertain.
3. Singleton or multiple pregnancy — choice/Not known.
4. Is an obstetrician, midwife or clinic overseeing the pregnancy? — Yes/No; details if Yes.
5. Planned place of birth — hospital/birth centre/home/not decided.
6. Has the pregnancy been described as high risk? — No/Yes/Not sure; reason if Yes.
7. Have any concerns or complications been raised? — multi-select: blood pressure/pre-eclampsia, diabetes, bleeding, pain, reduced movements, anaemia, placenta issue, infection, growth concern, previous complication, other, none.
8. For any current red-flag answer, show the relevant urgent-contact instruction.
9. Previous pregnancies — number.
10. Previous births — number; show only if applicable.
11. Previous pregnancy or birth complications — Yes/No; details if Yes.
12. What support is wanted now? — observations, education, birth preparation, medicines/injections, nutrition, emotional support, help after birth, other.
13. Who is available to support the recipient? — partner/family/friend/paid support/nobody/other.
14. Any cultural, religious or privacy preferences? — optional long text.

## 9. Postnatal care and Omugwo pathway

First establish whether the baby has been born.

### 9.1 Shared route

1. **Has the baby been born?** — Yes/No.
2. If No: expected due date, antenatal concerns and planned post-birth support; do not display nappies, birth weight, newborn checks or maternal recovery questions.

### 9.2 Mother

When the baby has been born:

1. Mother's First name and Last name if not already the recipient.
2. Date of delivery — date.
3. Mode of delivery — vaginal/assisted vaginal/planned Caesarean/emergency Caesarean/other.
4. Were there complications during or after delivery? — No/Yes/Not sure; details.
5. How is the mother recovering? — multi-select: recovering well, wound/perineal concern, pain poorly controlled, heavy bleeding, fever, headache/visual symptoms, swelling/breathlessness, urinary/bowel concern, other.
6. Any urgent maternal red flag triggers an immediate instruction to seek urgent medical help.
7. How is the mother feeling emotionally? — settled/mixed/low or anxious/overwhelmed/in crisis/prefer not to say.
8. If concerning: ask whether support is already in place and provide appropriate escalation language.
9. What support does the mother want? — recovery checks, wound check, feeding support, rest/night support, medicines, emotional support, education, other.

### 9.3 Baby

1. Baby's First name and Last name if known.
2. Date of birth — date; derive age.
3. Gestation at birth — weeks, if known.
4. Birth weight — value plus kg/g unit.
5. Current weight — value plus kg/g unit; optional.
6. Was the baby admitted to neonatal care or readmitted? — No/Yes; details.
7. Has the baby had jaundice? — No/Yes/Not sure; treatment/current concern if Yes.
8. Feeding method — breastfeeding/expressed milk/formula/mixed/tube/other.
9. Feeding concerns — multi-select plus details.
10. Wet nappies per 24 hours — numeric/Not sure.
11. Stool frequency/concern — structured choice plus note.
12. Newborn checks completed — multi-select/Not sure.
13. Baby warning signs — poor feeding, difficult to wake, breathing difficulty, fever/feels unusually cold, blue colour, seizures, repeated vomiting, fewer wet nappies, worsening jaundice, other, none.
14. Any warning sign shows immediate urgent medical advice; submission must not imply emergency monitoring.

## 10. Post-surgical pathway

1. Procedure or operation — text.
2. Procedure date — date.
3. Hospital and treating team — text/structured professional.
4. Current location — hospital/home/other.
5. Discharge date or expected discharge date — conditional date.
6. Discharge instructions available — secure upload/Not available.
7. Follow-up appointment — date and provider, if arranged.
8. Wound or dressing present — No/Yes; location, type and instructions if Yes.
9. Drain, catheter, stoma or other device — multi-select; details/instructions.
10. Current pain — none/mild/moderate/severe; severe pain triggers prompt clinical review and safety copy.
11. Pain-management plan — Yes/No/Not sure; details.
12. Mobility compared with usual — usual/reduced/significantly reduced/bedbound.
13. Help needed — bathing, dressing, toileting, transfers, meals, medicines, wound care, therapy exercises, overnight observation, other.
14. Warning signs currently present — fever, heavy bleeding, increasing redness/swelling, wound opening/discharge, chest pain, breathlessness, confusion, uncontrolled pain, other, none.
15. Any urgent warning sign shows emergency/urgent-care instruction.
16. Equipment required or already supplied — structured multi-select.
17. Who will be at home during recovery? — multi-select.

## 11. Eldercare and companion-care pathway

Use neutral language; do not assume incapacity.

1. What support would be most useful? — companionship, meals, shopping, appointments, personal care, medicines, mobility, overnight support, respite, clinical visits, other.
2. How independent is the person with washing, dressing, toileting and eating? — matrix: independent/prompt/help/hands-on/full assistance.
3. Any memory or thinking changes? — No/Yes/Diagnosed condition/Not sure; details.
4. Any recent confusion or sudden change? — No/Yes; Yes triggers urgent clinical review.
5. Communication preferences and sensory aids — structured.
6. Eating and drinking — independent/some help/full help; appetite or swallowing concerns.
7. Continence support — none/toileting help/pads/catheter/stoma/other; respectful optional detail.
8. Mobility and falls — activate module.
9. Sleep/overnight concerns — No/Yes; details.
10. Current routine and activities that matter — long text.
11. Social contact — lives alone/with family/with staff/other; frequency of contact.
12. Known home-safety concerns — multi-select.
13. What does a good day look like for this person? — long text.
14. What would the family/person most like to improve or preserve? — long text.

## 12. Clinical home-care pathway

1. What clinical help is being requested? — nursing observations, injections, IV therapy, wound care, medicines, catheter/stoma, feeding tube, respiratory care, physiotherapy, chronic-condition support, palliative support, other.
2. Who advised or prescribed this care? — structured professional details/No one yet.
3. Are written clinical instructions available? — secure upload/No.
4. How often is the care required? — one-off/daily/multiple daily/weekly/other/not sure.
5. Relevant observations or monitoring requested — multi-select; do not ask the family to interpret results.
6. Wound module — only if wound care selected.
7. Device/equipment module — only if a device-based intervention is selected.
8. Respiratory module — only if respiratory care/oxygen/tracheostomy/ventilation selected.
9. Nutrition/feeding-tube module — only if applicable.
10. Mobility/falls module — only if indicated.
11. Current warning signs — service-appropriate safety checklist.
12. Escalation/contact instructions already provided by treating team — Yes/No; details if Yes.
13. Palliative/end-of-life support — activate a sensitively worded sub-path only when selected; ask goals, current team, symptom concerns and preferred place of care without making assumptions.

Age-appropriate wording and modules must be used if the clinical recipient is a child.

## 13. Nanny and childcare pathway

Nanny questions appear only when at least one child is receiving care.

For each child:

1. First name.
2. Last name.
3. Date of birth — derive age.
4. Nursery/school and usual schedule, if applicable.
5. Health conditions — Yes/No; details if Yes.
6. Allergies — Yes/No/Not sure; structured details if Yes.
7. Regular medicines — Yes/No; details and administration expectations if Yes.
8. Usual meals/feeding and dietary requirements.
9. Sleep/nap routine.
10. Toileting stage/support.
11. Communication and languages.
12. Activities, interests and comfort strategies.
13. Any safety or supervision needs.

Role questions:

1. Number of children requiring care.
2. Days and hours.
3. Live-in/live-out/no preference.
4. Duties — childcare, meals for child, school run, homework, activities, child laundry, travel, overnight care, other.
5. Authorised school/childcare collection requirements.
6. Existing nanny/childcare — Yes/No; reason for additional/replacement support if relevant.
7. Desired experience/capabilities — newborn, early years, school-age, first aid, clinical background, additional-needs experience, driving, swimming supervision, other.
8. Household context relevant to the role — pets, other staff, travel, stairs, pool, other.
9. What matters most when choosing the nanny? — select up to three plus note.

Do not ask unrelated adult clinical or eldercare questions unless separately triggered by a real clinical answer.

## 14. Children with additional needs pathway

Use respectful and observable language.

1. What support is the family seeking? — daily care, school support/shadowing, communication, mobility, feeding, personal care, behaviour support, respite, therapy carryover, clinical care, other.
2. Diagnosed condition(s) — Yes/No/Assessment ongoing; details if applicable.
3. Professionals involved — paediatrician, therapist, school SEN team, psychologist, other; repeatable details.
4. How does the child communicate? — speech, signs, gestures, pictures/AAC, behaviour/body language, other.
5. What helps the child understand communication? — short language, visual schedule, demonstration, processing time, other.
6. Mobility — independent/aid/help/wheelchair/other.
7. Personal-care support — matrix for washing, dressing, toileting and eating.
8. Eating/drinking method — oral/modified texture/tube/mixed/other.
9. Any swallowing, choking or aspiration concern? — No/Yes; details and professional plan if Yes.
10. Medicines — activate module.
11. Seizures — No/Yes; type, frequency, rescue plan and medicine if Yes.
12. Equipment depended upon — multi-select plus instructions.
13. Sensory preferences or sensitivities — noise/light/touch/smell/movement/food textures/other/none.
14. What situations may cause distress? — observable contexts, not labels.
15. How may distress present? — objective multi-select plus description.
16. What usually helps? — long text.
17. Is there a written support, therapy, feeding, seizure or behaviour plan? — secure upload by type.
18. Nursery/school/programme — details and schedule.
19. Therapies — type, provider and frequency.
20. Safety considerations — wandering, road awareness, water, falls, self-injury, aggression, choking, seizures, equipment, other, none.
21. Strengths and interests — long text.
22. What would the family most like support to achieve? — up to three observable priorities.

Never use “difficult child”, unexplained severity scores, arbitrary happiness scores or opaque developmental percentages.

## 15. Other / not sure pathway

Keep this short:

1. What is happening and what support may be needed?
2. Who needs support?
3. Relevant age/DOB.
4. Any immediate clinical or safety concern?
5. Any diagnosis, hospital admission, medicine or allergy relevant to the request?
6. How soon is support needed?
7. Best callback/assessment arrangements.

Do not expose all specialist modules.

## 16. Final review and consent

1. Present a concise sectioned review of applicable answers only.
2. Allow editing by logical section.
3. **I confirm that the information I have provided is accurate to the best of my knowledge.** — required checkbox.
4. **I agree Medic Connect may use this information to understand the care request, arrange an assessment and plan appropriate support.** — required checkbox with Privacy Notice link.
5. Where the respondent is acting for someone else: **I confirm that I am authorised to provide this information or have an appropriate reason for doing so.** — required checkbox; this records the statement but does not itself create clinical or portal access.
6. Submit button: **Send pre-assessment**.
7. Only show Submitted after server acknowledgement.

## 17. Safety response classes

| Class | Behaviour |
|---|---|
| Emergency concern | Prominent instruction to contact emergency services/attending hospital now; Medic Connect is not an emergency service |
| Prompt clinical review | Flag for clinical/coordinator review and prioritisation without telling the respondent a diagnosis |
| Assessment information | Included in the normal assessment briefing |

Safety rules must be server-derived as well as client-visible. Analytics must receive only the event/class, never the clinical answer.

## 18. Hidden-answer rules

When an upstream answer changes and a field becomes inapplicable:

- hide it immediately;
- remove it from progress and validation;
- prevent it from activating another module or safety rule;
- do not include it as active submitted evidence;
- preserve any necessary audit history according to the existing event model;
- apply identical applicability checks on the server.

## 19. Presentation

- Mobile-first at 320px and 390px.
- One primary question group at a time where complexity warrants it.
- Compact section heading and brief contextual line only when needed.
- No giant headings, generic dashboard cards, raw keys or decorative progress claims.
- Back navigation must retain acknowledged answers.
- Progress is based on currently applicable sections and fields.
- No false Saved, Synced or Submitted state.

## 20. Acceptance journeys

The implementation is unacceptable unless all of these pass:

1. Myself, age 50, clinical home care: direct second-person wording; no nanny, child, school, pregnancy, baby or eldercare questions.
2. Myself, age 75, eldercare: appropriate independence/mobility questions; no assumption of incapacity; no child questions.
3. Someone else, adult, post-surgical: surgical and discharge pathway only, plus applicable core/modules.
4. Someone else, child, nanny: childcare routine, safety and role questions; no eldercare or pregnancy questions.
5. Someone else, child, additional needs: communication, mobility, feeding, therapies, sensory, safety and support-strategy questions.
6. Antenatal: pregnancy questions; no born-baby questions.
7. Postnatal: mother and baby questions clearly separated; newborn questions only after birth.
8. Other/not sure: concise route without specialist-question dump.
9. Changing DOB, recipient or service immediately recalculates the route and neutralises hidden answers.
10. Direct submission of an inapplicable answer is rejected or ignored under the documented server contract.

## 21. Boundary with later clinical documents

The pre-assessment is prior evidence. During the professional assessment, the assigned Clinical Assessor must Confirm or Amend relevant carried answers. Pre-assessment responses must never be silently treated as the assessor's own clinical assertion.

