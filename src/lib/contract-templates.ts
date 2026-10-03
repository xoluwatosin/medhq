// Contract templates and the annex library.
//
// A role you hire several people into is one contract written once. The
// template holds the wording, the terms that are the same for everybody, and
// the annex set the role carries. Each person's contract is still their own
// record: the template seeds it, the person's own values override it, and what
// they sign is frozen on their contract alone.
import { supabase } from "@/integrations/supabase/client";
import type { ContractAnnex, ContractClause, ContractFields } from "@/lib/contracts";
import { createContractFromLibrary, loadClauseLibrary, saveContractDraft } from "@/lib/contracts";
import { ANNEX_PACK } from "@/lib/contract-annex-pack.generated";

const db = () => supabase as any;
const ANNEX_LIBRARY_SETTING_KEY = "contract_annex_library";
const TEMPLATE_SETTING_KEY = "contract_templates";

/** How a template treats a field when a contract is drafted from it. */
export type FieldRule = "fixed" | "prefill" | "ask";

export const FIELD_RULE_LABELS: Record<FieldRule, string> = {
  fixed: "Same for everybody",
  prefill: "Suggested, editable per person",
  ask: "Ask each time",
};

export interface AnnexLibraryItem {
  id: string;
  code: string;
  title: string;
  kind: "document" | "file";
  body: string;
  note: string | null;
  file_path: string | null;
  file_name: string | null;
  requires_signature: boolean;
  clinical_only: boolean;
  sort_order: number;
  active: boolean;
  updated_at?: string;
}

const defaultAnnexLibrary = (): AnnexLibraryItem[] => [
  { id: "annex-a", code: "Annex A", title: "Job description", kind: "document", body: "", note: null, file_path: null, file_name: null, requires_signature: false, clinical_only: false, sort_order: 10, active: true },
  { id: "annex-b", code: "Annex B", title: "Code of conduct", kind: "document", body: "", note: null, file_path: null, file_name: null, requires_signature: true, clinical_only: false, sort_order: 20, active: true },
  { id: "annex-c", code: "Annex C", title: "Disciplinary and grievance procedure", kind: "document", body: "", note: null, file_path: null, file_name: null, requires_signature: false, clinical_only: false, sort_order: 30, active: true },
  { id: "annex-d", code: "Annex D", title: "Confidentiality undertaking", kind: "document", body: "", note: null, file_path: null, file_name: null, requires_signature: true, clinical_only: false, sort_order: 40, active: true },
  { id: "annex-e", code: "Annex E", title: "Data protection notice", kind: "document", body: "", note: null, file_path: null, file_name: null, requires_signature: false, clinical_only: false, sort_order: 50, active: true },
  { id: "annex-f", code: "Annex F", title: "Scope of practice, clinical roles only", kind: "document", body: "", note: null, file_path: null, file_name: null, requires_signature: false, clinical_only: true, sort_order: 60, active: true },
];

const isMissingAnnexTable = (error: unknown) => {
  const err = error as { code?: string; message?: string };
  return err.code === "PGRST205" || /mu_contract_annex_library|schema cache/i.test(err.message ?? "");
};

const isMissingTemplateTable = (error: unknown) => {
  const err = error as { code?: string; message?: string };
  return err.code === "PGRST205" || /mu_contract_templates|mu_contract_create_from_template|schema cache/i.test(err.message ?? "");
};

const normalizeAnnexItem = (item: Partial<AnnexLibraryItem>): AnnexLibraryItem => ({
  id: item.id || crypto.randomUUID(),
  code: item.code?.trim() || "Annex",
  title: item.title?.trim() || "Untitled annex",
  kind: item.kind === "file" ? "file" : "document",
  body: item.body ?? "",
  note: item.note ?? null,
  file_path: item.file_path ?? null,
  file_name: item.file_name ?? null,
  requires_signature: !!item.requires_signature,
  clinical_only: !!item.clinical_only,
  sort_order: item.sort_order ?? 0,
  active: item.active ?? true,
  updated_at: item.updated_at,
});

const sortAnnexes = (items: AnnexLibraryItem[]) =>
  [...items].sort((a, b) => (a.sort_order - b.sort_order) || a.code.localeCompare(b.code));

async function loadAnnexLibrarySetting(includeInactive = false): Promise<AnnexLibraryItem[]> {
  const { data, error } = await db()
    .from("admin_settings")
    .select("value")
    .eq("key", ANNEX_LIBRARY_SETTING_KEY)
    .maybeSingle();
  if (error) throw error;

  const rawItems = Array.isArray(data?.value) ? data.value : defaultAnnexLibrary();
  const items = sortAnnexes(rawItems.map((item: Partial<AnnexLibraryItem>) => normalizeAnnexItem(item)));
  return includeInactive ? items : items.filter((item) => item.active);
}

async function saveAnnexLibrarySetting(items: AnnexLibraryItem[]) {
  const next = sortAnnexes(items).map((item) => ({ ...item, updated_at: new Date().toISOString() }));
  await upsertAdminSetting(ANNEX_LIBRARY_SETTING_KEY, next);
}

async function upsertAdminSetting(key: string, value: unknown) {
  const payload = { key, value, updated_at: new Date().toISOString() };
  const { error } = await db().from("admin_settings").upsert(payload, { onConflict: "key" });
  if (!error) return;
  const { error: updateError } = await db()
    .from("admin_settings")
    .update({ value, updated_at: payload.updated_at })
    .eq("key", key);
  if (updateError) throw updateError;
}

export interface ContractTemplate {
  id: string;
  name: string;
  description: string | null;
  contract_type: string;
  job_title: string | null;
  department: string | null;
  is_clinical: boolean;
  fields: ContractFields;
  field_rules: Record<string, FieldRule>;
  clauses: ContractClause[];
  annexes: ContractAnnex[];
  active: boolean;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

const normalizeTemplate = (item: Partial<ContractTemplate>): ContractTemplate => ({
  id: item.id || crypto.randomUUID(),
  name: item.name?.trim() || "Untitled template",
  description: item.description ?? null,
  contract_type: item.contract_type || "full_time",
  job_title: item.job_title ?? null,
  department: item.department ?? null,
  is_clinical: !!item.is_clinical,
  fields: item.fields ?? {},
  field_rules: item.field_rules ?? {},
  clauses: item.clauses ?? [],
  annexes: item.annexes ?? [],
  active: item.active ?? true,
  created_by_name: item.created_by_name ?? null,
  created_at: item.created_at || new Date().toISOString(),
  updated_at: item.updated_at || new Date().toISOString(),
});

const sortTemplates = (items: ContractTemplate[]) =>
  [...items].sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));

async function loadTemplatesSetting(includeInactive = false): Promise<ContractTemplate[]> {
  const { data, error } = await db()
    .from("admin_settings")
    .select("value")
    .eq("key", TEMPLATE_SETTING_KEY)
    .maybeSingle();
  if (error) throw error;
  const rawItems = Array.isArray(data?.value) ? data.value : [];
  const items = sortTemplates(rawItems.map((item: Partial<ContractTemplate>) => normalizeTemplate(item)));
  return includeInactive ? items : items.filter((item) => item.active);
}

async function saveTemplatesSetting(items: ContractTemplate[]) {
  await upsertAdminSetting(TEMPLATE_SETTING_KEY, sortTemplates(items).map((item) => ({ ...item, updated_at: new Date().toISOString() })));
}

/* ---------------------------------------------------------------- annexes */

export async function loadAnnexLibrary(includeInactive = false): Promise<AnnexLibraryItem[]> {
  let q = db().from("mu_contract_annex_library").select("*").order("sort_order");
  if (!includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) {
    if (isMissingAnnexTable(error)) return loadAnnexLibrarySetting(includeInactive);
    throw error;
  }
  return (data ?? []) as AnnexLibraryItem[];
}

export async function saveAnnexItem(id: string, patch: Partial<AnnexLibraryItem>) {
  const { error } = await db().from("mu_contract_annex_library").update(patch).eq("id", id);
  if (!error) return;
  if (!isMissingAnnexTable(error)) throw error;

  const items = await loadAnnexLibrarySetting(true);
  const next = items.map((item) => (item.id === id ? normalizeAnnexItem({ ...item, ...patch, id }) : item));
  await saveAnnexLibrarySetting(next);
}

export async function createAnnexItem(item: Partial<AnnexLibraryItem>) {
  const { data, error } = await db()
    .from("mu_contract_annex_library")
    .insert(item)
    .select("id")
    .maybeSingle();
  if (!error) return data?.id as string;
  if (!isMissingAnnexTable(error)) throw error;

  const items = await loadAnnexLibrarySetting(true);
  const next = normalizeAnnexItem({ ...item, id: crypto.randomUUID() });
  await saveAnnexLibrarySetting([...items, next]);
  return next.id;
}

export async function deleteAnnexItem(id: string) {
  const { error } = await db().from("mu_contract_annex_library").delete().eq("id", id);
  if (!error) return;
  if (!isMissingAnnexTable(error)) throw error;

  const items = await loadAnnexLibrarySetting(true);
  await saveAnnexLibrarySetting(items.filter((item) => item.id !== id));
}

/**
 * Load the employee pack wording into the library.
 *
 * Matching is by code, so running it twice replaces the pack wording rather
 * than adding a second copy. Contracts already issued keep their frozen pack.
 */
export async function installAnnexPack(): Promise<{ updated: number; created: number }> {
  const existing = await loadAnnexLibrary(true);
  let updated = 0;
  let created = 0;

  for (const item of ANNEX_PACK) {
    const match = existing.find((row) => row.code.toLowerCase() === item.code.toLowerCase());
    const patch = {
      code: item.code,
      title: item.title,
      kind: "document" as const,
      body: item.body,
      note: item.note || null,
      requires_signature: item.requires_signature,
      clinical_only: item.clinical_only,
      sort_order: item.sort_order,
      active: true,
    };
    if (match) {
      await saveAnnexItem(match.id, patch);
      updated += 1;
    } else {
      await createAnnexItem(patch);
      created += 1;
    }
  }

  return { updated, created };
}


/** A reusable file, kept beside the other contract paperwork. */
export async function uploadLibraryFile(code: string, file: File) {
  const safe = file.name.replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-");
  const path = `contract-library/${code.replace(/\s+/g, "-").toLowerCase()}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("applications").upload(path, file, { upsert: false });
  if (error) throw error;
  return { path, name: file.name };
}

/** The library item as it travels onto a contract. */
export function annexFromLibrary(item: AnnexLibraryItem): ContractAnnex {
  return {
    code: item.code,
    title: item.title,
    include: true,
    clinical_only: item.clinical_only,
    requires_signature: item.requires_signature,
    note: item.note || undefined,
    body: item.kind === "document" ? item.body : undefined,
    attachment_path: item.file_path || undefined,
    attachment_name: item.file_name || undefined,
    library_code: item.code,
  };
}

/* -------------------------------------------------------------- templates */

export async function loadTemplates(includeInactive = false): Promise<ContractTemplate[]> {
  let q = db().from("mu_contract_templates").select("*").order("updated_at", { ascending: false });
  if (!includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) {
    if (isMissingTemplateTable(error)) return loadTemplatesSetting(includeInactive);
    throw error;
  }
  return (data ?? []) as ContractTemplate[];
}

export async function loadTemplate(id: string): Promise<ContractTemplate> {
  const { data, error } = await db().from("mu_contract_templates").select("*").eq("id", id).maybeSingle();
  if (error) {
    if (isMissingTemplateTable(error)) {
      const item = (await loadTemplatesSetting(true)).find((template) => template.id === id);
      if (!item) throw new Error("Template not found");
      return item;
    }
    throw error;
  }
  if (!data) throw new Error("Template not found");
  return data as ContractTemplate;
}

/** A new template starts from the live clause library and the annex library. */
export async function createTemplate(name: string, createdByName?: string | null) {
  const [clauses, annexItems] = await Promise.all([loadClauseLibrary(), loadAnnexLibrary()]);
  const { data, error } = await db()
    .from("mu_contract_templates")
    .insert({
      name,
      clauses,
      annexes: annexItems.map(annexFromLibrary),
      created_by_name: createdByName ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (!isMissingTemplateTable(error)) throw error;
    const items = await loadTemplatesSetting(true);
    const next = normalizeTemplate({
      name,
      clauses,
      annexes: annexItems.map(annexFromLibrary),
      created_by_name: createdByName ?? null,
    });
    await saveTemplatesSetting([...items, next]);
    return next.id;
  }
  return data?.id as string;
}

export async function saveTemplate(id: string, patch: Partial<ContractTemplate>) {
  const { error } = await db().from("mu_contract_templates").update(patch).eq("id", id);
  if (!error) return;
  if (!isMissingTemplateTable(error)) throw error;

  const items = await loadTemplatesSetting(true);
  const next = items.map((item) => (item.id === id ? normalizeTemplate({ ...item, ...patch, id }) : item));
  await saveTemplatesSetting(next);
}

export async function deleteTemplate(id: string) {
  const { error } = await db().from("mu_contract_templates").delete().eq("id", id);
  if (!error) return;
  if (!isMissingTemplateTable(error)) throw error;

  const items = await loadTemplatesSetting(true);
  await saveTemplatesSetting(items.filter((item) => item.id !== id));
}

/* ---------------------------------------------------------- drafting from */

export async function createContractFromTemplate(
  personId: string,
  templateId: string,
  payload: Record<string, unknown>,
) {
  const { data, error } = await db().rpc("mu_contract_create_from_template", {
    _person_id: personId,
    _template_id: templateId,
    _payload: payload,
  });
  if (error) {
    if (!isMissingTemplateTable(error)) throw error;
    const template = await loadTemplate(templateId);
    const fields = { ...(template.fields || {}), ...((payload.fields as ContractFields | undefined) || {}) };
    const contractId = await createContractFromLibrary(personId, {
      ...payload,
      fields,
      contract_type: payload.contract_type || template.contract_type,
      job_title: payload.job_title || template.job_title || fields.job_title,
      department: payload.department || template.department,
      is_clinical: payload.is_clinical ?? template.is_clinical,
      notice_period: payload.notice_period || fields.notice_period,
      location: payload.location || fields.primary_place_of_work,
    });
    await saveContractDraft(contractId, {
      fields,
      clauses: template.clauses || [],
      annexes: template.annexes || [],
      is_clinical: payload.is_clinical ?? template.is_clinical,
      job_title: payload.job_title || template.job_title || fields.job_title,
      notice_period: payload.notice_period || fields.notice_period,
      location: payload.location || fields.primary_place_of_work,
      actor_name: payload.created_by_name,
      change_note: `Template applied: ${template.name}`,
    });
    return contractId;
  }
  return data as string;
}

/** The fields a person must answer before their contract can be issued. */
export function askedFields(template: ContractTemplate): string[] {
  return Object.entries(template.field_rules || {})
    .filter(([, rule]) => rule === "ask")
    .map(([key]) => key);
}

export interface CandidateRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  profession: string | null;
  city: string | null;
}

/** People to issue to: those who took an offer first, then anyone searched for. */
export async function loadAcceptedCandidates(): Promise<CandidateRow[]> {
  const { data, error } = await db()
    .from("mu_offers")
    .select("person_id, title, status, mu_people!inner(id, full_name, email, phone, profession, city)")
    .eq("status", "accepted")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const seen = new Set<string>();
  const rows: CandidateRow[] = [];
  for (const r of (data ?? []) as any[]) {
    const p = r.mu_people;
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    rows.push(p as CandidateRow);
  }
  return rows;
}

export async function searchCandidates(term: string): Promise<CandidateRow[]> {
  const t = term.trim();
  if (t.length < 2) return [];
  const { data, error } = await db()
    .from("mu_people")
    .select("id, full_name, email, phone, profession, city")
    .or(`full_name.ilike.%${t}%,email.ilike.%${t}%`)
    .limit(20);
  if (error) throw error;
  return (data ?? []) as CandidateRow[];
}
