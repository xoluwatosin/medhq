// Invites a person who already holds a care access grant to open the portal.
//
// The grant is the authority. This function never widens it, never matches a
// human on an email address and never creates a second logical invitation:
// one live invitation per grant, and a retry sends that same invitation again
// through the shared notification layer.
import { createClient } from "npm:@supabase/supabase-js@2";
import { hashToken } from "../_shared/care-form.ts";
import { SITE_URL } from "../_shared/site-url.ts";
import { dispatchNotification } from "../_shared/care-notify.ts";
import { withOpsLog } from "../_shared/ops-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f-]{36}$/i;
const INVITE_DAYS = 30;

const secret = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
};

Deno.serve(withOpsLog("care-portal-invite", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

    const db = createClient(supabaseUrl, serviceRoleKey);

    // Care operations, not the administrator role.
    const { data: allowed } = await db.rpc("care_can_administer_access", { _user_id: callerId });
    if (allowed !== true) return json({ error: "Forbidden: care coordinators only" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action === "retry" ? "retry" : "invite";

    /* ---------- retry: the same invitation goes out again ---------- */
    if (action === "retry") {
      const notificationId = typeof body?.notification_id === "string" ? body.notification_id : "";
      if (!UUID.test(notificationId)) return json({ error: "A notification is required" }, 400);

      const { data: note } = await db
        .from("care_notifications")
        .select("id, kind, channel, destination, person_id, client_id, contact_id, related_table, related_id, subject, status, dedupe_key")
        .eq("id", notificationId)
        .maybeSingle();
      if (!note) return json({ error: "That notification is not on record" }, 404);
      if (note.status === "sent") return json({ error: "That has already been delivered" }, 400);
      if (note.status === "cancelled") return json({ error: "That send was stopped" }, 400);

      let link: string | null = null;
      if (note.kind === "portal_invitation" && note.related_id) {
        const { data: invite } = await db
          .from("care_portal_invitations")
          .select("id, revoked_at, accepted_at, expires_at")
          .eq("id", note.related_id)
          .maybeSingle();
        if (!invite || invite.revoked_at) return json({ error: "That invitation has been withdrawn" }, 400);
        if (invite.accepted_at) return json({ error: "That invitation has already been taken up" }, 400);
        // The secret cannot be read back out of a hash, so the same invitation
        // carries a fresh secret. No second invitation and no second grant.
        const plain = secret();
        const expires = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const { error: rotate } = await db
          .from("care_portal_invitations")
          .update({ token_hash: await hashToken(plain), expires_at: expires, updated_at: new Date().toISOString() })
          .eq("id", invite.id);
        if (rotate) throw rotate;
        link = `${SITE_URL}/care/invitation/${plain}`;
      }

      const result = await dispatchNotification(db, {
        kind: note.kind as "portal_invitation",
        channel: "email",
        dedupeKey: note.dedupe_key,
        destination: note.destination,
        personId: note.person_id,
        clientId: note.client_id,
        contactId: note.contact_id,
        relatedTable: note.related_table,
        relatedId: note.related_id,
        subject: note.subject,
        origin: "staff_retry",
        resend: true,
        email: link
          ? {
              eyebrow: "Your care record",
              title: "Open your care record",
              standfirst: "One link, on your phone, to follow what is happening.",
              markdown: `Here is your link again.\n\n[[cta:Open your care record|${link}]]\n\nThe link stops working after ${INVITE_DAYS} days.`,
            }
          : null,
      });

      return json({ ok: result.status !== "failed", ...result });
    }

    /* ---------- invite ---------- */
    const grantId = typeof body?.grant_id === "string" ? body.grant_id : "";
    if (!UUID.test(grantId)) return json({ error: "An access grant is required" }, 400);

    const { data: grant } = await db
      .from("care_access_grants")
      .select("id, person_id, client_id, state, journey_scope, clinical_scope, finance_scope")
      .eq("id", grantId)
      .maybeSingle();
    if (!grant) return json({ error: "That access is not on record" }, 404);
    if (grant.state !== "active") return json({ error: "That access is not open" }, 400);

    const { data: person } = await db
      .from("care_people").select("id, full_name, preferred_name, email").eq("id", grant.person_id).maybeSingle();
    if (!person) return json({ error: "That person is not on record" }, 404);
    const address = (person.email ?? "").trim().toLowerCase();
    if (!address) return json({ error: "That person has no email address" }, 400);

    // One live invitation per grant. An existing one is reused, not replaced.
    const { data: live } = await db
      .from("care_portal_invitations")
      .select("id, expires_at")
      .eq("grant_id", grantId)
      .is("revoked_at", null)
      .is("accepted_at", null)
      .maybeSingle();

    const plain = secret();
    let invitationId = live?.id ?? null;
    const expires = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    if (invitationId) {
      const { error } = await db
        .from("care_portal_invitations")
        .update({ token_hash: await hashToken(plain), destination: address, expires_at: expires })
        .eq("id", invitationId);
      if (error) throw error;
    } else {
      const { data: created, error } = await db
        .from("care_portal_invitations")
        .insert({
          grant_id: grantId,
          person_id: grant.person_id,
          client_id: grant.client_id,
          token_hash: await hashToken(plain),
          destination: address,
          expires_at: expires,
          created_by: callerId,
        })
        .select("id")
        .single();
      if (error) throw error;
      invitationId = created.id;
    }

    const link = `${SITE_URL}/care/invitation/${plain}`;
    const first = (person.preferred_name || person.full_name || "").split(" ")[0] || "Hello";

    const result = await dispatchNotification(db, {
      kind: "portal_invitation",
      channel: "email",
      dedupeKey: `portal_invitation:${invitationId}`,
      destination: address,
      personId: grant.person_id,
      clientId: grant.client_id,
      relatedTable: "care_portal_invitations",
      relatedId: invitationId,
      subject: "Open your care record",
      origin: "staff",
      resend: true,
      email: {
        eyebrow: "Your care record",
        title: "Open your care record",
        standfirst: "One link, on your phone, to follow what is happening.",
        markdown: `${first},\n\nYou can now follow this care record online.\n\n[[cta:Open your care record|${link}]]\n\nThe link stops working after ${INVITE_DAYS} days. You will only see what has been agreed you may see.`,
      },
    });

    await db.from("care_activity").insert({
      client_id: grant.client_id,
      action: "portal_invitation_sent",
      detail: { person_id: grant.person_id, invitation_id: invitationId, delivery: result.status },
      actor_id: callerId,
    });

    return json({ ok: result.status !== "failed", invitation_id: invitationId, ...result });
  } catch (e) {
    console.error("care-portal-invite failed", e instanceof Error ? e.message : e);
    return json({ error: "Could not send the invitation" }, 500);
  }
}));
