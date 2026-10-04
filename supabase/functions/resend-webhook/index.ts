// Resend webhook handler — receives email events and updates campaign analytics.
// Public endpoint (verify_jwt = false). Signature verified via Svix headers.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/svix@1.21.0";
import { withOpsLog } from "../_shared/ops-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-signature, svix-timestamp",
};

serve(withOpsLog("resend-webhook", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.text();
    const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");

    // Signature verification is unconditional. If the secret is missing,
    // refuse to process events rather than falling back to unverified parsing.
    if (!secret) {
      console.error("RESEND_WEBHOOK_SECRET is not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let event: any;
    try {
      const wh = new Webhook(secret);
      event = wh.verify(payload, {
        "svix-id": req.headers.get("svix-id") ?? "",
        "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
        "svix-signature": req.headers.get("svix-signature") ?? "",
      });
    } catch (err) {
      console.error("Signature verification failed:", err);
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const type: string = event.type;
    const data = event.data || {};
    const resendEmailId: string | undefined = data.email_id;
    const recipients: string[] = Array.isArray(data.to) ? data.to : data.to ? [data.to] : [];
    const recipient = recipients[0]?.toLowerCase();
    // Resend has shipped tags both as [{ name, value }] and as a plain
    // { key: value } map; accept either so no event loses its labels.
    const rawTags = data.tags;
    const tagValue = (n: string): string | undefined =>
      Array.isArray(rawTags)
        ? (rawTags.find((t: any) => t?.name === n)?.value as string | undefined)
        : (rawTags?.[n] as string | undefined);
    const campaignId = tagValue("campaign_id");
    const template = tagValue("template");
    const personId = tagValue("person_id");
    // Resend reports the clicked URL on click events.
    const linkUrl: string | undefined = data?.click?.link ?? data?.link ?? undefined;

    if (!recipient || !type) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map Resend events
    const eventMap: Record<string, string> = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.opened": "opened",
      "email.clicked": "clicked",
      "email.bounced": "bounced",
      "email.complained": "complained",
      "email.delivery_delayed": "delayed",
      "email.failed": "failed",
    };
    const eventType = eventMap[type] ?? type.replace("email.", "");

    // Suppress bouncers/complainers
    if (eventType === "bounced" || eventType === "complained") {
      await supabase.from("email_suppressions").upsert(
        { email: recipient, reason: eventType, source: "resend_webhook" },
        { onConflict: "email" }
      );
    }

    // Record events for campaigns and for any transactional send carrying a
    // template tag. Untagged email is skipped so internal noise stays out.
    if (campaignId || template) {
      // Insert event (deduped by unique index)
      const { error: insertErr } = await supabase.from("campaign_events").insert({
        campaign_id: campaignId ?? null,
        template: template ?? null,
        person_id: personId ?? null,
        link_url: linkUrl ?? null,
        event_type: eventType,
        recipient_email: recipient,
        resend_email_id: resendEmailId,
        metadata: data,
      });

      // Ignore unique-violation duplicates (23505)
      if (insertErr && (insertErr as any).code !== "23505") {
        console.error("insert event error:", insertErr);
      }

      // Refresh aggregate counters off the authoritative event table. The
      // recount happens in SQL (campaign_sync_stats) so a large campaign is
      // never truncated by the 1000-row API page limit, and every total is
      // counted once per person rather than once per event.
      if (campaignId) {
        const { error: syncErr } = await supabase.rpc("campaign_sync_stats", {
          _campaign_id: campaignId,
        });
        if (syncErr) console.error("campaign_sync_stats error:", syncErr);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("resend-webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
