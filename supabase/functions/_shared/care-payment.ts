// Care payments: filed as invoices, paid through a Paystack checkout that
// brings the family back to their offer page, and confirmed with Paystack
// directly.
//
// Each payment (the first, every month upfront, or a later month) is one
// invoice row. Paying it makes a fresh Paystack checkout, so a link never goes
// stale; the checkout carries the invoice id, and its reference is kept so
// the payment can be confirmed on return, by the webhook or by the daily job,
// whichever comes first. The family is thanked, and staff told, exactly once.
// The thank-you for the first payment is our written confirmation of the
// booking, with the family's signed copy of the agreement attached.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { kitButton, kitEmail, kitFacts, kitParagraph, kitSteps, kitSubhead } from "./kit-email.ts";
import { kobo, mapStatus } from "./paystack-invoice.ts";
import { naira } from "./care-offer.ts";
import { SITE_URL } from "./site-url.ts";

const PAYSTACK = "https://api.paystack.co";
const WHATSAPP_LINE = "Questions? Reply to this email, or call or WhatsApp us on +234 812 698 8237.";

async function paystack(path: string, init: { method?: string; body?: unknown } = {}) {
  const key = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!key) return { ok: false, body: { message: "Paystack is not configured" } as Record<string, any> };
  const res = await fetch(`${PAYSTACK}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && body?.status !== false, body };
}

async function sendEmail(to: string, subject: string, html: string, attachment?: { filename: string; content: string }) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || !to) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Medic Connect <hello@medicconnect.co>", to: [to], reply_to: "hello@medicconnect.co", subject, html,
      ...(attachment ? { attachments: [attachment] } : {}),
    }),
  });
  if (!res.ok) console.error("care payment email failed", res.status, await res.text().catch(() => ""));
  return res.ok;
}

/** The signed copy of an agreement, as base64 for an email attachment. */
async function signedCopy(db: SupabaseClient, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await db.storage.from("care-agreements").download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const longDate = (d: string) =>
  new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

/**
 * One care payment, filed with the site's invoices against the client's main
 * contact. No Paystack call is made here; the checkout is made when the family
 * pays. Returns null if the contact has no email address.
 */
export async function createCareInvoice(
  db: SupabaseClient,
  args: { clientId: string; reference: string; amount: number; description: string; payUrl: string },
): Promise<{ invoiceId: string; payUrl: string } | null> {
  if (!(args.amount > 0)) return null;
  const { data: contact } = await db
    .from("client_contacts").select("id, full_name, first_name, last_name, email, phone")
    .eq("client_id", args.clientId).eq("is_primary", true).maybeSingle();
  const email = String(contact?.email ?? "").trim().toLowerCase();
  if (!email) return null;
  const first = String(contact?.first_name || String(contact?.full_name ?? "").split(" ")[0] || "");
  const last = String(contact?.last_name || String(contact?.full_name ?? "").split(" ").slice(1).join(" ") || "");
  try {
    const now = new Date().toISOString();
    const { data: invoice, error } = await db.from("paystack_invoices").insert({
      invoice_number: `MC-${now.slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`,
      hosted_link: args.payUrl,
      client_id: args.clientId,
      recipient_contact_id: contact?.id ?? null,
      client_name: String(contact?.full_name ?? `${first} ${last}`).trim() || email,
      client_first_name: first || null,
      client_last_name: last || null,
      client_email: email,
      client_phone: contact?.phone || null,
      vat_rate: 0,
      subtotal: args.amount,
      vat_amount: 0,
      total: args.amount,
      notes: `Care offer ${args.reference}: ${args.description}`,
      status: "sent",
      sent_at: now,
      issued_at: now,
    }).select("id").single();
    if (error) throw error;
    await db.from("paystack_invoice_lines").insert({
      invoice_id: invoice.id, position: 0, description: args.description, quantity: 1, unit_price: args.amount, line_total: args.amount,
    });
    await db.from("care_activity").insert({
      client_id: args.clientId, action: "invoice_issued",
      detail: { invoice_id: invoice.id, reference: args.reference, amount: args.amount }, actor_id: null,
    });
    return { invoiceId: invoice.id as string, payUrl: args.payUrl };
  } catch (e) {
    console.error("care invoice failed", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * A fresh Paystack checkout for one care invoice. Paystack sends the family
 * back to `returnUrl` once they have paid. Returns null if it is already paid
 * or Paystack could not be reached.
 */
export async function startCareCheckout(
  db: SupabaseClient, invoiceId: string, returnUrl: string, meta: Record<string, unknown> = {},
): Promise<{ url: string } | { paid: true } | null> {
  const { data: invoice } = await db.from("paystack_invoices")
    .select("id, status, total, client_email, invoice_number, notes").eq("id", invoiceId).maybeSingle();
  if (!invoice) return null;
  if (invoice.status === "paid") return { paid: true };
  const reference = `${invoice.invoice_number}-${crypto.randomUUID().slice(0, 8)}`;
  const started = await paystack("/transaction/initialize", {
    method: "POST",
    body: {
      email: invoice.client_email,
      amount: kobo(Number(invoice.total)),
      currency: "NGN",
      reference,
      callback_url: returnUrl,
      metadata: { invoice_id: invoice.id, ...meta, cancel_action: returnUrl },
    },
  });
  const url = String(started.body?.data?.authorization_url ?? "");
  if (!started.ok || !url) {
    console.error("care checkout", started.body?.message);
    return null;
  }
  await db.from("paystack_invoices").update({ paystack_reference: reference, updated_at: new Date().toISOString() }).eq("id", invoice.id);
  return { url };
}

/**
 * Asks Paystack whether a care invoice has been paid: by a checkout reference
 * (the one Paystack returned with, or the last one started), or, for an
 * invoice made as a Paystack payment request, by its request code. Marks it
 * paid and thanks the family when it has. Returns true if it is paid.
 */
export async function confirmCarePayment(db: SupabaseClient, invoiceId: string, reference?: string | null): Promise<boolean> {
  const { data: invoice } = await db.from("paystack_invoices")
    .select("id, status, total, paystack_reference, request_code").eq("id", invoiceId).maybeSingle();
  if (!invoice) return false;
  if (invoice.status !== "paid") {
    let paidAt: string | null = null;
    let amountPaid = 0;
    const ref = reference || invoice.paystack_reference;
    if (ref) {
      const v = await paystack(`/transaction/verify/${encodeURIComponent(ref)}`);
      const d = v.body?.data;
      const sameInvoice = !d?.metadata?.invoice_id || String(d.metadata.invoice_id) === invoice.id;
      if (v.ok && d?.status === "success" && sameInvoice && Number(d.amount) >= kobo(Number(invoice.total))) {
        paidAt = d.paid_at ?? new Date().toISOString();
        amountPaid = Number(d.amount) / 100;
      }
    }
    if (!paidAt && invoice.request_code) {
      const r = await paystack(`/paymentrequest/${invoice.request_code}`);
      const d = r.body?.data;
      if (r.ok && mapStatus(d?.status) === "paid") {
        paidAt = d.paid_at ?? new Date().toISOString();
        amountPaid = Number(d.amount_paid ?? d.amount ?? 0) / 100;
      }
    }
    if (!paidAt) return false;
    await db.from("paystack_invoices").update({
      status: "paid", amount_paid: amountPaid, paid_at: paidAt, updated_at: new Date().toISOString(),
      ...(reference ? { paystack_reference: reference } : {}),
    }).eq("id", invoice.id);
  }
  await thankForCarePayment(db, invoice.id);
  return true;
}

/**
 * Once a care invoice is paid: thank the family, say what happens next, and
 * tell staff. Claimed first, so it is only ever sent once.
 */
export async function thankForCarePayment(db: SupabaseClient, invoiceId: string) {
  const { data: claimed } = await db.from("paystack_invoices")
    .update({ care_thanked_at: new Date().toISOString() })
    .eq("id", invoiceId).eq("status", "paid").is("care_thanked_at", null)
    .select("id, total, paid_at, client_id").maybeSingle();
  if (!claimed) return;

  // Which payment of which offer this is.
  let offer: Record<string, any> | null = null;
  let month: number | null = null;
  const { data: direct } = await db.from("care_offers").select("*").eq("invoice_id", invoiceId).maybeSingle();
  if (direct) {
    offer = direct;
    month = direct.accepted_payment === "monthly" ? 1 : null;
  } else {
    const { data: inst } = await db.from("care_offer_instalments").select("number, care_offers(*)").eq("invoice_id", invoiceId).maybeSingle();
    if (inst?.care_offers) { offer = inst.care_offers as Record<string, any>; month = inst.number as number; }
  }
  if (!offer) return;

  const c = offer.content ?? {};
  const months = Number(c.months ?? 0);
  const careFor = String(c.careFor ?? "");
  const option = ((c.options ?? []) as { id: string; title: string }[]).find((o) => o.id === offer!.accepted_option);
  const amount = naira(Number(claimed.total));
  const forWhat = month ? `Month ${month} of ${months}` : `All ${months} months, paid upfront`;
  const paidOn = longDate(String(claimed.paid_at ?? new Date().toISOString()));
  const firstPayment = month === null || month === 1;
  const facts = [
    { label: "Amount", value: amount },
    { label: "For", value: `${forWhat}${option ? `, ${option.title.toLowerCase()}` : ""}` },
    { label: "Paid on", value: paidOn },
    { label: "Reference", value: month && month > 1 ? `${offer.reference} M${month}` : offer.reference },
  ];

  const { data: contact } = await db.from("client_contacts")
    .select("email, first_name, full_name").eq("client_id", offer.client_id).eq("is_primary", true).maybeSingle();
  const to = String(contact?.email ?? "").trim().toLowerCase();
  const first = String(contact?.first_name || String(contact?.full_name ?? "").split(" ")[0] || "Hello");

  const next = [
    { title: "We plan day 0 with you", detail: "We will be in touch within one working day to arrange it." },
    { title: "You meet your nurse", detail: "A meeting and introduction with your nurse before the first shift." },
    { title: "We agree your care plan together", detail: "The daily routine, supplies, days off and emergency plan, agreed with you before care starts." },
    { title: "Care starts", detail: String(c.start ?? "On the agreed date.") },
  ];
  const copy = firstPayment ? await signedCopy(db, offer.signed_pdf_path ?? null) : null;
  // Back to their offer page: the family's own link, kept with the payment.
  const pageUrl = typeof offer.pay_url === "string" && offer.pay_url.startsWith(SITE_URL) ? offer.pay_url.split("?")[0] : null;
  const monthlyNote = offer.accepted_payment === "monthly" && months > 1
    ? [kitParagraph("For each month after this one, we email you a payment link five days before it is due.")]
    : [];

  await sendEmail(to, firstPayment ? `You are all booked in: care for ${careFor}` : `Thank you: month ${month} of ${careFor}'s care is paid`, kitEmail({
    eyebrow: firstPayment ? "Booking confirmed" : "Payment received",
    title: firstPayment ? `Thank you, ${first}` : `Thank you for month ${month}`,
    standfirst: `${amount} received for ${careFor}'s care`,
    preheader: firstPayment ? "Your payment is in. Here is what happens next." : `Your payment for month ${month} is in.`,
    bodyHtml: [
      kitParagraph(firstPayment
        ? `${first}, thank you. We have received your payment, and this email confirms ${careFor}'s care is booked.`
        : `${first}, thank you. We have received your payment for month ${month} of ${careFor}'s care.`),
      kitFacts(facts),
      ...(firstPayment
        ? [kitParagraph(copy
            ? "Your signed agreement is attached: the offer you accepted, your care schedule and the terms of care, with your signature. Please keep it."
            : "Your signed agreement can be downloaded from your offer page at any time.")]
        : []),
      ...(firstPayment ? [kitSubhead("What happens next"), kitSteps(next), ...monthlyNote] : []),
      ...(pageUrl ? [kitButton("View your booking", pageUrl)] : []),
      kitParagraph("Paystack also emails you a receipt for the payment."),
      kitParagraph(WHATSAPP_LINE),
    ].join(""),
  }), copy ? { filename: `Signed care agreement for ${careFor}, Medic Connect.pdf`, content: copy } : undefined);

  const staff = Deno.env.get("NOTIFICATION_EMAIL") ?? "";
  await sendEmail(staff, `Payment received: ${careFor}, ${amount} (${forWhat.toLowerCase()})`, kitEmail({
    eyebrow: "Care payment",
    title: "A care payment has been received",
    standfirst: `${offer.reference}, ${c.preparedFor ?? ""}`,
    bodyHtml: [
      kitFacts(facts),
      kitParagraph(firstPayment
        ? `The family has been thanked and sent ${copy ? "their signed agreement as confirmation of the booking" : "confirmation of the booking (no signed copy was kept, so it was not attached)"}. Get in touch within one working day to plan day 0, and set the day care starts on the record.`
        : "The family has been thanked."),
      kitButton("Open the record", `${SITE_URL}/admin/clients/${offer.client_id}?tab=commercial`),
    ].join(""),
  }));

  await db.from("care_activity").insert({
    client_id: offer.client_id, action: "care_payment_received",
    detail: { offer_id: offer.id, invoice_id: invoiceId, amount: Number(claimed.total), month, emailed: !!to }, actor_id: null,
  });
}
