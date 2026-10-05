import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { MuEmpty, MuLoadError, MuSection, MuToolbar } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import ConsoleTable, { type ConsoleColumn } from "@/components/admin/console/ConsoleTable";
import ConsoleMobileList from "@/components/admin/console/ConsoleMobileList";
import { SelectField, Status } from "@/components/field";
import { adminDb } from "@/lib/admin-utils";
import {
  EVIDENCE_STATES, INDEX_STATES, PAGE_TYPES, PAGE_TYPE_LABELS, PUBLICATION_STATES,
  evidenceTone, indexTone, label, publicationTone,
} from "@/lib/seo-registry";

interface SeoPageRow {
  id: string;
  page_key: string;
  path: string;
  page_type: string;
  estate: string;
  audience: string[] | null;
  priority: number | null;
  index_state: string;
  publication_state: string;
  evidence_state: string;
  clinical_requirement: string | null;
  title: string | null;
}

const COLUMNS: ConsoleColumn[] = [
  { key: "page", label: "Page", width: "22%" },
  { key: "path", label: "Path", width: "18%" },
  { key: "estate", label: "Estate", width: "10%" },
  { key: "priority", label: "Priority", width: "8%" },
  { key: "publication", label: "Publication", width: "12%" },
  { key: "index", label: "Index", width: "11%" },
  { key: "evidence", label: "Evidence", width: "10%" },
  { key: "review", label: "Review", width: "9%" },
];

const ANY = "any";

const pageName = (row: SeoPageRow) => row.title ?? row.page_key;

const SeoPagesRegister = () => {
  const [rows, setRows] = useState<SeoPageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [indexState, setIndexState] = useState(ANY);
  const [publication, setPublication] = useState(ANY);
  const [estate, setEstate] = useState(ANY);
  const [audience, setAudience] = useState(ANY);
  const [priority, setPriority] = useState(ANY);
  const [evidence, setEvidence] = useState(ANY);
  const [clinical, setClinical] = useState(ANY);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ page_key: "", path: "", page_type: "service", estate: "families", title: "" });
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await adminDb()
      .from("seo_pages")
      .select("id, page_key, path, page_type, estate, audience, priority, index_state, publication_state, evidence_state, clinical_requirement, title")
      .order("priority", { ascending: true, nullsFirst: false })
      .order("path", { ascending: true });
    setLoadError(Boolean(error));
    if (error) {
      toast.error("Could not load SEO pages");
      setLoading(false);
      return;
    }
    setRows((data ?? []) as SeoPageRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const estates = useMemo(() => Array.from(new Set(rows.map((row) => row.estate))).sort(), [rows]);
  const audiences = useMemo(
    () => Array.from(new Set(rows.flatMap((row) => row.audience ?? []))).sort(),
    [rows],
  );
  const priorities = useMemo(
    () => Array.from(new Set(rows.map((row) => row.priority).filter((value): value is number => value !== null))).sort(),
    [rows],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (term && !`${pageName(row)} ${row.path} ${row.page_key}`.toLowerCase().includes(term)) return false;
      if (indexState !== ANY && row.index_state !== indexState) return false;
      if (publication !== ANY && row.publication_state !== publication) return false;
      if (estate !== ANY && row.estate !== estate) return false;
      if (audience !== ANY && !(row.audience ?? []).includes(audience)) return false;
      if (priority !== ANY && String(row.priority ?? "") !== priority) return false;
      if (evidence !== ANY && row.evidence_state !== evidence) return false;
      if (clinical !== ANY && (row.clinical_requirement ?? "undecided") !== clinical) return false;
      return true;
    });
  }, [audience, clinical, estate, evidence, indexState, priority, publication, rows, search]);

  const createPage = async () => {
    if (!draft.page_key.trim() || !draft.path.startsWith("/")) {
      toast.error("A page key and a path beginning with / are required");
      return;
    }
    setSaving(true);
    const { error } = await adminDb().rpc("seo_page_create", {
      p_page_key: draft.page_key.trim(),
      p_path: draft.path.trim(),
      p_page_type: draft.page_type,
      p_estate: draft.estate.trim() || "families",
      p_title: draft.title.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Page added");
    setCreating(false);
    setDraft({ page_key: "", path: "", page_type: "service", estate: "families", title: "" });
    void load();
  };

  const filter = (
    id: string,
    name: string,
    value: string,
    onChange: (next: string) => void,
    options: Array<{ value: string; label: string }>,
  ) => (
    <SelectField
      key={id}
      name={id}
      label={name}
      hideLabel
      value={value}
      onChange={(next) => onChange(next || ANY)}
      placeholder={`${name}: all`}
      options={[{ value: ANY, label: `${name}: all` }, ...options]}
      className="min-w-[9rem] flex-1"
    />
  );

  return (
    <div className="space-y-3">
      <MuToolbar>
        <div className="flex flex-1 flex-wrap gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search pages"
          aria-label="Search pages"
          className="h-10 min-w-[12rem] flex-[2]"
        />
        {filter("filter-index", "Index", indexState, setIndexState, INDEX_STATES.map((value) => ({ value, label: label(value) })))}
        {filter("filter-publication", "Publication", publication, setPublication, PUBLICATION_STATES.map((value) => ({ value, label: label(value) })))}
        {filter("filter-estate", "Estate", estate, setEstate, estates.map((value) => ({ value, label: label(value) })))}
        {filter("filter-audience", "Audience", audience, setAudience, audiences.map((value) => ({ value, label: label(value) })))}
        {filter("filter-priority", "Priority", priority, setPriority, priorities.map((value) => ({ value: String(value), label: String(value) })))}
        {filter("filter-evidence", "Evidence", evidence, setEvidence, EVIDENCE_STATES.map((value) => ({ value, label: label(value) })))}
        {filter("filter-clinical", "Clinical risk", clinical, setClinical, [
          { value: "required", label: "Clinically sensitive" },
          { value: "not_required", label: "Factual" },
          { value: "undecided", label: "Not classified" },
        ])}
        </div>
        <Button type="button" onClick={() => setCreating(true)} className="h-10 shrink-0">
          <Plus className="mr-1.5 h-4 w-4" /> New page
        </Button>
      </MuToolbar>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : loadError ? (
        <MuLoadError what="the SEO pages" onRetry={() => void load()} />
      ) : visible.length === 0 ? (
        <MuSection padded={false}>
          {rows.length === 0 ? (
            <MuEmpty
              art={art.objFolderDocuments}
              title="No SEO pages yet"
              description="Add a page to govern its title, index state and evidence."
              action={<Button type="button" onClick={() => setCreating(true)}><Plus className="mr-1.5 h-4 w-4" />New page</Button>}
            />
          ) : (
            <MuEmpty art={art.objMagnifier} title="No matching pages" description="Try a different search or clear a filter." />
          )}
        </MuSection>
      ) : (
        <>
          <ConsoleTable
            columns={COLUMNS}
            rows={visible}
            rowKey={(row) => row.id}
            renderRow={(row) => (
              <>
                <td className="border-r border-line-soft px-3 py-3 align-middle">
                  <Link to={`/admin/seo/pages/${row.id}`} className="text-sm font-semibold text-navy hover:underline">
                    {pageName(row)}
                  </Link>
                  <span className="mt-0.5 block text-xs text-muted-copy">{label(row.page_type, PAGE_TYPE_LABELS)}</span>
                </td>
                <td className="border-r border-line-soft px-3 py-3 align-middle font-mono text-xs">{row.path}</td>
                <td className="border-r border-line-soft px-3 py-3 align-middle">{label(row.estate)}</td>
                <td className="border-r border-line-soft px-3 py-3 align-middle">{row.priority ?? "Not set"}</td>
                <td className="border-r border-line-soft px-3 py-3 align-middle"><Status label={label(row.publication_state)} tone={publicationTone(row.publication_state)} /></td>
                <td className="border-r border-line-soft px-3 py-3 align-middle"><Status label={label(row.index_state)} tone={indexTone(row.index_state)} /></td>
                <td className="border-r border-line-soft px-3 py-3 align-middle"><Status label={label(row.evidence_state)} tone={evidenceTone(row.evidence_state)} /></td>
                <td className="px-3 py-3 align-middle text-xs">{row.clinical_requirement === "required" ? "Clinically sensitive" : row.clinical_requirement === "not_required" ? "Factual" : "Not classified"}</td>
              </>
            )}
          />
          <ConsoleMobileList
            emptyLabel="No SEO pages"
            rows={visible.map((row) => ({
              key: row.id,
              title: pageName(row),
              state: `${row.path}, ${label(row.publication_state)}, ${label(row.evidence_state)} evidence`,
              status: <Status label={label(row.index_state)} tone={indexTone(row.index_state)} />,
              to: `/admin/seo/pages/${row.id}`,
            }))}
          />
        </>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>New page</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="new-page-key">Page key</Label>
              <Input id="new-page-key" value={draft.page_key} onChange={(event) => setDraft({ ...draft, page_key: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="new-page-path">Path</Label>
              <Input id="new-page-path" value={draft.path} placeholder="/example" onChange={(event) => setDraft({ ...draft, path: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="new-page-title">Title</Label>
              <Input id="new-page-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </div>
            <SelectField
              label="Page type"
              value={draft.page_type}
              onChange={(value) => { if (value) setDraft({ ...draft, page_type: value }); }}
              options={PAGE_TYPES.map((value) => ({ value, label: label(value, PAGE_TYPE_LABELS) }))}
            />
            <div>
              <Label htmlFor="new-page-estate">Estate</Label>
              <Input id="new-page-estate" value={draft.estate} onChange={(event) => setDraft({ ...draft, estate: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button type="button" onClick={createPage} disabled={saving}>Add page</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SeoPagesRegister;
