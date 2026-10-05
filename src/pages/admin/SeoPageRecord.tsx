import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MuEmpty, MuPageHeader, MuSection } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import ConsoleRecordCard from "@/components/admin/console/ConsoleRecordCard";
import { SelectField, Status } from "@/components/field";
import { adminDb } from "@/lib/admin-utils";
import { formatDate } from "@/lib/format";
import {
  EVIDENCE_STATES, INDEX_STATES, PAGE_TYPE_LABELS, PUBLICATION_STATES,
  PRICING_EVIDENCE_MISSING, claimEffectiveState, claimTone, evidenceTone, indexTone, label,
  publicationTone, reviewTone, marketTone,
} from "@/lib/seo-registry";

interface PageRecord {
  id: string;
  page_key: string;
  path: string;
  page_type: string;
  estate: string;
  audience: string[] | null;
  search_intent: string | null;
  primary_query: string | null;
  secondary_queries: string[] | null;
  title: string | null;
  h1: string | null;
  meta_description: string | null;
  page_promise: string | null;
  canonical_path: string | null;
  schema_types: string[] | null;
  priority: number | null;
  index_state: string;
  publication_state: string;
  evidence_state: string;
  clinical_requirement: string | null;
  clinical_reviewed_at: string | null;
  clinical_reviewed_by: string | null;
  factual_reviewed_at: string | null;
  last_published_at: string | null;
  notes: string | null;
  updated_at: string;
  seo_page_services: Array<{ id: string; relationship: string; services: { name: string; slug: string } | null }>;
  seo_page_modules: Array<{ id: string; section_key: string; required: boolean; sort_order: number; seo_modules: { module_code: string; name: string; review_state: string } | null }>;
  seo_page_claims: Array<{ id: string; usage_key: string; required: boolean; seo_claims: { claim_code: string; claim_text: string; state: string; valid_from: string | null; valid_until: string | null } | null }>;
  seo_page_markets: Array<{ id: string; is_primary: boolean; local_evidence: Record<string, unknown>; seo_markets: { market_key: string; market_state: string; safety_state: string } | null }>;
  seo_fee_refs: Array<{ id: string; usage_key: string; service_fees: { label: string; amount_naira: number; state: string } | null }>;
}

const SELECT = `
  id, page_key, path, page_type, estate, audience, search_intent, primary_query, secondary_queries,
  title, h1, meta_description, page_promise, canonical_path, schema_types, priority,
  index_state, publication_state, evidence_state, clinical_requirement, clinical_reviewed_at,
  clinical_reviewed_by, factual_reviewed_at, last_published_at, notes, updated_at,
  seo_page_services(id, relationship, services(name, slug)),
  seo_page_modules(id, section_key, required, sort_order, seo_modules(module_code, name, review_state)),
  seo_page_claims(id, usage_key, required, seo_claims(claim_code, claim_text, state, valid_from, valid_until)),
  seo_page_markets(id, is_primary, local_evidence, seo_markets(market_key, market_state, safety_state)),
  seo_fee_refs(id, usage_key, service_fees(label, amount_naira, state))
`;

const SeoPageRecord = () => {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState<PageRecord | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState({
    title: "", h1: "", meta_description: "", page_promise: "", primary_query: "",
    canonical_path: "", notes: "", publication_state: "planned", evidence_state: "missing",
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await adminDb().from("seo_pages").select(SELECT).eq("id", id).maybeSingle();
    setLoadError(Boolean(error));
    if (error || !data) {
      toast.error("Could not load the page record");
      setLoading(false);
      return;
    }
    const record = data as PageRecord;
    setPage(record);
    setForm({
      title: record.title ?? "",
      h1: record.h1 ?? "",
      meta_description: record.meta_description ?? "",
      page_promise: record.page_promise ?? "",
      primary_query: record.primary_query ?? "",
      canonical_path: record.canonical_path ?? "",
      notes: record.notes ?? "",
      publication_state: record.publication_state,
      evidence_state: record.evidence_state,
    });
    const { data: gate } = await adminDb().rpc("seo_page_blockers", { p_page_id: id });
    setBlockers((gate ?? []) as string[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!page) return;
    setSaving(true);
    const { error } = await adminDb().rpc("seo_page_save", {
      p_page_id: page.id,
      p_patch: {
        title: form.title || null,
        h1: form.h1 || null,
        meta_description: form.meta_description || null,
        page_promise: form.page_promise || null,
        primary_query: form.primary_query || null,
        canonical_path: form.canonical_path || null,
        notes: form.notes || null,
        publication_state: form.publication_state,
        evidence_state: form.evidence_state,
      },
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Changes saved");
    setEditing(false);
    void load();
  };

  const setIndexState = async (state: string) => {
    if (!page) return;
    const { data, error } = await adminDb().rpc("seo_page_set_index_state", { p_page_id: page.id, p_state: state });
    if (error) {
      toast.error(error.message);
      return;
    }
    const returned = (data ?? []) as string[];
    if (returned.length > 0) {
      setBlockers(returned);
      toast.error(`Cannot index this page: ${returned.join("; ")}`);
      return;
    }
    toast.success("Index state updated");
    void load();
  };

  const pricing = useMemo(() => {
    const refs = (page?.seo_fee_refs ?? []).filter((ref) => ref.service_fees);
    return refs.length === 0 ? null : refs;
  }, [page]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!page) {
    return (
      <section className="mx-auto w-full max-w-[1120px] space-y-6">
        <MuPageHeader title="SEO page" backTo="/admin/seo/pages" backLabel="SEO pages" />
        <MuSection padded={false}>
          {loadError ? (
            <MuEmpty
              title="Could not load the page record"
              description="The record did not load. Try again in a moment."
              action={<Button type="button" variant="outline" onClick={() => void load()}>Try again</Button>}
            />
          ) : (
            <MuEmpty art={art.objDocumentMagnifier} title="Page not found" description="This SEO page may have been removed. Go back to the register to find another." />
          )}
        </MuSection>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[1120px] space-y-4" aria-label={page.title ?? page.page_key}>
      <MuPageHeader
        title={page.title ?? page.page_key}
        description={page.path}
        backTo="/admin/seo/pages"
        backLabel="SEO pages"
        actions={
          <Button type="button" variant={editing ? "outline" : "default"} onClick={() => setEditing(!editing)} className="shrink-0">
            {editing ? "Cancel" : "Edit"}
          </Button>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Status label={label(page.publication_state)} tone={publicationTone(page.publication_state)} />
        <Status label={label(page.index_state)} tone={indexTone(page.index_state)} />
        <Status label={`${label(page.evidence_state)} evidence`} tone={evidenceTone(page.evidence_state)} />
      </div>

      {blockers.length > 0 && (
        <div className="border border-line-soft bg-warn-bg p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-warn-ink">
            <AlertTriangle className="h-4 w-4" aria-hidden /> This page cannot be indexed
          </p>
          <ul className="mt-2 space-y-1 text-sm text-warn-ink">
            {blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
          </ul>
        </div>
      )}

      {editing ? (
        <div className="space-y-3 border border-line-soft bg-card p-4">
          <div><Label htmlFor="page-title">Title</Label><Input id="page-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
          <div><Label htmlFor="page-h1">H1</Label><Input id="page-h1" value={form.h1} onChange={(event) => setForm({ ...form, h1: event.target.value })} /></div>
          <div><Label htmlFor="page-meta">Meta description</Label><Textarea id="page-meta" rows={3} value={form.meta_description} onChange={(event) => setForm({ ...form, meta_description: event.target.value })} /></div>
          <div><Label htmlFor="page-promise">Page promise</Label><Textarea id="page-promise" rows={2} value={form.page_promise} onChange={(event) => setForm({ ...form, page_promise: event.target.value })} /></div>
          <div><Label htmlFor="page-query">Primary query</Label><Input id="page-query" value={form.primary_query} onChange={(event) => setForm({ ...form, primary_query: event.target.value })} /></div>
          <div><Label htmlFor="page-canonical">Canonical path</Label><Input id="page-canonical" value={form.canonical_path} onChange={(event) => setForm({ ...form, canonical_path: event.target.value })} /></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField
              label="Publication"
              value={form.publication_state}
              onChange={(value) => { if (value) setForm({ ...form, publication_state: value }); }}
              options={PUBLICATION_STATES.map((value) => ({ value, label: label(value) }))}
            />
            <SelectField
              label="Evidence"
              value={form.evidence_state}
              onChange={(value) => { if (value) setForm({ ...form, evidence_state: value }); }}
              options={EVIDENCE_STATES.map((value) => ({ value, label: label(value) }))}
            />
          </div>
          <div><Label htmlFor="page-notes">Notes</Label><Textarea id="page-notes" rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
          <Button type="button" onClick={save} disabled={saving} className="w-full sm:w-auto">Save changes</Button>
        </div>
      ) : (
        <ConsoleRecordCard
          title="Search brief"
          fields={[
            { key: "type", label: "Page type", value: label(page.page_type, PAGE_TYPE_LABELS) },
            { key: "estate", label: "Estate", value: label(page.estate) },
            { key: "audience", label: "Audience", value: (page.audience ?? []).map((item) => label(item)).join(", ") || "Not recorded" },
            { key: "intent", label: "Search intent", value: label(page.search_intent) },
            { key: "query", label: "Primary query", value: page.primary_query ?? "Not recorded" },
            { key: "secondary", label: "Secondary queries", value: (page.secondary_queries ?? []).join(", ") || "None" },
            { key: "h1", label: "H1", value: page.h1 ?? "Not recorded" },
            { key: "promise", label: "Page promise", value: page.page_promise ?? "Not recorded", fullWidth: true },
            { key: "meta", label: "Meta description", value: page.meta_description ?? "Not recorded", fullWidth: true },
          ]}
        />
      )}

      <ConsoleRecordCard
        title="Publication"
        fields={[
          { key: "publication", label: "Publication", value: <Status label={label(page.publication_state)} tone={publicationTone(page.publication_state)} /> },
          { key: "evidence", label: "Evidence", value: <Status label={label(page.evidence_state)} tone={evidenceTone(page.evidence_state)} /> },
          { key: "priority", label: "Priority", value: page.priority ?? "Not set" },
          { key: "published", label: "Last published", value: page.last_published_at ? formatDate(page.last_published_at) : "Never" },
          {
            key: "index",
            label: "Index state",
            fullWidth: true,
            value: (
              <div className="flex flex-wrap items-center gap-2">
                <SelectField
                  label="Index state"
                  hideLabel
                  value={page.index_state}
                  onChange={(value) => { if (value) void setIndexState(value); }}
                  options={INDEX_STATES.map((value) => ({ value, label: label(value) }))}
                  className="w-full sm:w-56"
                />
                <span className="text-xs text-muted-copy">Validated by the database before a page becomes indexable.</span>
              </div>
            ),
          },
        ]}
      />

      <ConsoleRecordCard
        title="Linked services"
        subtitle="Service names and descriptions stay in the operational service catalogue."
        fields={
          page.seo_page_services.length === 0
            ? [{ key: "none", label: "Services", value: "No linked services", fullWidth: true }]
            : page.seo_page_services.map((link) => ({
                key: link.id,
                label: label(link.relationship),
                value: link.services?.name ?? "Service removed",
              }))
        }
      />

      <ConsoleRecordCard
        title="Modules"
        fields={
          page.seo_page_modules.length === 0
            ? [{ key: "none", label: "Modules", value: "No modules composed", fullWidth: true }]
            : page.seo_page_modules
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((link) => ({
                  key: link.id,
                  label: link.section_key,
                  value: (
                    <span className="flex flex-wrap items-center gap-2">
                      {link.seo_modules ? `${link.seo_modules.module_code} ${link.seo_modules.name}` : "Module removed"}
                      {link.seo_modules && <Status label={label(link.seo_modules.review_state)} tone={reviewTone(link.seo_modules.review_state)} />}
                      {link.required && <span className="text-xs text-muted-copy">Required</span>}
                    </span>
                  ),
                }))
        }
      />

      <ConsoleRecordCard
        title="Claims"
        fields={
          page.seo_page_claims.length === 0
            ? [{ key: "none", label: "Claims", value: "No claims attached", fullWidth: true }]
            : page.seo_page_claims.map((link) => {
                const claim = link.seo_claims;
                const state = claim ? claimEffectiveState(claim.state, claim.valid_from, claim.valid_until) : "retired";
                return {
                  key: link.id,
                  label: link.usage_key,
                  fullWidth: true,
                  value: (
                    <span className="flex flex-wrap items-center gap-2">
                      {claim?.claim_text ?? "Claim removed"}
                      <Status label={label(state)} tone={claimTone(state)} />
                      {link.required && <span className="text-xs text-muted-copy">Required</span>}
                    </span>
                  ),
                };
              })
        }
      />

      <ConsoleRecordCard
        title="Markets"
        fields={
          page.seo_page_markets.length === 0
            ? [{ key: "none", label: "Markets", value: "No markets linked", fullWidth: true }]
            : page.seo_page_markets.map((link) => ({
                key: link.id,
                label: link.is_primary ? "Primary market" : "Market",
                fullWidth: true,
                value: (
                  <span className="flex flex-wrap items-center gap-2">
                    {link.seo_markets?.market_key ?? "Market removed"}
                    {link.seo_markets && <Status label={label(link.seo_markets.market_state)} tone={marketTone(link.seo_markets.market_state)} />}
                    <span className="text-xs text-muted-copy">
                      Safety {label(link.seo_markets?.safety_state).toLowerCase()},{" "}
                      {Object.keys(link.local_evidence ?? {}).length > 0 ? "local evidence recorded" : "no local evidence"}
                    </span>
                  </span>
                ),
              }))
        }
      />

      <ConsoleRecordCard
        title="Pricing"
        subtitle="Public prices derive from the operational fee records."
        fields={[
          {
            key: "fees",
            label: "Referenced fees",
            fullWidth: true,
            value: pricing
              ? pricing.map((ref) => `${ref.service_fees?.label} (${label(ref.service_fees?.state ?? "")})`).join(", ")
              : PRICING_EVIDENCE_MISSING,
          },
        ]}
      />

      <ConsoleRecordCard
        title="Schema"
        fields={[
          { key: "types", label: "Schema types", value: (page.schema_types ?? []).join(", ") || "None recorded", fullWidth: true },
          { key: "canonical", label: "Canonical path", value: page.canonical_path ?? page.path },
        ]}
      />

      <ConsoleRecordCard
        title="Review and audit"
        fields={[
          { key: "clinical-required", label: "Clinical risk", value: page.clinical_requirement === "required" ? "Clinically sensitive" : page.clinical_requirement === "not_required" ? "Factual" : "Not classified" },
          { key: "clinical-at", label: "Clinical note recorded", value: page.clinical_reviewed_at ? formatDate(page.clinical_reviewed_at) : "None" },
          { key: "factual", label: "Factually reviewed", value: page.factual_reviewed_at ? formatDate(page.factual_reviewed_at) : "Not reviewed" },
          { key: "updated", label: "Last updated", value: formatDate(page.updated_at) },
          { key: "notes", label: "Notes", value: page.notes ?? "None", fullWidth: true },
        ]}
      />
    </section>
  );
};

export default SeoPageRecord;
