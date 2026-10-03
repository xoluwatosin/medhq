// Delivering the signed contract.
//
// The PDF made in the browser from the very document that was signed is filed
// in storage, attached to a confirmation email, and recorded on the person's
// profile so it sits alongside everything else we hold on them.
import { createClient } from "npm:@supabase/supabase-js@2";
import { kitEmailFromMarkdown } from "../_shared/kit-email.ts";
import { emailTags } from "../_shared/email-tags.ts";
import { SITE_URL } from "../_shared/site-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ error: "Email service not configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const contractId = String(body.contract_id ?? "");
    const kind = body.kind === "issue" ? "issue" : "signed";
    const token = typeof body.token === "string" ? body.token : null;
    const pdfBase64 = typeof body.pdf_base64 === "string" ? body.pdf_base64 : null;
    if (!contractId) return json({ error: "Missing contract" }, 400);

    const db = admin();

    // Either an administrator, or the holder of the contract's own signing link.
    let authorised = false;
    let actorName: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const scoped = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData } = await scoped.auth.getUser();
      if (userData?.user) {
        const { data: role } = await db
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (role) {
          authorised = true;
          actorName = userData.user.email ?? null;
        }
      }
    }

    const { data: contract } = await db.from("mu_contracts").select("*").eq("id", contractId).maybeSingle();
    if (!contract) return json({ error: "Contract not found" }, 404);
    if (!authorised && token && contract.sign_token && token === contract.sign_token) authorised = true;
    if (!authorised) return json({ error: "Not permitted" }, 403);

    const { data: person } = await db
      .from("mu_people")
      .select("id, full_name, email, work_email")
      .eq("id", contract.person_id)
      .maybeSingle();

    const fields = (contract.issued_fields ?? contract.fields ?? {}) as Record<string, string>;
    const recipient = fields.employee_email || person?.work_email || person?.email;
    if (!recipient) return json({ error: "No email address on file for this person" }, 400);

    // A pack is a file per document. Older callers still send a single PDF, so
    // that shape is folded into the same list.
    type Doc = { filename: string; label: string; code?: string; doc_type?: string; pdf_base64: string };
    const incoming: Doc[] = Array.isArray(body.documents)
      ? (body.documents as Doc[]).filter(
          (d) => d && typeof d.pdf_base64 === "string" && typeof d.filename === "string",
        )
      : [];
    if (!incoming.length && pdfBase64) {
      incoming.push({
        filename: "medic-connect-contract.pdf",
        label: `Signed contract, ${fields.job_title || contract.job_title || "employment"}`,
        code: "letter",
        pdf_base64: pdfBase64,
      });
    }

    const filed: { label: string; path: string; url: string | null; base64: string; filename: string }[] = [];
    let pdfPath: string | null = contract.pdf_path ?? null;
    let signedUrl: string | null = null;

    for (const doc of incoming) {
      const safeName = doc.filename.replace(/[^a-zA-Z0-9._-]/g, "-");
      const bytes = Uint8Array.from(atob(doc.pdf_base64), (c) => c.charCodeAt(0));
      const path = `contracts/${contract.id}/${safeName}`;
      const { error: upErr } = await db.storage
        .from("applications")
        .upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;

      const { data: existing } = await db
        .from("mu_documents")
        .select("id")
        .eq("person_id", contract.person_id)
        .eq("url", path)
        .maybeSingle();
      if (existing) {
        await db.from("mu_documents").update({ label: doc.label }).eq("id", existing.id);
      } else {
        await db.from("mu_documents").insert({
          person_id: contract.person_id,
          source_table: "contracts",
          label: doc.label,
          url: path,
          doc_type: doc.doc_type || "Contract",
          uploaded_by_name: "Contract system",
        });
      }

      const { data: link } = await db.storage.from("applications").createSignedUrl(path, 60 * 60 * 24 * 14);
      filed.push({ label: doc.label, path, url: link?.signedUrl ?? null, base64: doc.pdf_base64, filename: safeName });
      if (doc.code === "letter" || !pdfPath) pdfPath = path;
    }

    if (filed.length) {
      await db.from("mu_contracts").update({ pdf_path: pdfPath }).eq("id", contract.id);
      await db.rpc("mu_contract_log", {
        _contract_id: contract.id,
        _event_type: "filed",
        _detail: `${filed.length} signed ${filed.length === 1 ? "document" : "documents"} filed on the profile`,
        _payload: { paths: filed.map((f) => f.path) },
        _actor_name: actorName,
        _ip: null,
        _user_agent: null,
        _actor_role: "system",
      });
      signedUrl = filed[0].url;
    } else if (pdfPath) {
      const { data: link } = await db.storage.from("applications").createSignedUrl(pdfPath, 60 * 60 * 24 * 14);
      signedUrl = link?.signedUrl ?? null;
    }


    const first = (fields.employee_name || person?.full_name || "there").split(" ")[0];
    // The email leads into the person's own account, never straight to a document.
    const origin = Deno.env.get("PUBLIC_SITE_URL") || SITE_URL;
    const signLink = `${origin}/portal/offers/contract/${contract.id}`;

    const subject =
      kind === "issue"
        ? `Your offer of employment, ${fields.job_title || contract.job_title || "Medic Connect"}`
        : "Your countersigned contract with Medic Connect";

    let packAttachments: { filename: string; content: string }[] = [];



    const html =
      kind === "issue"
        ? kitEmailFromMarkdown({
            eyebrow: "Employment",
            title: "Your offer of employment",
            standfirst: `${fields.job_title || contract.job_title || "Medic Connect"} — ready to read and sign.`,
            preheader: subject,
            markdown: `Dear ${first},

Your offer of employment is ready. Sign in to your account to read it in full, open each document that comes with it, and sign at the bottom.

## Before you sign

- Check that your name, job title, start date and pay are right
- Tick each document you are asked to acknowledge, then sign once
- The contract stays open until you sign it, nothing is agreed before then
- If anything looks wrong, reply to this email rather than signing

[[cta:Open your contract|${signLink}]]`,
            footnote: "Medic Connect Limited, 145 Igbosere Road, Lagos Island, Nigeria.",
          })
        : (() => {
            // Attach as many of the documents as the mail provider will carry,
            // and link the rest from the person's own account.
            const BUDGET = 18 * 1024 * 1024; // base64 characters, well inside Resend's limit
            const attachments: { filename: string; content: string }[] = [];
            let used = 0;
            const linkedOnly: typeof filed = [];
            for (const f of filed) {
              if (used + f.base64.length <= BUDGET) {
                attachments.push({ filename: f.filename, content: f.base64 });
                used += f.base64.length;
              } else {
                linkedOnly.push(f);
              }
            }
            packAttachments = attachments;

            const list = filed
              .map((f) => `- ${f.label}${linkedOnly.includes(f) ? (f.url ? ` — [download](${f.url})` : "") : ""}`)
              .join("\n");

            return kitEmailFromMarkdown({
              eyebrow: "Employment",
              title: "Your countersigned contract",
              standfirst: "Signed by you, countersigned by us, one file per document.",
              preheader: subject,
              markdown: `Dear ${first},

Thank you for signing. We have approved and countersigned your contract. Each document comes as its own PDF, signed and dated, attached to this email and filed in your account under Documents.

## What is attached

${list || "- Your signed contract"}
${linkedOnly.length ? `\nThe documents marked with a link were too large to attach, so download them from the links above or find them in your account.\n` : ""}
[[cta:Open your account|${origin}/portal/documents]]

Welcome aboard.`,
              footnote: "Medic Connect Limited, 145 Igbosere Road, Lagos Island, Nigeria.",
            });
          })();

    const payload: Record<string, unknown> = {
      from: "Medic Connect <hello@medicconnect.co>",
      to: [recipient],
      subject,
      html,
    };
    if (kind === "signed" && packAttachments.length) {
      payload.attachments = packAttachments;
    }


    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, tags: emailTags(kind === "issue" ? "contract-issued" : "contract-signed", contract.person_id) }),
    });
    const out = await res.json();
    if (!res.ok) {
      console.error("resend", out);
      return json({ error: out?.message ?? "Email failed" }, 502);
    }

    await db.rpc("mu_contract_log", {
      _contract_id: contract.id,
      _event_type: "emailed",
      _detail: kind === "issue" ? `Signing link sent to ${recipient}` : `Signed copy sent to ${recipient}`,
      _payload: { to: recipient },
      _actor_name: actorName,
      _ip: null,
      _user_agent: null,
      _actor_role: authorised && actorName ? "admin" : "system",
    });

    return json({ ok: true, pdf_path: pdfPath, url: signedUrl });
  } catch (err) {
    console.error("send-contract-email", err);
    return json({ error: (err as Error).message }, 500);
  }
});
