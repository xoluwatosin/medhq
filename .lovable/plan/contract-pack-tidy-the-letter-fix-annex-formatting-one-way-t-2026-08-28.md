# Contract pack: tidy the letter, fix annex formatting, one way to sign

Four fixes, then the email goes out again with a link that lands properly.

## 1. Drop the acceptance block from the on-screen letter

The letter still prints its own "Acceptance" panel with two signature boxes and a consent line, directly above the real signing panel. On screen that reads as two places to sign. The panel is hidden in the portal view and kept for the PDF and the printed copy, where it is the legal signature page. The per-annex signature summary stays.

## 2. Annex formatting, properly this time

- Tables: the pasted annex tables carry no column widths, so a narrow first column crushes its text into a vertical stack. Fixed column behaviour, a sensible minimum width per cell, and horizontal scroll inside the table's own frame rather than the page. On a phone, header-first stacked rows for two-column tables so nothing is squeezed.
- Hierarchy: many annexes use bold paragraphs or all-caps lines as headings rather than real heading tags. Those are promoted to headings on render, so section and sub-section levels step down cleanly and the jump-to-section list picks them up.
- Rhythm: consistent spacing between sections, tighter lists, readable measure, no orphaned single words at the left edge.

## 3. One way to sign

The "Type my name" tab goes. Every signable document asks for the full name in a field plus a drawn signature, with the consent tick. Nothing can be signed with a typed name alone. Existing typed signatures already on record are left as they are.

## 4. Email with a link that lands

The email points at `/portal/offers/contract/<id>`. The route exists, so the 404 comes from the signed-out path: check the login carries and honours `?next=`, and that a person landing without a session is returned to the contract after signing in rather than to the portal home. Verified by opening the link signed out end to end, then Francisca's contract email is resent.

## Technical detail

- `ContractDocument.tsx`: new `acceptanceBlock` prop (default true); portal render passes false. PDF and print unchanged.
- `contract-theme.css`: `.mc-annex-body table { table-layout: fixed }` with `min-width` per cell and a scroll wrapper; under 640px, two-column tables render as stacked label/value rows. Heading rhythm tightened.
- `PortalContractDoc.tsx`: the `withSections` pre-pass also promotes bold-only or all-caps single-line paragraphs to `h3` before ids are assigned.
- `PortalContractDoc.tsx`: remove the method tabs and the `typed` branch; `method` is always `drawn`, submit blocked until both name and drawing are present.
- Login redirect check in `usePortal.ts` / `PortalLogin.tsx`, then resend via `send-contract-email`.
