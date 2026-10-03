import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { emailTags } from "../_shared/email-tags.ts";

const ALLOWED_ORIGINS = new Set<string>([
  "https://medicconnect.co",
  "https://www.medicconnect.co",
  "https://medicconnect.lovable.app",
  "https://id-preview--5ee81f05-6042-44da-a29b-ff2522864cf2.lovable.app",
]);
const LOVABLE_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.lovable\.app$/;
const DEFAULT_ORIGIN = "https://medicconnect.lovable.app";

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return LOVABLE_PREVIEW_RE.test(origin);
}
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : DEFAULT_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const MAX = { name: 100, email: 255, state: 80, role: 60, motivation: 500, time: 40 };
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Payload {
  kind: "volunteer" | "waitlist";
  data: {
    firstName?: string;
    lastName?: string;
    email: string;
    state?: string;
    role?: string;
    motivation?: string;
    timeCommitment?: string;
  };
}

async function sendEmail(apiKey: string, from: string, to: string, subject: string, html: string, replyTo?: string) {
  const body: Record<string, unknown> = { from, to: [to], subject, html };
  if (replyTo) body.reply_to = replyTo;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...body, tags: emailTags("heard-signup") }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("Resend send failed:", res.status, t);
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    if (origin && !isAllowedOrigin(origin)) return new Response(null, { status: 403 });
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (origin && !isAllowedOrigin(origin)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!req.headers.get("apikey")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const NOTIFICATION_EMAIL = Deno.env.get("NOTIFICATION_EMAIL");
    if (!RESEND_API_KEY || !NOTIFICATION_EMAIL) {
      throw new Error("Email environment not configured");
    }

    const { kind, data }: Payload = await req.json();
    if (!data?.email || !emailRe.test(data.email) || data.email.length > MAX.email) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const from = "Heard <hello@medicconnect.co>";

    if (kind === "waitlist") {
      await sendEmail(
        RESEND_API_KEY, from, NOTIFICATION_EMAIL,
        "New Heard waitlist sign-up",
        `<p>New waitlist sign-up: <strong>${escapeHtml(data.email)}</strong></p>`,
      );
      await sendEmail(
        RESEND_API_KEY, from, data.email,
        "You're on the list — Heard",
        `<div style="font-family:'Figtree','Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0f172a;line-height:1.6;">
          <h1 style="font-family:'Figtree','Segoe UI',Arial,sans-serif;font-weight:500;font-size:26px;margin:0 0 16px;">Thanks — we've got your email.</h1>
          <p>We'll keep you posted on Heard as we get closer to opening. No spam, just the moments that matter.</p>
          <p style="margin-top:32px;color:#64748b;font-size:14px;">Heard is a service of Medic Connect.</p>
        </div>`,
      );
    } else {
      const firstName = (data.firstName || "").slice(0, MAX.name);
      const lastName = (data.lastName || "").slice(0, MAX.name);
      const state = (data.state || "").slice(0, MAX.state);
      const role = (data.role || "").slice(0, MAX.role);
      const motivation = (data.motivation || "").slice(0, MAX.motivation);
      const timeCommitment = (data.timeCommitment || "").slice(0, MAX.time);

      await sendEmail(
        RESEND_API_KEY, from, NOTIFICATION_EMAIL,
        `New Heard volunteer: ${escapeHtml(firstName)} ${escapeHtml(lastName)} — ${escapeHtml(role)}`,
        `<div style="font-family:'Figtree','Segoe UI',Arial,sans-serif;max-width:600px;color:#0f172a;">
          <h2 style="font-family:'Figtree','Segoe UI',Arial,sans-serif;">New Heard volunteer sign-up</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;font-weight:600;width:180px;">Name</td><td>${escapeHtml(firstName)} ${escapeHtml(lastName)}</td></tr>
            <tr><td style="padding:8px 0;font-weight:600;">Email</td><td><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></td></tr>
            <tr><td style="padding:8px 0;font-weight:600;">State</td><td>${escapeHtml(state)}</td></tr>
            <tr><td style="padding:8px 0;font-weight:600;">Role</td><td>${escapeHtml(role)}</td></tr>
            <tr><td style="padding:8px 0;font-weight:600;">Time</td><td>${escapeHtml(timeCommitment)}</td></tr>
            <tr><td style="padding:8px 0;font-weight:600;vertical-align:top;">Why</td><td>${escapeHtml(motivation)}</td></tr>
          </table>
        </div>`,
        data.email,
      );

      await sendEmail(
        RESEND_API_KEY, from, data.email,
        "Thank you — we've got you.",
        `<div style="font-family:'Figtree','Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0f172a;line-height:1.6;">
          <h1 style="font-family:'Figtree','Segoe UI',Arial,sans-serif;font-weight:500;font-size:26px;margin:0 0 16px;">Thank you — we've got you.</h1>
          <p>That's all we need for now. We'll be in touch about the next training cohort. Keep an eye on your inbox (and your spam folder, just in case).</p>
          <p style="margin-top:20px;">Glad you're doing this.</p>
          <p style="margin-top:32px;color:#64748b;font-size:14px;">Heard is a service of Medic Connect.</p>
        </div>`,
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("send-heard-signup error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
