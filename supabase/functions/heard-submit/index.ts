// The only write path into the Heard consumer tables.
//
// The browser never inserts into a heard_ table. This function validates the
// payload and calls a security-definer database function, so identifiers,
// timestamps, status, moderation and audit fields stay server-derived.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const ALLOWED_ORIGINS = new Set<string>([
  "https://medicconnect.co",
  "https://www.medicconnect.co",
  "https://heard.medicconnect.co",
  "https://medicconnect.lovable.app",
]);
const LOVABLE_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.lovable\.app$/;
const DEFAULT_ORIGIN = "https://medicconnect.lovable.app";

const isAllowedOrigin = (origin: string) =>
  ALLOWED_ORIGINS.has(origin) || LOVABLE_PREVIEW_RE.test(origin);

const getCorsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && isAllowedOrigin(origin) ? origin : DEFAULT_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CONTENT = 20000;
const MAX_SHORT = 200;

type Kind =
  | "message"
  | "story"
  | "letter"
  | "letter_subscribe"
  | "volunteer_interest"
  | "phone_waitlist";

const KINDS: Kind[] = [
  "message",
  "story",
  "letter",
  "letter_subscribe",
  "volunteer_interest",
  "phone_waitlist",
];

// Kinds that carry written content rather than list details.
const CONTENT_KINDS = new Set<Kind>(["message", "story", "letter"]);

interface Payload {
  kind: Kind;
  content?: string;
  subject?: string;
  heading?: string;
  signItAs?: string;
  email?: string;
  consentVersion?: string;
  firstName?: string;
  lastName?: string;
  state?: string;
  role?: string;
  motivation?: string;
  timeCommitment?: string;
  source?: string;
}


const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  if (req.method === "OPTIONS") {
    if (origin && !isAllowedOrigin(origin)) return new Response(null, { status: 403 });
    return new Response(null, { headers: corsHeaders });
  }
  if (origin && !isAllowedOrigin(origin)) return json({ error: "Forbidden" }, 403);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const payload = (await req.json()) as Payload;
    const kind = payload?.kind;
    const content = clean(payload.content, MAX_CONTENT);
    const email = clean(payload.email, 255).toLowerCase();
    const subject = clean(payload.subject, MAX_SHORT);
    const heading = clean(payload.heading, MAX_SHORT);
    const signItAs = clean(payload.signItAs, MAX_SHORT);
    const consentVersion = clean(payload.consentVersion, 20) || "v1";
    const firstName = clean(payload.firstName, 100);
    const lastName = clean(payload.lastName, 100);
    const state = clean(payload.state, 80);
    const role = clean(payload.role, 60);
    const motivation = clean(payload.motivation, 1000);
    const timeCommitment = clean(payload.timeCommitment, 40);
    const source = clean(payload.source, 80);

    if (!kind || !KINDS.includes(kind)) {
      return json({ error: "Unknown submission type" }, 400);
    }
    if (email && !emailRe.test(email)) {
      return json({ error: "Please check the email address" }, 400);
    }
    if (CONTENT_KINDS.has(kind) && content.length < 2) {
      return json({ error: "Please write something first" }, 400);
    }
    if (
      (kind === "letter_subscribe" || kind === "phone_waitlist" || kind === "volunteer_interest") &&
      !email
    ) {
      return json({ error: "An email address is required" }, 400);
    }
    if (kind === "volunteer_interest" && (!firstName || !lastName || !state || !role)) {
      return json({ error: "Please complete the required details" }, 400);
    }


    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    let result;
    if (kind === "message") {
      result = await admin.rpc("heard_submit_message", {
        _content: content,
        _subject: subject || null,
        _email: email || null,
      });
    } else if (kind === "story") {
      result = await admin.rpc("heard_submit_story", {
        _content: content,
        _subject: subject || null,
        _sign_it_as: signItAs || null,
        _email: email || null,
      });
    } else if (kind === "letter") {
      result = await admin.rpc("heard_submit_letter", {
        _content: content,
        _heading: heading || null,
        _sign_it_as: signItAs || null,
        _email: email || null,
        _consent_version: consentVersion,
      });
    } else if (kind === "volunteer_interest") {
      result = await admin.rpc("heard_submit_volunteer", {
        _first_name: firstName,
        _last_name: lastName,
        _email: email,
        _state: state,
        _role_interest: role,
        _motivation: motivation || null,
        _time_commitment: timeCommitment || null,
      });
    } else if (kind === "phone_waitlist") {
      result = await admin.rpc("heard_join_waitlist", {
        _email: email,
        _source: source || "heard_landing",
        _purpose: "phone_line",
      });
    } else {
      result = await admin.rpc("heard_subscribe_letters", {
        _email: email,
        _consent_version: consentVersion,
      });
    }


    if (result.error) {
      console.error("heard-submit rpc failed:", result.error.message);
      return json({ error: "Could not save that. Please try again." }, 400);
    }

    // Never return the stored record, only that it was received.
    return json({ ok: true });
  } catch (err) {
    console.error("heard-submit error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
