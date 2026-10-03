# Contracts: one document at a time, signable, and readable on a phone

Right now a candidate opens one long page: the full A4 letter, then every annex body printed again inside it, then the same annexes repeated in a collapsible list, then a single signature box at the bottom. On a phone the letter is fixed at A4 width so it runs off the screen, and the seven annex documents are raw pasted tables with no typography, so they read as a wall. There is one signature for the whole pack; nothing can be signed document by document.

## What changes

**A pack, not a wall.** The contract page becomes a short summary plus a list of the documents in the pack: the main contract letter, then each annex. Every row shows what it is and what it wants from the person: "Read and sign", "Read and tick", or "Read only", with a clear done state.

**One document per screen.** Tapping a row opens that document on its own screen with a back link. At the foot of that screen is the thing that document needs: its own signature panel (type or draw) if it must be signed, its own acknowledgement tick if it only needs acknowledging, nothing if it is for information. Signing or ticking saves immediately and returns to the pack list with that row marked done.

**The main contract is signed the same way**, on its own screen, and stays blocked until every annex that needs a signature or tick is done. Progress is shown as a plain sentence, for example "Two documents still need you".

**Readable on a phone.** The contract letter is fitted to the screen width instead of a fixed A4 sheet, with a "Fit to width / Full size" control for people who want the true page. Annex bodies get proper document styling: headings, spacing, readable line length, and tables that scroll on their own instead of stretching the page. A short "what this covers" line and a jump-to-section list sit at the top of long annexes (Scope of practice is 48,000 characters).

**Lined up in the candidate's own profile.** The same list appears in their profile, not only behind the email link. Their Documents area gains a "Your contract pack" list: Contract, Annex A, Annex B, and so on, in order, each row with a plain status ("Signed on 29 August", "Needs your tick", "For reading") and an action button on the row itself: Read, Sign, or Acknowledge. Tapping the button goes straight to that document's screen; ticking can also be done from the row for read-and-tick documents, so nothing forces a detour. Signed documents keep a Download link on their row.

**No duplication.** The letter no longer reprints every annex body on screen; the on-screen letter shows the annex schedule only. The PDF and the printed copy still contain everything, unchanged.

**Sized properly on both.** Every document screen is laid out twice over: on a phone, full-bleed cards, 16px body text, headings that step down cleanly, tables that scroll inside their own frame, sticky action bar at the foot so Sign or Acknowledge is always reachable. On desktop, a centred column with a comfortable reading measure, the section list pinned beside long annexes, and the action panel below the text rather than sticky. Both are checked on a real render before this is called done.

**The finished copy.** The PDF built at countersign gains a signature page per signed document, showing each annex, the name, the method and the date and time. Admin sees the same breakdown on the contract page: which documents the person has signed or ticked, and when.

## Technical detail

- Migration: add `annex_signatures jsonb not null default '{}'` to `public.mu_contracts` (per code: name, method, image, at, ip, user agent). Add security-definer RPC `mu_contract_sign_annex(p_contract_id, p_code, p_name, p_method, p_image)` scoped through `mu_my_person_id()`, plus grants to `authenticated`. Keep `mu_contract_acknowledge_annex` for tick-only documents. `mu_contract_sign_in_portal` gains a guard: refuse while any annex with `requires_signature` lacks a signature or any required annex lacks a tick.
- Routes: `/portal/offers/contract/:id` (pack list) and `/portal/offers/contract/:id/doc/:code` (single document, `code` url-encoded; `main` for the letter). Registered in `src/App.tsx`.
- `src/pages/portal/PortalContract.tsx` splits into the pack list plus a new `PortalContractDoc.tsx`; shared loader stays in `src/lib/contracts.ts` with new `signAnnex()` and a `packItems(contract)` helper deriving rows, requirement kind, action label and done state.
- Profile listing: a shared `ContractPackList` component driven by `packItems()`, rendered on the contract page and inside the portal Documents tab (`src/pages/portal/PortalDocuments.tsx` and its panel), with per-row Read / Sign / Acknowledge buttons and inline tick for acknowledge-only rows.
- `src/components/contracts/ContractDocument.tsx`: new `annexBodies` prop (default true) so the portal view renders the schedule table only while PDF/print keeps full bodies. Signature blocks section extended to list per-annex signatures.
- `src/components/contracts/contract-theme.css`: responsive `.mc-sheet` under 900px (percentage width, scaled padding) and a `.mc-annex-body` document stylesheet (h2/h3 rhythm, lists, `overflow-x:auto` table wrapper, max 68ch measure). Print rules untouched.
- `src/pages/admin/ContractEditor.tsx`: per-document signature status panel; countersign PDF path unchanged apart from the extra signature page rendered by `ContractDocument`.
- Francisca Abosede's issued contract is the test case end to end after the change.
