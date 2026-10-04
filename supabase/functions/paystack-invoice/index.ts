import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  hostedLink,
  invoiceTotals,
  kobo,
  lineTotal,
  mapStatus,
  paystackLineItems,
  type InvoiceLineInput,
} from "../_shared/paystack-invoice.ts";
import { withOpsLog } from "../_shared/ops-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PAYSTACK = "https://api.paystack.co";

async function paystack(path: string, key: string, init?: RequestInit) {
  const res = await fetch(`${PAYSTACK}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && body?.status !== false, body };
}

serve(withOpsLog("paystack-invoice", async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const key = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!key) return json({ error: "Paystack is not configured" }, 500);

    const payload = await req.json().catch(() => ({}));
    const action = String(payload?.action || "");

    if (action === "issue") {
      const { data: superAdmin } = await admin.rpc("is_super_admin", { _user_id: user.id });
      const { data: permission } = await admin.from("admin_permissions").select("permissions,is_active").eq("user_id", user.id).maybeSingle();
      const canManageCareFinance = superAdmin === true || (permission?.is_active !== false && Array.isArray(permission?.permissions) && permission.permissions.includes("care_coordinator"));
      if (!canManageCareFinance) return json({ error: "You do not have permission to issue Care invoices" }, 403);
    }

    if (action === "issue") {
      const id = String(payload.id || "");
      const { data: invoice } = await admin.from("paystack_invoices").select("*").eq("id", id).maybeSingle();
      if (!invoice || invoice.status !== "draft" || !invoice.client_id || !invoice.quote_version_id) return json({ error: "This Care draft invoice is not available" }, 400);
      const { data: storedLines } = await admin.from("paystack_invoice_lines").select("*").eq("invoice_id", id).order("position");
      const lines: InvoiceLineInput[] = (storedLines ?? []).map((line) => ({ description: line.description, quantity: Number(line.quantity), unitPrice: Number(line.unit_price) }));
      if (!lines.length) return json({ error: "Add at least one invoice line" }, 400);
      const customer = await paystack("/customer", key, { method: "POST", body: JSON.stringify({ email: invoice.client_email, first_name: invoice.client_first_name, last_name: invoice.client_last_name, phone: invoice.client_phone || undefined }) });
      const customerCode = customer.body?.data?.customer_code ?? invoice.client_email;
      const request = await paystack("/paymentrequest", key, { method: "POST", body: JSON.stringify({ customer: customerCode, description: invoice.notes || `Invoice ${invoice.invoice_number} from Medic Connect`, line_items: paystackLineItems(lines), tax: Number(invoice.vat_amount) > 0 ? [{ name: `VAT ${invoice.vat_rate}%`, amount: kobo(Number(invoice.vat_amount)) }] : [], currency: invoice.currency || "NGN", due_date: invoice.due_date || undefined, draft: false, send_notification: false, has_invoice: true }) });
      if (!request.ok) return json({ error: request.body?.message || "Paystack could not issue this invoice" }, 400);
      const data = request.body.data; const requestCode = String(data?.request_code || "");
      const { data: updated, error } = await admin.from("paystack_invoices").update({ invoice_number: `MC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`, request_code: requestCode, offline_reference: data?.offline_reference ?? null, hosted_link: requestCode ? hostedLink(requestCode) : null, paystack_id: data?.id ?? null, status: mapStatus(data?.status), sent_at: new Date().toISOString(), issued_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 500);
      await admin.from("care_activity").insert({ client_id: invoice.client_id, action: "invoice_issued", detail: { invoice_id: id, quote_version_id: invoice.quote_version_id, request_code: requestCode }, actor_id: user.id, actor_name: user.email ?? null });
      return json({ invoice: updated });
    }

    if (action === "create") {
      const firstName = String(payload.clientFirstName || "").trim();
      const lastName = String(payload.clientLastName || "").trim();
      const email = String(payload.clientEmail || "").trim();
      const phone = String(payload.clientPhone || "").trim();
      const notes = String(payload.notes || "").trim();
      const type = String(payload.type || "standard");
      const vatRate = Number(payload.vatRate ?? 7.5);
      const dueDate = String(payload.dueDate || "").slice(0, 10);
      const rawLines: InvoiceLineInput[] = Array.isArray(payload.lines) ? payload.lines : [];
      const lines = rawLines
        .map((l) => ({
          description: String(l.description || "").trim(),
          quantity: Number(l.quantity) || 0,
          unitPrice: Number(l.unitPrice) || 0,
        }))
        .filter((l) => l.description.length > 0);

      if (!firstName || !lastName) return json({ error: "First name and last name are required" }, 400);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "A valid client email is required" }, 400);
      if (lines.length === 0) return json({ error: "Add at least one line" }, 400);
      if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) return json({ error: "VAT rate is out of range" }, 400);

      const { subtotal, vatAmount, total } = invoiceTotals(lines, vatRate);
      if (total <= 0) return json({ error: "The invoice total must be greater than zero" }, 400);

      const clientName = `${firstName} ${lastName}`;
      const invoiceNumber = `MC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Customer on Paystack, so the invoice is filed against a person.
      const customer = await paystack("/customer", key, {
        method: "POST",
        body: JSON.stringify({ email, first_name: firstName, last_name: lastName, phone: phone || undefined }),
      });
      const customerCode = customer.body?.data?.customer_code ?? email;

      const request = await paystack("/paymentrequest", key, {
        method: "POST",
        body: JSON.stringify({
          customer: customerCode,
          description: notes || `Invoice ${invoiceNumber} from Medic Connect`,
          line_items: paystackLineItems(lines),
          tax: vatAmount > 0 ? [{ name: `VAT ${vatRate}%`, amount: kobo(vatAmount) }] : [],
          currency: "NGN",
          due_date: dueDate || undefined,
          draft: false,
          send_notification: false,
          has_invoice: true,
        }),
      });

      if (!request.ok) {
        return json({ error: request.body?.message || "Paystack could not create this invoice" }, 400);
      }

      const data = request.body.data;
      const requestCode = String(data?.request_code || "");

      const { data: inserted, error: insertError } = await admin
        .from("paystack_invoices")
        .insert({
          invoice_number: invoiceNumber,
          request_code: requestCode,
          offline_reference: data?.offline_reference ?? null,
          hosted_link: requestCode ? hostedLink(requestCode) : null,
          paystack_id: data?.id ?? null,
          client_id: payload.clientId ?? null,
          client_name: clientName,
          client_first_name: firstName,
          client_last_name: lastName,
          client_email: email,
          client_phone: phone || null,
          type,
          vat_rate: vatRate,
          subtotal,
          vat_amount: vatAmount,
          total,
          notes: notes || null,
          status: mapStatus(data?.status),
          due_date: dueDate || null,
          created_by: user.id,
        })
        .select()
        .single();
      if (insertError) return json({ error: insertError.message }, 500);

      const { error: linesError } = await admin.from("paystack_invoice_lines").insert(
        lines.map((l, i) => ({
          invoice_id: inserted.id,
          position: i,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unitPrice,
          line_total: lineTotal(l),
        }))
      );
      if (linesError) return json({ error: linesError.message }, 500);

      return json({ invoice: inserted });
    }

    if (action === "verify" || action === "archive") {
      const id = String(payload.id || "");
      if (!id) return json({ error: "Invoice id is required" }, 400);
      const { data: invoice } = await admin
        .from("paystack_invoices").select("*").eq("id", id).maybeSingle();
      if (!invoice) return json({ error: "Invoice not found" }, 404);
      if (!invoice.request_code) return json({ error: "This invoice is not on Paystack" }, 400);

      if (action === "archive") {
        const archived = await paystack(`/paymentrequest/archive/${invoice.request_code}`, key, { method: "POST" });
        if (!archived.ok) return json({ error: archived.body?.message || "Paystack could not cancel this invoice" }, 400);
        const { data: updated } = await admin
          .from("paystack_invoices")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", id).select().single();
        return json({ invoice: updated });
      }

      const fetched = await paystack(`/paymentrequest/${invoice.request_code}`, key);
      if (!fetched.ok) return json({ error: fetched.body?.message || "Paystack could not be reached" }, 400);
      const d = fetched.body.data;
      const status = mapStatus(d?.status);
      const { data: updated } = await admin
        .from("paystack_invoices")
        .update({
          status,
          amount_paid: Number(d?.amount_paid ?? 0) / 100,
          paid_at: status === "paid" ? (d?.paid_at ?? new Date().toISOString()) : invoice.paid_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id).select().single();
      return json({ invoice: updated });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
}));
