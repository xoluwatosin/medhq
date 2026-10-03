// Sending a test of an email being built.
//
// Administrators only, and the rendered HTML comes from the browser that is
// showing the preview, so the test is literally what was on screen.
import { createClient } from "npm:@supabase/supabase-js@2";
import { emailTags } from "../_shared/email-tags.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ error: "Email service not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sign in first" }, 401);

    const scoped = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await scoped.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Sign in first" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");
    if (!roles?.length) return json({ error: "Administrators only" }, 403);

    const body = await req.json().catch(() => ({}));
    const to = String(body.to ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    const html = String(body.html ?? "");
    const text = String(body.text ?? "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: "That is not an email address" }, 400);
    if (!html) return json({ error: "Nothing to send" }, 400);
    if (html.length > 400_000) return json({ error: "That email is too large to send" }, 400);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Medic Connect <hello@medicconnect.co>",
        to: [to],
        subject: `[Test] ${subject || "Medic Connect"}`,
        html,
        text: text || undefined,
        tags: emailTags("kit-test"),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("resend test send failed", res.status, detail);
      return json({ error: "The email service refused this send", details: detail }, res.status);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("send-kit-test", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
