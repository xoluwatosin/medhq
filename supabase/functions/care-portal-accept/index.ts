// Public inspection and authenticated acceptance of one Care portal invitation.
// Email is only a verification factor here. The invitation's recorded person
// and grant remain the authority, so this function never searches or merges by
// email, phone or name and never changes the grant's scopes.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { hashToken } from "../_shared/care-form.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const Body = z.object({
  action: z.enum(["inspect", "accept", "home"]),
  token: z.string().trim().min(32).max(256).optional(),
});

const maskEmail = (email: string) => {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return "your recorded email address";
  const start = local.slice(0, Math.min(2, local.length));
  return `${start}${"•".repeat(Math.max(2, Math.min(6, local.length - start.length)))}@${domain}`;
};

const scopes = (grant: Record<string, unknown>) => ({
  journey: grant.journey_scope === true,
  clinical: grant.clinical_scope === true,
  finance: grant.finance_scope === true,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "The invitation request is not valid" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const authHeader = req.headers.get("Authorization") ?? "";

    let user: { id: string; email?: string; email_confirmed_at?: string } | null = null;
    if (authHeader.startsWith("Bearer ")) {
      const caller = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data } = await caller.auth.getUser(authHeader.slice(7));
      user = data.user as typeof user;
    }

    if (parsed.data.action === "home") {
      if (!user) return json({ error: "Sign in to open this care record" }, 401);
      const { data: person } = await db
        .from("care_people")
        .select("id, full_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!person) return json({ error: "No Care access is linked to this account" }, 403);
      const { data: grants } = await db
        .from("care_access_grants")
        .select("id, client_id, journey_scope, clinical_scope, finance_scope, state, clients(enquiry_number)")
        .eq("person_id", person.id)
        .eq("state", "active")
        .order("granted_at", { ascending: false });
      return json({
        state: "ready",
        person_name: person.full_name,
        records: (grants ?? []).map((grant) => ({
          grant_id: grant.id,
          reference: (grant.clients as { enquiry_number?: string } | null)?.enquiry_number ?? "Care record",
          scopes: scopes(grant),
        })),
      });
    }

    if (!parsed.data.token) return json({ error: "The invitation link is incomplete" }, 400);
    const tokenHash = await hashToken(parsed.data.token);
    const { data: invitation } = await db
      .from("care_portal_invitations")
      .select("id, grant_id, person_id, client_id, destination, expires_at, first_opened_at, accepted_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!invitation) return json({ state: "invalid" }, 404);
    if (invitation.revoked_at) return json({ state: "withdrawn" }, 410);
    if (new Date(invitation.expires_at).getTime() <= Date.now()) return json({ state: "expired" }, 410);

    const { data: grant } = await db
      .from("care_access_grants")
      .select("id, state, journey_scope, clinical_scope, finance_scope")
      .eq("id", invitation.grant_id)
      .maybeSingle();
    if (!grant || grant.state !== "active") return json({ state: "unavailable" }, 403);

    if (parsed.data.action === "inspect") {
      if (!invitation.first_opened_at) {
        const now = new Date().toISOString();
        await db.from("care_portal_invitations").update({ first_opened_at: now }).eq("id", invitation.id).is("first_opened_at", null);
        await db.from("care_activity").insert({
          client_id: invitation.client_id,
          action: "portal_invitation_opened",
          detail: { person_id: invitation.person_id, invitation_id: invitation.id },
        });
      }
      return json({
        state: invitation.accepted_at ? "accepted" : "open",
        destination_hint: maskEmail(String(invitation.destination ?? "")),
      });
    }

    if (!user?.email || !user.email_confirmed_at) return json({ error: "Verify your email address before accepting this invitation" }, 401);
    const destination = String(invitation.destination ?? "").trim().toLowerCase();
    if (!destination || user.email.trim().toLowerCase() !== destination) {
      await db.from("care_activity").insert({
        client_id: invitation.client_id,
        action: "portal_invitation_rejected",
        detail: { person_id: invitation.person_id, invitation_id: invitation.id, reason: "verified_email_mismatch" },
        actor_id: user.id,
      });
      return json({ error: "This account does not match the invited email address" }, 403);
    }

    const { data: person } = await db
      .from("care_people")
      .select("id, full_name, auth_user_id")
      .eq("id", invitation.person_id)
      .maybeSingle();
    if (!person) return json({ error: "The invited person is not on record" }, 404);
    const { data: linkedPerson } = await db
      .from("care_people")
      .select("id")
      .eq("auth_user_id", user.id)
      .neq("id", person.id)
      .limit(1)
      .maybeSingle();
    if (linkedPerson) {
      await db.from("care_activity").insert({
        client_id: invitation.client_id,
        action: "portal_invitation_rejected",
        detail: { person_id: invitation.person_id, invitation_id: invitation.id, reason: "account_already_linked" },
        actor_id: user.id,
      });
      return json({ error: "This account is already linked to another Care person. Contact Medic Connect." }, 409);
    }
    if (person.auth_user_id && person.auth_user_id !== user.id) {
      await db.from("care_activity").insert({
        client_id: invitation.client_id,
        action: "portal_invitation_rejected",
        detail: { person_id: invitation.person_id, invitation_id: invitation.id, reason: "person_already_linked" },
        actor_id: user.id,
      });
      return json({ error: "This invitation is already linked to another account. Contact Medic Connect." }, 409);
    }

    if (!person.auth_user_id) {
      const { error: linkError } = await db
        .from("care_people")
        .update({ auth_user_id: user.id, updated_at: new Date().toISOString() })
        .eq("id", person.id)
        .is("auth_user_id", null);
      if (linkError) throw linkError;
    }

    const acceptedAt = invitation.accepted_at ?? new Date().toISOString();
    if (!invitation.accepted_at) {
      await db.from("care_portal_invitations").update({ accepted_at: acceptedAt }).eq("id", invitation.id).is("accepted_at", null);
      await db.from("care_activity").insert({
        client_id: invitation.client_id,
        action: "portal_invitation_accepted",
        detail: { person_id: invitation.person_id, invitation_id: invitation.id, grant_id: grant.id },
        actor_id: user.id,
      });
    }

    return json({
      state: "accepted",
      person_name: person.full_name,
      scopes: scopes(grant),
    });
  } catch (error) {
    console.error("care-portal-accept failed", error instanceof Error ? error.message : error);
    return json({ error: "Could not open this invitation" }, 500);
  }
});