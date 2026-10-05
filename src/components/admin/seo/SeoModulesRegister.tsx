import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { MuEmpty, MuSection } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import ConsoleTable, { type ConsoleColumn } from "@/components/admin/console/ConsoleTable";
import ConsoleMobileList from "@/components/admin/console/ConsoleMobileList";
import { SelectField, Status } from "@/components/field";
import { adminDb } from "@/lib/admin-utils";
import { formatDate } from "@/lib/format";
import { REVIEW_STATES, label, reviewTone } from "@/lib/seo-registry";

interface ModuleRow {
  id: string;
  module_code: string;
  name: string;
  module_type: string;
  summary: string | null;
  content: Record<string, unknown>;
  owner_domain: string | null;
  review_state: string;
  effective_from: string | null;
  review_due_at: string | null;
}

const COLUMNS: ConsoleColumn[] = [
  { key: "select", label: "", width: "4%" },
  { key: "name", label: "Module", width: "24%" },
  { key: "type", label: "Type", width: "16%" },
  { key: "state", label: "State", width: "14%" },
  { key: "owner", label: "Owner", width: "14%" },
  { key: "effective", label: "Effective", width: "15%" },
  { key: "due", label: "Review due", width: "15%" },
];

const SeoModulesRegister = () => {
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<ModuleRow | null>(null);
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("{}");
  const [reviewState, setReviewState] = useState("draft");
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const approveSelected = async () => {
    const targets = rows.filter((row) => selected.has(row.id) && row.review_state !== "approved");
    if (targets.length === 0) {
      toast.error("No unapproved modules selected");
      return;
    }
    setApproving(true);
    let failed = 0;
    for (const row of targets) {
      const { error } = await adminDb().rpc("seo_module_save", {
        p_module_id: row.id,
        p_content: row.content ?? {},
        p_summary: row.summary,
        p_review_state: "approved",
        p_change_note: "Approved from the modules register",
      });
      if (error) failed += 1;
    }
    setApproving(false);
    setSelected(new Set());
    if (failed > 0) toast.error(`${failed} of ${targets.length} modules could not be approved`);
    else toast.success(`${targets.length} modules approved`);
    void load();
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await adminDb()
      .from("seo_modules")
      .select("id, module_code, name, module_type, summary, content, owner_domain, review_state, effective_from, review_due_at")
      .order("module_code");
    if (error) toast.error("Could not load modules");
    setLoadError(Boolean(error));
    setRows((data ?? []) as ModuleRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const openModule = (row: ModuleRow) => {
    setOpen(row);
    setSummary(row.summary ?? "");
    setContent(JSON.stringify(row.content ?? {}, null, 2));
    setReviewState(row.review_state);
    setChangeNote("");
  };

  const save = async () => {
    if (!open) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(content || "{}");
    } catch {
      toast.error("Content must be valid JSON");
      return;
    }
    if (!changeNote.trim()) {
      toast.error("A change note is required");
      return;
    }
    setSaving(true);
    const { error } = await adminDb().rpc("seo_module_save", {
      p_module_id: open.id,
      p_content: parsed,
      p_summary: summary || null,
      p_review_state: reviewState,
      p_change_note: changeNote.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Module saved");
    setOpen(null);
    void load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={() => setSelected(new Set(rows.filter((row) => row.review_state !== "approved").map((row) => row.id)))}
        >
          Select unapproved
        </Button>
        {selected.size > 0 && (
          <>
            <Button type="button" variant="outline" className="h-10" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
            <Button type="button" className="h-10" onClick={approveSelected} disabled={approving}>
              Approve selected ({selected.size})
            </Button>
          </>
        )}
      </div>
      {loadError ? (
        <MuSection padded={false}>
          <MuEmpty
            title="Could not load modules"
            description="The register did not load. Try again in a moment."
            action={<Button type="button" variant="outline" onClick={() => void load()}>Try again</Button>}
          />
        </MuSection>
      ) : rows.length === 0 ? (
        <MuSection padded={false}>
          <MuEmpty art={art.objFolderDocuments} title="No modules yet" description="Canonical content modules appear here once they are registered." />
        </MuSection>
      ) : (
      <>
      <ConsoleTable
        columns={COLUMNS}
        rows={rows}
        rowKey={(row) => row.id}
        renderRow={(row) => (
          <>
            <td className="border-r border-line-soft px-3 py-3 align-middle">
              <Checkbox
                checked={selected.has(row.id)}
                onCheckedChange={() => toggle(row.id)}
                aria-label={`Select ${row.module_code}`}
              />
            </td>
            <td className="border-r border-line-soft px-3 py-3 align-middle">
              <button type="button" onClick={() => openModule(row)} className="text-left text-sm font-semibold text-navy hover:underline">
                {row.module_code} {row.name}
              </button>
            </td>
            <td className="border-r border-line-soft px-3 py-3 align-middle">{label(row.module_type)}</td>
            <td className="border-r border-line-soft px-3 py-3 align-middle"><Status label={label(row.review_state)} tone={reviewTone(row.review_state)} /></td>
            <td className="border-r border-line-soft px-3 py-3 align-middle">{row.owner_domain ?? "Not set"}</td>
            <td className="border-r border-line-soft px-3 py-3 align-middle">{row.effective_from ? formatDate(row.effective_from) : "Not set"}</td>
            <td className="px-3 py-3 align-middle">{row.review_due_at ? formatDate(row.review_due_at) : "Not set"}</td>
          </>
        )}
      />
      <ConsoleMobileList
        emptyLabel="No modules"
        rows={rows.map((row) => ({
          key: row.id,
          title: `${row.module_code} ${row.name}`,
          state: `${label(row.module_type)}, ${row.owner_domain ?? "no owner"}`,
          status: <Status label={label(row.review_state)} tone={reviewTone(row.review_state)} />,
          onOpen: () => openModule(row),
        }))}
      />
      </>
      )}

      <Dialog open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{open ? `${open.module_code} ${open.name}` : "Module"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="module-summary">Summary</Label>
              <Textarea id="module-summary" value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} />
            </div>
            <div>
              <Label htmlFor="module-content">Content</Label>
              <Textarea id="module-content" value={content} onChange={(event) => setContent(event.target.value)} rows={8} className="font-mono text-xs" />
            </div>
            <SelectField
              label="Review state"
              value={reviewState}
              onChange={(value) => { if (value) setReviewState(value); }}
              options={REVIEW_STATES.map((value) => ({ value, label: label(value) }))}
            />
            <div>
              <Label htmlFor="module-note">Change note</Label>
              <Input id="module-note" value={changeNote} onChange={(event) => setChangeNote(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
            <Button type="button" onClick={save} disabled={saving}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SeoModulesRegister;
