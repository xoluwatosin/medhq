# Employment contracts: build, edit, sign, file

Turn the uploaded reference design into a live contract system: a structured contract record, an admin editor, a legally defensible signature, an audit trail, a PDF by email, and a copy filed on the person's profile.

## 1. The document

The reference HTML becomes a React renderer that matches it exactly: Figtree only, the fixed palette (deep blue `#26306b`, brand blue `#3B4DC4`, tint `#EEF1FF`, warm white `#FAF8F4`, ink, body grey, muted, hairline), uppercase headings, A4 print rules and `break-inside: avoid` so clauses never split. One component serves screen, print and PDF, so the two can never drift.

Nothing is hardcoded. A contract is data:

- **Fields**: offer date, employee name and address, email, job title, reports to, acceptance window, salary figure and salary in words, employment basis, weekly hours, work model, notice period, place of work, signatory.
- **Clauses**: an ordered list, each with number, heading, rich text body, source and lock state. Numbering recalculates when clauses are added, moved or removed.
- **Annexes**: containers now, wording later. Annex F, scope of practice, renders only for clinical roles.

House rules enforced in copy: "Medic Connect" as two words, no em dashes, no middot separators.

## 2. Clause library and the editor

Standard wording lives once in a clause library, not in code, so an admin edits it in the app. Creating a contract copies the library into the contract as its starting clauses.

Admin editor at the staff or candidate record: a variables form beside a live preview of the real document. Every clause is editable rich text; clauses can be added, reordered and removed. Role-specific parts, the primary responsibilities sentence, the job description groups and the commencement clause, are written per contract.

At the moment of issue the clause set is frozen as an issued version with a content hash. Editing the library afterwards never touches a contract already issued or signed.

## 3. Signing

Two doors to the same contract, as agreed:

- A unique unguessable link emailed to them, no login needed. Good for new hires who have no account yet.
- The same contract in their portal or staff profile, for anyone who already signs in.

Both land on the identical document. At the acceptance block they either draw a signature on a canvas or type their full name and tick the confirmation: "By typing my name and ticking this box I confirm that this constitutes my electronic signature and has the same effect as a signature in ink." Countersignature by the company representative uses the same block.

Captured on submit and stored with the signature: timestamp, IP address, user agent, method used, the typed name or drawn image, and the hash of the exact wording signed. That is the record that makes the signature defensible.

## 4. Audit trail

Every event on a contract is logged and shown as a timeline on the record: created, edited (with which fields or clauses changed), issued, viewed by the recipient, signed, countersigned, PDF generated, email sent and delivered, voided, superseded. Each entry carries who, when and from where. The trail is append only and visible to admin on the contract, with the signature evidence block shown alongside.

## 5. PDF and filing

On signature the PDF is produced from the same component with the print stylesheet, running header and footer with the employee name on every page.

The signed PDF is then:

- attached to a confirmation email to the signer, with the admin issuer copied,
- stored in the backend and linked from the email as a secure download in case the attachment is stripped,
- filed on the person's record as a document, so it appears under their documents in the staff or candidate profile alongside everything else we hold.

Issue and reminder emails use the same branded template family as the rest of the system.

## 6. Where it lives

- Admin: contract tab on the staff record and on a hired candidate's record. Create, edit, issue, chase, countersign, void, supersede, download.
- Staff and candidates: their own contract in their profile, with read and sign, and the signed PDF afterwards.
- Public: the tokenised signing page only, no other data reachable from it.

## Technical outline

- Extend `mu_contracts` with `fields jsonb`, `clauses jsonb`, `issued_clauses jsonb`, `issued_hash`, `annexes jsonb`, `is_clinical`, `sign_token`, `token_expires_at`, `signature_image`, `signed_ip`, `signed_user_agent`, `countersigned_*`, `pdf_path`.
- New `mu_contract_clause_library` (key, heading, body, sort order, locked, active) and `mu_contract_events` (contract, event type, actor, payload, ip, user agent, created at). Both public schema with GRANTs to `authenticated` and `service_role`; RLS: admin read and write, the person reads their own via `mu_my_person_id()`, no anon access.
- RPCs, all security definer, all writing `mu_contract_events` and `mu_activity`: `mu_contract_create_from_library`, `mu_contract_save_draft`, `mu_contract_issue` (freezes clauses, computes hash, mints token), `mu_contract_sign`, `mu_contract_countersign`, `mu_contract_void`.
- Public signing runs through an edge function `contract-sign` using the service role, keyed on the token, never through direct table access. It records IP and user agent server-side, since a client cannot be trusted for those.
- Renderer at `src/components/contracts/ContractDocument.tsx` plus `contract-theme.css` carrying the tokens, `@page` A4 with 17mm side margins and the print header and footer. Editor at `src/pages/admin/ContractEditor.tsx`, signing page at `/contract/:token`.
- Logo and marks from the uploaded SVGs, registered as project assets.
- PDF: generated browser-side from the print layout at the moment of signing, uploaded to the `applications` storage bucket, and passed to a `send-contract-email` function that attaches it via Resend and writes an `mu_documents` row of type `signed_contract`. If fidelity from the browser render proves poor, the fallback is a server-side HTML to PDF render of the same component; the layout source stays single either way.

## Sequence

1. Data model: clause library, contract fields and clauses, events table, RPCs.
2. Renderer built to match the reference exactly, verified against a print preview.
3. Admin editor with live preview, issue and freeze.
4. Signing: tokenised page plus in-profile signing, drawn and typed methods, evidence capture.
5. PDF, email delivery, filing on the profile, audit timeline in the UI.

Annex wording and the six annex documents load into the library once you send them. A Nigerian employment lawyer should review clause 7, notice period, before this is used on a real hire.
