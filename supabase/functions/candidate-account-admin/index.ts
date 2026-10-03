// Account management for candidate profiles.
//
// Admin-only. Three actions, each logged on the person's activity trail:
//   reset_link    — mint a one-time password link to read out or paste manually
//   update_email  — correct the email on file, and on their login if they have one
//   revoke_access — remove their sign-in while keeping the profile and its history
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SITE_URL } from "../_shared/site-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REDIRECT = `${SITE_URL}/portal/set-password`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
    const action = typeof body?.action === "string" ? body.action : "";
    if (!personId) return json({ error: "person_id is required" }, 400);

    const { data: person } = await admin
      .from("mu_people").select("id, full_name, email, auth_user_id").eq("id", personId).maybeSingle();
    if (!person) return json({ error: "Person not found" }, 404);

    const log = (act: string, detail: Record<string, unknown>) =>
      admin.from("mu_activity").insert({ person_id: personId, actor_id: callerId, action: act, detail });

    if (action === "reset_link") {
      const email = (person.email || "").trim().toLowerCase();
      if (!email) return json({ error: "No email on file for this person" }, 400);
      const { data, error } = await admin.auth.admin.generateLink({
        type: person.auth_user_id ? "recovery" : "invite",
        email,
        options: { redirectTo: REDIRECT, data: { display_name: person.full_name } },
      });
      if (error || !data?.properties?.hashed_token) {
        return json({ error: error?.message || "Could not generate a link" }, 400);
      }
      const type = person.auth_user_id ? "recovery" : "invite";
      const link = `${REDIRECT}?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=${type}`;
      if (data.user?.id && !person.auth_user_id) {
        await admin.from("mu_people").update({ auth_user_id: data.user.id }).eq("id", personId);
      }
      await log("password_link_generated", { email, type });
      return json({ success: true, link, email });
    }

    if (action === "update_email") {
      const next = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) return json({ error: "That email does not look right" }, 400);
      const previous = person.email;
      if (person.auth_user_id) {
        const { error } = await admin.auth.admin.updateUserById(person.auth_user_id, {
          email: next,
          email_confirm: true,
        });
        if (error) return json({ error: error.message }, 400);
      }
      const { error: upErr } = await admin.from("mu_people").update({ email: next }).eq("id", personId);
      if (upErr) return json({ error: upErr.message }, 400);
      await log("email_changed", { from: previous, to: next });
      return json({ success: true, email: next });
    }

    if (action === "revoke_access") {
      if (!person.auth_user_id) return json({ error: "This person has no account to revoke" }, 400);
      const { error } = await admin.auth.admin.deleteUser(person.auth_user_id);
      if (error) return json({ error: error.message }, 400);
      await admin.from("mu_people")
        .update({ auth_user_id: null, claimed_at: null, invited_at: null })
        .eq("id", personId);
      await log("portal_access_revoked", { email: person.email });
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
