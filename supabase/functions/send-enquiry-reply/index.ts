// The tailored reply to a care enquiry.
//
// One email, built from the service line the person chose: our own words for
// that line, the answers they gave read back to them so they know we listened,
// what happens at a care needs assessment, and the brochure for that line
// attached. Every send is written down, so nobody is sent the same guide twice.

import { createClient } from "npm:@supabase/supabase-js@2";
import { KIT_ART, kitEmail, kitParagraph, kitSubhead, kitFacts, kitSteps, kitButton } from "../_shared/kit-email.ts";
import { emailTags } from "../_shared/email-tags.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const labelFor = (key: string) =>
  titleCase(key.replace(/_/g, " "));

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ error: "Email service not configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const enquiryId = String(body.enquiry_id ?? "").trim();
    const force = body.force === true;
    if (!/^[0-9a-f-]{36}$/i.test(enquiryId)) return json({ error: "Missing or invalid enquiry" }, 400);

    const db = admin();

    const { data: enquiry, error: eErr } = await db
      .from("contact_submissions")
      .select("*")
      .eq("id", enquiryId)
      .maybeSingle();
    if (eErr) throw eErr;
    if (!enquiry) return json({ error: "Enquiry not found" }, 404);
    if (!enquiry.email) return json({ error: "No email address on the enquiry" }, 400);

    // Suppressed addresses are never written to again.
    const { data: suppressed } = await db
      .from("email_suppressions")
      .select("email")
      .eq("email", String(enquiry.email).toLowerCase())
      .maybeSingle();
    if (suppressed) return json({ ok: false, skipped: "suppressed" });

    if (!force) {
      const { data: already } = await db
        .from("enquiry_sends")
        .select("id")
        .eq("enquiry_id", enquiryId)
        .eq("kind", "auto_reply")
        .eq("status", "sent")
        .maybeSingle();
      if (already) return json({ ok: false, skipped: "already_sent" });
    }

    const { data: line } = await db
      .from("enquiry_service_lines")
      .select("*")
      .eq("key", enquiry.service_line ?? "general")
      .maybeSingle();

    const lineName = line?.name ?? enquiry.service ?? "care";
    const subject = line?.reply_subject || `Your ${lineName.toLowerCase()} enquiry, and what happens next`;
    const first = String(enquiry.name ?? "there").trim().split(" ")[0] || "there";

    // Read their answers back to them, in their own words.
    const answers = (enquiry.answers ?? {}) as Record<string, unknown>;
    const facts = Object.entries(answers)
      .filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
      .slice(0, 12)
      .map(([k, v]) => ({ label: labelFor(k), value: Array.isArray(v) ? v.join(", ") : String(v) }));
    if (enquiry.city) facts.unshift({ label: "Where", value: String(enquiry.city) });
    facts.unshift({ label: "Service", value: lineName });

    // The brochure for this line, attached and linked.
    let attachment: { filename: string; content: string } | null = null;
    let brochureUrl: string | null = null;
    if (line?.brochure_path) {
      const { data: file } = await db.storage.from("applications").download(line.brochure_path);
      if (file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        attachment = {
          filename: (line.brochure_name || `${line.key}-guide.pdf`).replace(/[^\w.\- ]/g, ""),
          content: bytesToBase64(bytes),
        };
      }
      const { data: signed } = await db.storage
        .from("applications")
        .createSignedUrl(line.brochure_path, 60 * 60 * 24 * 30);
      brochureUrl = signed?.signedUrl ?? null;
    }

    const bodyHtml = [
      kitParagraph(`Dear ${first},`),
      kitParagraph(line?.reply_intro || "Thank you for getting in touch with Medic Connect. Here is what happens from here."),
      kitSubhead("What happens next"),
      kitSteps([
        { title: "We'll be in touch", detail: "A care coordinator calls or messages you on WhatsApp, usually the same working day." },
        { title: "Care needs", detail: "A paid **₦35,000** assessment may be required. If it is, a nurse visits the home for about ninety minutes." },
        { title: "A match", detail: "A carer chosen for the plan and the person. You see their profile before care begins." },
        { title: "Care begins", detail: "On the days you agree, with your coordinator alongside." },
      ]),
      kitSubhead("What you told us"),
      kitFacts(facts),
      kitParagraph(line?.reply_outro || "The guide attached takes you through the assessment, our services and how our pricing is structured."),
      brochureUrl ? kitButton("Open your guide", brochureUrl) : "",
      kitParagraph("If anything changes, or it becomes urgent, reply to this email or message us on WhatsApp on +234 812 698 8237."),
      kitParagraph("The Medic Connect care team"),
    ].join("");

    const html = kitEmail({
      eyebrow: "Care enquiry",
      title: "Your request is in",
      accent: "request",
      art: KIT_ART.coordinator,
      standfirst: `Your enquiry about ${lineName.toLowerCase()}.`,
      preheader: "A care coordinator will be in touch, usually the same working day.",
      bodyHtml,
      footnote: "Medic Connect Limited, 145 Igbosere Road, Lagos Island, Nigeria.",
    });

    const payload: Record<string, unknown> = {
      from: "Medic Connect <hello@medicconnect.co>",
      to: [enquiry.email],
      subject,
      html,
    };
    if (attachment) payload.attachments = [attachment];

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, tags: emailTags("enquiry-reply") }),
    });
    const out = await res.json();

    await db.from("enquiry_sends").insert({
      enquiry_id: enquiryId,
      email: enquiry.email,
      service_line: enquiry.service_line,
      kind: "auto_reply",
      subject,
      brochure_name: attachment?.filename ?? null,
      status: res.ok ? "sent" : "failed",
      provider_id: res.ok ? (out?.id ?? null) : null,
      error: res.ok ? null : JSON.stringify(out).slice(0, 500),
      actor: body.actor ?? "system",
    });

    if (!res.ok) {
      console.error("resend", res.status, out);
      return json({ error: out?.message ?? "Email failed", status: res.status, details: out }, 502);
    }

    await db
      .from("contact_submissions")
      .update({ last_sent_at: new Date().toISOString(), replied_at: enquiry.replied_at ?? new Date().toISOString() })
      .eq("id", enquiryId);

    return json({ ok: true, brochure: attachment?.filename ?? null });
  } catch (err) {
    console.error("send-enquiry-reply", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
