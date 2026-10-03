import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { kitEmail, kitCodePanel } from "../_shared/kit-email.ts";
import { emailTags } from "../_shared/email-tags.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1000000).padStart(6, "0");
}

// In-memory verify attempt tracker (per function instance)
const verifyAttempts = new Map<string, { count: number; firstAttempt: number }>();
const VERIFY_WINDOW_MS = 15 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_SEND_PER_WINDOW = 3;

function checkVerifyRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = verifyAttempts.get(email);
  if (!entry) return false;
  if (now - entry.firstAttempt > VERIFY_WINDOW_MS) {
    verifyAttempts.delete(email);
    return false;
  }
  return entry.count >= MAX_VERIFY_ATTEMPTS;
}

function recordVerifyAttempt(email: string) {
  const now = Date.now();
  const entry = verifyAttempts.get(email);
  if (!entry || now - entry.firstAttempt > VERIFY_WINDOW_MS) {
    verifyAttempts.set(email, { count: 1, firstAttempt: now });
  } else {
    entry.count++;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, email, code } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── SEND OTP ───
    if (action === "send") {
      // Rate limit: max 3 OTP requests per 15 minutes
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count, error: countErr } = await supabaseAdmin
        .from("otp_codes")
        .select("id", { count: "exact", head: true })
        .eq("email", trimmedEmail)
        .gte("created_at", fifteenMinAgo);

      if (!countErr && (count ?? 0) >= MAX_SEND_PER_WINDOW) {
        return new Response(
          JSON.stringify({ error: "Too many requests. Please wait before requesting another code." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Invalidate previous unused codes for this email
      await supabaseAdmin
        .from("otp_codes")
        .update({ used: true })
        .eq("email", trimmedEmail)
        .eq("used", false);

      const otpCode = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: insertErr } = await supabaseAdmin
        .from("otp_codes")
        .insert({ email: trimmedEmail, code: otpCode, expires_at: expiresAt });

      if (insertErr) {
        console.error("Insert OTP error:", insertErr);
        return new Response(JSON.stringify({ error: "Failed to generate code" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send via Resend
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) {
        return new Response(JSON.stringify({ error: "Email service not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sendStartedAt = Date.now();
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Medic Connect <noreply@medicconnect.co>",
          to: [trimmedEmail],
          subject: "Your Admin Security Code",
          tags: [...emailTags("admin-otp"), { name: "type", value: "admin_otp" }],
          html: kitEmail({
            eyebrow: "Admin Centre",
            title: "Your security code",
            standfirst: "Enter this code to finish signing in. It expires ten minutes after it was sent.",
            preheader: "Your Medic Connect admin sign in code, valid for ten minutes.",
            bodyHtml: kitCodePanel(otpCode, "Valid for 10 minutes"),
            footnote: "If you did not try to sign in, ignore this email and the code will expire on its own. Never share it with anyone, including Medic Connect staff.",
          }),
        }),
      });

      const resendRequestId =
        res.headers.get("x-resend-request-id") ||
        res.headers.get("x-request-id") ||
        null;
      const durationMs = Date.now() - sendStartedAt;
      const rawBody = await res.text();
      let parsedBody: any = null;
      try { parsedBody = rawBody ? JSON.parse(rawBody) : null; } catch { parsedBody = rawBody; }

      // Check suppression list to explain silent drops
      let suppressed: any = null;
      try {
        const { data: sup } = await supabaseAdmin
          .from("email_suppressions")
          .select("email, reason, source, created_at")
          .eq("email", trimmedEmail)
          .maybeSingle();
        suppressed = sup;
      } catch (_) { /* ignore */ }

      const logPayload = {
        stage: "resend_send",
        recipient: trimmedEmail,
        status: res.status,
        ok: res.ok,
        durationMs,
        resendRequestId,
        resendEmailId: parsedBody?.id ?? null,
        providerError: res.ok ? null : parsedBody,
        suppressed,
      };

      if (!res.ok) {
        console.error("admin-otp resend FAILED:", JSON.stringify(logPayload));
        return new Response(
          JSON.stringify({ error: "Failed to send email" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (suppressed) {
        console.warn("admin-otp SUPPRESSED recipient (email accepted by Resend but recipient is on suppression list):", JSON.stringify(logPayload));
      } else {
        console.log("admin-otp resend OK:", JSON.stringify(logPayload));
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── VERIFY OTP ───
    if (action === "verify") {
      if (!code || typeof code !== "string") {
        return new Response(JSON.stringify({ error: "Code required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Rate limit: max 5 failed verify attempts per 15 minutes
      if (checkVerifyRateLimit(trimmedEmail)) {
        // Invalidate all active codes on lockout
        await supabaseAdmin
          .from("otp_codes")
          .update({ used: true })
          .eq("email", trimmedEmail)
          .eq("used", false);

        return new Response(
          JSON.stringify({ error: "Too many attempts. Please wait 15 minutes before trying again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const trimmedCode = code.trim();

      const { data: otpRow, error: fetchErr } = await supabaseAdmin
        .from("otp_codes")
        .select("id, expires_at")
        .eq("email", trimmedEmail)
        .eq("code", trimmedCode)
        .eq("used", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchErr || !otpRow) {
        recordVerifyAttempt(trimmedEmail);
        return new Response(JSON.stringify({ error: "Invalid or expired code" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(otpRow.expires_at) < new Date()) {
        await supabaseAdmin.from("otp_codes").update({ used: true }).eq("id", otpRow.id);
        recordVerifyAttempt(trimmedEmail);
        return new Response(JSON.stringify({ error: "Code has expired" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark as used
      await supabaseAdmin.from("otp_codes").update({ used: true }).eq("id", otpRow.id);

      // Clear verify attempts on success
      verifyAttempts.delete(trimmedEmail);

      // Generate a magic link for instant sign-in
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: trimmedEmail,
      });

      if (linkErr || !linkData) {
        console.error("Generate link error:", linkErr);
        return new Response(JSON.stringify({ error: "Failed to create session" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const properties = linkData.properties;

      return new Response(
        JSON.stringify({
          success: true,
          token_hash: properties.hashed_token,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-otp error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
