// Candidate contact verification. One function, two actions: send a code and
// check it. The code is only ever stored hashed, and the browser never learns
// it. Nothing here trusts the client beyond the signed-in user it presents.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { kitEmail, kitCodePanel } from "../_shared/kit-email.ts";
import { emailTags } from "../_shared/email-tags.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Channel switch. Email today. The moment Meta approves the WhatsApp
 * authentication template, set this to "whatsapp" and email becomes the
 * fallback for anyone the message cannot reach.
 */
const PRIMARY_CHANNEL: "email" | "whatsapp" = "email";

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_WINDOW = 4;
const SEND_WINDOW_MINUTES = 15;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const generateCode = () => {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1000000).padStart(6, "0");
};

const hashCode = async (code: string, salt: string) => {
  const data = new TextEncoder().encode(`${salt}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Please sign in again." }, 401);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Please sign in again." }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const action = body?.action === "verify" ? "verify" : "send";

    const { data: person } = await admin
      .from("mu_people")
      .select("id, full_name, phone, contact_verified_at")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (person?.contact_verified_at || (user.user_metadata as any)?.contact_verified_at) {
      return json({ ok: true, alreadyVerified: true });
    }

    // ── Send a code ─────────────────────────────────────────────────────────
    if (action === "send") {
      const since = new Date(Date.now() - SEND_WINDOW_MINUTES * 60_000).toISOString();
      const { count } = await admin
        .from("mu_verifications")
        .select("id", { count: "exact", head: true })
        .eq("auth_user_id", user.id)
        .gte("created_at", since);

      if ((count ?? 0) >= MAX_SENDS_PER_WINDOW) {
        return json(
          { error: "We have sent several codes already. Please wait a few minutes and try again." },
          429,
        );
      }

      const code = generateCode();
      const destination = (user.email ?? "").toLowerCase();
      if (!destination) return json({ error: "We hold no email address for you." }, 400);

      const { data: verification, error: insertError } = await admin.from("mu_verifications").insert({
        auth_user_id: user.id,
        person_id: person?.id ?? null,
        channel: PRIMARY_CHANNEL,
        destination,
        code_hash: await hashCode(code, user.id),
        expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
      }).select("id").single();
      if (insertError || !verification) {
        console.error("candidate-verify insert failed", insertError);
        return json({ error: "We could not start the check. Please try again." }, 500);
      }

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) {
        await admin.from("mu_verifications").delete().eq("id", verification.id);
        return json({ error: "Email is not configured." }, 500);
      }

      const firstName = (person?.full_name ?? "").split(" ")[0];
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: "Medic Connect <noreply@medicconnect.co>",
          to: [destination],
          subject: "Your Medic Connect confirmation code",
          tags: [...emailTags("candidate-verify", person?.id ?? null), { name: "type", value: "candidate_verify" }],
          html: kitEmail({
            eyebrow: "Candidate portal",
            title: firstName ? `${firstName}, confirm it is you` : "Confirm it is you",
            standfirst:
              "Enter this code to finish opening your profile. It expires ten minutes after it was sent.",
            preheader: "Your Medic Connect confirmation code, valid for ten minutes.",
            bodyHtml: kitCodePanel(code, "Valid for 10 minutes"),
            footnote:
              "If you did not create a Medic Connect profile, ignore this email and the code expires on its own. Never share it with anyone, including our own team.",
          }),
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        console.error("candidate-verify resend failed", res.status, detail);
        // A message that never left must not use up a resend or invalidate the
        // last code the candidate may still have in their inbox.
        await admin.from("mu_verifications").delete().eq("id", verification.id);
        return json({ error: "We could not send the email. Please try again." }, 502);
      }

      // Only after delivery succeeds do we close older codes. This prevents a
      // temporary email-provider failure from leaving the candidate stranded.
      await admin
        .from("mu_verifications")
        .update({ consumed_at: new Date().toISOString() })
        .eq("auth_user_id", user.id)
        .is("consumed_at", null)
        .neq("id", verification.id);

      return json({ ok: true, channel: PRIMARY_CHANNEL, destination });
    }

    // ── Check a code ────────────────────────────────────────────────────────
    const code = String(body?.code ?? "").replace(/\D/g, "");
    if (code.length !== 6) return json({ error: "Enter the six digits we sent you." }, 400);

    const { data: row } = await admin
      .from("mu_verifications")
      .select("id, code_hash, expires_at, attempts")
      .eq("auth_user_id", user.id)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return json({ error: "That code has expired. Ask for a new one." }, 401);

    if (new Date(row.expires_at) < new Date()) {
      await admin.from("mu_verifications")
        .update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
      return json({ error: "That code has expired. Ask for a new one." }, 401);
    }

    if (row.code_hash !== (await hashCode(code, user.id))) {
      const attempts = (row.attempts ?? 0) + 1;
      const burned = attempts >= MAX_ATTEMPTS;
      await admin.from("mu_verifications").update({
        attempts,
        consumed_at: burned ? new Date().toISOString() : null,
      }).eq("id", row.id);
      return json({
        error: burned
          ? "That code is now closed after too many tries. Ask for a new one."
          : `That code does not match. You have ${MAX_ATTEMPTS - attempts} tries left.`,
      }, 401);
    }

    const now = new Date().toISOString();
    await admin.from("mu_verifications").update({ consumed_at: now }).eq("id", row.id);
    if (person?.id) {
      await admin.from("mu_people").update({ contact_verified_at: now }).eq("id", person.id);
    }
    // The profile row is sometimes written a moment after the account, so the
    // account itself carries the proof until the two meet.
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...(user.user_metadata ?? {}), contact_verified_at: now },
    });


    return json({ ok: true, verified: true });
  } catch (err) {
    console.error("candidate-verify error", err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
