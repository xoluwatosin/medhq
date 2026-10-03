# Medic Connect, candidate experience: design guide

Paste this in as project knowledge before building anything. It is the visual contract. Anything not specified here should be resolved by looking at `Candidate Experience End to End.dc.html`, never by guessing.

---

## 1. The look in one paragraph

Warm off-white paper, one deep navy, and nothing else competing. Navy carries structure and the single most important action on any screen. Everything else is quiet: white cards on warm paper, hairline borders, generous space, and type doing the work. It should feel like a well-set document rather than a dashboard. If a screen looks busy, something has been added that should have been a sentence.

---

## 2. Colour

```css
--navy:        #26306B;  /* sidebar, headers, primary buttons, the one emphasis */
--brand-blue:  #3B4DC4;  /* links, inline actions, eyebrow labels */
--cobalt:      #1D34FF;  /* logo file only, never a UI surface */
--hot-red:     #FF2E2E;  /* logo cross, and unread count badges. Nothing else */
--tint:        #EEF1FF;  /* soft blue wash: info bars, selected chips, calm pills */
--tint-border: #C3CBF0;
--navy-line:   #4E58A0;  /* dividers and field borders on navy */
--navy-text:   #C9CFF4;  /* body text on navy */
--navy-dim:    #A8B0E8;  /* eyebrow text on navy */
--paper:       #FAF8F4;  /* page and card-shell background */
--desk:        #EDEAE3;  /* canvas behind cards */
--ink:         #1A1F2E;  /* headings */
--ink-2:       #2A3040;  /* strong body, field values */
--body:        #4A5164;  /* body copy */
--muted:       #6E7488;  /* labels, secondary meta */
--faint:       #8A8F9E;  /* placeholder, disabled, "nothing here" */
--line:        #DCD8CF;  /* card and field borders */
--line-soft:   #EDEAE3;  /* row dividers inside a card */
--warn-bg:     #FBF3E4;  /* "needs you" pill background */
--warn-ink:    #8A5A0F;  /* "needs you" text */
--warn-line:   #C98A16;  /* border of a card that needs the candidate */
--warn-wash:   #FBF7EE;  /* the "what we need instead" block */
```

Rules:

- **One navy per screen.** Navy appears as the sidebar or header, and as exactly one emphasis surface in the content. Two navy cards competing means the hierarchy is wrong.
- **No red in the candidate UI.** A returned document, a missed deadline, a declined offer: all amber or grey. Red is the logo cross and unread counts. The candidate is never in trouble.
- **No gradients, no glass, no coloured shadows.** Shadows are neutral and soft.
- **Amber means "you can fix this".** It is never used for a state the candidate cannot act on.
- **Grey means "no action, no failure".** Closed, declined, withdrawn, optional all sit in grey.

---

## 3. Type

Figtree throughout, weights 600 to 800 for headings and 600 to 700 for labels.

| Role | Size | Weight | Tracking | Colour |
|---|---|---|---|---|
| Page title, desktop | 27px | 600 | -0.03em | `--ink` |
| Page title, mobile | 22 to 24px | 600 to 700 | -0.028em | `--ink` |
| Emphasis card title | 24 to 25px | 600 | -0.025em | `--ink` or white |
| Section heading | 17.5 to 19px | 700 | -0.02em | `--ink` |
| Row title | 15 to 15.5px | 700 | normal | `--ink` |
| Body | 14.5 to 15.5px | 400 to 500 | normal | `--body` |
| Meta and labels | 13 to 14px | 600 | normal | `--muted` |
| Eyebrow | 11 to 12px | 800 | 0.14em, uppercase | `--brand-blue`, or `--navy-dim` on navy |
| Pill | 12 to 12.5px | 800 | normal | per status table |

Rules:

- Headings are **600, never 700 or 800**, and always negatively tracked. Heavy tracked-tight headings are the single fastest way to make this brand look wrong.
- Eyebrows are Figtree uppercase with tracking. Never monospace, never a coloured chip.
- Line height 1.5 to 1.6 on body copy, 1.12 to 1.25 on headings. `text-wrap: pretty` on every paragraph.
- Body copy blocks max out around 520 to 620px. Never full width.
- Sentence case everywhere except eyebrows. No Title Case Headings.
- Minimum body size 13px, and 13px only for meta. Nothing below that.

---

## 4. Shape, space, shadow

- Radii: controls and chips 9 to 11px, cards 14 to 16px, page shells 18px, phone frames 22px, pills 999px.
- Borders: `1px solid var(--line)` by default. `1.5px` when a card is selected or emphasised. Dashed `#C3BFB5` for a drop zone or an unanswered date.
- Shadows: `0 18px 40px rgba(26,31,46,0.08)` on a page shell, `0 12px 28px rgba(38,48,107,0.09)` on the emphasised card, `0 10px 24px rgba(201,138,22,0.08)` on a card needing action. Nothing else gets a shadow.
- Padding: desktop page shell 34px 38px, card 24px 26px, row 17px 22px. Mobile: 18px horizontal throughout, 14 to 15px inside cards.
- Gaps: 26px between screens, 18 to 22px between card groups, 12 to 14px between cards, 9 to 12px between stacked options.
- **Always flex or grid with `gap`.** Never margins between siblings, never inline spacing.

---

## 5. Components

### Status pills

| Words | Background | Text |
|---|---|---|
| Accepted, Done, Set, Confirmed, Being checked, Being reviewed | `--tint` | `--navy` |
| Needs you, Returned to you | `--warn-bg` | `--warn-ink` |
| Optional, Closed, Declined, Withdrawn | `#F1EFEA` | `--muted` |

6px 12px padding, 999px radius, 12.5px, weight 800. A pill is a state, never a link.

### Buttons

- **Primary**: navy fill, white text, 15 to 15.5px, weight 700, 14 to 15px vertical padding, 10px radius. On navy surfaces it inverts to white fill with navy text. One per screen.
- **Secondary**: white fill, `1px solid var(--line)`, ink text. On navy: transparent with a 1.5px white border.
- **Tertiary**: `--brand-blue` text, weight 700, no box. This is what "Change", "Edit", "Withdraw", "Ask us a question" look like.
- Mobile primary buttons are full width in a sticky white footer with a top hairline, 16px vertical padding.

### Cards

Three kinds, and no others:

1. **Quiet card.** White, `--line` border, 14px radius. The default.
2. **Emphasis card.** Navy fill or a 1.5px navy border with the blue shadow. Carries the single next action. One per screen.
3. **Action-needed card.** White with a 1.5px `--warn-line` border, and inside it a `--warn-wash` block with a 3px `--warn-line` left edge holding "what we need instead".

### Rows inside a card

`display: grid` with named columns, divided by `1px solid var(--line-soft)`, no divider on the last row. Pattern: title, then a plain-language sentence about the state, then a pill or a tertiary link on the right. Every row's middle column earns its place: it says something a pill cannot.

### Fields

White fill, `--line` border, 9px radius, 13 to 14px padding, value at 15px in `--ink`. Label above at 13.5px weight 700 in `--ink-2`. Helper text below at 13px in `--muted`. On navy: `rgba(255,255,255,0.08)` fill with a `--navy-line` border, white value, `--navy-dim` label.

### Navy surfaces

The sidebar, mobile headers, the emphasis card and the mobile sign in all use navy. Every navy surface may carry one `m-inf-soft.svg` at 0.12 to 0.15 opacity, oversized and bled off a corner, positioned absolutely behind the content. Never more than one per surface, never at full opacity, never as a decorative motif in the content area.

### Logo

`assets/medicconnect-logo-white.svg` on navy at 104 to 132px wide. Never the mark plus retyped words. Never recoloured.

---

## 6. Layout

**Desktop portal**: 244px navy sidebar, content area at 34px 40px padding, content column capped around 900px. Sidebar items 14.5px weight 600 in `--navy-text`; the active item is a white pill with ink text at weight 800. A `--hot-red` count badge appears only where something needs doing.

**Mobile**: navy header with back chevron, centred title, and at most one right-hand action. Four-item tab bar at the bottom. Content in a single column at 18px padding. The primary action lives in the sticky footer, not in the flow.

**Marketing and join pages**: navy top bar with the logo and nav, then warm paper. Two-column card grids on desktop, single column with the lead card expanded on mobile.

---

## 7. Non-negotiable UX rules

1. **One primary action per screen.** If two things look equally urgent, the screen has not been designed.
2. **Never show a zero.** No "0 offers", no "0 of 3". Write the sentence: "Nothing waiting on you."
3. **Never show a bare percentage.** "75% complete" is not an instruction. Name the next action.
4. **No stat card rows.** Counts belong on the row they describe.
5. **A rejection always carries three things**: the reason, what we need instead, and the button. In that order, in the first place the candidate looks.
6. **Empty is a sentence, not a blank.** An unanswered availability date reads "Not said". A day with nothing selected reads "Not available".
7. **An unanswered state is never a decline.** Say so out loud in the copy.
8. **Never blame the candidate.** State what happened and what fixes it.
9. **Locked is explained.** If something cannot be changed, say who it belongs to and give the route to ask.
10. **Progress is named, not measured.** "Question 5 of 11", never a ring.
11. **Sections are pages, not tabs.** Six equal tabs mean nothing is important.
12. **Touch targets 44px minimum**, and no primary action within 8px of another tappable thing.

---

## 8. Voice

Full sentences, plain nouns, second person. Say what happens next and who does it.

Write it like this:
- "We cannot put you forward until your identity document is accepted."
- "A photograph taken in daylight, with the whole card in frame, is enough."
- "An unanswered day is not a no. We will ask again before putting you forward for it."
- "Declining costs you nothing."
- "Telling us early never counts against you."

Not like this:
- Clipped labels: "Where you work", "Shifts you will take", "How far you travel". Use plain nouns: "Your location", "Shift types", "Travel distance".
- Vague states: "With our team", "In progress", "Pending". Add the date and what happens next.
- Rejections with no route out: "Not okay, upload appropriate".
- Cheer: "Congratulations", "You're all set!", "Oops".
- Progress theatre: "Profile strength", "You're 75% there".

Hard rules: two words, **Medic Connect**. No em-dashes. No middot separators, use a comma, spacing, or a thin vertical rule. No emoji. No HMO or insurance mentions, ever.

---

## 9. Self-check before shipping any screen

Answer all nine yes.

1. Is there exactly one navy emphasis surface?
2. Is there exactly one primary button?
3. Is every number on the screen a number the candidate cares about, and is none of them zero?
4. Does every state have a word next to it, not just a colour?
5. If something is blocked, are the reason, the fix and the button all visible without scrolling or expanding?
6. Is every heading weight 600 with negative tracking?
7. Is every group of siblings laid out with flex or grid and `gap`?
8. Is there any red that is not the logo cross or an unread count?
9. Could a nurse on a 5-inch phone with poor signal finish the one task this screen is for?
