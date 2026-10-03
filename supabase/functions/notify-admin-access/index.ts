// Tells someone who already has a Medic Connect account that they now also
// have Admin Centre access. Deliberately does NOT touch their password: the
// person may already be using the same sign-in for their candidate profile.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { kitEmail, kitParagraph, kitButton, kitList } from "../_shared/kit-email.ts";
import { emailTags } from "../_shared/email-tags.ts";
import { SITE_URL } from "../_shared/site-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let allowed = bearer === serviceKey;
  const sentKey = req.headers.get("x-run-key");
  if (!allowed && sentKey) {
    const { data: keyOk } = await admin.rpc("job_key_check", { p_name: "admin_alert_key", p_value: sentKey });
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

  const { email, name } = await req.json().catch(() => ({}));
  if (!email) return json({ error: "email is required" }, 400);

  const { data: perms } = await admin
    .from("admin_permissions").select("permissions").eq("email", email).maybeSingle();

  const labels: Record<string, string> = {
    dashboard: "Dashboard", blog: "The Bridge", campaigns: "Campaigns",
    archives: "Archives", enquiries: "Enquiries", creator_applications: "Creator applications",
    audience: "Audience", applications: "Applications", matchmakers: "Matchmakers",
    email_templates: "Email templates", heard: "Heard", match_universe: "Match Universe",
    workforce: "Workforce",
  };
  const areas = ((perms?.permissions as string[] | null) ?? []).map((p) => labels[p] ?? p);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Medic Connect <noreply@medicconnect.co>",
      to: [email],
      subject: "Your Medic Connect Admin Centre access",
      tags: emailTags("notify-admin-access"),
      html: kitEmail({
        eyebrow: "Admin Centre",
        title: "You now have admin access",
        standfirst: `${name || "Hello"}, your Medic Connect account can now open the Admin Centre.`,
        preheader: "Sign in with your existing Medic Connect email and password.",
        bodyHtml:
          kitParagraph("Sign in with this same email address and the password you already use. A one-time security code will be sent to your inbox to complete sign-in.") +
          kitButton("Open the Admin Centre", `${SITE_URL}/auth`) +
          (areas.length ? kitParagraph("You have access to:") + kitList(areas) : "") +
          kitParagraph(`Your candidate profile is unchanged and stays available at ${SITE_URL}/portal with the same sign-in.`),
        footnote: "If you were not expecting this, please contact hello@medicconnect.co.",
      }),
    }),
  });

  if (!res.ok) return json({ error: await res.text() }, 500);
  return json({ sent: 1 });
});
