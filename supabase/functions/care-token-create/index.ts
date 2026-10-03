// Creates a pre-assessment link for one client contact.
//
// The link reads MC-2609-0142-K7M4: the client reference, then a short secret.
// The reference on its own opens nothing, because the whole segment is what is
// hashed. The plain segment is returned once and never stored.
//
// A link is either the full pre-assessment or a top-up: the short set of
// questions a service added after the family already answered. A top-up starts
// from the answers we hold, so nobody is asked who is who a second time.
import { createClient } from "npm:@supabase/supabase-js@2";
import { hashToken, newSecret, SERVICE_KEY_BY_SECTION } from "../_shared/care-form.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const FILLER_TYPES = ["client", "parent", "family_member", "referring_clinician"];
const UUID = /^[0-9a-f-]{36}$/i;

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
    const clientId = typeof body?.client_id === "string" ? body.client_id : "";
    const contactId = typeof body?.contact_id === "string" ? body.contact_id : null;
    let fillerType = typeof body?.filler_type === "string" ? body.filler_type : "";
    let toContactId = contactId;
    const scope = body?.scope === "top_up" ? "top_up" : "full";
    const recipientId = typeof body?.request_recipient_id === "string" ? body.request_recipient_id : "";
    const intentionIds: string[] = Array.isArray(body?.intention_ids)
      ? body.intention_ids.filter((v: unknown): v is string => typeof v === "string" && UUID.test(v))
      : [];
    if (!UUID.test(clientId)) return json({ error: "A client is required" }, 400);
    if (contactId && !UUID.test(contactId)) return json({ error: "That contact is not valid" }, 400);

    // A top-up goes to whoever answered the pre-assessment, unless a member of
    // staff names someone else.
    if (scope === "top_up" && (!toContactId || !FILLER_TYPES.includes(fillerType))) {
      const { data: previous } = await db
        .from("care_access_tokens")
        .select("contact_id, filler_type")
        .eq("client_id", clientId)
        .eq("purpose", "pre_assessment")
        .eq("scope", "full")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      toContactId = toContactId ?? previous?.contact_id ?? null;
      if (!FILLER_TYPES.includes(fillerType)) fillerType = previous?.filler_type ?? "";
    }
    if (!FILLER_TYPES.includes(fillerType)) return json({ error: "Choose who is filling this in" }, 400);

    const { data: client } = await db
      .from("clients").select("id, enquiry_number, full_name").eq("id", clientId).maybeSingle();
    if (!client) return json({ error: "Client not found" }, 404);
    if (!client.enquiry_number) return json({ error: "That client has no reference yet" }, 409);

    let requestId: string | null = null;
    let coversServices: string[] | null = null;
    let coversRecipientKey: string | null = null;
    let recipientRow: { id: string; request_id: string; client_id: string; intake_recipient_key: string | null } | null = null;
    let boundDocumentId: string | null = null;

    if (scope === "full") {
      const { data: recipient } = await db
        .from("care_request_recipients")
        .select("id, request_id, client_id, intake_recipient_key")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recipient) {
        recipientRow = recipient;
        requestId = recipient.request_id;
        coversRecipientKey = recipient.intake_recipient_key;
      }
    }

    if (scope === "top_up") {
      if (!UUID.test(recipientId)) return json({ error: "A care recipient is required" }, 400);
      if (intentionIds.length === 0) return json({ error: "Choose which service to ask about" }, 400);

      const { data: recipient } = await db
        .from("care_request_recipients")
        .select("id, request_id, client_id, intake_recipient_key")
        .eq("id", recipientId)
        .maybeSingle();
      if (!recipient || recipient.client_id !== clientId) {
        return json({ error: "That care recipient is not on this request" }, 400);
      }
      recipientRow = recipient;
      requestId = recipient.request_id;

      const { data: intentions } = await db
        .from("care_service_intentions")
        .select("id, request_id, services(questionnaire_section)")
        .in("id", intentionIds);
      const valid = (intentions ?? []).filter((i) => i.request_id === requestId);
      if (valid.length !== intentionIds.length) {
        return json({ error: "Those services are not on this request" }, 400);
      }
      const keys = new Set<string>();
      for (const i of valid) {
        const section = (i.services as { questionnaire_section: string | null } | null)?.questionnaire_section;
        const key = section ? SERVICE_KEY_BY_SECTION[section] : null;
        if (key) keys.add(key);
      }
      if (keys.size === 0) return json({ error: "Those services have no questions of their own" }, 409);
      coversServices = [...keys];

      // The top-up carries the answers already given, so the family only sees
      // the new questions.
      const { data: sent } = await db
        .from("care_documents")
        .select("id, responses, form_definition_id")
        .eq("client_id", clientId)
        .eq("kind", "pre_assessment")
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sent) return json({ error: "That person has not sent a pre-assessment yet" }, 409);

      const responses = (sent.responses ?? {}) as Record<string, unknown>;
      coversRecipientKey = recipient.intake_recipient_key;
      if (!coversRecipientKey) {
        return json({ error: "This care recipient is not linked to the pre-assessment intake" }, 409);
      }
      const intakeRecipients = (responses.care_intake as { recipients?: Array<{ id?: string }> } | null)?.recipients ?? [];
      if (!intakeRecipients.some((item) => item.id === coversRecipientKey)) {
        return json({ error: "This care recipient is not present in the submitted pre-assessment" }, 409);
      }

      const { data: draft, error: draftError } = await db.from("care_documents").insert({
          client_id: clientId,
          kind: "pre_assessment",
          form_definition_id: sent.form_definition_id,
          status: "draft",
          // Keep the submitted answers as context. The top-up itinerary only
          // exposes the sections introduced by the newly recorded service.
          responses,
          built_from_id: sent.id,
        }).select("id").single();
      if (draftError) throw draftError;
      boundDocumentId = draft.id;
    }

    const plain = `${client.enquiry_number}-${newSecret()}`;
    const token_hash = await hashToken(plain);
    const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: token, error } = await db
      .from("care_access_tokens")
      .insert({
        client_id: clientId,
        contact_id: toContactId,
        token_hash,
        filler_type: fillerType,
        purpose: "pre_assessment",
        expires_at: expires,
        scope,
        request_id: requestId,
        request_recipient_id: recipientRow?.id ?? null,
        document_id: boundDocumentId,
        covers_services: coversServices,
        covers_recipient_key: coversRecipientKey,
      })
      .select("id, expires_at")
      .single();
    if (error) throw error;

    if (scope === "top_up" && recipientRow) {
      const { error: coverageError } = await db
        .from("care_pre_assessment_coverage")
        .upsert(
          intentionIds.map((intentionId) => ({
            request_id: recipientRow.request_id,
            request_recipient_id: recipientRow.id,
            intention_id: intentionId,
            token_id: token.id,
            status: "sent",
          })),
          { onConflict: "request_recipient_id,intention_id" },
        );
      if (coverageError) throw coverageError;
    }

    await db.from("care_access_log").insert({
      token_id: token.id, client_id: clientId, action: "token_created",
    });

    // The plain token leaves here once and is never written to a log.
    return json({ ok: true, token_id: token.id, token: plain, expires_at: token.expires_at, scope });
  } catch (e) {
    console.error("care-token-create failed", e instanceof Error ? e.message : e);
    return json({ error: "Could not create the link" }, 500);
  }
});
