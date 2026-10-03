# Site-wide soft surface system

## Goal

Use the uploaded `Medic_Connect_Request_Care.html` as the visual source of truth for boxes, cards, panels, pop-ups and form surfaces across the public site, portals and Admin.

Retire the cream, square and asymmetric analogue box treatment. Keep page layouts, workflows, business logic, routes, permissions and desktop behaviour intact.

## Visual standard

- Quiet surfaces: white or warm paper, fine neutral border, 14–16px symmetric corners.
- Emphasis surfaces: Medic Connect navy, used selectively for headers, the main action or one priority surface.
- Supporting surfaces: soft blue wash for selected, informational and calm states.
- Pop-ups: a composed shell with a navy header, light body, 22–24px outer corners and a restrained navy shadow.
- Controls: 9–14px symmetric corners, clear focus ring and minimum 44px touch targets.
- Typography: Figtree, sentence case and the existing Medic Connect hierarchy.
- Colour may vary by context through semantic states, while retaining the same shape, border, spacing and shadow language.
- Preserve specialised layouts such as document viewers, dense tables and print surfaces; apply the new surface language without turning every item into a generic card.

## Implementation

1. **Create one shared surface language**
   - Add semantic tokens for quiet, emphasis, selected, warning and overlay surfaces.
   - Remove the global asymmetric-corner overrides and legacy cream aliases from active UI use.
   - Introduce reusable variants for cards, panels, inset sections and pop-up shells.

2. **Fix the Request care mobile distortion**
   - Make the shared request shell own its height and scrolling instead of competing with the generic dialog.
   - Use one scroll region, dynamic viewport-safe sizing and bottom safe-area spacing.
   - Preserve the uploaded HTML’s navy cap, progress treatment, choice rows, fields and full-width action.
   - Verify Request care, the welcome journey and the WhatsApp questionnaire because they share this shell.

3. **Standardise pop-ups and temporary layers**
   - Update dialogs, confirmation pop-ups, side sheets and alerts to use the softer shell and spacing rules.
   - Keep compact and document-viewer variants where operational density requires them.
   - Ensure phone layouts are edge-safe, keyboard-safe and independently scrollable.

4. **Replace box styling site-wide**
   - Public pages: replace cream/asymmetric panels while preserving photography, content and page structure.
   - Candidate and client areas: align existing soft cards, fields and action states with the uploaded standard.
   - Admin and Care: remove inherited asymmetric corner rewriting and apply the same surface family to records, filters, panels and pop-ups without changing information density.
   - Contracts, Communications, Finance and content tools: restyle their on-screen containers while leaving document/PDF output unchanged.

5. **Centralise and remove drift**
   - Replace repeated one-off border/radius/shadow combinations with the shared variants.
   - Keep status colours and domain-specific emphasis semantic rather than hard-coded.
   - Update the design guide so this uploaded HTML standard supersedes the retired analogue treatment.

## Technical details

- Primary shared targets: global design tokens, shared Card, Dialog, AlertDialog and Sheet foundations, plus the Request care shell.
- Preserve explicit escape hatches for print documents, full-bleed media, tables and edge-to-edge mobile lists.
- Do not change the backend, database, route semantics, permissions or operational workflows.
- Do not alter PDF/contract rendering styles unless they are also used as visible application chrome.

## Acceptance checks

- Test representative public, Candidate, client, Care and Admin screens at 430×786 and 390×844.
- Test representative desktop screens at 1440px.
- Open the main pop-up families and confirm one scroll region, safe-area clearance, no clipped actions and no horizontal overflow.
- Check long labels, keyboard-open form states, dense Admin records and document viewers.
- Confirm no active cream/asymmetric analogue box styling remains outside intentional non-box artwork.
- Run type checks, focused tests, the full test suite and the production build.
