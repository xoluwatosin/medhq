# Countersigned contracts: real PDFs, one per document, with signatures on the page

Today, when an admin countersigns, the app tries to photograph the contract that happens to be on screen at that moment and sends the result as a single attachment. That produces the blank or jumbled PDF you have seen, and it never covers the annexes as separate signable documents.

## What changes

**1. Stop capturing the on-screen panel**

Countersigning reloads the editor, so by the time the capture runs the element it is pointing at is often gone from the page, which is why the attachment arrives blank. The PDF will instead be built from a purpose-made, off-screen print sheet rendered fresh from the saved contract data, so it never depends on what is visible or which tab is open.

**2. One PDF per document, not one jumbled file**

The pack is split into separate files:

```text
01-offer-of-employment-<name>.pdf
02-annex-a-job-description-<name>.pdf
03-annex-b-code-of-conduct-<name>.pdf
...  one file per included annex
```

Each file carries the full letterhead, running header and footer, the document's own wording, and its own execution page. All of them are attached to the countersigned email, filed individually on the candidate's profile under Documents, and downloadable from the admin editor.

**3. Signatures and legal evidence printed on every document**

Every file ends with an execution block showing:

- The employee's drawn signature image, printed name, and the date and time of signing with the timezone
- The company countersignature image, signatory name and position, and countersign date and time
- For annexes that were acknowledged rather than signed: "Acknowledged by <name> on <date> at <time>", taken from the acknowledgement record
- A short evidence line: contract reference, document code, the wording fingerprint already held on the contract, and the IP address and device recorded in the contract audit trail at the moment of signing
- The existing electronic signature statement

Documents that were never signed or acknowledged say so plainly rather than showing an empty box.

**4. Email**

The countersigned email lists the documents by name, attaches each PDF, and keeps a link into the candidate's account. If the attachments together would be too large for the mail provider, the email attaches the offer letter and links the rest from the account, and says which is which.

**5. Admin side**

"Download" in the contract editor produces the same set as a zip, so what you keep matches what the candidate received. Filing writes each PDF into `mu_documents` with its own label and the correct document kind, replacing the single lumped entry.

## Technical notes

- New `src/lib/contract-pack-pdf.ts`: mounts each document into a hidden fixed-width A4 container (off-screen, not `display:none`), waits for logo and signature images to decode, captures with html2canvas, and returns `{ filename, blob }[]`. Replaces the single `contractToPdfBlob` call in `ContractEditor.tsx`.
- `ContractDocument.tsx` gains a `only` prop (letter, or one annex code) plus an `execution` block driven by `signed_at`, `signature_image`, `countersigned_*`, `annex_signatures` and `annex_acknowledgements`, with times rendered in Africa/Lagos.
- Signing time, IP and user agent are read from the existing `mu_contract_events` rows rather than new columns; no schema change is expected. If an event is missing for a signed annex, the execution page prints the signature and date only.
- `send-contract-email` accepts `documents: [{ filename, pdf_base64, label, doc_type }]`, uploads each to `contracts/<contract_id>/<filename>`, inserts one `mu_documents` row per file, and attaches them all. The existing single-PDF payload keeps working for older calls.
- Total attachment size is checked before send against the provider limit, with the fallback described above.

## Verification

Rebuild and resend on Francisca Abosede's countersigned contract, then open each attachment and confirm: no blank pages, letterhead intact, annex tables not clipped at A4 width, and every signature, name, date and time present.
