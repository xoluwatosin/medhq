// Tells a candidate an offer is waiting for them.
//
// The email carries the shape of the work (dated shifts or an ongoing role),
// where it is, what it pays if we said, and when we need an answer. The answer
// itself is always given in the portal, never by reply. Every send is written
// to the person's activity trail.
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

const PORTAL = `${SITE_URL}/portal`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });

const longDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });

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
    const offerId = typeof body?.offer_id === "string" ? body.offer_id : "";
    if (!offerId) return json({ error: "offer_id is required" }, 400);

    const { data: offer } = await admin
      .from("mu_offers")
      .select("id, person_id, kind, title, location, rate_note, message, pattern, start_date, status, expires_at")
      .eq("id", offerId)
      .maybeSingle();
    if (!offer) return json({ error: "Offer not found" }, 404);
    if (!["sent", "viewed"].includes(String(offer.status))) {
      return json({ error: "This offer is not open, so nothing was sent" }, 400);
    }

    const { data: shifts } = await admin
      .from("mu_offer_shifts")
      .select("slot_date, start_hour, end_hour, location")
      .eq("offer_id", offerId)
      .order("slot_date");

    const { data: person } = await admin
      .from("mu_people").select("id, full_name, email").eq("id", offer.person_id).maybeSingle();
    const email = (person?.email || "").trim().toLowerCase();
    if (!email) return json({ error: "No email on file for this person" }, 400);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ error: "Email service not configured" }, 500);

    const firstName = (person?.full_name || "there").split(/\s+/)[0];
    const isRole = offer.kind === "role";
    const subject = isRole
      ? `A role for you: ${offer.title}`
      : `Work offered to you: ${offer.title}`;

    const detail = [
      offer.location ? `**Where:** ${offer.location}` : "",
      offer.rate_note ? `**Rate:** ${offer.rate_note}` : "",
      offer.pattern ? `**Pattern:** ${offer.pattern}` : "",
      offer.start_date ? `**Starts:** ${longDate(offer.start_date)}` : "",
    ].filter(Boolean).join("\n\n");

    const shiftLines = ((shifts as any[]) || [])
      .map((s) => `- ${dayLabel(s.slot_date)}, ${hh(s.start_hour)} to ${hh(s.end_hour)}${s.location ? ` at ${s.location}` : ""}`)
      .join("\n");

    const deadline = offer.expires_at
      ? `Please answer by ${new Date(offer.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
      : "There is no deadline on this, but the sooner you answer the better we can plan.";

    const content = `Hi ${firstName},

We have offered you ${isRole ? "an ongoing role" : "work"}: **${offer.title}**.

${detail}

${shiftLines ? `**The shifts**\n\n${shiftLines}\n` : ""}${offer.message ? `\n${offer.message}\n` : ""}
${deadline}

Say yes and we book it in, and your calendar updates so nobody double-books you. Say no and it costs you nothing, it only tells us what suits you better next time.

Please answer in your account rather than by reply, so the record stays right.

[[cta:See the offer|${PORTAL}]]`;

    const html = kitEmailFromMarkdown({
      eyebrow: isRole ? "Role offer" : "Shift offer",
      title: isRole ? "A role for you" : "Work offered to you",
      standfirst: "Answer in your account so your calendar stays right.",
      preheader: subject,
      markdown: content,
      footnote: "Answering costs you nothing either way. A no simply tells us what suits you better next time.",
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
        tags: emailTags("offer-notification", offer.person_id),
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Resend failed [${res.status}]: ${errBody}`);
      return json({ error: "Email send failed", details: errBody }, res.status);
    }

    await admin.from("mu_activity").insert({
      person_id: offer.person_id,
      actor_id: callerId,
      action: "offer_emailed",
      detail: { offer_id: offer.id, title: offer.title, kind: offer.kind, email },
    });

    return json({ success: true, email });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
