// Saves a pre-assessment, as it is typed and again when it is sent.
//
// Required is a flag and not a block: a submission with gaps is accepted and
// the gaps are written onto the document so the coordinator can see them. Only
// the two consent answers stop a submission. An unanswered question is null.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  answersForRecipient, applicableSections, buildContext, cleanResponses, hashToken, LINK_SEGMENT,
  fieldVisible, intakeRoutingAnswers, missingConsent, withDerived, outstandingRequired, raisedFlags, recipientIdsOf, requestAnswers,
  SERVICE_KEY_BY_SECTION, validateResponses,
  withoutDerived,
  type ControlledRefs, type FormDefinition, type FormSection,
} from "../_shared/care-form.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};


const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const INTAKE_SECTIONS = new Set(["route", "route_service"]);
const REQUEST_SECTIONS = new Set(["core_arrangements", "consent"]);
const SERVICE_SECTION: Record<string, string> = {
  antenatal: "antenatal",
  postnatal_mother: "postnatal",
  newborn: "newborn",
  paediatric: "paediatric",
  additional_needs: "additional_needs",
  nanny: "nanny",
  post_surgical: "post_surgical",
  eldercare: "eldercare",
  clinical_home_care: "clinical_home_care",
  other: "other",
};

/** Remove stale answers to follow-ups that the current route no longer shows. */
const pruneHiddenAnswers = (
  definition: FormDefinition,
  responses: Record<string, unknown>,
  clientGroup: string | null,
  recordedService: string | null,
): Record<string, unknown> => {
  let current = { ...responses };
  for (let pass = 0; pass < 4; pass += 1) {
    const allowed = new Set(["care_intake"]);
    for (const group of evaluationGroups(definition, current, clientGroup, recordedService)) {
      for (const section of group.sections) {
        for (const field of section.fields) {
          if (!fieldVisible(field, group.responses)) continue;
          allowed.add(group.recipientId ? `${group.recipientId}__${field.id}` : field.id);
        }
      }
    }
    const next = Object.fromEntries(Object.entries(current).filter(([key]) => allowed.has(key)));
    if (Object.keys(next).length === Object.keys(current).length) return next;
    current = next;
  }
  return current;
};

interface EvaluationGroup {
  recipientId: string | null;
  recipientName: string | null;
  sections: FormSection[];
  responses: Record<string, unknown>;
}

const intakeRecipients = (responses: Record<string, unknown>): Record<string, unknown>[] => {
  const intake = responses.care_intake;
  if (!intake || typeof intake !== "object" || Array.isArray(intake)) return [];
  const recipients = (intake as Record<string, unknown>).recipients;
  return Array.isArray(recipients)
    ? recipients.filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && !Array.isArray(r))
    : [];
};

const evaluationGroups = (
  definition: FormDefinition,
  responses: Record<string, unknown>,
  clientGroup: string | null,
  recordedService: string | null,
  scope: "full" | "top_up" = "full",
  coversRecipientKey: string | null = null,
  coversServices: string[] = [],
): EvaluationGroup[] => {
  const recipients = intakeRecipients(responses);
  if (recipients.length === 0) {
    const sections = applicableSections(definition, buildContext(definition, {
      clientGroup, serviceKey: recordedService, responses,
    })).filter((s) => !INTAKE_SECTIONS.has(s.id));
    return [{ recipientId: null, recipientName: null, sections, responses }];
  }

  const groups: EvaluationGroup[] = [];
  let requestSections: FormSection[] = [];
  for (const recipient of recipients) {
    const id = typeof recipient.id === "string" ? recipient.id : "";
    if (!/^r\d+$/.test(id)) continue;
    // The intake's facts and the derived ones (age, group, service), so a
    // question's own condition reads them exactly as the page does.
    const local = withDerived(
      { ...answersForRecipient(responses, id), ...intakeRoutingAnswers(recipients, recipient), service_requested: (Array.isArray(recipient.services) ? recipient.services.map(String).map((v) => SERVICE_SECTION[v]).find(Boolean) : null) ?? null },
      { recordedService },
    );
    const services = Array.isArray(recipient.services)
      ? recipient.services.map(String).map((s) => SERVICE_SECTION[s]).filter((s): s is string => !!s)
      : [];
    const allServices = [...new Set(services)];
    const baseServices = scope === "top_up"
      ? allServices.filter((serviceKey) => !coversServices.includes(serviceKey))
      : allServices;
    const found = new Map<string, FormSection>();
    for (const serviceKey of baseServices.length > 0 ? baseServices : [scope === "top_up" ? "unknown" : recordedService]) {
      const routed = { ...local, service_requested: serviceKey };
      const applicable = applicableSections(definition, buildContext(definition, {
        clientGroup, serviceKey, responses: routed,
      }));
      for (const section of applicable) found.set(section.id, section);
    }
    let ordered = definition.sections.filter((section) => found.has(section.id));
    if (scope === "top_up") {
      if (id !== coversRecipientKey) continue;
      const added = new Map<string, FormSection>();
      for (const serviceKey of coversServices) {
        const routed = { ...local, service_requested: serviceKey };
        for (const section of applicableSections(definition, buildContext(definition, {
          clientGroup, serviceKey, responses: routed,
        }))) added.set(section.id, section);
      }
      ordered = definition.sections.filter((section) => added.has(section.id) && !found.has(section.id));
    }
    if (requestSections.length === 0) {
      requestSections = ordered.filter((section) => REQUEST_SECTIONS.has(section.id));
    }
    groups.push({
      recipientId: id,
      recipientName: [recipient.firstName, recipient.lastName]
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
        .join(" ") || id,
      sections: ordered.filter((section) => !INTAKE_SECTIONS.has(section.id) && !REQUEST_SECTIONS.has(section.id)),
      responses: local,
    });
  }
  return scope === "top_up"
    ? groups
    : [
        { recipientId: null, recipientName: null, sections: requestSections, responses: requestAnswers(responses) },
        ...groups,
      ];
};

type NamedContact = { firstName?: string; lastName?: string; phone?: string; email?: string; relationship?: string; relationshipOther?: string };

async function addNamedContacts(
  db: ReturnType<typeof createClient>,
  clientId: string,
  groups: { sections: { fields?: { id: string; type: string }[] }[]; responses: Record<string, unknown> }[],
) {
  const named: NamedContact[] = [];
  for (const group of groups) {
    for (const section of group.sections) {
      for (const field of section.fields ?? []) {
        if (field.type !== "contact_block") continue;
        const value = group.responses[field.id];
        if (value && typeof value === "object" && !Array.isArray(value)) named.push(value as NamedContact);
      }
    }
  }
  if (named.length === 0) return;

  const { data: existing } = await db.from("client_contacts").select("full_name, phone").eq("client_id", clientId);
  const digits = (v?: string | null) => String(v ?? "").replace(/\D/g, "").slice(-10);
  const known = (existing ?? []) as { full_name: string | null; phone: string | null }[];

  for (const c of named) {
    const first = String(c.firstName ?? "").trim();
    const last = String(c.lastName ?? "").trim();
    const phone = String(c.phone ?? "").trim();
    const fullName = [first, last].filter(Boolean).join(" ");
    if (!fullName || (!phone && !String(c.email ?? "").trim())) continue;
    const already = known.some((k) =>
      (phone && digits(k.phone) && digits(k.phone) === digits(phone)) ||
      String(k.full_name ?? "").trim().toLowerCase() === fullName.toLowerCase());
    if (already) continue;

    const relationship = c.relationship === "Other" ? String(c.relationshipOther ?? "").trim() || null : c.relationship || null;
    const email = String(c.email ?? "").trim().toLowerCase() || null;
    const { data: person, error: personError } = await db.from("care_people").insert({
      full_name: fullName, first_name: first || null, last_name: last || null,
      phone: phone || null, whatsapp: phone || null, email, source: "pre_assessment",
    }).select("id").single();
    if (personError) throw personError;
    const { error: contactError } = await db.from("client_contacts").insert({
      client_id: clientId, person_id: (person as { id: string }).id, full_name: fullName,
      first_name: first || null, last_name: last || null, relationship,
      phone: phone || null, whatsapp: phone || null, email, is_primary: false, is_enquirer: false,
    });
    if (contactError) throw contactError;
    known.push({ full_name: fullName, phone });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const plain = typeof body?.token === "string" ? body.token.trim().toUpperCase() : "";
    const mode = body?.mode === "submit" ? "submit" : body?.mode === "amend" ? "amend" : "autosave";
    const incoming = body?.responses && typeof body.responses === "object" && !Array.isArray(body.responses)
      ? (body.responses as Record<string, unknown>)
      : null;
    // Where the family has reached. Held on the server so the same link
    // resumes on any device; it is navigation only, never an answer.
    const rawPosition = body?.position && typeof body.position === "object" && !Array.isArray(body.position)
      ? (body.position as Record<string, unknown>)
      : null;
    const position = rawPosition
      ? {
          section: typeof rawPosition.section === "string" ? rawPosition.section.slice(0, 120) : null,
          page: typeof rawPosition.page === "string" ? rawPosition.page.slice(0, 240) : null,
          recipient_id: typeof rawPosition.recipient_id === "string" ? rawPosition.recipient_id.slice(0, 40) : null,
        }
      : null;
    if (!LINK_SEGMENT.test(plain)) return json({ error: "This link is not valid" }, 404);
    if (!incoming) return json({ error: "Nothing to save" }, 400);
    if (Object.keys(incoming).length > 400) return json({ error: "Too many answers in one save" }, 400);


    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token_hash = await hashToken(plain);

    const { data: token } = await db
      .from("care_access_tokens")
      .select("id, client_id, filler_type, person_id, suppress_auto_grant, expires_at, revoked_at, frozen_at, document_id, scope, covers_recipient_key, covers_services")
      .eq("token_hash", token_hash)
      .maybeSingle();
    if (!token) return json({ error: "This link is not valid" }, 404);
    if (token.revoked_at) return json({ error: "This link has been withdrawn" }, 410);

    // A correction to a form already sent back. The sent answers stand; the
    // change is recorded against them, and only until the visit opens.
    if (mode === "amend") {
      const documentId = typeof body?.document_id === "string" ? body.document_id : "";
      const sectionId = typeof body?.section_id === "string" ? body.section_id : "";
      if (!documentId || !sectionId) return json({ error: "Nothing to change" }, 400);
      const { data: result, error: amendError } = await db.rpc("care_family_amend", {
        _token_hash: token_hash,
        _document_id: documentId,
        _section_id: sectionId,
        _changes: incoming,
      });
      if (amendError) return json({ error: amendError.message }, 400);
      return json({ ok: true, ...(result as Record<string, unknown>) });
    }
    // A frozen form is finished. A repeated Send, though, may be the family
    // trying again after something failed halfway, so the return is settled
    // once more rather than refused: the call below changes nothing that is
    // already true and completes anything that is not.
    if (token.frozen_at && mode !== "submit") {
      return json({ error: "This form has already been sent back to us" }, 409);
    }
    if (token.frozen_at) {
      const { data: done } = await db
        .from("care_documents")
        .select("id, outstanding_required")
        .eq("id", token.document_id ?? "00000000-0000-0000-0000-000000000000")
        .eq("client_id", token.client_id)
        .eq("kind", "pre_assessment")
        .eq("status", "submitted")
        .maybeSingle();
      if (!done) return json({ error: "This form has already been sent back to us" }, 409);
      const { error: settleError } = await db.rpc("care_pre_assessment_finalise", {
        _token_hash: token_hash,
        _document_id: done.id,
      });
      if (settleError) throw settleError;
      return json({
        ok: true,
        submitted: true,
        document_id: done.id,
        outstanding_required: done.outstanding_required ?? [],
      });
    }
    if (token.expires_at && new Date(token.expires_at) < new Date()) {
      return json({ error: "This link has expired" }, 410);
    }

    const { data: client } = await db
      .from("clients")
      .select("id, client_group, service_id, state_code")
      .eq("id", token.client_id)
      .maybeSingle();
    if (!client) return json({ error: "This link is not valid" }, 404);

    const { data: service } = client.service_id
      ? await db
          .from("services")
          .select("questionnaire_section, client_group")
          .eq("id", client.service_id)
          .maybeSingle()
      : { data: null };

    const existingQuery = db
      .from("care_documents")
      .select("id, responses, form_definition_id")
      .eq("client_id", client.id)
      .eq("kind", "pre_assessment")
      .eq("status", "draft");
    const { data: existing } = token.document_id
      ? await existingQuery.eq("id", token.document_id).maybeSingle()
      : await existingQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();

    // A form that has been started stays on the questions it was started on.
    // Only a new draft picks up the current published version.
    const { data: definitionRow } = existing?.form_definition_id
      ? await db
          .from("form_definitions")
          .select("id, version, definition")
          .eq("id", existing.form_definition_id)
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

    // Nothing the engine works out for itself is ever written to the record.
    const answers = withoutDerived(cleanResponses(incoming));
    const unpruned = {
      ...withoutDerived((existing?.responses as Record<string, unknown>) ?? {}),
      ...answers,
    };

    const definition = definitionRow.definition as FormDefinition;
    const clientGroup = client.client_group ?? service?.client_group ?? null;
    const recordedService = service?.questionnaire_section
      ? SERVICE_KEY_BY_SECTION[service.questionnaire_section] ?? null
      : null;
    const merged = pruneHiddenAnswers(definition, unpruned, clientGroup, recordedService);
    const groups = evaluationGroups(
      definition,
      merged,
      clientGroup,
      recordedService,
      token.scope === "top_up" ? "top_up" : "full",
      token.covers_recipient_key ?? null,
      Array.isArray(token.covers_services) ? token.covers_services : [],
    );
    const sections = [...new Map(
      groups.flatMap((group) => group.sections).map((section) => [section.id, section]),
    ).values()];

    // A control on a screen is not validation. Anything controlled is checked
    // against the published definition and the reference tables before it is
    // written, so a malformed value never reaches the document.
    const [languageRows, relationshipRows, stateRows, lgaRows, bandRows] = await Promise.all([
      db.from("care_languages").select("code, label").eq("is_active", true),
      db.from("care_relationship_terms").select("label"),
      db.from("care_states").select("code, label"),
      db.from("care_lgas").select("code, state_code, label"),
      db.from("budget_bands").select("id"),
    ]);

    const languageCodeByLabel = new Map(
      (languageRows.data ?? []).map((r: { code: string; label: string }) => [r.label.toLowerCase(), r.code]),
    );

    const refs: ControlledRefs = {
      languages: new Set(languageCodeByLabel.keys()),
      relationships: new Set((relationshipRows.data ?? []).map((r: { label: string }) => r.label.toLowerCase())),
      states: new Map(
        (stateRows.data ?? []).map((r: { code: string; label: string }) => [r.label.toLowerCase(), r.code]),
      ),
      lgas: (lgaRows.data ?? []).reduce(
        (map: Map<string, Set<string>>, r: { state_code: string; label: string }) => {
          const set = map.get(r.state_code) ?? new Set<string>();
          set.add(r.label.toLowerCase());
          map.set(r.state_code, set);
          return map;
        },
        new Map<string, Set<string>>(),
      ),
      budgetBands: new Set((bandRows.data ?? []).map((r: { id: string }) => r.id)),
    };

    // An answer filed under a care recipient is only accepted for a person
    // the merged intake actually holds.
    const problems = validateResponses(sections, answers, refs, recipientIdsOf(merged));
    if (problems.length > 0) {
      return json({ error: problems[0].message, problems }, 400);
    }

    let documentId = existing?.id ?? null;

    if (!documentId) {
      const { data: created, error } = await db
        .from("care_documents")
        .insert({
          client_id: client.id,
          kind: "pre_assessment",
          form_definition_id: definitionRow.id,
          status: "draft",
          responses: merged,
          authored_by_token_id: token.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      documentId = created.id;
      const { error: bindError } = await db.from("care_access_tokens")
        .update({ document_id: documentId }).eq("id", token.id);
      if (bindError) throw bindError;
    } else {
      const { error } = await db
        .from("care_documents")
        .update({ responses: merged, updated_at: new Date().toISOString() })
        .eq("id", documentId);
      if (error) throw error;
    }

    if (position) {
      await db.from("care_access_tokens").update({ position }).eq("id", token.id);
    }

    if (mode === "autosave") return json({ ok: true, saved: true, document_id: documentId });


    // Submit. Consent is the only thing that can stop this.
    const blocked = groups.flatMap((group) =>
      missingConsent(group.sections, group.responses).map((field) =>
        group.recipientId ? `${group.recipientId}__${field}` : field),
    );
    if (blocked.length > 0) return json({ error: "Please tick the boxes at the end", blocked }, 400);

    const outstanding = groups.flatMap((group) =>
      outstandingRequired(group.sections, group.responses).map((item) => ({
        ...item,
        id: group.recipientId ? `${group.recipientId}__${item.id}` : item.id,
        record: group.recipientName ? `${group.recipientName}: ${item.record}` : item.record,
      })),
    );

    // Everything that can be worked out here is worked out here. Everything
    // that has to be true together is made true together, in one call.
    const requestGroup = groups.find((group) => group.recipientId === null);
    const requestResponses = requestGroup?.responses ?? requestAnswers(merged);
    const fields = requestGroup?.sections.flatMap((s) => s.fields ?? []) ?? [];
    const addressField = fields.find((f) => f.type === "address");
    const lgaField = fields.find((f) => f.type === "lga");
    const addressLine = addressField ? String(requestResponses[addressField.id] ?? "").trim() : "";

    // The area answer is a state and an area, both given as the names on the
    // list. Both are resolved against the reference tables, never guessed.
    const areaAnswer = lgaField && requestResponses[lgaField.id] && typeof requestResponses[lgaField.id] === "object"
      ? requestResponses[lgaField.id] as Record<string, unknown>
      : {};
    const stateName = String(areaAnswer.state ?? "").trim();
    const lgaName = String(areaAnswer.lga ?? "").trim();

    let stateCode: string | null = null;
    let lgaCode: string | null = null;
    if (stateName) {
      stateCode = refs.states.get(stateName.toLowerCase()) ?? null;
      if (!stateCode) console.error("care-form-save unknown state", stateName);
    }
    const resolvedState = stateCode ?? client.state_code ?? null;
    if (lgaName && resolvedState) {
      const { data: lgaRow } = await db
        .from("care_lgas")
        .select("code")
        .eq("state_code", resolvedState)
        .ilike("label", lgaName)
        .maybeSingle();
      lgaCode = (lgaRow as { code: string } | null)?.code ?? null;
      if (!lgaCode) console.error("care-form-save unknown local government area", lgaName);
    }

    // The languages question asks what the care professional should speak, so
    // it becomes the care language requirement on the client and never the
    // languages the client themselves speak. The submitted answer stays on the
    // document exactly as it was given.
    const languageNames = groups.flatMap((group) =>
      group.sections.flatMap((section) => section.fields)
        .filter((field) => field.type === "language_picker")
        .flatMap((field) => {
          const answer = group.responses[field.id];
          return typeof answer === "string"
            ? answer.split(",").map((v) => v.trim()).filter(Boolean)
            : Array.isArray(answer) ? answer.map((v) => String(v).trim()).filter(Boolean) : [];
        }),
    );
    const languageCodes = Array.from(new Set(
      languageNames
        .map((n) => languageCodeByLabel.get(n.toLowerCase()))
        .filter((c): c is string => typeof c === "string"),
    ));

    // The arranging contact who answered gets to follow the journey, and only
    // the journey. A referring clinician never gets standing portal access.
    const ARRANGING = ["client", "parent", "family_member"];
    const grantPersonId = !token.suppress_auto_grant && token.person_id && ARRANGING.includes(token.filler_type)
      ? token.person_id
      : null;

    const flags = groups.flatMap((group) =>
      raisedFlags(group.sections, group.responses).map((f) => ({
        kind: f.to,
        severity: f.sameDay ? "urgent" : "review",
        detail: group.recipientName ? `${group.recipientName}: ${f.detail}` : f.detail,
      })),
    );

    const { error: finaliseError } = await db.rpc("care_pre_assessment_finalise", {
      _token_hash: token_hash,
      _document_id: documentId,
      _outstanding: outstanding,
      _flags: flags,
      _address_line: addressLine || null,
      _state_code: stateCode,
      _lga_code: lgaCode,
      _language_codes: languageCodes.length > 0 ? languageCodes : null,
      _grant_person_id: grantPersonId,
    });
    // Nothing is reported as sent back unless it truly is. A failure here
    // leaves the form open, so the family can press Send again.
    if (finaliseError) throw finaliseError;

    // Anyone else the family named to reach (the alternative contact, or the
    // local contact for a family abroad) joins the client's contacts, so staff
    // find them on the record and not only inside the answers. A name and a
    // way to reach them is enough; the relationship is added when given. This
    // never stops a form being received.
    try {
      await addNamedContacts(db, token.client_id, groups);
    } catch (err) {
      console.error("care-form-save named contacts", err instanceof Error ? err.message : err);
    }

    // A top-up closes the gap it was sent for.
    const { error: coverageError } = await db
      .from("care_pre_assessment_coverage")
      .update({ status: "returned", returned_at: new Date().toISOString(), document_id: documentId })
      .eq("token_id", token.id)
      .eq("status", "sent");
    if (coverageError) console.error("care-form-save coverage update failed", coverageError.message);

    return json({ ok: true, submitted: true, document_id: documentId, outstanding_required: outstanding });
  } catch (e) {
    console.error("care-form-save failed", e instanceof Error ? e.message : e);
    return json({ error: "Could not save your answers" }, 500);
  }
});
