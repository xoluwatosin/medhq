# Medic Connect, candidate experience: Lovable build brief

Paste this file into Lovable as the project knowledge, then send the prompts in section 9 one at a time. Do not send the whole brief as a single prompt.

The visual source of truth is `Candidate Experience End to End.dc.html`. Where this brief and the design disagree, the design wins.

---

## 1. Rules that must never be broken

1. Brand name is two words: **Medic Connect**.
2. No em-dashes anywhere in UI copy. Commas, periods, or "to" for ranges.
3. No middot or bullet separators between words. Use a thin vertical rule, a comma, or spacing.
4. Font is **Figtree** for headings and body. Eyebrow labels are Figtree uppercase with letter-spacing, never monospace.
5. Never mention HMOs or insurance.
6. Never show a candidate a count of zero. If there is nothing, write the sentence that says so.
7. Never show a bare percentage as progress. Name the next action instead.
8. Every screen has exactly one primary action.
9. An unanswered availability date is not a decline. It is its own state.
10. Internal notes and margin flags are never rendered to a candidate.

---

## 2. Design tokens

```css
--navy:        #26306B;  /* primary surfaces, primary buttons, sidebar */
--brand-blue:  #3B4DC4;  /* links, eyebrow labels */
--cobalt:      #1D34FF;  /* logo only, never a UI surface */
--hot-red:     #FF2E2E;  /* logo cross, and notification count badges only */
--tint:        #EEF1FF;  /* soft blue wash */
--tint-border: #C3CBF0;
--navy-line:   #4E58A0;  /* dividers on navy */
--navy-text:   #C9CFF4;  /* body text on navy */
--navy-dim:    #A8B0E8;  /* eyebrow text on navy */
--paper:       #FAF8F4;  /* page background */
--desk:        #EDEAE3;  /* canvas behind cards */
--ink:         #1A1F2E;
--ink-2:       #2A3040;
--body:        #4A5164;
--muted:       #6E7488;
--faint:       #8A8F9E;
--line:        #DCD8CF;
--line-soft:   #EDEAE3;
--warn-bg:     #FBF3E4;
--warn-ink:    #8A5A0F;
--warn-line:   #C98A16;
--warn-wash:   #FBF7EE;
```

Radii: 9 to 11px on controls, 14 to 16px on cards, 18px on page shells, 999px on pills.
Shadows: `0 18px 40px rgba(26,31,46,0.08)` on page cards, `0 12px 28px rgba(38,48,107,0.09)` on an emphasised card.
Mobile touch targets: 44px minimum, primary buttons 16px vertical padding.

### Status pill vocabulary

| State | Background | Text | Used for |
|---|---|---|---|
| Accepted, Done, Set, Confirmed, Being checked, Being reviewed | `--tint` | `--navy` | anything settled or in our hands |
| Needs you, Returned to you | `--warn-bg` | `--warn-ink` | the candidate must act |
| Optional, Closed, Declined, Withdrawn | `#F1EFEA` | `--muted` | no action, no failure |

Nothing in the candidate UI is red. Red is the logo cross and unread counts only.

---

## 3. Routes

```
/join                       route picker
/join/:route/account        create account
/join/:route/verify         confirm WhatsApp number
/join/:route/build/:step    guided profile build, one question per step
/signin                     email and password, magic link fallback
/signin/link                magic link sent, and the landing handler
/signin/forgot              password reset
/portal                     home
/portal/documents
/portal/availability
/portal/availability/setup  which days are you available
/portal/availability/:date  single date sheet
/portal/availability/timeoff
/portal/preferences
/portal/offers
/portal/offers/:id
/portal/applications
/portal/details
```

`:route` is one of `clinical`, `support`, `non-clinical`, `student`.

Guards: `/portal/*` requires a session. Unverified phone still gets into the portal, but the offers surface is replaced by a card telling them to confirm the number. An incomplete build lands on `/portal` with the next-question card, never on a dead end.

---

## 4. Data model

```ts
type Route = 'clinical' | 'support' | 'non-clinical' | 'student';

type Candidate = {
  id: string;
  firstName: string; lastName: string;
  email: string;                    // sign in identity
  phone: string;                    // WhatsApp, E.164
  phoneVerifiedAt: string | null;
  route: Route;
  location: string;
  openToWork: boolean;              // the "Looking for work" toggle
  buildAnswers: Record<string, unknown>;
  buildStepsDone: string[];
  createdAt: string;
};

type Doc = {
  id: string; candidateId: string;
  kind: 'cv' | 'id' | 'qualification' | 'licence' | 'nysc' | 'student-id'
      | 'course-letter' | 'other';
  required: boolean;
  state: 'missing' | 'in-review' | 'accepted' | 'returned';
  fileName: string | null;
  returnedReason: string | null;    // shown verbatim to the candidate
  returnedFix: string | null;       // "what we need instead"
  decidedAt: string | null;
  expiresAt: string | null;         // licences only
};

type ShiftWindow = { from: string; to: string };   // "07:00", "13:30"

type WeekPattern = {
  // per weekday: either named blocks or explicit windows
  [day in 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun']: {
    mode: 'blocks' | 'exact';
    blocks: ('morning' | 'afternoon' | 'night')[];
    windows: ShiftWindow[];         // up to 3, used when mode is 'exact'
  }
};

type DayOverride = {
  date: string;                     // ISO date
  mode: 'blocks' | 'exact' | 'unavailable';
  blocks: ('morning'|'afternoon'|'night')[];
  windows: ShiftWindow[];
  note: string | null;              // e.g. "School run, back by 4pm"
};

type TimeOff = { from: string; to: string; reason: string | null };

type MonthConfirmation = { month: string; confirmedAt: string | null };

type Offer = {
  id: string; candidateId: string;
  title: string; summary: string;
  rateAmount: number; rateUnit: 'day' | 'shift' | 'hour' | 'month';
  startDate: string; endDate: string | null;
  hoursText: string; area: string; travelMinutes: number;
  household: string;
  matchReasons: string[];           // renders the "why we sent this" line
  respondBy: string;
  state: 'open' | 'accepted' | 'declined' | 'withdrawn';
  declineReason: string | null;
};

type Application = {
  id: string; candidateId: string;
  role: string; org: string; appliedAt: string;
  stage: 'applied' | 'read' | 'interview' | 'decided';
  state: 'in-progress' | 'needs-candidate' | 'closed';
  needsWhat: string | null; needsAskedAt: string | null;
  lastEventText: string; lastEventAt: string;
};
```

### Block definitions

`morning = 08:00 to 14:00`, `afternoon = 14:00 to 20:00`, `night = 20:00 to 08:00`.
A block is stored as a window, so switching a day from blocks to exact hours never loses the answer and the admin side reads one format. **Confirm these three definitions with the Medic Connect team before building.**

### Availability resolution order

For any date: `DayOverride` → `TimeOff` → `WeekPattern` → `not answered`.
A booked date is locked and cannot be switched off by the candidate. It offers "Tell us you cannot make it" instead.

---

## 5. Route divergence

The build is generated per route. A question a route does not need does not exist in that route's flow, it is not hidden behind a condition.

| Route | Questions | Adds | Never asks |
|---|---|---|---|
| Clinical professional | 11 | licence number and expiry, licensing body, clinical specialisms, shift types, referees, availability | |
| Support and care worker | 9 | live-in willingness, household preferences, training held, availability | anything about a licence |
| Non-clinical professional | 6 | function, seniority, salary expectation, notice period | shifts, availability, household |
| Student | 7 | school, course, year, expected graduation, placement window | licence, shifts |

Required documents by route: clinical = licence, CV, ID, qualification. Support = ID, CV or work history, two referees. Non-clinical = CV, ID. Student = student ID, course letter.

Route picker cards state the documents and the time cost before anyone starts. Time estimates shown: 8, 5, 4, 4 minutes.

---

## 6. Screen by screen

Each entry: what it is, then the acceptance criteria that decide whether Lovable built it correctly.

### 6.1 `/join` route picker
Four cards. Each card carries a plain-language definition, example job titles, a time pill, a "We will ask you for" list of document chips, and a primary button. Clinical is the emphasised card. Beneath: a tint bar offering WhatsApp help and stating the route can be changed later.

- Every card names its documents before the user commits.
- Support worker card explicitly says no licence is required.
- Non-clinical card says office based, no shifts or availability.
- Mobile shows the first card expanded and the other three as tappable rows.

### 6.2 `/join/:route/account`
Four fields only: first name, last name, email, WhatsApp number with a `+234` prefix control, password with a three-segment strength meter and a Show toggle. Right column, desktop only: "What happens next", three numbered steps, then a note that a person reads every profile. Mobile folds that to one tint bar above the button.

- The route is shown as a pill and can be switched from this screen.
- Email field is labelled as the sign in identity.
- Nothing else is asked here, no licence, no availability.

### 6.3 `/join/:route/verify`
Six digit code, sent on WhatsApp. Six separate inputs, resend countdown, and three fallbacks: send by SMS, email the code, change my number. Skippable, with the honest consequence stated.

- Copy states the number in full.
- Fallbacks are visible without expanding anything.
- Skipping is allowed and says offers cannot be sent until the number is confirmed.

### 6.4 `/join/:route/build/:step`
One question per screen. Desktop: navy rail on the left listing every question in the route with tick, current, and pending states, a count, and a progress bar. Answers save on every step. Every step offers "Do this later".

- The rail is generated from the route.
- Progress reads "Question 5 of 11", never a percentage alone.
- Multi-select questions state the consequence of leaving something out.
- Mobile puts the count and progress bar in the navy header, and the primary button in a sticky footer.

### 6.5 `/signin`
Full navy on mobile: white logo, translucent fields with `--navy-line` borders, white primary button, outlined "Email me a sign in link", and the join line pinned to the bottom.

- Password and magic link are both present, magic link second, under an "or" rule.
- Copy explains the link for anyone who never set a password.

### 6.6 `/portal` home
In order down the page: greeting, a status line with a dot saying whether we can put you forward, the "Looking for work" toggle card, then **one** navy next-action card, then the rest of the profile as rows with a real state each, then two quiet cards for offers and applications.

Three home states:
1. **Build incomplete.** Next-action card carries the next build question and the questions remaining.
2. **Blocked.** Next-action card carries the returned document, our reason, and the button that fixes it.
3. **Ready.** Next-action card becomes a keep-current card: confirm availability for the coming month, and the licence expiry countdown. It names what goes stale rather than congratulating anyone.

- No stat cards. No percentage. No zeroes.
- Sidebar badge appears only where something needs doing.
- Sidebar order: Home, Documents, Your availability, Work preferences, Offers, Applications, Your details.
- Mobile uses a four-item tab bar: Home, Documents, Availability, Offers.

### 6.7 `/portal/documents`
Returned document first, in a card bordered `--warn-line`, carrying: our reason with the date, a "What we need instead" wash block, and three actions (upload a new copy, see what we hold, ask us about this). Then the required list for the route, one row per document with a state. Then a dashed "Add a document" zone where the kind is chosen before the file. Then "Also on file" for anything extra.

- Accepted rows carry the date they were accepted.
- "Being checked" rows say there is nothing for the candidate to do.
- Optional rows say why the document is useful and that it is not required.
- Mobile primary action is "Photograph my ID" with "Choose a file instead" underneath.

### 6.8 `/portal/availability`
See section 7. This is the most-visited page, build it last and build it carefully.

### 6.9 `/portal/preferences`
A record of the build answers, not the form again. Three groups: the work itself, where you will travel, households you are comfortable with. Each row is question, answer, and one Change link that reopens that single build question. Empty rows say "Nothing added" and invite an addition, they never show a zero.

- Closing note: changes take effect immediately, and nobody is moved off a placement they are already on.

### 6.10 `/portal/offers`
An offer answers four things above the buttons: who the client is, when, where, and what it pays. A tint bar states why it was sent, generated from `matchReasons`. Reply-by date is a pill in the header. Below: earlier offers with the outcome written as a sentence.

Decline is a bottom sheet: six reasons, then a follow-up that offers to fix the preference which caused the mismatch, for example lowering a travel limit. Primary is "Send and decline".

- Decline sits beside accept as a plain secondary button, never hidden.
- Copy states that declining costs nothing, twice: on the list and in the sheet.
- Withdrawn offers say the client withdrew, not that the candidate failed.

### 6.11 `/portal/applications`
Each application carries a four-stage progress line (Applied, Read by our team, Interview, Decision) with dated text for what has happened and what happens next. An application needing something from the candidate is bordered `--warn-line` and carries the ask, the date it was asked, and the button.

- Never a bare "With our team" badge with no date.
- Closed applications state the outcome plainly.
- Anything still open can be withdrawn.

### 6.12 `/portal/details`
Two groups kept visibly apart:
1. **How we reach you.** Name, email, WhatsApp number with a Confirmed pill, location. All editable.
2. **Checked against your documents.** Profession, qualification, and their provenance ("From your CV", "Verified 21 Aug"). Not editable, with a route to ask for a correction. Self-declared fields inside this group, such as years of experience, stay editable.

Then settings: Looking for work toggle, where we send offers (WhatsApp cannot be switched off, say why), your route with a Switch link, password, and leave the network with the 30 day deletion statement.

---

## 7. The availability flow

Six steps. Build in this order.

**7a Empty.** One question on a card, "Which days are you available for work?", over a dimmed month. Never thirty empty tappable squares.

**7b Which days you are available.** Seven day rows. Three blocks per day, each labelled with its name and its hours. Weekly hours total in the footer. A day with nothing selected reads "Not available", it is not blank.

**7b2 Exact hours.** Blocks are the default; any single day can switch to exact hours with a From and Until control, at half hour steps, and up to three windows per day for split days. Mode is per day, not per profile: four days on blocks and one on exact hours is normal. The mobile time picker is a grid of half-hour chips, never a spinner. The footer total must equal the sum of what is drawn.

**7c Single date.** Tapping a date opens the day, not a mode. It names what the pattern says, allows a per-shift override, takes an optional note, and offers "Apply this to every Thursday instead". Primary button is "Save this date only". If the date is booked, the shift is locked and the only route is "Tell us you cannot make it", with a line saying telling us early never counts against anyone.

**7d Time off.** A date range with quick presets, an optional reason, and honesty about booked dates inside the range: they are held, not cleared, and we ask about cover. States how many available dates will be cleared.

**7e Confirm the month.** Asked once a month. A three-line summary (available shifts, already booked, time off) and one button. If ignored, the pattern stays in place and we ask again next week. We never quietly mark anyone unavailable.

**7f A month running.** Confirmed pill and the date confirmed, then four rows: your available days, booked, changed dates, time off. Plus a tint bar pointing at next month.

Month grid legend: Available (navy fill), Booked (tint fill, tint border), Not available (white, line border), Not answered (`#F4F1EA`, dashed border). Four states, each with a word next to it in the legend.

---

## 8. Copy that must be used verbatim

- "We cannot put you forward until your identity document is accepted."
- "Upload a clearer copy of your ID"
- "A photograph taken in daylight, with the whole card in frame, is enough."
- "Which days are you available for work?"
- "An unanswered day is not a no. We will ask again before putting you forward for it."
- "Nothing waiting on you"
- "Offers arrive on WhatsApp and here. Declining costs you nothing."
- "This never counts against you. It stops us sending the same thing again."
- "A person on our team reads every profile. We only put you forward once your documents are accepted, and we tell you before we do so."
- "You can skip this and confirm later, but we cannot send you offers until the number is confirmed."
- "We will find cover and confirm with you. Telling us early never counts against you."

Words to avoid in this product: "Complete your profile", "Profile strength", "You're 75% there", "Oops", "Congratulations", "appropriate" as a rejection reason, and any sentence that tells a candidate what they failed to do without telling them how to fix it.

---

## 9. Prompt sequence for Lovable

Send these one at a time. Check each against its acceptance criteria before moving on. Do not let Lovable scaffold all screens at once, it will invent stat cards and a percentage bar.

1. **Foundation.** "Set up Figtree, the token set in section 2, and the status pill vocabulary as reusable components. Build a `PageShell` with the navy sidebar from section 6.6 and a mobile tab bar. No content yet."
2. **Sign in and account.** Screens 6.5 and 6.2, including the full navy mobile sign in.
3. **Route picker and verify.** Screens 6.1 and 6.3, with the four route configs from section 5 as data.
4. **Guided build.** Screen 6.4, driven by a per-route question list. Save on every step, resumable, "Do this later" on each.
5. **Portal home, three states.** Screen 6.6. Build all three home states behind a switch so they can be reviewed together.
6. **Documents.** Screen 6.7, including the returned state as the default demo state.
7. **Preferences, applications, details.** Screens 6.9, 6.11, 6.12.
8. **Offers and decline.** Screen 6.10, including the decline sheet and the preference-fix follow-up.
9. **Availability.** Section 7, in the order 7a, 7b, 7b2, 7c, 7d, 7e, 7f.

After each prompt, ask Lovable to list any place it introduced a number, a percentage, a progress ring, or a red UI element, and remove them.

---

## 10. Open questions for the Medic Connect team

1. Are the three block definitions right? Morning 08:00 to 14:00, afternoon 14:00 to 20:00, night 20:00 to 08:00.
2. Is the monthly availability confirmation the right cadence, or should it be fortnightly?
3. Who writes the returned-document reason, and is it free text or a fixed list?
4. Can a candidate change route after documents have been accepted, and what happens to those documents?
5. Does the ₦35,000 needs assessment appear anywhere in the candidate experience, or is it purely client side?
6. Rate display on offers: is the candidate shown their own rate only, and is it ever a range?
