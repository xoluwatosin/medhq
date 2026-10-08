// Sending a care offer to the family: by email, by WhatsApp, or as a copied
// link. Each send makes its own link, so one can be withdrawn without the
// others. The email carries the PDF the staff member's browser made from the
// very same document the family will see. Sending fixes the offer: from here
// on its words and prices cannot change.
import { createClient } from "npm:@supabase/supabase-js@2";
import { KIT_ART, kitEmail } from "../_shared/kit-email.ts";
import { offerEmailBody } from "../_shared/care-offer-email.ts";
import { newOfferSecret, offerTokenHash } from "../_shared/care-offer.ts";
import { SITE_URL } from "../_shared/site-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f-]{36}$/i;
const CHANNELS = ["email", "whatsapp", "copied"] as const;
type Channel = typeof CHANNELS[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: claimsError } = await caller.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const callerId = claims.claims.sub as string;

    const db = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: role } = await db.from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Forbidden: admins only" }, 403);

    const body = await req.json().catch(() => ({}));
    const offerId = typeof body?.offer_id === "string" ? body.offer_id : "";
    const channel = (CHANNELS as readonly string[]).includes(body?.channel) ? body.channel as Channel : null;
    if (!UUID.test(offerId)) return json({ error: "An offer is required" }, 400);
    if (!channel) return json({ error: "Choose how the offer is being sent" }, 400);

    const { data: offer } = await db.from("care_offers").select("*").eq("id", offerId).maybeSingle();
    if (!offer) return json({ error: "Offer not found" }, 404);
    if (offer.status === "withdrawn") return json({ error: "That offer has been withdrawn" }, 409);
    if (offer.status === "accepted") return json({ error: "That offer has already been accepted" }, 409);
    if (offer.expires_at && new Date(offer.expires_at) < new Date()) return json({ error: "That offer has expired. Make a new one." }, 409);
    const content = (offer.content ?? {}) as Record<string, any>;
    const pay = content.payment ?? {};
    if (!String(pay.bankName ?? "").trim() || !/^\d{10}$/.test(String(pay.accountNumber ?? "").trim())) {
      return json({ error: "Add the bank details before sending" }, 400);
    }

    // The family's main contact receives it.
    const { data: contact } = await db
      .from("client_contacts").select("full_name, first_name, email, whatsapp, phone")
      .eq("client_id", offer.client_id).eq("is_primary", true).maybeSingle();
    const email = String(contact?.email ?? "").trim().toLowerCase();
    if (channel === "email" && !email) return json({ error: "The main contact has no email address" }, 400);

    const plain = `${offer.reference}-${newOfferSecret()}`;
    const { error: linkError } = await db.from("care_offer_links").insert({
      offer_id: offer.id, token_hash: await offerTokenHash(plain), channel, created_by: callerId,
    });
    if (linkError) throw linkError;
    const link = `${SITE_URL}/o/${plain}`;

    const first = String(contact?.first_name || String(contact?.full_name ?? "").split(" ")[0] || "Hello");
    const options = (content.options ?? []) as { id: string; title: string; monthly: number }[];
    const careFor = String(content.careFor ?? "your family");

    let emailed = false;
    let emailError: string | null = null;
    if (channel === "email") {
      const key = Deno.env.get("RESEND_API_KEY");
      if (!key) return json({ error: "Email is not configured" }, 500);
      const pdf = typeof body?.pdf_base64 === "string" && body.pdf_base64.length < 12_000_000 ? body.pdf_base64 : null;
      // A short, warm note: what is inside, and the way in. The prices and the
      // steps are in the offer itself and in the PDF.
      const validUntil = offer.expires_at
        ? new Date(offer.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : null;
      const html = kitEmail({
        eyebrow: "Care offer",
        title: "Your care offer is here",
        accent: "here",
        art: KIT_ART.nurse,
        standfirst: `${content.serviceTitle ?? "Care"} for ${careFor}, all in one place`,
        preheader: `Your care offer for ${careFor} is ready when you are`,
        bodyHtml: offerEmailBody({ first, careFor, optionCount: options.length, link, validUntil }),
      });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Medic Connect <hello@medicconnect.co>",
          to: [email],
          reply_to: "hello@medicconnect.co",
          subject: `Your care offer for ${careFor} is ready`,
          html,
          ...(pdf ? { attachments: [{ filename: `Care offer for ${careFor}, Medic Connect.pdf`, content: pdf }] } : {}),
        }),
      });
      emailed = res.ok;
      if (!res.ok) emailError = `The email could not be sent (${res.status})`;
    }

    if (channel !== "email" || emailed) {
      if (offer.status === "draft") {
        await db.from("care_offers").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", offer.id).eq("status", "draft");
      }
      await db.from("care_activity").insert({
        client_id: offer.client_id, action: "offer_sent",
        detail: { offer_id: offer.id, reference: offer.reference, channel, to: channel === "email" ? email : null },
        actor_id: callerId,
      });
    } else {
      await db.from("care_offer_links").update({ revoked_at: new Date().toISOString() }).eq("token_hash", await offerTokenHash(plain));
    }

    const whatsappText = [
      `Hello ${first}, here is your care offer for ${careFor} from Medic Connect.`,
      options.length > 1 ? `It compares ${options.map((o) => o.title.toLowerCase()).join(" and ")}, with prices and the terms.` : "It has the price and the terms.",
      `You can read it, download it as a PDF, sign and pay here: ${link}`,
      "Once your payment is in, we email you your signed agreement and get in touch to plan day 0.",
      "Any questions, just reply here.",
    ].join("\n\n");

    return json({
      ok: channel !== "email" || emailed,
      error: emailError,
      link,
      whatsapp_text: channel === "whatsapp" ? whatsappText : null,
      whatsapp_number: channel === "whatsapp" ? String(contact?.whatsapp || contact?.phone || "") : null,
      emailed,
      to: channel === "email" ? email : null,
    });
  } catch (e) {
    console.error("care-offer-send failed", e instanceof Error ? e.message : e);
    return json({ error: "Could not send the offer" }, 500);
  }
});
