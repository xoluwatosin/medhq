// Monthly care payments, made and sent before they are due.
//
// Runs each morning. Every monthly payment due within five days that has not
// been billed is filed as an invoice, and the family is emailed the amount,
// the due date, a Pay with Paystack button (a fresh link to their offer page,
// which opens the checkout) and the bank details. The run also asks Paystack
// about any care payment still unpaid, so none is missed if a webhook is. Staff can also bill
// one payment straight away from the client record. A payment is claimed
// before Paystack is called, so two runs never bill it twice; if Paystack
// fails, the claim is released and the next run tries again.
import { createClient } from "npm:@supabase/supabase-js@2";
import { kitButton, kitEmail, kitFacts, kitList, kitParagraph, kitSubhead } from "../_shared/kit-email.ts";
import { naira, newOfferSecret, offerTokenHash } from "../_shared/care-offer.ts";
import { confirmCarePayment, createCareInvoice } from "../_shared/care-payment.ts";
import { SITE_URL } from "../_shared/site-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DAYS_AHEAD = 5;
const UUID = /^[0-9a-f-]{36}$/i;

const longDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || !to) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Medic Connect <hello@medicconnect.co>", to: [to], reply_to: "hello@medicconnect.co", subject, html }),
  });
  if (!res.ok) console.error("care-offer-billing email failed", res.status, await res.text().catch(() => ""));
  return res.ok;
}

type Row = {
  id: string; offer_id: string; number: number; due_on: string; amount: number;
  care_offers: { id: string; client_id: string; reference: string; status: string; accepted_payment: string | null; accepted_option: string | null; content: Record<string, any> };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization") ?? "";
    const cronSecret = Deno.env.get("CRON_SECRET");
    const body = await req.json().catch(() => ({}));
    const single = typeof body?.instalment_id === "string" && UUID.test(body.instalment_id) ? body.instalment_id as string : null;

    // The daily job, or a member of staff billing one payment now.
    let actor: string | null = null;
    if (!(cronSecret && auth === `Bearer ${cronSecret}`)) {
      if (!auth.startsWith("Bearer ") || !single) return json({ error: "Unauthorized" }, 401);
      const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
      const { data: { user } } = await caller.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);
      const { data: role } = await db.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!role) return json({ error: "Forbidden" }, 403);
      actor = user.id;
    }

    const horizon = new Date(Date.now() + DAYS_AHEAD * 86400000).toISOString().slice(0, 10);
    let query = db.from("care_offer_instalments")
      .select("id, offer_id, number, due_on, amount, care_offers!inner(id, client_id, reference, status, accepted_payment, accepted_option, content)")
      .is("invoice_id", null)
      .is("issued_at", null)
      .eq("care_offers.status", "accepted")
      .order("due_on")
      .limit(50);
    query = single ? query.eq("id", single) : query.lte("due_on", horizon);
    const { data: due, error } = await query;
    if (error) throw error;

    const billed: string[] = [];
    const failed: string[] = [];
    for (const row of (due ?? []) as unknown as Row[]) {
      const o = row.care_offers;
      // Claimed first, so a second run never bills the same month.
      const { data: claimed } = await db.from("care_offer_instalments")
        .update({ issued_at: new Date().toISOString() })
        .eq("id", row.id).is("issued_at", null).select("id").maybeSingle();
      if (!claimed) continue;

      const months = Number(o.content?.months ?? 0);
      const option = ((o.content?.options ?? []) as { id: string; title: string }[]).find((x) => x.id === o.accepted_option);
      const careFor = String(o.content?.careFor ?? "");
      const service = String(o.content?.serviceTitle ?? "Care");
      // A fresh link to the offer page, which opens the checkout for this month.
      const plain = `${o.reference}-${newOfferSecret()}`;
      const { error: linkError } = await db.from("care_offer_links").insert({
        offer_id: o.id, token_hash: await offerTokenHash(plain), channel: "email", created_by: actor,
      });
      const made = linkError ? null : await createCareInvoice(db, {
        clientId: o.client_id,
        reference: o.reference,
        amount: Number(row.amount),
        description: `${service}${option ? `, ${option.title}` : ""}, for ${careFor}: month ${row.number} of ${months}, from ${longDate(row.due_on)}`,
        payUrl: `${SITE_URL}/o/${plain}?pay=M${row.number}`,
      });
      if (!made) {
        await db.from("care_offer_instalments").update({ issued_at: null }).eq("id", row.id);
        failed.push(`${o.reference} month ${row.number}`);
        continue;
      }
      await db.from("care_offer_instalments").update({ invoice_id: made.invoiceId, pay_url: made.payUrl }).eq("id", row.id);

      const { data: contact } = await db.from("client_contacts")
        .select("email, first_name, full_name").eq("client_id", o.client_id).eq("is_primary", true).maybeSingle();
      const to = String(contact?.email ?? "").trim().toLowerCase();
      const first = String(contact?.first_name || String(contact?.full_name ?? "").split(" ")[0] || "Hello");
      const pay = o.content?.payment ?? {};
      const sent = await sendEmail(to, `${careFor}'s care: next month's payment`, kitEmail({
        eyebrow: "Care payment",
        title: `Month ${row.number} of ${months} for ${careFor}`,
        standfirst: `${naira(Number(row.amount))}, due ${longDate(row.due_on)}`,
        bodyHtml: [
          kitParagraph(`${first}, here is the payment for the next month of ${careFor}'s care. It is due on ${longDate(row.due_on)}.`),
          kitParagraph("Pay online by card, bank transfer or USSD through Paystack:"),
          kitButton(`Pay ${naira(Number(row.amount))} with Paystack`, made.payUrl),
          kitSubhead("Or pay by bank transfer"),
          kitFacts([
            { label: "Amount", value: naira(Number(row.amount)) },
            { label: "Bank", value: String(pay.bankName ?? "") },
            { label: "Account name", value: String(pay.accountName ?? "") },
            { label: "Account number", value: String(pay.accountNumber ?? "") },
            { label: "Reference", value: `${o.reference} M${row.number}` },
          ]),
          kitParagraph("Need another way to pay? Reply to this email, or WhatsApp us on +234 812 698 8237 and we will arrange it."),
        ].join(""),
      }));
      if (sent) await db.from("care_offer_instalments").update({ emailed_at: new Date().toISOString() }).eq("id", row.id);
      await db.from("care_activity").insert({
        client_id: o.client_id, action: "care_payment_billed",
        detail: { offer_id: o.id, instalment: row.number, amount: row.amount, due_on: row.due_on, emailed: sent }, actor_id: actor,
      });
      billed.push(`${o.reference} month ${row.number}${sent ? "" : " (email not sent)"}`);
    }

    // Any care payment still unpaid is checked with Paystack; a payment found
    // is recorded and the family thanked.
    let confirmed = 0;
    if (!single) {
      const { data: offers } = await db.from("care_offers").select("invoice_id").eq("status", "accepted").not("invoice_id", "is", null);
      const { data: months } = await db.from("care_offer_instalments").select("invoice_id").not("invoice_id", "is", null);
      const ids = [...new Set([...(offers ?? []), ...(months ?? [])].map((r: { invoice_id: string }) => r.invoice_id))];
      if (ids.length) {
        const { data: unpaid } = await db.from("paystack_invoices").select("id").in("id", ids).neq("status", "paid")
          .or("paystack_reference.not.is.null,request_code.not.is.null");
        for (const inv of unpaid ?? []) if (await confirmCarePayment(db, inv.id)) confirmed++;
      }
    }

    // Staff hear about every run that did something.
    const staff = Deno.env.get("NOTIFICATION_EMAIL") ?? "";
    if (staff && (billed.length || failed.length)) {
      await sendEmail(staff, `Care payments sent: ${billed.length}${failed.length ? `, ${failed.length} could not be made` : ""}`, kitEmail({
        eyebrow: "Care payments",
        title: "Monthly payments sent to families",
        bodyHtml: [
          ...(billed.length ? [kitSubhead("Sent"), kitList(billed)] : []),
          ...(failed.length ? [kitSubhead("Could not be made on Paystack, will try again tomorrow"), kitList(failed)] : []),
          kitButton("Open Care", `${SITE_URL}/admin/clients`),
        ].join(""),
      }));
    }
    return json({ ok: true, billed, failed, confirmed });
  } catch (e) {
    console.error("care-offer-billing failed", e instanceof Error ? e.message : e);
    return json({ error: "Billing run failed" }, 500);
  }
});
