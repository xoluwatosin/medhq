import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailTags } from "../_shared/email-tags.ts";
import { SITE_URL } from "../_shared/site-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "hello@medicconnect.co";
const COMPANY = "Medic Connect";
const SERIF = "'Figtree','Segoe UI',Arial,sans-serif";

const D = {
  primary: "#1a1a1a",
  body: "#2a2a2a",
  muted: "#8a8a8a",
  divider: "#e8e8e8",
  button_bg: "#1a1a1a",
  button_text: "#ffffff",
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeHttpsUrl(u: unknown): string {
  if (!u) return "";
  try {
    const parsed = new URL(String(u));
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

const CTA_TOKEN_GLOBAL = /\[\[cta:([^|\]]+)\|([^|\]]+)\]\]/g;
const CTA_TOKEN_SOLO = /^\[\[cta:([^|\]]+)\|([^|\]]+)\]\]$/;

function bigButton(label: string, url: string): string {
  const safe = safeHttpsUrl(url);
  if (!safe) return "";
  return `<div style="margin:36px 0 8px;"><a href="${safe}" style="display:inline-block;background:${D.button_bg};color:${D.button_text};font-size:14px;font-weight:500;letter-spacing:0.02em;padding:14px 28px;border-radius:0;text-decoration:none;font-family:'Figtree','Segoe UI',Arial,sans-serif;">${escapeHtml(label)}</a></div>`;
}

function inlineCta(label: string, url: string): string {
  const safe = safeHttpsUrl(url) || "#";
  return `<a href="${safe}" style="display:inline-block;background:${D.button_bg};color:${D.button_text};font-size:13px;font-weight:500;padding:8px 16px;border-radius:0;text-decoration:none;font-family:'Figtree','Segoe UI',Arial,sans-serif;">${escapeHtml(label)}</a>`;
}

function renderInline(text: string): string {
  const ph: string[] = [];
  let work = text.replace(CTA_TOKEN_GLOBAL, (_m, label, url) => {
    ph.push(inlineCta(String(label).trim(), String(url).trim()));
    return `\u0000CTA${ph.length - 1}\u0000`;
  });
  work = escapeHtml(work);
  work = work.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) =>
    `<a href="${u}" style="color:${D.primary};text-decoration:underline;">${t}</a>`);
  work = work.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  work = work.replace(/_([^_\n]+)_/g, "<em>$1</em>");
  work = work.replace(/\u0000CTA(\d+)\u0000/g, (_m, i) => ph[Number(i)] ?? "");
  return work;
}

function renderMarkdown(content: string): string {
  if (!content) return "";
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  const pStyle = `color:${D.body};font-size:17px;line-height:1.8;margin:0 0 22px;font-family:${SERIF};`;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    const solo = line.match(CTA_TOKEN_SOLO);
    if (solo) { out.push(bigButton(solo[1].trim(), solo[2].trim())); i++; continue; }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*]\s+/, "")); i++; }
      out.push(`<ul style="margin:0 0 22px 0;padding-left:22px;color:${D.body};font-family:${SERIF};font-size:17px;line-height:1.8;">${items.map((it) => `<li style="margin:0 0 6px;">${renderInline(it)}</li>`).join("")}</ul>`);
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const size = h[1].length === 1 ? 28 : h[1].length === 2 ? 22 : 18;
      out.push(`<h${h[1].length} style="font-family:${SERIF};font-weight:600;color:${D.primary};font-size:${size}px;line-height:1.25;margin:32px 0 12px;">${renderInline(h[2])}</h${h[1].length}>`);
      i++; continue;
    }
    out.push(`<p style="${pStyle}">${renderInline(line)}</p>`);
    i++;
  }
  return out.join("");
}

function buildHtml(bodyMarkdown: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
</head><body style="margin:0;padding:0;font-family:'Figtree','Segoe UI',Arial,sans-serif;background:#FAF8F4;color:${D.body};">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px 40px;background:#ffffff;">
    <div style="padding:8px 8px 0;">
      ${renderMarkdown(bodyMarkdown)}
      <div style="margin:44px 0 0;font-family:${SERIF};color:${D.primary};font-size:17px;line-height:1.8;">
        With care,<br/><span style="font-style:italic;">The ${COMPANY} Team</span>
      </div>
      <hr style="border:none;border-top:1px solid ${D.divider};margin:48px 0 20px;" />
      <div style="text-align:center;color:${D.muted};font-size:12px;font-family:'Figtree','Segoe UI',Arial,sans-serif;line-height:1.7;">
        ${COMPANY} &middot; Lagos, Nigeria<br/>
        <a href="${SITE_URL}" style="color:${D.muted};text-decoration:underline;">medicconnect.co</a>
      </div>
    </div>
  </div>
</body></html>`;
}

const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  interview_invite: {
    subject: "Interview invitation: {{role_title}} at {{company}}",
    body: `Dear {{first_name}},

Thank you for applying for the **{{role_title}}** role at {{company}}. We were pleased with your application and would love to get to know you better.

Please pick a time that works for you using the link below.

[[cta:Book your interview|{{booking_link}}]]

If none of the available times suit you, simply reply to this email and we will find another slot.`,
  },
  rejection: {
    subject: "Your application for {{role_title}}",
    body: `Dear {{first_name}},

Thank you for taking the time to apply for the **{{role_title}}** role at {{company}}.

After careful consideration, we will not be moving forward with your application on this occasion.

We would genuinely encourage you to keep an eye on future roles with us. We wish you every success in your career.`,
  },
};

function merge(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? "");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: roleData } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const emailType: string = body?.emailType;
    const applicationIds: string[] = Array.isArray(body?.applicationIds) ? body.applicationIds : [];
    const bookingLink: string = String(body?.bookingLink || "");
    const overrideSubject: string | undefined = body?.subject;
    const overrideBody: string | undefined = body?.body;
    const testEmail: string = String(body?.testEmail || "").trim();

    if (!["interview_invite", "rejection"].includes(emailType)) return json({ error: "Invalid emailType" }, 400);
    if (!testEmail && applicationIds.length === 0) return json({ error: "No applications selected" }, 400);
    if (applicationIds.length > 500) return json({ error: "Too many recipients" }, 400);
    if (emailType === "interview_invite" && !safeHttpsUrl(bookingLink)) {
      return json({ error: "A valid https booking link is required" }, 400);
    }
    if (testEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(testEmail)) {
      return json({ error: "Invalid test email address" }, 400);
    }


    // Load template from admin_settings, fall back to defaults
    const key = emailType === "interview_invite" ? "email_tpl_interview_invite" : "email_tpl_rejection";
    const { data: setting } = await supabase.from("admin_settings").select("value").eq("key", key).maybeSingle();
    const stored = (setting?.value || {}) as { subject?: string; body?: string };
    const tplSubject = overrideSubject || stored.subject || DEFAULT_TEMPLATES[emailType].subject;
    const tplBody = overrideBody || stored.body || DEFAULT_TEMPLATES[emailType].body;

    // Test send: one email to the given address, no logging, no candidate touched
    if (testEmail) {
      let sampleName = "Jane Doe";
      let sampleRole = String(body?.roleTitle || "").trim() || "the role";
      if (applicationIds.length > 0) {
        const { data: one } = await supabase
          .from("matchmaker_applications")
          .select("full_name, opportunity_id")
          .eq("id", applicationIds[0]).maybeSingle();
        if (one) {
          sampleName = one.full_name || sampleName;
          const { data: opp } = await supabase
            .from("matchmaker_opportunities").select("title").eq("id", one.opportunity_id).maybeSingle();
          if (opp?.title) sampleRole = opp.title;
        }
      }
      const vars = {
        first_name: sampleName.trim().split(/\s+/)[0] || "there",
        candidate_name: sampleName,
        role_title: sampleRole,
        company: COMPANY,
        booking_link: safeHttpsUrl(bookingLink),
      };
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${COMPANY} <${FROM_EMAIL}>`,
          to: [testEmail],
          subject: `[TEST] ${merge(tplSubject, vars)}`,
          html: buildHtml(merge(tplBody, vars)),
          tags: emailTags("candidate-email-test"),
        }),
      });
      if (!res.ok) return json({ error: (await res.text()).slice(0, 500) }, 502);
      return json({ success: true, test: true, sent: 1 });
    }



    const { data: apps, error: appsErr } = await supabase
      .from("matchmaker_applications")
      .select("id, full_name, email, opportunity_id")
      .in("id", applicationIds);
    if (appsErr) return json({ error: appsErr.message }, 400);
    if (!apps || apps.length === 0) return json({ error: "No matching applications" }, 404);

    const oppIds = Array.from(new Set(apps.map((a) => a.opportunity_id)));
    const { data: opps } = await supabase
      .from("matchmaker_opportunities").select("id, title").in("id", oppIds);
    const oppTitle = new Map((opps || []).map((o) => [o.id, o.title as string]));

    const { data: senderProfile } = await supabase
      .from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();

    let sent = 0;
    const failures: { email: string; error: string }[] = [];

    for (let i = 0; i < apps.length; i++) {
      const a = apps[i];
      const roleTitle = oppTitle.get(a.opportunity_id) || "the role";
      const firstName = String(a.full_name || "").trim().split(/\s+/)[0] || "there";
      const vars = {
        first_name: firstName,
        candidate_name: String(a.full_name || ""),
        role_title: roleTitle,
        company: COMPANY,
        booking_link: safeHttpsUrl(bookingLink),
      };
      const subject = merge(tplSubject, vars);
      const html = buildHtml(merge(tplBody, vars));

      let status = "sent";
      let error: string | null = null;
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: `${COMPANY} <${FROM_EMAIL}>`, to: [a.email], subject, html, tags: emailTags("matchmaker-email") }),
        });
        if (!res.ok) {
          status = "failed";
          error = (await res.text()).slice(0, 500);
        }
      } catch (err) {
        status = "failed";
        error = String(err).slice(0, 500);
      }

      if (status === "sent") sent++;
      else failures.push({ email: a.email, error: error || "unknown" });

      await supabase.from("matchmaker_email_log").insert({
        application_id: a.id,
        opportunity_id: a.opportunity_id,
        recipient_email: a.email,
        email_type: emailType,
        subject,
        booking_link: emailType === "interview_invite" ? safeHttpsUrl(bookingLink) : null,
        status,
        error,
        sent_by: user.id,
        sent_by_name: senderProfile?.display_name || user.email || null,
      });

      // Respect Resend rate limits (~8/sec)
      if (i < apps.length - 1) await sleep(130);
    }

    return json({ success: true, sent, failed: failures.length, failures });
  } catch (err) {
    console.error("send-candidate-email error:", err);
    return json({ error: String(err) }, 500);
  }
});
