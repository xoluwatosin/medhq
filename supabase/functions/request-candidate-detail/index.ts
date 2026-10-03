// Asking a candidate for one missing profile detail.
//
// Documents have their own request path. This is for the plain facts that live
// on a profile, such as a home address needed on a contract, so the person can
// put it in themselves and every downstream document picks it up.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailTags } from "../_shared/email-tags.ts";
import { kitEmailFromMarkdown } from "../_shared/kit-email.ts";
import { SITE_URL } from "../_shared/site-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PORTAL = `${SITE_URL}/portal/details`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeMd = (s: string) => s.replace(/[<>]/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "Not signed in" }, 401);

    const admin = createClient(url, service);
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await caller.auth.getUser();
    const callerId = userData?.user?.id;
    if (!callerId) return json({ error: "Not signed in" }, 401);

    const { data: role } = await admin
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Forbidden: admins only" }, 403);

    const body = await req.json().catch(() => ({}));
    const personId = typeof body?.person_id === "string" ? body.person_id : "";
    const detail = (typeof body?.detail === "string" ? body.detail : "").slice(0, 120).trim();
    const note = (typeof body?.note === "string" ? body.note : "").slice(0, 500).trim();
    if (!personId) return json({ error: "person_id is required" }, 400);
    if (!detail) return json({ error: "detail is required" }, 400);

    const { data: person } = await admin
      .from("mu_people").select("id, full_name, email").eq("id", personId).maybeSingle();
    if (!person) return json({ error: "Person not found" }, 404);
    const email = (person.email || "").trim().toLowerCase();
    if (!email) return json({ error: "No email on file for this person" }, 400);

    const firstName = (person.full_name || "there").split(/\s+/)[0];
    const subject = `We need your ${escapeMd(detail)}`;
    const content = `Hi ${firstName},

There is one thing missing from your account and we need it before your paperwork can be finished: your **${escapeMd(detail)}**.

${note ? `> ${escapeMd(note)}\n` : ""}
Open your details, add it, and save. It flows through to your contract on its own, so there is nothing to send us by email.

[[cta:Add it to your details|${PORTAL}]]

Anything you put in stays private to our team.`;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ error: "Email service not configured" }, 500);

    const html = kitEmailFromMarkdown({
      eyebrow: "Your details",
      title: "One thing missing",
      standfirst: `We need your ${escapeMd(detail)} on your account.`,
      preheader: subject,
      markdown: content,
      footnote: "Anything you put in stays private to the Medic Connect team.",
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Medic Connect <hello@medicconnect.co>",
        to: [email],
        reply_to: "hello@medicconnect.co",
        subject,
        html,
        tags: emailTags("detail-request", personId),
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Resend failed [${res.status}]: ${errBody}`);
      return json({ error: "Email send failed", details: errBody }, res.status);
    }

    await admin.from("mu_activity").insert({
      person_id: personId,
      actor_id: callerId,
      action: "detail_requested",
      detail: { email, field: detail, note: note || null },
    });

    return json({ ok: true, sent_to: email });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
