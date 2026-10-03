// Admin-only: verifies the ADMIN_ALERT_KEY run key and proves that intake
// health alerts actually reach the operations inbox. Never returns the key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "Not permitted." }, 401);
  const { data: { user } } = await admin.auth.getUser(bearer);
  if (!user) return json({ error: "Not permitted." }, 401);
  const { data: role } = await admin
    .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!role) return json({ error: "Not permitted." }, 401);

  const keyName = "admin_alert_key";
  const { data: keyValue } = await admin.rpc("job_key_value", { p_name: keyName });

  const logAudit = (action: string, detail: Record<string, unknown>) =>
    admin.from("job_key_audit").insert({
      key_name: keyName,
      action,
      actor_id: user.id,
      actor_email: user.email,
      detail,
    });

  if (!keyValue) {
    await logAudit("test_failed", { stage: "key_missing" });
    return json({ ok: false, stage: "key_missing", message: "No alert key is stored. Rotate to mint one." });
  }

  const { data: check } = await admin.rpc("job_key_check", { p_name: keyName, p_value: keyValue });
  if (!check) {
    await logAudit("test_failed", { stage: "key_invalid" });
    return json({ ok: false, stage: "key_invalid", message: "The stored alert key failed validation." });
  }

  // A real, resolvable alert row so the digest has something to carry.
  const { data: alertRow, error: alertError } = await admin
    .from("admin_alerts")
    .insert({
      kind: "test",
      title: "Test alert from the Admin Centre",
      detail: { reason: "manual_test", requested_by: user.email },
    })
    .select("id")
    .single();
  if (alertError) {
    await logAudit("test_failed", { stage: "alert_insert", message: alertError.message });
    return json({ ok: false, stage: "alert_insert", message: alertError.message });
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/send-admin-alert`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-run-key": keyValue },
    body: JSON.stringify({ test: true }),
  });
  const detailText = await res.text();

  if (!res.ok) {
    await admin.from("admin_alerts")
      .update({ resolved_at: new Date().toISOString() }).eq("id", alertRow.id);
    await logAudit("test_failed", { stage: "dispatch", status: res.status, detail: detailText.slice(0, 500) });
    return json({ ok: false, stage: "dispatch", status: res.status, message: detailText.slice(0, 500) });
  }

  await admin.from("admin_alerts")
    .update({ resolved_at: new Date().toISOString() }).eq("id", alertRow.id);
  await logAudit("test_passed", { dispatch: detailText.slice(0, 200) });

  return json({
    ok: true,
    stage: "sent",
    message: "The alert key is valid and a test digest was dispatched to hello@medicconnect.co.",
  });
});
