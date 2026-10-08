// Care offer links and money, shared by the family's page and staff sending.
//
// A link reads MC-2610-0102-O1-K7M4Q2XP: the offer reference, then a secret.
// Only its hash is kept. Totals are worked out the same way as on the page.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { hashToken } from "./care-form.ts";
import { hostedLink, kobo, mapStatus } from "./paystack-invoice.ts";

export const OFFER_TOKEN = /^MC-\d{4}-\d{4,}-O\d+-[A-Z0-9]{8}$/;

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newOfferSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes).map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const offerTokenHash = (plain: string) => hashToken(plain);

export interface OfferOption { id: string; title: string; monthly: number }

export const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

export function optionTotals(option: OfferOption, months: number, discountPercent: number) {
  const total = option.monthly * months;
  const upfront = Math.round((total * (100 - discountPercent)) / 100 / 1000) * 1000;
  return { monthly: option.monthly, total, upfront, saving: total - upfront };
}

/**
 * A Paystack invoice for one care payment, filed with the site's invoices
 * against the client's main contact. Returns null if it could not be made;
 * the caller decides when to try again. Paid status arrives through the
 * existing Paystack webhook.
 */
export async function createCareInvoice(
  db: SupabaseClient,
  args: { clientId: string; reference: string; amount: number; description: string },
): Promise<{ invoiceId: string; payUrl: string } | null> {
  const key = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!key || !(args.amount > 0)) return null;
  const { data: contact } = await db
    .from("client_contacts").select("id, full_name, first_name, last_name, email, phone")
    .eq("client_id", args.clientId).eq("is_primary", true).maybeSingle();
  const email = String(contact?.email ?? "").trim().toLowerCase();
  if (!email) return null;
  const first = String(contact?.first_name || String(contact?.full_name ?? "").split(" ")[0] || "");
  const last = String(contact?.last_name || String(contact?.full_name ?? "").split(" ").slice(1).join(" ") || "");

  const call = async (path: string, payload: unknown) => {
    const res = await fetch(`https://api.paystack.co${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const out = await res.json().catch(() => ({}));
    return { ok: res.ok && out?.status !== false, body: out };
  };

  try {
    const customer = await call("/customer", { email, first_name: first || undefined, last_name: last || undefined, phone: contact?.phone || undefined });
    const request = await call("/paymentrequest", {
      customer: customer.body?.data?.customer_code ?? email,
      description: `Care offer ${args.reference} from Medic Connect`,
      line_items: [{ name: args.description, amount: kobo(args.amount), quantity: 1 }],
      currency: "NGN",
      draft: false,
      send_notification: false,
      has_invoice: true,
    });
    if (!request.ok) {
      console.error("care invoice paystack", request.body?.message);
      return null;
    }
    const data = request.body.data;
    const code = String(data?.request_code ?? "");
    if (!code) return null;
    const { data: invoice, error } = await db.from("paystack_invoices").insert({
      invoice_number: `MC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`,
      request_code: code,
      offline_reference: data?.offline_reference ?? null,
      hosted_link: hostedLink(code),
      paystack_id: data?.id ?? null,
      client_id: args.clientId,
      recipient_contact_id: contact?.id ?? null,
      client_name: String(contact?.full_name ?? `${first} ${last}`).trim() || email,
      client_first_name: first || null,
      client_last_name: last || null,
      client_email: email,
      client_phone: contact?.phone ?? null,
      vat_rate: 0,
      subtotal: args.amount,
      vat_amount: 0,
      total: args.amount,
      notes: `Care offer ${args.reference}`,
      status: mapStatus(data?.status),
      sent_at: new Date().toISOString(),
      issued_at: new Date().toISOString(),
    }).select("id").single();
    if (error) throw error;
    await db.from("paystack_invoice_lines").insert({
      invoice_id: invoice.id, position: 0, description: args.description, quantity: 1, unit_price: args.amount, line_total: args.amount,
    });
    await db.from("care_activity").insert({
      client_id: args.clientId, action: "invoice_issued",
      detail: { invoice_id: invoice.id, request_code: code, reference: args.reference, amount: args.amount }, actor_id: null,
    });
    return { invoiceId: invoice.id as string, payUrl: hostedLink(code) };
  } catch (e) {
    console.error("care invoice failed", e instanceof Error ? e.message : e);
    return null;
  }
}
