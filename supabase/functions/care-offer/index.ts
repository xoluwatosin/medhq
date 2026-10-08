// The family's side of a care offer: open it, sign and accept it, and pay.
//
// Anyone holding a live link can read the offer it was sent for. Accepting
// records the option, how the family will pay, the name they typed, the
// signature they drew, the time,
// where it came from and the terms version, then tells staff and sends the
// family a confirmation with the payment details. Accepting does not start
// care: staff confirm in writing and arrange the introduction first.
//
// Paying opens a Paystack checkout made there and then, which brings the
// family back to this page; the payment is then confirmed with Paystack and
// the family thanked by email. Opening the page also checks, so a payment is
// never missed if the family closes Paystack before it sends them back.
//
// Straight after accepting, the family's page makes the signed copy of the
// agreement and hands it back here to keep. Once the first payment is in, it
// is emailed to them as our written confirmation of the booking.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { kitEmail, kitButton, kitFacts, kitParagraph, kitSubhead } from "../_shared/kit-email.ts";
import { naira, OFFER_TOKEN, offerTokenHash, optionTotals } from "../_shared/care-offer.ts";
import { confirmCarePayment, createCareInvoice, startCareCheckout } from "../_shared/care-payment.ts";
import { SITE_URL } from "../_shared/site-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Offer = {
  id: string; client_id: string; reference: string; status: string; content: Record<string, any>;
  terms_version: string; terms: unknown; expires_at: string | null; first_opened_at: string | null;
  accepted_option: string | null; accepted_payment: string | null; accepted_name: string | null; accepted_at: string | null;
  invoice_id: string | null; pay_url: string | null;
  accepted_signature: string | null; signed_pdf_path: string | null;
};

/** A drawn signature: a PNG, of a sensible size. */
const SIGNATURE = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
const MAX_SIGNATURE = 400_000;
const MAX_PDF_BASE64 = 6_000_000;

type Db = SupabaseClient;

/** What the family's page shows, with whether the first payment is in. */
const view = async (db: Db, o: Offer) => {
  let firstPaid = false;
  if (o.invoice_id) {
    const { data } = await db.from("paystack_invoices").select("status").eq("id", o.invoice_id).maybeSingle();
    firstPaid = data?.status === "paid";
  }
  return {
    reference: o.reference, status: o.status, content: o.content, terms_version: o.terms_version, terms: o.terms,
    expires_at: o.expires_at, accepted_option: o.accepted_option, accepted_payment: o.accepted_payment,
    accepted_name: o.accepted_name, accepted_at: o.accepted_at, pay_url: o.pay_url ? "pay" : null, first_paid: firstPaid,
    accepted_signature: o.status === "accepted" ? o.accepted_signature : null, signed_copy: !!o.signed_pdf_path,
  };
};

/** Which payment: "1" is the first (or the upfront one), "M2" onwards a later month. */
const PAYMENT = /^(1|M\d{1,2})$/;

/**
 * The Paystack invoice for what the family accepted: the first month, or
 * every month upfront with the discount. Made once; a failure here never
 * undoes the acceptance, and the next time the page opens it is tried again.
 * Paystack payments mark the invoice paid through the existing webhook.
 */
async function ensurePaymentLink(db: Db, o: Offer, plain: string): Promise<Offer> {
  if (o.status !== "accepted" || o.pay_url) return o;
  const options = (o.content?.options ?? []) as { id: string; title: string; monthly: number }[];
  const option = options.find((x) => x.id === o.accepted_option);
  if (!option) return o;
  const months = Number(o.content?.months ?? 0);
  const pct = Number(o.content?.upfrontDiscountPercent ?? 0);
  const t = optionTotals(option, months, pct);
  const upfront = o.accepted_payment === "upfront";
  const careFor = String(o.content?.careFor ?? "");
  const service = String(o.content?.serviceTitle ?? "Care");
  const made = await createCareInvoice(db, {
    clientId: o.client_id,
    reference: o.reference,
    amount: upfront ? t.upfront : t.monthly,
    description: upfront
      ? `${service}, ${option.title}, for ${careFor}: all ${months} months paid upfront (${pct}% discount, saving ${naira(t.saving)})`
      : `${service}, ${option.title}, for ${careFor}: month 1 of ${months}`,
    payUrl: `${SITE_URL}/o/${plain}?pay=1`,
  });
  if (!made) return o;
  const { data: updated } = await db.from("care_offers")
    .update({ invoice_id: made.invoiceId, pay_url: made.payUrl })
    .eq("id", o.id).is("pay_url", null).select("*").maybeSingle();
  return (updated as Offer | null) ?? { ...o, invoice_id: made.invoiceId, pay_url: made.payUrl };
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || !to) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Medic Connect <hello@medicconnect.co>", to: [to], reply_to: "hello@medicconnect.co", subject, html }),
  });
  if (!res.ok) console.error("care-offer email failed", res.status, await res.text().catch(() => ""));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const plain = typeof body?.token === "string" ? body.token.trim().toUpperCase() : "";
    const action = ["accept", "pay", "confirm", "signed_copy"].includes(body?.action)
      ? body.action as "accept" | "pay" | "confirm" | "signed_copy"
      : "load";
    if (!OFFER_TOKEN.test(plain)) return json({ error: "This link is not valid" }, 404);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: link } = await db
      .from("care_offer_links")
      .select("id, offer_id, revoked_at, first_opened_at")
      .eq("token_hash", await offerTokenHash(plain))
      .maybeSingle();
    if (!link || link.revoked_at) return json({ error: "This link is not valid. Ask us for a new one." }, 404);

    const { data: offer } = await db.from("care_offers").select("*").eq("id", link.offer_id).maybeSingle();
    if (!offer) return json({ error: "This link is not valid" }, 404);
    const o = offer as Offer;
    if (o.status === "withdrawn") return json({ error: "This offer has been withdrawn. Contact us and we will help." }, 410);
    if (o.status === "draft") return json({ error: "This offer is not ready yet" }, 404);

    if (action === "load") {
      const now = new Date().toISOString();
      if (!link.first_opened_at) {
        await db.from("care_offer_links").update({ first_opened_at: now }).eq("id", link.id);
      }
      if (!o.first_opened_at) {
        await db.from("care_offers").update({ first_opened_at: now }).eq("id", o.id).is("first_opened_at", null);
        await db.from("care_activity").insert({ client_id: o.client_id, action: "offer_opened", detail: { offer_id: o.id, reference: o.reference }, actor_id: null });
      }
      let current = await ensurePaymentLink(db, o, plain);
      // A payment made but not yet recorded (the family closed Paystack
      // before it sent them back) is picked up here.
      if (current.invoice_id) await confirmCarePayment(db, current.invoice_id);
      current = ((await db.from("care_offers").select("*").eq("id", o.id).maybeSingle()).data as Offer | null) ?? current;
      return json({ ok: true, offer: await view(db, current) });
    }

    // The signed copy, made by the family's page from the accepted offer. Kept
    // once; it is what we send them when their payment is in.
    if (action === "signed_copy") {
      if (o.status !== "accepted" || !o.accepted_signature) return json({ error: "Accept the offer first" }, 409);
      if (o.signed_pdf_path) return json({ ok: true, already: true });
      const b64 = typeof body?.pdf_base64 === "string" ? body.pdf_base64 : "";
      if (!b64 || b64.length > MAX_PDF_BASE64) return json({ error: "The signed copy could not be kept" }, 400);
      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      } catch {
        return json({ error: "The signed copy could not be kept" }, 400);
      }
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return json({ error: "The signed copy could not be kept" }, 400);
      const path = `${o.id}/${o.reference} signed.pdf`;
      const { error: upError } = await db.storage.from("care-agreements").upload(path, bytes, { contentType: "application/pdf", upsert: false });
      if (upError && !/exists/i.test(upError.message)) throw upError;
      await db.from("care_offers").update({ signed_pdf_path: path }).eq("id", o.id).is("signed_pdf_path", null);
      await db.from("care_activity").insert({ client_id: o.client_id, action: "offer_signed_copy_kept", detail: { offer_id: o.id, reference: o.reference }, actor_id: null });
      return json({ ok: true });
    }

    if (action === "pay" || action === "confirm") {
      if (o.status !== "accepted") return json({ error: "Accept the offer first" }, 409);
      const which = typeof body?.payment === "string" && PAYMENT.test(body.payment) ? body.payment as string : "1";
      let invoiceId: string | null = null;
      let month: number | null = null;
      if (which === "1") {
        invoiceId = (await ensurePaymentLink(db, o, plain)).invoice_id;
      } else {
        month = Number(which.slice(1));
        const { data: inst } = await db.from("care_offer_instalments").select("invoice_id").eq("offer_id", o.id).eq("number", month).maybeSingle();
        invoiceId = inst?.invoice_id ?? null;
      }
      if (!invoiceId) return json({ error: "This payment is not ready yet. Message us and we will help." }, 409);

      if (action === "confirm") {
        const reference = typeof body?.reference === "string" ? body.reference.slice(0, 120) : null;
        const paid = await confirmCarePayment(db, invoiceId, reference);
        const fresh = ((await db.from("care_offers").select("*").eq("id", o.id).maybeSingle()).data as Offer | null) ?? o;
        return json({ ok: true, paid, month, offer: await view(db, fresh) });
      }

      const started = await startCareCheckout(db, invoiceId, `${SITE_URL}/o/${plain}?paid=${which}`, { offer_id: o.id, month });
      if (!started) return json({ error: "Paystack could not be reached. Please try again, or pay by bank transfer." }, 502);
      if ("paid" in started) return json({ ok: true, paid: true });
      return json({ ok: true, url: started.url });
    }

    // Accept.
    if (o.status === "accepted") return json({ ok: true, offer: await view(db, await ensurePaymentLink(db, o, plain)), already: true });
    if (o.expires_at && new Date(o.expires_at) < new Date()) {
      return json({ error: "This offer has expired. Contact us and we will send you an up-to-date one." }, 410);
    }
    const options = (o.content?.options ?? []) as { id: string; title: string; monthly: number }[];
    const option = options.find((x) => x.id === body?.option);
    if (!option) return json({ error: "Choose an option" }, 400);
    const payment = body?.payment === "upfront" ? "upfront" : body?.payment === "monthly" ? "monthly" : null;
    if (!payment) return json({ error: "Choose how you will pay" }, 400);
    if (body?.agree !== true) return json({ error: "Please confirm you have read the terms" }, 400);
    const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    if (name.length < 3 || name.length > 120 || !name.includes(" ")) return json({ error: "Type your full name, first and last" }, 400);
    const signature = typeof body?.signature === "string" ? body.signature : "";
    if (!SIGNATURE.test(signature) || signature.length > MAX_SIGNATURE) return json({ error: "Please sign in the box" }, 400);

    const { data: accepted, error: acceptError } = await db
      .from("care_offers")
      .update({
        status: "accepted",
        accepted_option: option.id,
        accepted_payment: payment,
        accepted_name: name,
        accepted_signature: signature,
        accepted_at: new Date().toISOString(),
        accepted_ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
        accepted_user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400) || null,
      })
      .eq("id", o.id)
      .eq("status", "sent")
      .select("*")
      .maybeSingle();
    if (acceptError) throw acceptError;
    if (!accepted) return json({ error: "This offer can no longer be accepted. Contact us and we will help." }, 409);
    const a = await ensurePaymentLink(db, accepted as Offer, plain);

    await db.from("care_activity").insert({
      client_id: o.client_id, action: "offer_accepted",
      detail: { offer_id: o.id, reference: o.reference, option: option.id, payment, name, signed: true, terms_version: o.terms_version },
      actor_id: null,
    });

    const months = Number(o.content?.months ?? 0);
    const pct = Number(o.content?.upfrontDiscountPercent ?? 0);
    const t = optionTotals(option, months, pct);
    const due = payment === "upfront" ? t.upfront : t.monthly;
    const pay = o.content?.payment ?? {};
    const facts = [
      { label: "Option", value: option.title },
      { label: "Payment", value: payment === "upfront" ? `All ${months} months upfront, ${naira(t.upfront)} (a ${pct}% discount, saving ${naira(t.saving)})` : `Monthly, ${naira(t.monthly)} a month` },
      { label: "Signed by", value: name },
      { label: "Terms", value: o.terms_version },
    ];

    // Staff are told straight away.
    const staff = Deno.env.get("NOTIFICATION_EMAIL") ?? "";
    await sendEmail(staff, `Offer accepted: ${o.content?.careFor ?? o.reference}, ${option.title}`, kitEmail({
      eyebrow: "Care offer",
      title: "An offer has been accepted",
      standfirst: `${o.reference}, ${o.content?.preparedFor ?? ""}`,
      bodyHtml: [
        kitFacts(facts),
        kitParagraph(`First payment due: ${naira(due)}. ${a.pay_url ? "The family can pay it online from the offer page." : "The payment could not be set up; it is tried again when the family opens the offer."} Once the first payment is in, the family is emailed their signed copy as our written confirmation.`),
        kitButton("Open the record", `${SITE_URL}/admin/clients/${o.client_id}?tab=commercial`),
      ].join(""),
    }));

    // The family's own confirmation goes to the main contact.
    const { data: contact } = await db
      .from("client_contacts").select("email, first_name, full_name")
      .eq("client_id", o.client_id).eq("is_primary", true).maybeSingle();
    const to = String(contact?.email ?? "").trim().toLowerCase();
    if (to) {
      const first = String(contact?.first_name || String(contact?.full_name ?? "").split(" ")[0] || "Hello");
      await sendEmail(to, `You have accepted your care offer, ${o.reference}`, kitEmail({
        eyebrow: "Care offer",
        title: "Thank you, your choice is recorded",
        standfirst: `${o.content?.serviceTitle ?? "Care"} for ${o.content?.careFor ?? ""}`,
        bodyHtml: [
          kitParagraph(`${first}, thank you. Here is what you accepted.`),
          kitFacts(facts),
          kitSubhead(`Your first payment: ${naira(due)}`),
          ...(a.pay_url ? [
            kitParagraph("Pay online by card, bank transfer or USSD through Paystack:"),
            kitButton("Pay with Paystack", a.pay_url),
            kitParagraph("Or pay by bank transfer to:"),
          ] : [kitParagraph("Pay by bank transfer to:")]),
          kitFacts([
            { label: "Amount", value: naira(due) },
            { label: "Bank", value: String(pay.bankName ?? "") },
            { label: "Account name", value: String(pay.accountName ?? "") },
            { label: "Account number", value: String(pay.accountNumber ?? "") },
            { label: "Reference", value: o.reference },
          ]),
          kitParagraph("Once your payment is received, we email you your signed agreement to confirm your booking, and we will be in touch to plan day 0 with you: meeting your nurse and agreeing your care plan before care starts."),
          kitButton("View your offer", `${SITE_URL}/o/${plain}`),
          kitParagraph("Need another way to pay? Reply to this email, or WhatsApp us on +234 812 698 8237 and we will arrange it."),
        ].join(""),
      }));
    }

    return json({ ok: true, offer: await view(db, a) });
  } catch (e) {
    console.error("care-offer failed", e instanceof Error ? e.message : e);
    return json({ error: "Something went wrong. Please try again, or contact us." }, 500);
  }
});
