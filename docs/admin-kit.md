# Admin kit

The Admin Centre's one look, close to the site: navy bands with tilted word
headings, square cards with offset shadows, and clip art in the band and in
empty states. On a phone, number tiles sit two across and nothing scrolls
sideways. The shared layer (`src/index.css` `.admin-kit`, `src/components/admin/mu/MuShell.tsx`,
`src/components/admin/console/*`, `src/components/field/*`) carries it, so a
screen that uses the shared parts is already right.

## Rules for every screen

1. **Page header.** `MuPageHeader` (title, one-line description, actions).
   At most two visible actions: the primary one (`Button`, default variant)
   and one secondary (`variant="outline"`). Anything else goes in a "More"
   `DropdownMenu`. Never repeat a link the tab rail above already gives.
2. **Lists.** A table sits in `MuSection` (or `border border-line bg-card`).
   Column heads are 11px bold caps, `text-label`. On phones use the existing
   mobile list for that screen if it has one.
3. **Empty, loading, error.** Empty uses `MuEmpty` with a short title, one
   sentence and, where it helps, `art={art.objX}` from `@/components/mc/art`
   (for example `objMagnifier` for no search results, `objFolderDocuments` for
   no documents, `objEnvelope` for no messages, `objPriceTagNaira` for no
   invoices, `objCarePlan` for no care records, `objCalendar` for nothing
   scheduled). A load error says so, never shows an empty state.
4. **Status.** `MuStatus` (or `Status` from `components/field`). One tone map.
5. **Controls.** `Select` and `SearchableSelect` from `components/field`
   where a raw shadcn `SelectTrigger` is a plain single choice.
6. **Shape.** No `rounded-*` (the CSS squares them anyway, but remove them in
   code you touch), no `shadow-*`, no `font-serif`, no pill-shaped chips.
   `rounded-full` only for avatars, switches and radios.
7. **Copy.** Sentence case everywhere ("New campaign", not "New Campaign").
   No em dashes, no dot separators. Short.
8. **Logic is untouched.** The sweep changes how a screen looks and reads,
   never which data it loads or what an action does.

## The sweep rules (loose text and loose groups)

9. **No instruction sentences in the middle of a layout.** A sentence that
   explains how to use a control becomes the control's placeholder, its label,
   a disabled state with the reason as placeholder or title, or goes. Section
   descriptions are one short line or nothing; never repeat what the heading
   or the tab already says.
10. **Every group has a container.** Controls that work together (filters,
    a search with its selects, a set of toggles) sit in one `MuToolbar` or a
    `border-2 border-navy bg-tint/40 p-3` panel with a small caps label.
    Content blocks sit in `MuSection` (a card) or open with `MuSectionOpener`
    (the heavy navy rule) when they hold their own boxes. Never a box inside a
    box inside a box.
11. **Say each fact once per screen.** If a count, status or sentence appears
    in the band, a tile and a section, keep the one where it is acted on.
12. **Candidate status words:** "Verified" (all required documents accepted)
    and "Documents complete" (everything required is on file). "Ready" and
    "Ready for placement" are retired.
