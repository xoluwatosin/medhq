import { createClient } from "npm:@supabase/supabase-js@2";
import { hashToken } from "../_shared/care-form.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const secret = (length = 24) => Array.from(crypto.getRandomValues(new Uint8Array(length)))
  .map((byte) => alphabet[byte % alphabet.length]).join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorised" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: claimError } = await caller.auth.getClaims(authHeader.slice(7));
    if (claimError || !claims?.claims?.sub) return json({ error: "Unauthorised" }, 401);
    const callerId = String(claims.claims.sub);
    const db = createClient(url, serviceKey);
    const { data: role } = await db.from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Forbidden: administrators only" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action === "revoke" ? "revoke" : "create";
    if (action === "revoke") {
      const id = typeof body?.id === "string" ? body.id : "";
      const { error } = await db.from("care_client_onboarding_links")
        .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id).is("completed_at", null);
      if (error) throw error;
      return json({ ok: true });
    }

    const plain = `MC-START-${secret()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await db.from("care_client_onboarding_links").insert({
      token_hash: await hashToken(plain), expires_at: expiresAt, created_by: callerId,
    }).select("id, expires_at").single();
    if (error) throw error;
    return json({ ok: true, id: data.id, token: plain, expires_at: data.expires_at });
  } catch (error) {
    console.error("care-onboarding-create failed", error instanceof Error ? error.message : error);
    return json({ error: "Could not create the onboarding link" }, 500);
  }
});
