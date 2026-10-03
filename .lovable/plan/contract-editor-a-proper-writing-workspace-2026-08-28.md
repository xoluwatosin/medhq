# Contract editor: a proper writing workspace

Today the page squeezes everything into a 380px column: details, every clause, every annex, and the audit trail all stacked in one narrow tab strip, with tiny 170px editors and a live document pinned beside it. Writing wording in that column is slow. The rebuild keeps the same data and the same actions, and changes how the screen is laid out and how text is edited.

## The new layout

Three zones instead of two.

```text
┌──────────────────────────────────────────────────────────────┐
│ Contract, Ayamke Joyce   [Draft] [Saved 2m ago]  Preview PDF │
│                                        Save  Issue  ...more  │
├───────────────┬──────────────────────────────┬───────────────┤
│ PACK RAIL     │ EDITING CANVAS               │ INSPECTOR     │
│ Offer letter  │ (wide, one document or one   │ details for   │
│  1 Position   │  clause at a time, large     │ the selected  │
│  2 Pay        │  type, full toolbar)         │ item + the    │
│ Annex A ✓     │                              │ variables     │
│ Annex B ●     │                              │ list          │
│ Audit trail   │                              │               │
└───────────────┴──────────────────────────────┴───────────────┘
```

- **Pack rail (left, narrow, collapsible).** One line per document in the pack: the offer letter with its clauses nested under it, then each annex, then Details and Audit trail. Each row shows its state (included, needs signature, attachment, empty wording). Clicking a row opens it in the canvas. Clause rows drag to reorder, replacing the up/down arrow buttons. A toggle collapses it to a thin icon strip.
- **Editing canvas (centre, wide).** Whatever is selected fills the space, blog-editor style: a large title field and a full-height body editor with a floating bubble menu on selection and a slash-style insert menu, exactly the writing feel of the blog editor. A clause gets its heading as the title and a body editor of at least ~55vh. An annex gets its title, note, switches, attachment, and a full-height wording editor. Details shows the contract fields in a two-column grid.
- **Inspector (right, collapsible).** Context for the selection: for a clause or annex, the variables you can drop in (click to insert `{{token}}` at the cursor) with their current value shown, plus which are still blank.

Both side panels collapse independently, by button or by keyboard, and the choice is remembered per admin. With both collapsed the canvas becomes a near full-width writing surface with a comfortable reading measure, so you can focus on the wording alone. On tablet and mobile the rail becomes a top document picker and the inspector a sheet.


## Editing improvements

- A proper blog-style writing surface: same TipTap foundation and feel as the blog editor, 16px type, comfortable line height, generous padding, floating bubble menu on selected text.
- Toolbar gains undo/redo, link, and clear formatting alongside the existing bold/italic/heading/lists, and stays stuck to the top of the canvas while scrolling.

- Insert-variable button in the toolbar and clickable tokens in the inspector, both inserting at the cursor.
- Keyboard: Cmd/Ctrl+S saves the draft, Cmd/Ctrl+Enter opens preview.
- Autosave the draft a few seconds after typing stops, with a "Saving… / Saved just now / Unsaved changes" indicator in the header; the explicit Save button stays.
- Warn before leaving the page with unsaved changes.

## Header and actions

- The header keeps status and the primary action for the current state (Save + Issue when draft, Chase when issued, Countersign when signed). Secondary actions (PDF, signing link, use template, withdraw) move into an overflow menu so the header stops wrapping into three rows.
- "Before this can be issued" becomes a compact chip row of missing fields; clicking a chip jumps to that field in Details.
- The live document preview moves fully into the existing Preview dialog (which already renders per document), so the canvas is not competing with a second rendering of the same text. The pack status list moves into the rail as row states.

## What does not change

- All contract logic stays as is: `saveContractDraft`, `issueContractDocument`, `countersignContract`, `voidContract`, PDF pack building, annex upload, template apply, address pull/ask, audit trail.
- Read-only behaviour once issued is unchanged; the same layout renders with editing disabled.

## Flawless execution safeguards (approved scope)

**1. Pre-issue checks.** A client-side validation pass runs before Issue is enabled, and the results render in the header area as a checklist: salary parses as a number, dates are ordered (start before end, signing dates sensible, notice period present), no unresolved `{{variables}}` anywhere in clauses or annex wording, every included annex has wording or an attachment, and the countersign name is set. Hard failures block Issue; soft warnings show but can be acknowledged.

**2. AI wording review (Claude).** A "Review wording" button next to Issue sends the rendered letter plus all included annexes to a new `contract-review` edge function, which calls the AI Gateway with the strongest frontier model available in the catalog (Claude if present, otherwise the frontier equivalent — confirmed at build time against the allowlist). It returns a short structured report: blanks or contradictions across documents (e.g. salary stated differently in the letter vs an annex), wording a candidate is likely to query, and anything missing for the role type. The report shows in a dialog with each finding linked to the clause or annex it concerns. It never edits wording and never blocks issuing — it advises, you decide. Findings are written to the contract's audit trail. The function is server-side only (no keys in the browser), validates the caller is an admin, and sends rendered text only — no extra candidate data beyond what the contract already contains.

**3. PDF regression tests.** Vitest coverage around `buildContractPack` and the slicing logic in `contract-pdf.ts`: a synthetic contract with long clauses, wide tables, signatures, and conditional annexes must produce one PDF per document with execution pages intact, signature blocks never split across pages, and every annex accounted for. Run in CI so a layout change cannot silently corrupt packs again.

**4. Chase automation.** A scheduled edge function (daily) finds contracts in `issued` status older than a threshold (default 72h, configurable in `admin_settings`) and sends the candidate a reminder email, logging each nudge to the audit trail so it never spams (max one nudge per 72h, stops after three). A second sweep alerts admins when a contract has been signed but not countersigned after 24h.

**5. Amendments and renewals.** On an active contract, a "Issue a variation" action clones the contract into a fresh draft linked to the original (original stays frozen on file; the variation carries a `supersedes_contract_id` and its own lifecycle and signing flow). On the workforce view, contracts approaching their end date (30 days) surface in a "Renewals due" list with a one-click path to issue the renewal draft.

- `ContractDocument`, PDF output, and the candidate-facing screens are untouched.

## Technical notes

- `src/pages/admin/ContractEditor.tsx` is split into presentational pieces under `src/components/admin/contracts/`: `ContractPackRail`, `ContractDetailsPanel`, `ContractClausePanel`, `ContractAnnexPanel`, `ContractVariableInspector`. State stays in the page component so save/issue paths are unchanged.
- `ContractRichTextEditor` gains optional props: extra toolbar items (undo/redo, link, clear), a bubble menu on selection (same pattern as `RichTextEditor`), sticky toolbar, larger text preset, and an imperative `insertText` handle for variable insertion. Existing call sites keep working with current defaults.
- Rail and inspector collapse state lives in the page component, persisted to `localStorage`, with the canvas grid columns driven by those two booleans.

- Clause reordering uses HTML5 drag and drop on the rail, same approach as the campaign `BlockCanvas`, writing back through the existing `clauses` array order.
- Autosave is a debounced call to the same `saveContractDraft` used by the Save button, skipped when the contract is not a draft.
- Styling uses existing MuShell/admin tokens; no new colours.
