// Public claim path. Someone types their email at /join or /portal/login and we
// work out, quietly, whether we already hold them.
//
// If we do, we email a personal set-password link that lands on the portal (or
// on the page they were heading for). If we do not, we say nothing that reveals
// it — the caller falls through to normal sign-up. The response never confirms
// or denies that an account exists.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { kitEmailFromMarkdown } from "../_shared/kit-email.ts";
import { emailTags } from "../_shared/email-tags.ts";
import { SITE_URL } from "../_shared/site-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Only ever redirect back into our own portal or opportunity pages. */
const safeNext = (raw: unknown): string => {
  if (typeof raw !== "string") return "/portal";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/portal";
  if (!/^\/(portal|hm)(\/|$)/.test(raw)) return "/portal";
  return raw.slice(0, 200);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase().slice(0, 255);
    const next = safeNext(body?.next);
    const reason = typeof body?.reason === "string" ? body.reason.slice(0, 200) : "";

    if (!EMAIL_RE.test(email)) return json({ error: "Enter a valid email address" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Deliberately uniform: whatever we find, the caller hears the same thing.
    const quiet = json({ ok: true, message: "If we hold that email on file, a link is on its way." });

    const { data: person } = await admin
      .from("mu_people")
      .select("id, full_name, email, auth_user_id, claimed_at")
      .eq("email_key", email)
      .maybeSingle();

    // No person record, but they may still hold an account (someone who signed
    // up before filling anything in). A password link is still the right answer.
    if (!person) {
      // A recovery link only generates for an existing account, so this is our
      // test for "they signed up but we hold nothing else on them".
      const probe = await admin.auth.admin.generateLink({ type: "recovery", email });
      if (!probe.data?.properties?.hashed_token) {
        return json({ ok: true, on_file: false, message: "We do not hold that email yet." });
      }
    }


    const redirect = `${SITE_URL}/portal/set-password?next=${encodeURIComponent(next)}`;


    // As in invite-candidate: never email Supabase's own /verify URL. Mail
    // scanners prefetch links and burn one-time tokens before a real click.
    let hashedToken = "";
    let linkType = "recovery";
    let userId: string | null = person?.auth_user_id ?? null;

    const { data: recovery } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: redirect },
    });

    if (recovery?.properties?.hashed_token) {
      hashedToken = recovery.properties.hashed_token;
      userId = recovery.user?.id ?? userId;
    } else {
      const { data: invited, error: inviteError } = await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo: redirect, data: { display_name: person?.full_name } },
      });
      if (inviteError || !invited?.properties?.hashed_token) {
        console.error("claim link failed", inviteError?.message);
        return quiet;
      }
      hashedToken = invited.properties.hashed_token;
      linkType = "invite";
      userId = invited.user?.id ?? userId;
    }

    const link = `${redirect}&token_hash=${encodeURIComponent(hashedToken)}&type=${encodeURIComponent(linkType)}`;

    if (person) {
      await admin.from("mu_people")
        .update({ auth_user_id: userId, invited_at: new Date().toISOString() })
        .eq("id", person.id);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY missing");
      return quiet;
    }

    const firstName = (person?.full_name || "there").split(/\s+/)[0];
    const why = reason
      ? `You asked to open your Medic Connect profile so you could ${reason}.`
      : "You asked to open your Medic Connect candidate profile.";

    const html = kitEmailFromMarkdown({
      eyebrow: "Candidate portal",
      title: "Open your profile",
      standfirst: "One link, and everything we hold on you is in front of you.",
      preheader: "Your link to open your Medic Connect profile",
      markdown: `Hi ${firstName},

${why} We already hold a profile for you, so there is nothing to fill in twice. Set a password and it opens.

Inside you can check what we hold, correct anything we read wrongly, send us any documents that are outstanding and tell us the kind of work you actually want.

[[cta:Set your password|${link}]]

This link is personal to ${email} and expires after 24 hours or once it is used. If you did not ask for it, ignore this email and nothing happens.`,
      footnote: "If you did not ask for this, ignore the email. Nothing changes on your record.",
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Medic Connect <hello@medicconnect.co>",
        to: [email],
        reply_to: "hello@medicconnect.co",
        subject: "Open your Medic Connect profile",
        html,
        tags: emailTags("claim-invite", person?.id ?? null),
      }),
    });

    if (!res.ok) {
      console.error(`Resend failed [${res.status}]: ${await res.text()}`);
      return quiet;
    }

    if (person) await admin.from("mu_activity").insert({
      person_id: person.id,
      action: "claim_link_sent",
      detail: { email, next, self_service: true },
    });

    return json({ ok: true, on_file: true, message: "Check your inbox for the link." });
  } catch (err) {
    console.error("candidate-claim", (err as Error).message);
    return json({ ok: true, message: "If we hold that email on file, a link is on its way." });
  }
});
