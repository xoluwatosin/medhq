// The family's side of a care offer: open it, and accept it.
//
// Anyone holding a live link can read the offer it was sent for. Accepting
// records the option, how the family will pay, the name they typed, the time,
// where it came from and the terms version, then tells staff and sends the
// family a confirmation with the payment details. Accepting does not start
// care: staff confirm in writing and arrange the introduction first.
import { createClient } from "npm:@supabase/supabase-js@2";
import { kitEmail, kitButton, kitFacts, kitParagraph, kitSubhead } from "../_shared/kit-email.ts";
import { createCareInvoice, naira, OFFER_TOKEN, offerTokenHash, optionTotals } from "../_shared/care-offer.ts";
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
};

const view = (o: Offer) => ({
  reference: o.reference, status: o.status, content: o.content, terms_version: o.terms_version, terms: o.terms,
  expires_at: o.expires_at, accepted_option: o.accepted_option, accepted_payment: o.accepted_payment,
  accepted_name: o.accepted_name, accepted_at: o.accepted_at, pay_url: o.pay_url,
});

/**
 * The Paystack invoice for what the family accepted: the first month, or
 * every month upfront with the discount. Made once; a failure here never
 * undoes the acceptance, and the next time the page opens it is tried again.
 * Paystack payments mark the invoice paid through the existing webhook.
 */
async function ensurePaymentLink(db: ReturnType<typeof createClient>, o: Offer): Promise<Offer> {
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
    const action = body?.action === "accept" ? "accept" : "load";
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
      return json({ ok: true, offer: view(await ensurePaymentLink(db, o)) });
    }

    // Accept.
    if (o.status === "accepted") return json({ ok: true, offer: view(await ensurePaymentLink(db, o)), already: true });
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

    const { data: accepted, error: acceptError } = await db
      .from("care_offers")
      .update({
        status: "accepted",
        accepted_option: option.id,
        accepted_payment: payment,
        accepted_name: name,
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
    const a = await ensurePaymentLink(db, accepted as Offer);

    await db.from("care_activity").insert({
      client_id: o.client_id, action: "offer_accepted",
      detail: { offer_id: o.id, reference: o.reference, option: option.id, payment, name, terms_version: o.terms_version },
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
      { label: "Accepted by", value: name },
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
        kitParagraph(`First payment due: ${naira(due)}. ${a.pay_url ? "A Paystack payment link was made for it." : "The Paystack link could not be made; it is tried again when the family opens the offer."} Confirm acceptance in writing and arrange the introduction.`),
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
          kitParagraph("We will confirm your booking in writing and arrange a meeting and introduction with your nurse before the first shift. Care starts once the first payment is received."),
          kitButton("View your offer", `${SITE_URL}/o/${plain}`),
          kitParagraph("Need another way to pay? Reply to this email, or WhatsApp us on +234 812 698 8237 and we will arrange it."),
        ].join(""),
      }));
    }

    return json({ ok: true, offer: view(a) });
  } catch (e) {
    console.error("care-offer failed", e instanceof Error ? e.message : e);
    return json({ error: "Something went wrong. Please try again, or contact us." }, 500);
  }
});
