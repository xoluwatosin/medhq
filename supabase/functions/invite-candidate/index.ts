// Invites a person in Match Universe to their own candidate account.
// The link is personalised: it is issued against the email we already hold on
// file and drops them straight into the portal password screen.
//
// The email uses the same branded shell as our campaigns, and the body is
// editable from Admin > Email Templates (admin_settings.email_tpl_portal_invite).
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

const REDIRECT = `${SITE_URL}/portal/set-password`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GAP_LABELS: Record<string, string> = {
  profession: "the role you practise",
  years_experience: "your years of experience",
  state: "the state you live in",
  lga: "your local government area",
  licence: "your licence to practise details",
  availability: "the days you are available to work",
  right_to_work: "your right to work in Nigeria",
  nysc: "your NYSC status",
};

export const DEFAULT_INVITE = {
  subject: "Your Medic Connect candidate profile is ready",
  body: `Hi {{first_name}},

We have created a profile for you at Medic Connect using the details from your application and the CV you sent us. Setting a password opens your account so you can check it over, correct anything we read wrongly and keep it current.

## Why this matters

Families, clinics and hospitals come to us with a need, and we look into our own pool to put forward the people who fit it. We can only recommend someone whose details we hold in full and whose documents we have seen and checked. A profile that is complete and in date is a profile we can deploy.

## What is outstanding for you

{{outstanding}}

Uploading your documents takes a couple of minutes and stays private to our team. If a document has an expiry date, please send the current version.

[[cta:Set your password|{{link}}]]

This link is personal to {{email}}. If you did not apply to Medic Connect, you can ignore this email.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: claimsError } = await caller.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const callerId = claims.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: role } = await admin
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Forbidden: admins only" }, 403);

    const body = await req.json().catch(() => ({}));
    const personId = typeof body?.person_id === "string" ? body.person_id : "";
    const opportunityId = typeof body?.opportunity_id === "string" ? body.opportunity_id : "";
    if (!personId) return json({ error: "person_id is required" }, 400);

    // A role-led invite lands them on that application, not the portal home.
    let opp: { id: string; title: string; slug: string; location: string | null; employment_type: string | null } | null = null;
    if (opportunityId) {
      const { data: o } = await admin
        .from("matchmaker_opportunities")
        .select("id, title, slug, location, employment_type")
        .eq("id", opportunityId).maybeSingle();
      opp = (o as any) ?? null;
      if (!opp) return json({ error: "Opportunity not found" }, 404);
    }
    const nextPath = opp ? `/hm/${opp.slug}/apply` : "/portal";
    const redirectTo = `${REDIRECT}?next=${encodeURIComponent(nextPath)}`;

    const { data: person, error: personError } = await admin
      .from("mu_people").select("id, full_name, email, auth_user_id, candidate_gaps").eq("id", personId).maybeSingle();
    if (personError || !person) return json({ error: "Person not found" }, 404);

    const email = (person.email || "").trim().toLowerCase();
    if (!email) return json({ error: "No email on file for this person" }, 400);

    // Reuse an existing account when this email already signed up, otherwise invite.
    let userId: string | null = person.auth_user_id ?? null;
    let actionLink = "";

    // We deliberately do NOT email Supabase's own /verify link. Corporate mail
    // scanners (Microsoft Defender, Proofpoint) prefetch links in email, which
    // burns the one-time token before the candidate ever clicks it. Instead we
    // send the token hash to our own page and only redeem it on a real click.
    const buildLink = (hashedToken: string, type: string) =>
      `${redirectTo}&token_hash=${encodeURIComponent(hashedToken)}&type=${encodeURIComponent(type)}`;

    const { data: existing } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (existing?.properties?.hashed_token) {
      actionLink = buildLink(existing.properties.hashed_token, "recovery");
      userId = existing.user?.id ?? userId;
    } else {
      const { data: invited, error: inviteError } = await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo, data: { display_name: person.full_name } },
      });
      if (inviteError || !invited?.properties?.hashed_token) {
        return json({ error: inviteError?.message || "Could not generate a link" }, 400);
      }
      actionLink = buildLink(invited.properties.hashed_token, "invite");
      userId = invited.user?.id ?? userId;
    }

    await admin.from("mu_people")
      .update({ auth_user_id: userId, invited_at: new Date().toISOString() })
      .eq("id", personId);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ error: "Email service not configured" }, 500);

    // Everything we still need from them, named plainly.
    const gaps: string[] = Array.isArray(person.candidate_gaps) ? (person.candidate_gaps as string[]) : [];
    const { data: docStatus } = await admin.rpc("mu_document_status", { _person_id: personId });
    const missingDocs = (docStatus ?? [])
      .filter((d: any) => d.required && d.status !== "accepted")
      .map((d: any) =>
        d.status === "rejected"
          ? `${d.label} — we could not accept the copy on file${d.review_reason ? ` (${d.review_reason})` : ""}`
          : d.status === "expired"
            ? `${d.label} — the copy we hold has expired`
            : d.status === "pending"
              ? `${d.label} — received, we are checking it`
              : `${d.label} — not received yet`,
      );

    const missingFields = gaps.map((g) => GAP_LABELS[g] || g.replace(/_/g, " "));
    const lines = [
      ...missingFields.map((f) => `- ${f}`),
      ...missingDocs.map((d) => `- ${d}`),
    ];
    const outstanding = lines.length
      ? lines.join("\n")
      : "- Nothing outstanding. Please still sign in and confirm everything is current.";

    // Admin-editable template, falling back to the default copy above.
    const { data: tpl } = await admin
      .from("admin_settings").select("value").eq("key", "email_tpl_portal_invite").maybeSingle();
    const subjectTpl = (tpl?.value as any)?.subject || DEFAULT_INVITE.subject;
    const bodyTpl = (tpl?.value as any)?.body || DEFAULT_INVITE.body;

    const firstName = (person.full_name || "there").split(/\s+/)[0];
    const fill = (s: string) =>
      s
        .replace(/\{\{first_name\}\}/g, firstName)
        .replace(/\{\{full_name\}\}/g, person.full_name || firstName)
        .replace(/\{\{outstanding\}\}/g, outstanding)
        .replace(/\{\{email\}\}/g, email)
        .replace(/\{\{link\}\}/g, actionLink);

    const where = [opp?.location, opp?.employment_type].filter(Boolean).join(" · ");
    const roleBody = opp
      ? `Hi ${firstName},

We are recruiting for **${opp.title}**${where ? ` (${where})` : ""} and you are on our books, so we are telling you first.

Your profile already holds what you sent us, which means applying is mostly confirming what we have rather than typing it all again. Set a password and the application opens on the other side.

## Before you apply, these are still outstanding

${outstanding}

[[cta:Open the role and apply|${actionLink}]]

This link is personal to ${email}. If this role is not for you, ignore this email; your profile stays as it is and we will come back to you with the next one.`
      : null;

    const subject = opp ? `${opp.title} — you are on our list for this` : fill(subjectTpl);
    const html = kitEmailFromMarkdown({
      eyebrow: opp ? "Open role" : "Candidate portal",
      title: opp ? opp.title : "Your candidate profile",
      standfirst: opp
        ? "You are already on our books. Set a password and your application is half written."
        : "Set a password, check what we hold and send anything outstanding.",
      preheader: subject,
      markdown: roleBody ?? fill(bodyTpl),
      footnote: "This link is personal to you. If you did not apply to Medic Connect, ignore this email and nothing happens.",
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
        tags: emailTags("candidate-invite", personId),
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
      action: opp ? "role_invite_sent" : "portal_invite_sent",
      detail: { email, outstanding: lines.length, opportunity_id: opp?.id ?? null, role: opp?.title ?? null },
    });

    return json({ success: true, email });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
