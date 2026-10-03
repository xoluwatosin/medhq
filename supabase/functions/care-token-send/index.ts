// Sends a pre-assessment link to a client contact, and always hands the link
// back so a coordinator can paste it into WhatsApp.
//
// The link is produced before anything is sent. The client reference never
// changes. If the caller no longer holds the secret, a new secret is issued
// against the same reference, because a hash cannot be read backwards.
import { createClient } from "npm:@supabase/supabase-js@2";
import { hashToken, LINK_SEGMENT, newSecret } from "../_shared/care-form.ts";
import { SITE_URL } from "../_shared/site-url.ts";
import { dispatchNotification } from "../_shared/care-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f-]{36}$/i;
const METHODS = ["email", "whatsapp", "copied"];


Deno.serve(async (req) => {
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
    const { data: role } = await db
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Forbidden: admins only" }, 403);

    const body = await req.json().catch(() => ({}));
    const tokenId = typeof body?.token_id === "string" ? body.token_id : "";
    const method = typeof body?.delivery_method === "string" ? body.delivery_method : "";
    const offered = typeof body?.token === "string" ? body.token.trim().toUpperCase() : "";
    // Only a coordinator deliberately choosing Send again asks for a second
    // delivery. A double-clicked button is the same send, not a new one.
    const resend = body?.resend === true;
    const heldToken = LINK_SEGMENT.test(offered) ? offered : "";
    if (!UUID.test(tokenId)) return json({ error: "A link is required" }, 400);
    if (!METHODS.includes(method)) return json({ error: "Choose how the link is being sent" }, 400);

    const { data: token } = await db
      .from("care_access_tokens")
      .select("id, client_id, contact_id, person_id, revoked_at, frozen_at, expires_at, delivery_method, scope, covers_services, request_recipient_id")
      .eq("id", tokenId)
      .maybeSingle();
    if (!token) return json({ error: "Link not found" }, 404);
    if (token.revoked_at) return json({ error: "That link has been withdrawn" }, 400);
    if (token.frozen_at) return json({ error: "That form has already been sent back" }, 400);

    // A link that already went out is never quietly replaced. Only a
    // coordinator deliberately choosing Send again issues a new secret, so an
    // ordinary repeat can never invalidate the link the family already holds.
    const { count: deliveries } = await db
      .from("care_access_log")
      .select("id", { count: "exact", head: true })
      .eq("token_id", tokenId)
      .in("action", ["link_emailed", "link_whatsapp", "link_copied"]);
    const alreadyDelivered = (deliveries ?? 0) > 0 || !!token.delivery_method;

    let plain = heldToken;
    if (!plain && !resend && alreadyDelivered) {
      // Nothing to rotate and nothing to send again: the same link stands.
      return json({
        ok: true,
        link: null,
        already: true,
        emailed: false,
        email_error: null,
        note: "That link has already gone out. Use Send again to issue a replacement.",
      });
    }
    if (!plain) {
      const { data: owner } = await db
        .from("clients").select("enquiry_number").eq("id", token.client_id).maybeSingle();
      if (!owner?.enquiry_number) return json({ error: "That client has no reference yet" }, 409);
      plain = `${owner.enquiry_number}-${newSecret()}`;
      const { error: rotateError } = await db
        .from("care_access_tokens")
        .update({ token_hash: await hashToken(plain), updated_at: new Date().toISOString() })
        .eq("id", tokenId);
      if (rotateError) throw rotateError;
    }
    const link = `${SITE_URL}/pre-assessment/${plain}`;


    let emailed = false;
    let emailError: string | null = null;

    if (method === "email") {
      const { data: contact } = token.contact_id
        ? await db.from("client_contacts").select("full_name, email").eq("id", token.contact_id).maybeSingle()
        : { data: null };
      const address = (contact?.email ?? "").trim().toLowerCase();
      const first = (contact?.full_name ?? "").split(" ")[0] || "Hello";
      const topUp = token.scope === "top_up";
      const { data: recipient } = topUp && token.request_recipient_id
        ? await db.from("care_request_recipients").select("clients(full_name)").eq("id", token.request_recipient_id).maybeSingle()
        : { data: null };
      const recipientName = (recipient?.clients as { full_name?: string | null } | null)?.full_name ?? "the care recipient";
      const serviceNames = topUp && Array.isArray(token.covers_services) && token.covers_services.length > 0
        ? token.covers_services.join(", ").replaceAll("_", " ")
        : "the additional service";

      // Everything Care sends goes out through one durable record, so a retry
      // is the same send and a failure is visible on the record afterwards.
      const result = await dispatchNotification(db, {
        kind: "pre_assessment_link",
        channel: "email",
        dedupeKey: `pre_assessment_link:${tokenId}`,
        destination: address || null,
        personId: token.person_id ?? null,
        clientId: token.client_id,
        contactId: token.contact_id ?? null,
        relatedTable: "care_access_tokens",
        relatedId: tokenId,
        subject: topUp ? `Additional questions about ${recipientName}` : "A few questions before your visit",
        origin: "staff",
        resend,
        email: {
          eyebrow: topUp ? "Additional service" : "Before the visit",
          title: topUp ? `A few more questions about ${recipientName}` : "A few questions before your visit",
          standfirst: topUp ? `Only the questions needed for ${serviceNames}.` : "Ten minutes, on your phone, and you can come back to it.",
          markdown: topUp ? `${first},

${serviceNames} has been added for ${recipientName}. Please answer the additional questions needed for this service. Your previous answers remain on the care record.

[[cta:Answer the additional questions|${link}]]

If anything is difficult to answer, leave it and tell the nurse on the day.` : `${first},

Before a nurse visits, we ask a few questions so the visit is useful from the first minute. It takes about ten minutes, you can stop and come back to it, and you do not need an account.

[[cta:Answer the questions|${link}]]

If anything is difficult to answer, leave it and tell the nurse on the day.`,
          footnote: "Your answers are held as part of the care record and are not shared for any other purpose.",
        },
      });

      emailed = result.status === "sent";
      emailError = result.error ?? (emailed ? null : "The email could not be sent");
    }

    await db
      .from("care_access_tokens")
      .update({ delivery_method: method, updated_at: new Date().toISOString() })
      .eq("id", tokenId);

    await db.from("care_access_log").insert({
      token_id: tokenId,
      client_id: token.client_id,
      action: method === "email" ? (emailed ? "link_emailed" : "link_email_failed") : `link_${method}`,
    });

    // The journey moves because work moved, not because a stage was written.
    const { error: workError } = await db.rpc("care_work_event", {
      _client_id: token.client_id,
      _event: "pre_assessment_sent",
      _ref: tokenId,
    });
    if (workError) console.error("care-token-send work event failed", workError.message);

    return json({ ok: true, link, emailed, email_error: emailError });
  } catch (e) {
    console.error("care-token-send failed", e instanceof Error ? e.message : e);
    return json({ error: "Could not send the link" }, 500);
  }
});
