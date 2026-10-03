# Fix the invoice screen

## What you are seeing

The two screenshots show the **old** invoice screen (Discount Type, Save Invoice, Print / PDF, "Generate" payment link). That screen no longer exists in the current code — the live preview now has Invoices / New invoice / Catalogue, and invoices are created straight on Paystack. The published site still serves the old build, which is why you got "Failed to send a request to the Edge Function" and a squashed table.

So part of this is simply republishing. The rest is real problems in the new builder.

## Fixes

1. **Quantity and price you can actually type in**
   Both boxes currently hold a number, so clearing them snaps back to 0 and typing produces things like `0100000`. Change them to plain text entry that keeps exactly what you type, allows an empty box, and converts to a number only when the total is worked out and when the invoice is created.

2. **Line rows that work on a phone**
   Each line becomes a stacked block with visible labels (Description, Quantity, Unit price), a right-aligned line total and a remove button, instead of a four-column row squeezed into a narrow screen.

3. **Clear reason when an invoice will not create**
   Surface the exact reason returned by the payment service (missing name, bad email, no lines, payment service not configured) in the message instead of a generic failure, and keep the button disabled until a valid email, both names and at least one priced line are present.

4. **Republish** so the live site stops serving the old builder.

## Technical notes

- `src/hooks/useInvoice.ts`: line `quantity` and `unitPrice` become strings in the draft; `invoiceTotals`/`lineTotal` already coerce with `Number()`, so arithmetic is unchanged. `addLine` seeds `"1"` and `""`.
- `src/components/admin/invoice/InvoiceBuilder.tsx`: responsive line layout, `inputMode="decimal"`, labels shown on mobile, submit payload maps strings to numbers, richer disabled/validation state and error text from the `paystack-invoice` response.
- No change to `paystack-invoice`, the webhook, the database tables, or Care/orders.
- Verify by creating one real invoice against Paystack from the preview and checking it appears in the Invoices list with a hosted link.
