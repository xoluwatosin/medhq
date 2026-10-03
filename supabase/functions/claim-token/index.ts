// Personal claim links. Every past campaign recipient gets a token of their
// own, so the email can carry one button and the landing page still knows who
// opened it. The token only ever reveals the address it was minted for, and it
// stays valid after use so a later click on a follow-up email still works.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TRACKS = ["clinical", "support", "non_clinical", "student"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "").trim().slice(0, 100);
    const action = body?.action === "claim" ? "claim" : "open";

    if (!/^[a-f0-9]{20,80}$/.test(token)) return json({ ok: false, error: "Link not recognised" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: invite } = await admin
      .from("claim_invites")
      .select("id, email, track, claimed_at")
      .eq("token", token)
      .maybeSingle();

    if (!invite) return json({ ok: false, error: "Link not recognised" }, 404);

    if (action === "claim") {
      const track = TRACKS.includes(String(body?.track)) ? String(body.track) : invite.track;
      await admin
        .from("claim_invites")
        .update({ claimed_at: invite.claimed_at ?? new Date().toISOString(), track })
        .eq("id", invite.id);
      return json({ ok: true, email: invite.email });
    }

    const track = TRACKS.includes(String(body?.track)) ? String(body.track) : invite.track;
    await admin
      .from("claim_invites")
      .update({ opened_at: new Date().toISOString(), track })
      .eq("id", invite.id);

    return json({ ok: true, email: invite.email, claimed: Boolean(invite.claimed_at), track });
  } catch (e) {
    console.error("claim-token failed", e);
    return json({ ok: false, error: "Something went wrong. Please try again." }, 500);
  }
});
