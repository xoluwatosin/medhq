// One-off notice to the candidates whose new account was not attached to the
// record we already held. The fault was ours; this tells them plainly that it
// is fixed and sends them straight back to sign in.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { kitEmail, kitMarkdown } from "../_shared/kit-email.ts";
import { emailTags } from "../_shared/email-tags.ts";
import { SITE_URL } from "../_shared/site-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // Either the service key, one of the stored run keys, or a signed-in administrator.
  const sent = req.headers.get("x-run-key");
  const runKeys = [Deno.env.get("RELINK_RUN_KEY"), Deno.env.get("MU_LINK_SWEEP_KEY")].filter(Boolean);
  let allowed = bearer === serviceKey
    || Boolean(sent && runKeys.includes(sent));
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

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.person_ids) ? body.person_ids : [];
  const dryRun = Boolean(body?.dry_run);
  if (!ids.length) return json({ error: "No recipients given." }, 400);

  const { data: people, error } = await admin
    .from("mu_people")
    .select("id, full_name, email")
    .in("id", ids);
  if (error) return json({ error: error.message }, 500);

  const results: { email: string; ok: boolean; detail?: string }[] = [];

  for (const person of people ?? []) {
    const to = (person.email ?? "").trim().toLowerCase();
    if (!to) { results.push({ email: person.id, ok: false, detail: "no email" }); continue; }
    const firstName = (person.full_name ?? "").split(" ")[0];

    const markdown = [
      `You recently created an account on the Medic Connect candidate portal and were told that your profile could not be found. That message was wrong, and the fault was entirely ours.`,
      ``,
      `Your profile was always here. Our system simply failed to join your new sign-in details to the record we already hold for you. We have corrected that, and your account and your profile are now joined.`,
      ``,
      `## What you need to do`,
      `- Select the button below.`,
      `- Sign in with the same email address and password you created.`,
      `- If you cannot recall your password, select **Forgotten your password** on that page and we will email you a link to set a new one.`,
      `- You will be asked for a six digit code to confirm it is you. It arrives by email within a minute.`,
      ``,
      `[[cta:Sign in to your profile|${SITE_URL}/portal/login]]`,
      ``,
      `You do not need to create a second account, and you should not. Everything you have already given us, including any documents and your CV, is on your profile waiting for you.`,
      ``,
      `Please accept our apologies for the wasted trip. If anything at all still refuses to work, reply to this email or write to hello@medicconnect.co and we will sort it out for you personally.`,
    ].join("\n");

    const html = kitEmail({
      eyebrow: "Candidate portal",
      title: firstName ? `${firstName}, your profile is now open` : "Your profile is now open",
      standfirst: "The error you saw was ours. It has been corrected. Please sign in again.",
      preheader: "Your account is now joined to your profile. Please sign in again.",
      bodyHtml: kitMarkdown(markdown),
      footnote:
        "You are receiving this because you created a candidate account with Medic Connect. Never share your password or your confirmation code with anyone, including our own team.",
    });

    if (dryRun) { results.push({ email: to, ok: true, detail: "dry run" }); continue; }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "Medic Connect <noreply@medicconnect.co>",
        to: [to],
        subject: "Your Medic Connect profile is now open. Please sign in again",
        tags: [...emailTags("notify-relink", person.id), { name: "type", value: "candidate_relink" }],
        html,
      }),
    });
    const ok = res.ok;
    const detail = ok ? undefined : await res.text();
    if (!ok) console.error("notify-relink send failed", to, res.status, detail);
    results.push({ email: to, ok, detail });

    if (ok) {
      await admin.from("mu_activity").insert({
        person_id: person.id,
        actor_name: "System",
        action: "email_sent",
        detail: { type: "relink_apology", email: to },
      });
    }
  }

  return json({ sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok), results });
});
