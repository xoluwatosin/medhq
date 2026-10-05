// One care client: who they are, who we speak to, what came back, the link,
// and everything that has happened on the record.
//
// Built on the same record primitives as a candidate profile, so a coordinator
// moving between the two is reading the same shapes. What the family said is
// never overwritten: a correction sits beside the original answer.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ChevronLeft, Copy, Mail, MessageCircle, Pencil, Plus, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cxInputClass } from "@/components/candidate/primitives";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { adminDb } from "@/lib/admin-utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  applicableSections, buildContext, CareDefinition, CareField, CareResponses,
  CareSection, fieldVisible, isAnswered, readAnswer, SERVICE_KEY_BY_SECTION,
  createCarePerson,
} from "@/lib/care";
import {
  answersForRecipient, CareIntake, IntakeRecipient, recipientName, scopedKey,
  sectionKeysFor, sectionScope,
} from "@/lib/care-intake";
import {
  MuEmpty, MuHero, MuHeroStrip, MuPage, MuRecordNav, MuRow, MuSection, MuTable,
} from "@/components/admin/mu/MuShell";
import { PhoneField, SelectField, Status } from "@/components/field";
import { art } from "@/components/mc/art";
import { careFlagTone, careStageLabel, careStageTone } from "@/lib/care-status";
import {
  RELATIONSHIP_TERMS, SEX_TERMS, STATE_TERMS, ageText, lgaTerms, lgaLabel, relationshipLabel,
  sexLabel, stateLabel, languageLabels,
} from "@/lib/care-vocabularies";
import { DateField, SearchableSelect } from "@/components/field";
import { Checkbox } from "@/components/ui/checkbox";
import WorkSection from "@/components/admin/care/WorkSection";
import GroupSection from "@/components/admin/care/GroupSection";
import LinkedPeople from "@/components/admin/care/LinkedPeople";
import HomeSection from "@/components/admin/care/HomeSection";
import PossibleDuplicates from "@/components/admin/care/PossibleDuplicates";
import PayersSection from "@/components/admin/care/PayersSection";
import { homeOverview, linkScope, type HomeOverview, type LinkScope } from "@/lib/care-records";
import RecordLifecycle from "@/components/admin/care/RecordLifecycle";

import LanguageCodes from "@/components/admin/care/LanguageCodes";
import AssessmentSection from "@/components/admin/care/AssessmentSection";
import ClinicalReviewSection from "@/components/admin/care/ClinicalReviewSection";
import CarePlanSection from "@/components/admin/care/CarePlanSection";
import CareProposalSection from "@/components/admin/care/CareProposalSection";
import CareFinanceSection from "@/components/admin/care/CareFinanceSection";
import { AccessSection } from "@/components/admin/care/AccessSection";
import {
  CareEditButton, CareField as CareFormRow, CareSheet,
} from "@/components/admin/care/CareSurface";
import CareFieldInput from "@/components/care/CareFieldInput";
import { formatDate, formatPhone } from "@/lib/format";


/** The wording kept on the legacy free text column, so old readers still work. */
const relationshipText = (c: { relationship_code?: string | null; relationship_other?: string | null; relationship?: string | null }) =>
  c.relationship_code ? relationshipLabel(c.relationship_code, c.relationship_other) : (c.relationship?.trim() || null);

interface Contact {
  id: string;
  person_id: string | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  relationship: string | null;
  relationship_code: string | null;
  relationship_other: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  is_primary: boolean;
}


interface CareDoc {
  id: string;
  form_definition_id: string;
  status: string;
  responses: CareResponses;
  outstanding_required: { id: string; record: string }[] | null;
  submitted_at: string | null;
  updated_at: string;
}

interface TokenRow {
  id: string;
  filler_type: string;
  expires_at: string;
  revoked_at: string | null;
  first_opened_at: string | null;
  submitted_at: string | null;
  delivery_method: string | null;
  created_at: string;
}

interface FlagRow { id: string; kind: string; severity: string; detail: string | null; cleared_at: string | null; created_at: string }
interface ActivityRow { id: string; action: string; detail: Record<string, unknown>; actor_name: string | null; created_at: string }
interface AmendmentRow {
  id: string; field_id: string; corrected_value: unknown; reason: string;
  amended_by_name: string | null; created_at: string;
}
interface RevisionEventRow {
  id: string; event: string; revision_number: number; actor_name: string | null;
  actor_kind: string; reason: string | null; changed_fields: { field_id: string; previous_value: unknown; new_value: unknown }[];
  outstanding_required: unknown[]; created_at: string;
}

const TAB_ALIASES: Record<string, string> = {
  answers: "responses",
  "pre-assessment": "responses",
  people: "contacts",
  money: "commercial",
  finance: "commercial",
  tasks: "work",
  questionnaire: "link",
  history: "activity",
};

const dateOf = (value: string | null | undefined) => (value ? formatDate(value) : null);

const whatsappHref = (number: string, text: string) =>
  `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

const ClientRecord = () => {
  const { id = "" } = useParams();
  const { user, permissions, isSuperAdmin } = useAuth();
  const isCoordinator = isSuperAdmin || permissions.includes("care_coordinator");
  // Accepting an assessment and writing the plan is clinical authority, held
  // separately from coordinating the journey.
  const isClinical = isSuperAdmin || permissions.includes("care_clinical");
  const [params, setParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [client, setClient] = useState<Record<string, unknown> | null>(null);
  const [service, setService] = useState<{ name: string; questionnaire_section: string | null } | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [doc, setDoc] = useState<CareDoc | null>(null);
  const [definition, setDefinition] = useState<CareDefinition | null>(null);
  const [bandLabels, setBandLabels] = useState<Record<string, string>>({});
  const [bands, setBands] = useState<{ id: string; label: string }[]>([]);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [home, setHome] = useState<HomeOverview | null>(null);
  const [amendments, setAmendments] = useState<AmendmentRow[]>([]);
  const [revisionEvents, setRevisionEvents] = useState<RevisionEventRow[]>([]);
  const [commercial, setCommercial] = useState<Record<string, unknown> | null>(null);

  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [clientDraft, setClientDraft] = useState<Record<string, string>>({});
  const [spokenDraft, setSpokenDraft] = useState<string[]>([]);
  const [careLanguageDraft, setCareLanguageDraft] = useState<string[]>([]);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  // A correction is made to a section of the form, the way it was answered,
  // in the same controls the family used. One reason covers the sitting.
  const [amendSection, setAmendSection] = useState<
    { id: string; title: string; fields: CareField[]; recipientId: string | null } | null
  >(null);
  const [amendValues, setAmendValues] = useState<CareResponses>({});
  const [amendReason, setAmendReason] = useState("");
  const [saving, setSaving] = useState(false);


  const tabParam = params.get("tab") ?? "overview";
  const tab = TAB_ALIASES[tabParam] ?? tabParam;
  const setTab = (next: string) => {
    const copy = new URLSearchParams(params);
    copy.set("tab", next);
    setParams(copy, { replace: true });
  };

  const load = useCallback(async () => {
    const [clientRes, contactRes, docRes, defRes, bandRes, tokenRes, flagRes, actRes] = await Promise.all([
      adminDb().from("clients").select("*, services(name, questionnaire_section)").eq("id", id).maybeSingle(),
      adminDb().from("client_contacts").select("*").eq("client_id", id).order("is_primary", { ascending: false }),
      adminDb().from("care_documents").select("*").eq("client_id", id).eq("kind", "pre_assessment")
        .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      adminDb().from("form_definitions").select("definition").eq("kind", "pre_assessment").eq("status", "published")
        .order("version", { ascending: false }).limit(1).maybeSingle(),
      adminDb().from("budget_bands").select("id, label").order("sort_order"),
      adminDb().from("care_access_tokens").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      adminDb().from("care_flags").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      adminDb().from("care_activity").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(60),
    ]);

    const row = clientRes.data as
      (Record<string, unknown> & { services?: { name: string; questionnaire_section: string | null } | null }) | null;
    setClient(row);
    setLoadFailed(Boolean(clientRes.error));
    setService(row?.services ?? null);
    setContacts((contactRes.data ?? []) as unknown as Contact[]);
    const document = (docRes.data ?? null) as unknown as CareDoc | null;
    setDoc(document);
    let loadedDefinition = ((defRes.data as { definition?: CareDefinition } | null)?.definition) ?? null;
    if (document?.form_definition_id) {
      const [boundDefinition, contextMap] = await Promise.all([
        adminDb().from("form_definitions").select("definition").eq("id", document.form_definition_id).maybeSingle(),
        adminDb().from("care_answer_context_maps").select("field_id,subject,display_context,cardinality").eq("form_definition_id", document.form_definition_id),
      ]);
      const exact = (boundDefinition.data as { definition?: CareDefinition } | null)?.definition;
      if (exact) {
        const contextRows = (contextMap.data ?? []) as unknown as { field_id: string; subject: string; display_context: string; cardinality: string }[];
        const contexts = new Map(contextRows.map((entry) => [entry.field_id, entry]));
        loadedDefinition = {
          ...exact,
          sections: exact.sections.map((section) => ({
            ...section,
            fields: section.fields.map((field) => {
              const context = contexts.get(field.id);
              return context ? { ...field, subject: context.subject, displayContext: context.display_context, cardinality: context.cardinality } as CareField : field;
            }),
          })),
        };
      }
    }
    setDefinition(loadedDefinition);
    const bandRows = (bandRes.data ?? []) as { id: string; label: string }[];
    setBands(bandRows);
    setBandLabels(Object.fromEntries(bandRows.map((b) => [b.id, b.label])));
    setTokens((tokenRes.data ?? []) as unknown as TokenRow[]);
    setFlags((flagRes.data ?? []) as unknown as FlagRow[]);
    setActivity((actRes.data ?? []) as unknown as ActivityRow[]);
    setHome(await homeOverview(String(id)).catch(() => null));

    if (document) {
      const [amendmentResult, revisionResult] = await Promise.all([
        adminDb().from("care_response_amendments").select("*").eq("document_id", document.id).order("created_at", { ascending: false }),
        adminDb().from("care_form_revision_events").select("*").eq("document_id", document.id).order("created_at", { ascending: false }),
      ]);
      setAmendments((amendmentResult.data ?? []) as unknown as AmendmentRow[]);
      setRevisionEvents((revisionResult.data ?? []) as unknown as RevisionEventRow[]);
    } else {
      setAmendments([]);
      setRevisionEvents([]);
    }

    if (isCoordinator) {
      const { data } = await adminDb().from("client_commercial").select("*").eq("client_id", id).maybeSingle();
      setCommercial(data as Record<string, unknown> | null);
    }
    setLoading(false);
  }, [id, isCoordinator]);

  useEffect(() => { void load(); }, [load]);

  // A form that comes back while the record is open should land on the screen.
  const reloadTimer = useRef<number | null>(null);
  useEffect(() => {
    const nudge = () => {
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
      reloadTimer.current = window.setTimeout(() => { void load(); }, 400);
    };
    const channel = supabase
      .channel(`care-client-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "care_documents", filter: `client_id=eq.${id}` }, nudge)
      .on("postgres_changes", { event: "*", schema: "public", table: "care_flags", filter: `client_id=eq.${id}` }, nudge)
      .on("postgres_changes", { event: "*", schema: "public", table: "care_activity", filter: `client_id=eq.${id}` }, nudge)
      .on("postgres_changes", { event: "*", schema: "public", table: "clients", filter: `id=eq.${id}` }, nudge)
      .subscribe();
    return () => {
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [id, load]);

  const logActivity = useCallback(async (action: string, detail: Record<string, unknown> = {}) => {
    try {
      await adminDb().from("care_activity").insert({
        client_id: id,
        action,
        detail,
        actor_id: user?.id ?? null,
        actor_name: user?.email ?? null,
      });
    } catch {
      // the trail is best effort and never blocks the action
    }
  }, [id, user]);

  const responses = doc?.responses ?? {};
  const outstanding = doc?.outstanding_required ?? [];
  const openFlags = flags.filter((f) => !f.cleared_at);
  const liveToken = tokens.find((t) => !t.revoked_at && !t.submitted_at && new Date(t.expires_at) > new Date());
  const [liveScope, setLiveScope] = useState<LinkScope | null>(null);
  const liveTokenId = liveToken?.id;
  useEffect(() => {
    setLiveScope(null);
    if (!liveTokenId) return;
    let live = true;
    linkScope(liveTokenId).then((s) => { if (live) setLiveScope(s); }).catch(() => undefined);
    return () => { live = false; };
  }, [liveTokenId]);

  // Answers are held per care recipient (r1__question), exactly as the family
  // gave them, plus the request-wide answers under their plain identifiers.
  // The record is read back the same way, one person at a time.
  const answerGroups = useMemo<
    { key: string; recipientId: string | null; name: string | null; sections: CareSection[]; answers: CareResponses }[]
  >(() => {
    if (!definition) return [];
    const clientGroup = (client?.client_group as string | null) ?? null;
    const fallbackKey = service?.questionnaire_section
      ? SERVICE_KEY_BY_SECTION[service.questionnaire_section] ?? null
      : null;
    const intake = responses.care_intake as CareIntake | undefined;
    const recipients = (intake?.recipients ?? []) as IntakeRecipient[];

    if (recipients.length === 0) {
      const sections = applicableSections(
        definition,
        buildContext(definition, { clientGroup, serviceKey: fallbackKey, responses }),
      );
      return [{ key: "all", recipientId: null, name: null, sections, answers: responses }];
    }

    const groups: { key: string; recipientId: string | null; name: string | null; sections: CareSection[]; answers: CareResponses }[] = [];
    const requestWide = new Map<string, CareSection>();

    for (const r of recipients) {
      const answers: CareResponses = {
        ...answersForRecipient(responses, r.id),
        who_for: r.isEnquirer ? "myself" : "someone_else",
        recipient_first_name: r.firstName,
        dob_known: r.dobKnown ?? null,
        date_of_birth: r.dateOfBirth ?? null,
        approx_age: r.approxAge ?? null,
      } as CareResponses;
      const keys = sectionKeysFor(r);
      const found = new Map<string, CareSection>();
      for (const key of keys.length ? keys : [fallbackKey]) {
        const ctx = buildContext(definition, {
          clientGroup,
          serviceKey: key ?? null,
          responses: { ...answers, service_requested: key ?? null },
        });
        for (const section of applicableSections(definition, ctx)) found.set(section.id, section);
      }
      const own: CareSection[] = [];
      for (const section of found.values()) {
        if (sectionScope(section.id) === "request") requestWide.set(section.id, section);
        else own.push(section);
      }
      groups.push({
        key: r.id,
        recipientId: r.id,
        name: recipientName(r) || "Care recipient",
        sections: own,
        answers,
      });
    }

    if (requestWide.size > 0) {
      groups.push({
        key: "request",
        recipientId: null,
        name: "This request",
        sections: [...requestWide.values()],
        answers: responses,
      });
    }
    return groups;
  }, [definition, client, service, responses]);

  const sections = useMemo(() => answerGroups.flatMap((g) => g.sections), [answerGroups]);
  const questionLabels = useMemo(() => new Map(definition?.sections.flatMap((section) => section.fields.map((field) => [field.id, field.record] as const)) ?? []), [definition]);
  const revisionFieldLabel = (fieldId: string) => questionLabels.get(fieldId.replace(/^r\d+__/, "")) ?? fieldId;

  const amendmentFor = (fieldId: string) => amendments.find((a) => a.field_id === fieldId);

  const bandOptions = useMemo(() => bands.map((b) => ({ value: b.id, label: b.label })), [bands]);


  /* ---------- actions ---------- */

  const createLink = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("care-token-create", {
      // The respondent is the main contact already on file, and the
      // relationship is recorded on the family record. Nothing is asked again.
      body: {
        client_id: id,
        contact_id: primary?.id ?? null,
        filler_type: primary?.relationship_code === "self" ? "client" : "family_member",
      },
    });
    setBusy(false);
    if (error || !data?.ok) {
      toast.error(data?.error ?? "Could not create the link");
      return;
    }
    setLink(`${window.location.origin}/pre-assessment/${data.token}`);
    sessionStorage.setItem(`care_token_${data.token_id}`, data.token);
    toast.success("Link created. Copy it now, it is shown once.");
    void logActivity("link_created", { contact: primary?.full_name ?? null });
    void load();
  };

  // resend is only ever true when a coordinator deliberately asks to send the
  // email again. A repeated ordinary send is treated as the same send.
  const sendLink = async (method: "email" | "whatsapp" | "copied", resend = false) => {
    if (!liveToken) return;
    setBusy(true);
    const held = resend ? undefined : sessionStorage.getItem(`care_token_${liveToken.id}`) ?? undefined;
    const { data, error } = await supabase.functions.invoke("care-token-send", {
      body: { token_id: liveToken.id, delivery_method: method, token: held, resend },
    });
    setBusy(false);
    if (error || !data?.ok) {
      toast.error(data?.error ?? "Could not send the link");
      return;
    }
    setLink(data.link);
    if (data.email_error) toast.error(data.email_error);
    else if (method === "email") toast.success(resend ? "Link emailed again" : "Link emailed");
    else toast.success("Link ready");
    void logActivity(resend ? "link_resent" : "link_sent", { method });
    void load();
  };

  const revokeLink = async () => {
    if (!liveToken) return;
    const { error } = await adminDb()
      .from("care_access_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", liveToken.id);
    if (error) { toast.error("Could not withdraw the link"); return; }
    setLink(null);
    toast.success("Link withdrawn");
    void logActivity("link_withdrawn");
    void load();
  };

  const clearFlag = async (flag: FlagRow) => {
    const { error } = await adminDb()
      .from("care_flags").update({ cleared_at: new Date().toISOString() }).eq("id", flag.id);
    if (error) { toast.error("Could not clear the flag"); return; }
    void logActivity("flag_cleared", { kind: flag.kind });
    void load();
  };

  const openClientEdit = () => {
    setClientDraft({
      first_name: String(client?.first_name ?? ""),
      last_name: String(client?.last_name ?? ""),
      preferred_name: String(client?.preferred_name ?? ""),
      date_of_birth: String(client?.date_of_birth ?? ""),
      date_of_birth_is_estimated: client?.date_of_birth_is_estimated ? "yes" : "",
      sex_code: String(client?.sex_code ?? ""),
      state_code: String(client?.state_code ?? ""),
      lga_code: String(client?.lga_code ?? ""),
      address_line: String(client?.address_line ?? ""),
    });
    setSpokenDraft(((client?.language_codes as string[] | null) ?? []).filter(Boolean));
    setCareLanguageDraft(((client?.care_language_codes as string[] | null) ?? []).filter(Boolean));
    setEditingClient(true);
  };

  const saveClient = async () => {
    // Stage is not here on purpose: it is derived from what has actually
    // happened, and age is worked out from the date of birth when it is read.
    const { error } = await adminDb().from("clients").update({
      first_name: clientDraft.first_name.trim(),
      last_name: clientDraft.last_name.trim(),
      full_name: `${clientDraft.first_name.trim()} ${clientDraft.last_name.trim()}`.trim(),
      preferred_name: clientDraft.preferred_name.trim() || null,
      date_of_birth: clientDraft.date_of_birth || null,
      date_of_birth_is_estimated: !!clientDraft.date_of_birth && clientDraft.date_of_birth_is_estimated === "yes",
      sex_code: clientDraft.sex_code || null,
      state_code: clientDraft.state_code || null,
      lga_code: clientDraft.lga_code || null,
      address_line: clientDraft.address_line.trim() || null,
      // Two different facts: what the client speaks, and what the care
      // professional must speak. Both are stable codes, never typed text.
      language_codes: spokenDraft,
      care_language_codes: careLanguageDraft,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error("Could not save the client"); return; }
    setEditingClient(false);
    toast.success("Changes saved");
    void logActivity("client_edited");
    void load();
  };

  const saveContact = async () => {
    if (!editingContact) return;
    const first = (editingContact.first_name ?? "").trim();
    const last = (editingContact.last_name ?? "").trim();
    const payload = {
      full_name: `${first} ${last}`.trim() || editingContact.full_name.trim(),
      relationship_code: editingContact.relationship_code || null,
      relationship_other: editingContact.relationship_other?.trim() || null,
      relationship: relationshipText(editingContact),
      phone: editingContact.phone?.trim() || null,
      whatsapp: editingContact.whatsapp?.trim() || null,
      email: editingContact.email?.trim() || null,
      is_primary: editingContact.is_primary,
    };
    let error;
    if (editingContact.id) {
      // One operation: the client specific facts and the person behind them
      // move together, or neither of them moves.
      const { error: rpcError } = await adminDb().rpc("care_contact_save", {
        _contact_id: editingContact.id,
        _full_name: payload.full_name,
        _relationship: payload.relationship,
        _phone: payload.phone,
        _whatsapp: payload.whatsapp,
        _email: payload.email,
        _is_primary: payload.is_primary,
        _relationship_code: payload.relationship_code,
        _relationship_other: payload.relationship_other,
      });
      error = rpcError;
      // The two name parts live on the contact row itself; the composed full
      // name is kept in step by the database.
      if (!error && (first || last)) {
        await adminDb().from("client_contacts")
          .update({ first_name: first || null, last_name: last || null })
          .eq("id", editingContact.id);
      }
    } else {
      const personId = await createCarePerson(adminDb(), {
        full_name: payload.full_name,
        email: payload.email,
        phone: payload.phone,
        whatsapp: payload.whatsapp,
      });
      ({ error } = await adminDb().from("client_contacts")
        .insert({
          ...payload,
          first_name: first || null,
          last_name: last || null,
          client_id: id,
          person_id: personId,
        }));
    }



    if (error) { toast.error("Could not save the contact"); return; }
    setEditingContact(null);
    toast.success("Contact saved");
    void logActivity(editingContact.id ? "contact_edited" : "contact_added", { name: payload.full_name });
    void load();
  };

  const openSectionEdit = (sectionId: string, fields: CareField[], recipientId: string | null) => {
    const title = sections.find((s) => s.id === sectionId)?.title ?? "Answers";
    const current: CareResponses = {};
    for (const field of fields) {
      const key = scopedKey(recipientId, field.id);
      const amendment = amendmentFor(key);
      // The latest correction is the working value; the original is never lost.
      current[field.id] = amendment ? (amendment.corrected_value as never) : responses[key];
    }
    setAmendSection({ id: sectionId, title, fields, recipientId });
    setAmendValues(current);
    setAmendReason("");
  };

  /**
   * Only what actually changed is written, as one correction sitting beside
   * the answers the family gave. The form itself is never rewritten.
   */
  const saveSectionAmendment = async () => {
    if (!amendSection || !doc) return;
    if (!amendReason.trim()) { toast.error("Give a reason for the correction"); return; }
    const changes: Record<string, unknown> = {};
    for (const field of amendSection.fields) {
      const key = scopedKey(amendSection.recipientId, field.id);
      const before = amendmentFor(key)?.corrected_value ?? responses[key] ?? null;
      const after = amendValues[field.id] ?? null;
      if (JSON.stringify(before) !== JSON.stringify(after)) changes[key] = after;
    }
    if (Object.keys(changes).length === 0) {
      toast.error("Nothing has been changed");
      return;
    }
    setSaving(true);
    const { error } = await adminDb().rpc("care_amend_section", {
      _document_id: doc.id,
      _section_id: amendSection.id,
      _changes: changes as never,
      _reason: amendReason.trim(),
    });
    setSaving(false);
    if (error) { toast.error(error.message || "Could not record the correction"); return; }
    toast.success("Corrections recorded beside the original answers");
    void logActivity("responses_amended", { section: amendSection.id, fields: Object.keys(changes) });
    setAmendSection(null);
    void load();
  };


  const saveCommercial = async (patch: Record<string, unknown>) => {
    const { error } = commercial
      ? await adminDb().from("client_commercial").update(patch).eq("client_id", id)
      : await adminDb().from("client_commercial").insert({ client_id: id, ...patch });
    if (error) { toast.error("Could not save the commercial details"); return; }
    toast.success("Changes saved");
    void logActivity("commercial_edited", patch);
    void load();
  };

  if (loading) return <p className="py-10 text-center text-sm text-muted-foreground">Loading client</p>;
  if (!client && loadFailed) {
    return <p className="py-10 text-center text-sm text-muted-foreground">This client could not be loaded. Refresh to try again.</p>;
  }
  if (!client) {
    return (
      <div className="border border-line bg-card">
        <MuEmpty
          art={art.objMagnifier}
          title="Client not found"
          description="This record may have been merged or removed."
          action={<Button asChild variant="outline"><Link to="/admin/clients">Back to clients</Link></Button>}
        />
      </div>
    );
  }

  const stage = String(client.stage ?? "");
  const stateCode = (client.state_code as string | null) ?? null;
  const area = client.lga_code ? lgaLabel(stateCode, client.lga_code as string) : stateCode ? stateLabel(stateCode) : "";
  const primary = contacts.find((c) => c.is_primary) ?? contacts[0] ?? null;
  const reference = String(client.enquiry_number ?? "");

  const navGroups = [
    { label: "Record", items: [
      { value: "overview", label: "Overview" }, { value: "group", label: "Family" }, { value: "work", label: "Tasks" },
    ] },
    { label: "Care journey", items: [
      { value: "responses", label: "Pre-assessment", count: outstanding.length || null },
      { value: "assessment", label: "Assessment" }, { value: "clinical-review", label: "Clinical review" },
    ] },
    { label: "Care plan", items: [
      { value: "care-plan", label: "Working plan" }, { value: "proposal", label: "Client proposal" },
    ] },
    { label: "People and access", items: [
      { value: "contacts", label: "Contacts" }, { value: "link", label: "Pre-assessment link" }, { value: "access", label: "Access" },
    ] },
    ...(isCoordinator ? [{ label: "Finance", items: [{ value: "commercial", label: "Finance" }] }] : []),
    { label: "Record history", items: [{ value: "activity", label: "Activity" }] },
  ];

  return (
    <MuPage>
      <Link
        to="/admin/clients"
        className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-navy"
      >
        <ChevronLeft className="h-4 w-4" /> Clients
      </Link>

      <MuHero
        eyebrow={reference || "Client"}
        title={String(client.full_name)}
        subtitle={service?.name ?? "No service set"}
        facts={[
          { label: "Stage", value: careStageLabel(stage) },
          { label: "Age", value: ageText(client.date_of_birth as string | null, client.date_of_birth_is_estimated as boolean | null) },
          { label: "Area", value: area || undefined },
          { label: "Main contact", value: primary?.full_name },
        ]}
        primary={
          <Button type="button" variant="secondary" className="h-10" onClick={openClientEdit}>
            <Pencil className="mr-2 h-4 w-4" /> Edit client
          </Button>
        }
        secondary={
          isCoordinator ? (
            <RecordLifecycle
              clientId={String(id)}
              pausedAt={(client.paused_at as string | null) ?? null}
              closedAt={(client.closed_at as string | null) ?? null}
              archivedAt={(client.archived_at as string | null) ?? null}
              onChanged={() => { void load(); }}
            />
          ) : undefined
        }
        strip={
          <MuHeroStrip
            items={[
              {
                label: "Pre-assessment",
                sentence: doc?.submitted_at
                  ? `Came back on ${dateOf(doc.submitted_at)}.`
                  : doc
                    ? "Started, not sent back yet."
                    : "Not answered yet.",
              },
            ]}
          />
        }
      />

      <MuRecordNav groups={navGroups} value={tab} onChange={setTab}>
      <div className="flex flex-col gap-4">
        {openFlags.length > 0 && (
          <MuSection title="Flags" padded={false}>
            <div className="divide-y divide-line-soft">
              {openFlags.map((flag) => (
                <MuRow
                  key={flag.id}
                  title={flag.kind.replace(/_/g, " ")}
                  state={flag.detail ?? undefined}
                  status={
                     <Status
                       label={flag.severity === "urgent" ? "Today" : "Review"}
                       tone={careFlagTone(flag.severity)}
                       icon={ShieldAlert}
                     />
                  }
                  action={
                    <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => clearFlag(flag)}>
                      Clear
                    </Button>
                  }
                />
              ))}
            </div>
          </MuSection>
        )}

        {tab === "overview" && <PossibleDuplicates clientId={String(id)} />}
        {tab === "overview" && (
          <HomeSection
            clientId={String(id)}
            clientName={String(client.full_name ?? "")}
            home={home}
            canEdit={isCoordinator}
            onChanged={() => { void load(); }}
          />
        )}
        {tab === "overview" && <LinkedPeople clientId={String(id)} />}

        {tab === "group" && (
          <GroupSection clientId={String(id)} canEdit={isCoordinator} onChanged={() => { void load(); }} />
        )}

        {tab === "work" && <WorkSection clientId={String(id)} onChanged={() => { void load(); }} />}


        {tab === "assessment" && (
          <AssessmentSection
            clientId={String(id)}
            canArrange={isCoordinator}
            preAssessmentReturned={![
              "enquiry", "awaiting_pre_assessment", "pre_assessment_sent", "callback_due",
            ].includes(stage)}
            onChanged={() => { void load(); }}
          />
        )}

        {tab === "clinical-review" && (
          <ClinicalReviewSection
            clientId={String(id)}
            canReview={isClinical}
            onChanged={() => { void load(); }}
          />
        )}

        {tab === "care-plan" && (
          <CarePlanSection
            clientId={String(id)}
            canWrite={isClinical}
            canApprove={isClinical || isCoordinator}
            onChanged={() => { void load(); }}
          />
        )}

        {tab === "proposal" && (
          <CareProposalSection
            clientId={String(id)}
            canPrepare={isCoordinator}
            onChanged={() => { void load(); }}
          />
        )}

        {tab === "overview" && (
          <MuSection title="Client">
            <MuTable
              rows={[
                { label: "Reference", value: reference },
                { label: "Full name", value: String(client.full_name ?? "") },
                { label: "Preferred name", value: (client.preferred_name as string | null) ?? "" },
                { label: "Service", value: service?.name ?? "" },
                { label: "Client group", value: (client.client_group as string | null) ?? "" },
                { label: "Date of birth", value: (client.date_of_birth as string | null) ?? "" },
                { label: "Age", value: ageText(client.date_of_birth as string | null, client.date_of_birth_is_estimated as boolean | null) },
                { label: "Sex", value: client.sex_code ? sexLabel(client.sex_code as string) : "" },
                { label: "Languages spoken", value: languageLabels(client.language_codes as string[] | null).join(", ") },
                {
                  label: "Language required for care",
                  value: languageLabels(client.care_language_codes as string[] | null).join(", "),
                },

                { label: "Area", value: area },
                { label: "Address", value: (client.address_line as string | null) ?? "" },
                { label: "Created", value: dateOf(client.created_at as string) ?? "" },
              ]}
              emptyLabel="Not answered"
            />
          </MuSection>
        )}

        {tab === "responses" && (
          <>
            {outstanding.length > 0 && (
              <MuSection title="Still unanswered">
                <ul className="flex flex-col gap-1.5">
                  {outstanding.map((item) => (
                    <li key={item.id} className="text-[14.5px] text-foreground">{item.record}</li>
                  ))}
                </ul>
              </MuSection>
            )}

            {!doc ? (
              <MuSection padded={false}>
                <MuEmpty art={art.objClipboard} title="Nothing answered yet" description="Send the pre-assessment link from the Pre-assessment link tab." />
              </MuSection>
            ) : (
              answerGroups.map((group) => {
                const visible = group.sections
                  .map((section) => ({
                    section,
                    fields: section.fields.filter((f) => fieldVisible(f, group.answers)),
                  }))
                  .filter((entry) => entry.fields.length > 0);
                if (visible.length === 0) return null;
                return (
                  <div key={group.key} className="flex flex-col gap-4">
                    {group.name && (
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">
                        {group.name}
                      </h3>
                    )}
                    {visible.map(({ section, fields }) => (
                      <MuSection
                        key={`${group.key}-${section.id}`}
                        title={section.title}
                        actions={
                          <CareEditButton
                            label="Correct answers"
                            onClick={() => openSectionEdit(section.id, fields, group.recipientId)}
                          />
                        }
                      >
                        <MuTable
                          emptyLabel="Not answered"
                          rows={fields.map((field) => {
                            const amendment = amendmentFor(scopedKey(group.recipientId, field.id));
                            const value = group.answers[field.id];
                            const answered = isAnswered(value);
                            return {
                              label: field.record,
                              value: (
                                <span className={cn(!answered && "text-muted-foreground")}>
                                  {readAnswer(field, value, bandLabels)}
                                </span>
                              ),
                              note: amendment
                                ? `What the family said stands. Corrected to ${readAnswer(field, amendment.corrected_value, bandLabels)} by ${amendment.amended_by_name ?? "an administrator"} on ${dateOf(amendment.created_at)}. Reason: ${amendment.reason}`
                                : undefined,
                            };
                          })}
                        />
                      </MuSection>
                    ))}
                  </div>
                );
              })

            )}
            {revisionEvents.length > 0 && (
              <MuSection title="Revision history" padded={false}>
                <div className="divide-y divide-line-soft">
                  {revisionEvents.map((event) => (
                    <MuRow key={event.id} title={event.event === "submitted" ? "Form submitted" : event.event === "reopened" ? "Form reopened" : event.event === "revision_submitted" ? "Changes submitted" : "Delivery retried"} state={<div className="space-y-1"><p>{`${event.actor_name ?? (event.actor_kind === "family" ? "Family" : "System")} on ${dateOf(event.created_at)}${event.reason ? `. Reason: ${event.reason}` : ""}`}</p>{event.changed_fields?.map((change) => <p key={`${event.id}-${change.field_id}`} className="text-foreground"><span className="font-semibold">{revisionFieldLabel(change.field_id)}:</span> {String(change.previous_value ?? "Not answered")} → {String(change.new_value ?? "Not answered")}</p>)}</div>} />
                  ))}
                </div>
              </MuSection>
            )}
          </>
        )}

        {tab === "contacts" && (
          <MuSection
            title="Contacts"
            actions={
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => setEditingContact({
                  id: "", person_id: null, full_name: "", first_name: "", last_name: "",
                  relationship: "", relationship_code: "",
                  relationship_other: "", phone: "", whatsapp: "", email: "",
                  is_primary: contacts.length === 0,
                })}

              >
                <Plus className="mr-2 h-4 w-4" /> Add contact
              </Button>
            }
            padded={false}
          >
            {contacts.length === 0 ? (
              <MuEmpty art={art.objPhoneChat} title="No contacts yet" description="Add the person we speak to about this client." />
            ) : (
              <div className="divide-y divide-line-soft">
                {contacts.map((c) => (
                  <MuRow
                    key={c.id}
                    title={c.full_name}
                    state={
                      <span className="flex flex-col gap-0.5">
                        <span>
                          {(c.relationship_code
                            ? relationshipLabel(c.relationship_code, c.relationship_other)
                            : c.relationship) || "No relationship recorded"}
                        </span>
                        {c.phone && <span>{formatPhone(c.phone)}</span>}
                        {c.email && <span>{c.email}</span>}
                      </span>
                    }
                    status={c.is_primary ? <Status label="Main contact" tone="info" /> : undefined}
                    action={
                      <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setEditingContact(c)}>
                        Edit
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </MuSection>
        )}

        {tab === "link" && (
          <MuSection title="Pre-assessment link" description={`Links read ${reference}-XXXX.`}>
            {liveToken ? (
              <div className="flex flex-col gap-3">
                <MuTable
                  rows={[
                    { label: "Link", value: liveScope?.kind === "top_up" ? "Follow-up" : "Pre-assessment" },
                    {
                      label: "Sent to",
                      value: liveScope?.sent_to
                        ? `${liveScope.sent_to.full_name}${liveScope.sent_to.relationship ? `, ${liveScope.sent_to.relationship}` : ""}`
                        : primary?.full_name ?? "The main contact",
                    },
                    ...(liveScope && liveScope.covers.length > 0 ? [{ label: "Covers", value: liveScope.covers.join(", ") }] : []),
                    { label: "Expires", value: dateOf(liveToken.expires_at) },
                    { label: "Opened", value: liveToken.first_opened_at ? "Yes" : "Not yet" },
                    ...(liveScope?.gives_portal_access ? [{ label: "Portal", value: "Can follow the request once sent back" }] : []),
                  ]}
                />
                {link && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input readOnly value={link} className="min-w-0 flex-1 border border-line-soft bg-muted px-3 py-2 text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11"
                      onClick={() => { void navigator.clipboard.writeText(link); toast.success("Link copied"); }}
                    >
                      <Copy className="mr-2 h-4 w-4" /> Copy
                    </Button>
                    {primary?.whatsapp && (
                      <a
                        className="inline-flex h-11 items-center justify-center border border-line px-4 text-sm font-semibold"
                        href={whatsappHref(primary.whatsapp, `Here are the questions before your visit: ${link}`)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open WhatsApp
                      </a>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className="h-11" disabled={busy} onClick={() => sendLink("email")}>
                    <Mail className="mr-2 h-4 w-4" /> Email the link
                  </Button>
                  <Button type="button" variant="outline" className="h-11" disabled={busy}
                          onClick={() => sendLink("email", true)}>
                    Send again
                  </Button>
                  <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => sendLink("whatsapp")}>
                    <MessageCircle className="mr-2 h-4 w-4" /> Get link for WhatsApp
                  </Button>
                  <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={revokeLink}>
                    Withdraw link
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-[14.5px] text-foreground">
                  {primary
                    ? `No live link. It will be sent to ${primary.full_name}.`
                    : "No live link. Add a main contact on the Contacts tab first."}
                </p>
                <Button type="button" className="h-11 self-start" disabled={busy || !primary} onClick={createLink}>
                  Create link
                </Button>
              </div>
            )}
          </MuSection>
        )}

        {tab === "access" && (
          <AccessSection clientId={id!} canAdminister={isCoordinator} onChanged={() => void load()} />
        )}

        {tab === "commercial" && isCoordinator && (
          <>
          <MuSection title="Commercial details" description="Coordinators only. Not shown on the pre-assessment or to clinical reviewers.">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Budget band"
                value={String(commercial?.budget_band_id ?? "")}
                placeholder="Not set"
                onChange={(v) => { if (v) saveCommercial({ budget_band_id: v }); }}
                options={bands.map((b) => ({ value: b.id, label: b.label }))}
              />
              <SelectField
                label="Assessment fee"
                value={String(commercial?.assessment_fee_state ?? "unpaid")}
                onChange={(v) => { if (v) saveCommercial({ assessment_fee_state: v }); }}
                options={["unpaid", "paid", "waived"].map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
              />
            </div>
          </MuSection>
          <PayersSection clientId={String(id)} />
          <CareFinanceSection clientId={String(id)} contacts={contacts} />
          </>
        )}

        {tab === "activity" && (
          <MuSection title="Activity" padded={false}>
            {activity.length === 0 ? (
              <MuEmpty art={art.objClipboardChecks} title="No activity yet" description="Anything done on this record is listed here." />
            ) : (
              <div className="divide-y divide-line-soft">
                {activity.map((a) => (
                  <MuRow
                    key={a.id}
                    title={a.action.replace(/_/g, " ")}
                    state={`${a.actor_name ?? "System"} on ${dateOf(a.created_at)}`}
                  />
                ))}
              </div>
            )}
          </MuSection>
        )}
      </div>
      </MuRecordNav>

      {/* ---------- edit client ---------- */}
      <CareSheet
        open={editingClient}
        onOpenChange={setEditingClient}
        title="Edit client"
        description="What we hold about the person receiving care."
        onSave={saveClient}
      >
        {home && home.housemates.length > 0 && (
          <div className="border-2 border-navy bg-tint/40 p-3">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-label">Shared address</p>
            <p className="mt-1 text-[13.5px] text-body">
              A new address also applies to {home.housemates.map((m) => m.full_name).join(", ")}. If only this client moved, use Lives somewhere else first.
            </p>
          </div>
        )}
        {[
          { key: "first_name", label: "First name" },
          { key: "last_name", label: "Last name" },
          { key: "preferred_name", label: "Preferred name" },
          { key: "address_line", label: "Address" },
        ].map((f) => (
          <CareFormRow key={f.key} label={f.label}>
            <input
              className={cxInputClass()}
              value={clientDraft[f.key] ?? ""}
              onChange={(e) => setClientDraft((p) => ({ ...p, [f.key]: e.target.value }))}
            />
          </CareFormRow>
        ))}
        <DateField
          label="Date of birth"
          value={clientDraft.date_of_birth ?? ""}
          onChange={(v) => setClientDraft((p) => ({ ...p, date_of_birth: v }))}
          help="Age is worked out from this."
        />
        <label className="flex items-center gap-2 text-[13.5px] text-body">
          <Checkbox
            checked={clientDraft.date_of_birth_is_estimated === "yes"}
            onCheckedChange={(v) =>
              setClientDraft((p) => ({ ...p, date_of_birth_is_estimated: v === true ? "yes" : "" }))
            }
          />
          This date is an estimate
        </label>
        <SearchableSelect
          label="Sex"
          value={clientDraft.sex_code ?? ""}
          onChange={(v) => setClientDraft((p) => ({ ...p, sex_code: v }))}
          options={SEX_TERMS.map((t) => ({ value: t.code, label: t.label }))}
        />
        <SearchableSelect
          label="State"
          value={clientDraft.state_code ?? ""}
          onChange={(v) => setClientDraft((p) => ({ ...p, state_code: v, lga_code: "" }))}
          options={STATE_TERMS.map((t) => ({ value: t.code, label: t.label }))}
        />
        <SearchableSelect
          label="Local government area"
          value={clientDraft.lga_code ?? ""}
          onChange={(v) => setClientDraft((p) => ({ ...p, lga_code: v }))}
          options={lgaTerms(clientDraft.state_code ?? "").map((t) => ({ value: t.code, label: t.label }))}
          disabled={!clientDraft.state_code}
          disabledReason="Choose a state first"
        />
        <LanguageCodes
          label="Languages spoken"
          value={spokenDraft}
          onChange={setSpokenDraft}
        />
        <LanguageCodes
          label="Language required for care"
          help="What the care professional needs to speak."
          value={careLanguageDraft}
          onChange={setCareLanguageDraft}
        />
      </CareSheet>

      {/* ---------- edit contact ---------- */}
      <CareSheet
        open={!!editingContact}
        onOpenChange={(open) => !open && setEditingContact(null)}
        title={editingContact?.id ? "Edit contact" : "Add contact"}
        description="The person we speak to about this client."
        onSave={saveContact}
        saveLabel="Save contact"
      >
        {editingContact && (
          <>
            {([
              { key: "first_name", label: "First name" },
              { key: "last_name", label: "Last name" },
              { key: "email", label: "Email" },
            ] as const).map((f) => (
              <CareFormRow key={f.key} label={f.label}>
                <input
                  className={cxInputClass()}
                  value={editingContact[f.key] ?? ""}
                  onChange={(e) => setEditingContact({ ...editingContact, [f.key]: e.target.value })}
                />
              </CareFormRow>
            ))}
            <SearchableSelect
              label="This contact is the client's"
              value={editingContact.relationship_code ?? ""}
              onChange={(v) => setEditingContact({ ...editingContact, relationship_code: v })}
              options={[
                ...(editingContact.relationship_code === "self" ? [{ value: "self", label: "Self" }] : []),
                ...RELATIONSHIP_TERMS.map((t) => ({ value: t.code, label: t.label })),
              ]}
            />
            {editingContact.relationship_code === "other" && (
              <CareFormRow label="Relationship, in their words">
                <input
                  className={cxInputClass()}
                  value={editingContact.relationship_other ?? ""}
                  onChange={(e) => setEditingContact({ ...editingContact, relationship_other: e.target.value })}
                />
              </CareFormRow>
            )}
            {([
              { key: "phone", label: "Phone" },
              { key: "whatsapp", label: "WhatsApp" },
            ] as const).map((f) => (
              <PhoneField
                key={f.key}
                label={f.label}
                value={editingContact[f.key] ?? ""}
                onChange={({ e164, raw }) =>
                  setEditingContact({ ...editingContact, [f.key]: e164 ?? raw })
                }
              />
            ))}
            <label className="flex items-center gap-2 text-[14px] text-ink">
              <Checkbox
                checked={editingContact.is_primary}
                onCheckedChange={(v) => setEditingContact({ ...editingContact, is_primary: v === true })}
              />
              Main contact
            </label>
          </>
        )}
      </CareSheet>

      {/* ---------- correct a section of answers ---------- */}
      <CareSheet
        open={!!amendSection}
        onOpenChange={(open) => !open && setAmendSection(null)}
        title={amendSection ? `Correct ${amendSection.title.toLowerCase()}` : "Correct answers"}
        description="What the family answered stays on the record. Your corrections sit beside it with your reason."
        onSave={saveSectionAmendment}
        saveLabel="Record corrections"
        saving={saving}
        saveDisabled={!amendReason.trim()}
      >
        {amendSection?.fields.map((field) => (
          <CareFormRow key={field.id} label={field.record} help={field.help ?? undefined}>
            <CareFieldInput
              field={field}
              value={amendValues[field.id]}
              options={field.type === "budget_band" ? bandOptions : field.options ?? []}
              onChange={(value) => setAmendValues((p) => ({ ...p, [field.id]: value as never }))}
            />
          </CareFormRow>
        ))}
        <CareFormRow label="Reason" help="Recorded with your name against every field you changed.">
          <textarea
            className={cn(cxInputClass(), "min-h-[96px]")}
            value={amendReason}
            onChange={(e) => setAmendReason(e.target.value)}
            placeholder="For example, confirmed on the phone with the daughter"
          />
        </CareFormRow>
      </CareSheet>

    </MuPage>
  );
};

export default ClientRecord;
