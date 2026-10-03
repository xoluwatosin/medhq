# Medic Connect Care — UI Architecture Review

No code changes. This is the review, plus the document it becomes.

## 1. What actually exists today

**Candidate Portal (Cx).** `src/components/candidate/primitives.tsx` plus `CxShell`, `CxPortalPage`, `CxJoinShell`, `CxAuthShell`. Feels calm, sentence-led, quietly confident: navy rail on desktop, four tabs on mobile, one sticky action, rows separated by hairlines rather than boxed in cards, warm amber only when something is owed. Every colour is a token; no stray Tailwind palette anywhere. Weaknesses: no dialog, select, checkbox or textarea primitive, so `PortalPreferences`, `PortalDocuments`, `PortalContractDoc` and `JoinAccount` reach into shadcn; save state is a hand-rolled `saving` boolean plus toast in at least five files. **Coherent enough to be a parent system.**

**Admin / Match Universe.** `src/components/admin/mu/MuShell.tsx` contains three grammars in one file: the old card-and-stat-tile set (`MuPage`, `MuStats`, still shadcn `Card`, so rounded tiles sit above square sections), the newer hero + hairline record set (`MuHero`, `MuTabRail`, `MuField`, `MuTable`, `MuRecord`), and a ledger set (`MuLedger*`). `src/components/admin/console/*` is a fourth set used only by `Clients.tsx` and `ClientRecord.tsx`. Three different page-title typographies, four different eyebrow label styles, five independent status colour maps (`MuShell` `TONE_CLASS`, `Clients.tsx:60`, `Workforce.tsx:28`, `Applications.tsx:33`, `CreatorApplications.tsx:29`), seven hand-rolled date formats plus `date-fns` in `Enquiries.tsx`, five different detail-rail widths. **The hero/hairline/ledger grammar is the right parent; the rest is debt.**

**Care / pre-assessment.** `PreAssessment.tsx` + `CareFieldInput.tsx` is the most complete field library we have (date, phone, lga, person name, relationship, confirm/amend, choice, multi, budget band). It is also isolated: admin rebuilds state/LGA and relationship with shadcn selects, the public `CareRequestDialog` has a third set (`RequestShell`, `DialCodeField`). Upload is instructional copy only. Autosave clears the buffer before the save resolves and shows one word.

**Care Fund (separate project).** Its own palette (pastels, wallet reds/pinks/ambers, `rounded-3xl`, serif 5xl hero numbers) and its own bottom nav. The interactions are good: bottom sheets for add money / withdraw / share, activity rows, contribution list, share link. The visual skin is a different product.

## 2. Proposed visual ownership

One family, three dialects, one foundation.

- **Client and family** inherits the Candidate Portal grammar almost wholesale. Same shell, same rows, same calm. It is already the right feeling.
- **Assessor and care worker** is the *same portal*, not a second app. Capability adds tabs and sections, it does not change the skin.
- **Staff admin** is the Mu hero/hairline/ledger grammar: denser, tabular, navy hero on records, hierarchy from rules and alignment rather than card count.
- **Care Fund** is rebuilt on the Cx foundation, allowed one expressive move (the balance figure and a single contribution accent) and nothing else.

## 3. Navigation

Portal mobile stays four tabs, always. Capability changes what the four are, never adds a fifth.

```text
Candidate            Home · Profile · Offers · Account
+ Assessor           Home · Work · Profile · Account      (assessments inside Work)
Care worker          Home · Visits · Care · Account
+ All three          Home · Work · Profile · Account      (Work groups visits and assessments)
Client, pre-care     Home · Care · Updates · Account
Client, in care      Home · Visits · Care · Account       (Fund and payments under Care)
Client + Fund        Home · Visits · Care · Fund
```

Desktop uses the existing navy rail with grouped headings, so eight destinations read as three groups. Admin desktop keeps the current sidebar with a Care group; admin mobile is read-and-triage only, not a second full build.

## 4. Shared foundation (the real fix)

One `src/components/field/*` layer beneath all three surfaces. Already exist and get promoted: `AddressField`, `LanguageField`, `StateLgaField`, `PersonName`, `Relationship`, `ConfirmAmend`, `Choice`, `MultiChoice`, `Status`. Duplicated and must consolidate: date, phone, select, save state, status tone, table. Must be built: `TimeField`, `DateTimeField`, `MoneyField`, `WhatsAppField`, `SearchableSelect`, `SegmentedControl`, `FileUpload`, `MediaCapture`, `SyncState`, `OfflineState`, `PersonPicker` / `AssessorPicker` / `WorkerPicker`, `WorkItem`, `ActivityItem`, `DocumentRow`.

Every shared control specifies responsive, overflow, focus, error, disabled, read-only, loading, keyboard, 44px touch target, long text, missing data and offline behaviour, and is tested at 320px. Calendar overflow is fixed once in `DateField`.

## 5. Tokens and colour meaning

Keep Figtree, navy, warm paper, square corners. Retire dead tokens (`--tag-*`, `--chart-*`, `--spacing`, `--tracking-normal`), replace the raw `rgba()` and `#fff` literals in `index.css`, and collapse the three competing radius grammars (`kit-curve*`, `cx-*`, `admin-kit` overrides) into one scale.

Colour means one thing everywhere: navy is normal and selected; tint is complete; amber is needs action; a single stronger amber-red is clinical or safety; red is error only; grey is disabled or quiet; a dot, not a colour, carries unread; sync states use shape and motion, not new hues.

## 6. State vocabulary

Entered, saved on device, waiting to sync, synced, sync failed, submitted, under review, returned, accepted, superseded each get a distinct rendering from one `SyncState` / `Status` pair. No shared spinner. A disabled action always names its reason. Status always comes from domain state, next action always from the Work engine, read-only always from document and permission state.

## 7. Lineage — what each new screen starts from

| Screen | Visual starting point |
| --- | --- |
| Work queue | `MuLedger` / `MuLedgerRow` (`MuShell.tsx:584-706`) |
| Client list | `Clients.tsx` + `ConsoleTable`, refactored onto `MuTable` |
| Client record | `ClientRecord.tsx` hero grammar, `MuHero` + `MuTabRail` + `MuField` |
| Assessment queue | `MuLedger` rows, same as Work queue |
| Assessor briefing | `CxPortalPage` + `CxCard` emphasis |
| Assessor assessment | `PreAssessment.tsx` sectioned, with `ConfirmAmend` |
| Care plan editor | Nothing suitable exists. New, built from `MuRecord` sections |
| Package editor | Nothing suitable exists. New, `MuFieldGrid` plus `MoneyField` |
| Assignment | `MatchUniverseRequest` matching panel, rebuilt on `MuTable` |
| Care worker home | `CxShell` home, `CxRows` |
| Care worker visit | `CxPortalPage` + sticky `CxButton`, plus new offline chrome |
| Client/family home | `CxShell` home with a journey strip (new, small) |
| Client/family visits | `CxRows` |
| Client/family care plan | `PortalContractDoc` read view |
| Client/family payments | `src/components/admin/invoice` for figures, Cx rows for layout |
| Care Fund | Fund project interactions, rebuilt on Cx. Do not import its skin |
| Configuration / Form Library | `EnquirySetup.tsx` + `QuestionBuilder.tsx` |

## 8. Keep, refactor, retire

Keep exactly: Cx primitives, `CxShell` navigation, Mu hero/tab/field/ledger, `MuStatus`. Keep conceptually and refactor underneath: `Clients.tsx`, `ClientRecord.tsx` (move Console onto Mu), `CareFieldInput` (split into the shared field layer), autosave. Do not reuse: Fund palette, wallet cards, donut, `MuStats` card tiles, page-local status maps. Retire: `console/*` after the merge, duplicate state/LGA in `Workforce.tsx` and `Clients.tsx`, per-page date formatting.

## 9. Deliverable

Write `docs/care-platform/ui-architecture.md` with the sections above expanded: existing systems, strengths and weaknesses, ownership by audience, tokens, shared component library with per-control behaviour contracts, three UI grammars, Fund approach, navigation, hierarchy rules, state vocabulary, responsive standards at 320px, UI debt with file names, keep/retire, and the lineage table. No product code in this step.
