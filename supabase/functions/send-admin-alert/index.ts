// Sends a digest of unresolved admin alerts to the operations email address.
// Triggered by private.analytics_check_alerts() when a spike in sign-up failures is detected.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { kitEmail, kitNotice, kitTable } from "../_shared/kit-email.ts";
import { SITE_URL } from "../_shared/site-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, x-run-key, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const sentKey = req.headers.get("x-run-key");
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let allowed = bearer === serviceKey;
  if (!allowed && sentKey) {
    const { data: keyOk } = await admin.rpc("job_key_check", {
      p_name: "admin_alert_key",
      p_value: sentKey,
    });
    allowed = keyOk === true;
  }
  if (!allowed && bearer) {
    const { data: { user } } = await admin.auth.getUser(bearer);
    if (user) {
      const { data: role } = await admin
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      allowed = Boolean(role);
    }
  }
  if (!allowed) return json({ error: "Not permitted." }, 401);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return json({ error: "Email is not configured." }, 500);

  const { data: alerts, error } = await admin
    .from("admin_alerts")
    .select("id, kind, title, detail, created_at")
    .is("emailed_at", null)
    .is("resolved_at", null)
    .order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 500);
  if (!alerts?.length) return json({ sent: 0 });

  const rows = alerts.map((a) => [
    new Date(a.created_at).toLocaleString("en-GB", { timeZone: "Africa/Lagos" }),
    a.title,
    a.detail?.reason ? `Reason: ${a.detail.reason}` : "",
  ]);

  const bodyHtml = [
    kitNotice("This is an automated health alert from the candidate intake intelligence layer."),
    kitTable(["Time", "Alert", "Detail"], rows),
  ].join("\n");

  const html = kitEmail({
    eyebrow: "Admin Centre",
    title: `${alerts.length} intake alert${alerts.length > 1 ? "s" : ""} need${alerts.length > 1 ? "" : "s"} attention`,
    standfirst: "Open the Intelligence dashboard to resolve or investigate these alerts.",
    preheader: "Medic Connect intake health alert",
    bodyHtml: [
      kitNotice("This is an automated health alert from the candidate intake intelligence layer."),
      kitTable(["Time", "Alert", "Detail"], rows),
      `<p style="font-family:'Figtree','Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.75;color:#3A4152;margin:18px 0 0;"><a href="${SITE_URL}/admin/intelligence" style="background:#3B4DC4;color:#ffffff;padding:14px 30px;text-decoration:none;display:inline-block;font-weight:600;">Open Intelligence</a></p>`,
    ].join("\n"),
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: "Medic Connect <noreply@medicconnect.co>",
      to: ["hello@medicconnect.co"],
      subject: `Intake health: ${alerts.length} alert${alerts.length > 1 ? "s" : ""}`,
      html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    return json({ error: "Resend failed", detail }, 502);
  }

  const ids = alerts.map((a) => a.id);
  await admin.from("admin_alerts").update({ emailed_at: new Date().toISOString() }).in("id", ids);

  return json({ sent: ids.length });
});
