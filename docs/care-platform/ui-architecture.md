# Medic Connect Care — UI Architecture

Revision 2, 12 September 2026. Supersedes Revision 1. Companion to `architecture.md` (system contract), `account-model.md` (identity and access) and `logic-review.md` (findings).

This is the single canonical UI implementation contract. It decides what each part of Medic Connect Care looks and feels like, what it inherits from, what is shared, and what stops the product becoming a mixture of unrelated interfaces. It is a lineage and behaviour document, not a style sheet.

---

## 1. Purpose and scope

Covers every non-marketing surface: Medic Connect staff administration, the assessor and care-worker workspaces, the client and family portal, the Care Fund module, and the shared component layer all four stand on. The public marketing site keeps its own register and is out of scope except where a care journey renders inside it.

A screen is only correctly built when a developer can answer the questions in section 22 from this document alone.

---

## 2. Existing UI systems and audit findings

### 2.1 Candidate Portal ("Cx")

**Where it lives.** `src/components/candidate/primitives.tsx` (`CxEyebrow`, `CxPill`, `CxButton`, `CxCard`, `CxFixBlock`, `CxRows`/`CxRow`, `CxField`/`cxInputClass`, `CxSection`, `CxEmpty`), plus the frames `CxShell.tsx`, `CxPortalPage.tsx`, `CxJoinShell.tsx`, `CxAuthShell.tsx`. Intent is written down in `docs/candidate-experience/design-guide.md`.

**What it feels like.** Calm and sentence-led. The person is addressed in plain language, one screen at a time. A fixed 244px navy rail on desktop; four tabs and a safe-area-aware navy header on mobile; one sticky action pinned above the tab bar. Information sits in hairline-divided rows (`CxRows` uses `divide-y divide-line-soft`, row padding `px-5 py-4 sm:px-[22px] sm:py-[17px]`), not in a field of cards. Amber appears only where something is owed (`CxCard kind="needs-you"`, `CxFixBlock`, `warn-bg`/`warn-ink`). Empty states are sentences, not illustrations.

**Done well.** Restraint. Four card kinds and three button ranks cover the whole portal. Colour is entirely token-based; a repo-wide scan found no raw Tailwind palette utilities in `src/components/candidate/*`, `src/components/portal/*` or `src/pages/portal/*`. Truncation and `min-w-0` are deliberate. Safe-area insets are handled. Tap targets are `min-h-11`.

**Done poorly.** The primitive set is incomplete: no dialog, select, checkbox or textarea, so `PortalPreferences.tsx`, `PortalDocuments.tsx`, `PortalContractDoc.tsx` and `JoinAccount.tsx` import shadcn directly and drift. Save state is hand-rolled in at least five pages. `PortalContractDoc.tsx:209` builds a conditional class with a template literal instead of `cn()`. The utility classes carrying real rules (`cx-heading`, `cx-chip`, `cx-control`, `cx-measure`, `cx-card-emph`) live in `index.css`, away from the components.

**Verdict.** The strongest non-admin foundation in the repository, and the parent for every portal surface. It is a foundation, not a finished family experience (section 12).

### 2.2 Admin / Match Universe

**Where it lives.** `src/components/admin/mu/MuShell.tsx` and `src/components/admin/console/*`.

`MuShell.tsx` holds three grammars authored at different times:

1. **Card grammar** — `MuPage`, `MuPageHeader`, `MuStats`, `MuSection`, `MuToolbar`, built on shadcn `Card`, so rounded stat tiles sit directly above square sections on the same page (`MatchUniverse.tsx`, `Workforce.tsx`).
2. **Record grammar** — `MuHero` (navy `bg-navy px-5 py-7`), `MuHeroStrip`, `MuTabRail` (sticky, `overflow-x-auto`, `min-h-[44px]`), `MuField`/`MuFieldGrid`, `MuTable`, `MuStatus`, `MuRecord`. This is the good one: dense, hairline-ruled, square, hierarchy from a navy hero and labelled facts.
3. **Ledger grammar** — `MuEyebrow`, `MuGroupHead`, `MuLedger`, `MuLedgerRow`, `MuDetailBlock`. Rows that stack cleanly on mobile. The right basis for any queue.

`src/components/admin/console/*` is a fourth set (`ConsolePageHeader`, `ConsoleTabs`, `ConsoleTable`, `ConsoleRecordCard`) used only by `Clients.tsx` and `ClientRecord.tsx`, solving the same four problems with different tokens (`border-line-soft` vs `border-line`, `text-sm` vs `text-[14.5px]`, `min-h-11` vs `min-h-[44px]`).

**Done poorly.** Three page-title typographies (serif bold 2xl/3xl in `MuPageHeader`, sans 2xl navy in `ConsolePageHeader`, 26px white on navy in `MuHero`). Four eyebrow label styles. Five independent status colour maps: `MuShell.tsx` `TONE_CLASS`, `Clients.tsx:60`, `Workforce.tsx:28`, `Applications.tsx:33`, `CreatorApplications.tsx:29`. Seven hand-rolled `toLocaleDateString` variants plus `date-fns` in `Enquiries.tsx`. Twenty-four repetitions of raw shadcn `Select` trigger boilerplate. Two state-and-LGA implementations in the same folder (`Clients.tsx:268-292`, `Workforce.tsx` `StateSelect`/`LgaSelect`). Five detail-rail widths (200/240/260/300/320px). `MatchUniverse.tsx`'s raw table drops columns at breakpoints rather than reflowing.

**Verdict.** The record and ledger grammar is the visual parent for Care administration. The card grammar and `console/*` are debt.

### 2.3 Care and pre-assessment

`PreAssessment.tsx` plus `CareFieldInput.tsx` is the most complete field behaviour source in the project: long text, number, date, phone, address, language, LGA, person name, relationship, confirm/amend, checkbox, choice, budget band, multi, upload. `ConfirmAnswer` (prefilled "yes that's right / no, change it") belongs everywhere. It is isolated: admin rebuilds state/LGA and relationship with shadcn selects over the same data, and the public `CareRequestDialog.tsx` has a third control set (`RequestShell`, `DialCodeField`, `Choice`). `upload` renders instructions only; there is no file input anywhere in the care path. Autosave debounces 900ms and clears `pending.current` before the network call resolves; the indicator is the single word "Saving" or "Saved".

### 2.4 Public site

`MedicHeader`, `Footer`, `ServiceFlipCard`, `KitFlipCard` and the `kit-curve*` shape grammar. Marketing voice, half-rounded corners, hero-red for prices only. A separate register that stays separate. Nothing in Care inherits from it except the brand marks and the header and footer on public care-request pages.

### 2.5 Care Fund (separate project `Remix of MEDIC CONNECT CARE`)

Its own palette: pastel peach, lavender and mint, `--wallet-red/pink/teal/amber`, `--radius: 1rem`, `rounded-3xl` gradient wallet cards, serif 5xl centred balance, DM Sans and Crimson Pro rather than Figtree. Own `BottomNav` with a red active state. Components: `WalletCard`, `WalletStack`, `PotCard`, `TotalSavedHero`, `PotStatsDonut`, `AddMoneySheet`, `WithdrawSheet`, `SharePotSheet`, `PublicGiftSheet`, `AddItemSheet`, `AddEventSheet`, `RegistryItemCard`, `ActivityRow`, `QuickActions`, `UpcomingCalendar`.

**Worth retaining:** the interaction model. Bottom sheets for contribute, withdraw and share; the public contribution page as an unauthenticated link; the activity row as the canonical transaction line; a single prominent balance; quick actions under the balance; a contributor list that names people.

**Do not import:** the palette, gradients, 3xl radii, donut, serif numerals, separate bottom nav, fonts.

**Verdict.** Port the logic (`src/lib/pots.ts`, Paystack functions, virtual accounts, gift links) and the interactions. Rebuild the skin on Cx.

---

## 3. Design principles

1. One product, one foundation, three dialects. Density and chrome differ; typography, colour, fields and status vocabulary do not.
2. Hierarchy comes from placement, grouping, labels, weight, alignment, rules and meaningful contrast. Not from making things larger.
3. The interface states the system's real knowledge. No generic spinner where a semantic state exists; no disabled control without a reason.
4. Behaviour belongs to shared components, never to pages. A responsive or accessibility failure is fixed once, in the component that owns it.
5. Copy does not compensate for structure. If a screen needs a paragraph to be understood, the structure is wrong.
6. Clinical and safety information is never visually demoted, and never competes with decoration.

---

## 4. Visual ownership by audience

| Surface | Parent system | Register |
| --- | --- | --- |
| Client and family | Cx foundation plus care-specific patterns (section 12) | Calm, sentence-led, high trust, low density |
| Assessor and care worker | Cx, task-focused, offline-aware | Same skin, fewer choices, one next step |
| Medic Connect staff | Mu record and ledger grammar | Operational, dense, tabular, neutral |
| Care Fund | Cx, with one expressive allowance | Clear figures, calm chrome |

A staff member who opens the family portal should recognise every control and simply see fewer things per screen. A professional never enters a second Medic Connect application: the portal is one shell, and capability and context change what is inside it.

---

## 5. Shared UI foundation

One field and state layer at `src/components/field/*`, used by admin, portal and public care forms alike. `CareFieldInput` becomes a thin renderer mapping a form definition field type onto these components.

**Promote (exists, move and generalise):** `AddressField` (from `portal/AddressAutocomplete`), `LanguageField` (from `portal/LanguagePicker`), `StateLgaField` (from `CareFieldInput` `LgaAnswer`), `PersonNameField`, `RelationshipField`, `ConfirmAmendBlock`, `Choice`, `MultiChoice`, `Checkbox`, `Status` (from `MuStatus`), `TagPicker`.

**Consolidate (duplicated today):** `DateField` (seven hand-rolled formats plus raw `input[type=date]`), `PhoneField` (three implementations: `CareFieldInput.tsx:63`, `DialCodeField`, ad-hoc admin inputs), `Select` and `SearchableSelect` (twenty-four raw shadcn triggers), `SaveState` (five hand-rolled `saving` booleans), `Table` (`MuTable` vs `ConsoleTable`), `formatDate` and `formatPhone`.

**Build (nothing exists):** `TimeField`, `DateTimeField`, `MoneyField`, `WhatsAppField`, `VocabularyField`, `SegmentedControl`, `MultiSelect`, `FileUpload`, `MediaCapture`, `SyncState`, `OfflineState`, `PersonPicker` / `AssessorPicker` / `WorkerPicker`, `WorkItem`, `ActivityItem`, `DocumentRow`.

Cx gains the four missing primitives so no portal page imports shadcn directly: `CxDialog`, `CxSelect`, `CxTextArea`, `CxCheckbox`.

---

## 6. Shared component behavioural contracts

Every component below must define and be reviewed against all of: **source of truth · width · overflow · responsive behaviour · focus · validation · error · disabled · read-only · loading · keyboard · touch target · long labels · long values · missing data · offline behaviour where relevant · accessibility behaviour.**

Universal rules, true of every control unless stated otherwise:

- **Width.** Fills its container. A control never sets its own width.
- **Overflow.** Popovers, menus and pickers are constrained to the viewport, never wider than `100vw - 16px`, and fall back to a full-width sheet below 768px.
- **Focus.** A visible token-based ring, never `outline: none` without a replacement.
- **Error.** Message below the control, linked by `aria-describedby`, never a tooltip and never colour alone.
- **Disabled.** Renders its reason adjacent or on focus. Read-only is visually distinct from disabled.
- **Loading.** Skeleton or inline state on the control, not a page spinner.
- **Touch target.** 44px minimum; 36px permitted only in dense admin tables with a 44px hit area.
- **Long labels and values.** Labels wrap; single-line values truncate with the full value available on focus and hover.
- **Missing data.** "Not answered" or "Not recorded", never a blank cell.

| Component | Source of truth | Contract notes beyond the universal rules |
| --- | --- | --- |
| `TextField` | form value | Single line. Trims on blur, never on keystroke. |
| `TextArea` | form value | Auto-grows to eight rows then scrolls. Character guidance only where a limit is real. |
| `DateField` | ISO date string | Owns the calendar overflow fix: viewport-constrained popover, full-width mobile sheet, typed entry always available, locale-independent parse. Never patched per screen. |
| `TimeField` | 24h string | Minute step configurable; keyboard entry primary. |
| `DateTimeField` | ISO timestamp | Composes `DateField` and `TimeField`; one label, one error. |
| `PhoneField` | E.164 plus separate country | One implementation. Dial-code picker searchable by country name and code. |
| `WhatsAppField` | E.164 | `PhoneField` plus a same-as-phone toggle. |
| `AddressField` | free text plus optional place reference | Token-authenticated suggestions, clean typed fallback when lookup is unavailable, never blocks submission. |
| `StateLgaField` | vocabulary codes | State drives LGA; clearing state clears LGA and says so. |
| `LanguageField` | vocabulary codes | Multi-select, searchable, ordered by frequency then alphabet. |
| `VocabularyField` | `vocabulary_terms` | Generic governed list; retired terms display but are not selectable. |
| `MoneyField` | minor units, integer | One formatter shared with invoices and the Fund. Currency rendered, never typed. |
| `PersonPicker` / `AssessorPicker` / `WorkerPicker` | person records | Search by name, phone or reference; shows disambiguating detail for similar names; never returns an id the caller cannot see. |
| `Select` | option list | Replaces raw shadcn triggers. Ten or more options escalate to `SearchableSelect`. |
| `SearchableSelect` | option list | Keyboard-first; results announced to screen readers. |
| `MultiSelect` | option list | Selected items shown as removable chips above the control, not inside it. |
| `Radio` / `Choice` | option list | Full-width stacked targets below 768px; arrow-key roving focus. |
| `SegmentedControl` | two to four options | Degrades to `Radio` below 480px or when any label exceeds twelve characters. |
| `Checkbox` | boolean | Label is the target. Consent checkboxes never pre-checked. |
| `FileUpload` | storage object | Real input. Type and size stated before choosing, progress shown, failure retryable, offline queued. Replaces the current guidance-only placeholder. |
| `MediaCapture` | storage object | Camera-first on mobile with gallery fallback; local preview before upload; queues offline. |
| `SaveState` | device and network acknowledgement | Never shows "Saved" before acknowledgement. Renders in a polite live region. |
| `SyncState` | sync queue item | Per item, with queued count and retry. |
| `OfflineState` | connectivity plus queue depth | Persistent, quiet, never modal. |
| `ConfirmAmendBlock` | prefilled answer | The `ConfirmAnswer` pattern generalised: confirm keeps provenance, amend opens the field with the prior value visible. |
| `Status` | domain state | One chip, one tone map, project-wide. Meaning carried in text as well as tone. |
| `ActivityItem` | activity record | Canonical event line for admin activity, portal updates and Fund transactions. |
| `WorkItem` | work engine item | Title, subject, due, owner, blocked reason. Next action never invented by the page. |
| `DocumentRow` | document record | Name, kind, version, state, issued date, action. Superseded versions link forward. |

---

## 7. Design tokens

Single source of truth: `src/index.css` `:root` and `tailwind.config.ts`.

- **Font.** Figtree throughout. Retire the `serif` alias (it is the sans stack with different fallbacks) and confine `handwritten` (Caveat) to the blog.
- **Type scale.** 11, 12.5, 13.5, 14.5, 15, 17, 19, 22, 26, 30. Weights 400, 600, 700, 800. Tracking: -0.03em at 26px and above, -0.01em at 15 to 22px, 0 for body, 0.12em for eyebrows.
- **Colour.** navy `--navy`; `--brand`, `--brand-soft`; `--tint`; warm page `--desk`; card white; text `--ink`, `--ink2`; muted `--body`, `--label`, `--faint`; borders `--line`, `--line-soft`, `--hairline*`; warning `--warn-bg/ink/line/wash`; error `--destructive`; success `--status-green`; `--price` (prices only).
- **Radii.** One scale. `--radius: 0` for admin and portal surfaces; `kit-curve*` reserved for the public site. Retire the `admin-kit` remapping of `rounded-*`.
- **Shadows.** Two: a hairline-replacement `shadow-xs` for the shell, and a sheet/popover shadow. Retire the generated `--shadow-*` ladder.
- **Spacing.** 4px base. Row 17/22, section gap 26, page gutter 18 mobile and 24 desktop.
- **Widths.** 620px reading measure, 960px portal page, full width admin tables. Container max 1400.
- **Control heights.** 44px standard, 36px dense admin only.
- **Retire.** `--tag-*`, `--chart-*`, `--spacing`, `--tracking-normal`. **Fix:** raw `rgba()` in `.pill-nav`/`.pill-nav-on-navy` and the `#fff` literals in the `admin-kit` sidebar rules.

---

## 8. Colour and status semantics

One meaning per colour, everywhere. Colour never carries meaning alone; each row below also carries text or a mark.

| Meaning | Rendering |
| --- | --- |
| Normal | `ink` on white or `desk` |
| Selected or active | navy fill, or navy 1.5px border |
| Complete | `tint` background, navy text |
| Needs action | `warn-bg` / `warn-ink`, `warn-line` border |
| Warning | same amber, with the rule named in text |
| Clinical or safety concern | `warn-ink` on `warn-wash` with a leading mark; the only place a stronger weight is used |
| Error | `destructive`, message text, never a whole-row fill |
| Offline | grey chip with a slashed-cloud mark |
| Syncing | grey chip with motion, no colour change |
| Disabled | 50% opacity plus a reason |
| Unread | a small navy dot, never a row colour change |

Everything else is grey. A new status never justifies a new hue.

---

## 9. Admin UI grammar

Parent: `MuHero` + `MuHeroStrip` + `MuTabRail` + `MuField`/`MuFieldGrid` + `MuTable` + `MuLedger*` + `MuStatus`.

- One navy hero per record, carrying identity, reference, stage, owner, next action and due. Nothing else may be a hero.
- Facts are labelled `MuField` entries in a grid, not one card each. Nothing gets a card unless it has its own actions.
- No summary tile row unless the number changes a decision. `MuStats` is retired.
- Tables are `MuTable` with `table-fixed` plus a mobile companion list, never column-dropping.
- Queues are `MuLedgerRow`, not tables.
- One page title style, one eyebrow style, one chip.
- Detail rails use one of two widths: 280px navigation, 340px inspector.

---

## 10. Assessor and care-worker UI grammar

Inherits Cx directly: `CxShell` frame, `CxPortalPage` page, `CxRows` lists, `CxCard kind="emphasis"` for the thing in front of you, the sticky footer action for the single next step, `CxPill` for status.

Added, and only this:

- **Offline chrome.** A persistent sync indicator in the header slot and a per-item `SyncState` on anything captured away from signal. Never a bare spinner.
- **Sectioned capture.** The assessor assessment is `PreAssessment.tsx`'s one-question rhythm grouped into named sections with a `ConfirmAmendBlock` per section, so a section can be completed, confirmed and left.
- **Visit chrome.** Arrive, tasks, notes, leave, escalate. All `CxRows` with one sticky action.

Professional surfaces live under the Work context (section 13) and never borrow family care patterns.

---

## 11. Client and family UI grammar

Cx is the foundation, not the whole experience. The family portal takes from Cx: shell, navigation behaviour, spacing, controls, rows, cards, action hierarchy, status treatments, mobile behaviour and responsive conventions. It develops its own care patterns on top, because the Candidate Portal has no need of them:

- **Care journey.** A compact vertical list of `CxRow`s: enquiry received, callback completed, pre-assessment submitted, assessment booked, assessment completed, care plan being prepared, care being set up. Completed states tinted, current state emphasised, future states quiet. Not a horizontal stepper, which breaks at 320px and cannot carry dates.
- **Current and next care.** What is happening now and what happens next, stated once, above everything else.
- **Active care recipient.** Always visible, never inferred from the page (section 14).
- **Visit context.** Who is coming, when, what was done, what changed.
- **Care team context.** Named people with role and, where permitted, a way to reach coordination rather than the individual.
- **Upcoming care.** A forward view, not a calendar widget.
- **Family updates.** A readable feed of `ActivityItem`s scoped to what the grant allows.
- **Pre-care versus active-care.** The same Home component in the same position with different content. Before care it is the journey plus what is owed; during care it is today's visits, who is with the client, the next review and anything owed, with the journey collapsing to a single "care running since" line inside Care.
- **Payment and Fund context.** What is owed and what the Fund covers, surfaced on Home only when action is needed.

The result must feel like one Medic Connect product and never like the Candidate Portal with different labels. Copy discipline holds: the state names carry the explanation.

---

## 12. Care Fund integration

Optional per client, and substantial when enabled. It may carry available care balance, contributions, named contributors, shareable contribution links, pots where appropriate, allocation against invoices, transaction history, paying care costs and contribution activity.

- **Chrome.** Cx. Navy, square, Figtree, hairline rows.
- **The one allowance.** The balance is set at the largest type size used anywhere in the portal, and contributions may carry a single accent tint. Nothing else in the Fund gets special colour.
- **Retained interactions.** Bottom sheets for contribute, withdraw and share; unauthenticated contribution links; activity rows; named contributor list; clear balance treatment; quick actions under the balance; allocation of fund money against an invoice.
- **Not imported.** Fund palette, wallet gradient cards, 3xl radii, serif numerals, separate bottom nav, donut.
- **Rebuilt shared.** `MoneyField` and `ActivityItem` are shared components used by admin invoices and family finance too.

Opening Fund must feel like moving rooms, not buildings.

---

## 13. One identity, Work and Care contexts

The same Medic Connect identity may simultaneously be a candidate, an assessor, a care worker, a client, a parent or guardian, and an authorised family representative. One login and one identity remain sufficient. Professional and personal care never share a navigation.

Two top-level contexts:

- **Work.** Professional profile, assessments, visits, assignments, professional documents, offers.
- **Care.** Own care, a child's care, a parent's care, family-supported clients, visits, care plans, payments, Fund, updates.

| Question | Behaviour |
| --- | --- |
| Desktop switching | A context control at the top of the navy rail, above the groups. Switching replaces the rail groups, never appends to them. |
| Mobile switching | A control in the header slot, not a tab. The four tabs belong to the active context. |
| When shown | Only when the person holds both a professional capability and at least one care grant. A single-context person never sees it. |
| Deep links | Every route declares its context. Opening a link switches context automatically and says so once in the header. |
| Notifications | Carry their context and target profile, and open directly in it. |
| Remembered | Last active context is remembered per device and restored on sign-in. Ties break to Care. |
| Context lost | If the last capability or grant in a context is revoked, the switch disappears and the person lands in the remaining context with one plain sentence explaining the change. Never a dead tab. |
| Leak prevention | Professional access to a client is scoped to assignment and never appears in Care. Family access is scoped to a grant and never appears in Work. If the same identity holds both for the same client, the two views stay separate, each shows only its own scope, and neither links to the other. |

---

## 14. Multi-client care profiles

One account may manage several care recipients from day one: own care, one child, several children, one parent, both parents, or own care alongside family care. Each remains a separate clinical record. Routing and UI assume many, even while a richer dashboard comes later.

| Question | Behaviour |
| --- | --- |
| Where the active recipient appears | In the portal header slot on every Care screen, as name plus relationship. Never only on Home. |
| Desktop switching | A profile control in the header slot opening a list with name, relationship and care state. |
| Mobile switching | The same control, opening a full-width sheet. Never a tab and never a fifth navigation item. |
| Deep links | Routes carry the care profile. A link always opens its own profile, switching the active profile and stating it once. |
| Notifications | Target a profile and open it directly. |
| Refresh | The active profile survives refresh; it is part of the route, not only of memory. |
| Default | The single profile when there is one; otherwise the last used, then the one with active care, then alphabetical. |
| Revoked access | The profile disappears from the switcher, any open view returns to the default profile with one sentence explaining it, and cached data for that profile is cleared. |
| Only one profile | The switcher is a static name in the header, not a control. |
| Account holder is also a client | Their own care is one profile among the others, labelled as their own care, never merged with the account. |
| Long or similar names | Names truncate with the full name on focus; identical or similar names disambiguate by relationship and date of birth. |
| Leak prevention | Every query and every cache key is scoped by profile. Switching clears profile-scoped state before rendering. No screen reads a client id from anywhere but the active route. |

---

## 15. Navigation architecture

Mobile is always four tabs. Capability and context change the four, never add a fifth.

```text
Admin desktop        Rail groups: Work · Care (Clients, Assessments, Plans, Packages,
                     Visits, Reviews) · Match Universe · Workforce · Marketing ·
                     Finance · Configuration
Admin mobile         Triage only: Work · Clients · Search · Account
Candidate only       Home · Profile · Offers · Account
Candidate + assessor Home · Work · Profile · Account
Care worker          Home · Visits · Work · Account
All three            Home · Work · Profile · Account   (Work groups visits and assessments)
Client before care   Home · Care · Updates · Account
Client during care   Home · Visits · Care · Account
Client, no Fund      Home · Visits · Care · Account    (payments inside Care)
Client, with Fund    Home · Visits · Care · Fund       (payments inside Fund)
Both contexts        Context switch in the header or rail; each context keeps its own four tabs
```

Desktop uses the navy rail with grouped headings, so ten destinations read as three or four groups. Professional capabilities group under Work; family and client capabilities stay under Care. A person with both switches context rather than receiving one overloaded navigation.

---

## 16. Information hierarchy

Hierarchy comes from placement, grouping, labels, weight, alignment, rules and meaningful contrast, not from making things larger. Avoid card-per-fact interfaces.

**Admin record, in order.** Identity · allergies · emergency information · case stage · next action · owner · due · clinically significant flags. Then requested service · assessment state · care package · active care-plan version · contacts · assigned professionals · visits. Then contextual metadata: dates, source, provenance, history, small and muted or inside Activity.

Rendering: hero carries identity, stage, owner, next action and due; the hero strip carries allergies and emergency information in a fixed position; Overview carries the second tier as `MuFieldGrid` facts under `MuGroupHead` rules.

**Client and family screens, in order.** Whose care is this · where are we in the journey and what is happening now · what happens next · what do I need to do · what has recently happened. Once each, in that order.

---

## 17. State and feedback vocabulary

Carried by `SaveState`, `SyncState`, `OfflineState` and `Status`.

| State | Rendering | Source |
| --- | --- | --- |
| Entered | no indicator | local form state |
| Saved on device | "Saved on this device" with device mark | IndexedDB write acknowledged |
| Waiting to sync | "Waiting to send" with queued count | sync queue depth |
| Queued | "Queued" on the individual item | sync queue item |
| Synced | "Saved" with a timestamp | server acknowledgement |
| Sync failed | "Not sent", reason, retry action | failed queue item |
| Offline | persistent quiet chip | connectivity |
| Submitted | `Status` chip, quiet | document state |
| Under review | `Status` chip, quiet | document state |
| Returned | `Status` chip, needs-action tone | document state |
| Accepted | `Status` chip, complete tone | document state |
| Superseded | `Status` chip, grey, link to current version | document version chain |
| Newer version available | inline notice with a link, never an automatic replace | version chain |
| Action blocked | action disabled with the blocking reason stated | work engine or permission |

Rules: no shared spinner where a semantic state exists; a disabled action always renders its reason; a warning always names the rule behind it; status always derives from domain state, never a UI flag; the next action always comes from the work engine; read-only always reflects real document and permission state.

---

## 18. Accessibility standard

Medic Connect Care targets **WCAG 2.2 AA**. Accessibility is part of the component contract in section 6, not a per-screen afterthought.

- **Contrast.** 4.5:1 body text, 3:1 large text and meaningful non-text elements, including chip text on tinted backgrounds and placeholder text.
- **Keyboard.** Every action reachable and operable by keyboard. No keyboard trap. Roving focus in radio groups, segmented controls and tab rails.
- **Visible focus.** A token-based ring on every focusable element, never removed, never obscured by sticky headers or footers.
- **Focus order.** Follows reading order. Sticky actions are in the flow, not appended at the end of the document.
- **Headings.** One `h1` per screen, no skipped levels, sections labelled.
- **Accessible names.** Every control and icon-only button has one. Labels are programmatically associated with controls; placeholders are never labels.
- **Errors.** Linked to the control with `aria-describedby`, announced, and described in words rather than by colour or position.
- **Non-colour meaning.** Every status carries text or a mark as well as tone.
- **Motion.** Honour `prefers-reduced-motion`; the sync indicator falls back to a static state.
- **Zoom and scaling.** Usable at 200% zoom and at 320px width without loss of content or function; no horizontal scrolling of the page body.
- **Screen readers.** Landmarks on shell regions, one `main` per route, list semantics for lists, table semantics with header cells and captions for tables.
- **Touch targets.** 44px minimum, with adequate spacing between adjacent targets.
- **Modals, drawers and sheets.** Focus moves in, is trapped while open, returns to the trigger on close, and Escape always closes.
- **Live regions.** Save, sync and offline state announce politely; errors announce assertively. Nothing else takes a live region.

---

## 19. Responsive standards

320px remains the failure floor and the acceptance test. Behaviour is defined across five bands and owned by shared components, never patched per page.

| Band | Width | Frame |
| --- | --- | --- |
| Narrow mobile | 320 to 479 | Single column, 18px gutter, four tabs, sticky primary action |
| Large mobile | 480 to 767 | Single column, roomier rows, sheets still full width |
| Tablet | 768 to 1023 | Two-column fact grids, sheets become side drawers, tab rail scrolls |
| Compact desktop | 1024 to 1279 | Navy rail, one detail rail at 280px, tables with horizontal scroll |
| Full desktop | 1280+ | Rail plus inspector at 340px, full tables, split panes |

| Pattern | Behaviour |
| --- | --- |
| Tables | Below 768px a table becomes a stacked row list with the same data; columns are never dropped. Above 768px `table-fixed` with horizontal scroll and sticky first column. |
| Ledgers | Rows stack at every width; the detail block moves below the row under 768px. |
| Side rails | Below 1024px a rail becomes a drawer opened from a header control; above, it is fixed at 280px or 340px. |
| Tab rails | Horizontally scrollable with the active tab scrolled into view, never wrapped to two lines. |
| Fact grids | One column below 768px, two to 1279px, three above. |
| Forms | Single column always; two columns only for genuinely paired fields (date and time) above 768px. |
| Split panes | Collapse to a single pane with a back control below 1024px. |
| Side panels and drawers | Full-width sheets below 768px, side drawers above. |
| Sticky actions | The primary action becomes sticky below 768px, above the tab bar and inside the safe area. |
| Page actions | Secondary actions collapse into an overflow menu below 768px; destructive actions are never hidden there without a confirm. |
| Long labels and values | Labels wrap; values truncate with focus and hover revealing the full value. |
| Alerts | Inline at the top of the affected region on narrow screens, never floating over content or covering the sticky action. |
| Document readers | Section navigation becomes a sheet opened from a sticky control below 768px; a side contents list above. |
| Care-profile switcher | Header sheet below 768px, header menu above. |
| Work and Care switching | Header control below 1024px, rail control above. |

---

## 20. UI lineage

Each new screen starts from the ancestor below. Where the honest answer is that no good ancestor exists, that is stated rather than forcing reuse.

| Screen | Starting point |
| --- | --- |
| Work queue | `MuLedger` / `MuLedgerRow` |
| Client list | `Clients.tsx`, refactored from `ConsoleTable` onto `MuTable` |
| Client record | `ClientRecord.tsx` with `MuHero` + `MuTabRail` + `MuFieldGrid` |
| Assessment queue | `MuLedger`, as the work queue |
| Assessor briefing | `CxPortalPage` + `CxCard kind="emphasis"` |
| Assessor assessment | `PreAssessment.tsx` section pattern + `ConfirmAmendBlock` |
| Care plan editor | No suitable ancestor. New, from `MuRecord` sections and `MuGroupHead` |
| Package editor | No suitable ancestor. New, from `MuFieldGrid` plus `MoneyField` |
| Assignment | `MatchUniverseRequest.tsx` matching pattern, rebuilt on `MuTable` |
| Care worker home | `CxShell` + `CxRows` |
| Care worker visit | `CxPortalPage` + sticky action + offline and sync chrome |
| Client/family home | Cx foundation plus the care journey and active care profile patterns (section 11) |
| Client/family visits | `CxRows` |
| Client/family care plan | Dedicated issued-care-plan renderer (below), informed by `PortalContractDoc.tsx` reading behaviour only |
| Client/family payments | Family-specific Cx finance composition using shared invoice and money logic (below) |
| Care Fund | Fund interaction patterns rebuilt on Cx; skin not imported |
| Configuration / Form Library | `EnquirySetup.tsx` + `QuestionBuilder.tsx` |

**Issued care plan reader.** A dedicated renderer, not the contract viewer. `PortalContractDoc.tsx` informs document reading behaviour, scroll structure, section navigation and print and download patterns; it does not supply the composition. The reader prioritises the canonical fourteen sections in order: front sheet including allergies and emergency information; what we are trying to achieve; the day; the week; personal care; moving about; skin, food and continence; medicines; how to be with this person; risks and what we do about them; boundaries; who is coming; review; agreement. The front sheet is always first and always reachable in one action from any point in the document. Clinically urgent information is easy to locate without the document becoming a dashboard: it stays a document, with navigation around it.

**Family payments.** Reuse invoice calculation, money formatting, invoice state, due dates and payment domain logic. Do not transplant admin invoice composition. The family view answers, in this order: what do I owe, what is this charge for, when is it due, what have I already paid, is there any action required. Rendered in Cx rows with `MoneyField` formatting and, where the Fund is enabled, the allocation shown against the charge.

---

## 21. Existing UI debt

Clear before building new Care screens.

1. `src/components/admin/console/*` — fold into `Mu*`; retire after `Clients.tsx` and `ClientRecord.tsx` migrate.
2. `MuStats` and the shadcn `Card` import in `MuShell.tsx` — retire.
3. Five status colour maps — `MuShell.tsx` `TONE_CLASS`, `Clients.tsx:60`, `Workforce.tsx:28`, `Applications.tsx:33`, `CreatorApplications.tsx:29` — into one `Status`.
4. Seven date formats plus `date-fns` in `Enquiries.tsx` — one `formatDate`, one `DateField`.
5. Two state-and-LGA implementations — `Clients.tsx:268-292` and `Workforce.tsx` `StateSelect`/`LgaSelect` — into `StateLgaField`.
6. Three phone implementations — `CareFieldInput.tsx:63`, `DialCodeField`, admin inputs — into `PhoneField`.
7. Twenty-four raw shadcn `Select` triggers — into `Select` and `SearchableSelect`.
8. Five hand-rolled `saving` booleans in the portal — into `SaveState` and `useAutosave`.
9. Four portal pages importing shadcn directly — add `CxDialog`, `CxSelect`, `CxTextArea`, `CxCheckbox`.
10. `MatchUniverse.tsx` raw table — drops profession and verification on mobile. Move to `MuTable` plus a mobile list.
11. `MatchUniverseOpportunities.tsx`, `MatchUniverseRequests.tsx` — wide tables with no overflow guard.
12. `ConsoleTable` hides itself below `md` with no enforced mobile companion.
13. Five detail-rail widths — to two.
14. `AvailabilityDetail.tsx` mixes `rounded-md`, `rounded-sm`, `rounded-full`; `WorkPanel.tsx` uses `rounded-xl` found nowhere else.
15. Dead tokens and raw literals in `index.css` (section 7).
16. `PortalContractDoc.tsx:209` template-literal class instead of `cn()`.
17. Pre-assessment autosave clears its buffer before acknowledgement and shows one word of state.
18. `upload` renders guidance only; there is no file input in the care path.

Safe as templates today: `MatchUniversePerson.tsx` (record), `PortalAccount.tsx` (portal page), `PreAssessment.tsx` (capture), `ClientRecord.tsx` after the Console merge. Not safe until refactored: `MatchUniverse.tsx`, `Workforce.tsx`, `Enquiries.tsx`.

---

## 22. Keep, refactor, retire

**Keep exactly.** Cx primitives. The `CxShell` navigation model, including the four-tab rule and sticky action. `MuHero`, `MuHeroStrip`, `MuTabRail`, `MuField`, `MuFieldGrid`, `MuTable`, `MuLedger*`. `MuStatus`. The `ConfirmAnswer` / confirm-amend pattern. The public site's own register.

**Keep conceptually, refactor underneath.** `Clients.tsx`. `ClientRecord.tsx`. `CareFieldInput.tsx`. Autosave behaviour. Useful document-reading behaviours in `PortalContractDoc.tsx`. The Care Request journey.

**Reuse in Care.** Cx shell, rows, cards and buttons. Mu ledger, table and field. Existing matching patterns. Form Builder patterns. Care Fund interactions.

**Do not reuse.** Fund visual palette. Fund wallet-card skin. The Fund donut merely because it exists. Fund bottom nav. `MuStats`. Page-local status maps. Public marketing flip cards in application UI.

**Replace or retire.** `src/components/admin/console/*` after migration. Page-specific date formatting. Duplicate phone controls. Duplicate state and LGA controls. Duplicate `Select` styling. Duplicate save-state logic. The upload placeholder copy, replaced by a real `FileUpload`.

---

## 23. Implementation guardrails

- Do not create a new field if a canonical field exists.
- Do not create a new status colour map.
- Do not implement date formatting page by page.
- Do not style raw shadcn primitives independently on each screen.
- Do not create another portal shell without architectural justification recorded here.
- Do not import the Care Fund skin into the care portal.
- Do not make derived state editable.
- Do not visually demote critical clinical information.
- Do not hide save, sync or offline state.
- Do not patch a responsive failure locally when the shared component is wrong.
- Do not create unnecessary cards.
- Do not enlarge UI solely to manufacture hierarchy.
- Do not use helper copy to compensate for weak information architecture.
- Do not assume one account equals one client.
- Do not mix Work-context access and Care-context access merely because the same identity holds both.

---

## 24. Definition of done

A developer building a new Medic Connect Care screen must be able to answer all of the following from this document alone. If they cannot, this document is incomplete and is amended before the screen is built.

1. Which UI grammar does this belong to?
2. Which shell does it use?
3. Is this Work or Care?
4. Which care recipient is active?
5. Which shared fields and components must be used?
6. What status vocabulary applies?
7. What colour meaning applies?
8. What is the information hierarchy?
9. What happens at 320px?
10. What happens at tablet widths?
11. What happens on desktop?
12. What happens offline?
13. What does save and sync state look like?
14. What does keyboard interaction do?
15. What does a screen reader receive?
16. Which existing screen is the closest ancestor?
17. Which shared component owns the behaviour if something breaks?

---

## 25. Order of work

1. Field layer and behaviour contracts, tested at 320px and against section 18.
2. `Status`, `SaveState`, `SyncState`, `OfflineState`, `formatDate`.
3. Console into Mu; retire `MuStats`.
4. Token cleanup.
5. Context and care-profile routing (sections 13 and 14).
6. Only then new Care screens, each from the lineage in section 20.
