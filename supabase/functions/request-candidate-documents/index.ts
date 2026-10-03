// Asks a candidate for specific documents.
//
// Admin picks what is outstanding, optionally adds a line of context, and this
// sends one branded email naming each item and linking to their account. Every
// request is written to the person's activity trail so we can see who chased
// what, and when.
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

const escapeMd = (s: string) => s.replace(/[<>]/g, "");

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
    const docTypes: string[] = Array.isArray(body?.doc_types)
      ? body.doc_types.filter((t: unknown) => typeof t === "string").slice(0, 25)
      : [];
    const note = typeof body?.note === "string" ? body.note.slice(0, 500).trim() : "";
    const deadline = typeof body?.due_by === "string" ? body.due_by.slice(0, 10) : "";
    if (!personId) return json({ error: "person_id is required" }, 400);
    if (docTypes.length === 0) return json({ error: "Choose at least one document to request" }, 400);

    const { data: person } = await admin
      .from("mu_people").select("id, full_name, email").eq("id", personId).maybeSingle();
    if (!person) return json({ error: "Person not found" }, 404);
    const email = (person.email || "").trim().toLowerCase();
    if (!email) return json({ error: "No email on file for this person" }, 400);

    // Resolve the friendly labels and current state from the requirement view so
    // the email says the same thing the candidate sees in their account.
    const { data: status } = await admin.rpc("mu_document_status", { _person_id: personId });
    const rows = (status ?? []).filter((r: any) => docTypes.includes(r.doc_type));
    const items = (rows.length ? rows : docTypes.map((t) => ({ doc_type: t, label: t, status: "missing" })))
      .map((r: any) => {
        const suffix =
          r.status === "rejected"
            ? ` — we could not accept the copy on file${r.review_reason ? ` (${r.review_reason})` : ""}`
            : r.status === "expired"
              ? " — the copy we hold has expired"
              : "";
        return `- ${escapeMd(r.label || r.doc_type)}${suffix}`;
      });

    const firstName = (person.full_name || "there").split(/\s+/)[0];
    const subject =
      items.length === 1
        ? `We need one document from you`
        : `We need ${items.length} documents from you`;

    const content = `Hi ${firstName},

We are updating our records and there ${items.length === 1 ? "is one item" : `are ${items.length} items`} we still need from you.

## What to send

${items.join("\n")}
${note ? `\n> ${escapeMd(note)}\n` : ""}
Please send each document as a PDF, as long as the whole page and any dates are readable. Photographs and other file types cannot be accepted. If a document has an expiry date, please send the current version.${deadline ? `\n\nWhere possible, please send these by ${deadline}.` : ""}

When a client comes to us with a need, we look into our own pool first. We can only put someone forward when the documents we hold for them are complete, current and checked.

[[cta:Upload your documents|${PORTAL}]]

Anything you send stays private to our team.`;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ error: "Email service not configured" }, 500);

    const html = kitEmailFromMarkdown({
      eyebrow: "Documents",
      title: "Documents we still need",
      standfirst: "Please send each document as a PDF, with the dates readable.",
      preheader: subject,
      markdown: content,
      footnote: "Anything you send stays private to the Medic Connect team.",
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
        tags: emailTags("document-request", personId),
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Resend failed [${res.status}]: ${errBody}`);
      return json({ error: "Email send failed", details: errBody }, res.status);
    }

    await admin.from("mu_activity").insert({
      person_id: personId,
      actor_id: callerId,
      action: "documents_requested",
      detail: { email, doc_types: docTypes, note: note || null, due_by: deadline || null },
    });

    return json({ success: true, email, requested: docTypes.length });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
