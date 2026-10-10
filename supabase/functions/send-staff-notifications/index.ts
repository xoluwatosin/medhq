// Emails people the notifications they have not read in the Admin Centre.
//
// Called every few minutes by private.staff_notifications_dispatch(). Sends
// one email per person: a single notification reads as itself, several as a
// short list. Anything read in the app before this runs is skipped.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { KIT, kitEmail, kitButton } from "../_shared/kit-email.ts";
import { emailTags } from "../_shared/email-tags.ts";
import { SITE_URL } from "../_shared/site-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface Note { id: string; user_id: string; title: string; body: string | null; link: string | null; created_at: string }

const href = (link: string | null) => `${SITE_URL}${link && link.startsWith("/") ? link : "/admin"}`;

const item = (n: Note, first: boolean) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${first ? "" : `border-top:1px solid ${KIT.hairline};`}">
    <tr><td style="padding:16px 0;font-family:${KIT.font};">
      <a href="${href(n.link)}" style="font-size:16px;font-weight:800;color:${KIT.navy};text-decoration:none;line-height:1.35;">${esc(n.title)}</a>
      ${n.body ? `<div style="font-size:14.5px;line-height:1.6;color:${KIT.body};margin-top:4px;">${esc(n.body)}</div>` : ""}
    </td></tr>
  </table>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET");
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!(bearer === serviceKey || (cronSecret && bearer === cronSecret))) return json({ error: "Not permitted." }, 401);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return json({ error: "Email is not configured." }, 500);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const cutoff = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data, error } = await db.from("staff_notifications")
    .select("id, user_id, title, body, link, created_at")
    .is("emailed_at", null).is("read_at", null).is("email_error", null).eq("email_skipped", false)
    .lt("created_at", cutoff).order("created_at").limit(300);
  if (error) return json({ error: error.message }, 500);

  const byUser = new Map<string, Note[]>();
  for (const n of (data ?? []) as Note[]) byUser.set(n.user_id, [...(byUser.get(n.user_id) ?? []), n]);

  let sent = 0;
  const failed: string[] = [];
  for (const [userId, notes] of byUser) {
    const ids = notes.map((n) => n.id);
    const { data: u } = await db.auth.admin.getUserById(userId);
    const email = u?.user?.email;
    if (!email) {
      await db.from("staff_notifications").update({ email_error: "No email address" }).in("id", ids);
      failed.push(userId);
      continue;
    }

    const one = notes.length === 1 ? notes[0] : null;
    const html = kitEmail({
      eyebrow: "Admin Centre",
      title: one ? one.title : `${notes.length} updates for you`,
      standfirst: one ? (one.body ?? undefined) : "Here is what happened since you last looked.",
      preheader: one ? (one.body ?? one.title) : notes.map((n) => n.title).join(" · "),
      bodyHtml: one
        ? kitButton("Open in the Admin Centre", href(one.link))
        : notes.map((n, i) => item(n, i === 0)).join("") + kitButton("Open the Admin Centre", `${SITE_URL}/admin`),
      footnote: "You get these when something needs you or changes for you. Anything you have already seen in the Admin Centre is not emailed.",
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Medic Connect <noreply@medicconnect.co>",
        to: [email],
        subject: one ? one.title : `${notes.length} updates for you in the Admin Centre`,
        tags: emailTags("staff-notification"),
        html,
      }),
    });
    if (res.ok) {
      await db.from("staff_notifications").update({ emailed_at: new Date().toISOString() }).in("id", ids);
      sent += 1;
    } else {
      await db.from("staff_notifications").update({ email_error: (await res.text()).slice(0, 500) }).in("id", ids);
      failed.push(userId);
    }
  }
  return json({ sent, failed: failed.length });
});
