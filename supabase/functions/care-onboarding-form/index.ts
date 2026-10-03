import { createClient } from "npm:@supabase/supabase-js@2";
import { hashToken, newSecret } from "../_shared/care-form.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const TOKEN = /^MC-START-[A-Z0-9]{24}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim().toUpperCase() : "";
    if (!TOKEN.test(token)) return json({ error: "This link is not valid" }, 404);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const tokenHash = await hashToken(token);
    const { data: link } = await db.from("care_client_onboarding_links")
      .select("id, status, intake, position, expires_at, revoked_at, first_opened_at, pre_assessment_token_id")
      .eq("token_hash", tokenHash).maybeSingle();
    if (!link) return json({ error: "This link is not valid" }, 404);
    if (link.revoked_at) return json({ error: "This link has been withdrawn" }, 410);
    if (new Date(link.expires_at) < new Date()) return json({ error: "This link has expired" }, 410);

    if (body?.action === "load") {
      if (!link.first_opened_at) await db.from("care_client_onboarding_links").update({ first_opened_at: new Date().toISOString() }).eq("id", link.id);
      // The details stage is done once. Whoever still holds the same link is the
      // same holder, so re-opening it carries straight on into the
      // pre-assessment. The plain segment is never stored, so a fresh secret is
      // issued on the same token and returned once.
      if (link.status === "completed" && link.pre_assessment_token_id) {
        const { data: tok } = await db.from("care_access_tokens")
          .select("id, client_id, submitted_at, revoked_at").eq("id", link.pre_assessment_token_id).maybeSingle();
        if (tok && !tok.revoked_at && !tok.submitted_at) {
          const { data: client } = await db.from("clients").select("enquiry_number").eq("id", tok.client_id).maybeSingle();
          if (client?.enquiry_number) {
            const secret = newSecret();
            const plain = `${client.enquiry_number}-${secret}`;
            const { error: rotateError } = await db.from("care_access_tokens").update({
              token_hash: await hashToken(plain),
              expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("id", tok.id);
            if (!rotateError) {
              await db.from("care_access_log").insert({ token_id: tok.id, client_id: tok.client_id, action: "token_reissued" });
              return json({ ok: true, status: link.status, completed: true, intake: link.intake ?? {}, position: link.position, pre_assessment_token: plain });
            }
          }
        }
      }
      return json({ ok: true, status: link.status, intake: link.intake ?? {}, position: link.position, completed: link.status === "completed" });
    }
    if (link.status === "completed") return json({ error: "This link has already been completed" }, 409);
    if (body?.action === "save") {
      const intake = body?.intake && typeof body.intake === "object" ? body.intake : {};
      const position = Number.isInteger(body?.position) ? Math.max(1, Math.min(5, body.position)) : 1;
      const { error } = await db.from("care_client_onboarding_links")
        .update({ intake, position, updated_at: new Date().toISOString() }).eq("id", link.id);
      if (error) throw error;
      return json({ ok: true });
    }
    if (body?.action !== "complete") return json({ error: "Unknown action" }, 400);

    const intake = body?.intake && typeof body.intake === "object" ? body.intake : null;
    if (!intake) return json({ error: "Complete the required details before continuing" }, 400);
    const preSecret = newSecret();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    // The plain random segment is returned once. The database stores only its
    // hash and composes the final client reference inside the same transaction.
    const { data, error } = await db.rpc("care_client_onboarding_complete", {
      _onboarding_hash: tokenHash, _pre_assessment_hash: preSecret,
      _intake: intake, _expires_at: expiresAt,
    });
    if (error) return json({ error: error.message }, 400);
    const result = data as { client_id: string; pre_assessment_token_id: string; already_completed?: boolean };
    if (result.already_completed) return json({ error: "This link has already been completed" }, 409);
    const { data: client } = await db.from("clients").select("enquiry_number").eq("id", result.client_id).single();
    if (!client?.enquiry_number) throw new Error("The new client reference was not created");
    return json({ ok: true, pre_assessment_token: `${client.enquiry_number}-${preSecret}` });
  } catch (error) {
    console.error("care-onboarding-form failed", error instanceof Error ? error.message : error);
    return json({ error: "Could not save these details" }, 500);
  }
});
