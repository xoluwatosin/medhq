import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
import { mapStatus } from "../_shared/paystack-invoice.ts";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const key = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!key) return new Response("Not configured", { status: 500 });

  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const expected = createHmac("sha512", key).update(raw).digest("hex");
  if (signature.length !== expected.length || signature !== expected) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  const name = String(event?.event || "");
  if (!name.startsWith("paymentrequest.")) return new Response("ok", { status: 200 });

  const data = event.data ?? {};
  const requestCode = data.request_code ?? data.offline_reference;
  if (!requestCode) return new Response("ok", { status: 200 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const status = name === "paymentrequest.success" ? "paid" : mapStatus(data.status);
  const amountPaid = Number(data.amount_paid ?? data.amount ?? 0) / 100;

  await admin
    .from("paystack_invoices")
    .update({
      status,
      amount_paid: amountPaid,
      paid_at: status === "paid" ? (data.paid_at ?? new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("request_code", data.request_code ?? requestCode);

  return new Response("ok", { status: 200 });
});
