// The enquiry desk, in one place.
//
// A person asking about care answers a short set of questions: the ones every
// enquiry needs, then the ones this service line needs. What they answer is
// kept as data, not prose, so the desk can read it and the reply can be
// tailored without anyone retyping it.

import { supabase } from "@/integrations/supabase/client";

const db = () => supabase as any;

export type QuestionType = "choice" | "multi" | "text" | "textarea";

export interface ServiceLine {
  id: string;
  key: string;
  name: string;
  blurb: string;
  segment: string;
  route: string | null;
  brochure_path: string | null;
  brochure_name: string | null;
  brochure_updated_at: string | null;
  reply_subject: string;
  reply_intro: string;
  reply_outro: string;
  sort_order: number;
  active: boolean;
}

export interface EnquiryQuestion {
  id: string;
  service_line_id: string | null;
  field_key: string;
  label: string;
  help: string;
  input_type: QuestionType;
  options: string[];
  required: boolean;
  sort_order: number;
  active: boolean;
}

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  service: string | null;
  service_line: string | null;
  message: string | null;
  answers: Record<string, string | string[]>;
  source: string;
  status: string;
  stage: string;
  owner: string | null;
  city: string | null;
  consent_email: boolean;
  last_sent_at: string | null;
  replied_at: string | null;
  archived: boolean;
  created_at: string;
}

export interface EnquirySend {
  id: string;
  enquiry_id: string | null;
  email: string;
  service_line: string | null;
  kind: string;
  subject: string;
  brochure_name: string | null;
  status: string;
  error: string | null;
  actor: string | null;
  sent_at: string;
}

export const ENQUIRY_STAGES: { key: string; label: string; note: string }[] = [
  { key: "new", label: "New", note: "Nobody has spoken to them yet." },
  { key: "contacted", label: "Contacted", note: "We have replied and are waiting on them." },
  { key: "assessment_booked", label: "Assessment booked", note: "A care needs assessment is in the diary." },
  { key: "assessment_done", label: "Assessment completed", note: "Assessed, waiting on a care plan or a price." },
  { key: "proposal_sent", label: "Proposal sent", note: "They have the plan and the price." },
  { key: "won", label: "Care started", note: "They became a client." },
  { key: "closed", label: "Closed", note: "Not going ahead, or gone quiet." },
];

export const stageLabel = (key: string) =>
  ENQUIRY_STAGES.find((s) => s.key === key)?.label ?? key;

export const SEGMENTS: { key: string; label: string }[] = [
  { key: "care", label: "Care at home" },
  { key: "facility", label: "For facilities" },
  { key: "other", label: "Something else" },
];

/* ------------------------------------------------------------------ reading */

export async function loadServiceLines(includeHidden = false): Promise<ServiceLine[]> {
  let q = db().from("enquiry_service_lines").select("*").order("sort_order");
  if (!includeHidden) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ServiceLine[];
}

export async function loadQuestions(includeHidden = false): Promise<EnquiryQuestion[]> {
  let q = db().from("enquiry_questions").select("*").order("sort_order");
  if (!includeHidden) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    options: Array.isArray(r.options) ? r.options : [],
  })) as EnquiryQuestion[];
}

/** The questions asked of everybody, then the ones this line adds. */
export function questionsFor(all: EnquiryQuestion[], lineId: string | null): EnquiryQuestion[] {
  return all
    .filter((q) => q.service_line_id === null || (lineId && q.service_line_id === lineId))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function loadEnquiries(includeArchived = false): Promise<Enquiry[]> {
  let q = db().from("contact_submissions").select("*").order("created_at", { ascending: false });
  if (!includeArchived) q = q.eq("archived", false);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    answers: r.answers && typeof r.answers === "object" ? r.answers : {},
  })) as Enquiry[];
}

export async function loadSends(enquiryId: string): Promise<EnquirySend[]> {
  const { data, error } = await db()
    .from("enquiry_sends")
    .select("*")
    .eq("enquiry_id", enquiryId)
    .order("sent_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EnquirySend[];
}

/* ------------------------------------------------------------------ writing */

export interface CareRequestPayload {
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  city: string;
  serviceLineKey: string;
  serviceLineName: string;
  message: string;
  answers: Record<string, string | string[]>;
  consentEmail: boolean;
  source: string;
}

export async function submitCareRequest(p: CareRequestPayload): Promise<string> {
  // The public may insert but may not read this table, so an INSERT ... RETURNING
  // (what PostgREST issues when .select() is chained) would be refused. We mint
  // the id here instead and insert it explicitly.
  const id = crypto.randomUUID();
  const { error } = await db()
    .from("contact_submissions")
    .insert({
      id,
      name: p.name.trim(),
      first_name: p.firstName?.trim() || null,
      last_name: p.lastName?.trim() || null,
      email: p.email.trim().toLowerCase() || null,
      phone: p.phone.trim(),
      city: p.city.trim() || null,
      service: p.serviceLineName,
      service_line: p.serviceLineKey,
      message: p.message.trim(),
      answers: p.answers,
      consent_email: p.consentEmail,
      source: p.source,
    });
  if (error) throw error;
  return id;
}

/** Send, or resend, the tailored reply with the service line's brochure. */
export async function sendEnquiryReply(enquiryId: string, force = false) {
  const { data, error } = await supabase.functions.invoke("send-enquiry-reply", {
    body: { enquiry_id: enquiryId, force },
  });
  if (error) throw error;
  return data as { ok: boolean; skipped?: string; brochure?: string | null };
}

export async function setEnquiryStage(id: string, stage: string) {
  const patch: Record<string, unknown> = { stage };
  if (stage !== "new") patch.status = "read";
  const { error } = await db().from("contact_submissions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setEnquiryOwner(id: string, owner: string | null) {
  const { error } = await db().from("contact_submissions").update({ owner }).eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------- service line admin */

export async function saveServiceLine(line: Partial<ServiceLine> & { key: string; name: string }) {
  const { error } = await db()
    .from("enquiry_service_lines")
    .upsert({ ...line, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

export async function saveQuestion(q: Partial<EnquiryQuestion>) {
  const row = { ...q, updated_at: new Date().toISOString() };
  const { error } = await db().from("enquiry_questions").upsert(row);
  if (error) throw error;
}

export async function deleteQuestion(id: string) {
  const { error } = await db().from("enquiry_questions").delete().eq("id", id);
  if (error) throw error;
}

/** Brochures live beside every other private file, under a brochures prefix. */
export async function uploadBrochure(lineKey: string, file: File): Promise<{ path: string; name: string }> {
  const path = `brochures/${lineKey}-${Date.now()}.pdf`;
  const { error } = await supabase.storage
    .from("applications")
    .upload(path, file, { contentType: file.type || "application/pdf", upsert: true });
  if (error) throw error;
  const { error: upErr } = await db()
    .from("enquiry_service_lines")
    .update({
      brochure_path: path,
      brochure_name: file.name,
      brochure_updated_at: new Date().toISOString(),
    })
    .eq("key", lineKey);
  if (upErr) throw upErr;
  return { path, name: file.name };
}

export async function brochureLink(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("applications").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
