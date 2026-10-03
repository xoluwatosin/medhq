// Takes a file sent from a family's questionnaire link into private Care
// storage.
//
// There is no account here: the questionnaire link itself is the authority,
// and it is checked the same way the save call checks it. The file is written
// under the client the link belongs to, so nothing can be aimed elsewhere,
// and the questionnaire only ever holds the file's name and its path.
import { createClient } from "npm:@supabase/supabase-js@2";
import { hashToken, LINK_SEGMENT } from "../_shared/care-form.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BUCKET = "care-uploads";
const MAX_BYTES = 15 * 1024 * 1024;

/** What a family can send from a phone: a document, or a photograph of one. */
const ALLOWED: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
};

const safeName = (name: string) =>
  name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "document";

/** What the file actually is, read from its first bytes rather than its name. */
const sniff = (bytes: Uint8Array): string | null => {
  const at = (i: number) => bytes[i];
  if (at(0) === 0x25 && at(1) === 0x50 && at(2) === 0x44 && at(3) === 0x46) return "application/pdf";
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return "image/png";
  const brand = new TextDecoder().decode(bytes.slice(4, 12));
  if (brand.startsWith("ftyp") && /heic|heix|hevc|mif1|msf1/i.test(brand)) return "image/heic";
  return null;
};


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const form = await req.formData().catch(() => null);
    if (!form) return json({ error: "Nothing to send" }, 400);

    const plain = String(form.get("token") ?? "").trim().toUpperCase();
    const fieldId = String(form.get("field") ?? "").trim();
    const recipientReference = String(form.get("recipient_id") ?? "").trim();
    const file = form.get("file");

    if (!LINK_SEGMENT.test(plain)) return json({ error: "This link is not valid" }, 404);
    if (!/^[a-z0-9_]{1,80}$/.test(fieldId)) return json({ error: "That question is not one we hold" }, 400);
    if (!(file instanceof File)) return json({ error: "Nothing to send" }, 400);
    if (file.size === 0) return json({ error: "That file is empty" }, 400);
    if (file.size > MAX_BYTES) return json({ error: "That file is larger than 15MB" }, 413);

    const extension = (file.name.split(".").pop() ?? "").toLowerCase();
    const contentType = ALLOWED[extension];
    if (!contentType) return json({ error: "Send a PDF or a photo (JPG, PNG or HEIC)" }, 415);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token_hash = await hashToken(plain);

    const { data: token } = await db
      .from("care_access_tokens")
      .select("id, client_id, request_id, session_id, expires_at, revoked_at, frozen_at")
      .eq("token_hash", token_hash)
      .maybeSingle();
    if (!token) return json({ error: "This link is not valid" }, 404);
    if (token.revoked_at) return json({ error: "This link has been withdrawn" }, 410);
    if (token.frozen_at) return json({ error: "This form has already been sent back to us" }, 409);
    if (token.expires_at && new Date(token.expires_at) < new Date()) {
      return json({ error: "This link has expired" }, 410);
    }

    // Resolve the browser's request-local key through the authoritative request
    // recipient row. Never infer identity from list position.
    let recipientId: string | null = null;
    let requestId: string | null = null;
    if (recipientReference) {
      if (!/^r[1-9]\d*$/.test(recipientReference)) {
        return json({ error: "That person is not on this form" }, 403);
      }

      requestId = token.request_id ?? null;

      if (!requestId && token.session_id) {
        const { data: session } = await db
          .from("care_questionnaire_sessions")
          .select("request_id")
          .eq("id", token.session_id)
          .maybeSingle();
        requestId = session?.request_id ?? null;
      }

      if (!requestId) {
        const { data: recipient } = await db
          .from("care_request_recipients")
          .select("id, request_id")
          .eq("client_id", token.client_id)
          .eq("intake_recipient_key", recipientReference)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        recipientId = recipient?.id ?? null;
        requestId = recipient?.request_id ?? null;
      } else {
        const { data: recipient } = await db
          .from("care_request_recipients")
          .select("id")
          .eq("request_id", requestId)
          .eq("intake_recipient_key", recipientReference)
          .maybeSingle();
        recipientId = recipient?.id ?? null;
      }

      if (!recipientId) return json({ error: "That person is not on this form" }, 403);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = sniff(bytes);
    if (!detected || detected !== contentType) {
      return json({ error: "That file is not a PDF or a photo (JPG, PNG or HEIC)" }, 415);
    }

    const path = [
      token.client_id,
      recipientId ?? "shared",
      fieldId,
      `${crypto.randomUUID()}-${safeName(file.name)}`,
    ].join("/");

    const { error } = await db.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: detected, upsert: false });
    if (error) throw error;

    // The record of the file is what the answer refers to: a storage path sent
    // by a browser proves nothing on its own.
    const { data: record, error: recordError } = await db
      .from("care_upload_files")
      .insert({
        token_id: token.id,
        session_id: token.session_id ?? null,
        request_id: requestId,
        client_id: token.client_id,
        request_recipient_id: recipientId,
        field_id: fieldId,
        original_name: file.name.slice(-200),
        detected_mime: detected,
        byte_size: bytes.byteLength,
        storage_bucket: BUCKET,
        storage_path: path,
      })
      .select("id")
      .single();
    if (recordError) throw recordError;

    return json({ ok: true, id: record.id, name: file.name });

  } catch (error) {
    console.error("care-file-upload failed", error);
    return json({ error: "That did not reach us" }, 500);
  }
});
