# Smarter pre-assessment branching, with every option listed

## Goal

Publish an additive pre-assessment version 8 that uses the people, ages and services already confirmed in intake, removes contradictory and repeated questions, and replaces vague free-text boxes with explicit choices. Version 7 is currently published; submitted records stay exactly as sent.

## Confirmed current problems

- **Who will be there for the assessment?** offers both **The person receiving care** and **Me**, even when they are the same person.
- Alternative contact starts with a first name and leaves every other detail optional.
- Nanny and childcare asks **How many children need care?** and a free-text **Tell us about each child** block, although intake already records each child separately.
- **Nursery or school**, **Usual schedule**, meals and sleep are unstructured boxes with no defined purpose.
- Nanny and childcare has no clinical/non-clinical classification, so clinically framed questions can appear for purely domestic childcare.

## 1. Children are never described in one box

Removed entirely:

- **How many children need care?**
- **Tell us about each child** (the repeatable first name / last name / date of birth / nursery / usual schedule block)

Instead, each child is already a named care recipient from intake, with first name, last name, date of birth or age, and Nanny and childcare selected. The form then runs the childcare questions once per named child, headed by that child's name, with answers stored under that child's recipient key. Nothing asks the family to describe several children inside one answer.

If Nanny and childcare is attached to an adult, or a child has no date of birth or age, the form stops and asks for that correction in intake rather than guessing.

## 2. Assessment attendees

Options are built from confirmed intake, so the same person never appears twice.

- Respondent receiving care only: **Me**, **Another family member**, **A caregiver already helping**, **Someone else**
- Care for one other person: **[Child or recipient's full name]**, **Me**, **Another family member**, **A caregiver already helping**, **Someone else**
- Several recipients: each recipient by full name, then **Me** once, then the same three additional options

Named recipients save recipient keys, not display text.

## 3. Alternative contact

**Is there someone else we can contact about this care request?** Yes / No

When Yes, one grouped block, all required: First name, Last name, Relationship to the care recipient, Phone, Email.

If the phone or email matches the enquirer or a recipient already recorded, the form says those details are already held and does not store a duplicate contact.

## 4. Nanny and childcare classification

**What type of nanny or childcare support is required for [name]?**

- Non-clinical childcare
- Clinical care
- Both clinical and non-clinical care

Health information is still collected on the non-clinical route, worded plainly rather than clinically, because a person caring for a child must know these things.

**Non-clinical route asks:**

- Childcare pattern and duties
- Education or childcare setting, only when a school-related duty is selected
- Dietary requirements and food allergies
- Allergies and what happens
- Regular medicines, who gives them and when
- Health conditions the carer must know about
- Sleep and naps
- Activities and comfort
- Safety and supervision

**Non-clinical route does not ask:** hospital admissions and discharge, treating clinicians and where they practise, wounds, medical devices, breathing support, clinical feeding regimes, palliative questions, mobility transfer techniques or clinical escalation history.

**Clinical route** adds the full clinical pathway to the above. **Both** asks the union once, with no repeats.

Routing stays deterministic. No AI decides which questions appear. Urgent answers still alert the office.

## 5. Childcare duties, which decide what follows

**Which duties are expected for [name]?** (multi-select)
Childcare and supervision, Meals and feeding, Bathing and dressing, Nappies and toileting, School or nursery drop-off, School or nursery collection, Homework support, Play and activities, Children's laundry, Tidying the children's areas, Taking the child to appointments, Overnight care, Travel with the family, Something else

School questions appear only when drop-off, collection, homework support or taking the child to appointments is selected.

## 6. Education or childcare setting

**Which setting does [name] attend?**

- Setting type (choose one): Créche or daycare, Nursery or pre-school, Primary school, Secondary school, Home schooling, Special educational needs school, Therapy or early-intervention centre, Does not attend a setting, Something else
- Setting name: free text, asked only when a setting is attended
- Area or address of the setting: free text, asked only when drop-off, collection or appointments is selected
- Attendance days: Monday to Sunday multi-select
- Usual start time and usual finish time: time pickers
- Term-time only, or all year: choice
  &nbsp;

## 7. When childcare is required, replacing "usual schedule"

- Days required: Monday to Sunday multi-select
- Start time and finish time for each selected day, with a **Same times every day** shortcut
- Overnight care required: Yes / No
- Live-in or live-out: Live-in, Live-out, No preference
- Pattern: One-off, Short term, Ongoing, Not sure yet
- Expected start date

Request-wide timing already answered is reused, and only missing child-specific details are asked.

## 8. Dietary requirements and food allergies

**Does [name] have any dietary requirements?** Yes / No / Not sure

When Yes, a searchable multi-select grouped as:

- **Food allergies**: Milk or dairy, Egg, Peanut, Tree nuts, Fish, Shellfish, Soya, Wheat or gluten, Sesame, Something else
- **Food intolerances**: Lactose, Gluten, Something else
- **Medically advised diets**: Diabetic, Low sodium, Renal, Low fat, High protein or high calorie, Something else
- **Religious or cultural requirements**: Halal, Kosher, No pork, No beef, Fasting periods, Something else
- **Vegetarian or vegan**: Vegetarian, Vegan, Pescatarian
- **Texture and feeding**: Puréed or soft food, Chopped food, Thickened fluids, Bottle feeding, Tube feeding, Help needed with eating

Then: **Foods to avoid completely** (free text) and **Anything else about meals we should know** (optional free text). "Usual meals" is removed.

Food allergies already recorded in the allergy question are shown as already held and not asked twice. Reactions and severity stay in the allergy record.

## 9. Sleep and naps

Asked for babies and younger children, or when overnight or evening care is selected. Otherwise the family can answer **No sleep support required**.

- Usual bedtime and usual waking time: time pickers
- Daytime naps: None, One nap, Two naps, Varies
- Usual nap time and usual nap length, when naps apply
- What helps [name] settle? (multi-select): A set routine, A story, Music or lullabies, A comfort item, Being rocked or held, A dim light, A night light, Quiet company nearby, Something else
- Does [name] usually wake in the night? Yes / No / Sometimes, with what helps when they wake
- Sleeping arrangement: Own cot, Own bed, Shares a room, Shares a bed, Something else

## 10. Activities and comfort

**Which activities does [name] enjoy?** (multi-select, grouped, with free text)

- **Play**: Building blocks, Puzzles, Dolls or figures, Cars or trains, Pretend play, Dressing up
- **Creative**: Drawing and colouring, Painting, Craft, Music and singing, Dancing, Playing an instrument
- **Physical and sport**: Running and chasing games, Football, Cycling, Swimming, Dancing or gymnastics, Playground visits
- **Learning**: Reading and stories, Being read to, Numbers and counting, Languages, Educational games
- **Screen and games**: Cartoons or films, Tablet games, Video games
- **Outdoors and social**: Garden play, Walks, Visiting family, Playdates, Religious or community activities
- **Something else**: free text

**What helps [name] feel settled or comforted?** (multi-select, with free text)
A comfort item or toy, A favourite blanket, A parent or familiar adult nearby, Being held or cuddled, Quiet time alone, Music, A story, A snack or drink, A routine being followed, Going outside, Something else

Both questions accept free text in addition to selections, and neither is required.

## 11. Safety and supervision

**Are there any safety or supervision needs we should know about for [name]?** Yes / No / Not sure

When Yes, multi-select: Falls or unsteady movement, Choking or eating safely, Water safety, Stairs or balconies, Leaving the house unsupervised, Seizures, Allergic reactions requiring urgent action, Behaviour that may cause harm, Medical equipment safety, Road safety, Something else

Each selected area asks for what happens and what helps. Answers meeting the existing urgent criteria continue to alert the office.

## Implementation

1. Build version 8 additively; versions 1 to 7 stay unchanged.
2. Add the new structured controls: recipient-aware attendees, grouped contacts, dietary list, activity list, comfort list, setting details, authorised collection people and day/time schedules.
3. Mirror validation and conditional rules in the browser and the form-saving function.
4. Prune answers that no longer apply when classification, duties, age, diet or schedule change.
5. Show named children, grouped contacts and readable labels in review and Admin read-back.
6. Publish version 8 after validation, then retire version 7 for new links.
7. Migrate only unsubmitted version 7 documents where answers map safely; otherwise issue a new link. Submitted records stay immutable.

## Technical details

- Identity comes from intake recipient keys, never from matching names.
- Request-level and recipient-level answers stay separate; siblings never share answers or uploads.
- Dietary and activity vocabularies extend the existing universal lists additively, with free text preserved.
- No lifecycle, permission, merging or AI-routing changes.

## Completion gates

1. **Definition audit**: version 8 passes schema, condition, carry and duplicate checks, with a route matrix per recipient type and childcare classification.
2. **Logic tests**: attendee options never contradict; contacts require all fields; children come from intake; school questions follow duties; non-clinical keeps health, medicine, allergy and safety questions while excluding clinical-pathway questions; dietary reuses recorded allergies; hidden answers clear; siblings stay isolated.
3. **Browser checks**: populated self, one-child and multi-child journeys at 320, 393, 430 and 1280 px, covering every branch, with save, resume, review and submit and no repeated questions, overflow or errors.
4. **Release**: focused tests, full tests, type check, build, deploy changed functions, publish version 8, complete a disposable populated link, verify Admin read-back, remove disposable data, then report what changed, what deployed, what was tested live and anything unverified.