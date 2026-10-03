# The other three routes: support, non-clinical, student

Today the system is built around one candidate: a licensed clinician. The other three routes exist as words on `/join` but almost nothing behind them changes. This brings all three up to the same standard.

## What is actually true today

- **Route is not recorded.** 281 of 282 people have no track on file; only brand new join sign-ups set it. The one requirement row keyed on route (student) therefore never fires for anyone.
- **Requirements fall back to profession text.** A person is judged licensed clinical, care support, non-clinical or general by matching their job title against a regex. No title, no rule, so they land on "general".
- **Documents ignore the route.** The asked-for list is fixed: CV, ID, qualification always; licence only if licensed. `/join` promises students a student ID and course letter, and support workers two referees. Neither is ever requested.
- **Preferences are care-only and mandatory.** Every candidate must pick care types, live-in and shift patterns before their profile counts as complete. A finance officer or a second-year student cannot answer those honestly.
- **Availability is mandatory for everyone**, including people looking for a salaried Monday-to-Friday role.
- **One profession bucket for everything non-clinical.** HR, finance, driver, developer all collapse to "Non-clinical / Support", so there is nothing to match on. Students have no profession at all, which leaves a gap that never closes.
- **Student fields exist but are half-wired.** Institution, course, year of study and expected graduation are columns; only institution is ever chased.

## What we build

### 1. Everyone gets a route, confirmed not guessed
Route is inferred from profession where the mapping is unambiguous, then confirmed by the candidate on the same screen that already asks state and LGA at sign-in. One extra question, no new interruption. Confirmed route is written with its source and logged to the audit trail; admin can override.

### 2. Requirements per route, not per job title
The requirement rules gain a route key so support, non-clinical and student each get their own row, and route beats title when both are known:

| | Licence | NYSC | Institution | Referees | Availability | Preferences |
|---|---|---|---|---|---|---|
| Clinical | Yes | Yes | No | 2 | Yes | Care set |
| Support and care | No | Yes | No | 2 | Yes | Care set |
| Non-clinical | No | Yes | No | 1 | Tab removed | Work set |
| Student | No | Not yet, still studying | Yes | Statement instead | Around a timetable | Study set |

NYSC is asked of every qualified professional, whatever their route, because it applies to all of them. Students are the only people it is not asked of; the question returns to them once they graduate.

Availability stops being a universal demand. Non-clinical candidates lose the availability tab altogether: it does not appear in their portal navigation, it is never a gap, and admin sees a start date and notice period in its place. Students keep a lighter version built around their timetable, and the care routes keep it as it is today.


### 3. Documents that match the promise made on /join
Requested documents become route-aware: proof of admission or a current course letter for students (not a student ID, which many do not have), two referees for support workers, CV and ID for non-clinical, licence only where a licence is expected, NYSC certificate or exemption for every non-student who says it applies. What `/join` advertises is exactly what the portal then asks for.


### 4. Preferences: one screen, options that swap by route
Same layout and grammar everywhere, different content.

- **Support and care** — the existing care catalogue, live-in, shift patterns.
- **Non-clinical** — function areas (HR, finance, operations, admin, IT, records, procurement, facilities, marketing, security, logistics), employer types (hospital, clinic, home care provider, laboratory, NGO, health tech, insurer), work setting (on site, hybrid, remote), contract type (permanent, contract, part time, project), notice period, salary expectation as a band.
- **Student** — institution, course, level of study (ND, HND, NCE, bachelor's, master's, postgraduate diploma, doctorate), year, expected finish, what they want (clinical placement, internship, holiday work, graduate role, volunteering), days free around the timetable, whether they can travel.

Every route also answers **"What roles or opportunities are you looking for?"** as pills with an "Other" option that opens a free text box. Deal-breakers and travel distance stay shared.

Additional questions worth asking on the non-clinical and student routes: highest qualification, years in the field where a CV is absent, software or systems used, driving licence and access to a vehicle, willingness to relocate, earliest start date, and preferred communication channel.

### 4b. What a student says instead of a reference
Students rarely have two employers to name, so in place of the second reference they write a short statement: **"What do you hope to get out of joining Medic Connect?"** A cover-letter style box with a prompt and a soft word guide, plus one named academic or clinical supervisor where they have one. The statement is required for the student route, shows on the admin profile, and is what a facility reads when a student is put forward.

### 5. A real vocabulary instead of one bucket
- A non-clinical profession list covering the eleven function areas above, so admin can filter and matching can score.
- A full course list for students covering the health courses (nursing, midwifery, medicine and surgery, pharmacy, medical laboratory science, physiotherapy, radiography, public health, health information management, nutrition, optometry, dentistry, anatomy, physiology, biochemistry, microbiology) and the common non-health degrees (accounting, business administration, economics, law, computer science, mass communication, psychology, social work, education and early years, engineering), with **Other** always present and a free text box behind it. The same pattern applies to institution: pick from the list, or Other and type it.


### 6. Admin tags and filters by route
Every person carries a visible route tag: Clinical, Support and care, Non-clinical, Student, or Route not confirmed. The tag shows on the candidate row and on the profile hero, and the candidate list gains a route filter so admin can pull up non-clinical people or students on their own, or exclude them from a clinical search. Route also joins the export columns and the "who is free" board.

The profile then renders the route's own fields (course, level, expected finish and the joining statement for students; function area, setting, contract type and notice period for non-clinical), and the gap list names only what that route actually needs. No more chasing a licence number from an accountant.


## Technical notes

- `mu_people.track` backfilled by deterministic profession mapping, unmapped left null; `/portal/start` gains a route confirmation alongside state and LGA, written through `mu_candidate_update_profile` so it lands in `mu_activity`.
- `mu_role_requirements` gets rows for `care_support`, `non_clinical` and `student` keyed on `track_key`, and `mu_role_requirement()` prefers a route match over a pattern match.
- `mu_candidate_gaps_row` reads the route rule for availability, preferences, references, institution and licence, and adds route-specific fields (course, level, expected graduation and the joining statement for students; function area for non-clinical). NYSC stays required on every non-student route. Availability is never a gap on the non-clinical route, and the portal navigation drops the tab for that route.
- `mu_required_documents` gains a `track_key` and rules `student_only`, `support_only`; the student rule asks for proof of admission or a current course letter, never a student ID. Portal and admin request lists read from it, replacing the fixed always/licensed-only list.
- `mu_work_preferences` gains columns for function areas, employer types, work setting, contract type, salary band, placement type, roles wanted and a free-text other; `preferencesComplete()` becomes route-aware.
- `mu_people` gains `study_level` and `joining_statement`; course and institution store a chosen value or a free-text other, so nothing is lost when the list does not cover them.
- New `src/lib/non-clinical-roles.ts` and `src/lib/courses.ts` (courses, study levels and institutions, each with Other plus free text); `src/lib/professions.ts` and the Deno copy extended so the parser can resolve non-clinical titles instead of dumping them in one bucket.

- `src/lib/join-tracks.ts` becomes the single source for what each route promises, and the document rules are generated from it so the two cannot drift apart.
