import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { kitEmail, kitMarkdown, kitNotice, kitTable, kitTotals, kitFacts } from "../_shared/kit-email.ts";
import { emailTags } from "../_shared/email-tags.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
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

    const { invoiceId } = await req.json();
    if (typeof invoiceId !== "string" || !invoiceId) return json({ error: "Invoice id is required" }, 400);

    // Everything on the email comes from the stored invoice, never from the browser.
    const { data: invoice } = await admin
      .from("paystack_invoices").select("*").eq("id", invoiceId).maybeSingle();
    if (!invoice) return json({ error: "Invoice not found" }, 404);

    const { data: lines } = await admin
      .from("paystack_invoice_lines").select("*").eq("invoice_id", invoiceId).order("position");

    const money = (n: unknown) => `\u20a6${Number(n || 0).toLocaleString()}`;
    const rows = (lines ?? []).map((l: any) => [
      String(l.description ?? ""),
      String(Number(l.quantity) || 0),
      money(l.unit_price),
      money(l.line_total),
    ]);

    const totals: { label: string; value: string; strong?: boolean }[] = [
      { label: "Subtotal", value: money(invoice.subtotal) },
    ];
    if (Number(invoice.vat_amount) > 0) {
      totals.push({ label: `VAT ${invoice.vat_rate}%`, value: money(invoice.vat_amount) });
    }
    totals.push({ label: "Total due", value: money(invoice.total), strong: true });

    const dueDate = invoice.due_date
      ? new Date(invoice.due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "";
    const link = typeof invoice.hosted_link === "string" && /^https:\/\//i.test(invoice.hosted_link)
      ? invoice.hosted_link : "";

    const html = kitEmail({
      eyebrow: "Invoice",
      title: `Invoice ${invoice.invoice_number}`,
      standfirst: dueDate ? `For ${invoice.client_name}. Payable by ${dueDate}.` : `For ${invoice.client_name}.`,
      preheader: `Invoice ${invoice.invoice_number} from Medic Connect, ${money(invoice.total)} due${dueDate ? ` ${dueDate}` : ""}`,
      bodyHtml: [
        invoice.type === "assessment" ? kitNotice("Payment is due before the assessment visit") : "",
        kitFacts([
          { label: "Invoice", value: String(invoice.invoice_number) },
          { label: "Billed to", value: String(invoice.client_name) },
          ...(dueDate ? [{ label: "Due date", value: dueDate }] : []),
          ...(invoice.offline_reference ? [{ label: "Transfer reference", value: String(invoice.offline_reference) }] : []),
        ]),
        kitTable(["Description", "Qty", "Price", "Amount"], rows, ["left", "center", "right", "right"]),
        kitTotals(totals),
        invoice.notes ? kitMarkdown(String(invoice.notes)) : "",
        link
          ? kitMarkdown(`You can settle this online, the link is secure and takes card or transfer.\n\n[[cta:Pay this invoice|${link}]]`)
          : kitMarkdown("Please pay by transfer to the account we hold on file, quoting the invoice number as the reference."),
      ].join("\n"),
      footnote: "Medic Connect Healthcare Ltd, Lagos, Nigeria. HEFAMAA accredited. Questions about this invoice: hello@medicconnect.co",
    });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "Email service not configured" }, 500);

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Medic Connect <invoices@medicconnect.co>",
        to: [invoice.client_email],
        subject: `Invoice ${invoice.invoice_number} from Medic Connect`,
        html,
        tags: emailTags("invoice"),
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: "Email send failed", detail }, 502);
    }

    await admin
      .from("paystack_invoices")
      .update({
        sent_at: new Date().toISOString(),
        status: invoice.status === "paid" ? invoice.status : "sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    return json({ success: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
