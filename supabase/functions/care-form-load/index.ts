// Opens a pre-assessment form from a link. No account, no login.
//
// The link segment is hashed before it is looked up, and nothing about the
// client is returned beyond what the form has to show back to the person
// answering it.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  hashToken, LINK_SEGMENT, SERVICE_KEY_BY_SECTION,
  type FormDefinition,
} from "../_shared/care-form.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const splitName = (fullName: string | null | undefined) => {
  const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : "",
  };
};

const serviceValue = (service: { slug?: string | null; questionnaire_section?: string | null; name?: string | null }) => {
  const slug = String(service.slug ?? "").toLowerCase();
  const name = String(service.name ?? "").toLowerCase();
  if (slug.includes("antenatal")) return "antenatal";
  if (slug.includes("newborn")) return "newborn";
  if (slug.includes("paediatric") || slug.includes("pediatric")) return "paediatric";
  if (slug.includes("postnatal")) return "postnatal_mother";
  if (slug.includes("surgical")) return "post_surgical";
  if (slug.includes("elder") || name.includes("elder")) return "eldercare";
  if (slug.includes("nanny") || name.includes("nanny")) return "nanny";
  if (slug.includes("additional-needs") || name.includes("additional needs")) return "additional_needs";
  if (slug.includes("clinical") || service.questionnaire_section === "s5") return "clinical_home_care";
  return service.questionnaire_section ? SERVICE_KEY_BY_SECTION[service.questionnaire_section] ?? "other" : "other";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const plain = typeof body?.token === "string" ? body.token.trim().toUpperCase() : "";
    if (!LINK_SEGMENT.test(plain)) return json({ error: "This link is not valid" }, 404);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token_hash = await hashToken(plain);

    const { data: token } = await db
      .from("care_access_tokens")
      .select("id, client_id, contact_id, request_id, filler_type, expires_at, revoked_at, frozen_at, submitted_at, first_opened_at, position, scope, covers_services, covers_recipient_key, request_recipient_id, document_id")
      .eq("token_hash", token_hash)
      .maybeSingle();
    if (!token) return json({ error: "This link is not valid" }, 404);
    if (token.revoked_at) return json({ error: "This link has been withdrawn" }, 410);
    if (token.expires_at && new Date(token.expires_at) < new Date()) {
      return json({ error: "This link has expired" }, 410);
    }

    let effectiveCoversServices = token.covers_services as string[] | null;
    let effectiveRecipientKey = token.covers_recipient_key as string | null;
    if (token.scope === "top_up") {
      if (!token.request_recipient_id) return json({ error: "This link is no longer current" }, 410);
      const [{ data: recipient }, { data: coverage }] = await Promise.all([
        db.from("care_request_recipients")
          .select("request_id, intake_recipient_key")
          .eq("id", token.request_recipient_id)
          .maybeSingle(),
        db.from("care_pre_assessment_coverage")
          .select("intention_id")
          .eq("token_id", token.id)
          .eq("request_recipient_id", token.request_recipient_id)
          .eq("status", "sent"),
      ]);
      const intentionIds = (coverage ?? []).map((row) => row.intention_id);
      const { data: currentIntentions } = intentionIds.length
        ? await db.from("care_service_intentions")
            .select("id, service_id, state, services(slug, name, questionnaire_section)")
            .in("id", intentionIds)
            .neq("state", "removed")
        : { data: [] };
      effectiveCoversServices = [...new Set((currentIntentions ?? []).map((row) =>
        row.services ? serviceValue(row.services as { slug?: string | null; questionnaire_section?: string | null; name?: string | null }) : null,
      ).filter((value): value is string => !!value))];
      effectiveRecipientKey = recipient?.intake_recipient_key ?? null;
      if (!recipient || effectiveCoversServices.length === 0 || !effectiveRecipientKey) {
        return json({ error: "This link is no longer current. Ask us for a new one." }, 410);
      }
    }

    const { data: client } = await db
      .from("clients")
      .select("id, preferred_name, full_name, first_name, last_name, date_of_birth, age_years, date_of_birth_is_estimated, client_group, service_id")
      .eq("id", token.client_id)
      .maybeSingle();
    if (!client) return json({ error: "This link is not valid" }, 404);

    const { data: service } = client.service_id
      ? await db
          .from("services")
          .select("slug, name, questionnaire_section, client_group")
          .eq("id", client.service_id)
          .maybeSingle()
      : { data: null };

    const documentQuery = db
      .from("care_documents")
      .select("id, status, responses, outstanding_required, submitted_at, form_definition_id")
      .eq("client_id", client.id)
      .eq("kind", "pre_assessment");
    const { data: doc } = token.document_id
      ? await documentQuery.eq("id", token.document_id).maybeSingle()
      : await documentQuery.in("status", ["draft", "submitted"]).order("created_at", { ascending: false }).limit(1).maybeSingle();

    // A form that has been started, or sent back to us, keeps the questions it
    // was answered on. Only a form that has not been started yet picks up the
    // current published version.
    const { data: definitionRow } = doc?.form_definition_id
      ? await db
          .from("form_definitions")
          .select("id, version, definition")
          .eq("id", doc.form_definition_id)
          .maybeSingle()
      : await db
          .from("form_definitions")
          .select("id, version, definition")
          .eq("kind", "pre_assessment")
          .eq("status", "published")
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
    if (!definitionRow) return json({ error: "The questions are not ready yet" }, 503);

    const { data: bands } = await db
      .from("budget_bands")
      .select("id, label, is_discuss, sort_order")
      .eq("is_active", true)
      .order("sort_order");

    const { data: contact } = token.contact_id
      ? await db
          .from("client_contacts")
          .select("id, person_id, full_name, first_name, last_name, relationship, relationship_code, relationship_other, phone, email")
          .eq("id", token.contact_id)
          .maybeSingle()
      : { data: null };

    if (!token.first_opened_at) {
      await db.from("care_access_tokens").update({ first_opened_at: new Date().toISOString() }).eq("id", token.id);
    }
    await db.from("care_access_log").insert({
      token_id: token.id,
      client_id: client.id,
      document_id: doc?.id ?? null,
      action: "form_opened",
      ip: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
    });

    // What we already hold. The form shows these back to be confirmed rather
    // than asking for them a second time.
    const prefill: Record<string, string> = {};
    if (client.full_name) prefill["client.full_name"] = client.full_name;
    if (contact?.full_name) prefill["contact.full_name"] = contact.full_name;
    if (contact?.phone) prefill["contact.phone"] = contact.phone;
    if (contact?.email) prefill["contact.email"] = contact.email;

    // Seed the opening intake from the existing request graph. This is a
    // starting point only: the browser merges it under any answers the family
    // has already saved and never replaces those answers.
    let requestId = token.request_id as string | null;
    if (!requestId) {
      const { data: ownRecipient } = await db
        .from("care_request_recipients")
        .select("request_id")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      requestId = ownRecipient?.request_id ?? null;
    }

    const recipientSeeds: Array<Record<string, unknown>> = [];
    let enquirerPerson: Record<string, unknown> | null = null;
    if (requestId) {
      const { data: request } = await db
        .from("care_requests")
        .select("enquirer_person_id")
        .eq("id", requestId)
        .maybeSingle();
      if (request?.enquirer_person_id) {
        const { data: person } = await db
          .from("care_people")
          .select("id, first_name, last_name, full_name, phone, email")
          .eq("id", request.enquirer_person_id)
          .maybeSingle();
        enquirerPerson = person as Record<string, unknown> | null;
      }

      const { data: requestRecipients } = await db
        .from("care_request_recipients")
        .select("id, person_id, client_id, role, display_order, intake_recipient_key")
        .eq("request_id", requestId)
        .order("display_order");
      const rows = requestRecipients ?? [];
      const personIds = rows.map((row) => row.person_id).filter(Boolean);
      const clientIds = rows.map((row) => row.client_id).filter(Boolean);
      const recipientIds = rows.map((row) => row.id);
      const [{ data: people }, { data: recipientClients }, { data: allocations }] = await Promise.all([
        personIds.length
          ? db.from("care_people").select("id, first_name, last_name, full_name, phone, email").in("id", personIds)
          : Promise.resolve({ data: [] }),
        clientIds.length
          ? db.from("clients").select("id, first_name, last_name, full_name, date_of_birth, age_years, date_of_birth_is_estimated, service_id").in("id", clientIds)
          : Promise.resolve({ data: [] }),
        recipientIds.length
          ? db.from("care_service_intention_recipients").select("request_recipient_id, intention_id").in("request_recipient_id", recipientIds)
          : Promise.resolve({ data: [] }),
      ]);
      const intentionIds = (allocations ?? []).map((row) => row.intention_id);
      const { data: intentions } = intentionIds.length
        ? await db.from("care_service_intentions").select("id, service_id, state").in("id", intentionIds).neq("state", "removed")
        : { data: [] };
       const serviceIds = [...new Set([
         ...(intentions ?? []).map((row) => row.service_id).filter(Boolean),
         ...(recipientClients ?? []).map((row) => row.service_id).filter(Boolean),
       ])];
      const { data: intentionServices } = serviceIds.length
        ? await db.from("services").select("id, slug, name, questionnaire_section").in("id", serviceIds)
        : { data: [] };
      const peopleById = new Map((people ?? []).map((row) => [row.id, row]));
      const clientsById = new Map((recipientClients ?? []).map((row) => [row.id, row]));
      const intentionsById = new Map((intentions ?? []).map((row) => [row.id, row]));
      const servicesById = new Map((intentionServices ?? []).map((row) => [row.id, row]));

      const usedKeys = new Set(
        rows.map((row) => row.intake_recipient_key).filter((key): key is string => typeof key === "string" && /^r\d+$/.test(key)),
      );
      let nextKey = 1;
      const fallbackKey = () => {
        while (usedKeys.has(`r${nextKey}`)) nextKey += 1;
        const key = `r${nextKey}`;
        usedKeys.add(key);
        nextKey += 1;
        return key;
      };
      rows.forEach((row) => {
        const person = row.person_id ? peopleById.get(row.person_id) : null;
        const recipientClient = row.client_id ? clientsById.get(row.client_id) : null;
        const fallback = splitName(person?.full_name ?? recipientClient?.full_name);
        const allocatedServices = (allocations ?? [])
          .filter((allocation) => allocation.request_recipient_id === row.id)
          .map((allocation) => intentionsById.get(allocation.intention_id))
          .map((intention) => intention?.service_id ? servicesById.get(intention.service_id) : null)
          .filter(Boolean)
          .map((allocated) => serviceValue(allocated));
        const recipientService = recipientClient?.service_id ? servicesById.get(recipientClient.service_id) : null;
        const fallbackService = recipientService
          ? [serviceValue(recipientService)]
          : [];
        const isEnquirer = (!!enquirerPerson?.id && enquirerPerson.id === row.person_id) ||
          (!!contact?.person_id && contact.person_id === row.person_id);
        recipientSeeds.push({
          id: row.intake_recipient_key ?? fallbackKey(),
          firstName: person?.first_name ?? recipientClient?.first_name ?? fallback.firstName,
          lastName: person?.last_name ?? recipientClient?.last_name ?? fallback.lastName,
          phone: person?.phone ?? "",
          email: person?.email ?? "",
          relationship: isEnquirer ? undefined : row.role === "care_recipient" ? undefined : row.role,
          isEnquirer,
          dobKnown: recipientClient?.date_of_birth ? "yes" : recipientClient?.age_years !== null && recipientClient?.age_years !== undefined ? "no" : undefined,
          dateOfBirth: recipientClient?.date_of_birth ?? undefined,
          approxAge: recipientClient?.date_of_birth ? null : recipientClient?.age_years ?? null,
          services: [...new Set(allocatedServices.length ? allocatedServices : fallbackService)],
        });
      });
    }

    if (recipientSeeds.length === 0) {
      const fallback = splitName(client.full_name);
      recipientSeeds.push({
        id: "r1",
        firstName: client.first_name ?? fallback.firstName,
        lastName: client.last_name ?? fallback.lastName,
        relationship: contact?.relationship_code === "self" ? undefined : contact?.relationship ?? undefined,
        isEnquirer: contact?.relationship_code === "self",
        dobKnown: client.date_of_birth ? "yes" : client.age_years !== null && client.age_years !== undefined ? "no" : undefined,
        dateOfBirth: client.date_of_birth ?? undefined,
        approxAge: client.date_of_birth ? null : client.age_years ?? null,
        services: service ? [serviceValue(service)] : [],
      });
    }

    const contactName = splitName(contact?.full_name);
    const enquirerName = splitName(String(enquirerPerson?.full_name ?? ""));
    const enquirer = {
      firstName: String(enquirerPerson?.first_name ?? contact?.first_name ?? enquirerName.firstName ?? contactName.firstName ?? ""),
      lastName: String(enquirerPerson?.last_name ?? contact?.last_name ?? enquirerName.lastName ?? contactName.lastName ?? ""),
      phone: String(enquirerPerson?.phone ?? contact?.phone ?? ""),
      email: String(enquirerPerson?.email ?? contact?.email ?? ""),
    };
    const selfRecipients = recipientSeeds.filter((recipient) => recipient.isEnquirer === true);
    const intakeSeed = {
      enquirer,
      forWhom: recipientSeeds.length > 1 ? "several" : selfRecipients.length === 1 ? "myself" : "other",
      enquirerReceivesCare: recipientSeeds.length > 1 ? (selfRecipients.length ? "yes" : "no") : undefined,
      recipients: recipientSeeds,
    };

    const definition = definitionRow.definition as FormDefinition;

    // Answers may still be corrected until the assessment visit opens. After
    // that the record stands and changes are made with the nurse on the day.
    const { data: visit } = await db
      .from("care_assessment_work")
      .select("id, started_at, status")
      .eq("client_id", client.id)
      .in("status", ["in_progress", "submitted"])
      .limit(1)
      .maybeSingle();
    const visitStarted = !!visit?.started_at;

    return json({
      ok: true,
      frozen: !!token.frozen_at,
      submitted_at: doc?.submitted_at ?? token.submitted_at ?? null,
      document_id: doc?.id ?? null,
      scope: token.scope ?? "full",
      covers_services: effectiveCoversServices,
      covers_recipient_key: effectiveRecipientKey,
      request_recipient_id: token.request_recipient_id ?? null,
      visit_started: visitStarted,
      amendable: !!token.frozen_at && !visitStarted,
      // Where this link had reached, so it resumes rather than restarts.
      position: token.position ?? {},

      form_version: definitionRow.version,
      definition,
      context: {
        client_group: client.client_group ?? service?.client_group ?? null,
        service_key: service?.questionnaire_section
          ? SERVICE_KEY_BY_SECTION[service.questionnaire_section] ?? null
          : null,
        service_name: service?.name ?? null,
      },
      prefill,
      intake_seed: intakeSeed,
      budget_bands: (bands ?? []).map((b) => ({ value: b.id, label: b.label, is_discuss: b.is_discuss })),
      responses: doc?.responses ?? {},
      outstanding_required: doc?.outstanding_required ?? [],
      person: { preferred_name: client.preferred_name ?? client.full_name ?? null },
      filler: {
        type: token.filler_type,
        name: contact?.full_name ?? null,
        relationship: contact?.relationship ?? null,
      },
    });
  } catch (e) {
    console.error("care-form-load failed", e instanceof Error ? e.message : e);
    return json({ error: "Could not open the form" }, 500);
  }
});
