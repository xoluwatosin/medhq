// Tells a candidate what happened to a document we reviewed. Rejections always
// carry the reason and what to send instead. Every send is written to the
// person's activity trail so the feedback leaves a record.
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
    const documentId = typeof body?.document_id === "string" ? body.document_id : "";
    if (!documentId) return json({ error: "document_id is required" }, 400);

    const { data: doc } = await admin
      .from("mu_documents")
      .select("id, person_id, label, doc_type, review_outcome, review_reason, conditional_until, conditional_reason")
      .eq("id", documentId)
      .maybeSingle();
    if (!doc) return json({ error: "Document not found" }, 404);

    const { data: person } = await admin
      .from("mu_people").select("id, full_name, email").eq("id", doc.person_id).maybeSingle();
    const email = (person?.email || "").trim().toLowerCase();
    if (!email) return json({ error: "No email on file for this person" }, 400);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ error: "Email service not configured" }, 500);

    const firstName = (person?.full_name || "there").split(/\s+/)[0];
    const rejected = doc.review_outcome === "rejected";
    // Accepted for the time being: it counts until the review date, and we
    // still need a current copy before then.
    const conditional = !rejected && !!doc.conditional_until;
    const reviewBy = doc.conditional_until
      ? new Date(String(doc.conditional_until)).toLocaleDateString("en-GB", {
          day: "numeric", month: "long", year: "numeric",
        })
      : "";

    const subject = rejected
      ? `We need a different copy of your ${String(doc.doc_type || "document").toLowerCase()}`
      : conditional
        ? `We still need a current copy of your ${String(doc.doc_type || "document").toLowerCase()}`
        : `Your ${String(doc.doc_type || "document").toLowerCase()} has been accepted`;

    const content = rejected
      ? `Hi ${firstName},

Thank you for sending your **${doc.label}**. We reviewed it and unfortunately we cannot accept this copy.

> ${doc.review_reason || "The copy we received could not be read clearly."}

Please upload a replacement when you can. It must be a PDF of the full document, with the dates readable. Photographs and other file types cannot be accepted.

Keeping your documents current matters: when a client asks us for staff, we can only put forward people whose details and documents we have checked.

[[cta:Upload a replacement|${PORTAL}]]`
      : conditional
        ? `Hi ${firstName},

We have accepted your **${doc.label}** for the time being, so it will not hold anything up.

> ${doc.conditional_reason || "The copy we hold is out of date, so we are working with it while you send a current one."}

Please upload a current copy by **${reviewBy}**. After that date the item goes back to outstanding on your profile.

[[cta:Upload a current copy|${PORTAL}]]`
        : `Hi ${firstName},

Your **${doc.label}** has been checked and accepted. Thank you.

You can see everything we hold for you, and anything still outstanding, in your account.

[[cta:Open your account|${PORTAL}]]`;

    const html = kitEmailFromMarkdown({
      eyebrow: "Document review",
      title: rejected
        ? "About a document you sent"
        : conditional
          ? "Accepted for now"
          : "Document accepted",
      standfirst: rejected
        ? "We could not accept the copy on file, so the item is still outstanding."
        : conditional
          ? `Accepted until ${reviewBy}. We still need a current copy before then.`
          : "Checked, accepted and filed against your profile.",
      preheader: subject,
      markdown: content,
      footnote: "Anything you upload stays private to the Medic Connect team.",
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
        tags: emailTags("document-review", doc.person_id),
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Resend failed [${res.status}]: ${errBody}`);
      return json({ error: "Email send failed", details: errBody }, res.status);
    }

    await admin.from("mu_activity").insert({
      person_id: doc.person_id,
      actor_id: callerId,
      action: rejected ? "document_feedback_emailed" : "document_accepted_emailed",
      detail: { document_id: doc.id, label: doc.label, reason: doc.review_reason, email },
    });

    return json({ success: true, email });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
