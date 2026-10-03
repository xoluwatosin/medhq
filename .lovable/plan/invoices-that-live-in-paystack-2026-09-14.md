# Invoices that live in Paystack

Every invoice is created in Paystack and paid in Paystack, but the client receives a Medic Connect email, and you can also send it on WhatsApp from the same screen. The old locally-built invoice is retired.

## What Paystack can and cannot carry

Paystack invoices (payment requests) can hold:

- the client as a saved customer (name, email, phone)
- as many priced lines as you want, each with its own wording and quantity
- VAT as its own named line
- a description block, a due date, an invoice number and a currency
- a hosted pay page (card, bank transfer, USSD) plus a transfer reference for clients who pay offline
- live status: pending, paid, part-paid, expired

Paystack cannot hold: per-line notes, your letterhead, or long terms. So anything descriptive goes in two places we control: the line wording itself and the notes block, both of which appear on your branded email and on the Paystack page.

Your example would be written as:

```text
Line 1  Live-in care staffing, three staff, nine hours per day   x2 days   N100,000   N200,000
Notes   Team of three healthcare-trained staff, including at
        least one registered nurse. First aid box included.
VAT     7.5%                                                                 N15,000
Total                                                                       N215,000
```

The line wording is free text, so day rates, per-person rates, hourly blocks, deposits, discounts as a negative line, and the fixed assessment fee all fit without any special handling.

## The screen

One invoice builder in Admin:

1. **Client** — pick an existing client or type first name, last name, email, phone. Chosen client details prefill.
2. **Lines** — add from the service catalogue or type your own. Each line has wording, quantity and unit price. A discount is entered as its own negative line so it shows on the Paystack invoice.
3. **Notes** — what accompanies the fee, staffing mix, inclusions, anything the client should read.
4. **VAT** — 7.5% by default, editable per invoice, sent to Paystack as a named tax line.
5. **Due date** — from the invoice type as today.
6. **Create invoice** — creates it in Paystack as a draft and shows the exact pay link.
7. **Send** — branded email, or WhatsApp share which opens WhatsApp with the message and link already written for you to press send.

An **Invoices** list shows every invoice with its live Paystack status, amount, client, when it was sent and when it was paid, with reminder and cancel actions.

## Staying in step with Paystack

Paystack tells us the moment an invoice is paid, part-paid or expires, so the list is never guesswork. Amounts and status always come back from Paystack rather than being recalculated locally, so the two can never disagree.

## Technical detail

- New table `paystack_invoices` (+ `paystack_invoice_lines`): local id, Paystack `request_code`, `offline_reference`, hosted link, client link (`clients.id` nullable), status, currency, amount, vat rate, notes, due date, created_by, timestamps. Grants for `authenticated` and `service_role`, RLS admin-only via `has_role`. Legacy `invoices`/`invoice_items` are left in place untouched, no longer written to.
- New edge function `paystack-invoice` (admin-gated, same pattern as `generate-paystack-link`): actions `create` (customer upsert + `POST /paymentrequest` with `line_items`, `tax`, `description`, `due_date`, `draft: true`, `send_notification: false`), `finalize`, `notify` skipped, `verify`, `archive`. Stores the returned `request_code`, `offline_reference` and hosted URL.
- New edge function `paystack-invoice-webhook` (`verify_jwt = false`): validates the `x-paystack-signature` HMAC SHA512 against `PAYSTACK_SECRET_KEY`, handles `paymentrequest.success` and `paymentrequest.pending`, updates status and paid amount. Never trusts unsigned payloads.
- `send-invoice-email` reworked to take a stored invoice id, read lines and totals from the database (not the client), and send the existing `kitEmail` layout with the Paystack pay link plus the transfer reference.
- WhatsApp becomes a client-side `https://wa.me/<phone>?text=...` share link. The existing `send-whatsapp` function stays but is no longer wired to the invoice screen.
- `src/hooks/useInvoice.ts` reshaped: discount becomes a line, VAT stays as a rate, totals are used for display and then reconciled against the Paystack response.
- `src/pages/admin/Invoices.tsx` tabs become Invoices (list) and New invoice; Catalogue stays; Preview/print is removed.
- Tests: totals and line-payload construction, webhook signature verification, status mapping.

## Out of scope

Cart/Paystack checkout and `orders`, care packages, T8 and anything in the care lifecycle stay exactly as they are.
