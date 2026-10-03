# Contracts, end to end, inside the candidate portal

Today a contract is emailed as a standalone signing link that opens a page outside the portal, the candidate signs immediately, and the PDF is emailed at the moment of signing, before anyone at Medic Connect has approved it. That is not the agreed flow. This rebuilds it so the whole thing lives in the candidate's own account.

## The flow we are building

```text
Admin issues  ->  Email: "Open your account to read and sign"
                    |
              Candidate signs in
                    |
        Portal > Offers > Your contract
          - reads the offer letter
          - opens each annex (code of conduct, confidentiality,
            data protection, scope of practice, disciplinary,
            job description)
          - ticks each annex that needs acknowledging
          - signs once, name typed or drawn
                    |
        Status: signed, waiting for us
                    |
        Admin reviews and approves  ->  countersigned for Medic Connect
                    |
        PDF built with both signatures and the date
          - emailed to the candidate
          - filed in her Documents in the portal
          - filed on her profile admin side
```

## What changes

**1. The email**
The issue email stops carrying a raw signing link. It carries one button, "Open your contract", which lands on the contract inside her account. If she is not signed in she is asked to sign in first and is taken straight to the contract afterwards. Sending the email again from the admin page keeps working.

**2. Portal contract area**
A contract section under Offers, plus its own page at `/portal/offers/contract/:id`, showing:
- the offer letter rendered exactly as issued, wording frozen
- every annex on the contract as an expandable document, in order, with a clear read state
- an acknowledgement tick for each annex marked as needing a signature, all of which must be ticked before signing is possible
- one signature step at the bottom: typed or drawn, a consent line, and the date
- after signing, a plain "signed on this date, waiting for Medic Connect to countersign" state
- after countersigning, the finished document with both signatures and a download button

Where a contract is waiting, Home and the Offers tab show it as an outstanding task in the same "What we need from you" grammar as the rest of the portal.

**3. Admin approval**
The contract page in Workforce gains a clear approval step for contracts in the signed state: see when she signed, what she acknowledged, and each acknowledgement time, then "Approve and countersign on behalf of Medic Connect". Countersigning is what triggers delivery. The existing withdraw and void actions stay.

**4. Delivery and filing**
On countersign, the finished document, both signatures, both dates and the frozen wording, is turned into a PDF, filed in storage, attached to an email to her, recorded as a document on her profile with the kind "signed contract", and shown in her portal Documents list. Nothing is emailed at the moment she signs; she gets a short "we have your signature" acknowledgement instead.

**5. The old public link**
The tokenised page stays for contracts already out in the wild, but it stops emailing a PDF at signature and follows the same wait-for-countersign path. New contracts always go through the account.

## Technical notes

- Data: add `annex_acknowledgements` (jsonb, per annex code with time and name) and `signed_acknowledged_at` to `mu_contracts`. No new tables.
- New security definer RPCs scoped to `mu_my_person_id()`: `mu_my_contracts()`, `mu_my_contract(_id)`, `mu_contract_acknowledge_annex(_contract_id, _code)`, `mu_contract_sign_in_portal(_contract_id, _signed_name, _method, _signature_image)`. Signing refuses unless every annex needing acknowledgement is ticked, and writes to `mu_contract_events` exactly as the token path does.
- `mu_contract_countersign` extended to log a `countersigned` event and return enough for delivery; countersign no longer allowed unless status is `signed`.
- `send-contract-email` gains a `kind` of `acknowledged` (short note to the candidate at signature) and keeps `signed` for the countersigned delivery, which is the only one that attaches the PDF and files the document.
- PDF generation reuses `ContractDocument` and `src/lib/contract-pdf.ts`, rendered off screen on the admin page at countersign, so what is filed is exactly what was signed.
- New page `src/pages/portal/PortalContract.tsx` and a contract card in `PortalOffers`, built on `CxPortalPage` and the existing `cx` primitives. Annex bodies are the stored HTML from the annex library, rendered inside a scoped prose wrapper.
- Francisca's live test contract is left in place and will pick up the new flow, so the same record can be used to test the whole path.
