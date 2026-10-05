// The annex library.
//
// The documents a contract refers to, written once and reused. An annex is
// either a document written here, which travels inside the contract and prints
// with it, or a file attached once and sent with every contract that carries
// it. Editing an annex here changes what future contracts carry. It never
// touches a contract already issued: that pack is frozen at issue.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Loader2, Paperclip, Plus, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { useToast } from "@/hooks/use-toast";
import { MuEmpty, MuPage, MuPageHeader, MuSection, MuStatus } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import ContractRichTextEditor from "@/components/contracts/ContractRichTextEditor";
import {
  AnnexLibraryItem, createAnnexItem, deleteAnnexItem, installAnnexPack, loadAnnexLibrary, saveAnnexItem,
  uploadLibraryFile,
} from "@/lib/contract-templates";
import { openDocumentTab } from "@/lib/documents";

const AnnexLibrary = () => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<AnnexLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AnnexLibraryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [installing, setInstalling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await loadAnnexLibrary(true);
      setItems(rows);
      setSelectedId((cur) => cur ?? rows[0]?.id ?? null);
    } catch (err: any) {
      toast({ title: "Could not open the library", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const installPack = async () => {
    if (!window.confirm("Load the employee pack wording into the library? Annexes with the same code are replaced. Contracts already issued keep their own copy.")) return;
    setInstalling(true);
    try {
      const { updated, created } = await installAnnexPack();
      toast({
        title: "Employee pack loaded",
        description: `${updated} annexes were replaced and ${created} were added.`,
      });
      await load();
    } catch (err: any) {
      toast({ title: "Could not load the pack", description: err.message, variant: "destructive" });
    }
    setInstalling(false);
  };

  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);
  useEffect(() => { setDraft(selected ? { ...selected } : null); setPreview(false); }, [selected]);

  const set = (patch: Partial<AnnexLibraryItem>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  // Unsaved edits are never thrown away silently.
  const dirty = !!draft && !!selected && JSON.stringify(draft) !== JSON.stringify(selected);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const choose = (next: string) => {
    if (next === selectedId) return;
    if (dirty) setPendingId(next);
    else setSelectedId(next);
  };
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveAnnexItem(draft.id, {
        code: draft.code,
        title: draft.title,
        kind: draft.kind,
        body: draft.body,
        note: draft.note,
        requires_signature: draft.requires_signature,
        clinical_only: draft.clinical_only,
        sort_order: draft.sort_order,
        active: draft.active,
        file_path: draft.file_path,
        file_name: draft.file_name,
      });
      toast({ title: "Annex saved" });
      load();
    } catch (err: any) {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const add = async () => {
    const code = newCode.trim();
    const title = newTitle.trim();
    if (!code || !title) {
      toast({ title: "A code and a title are needed", variant: "destructive" });
      return;
    }
    try {
      const id = await createAnnexItem({
        code, title, kind: "document",
        sort_order: (items[items.length - 1]?.sort_order ?? 0) + 10,
      });
      setAdding(false);
      setNewCode("");
      setNewTitle("");
      await load();
      setSelectedId(id);
    } catch (err: any) {
      toast({ title: "Could not add the annex", description: err.message, variant: "destructive" });
    }
  };

  const remove = async () => {
    if (!draft) return;
    if (!window.confirm(`Remove ${draft.code} from the library? Contracts already issued keep their copy.`)) return;
    try {
      await deleteAnnexItem(draft.id);
      setSelectedId(null);
      load();
    } catch (err: any) {
      toast({ title: "Could not remove it", description: err.message, variant: "destructive" });
    }
  };

  const attach = async (file: File) => {
    if (!draft) return;
    setUploading(true);
    try {
      const { path, name } = await uploadLibraryFile(draft.code, file);
      set({ file_path: path, file_name: name, kind: "file" });
      await saveAnnexItem(draft.id, { file_path: path, file_name: name, kind: "file" });
      toast({ title: "File attached" });
      load();
    } catch (err: any) {
      toast({ title: "Could not attach the file", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  };

  return (
    <MuPage>
      <ConfirmAction
        open={pendingId !== null}
        onOpenChange={(o) => !o && setPendingId(null)}
        title="Leave this annex without saving?"
        description={<p>Your changes to {draft?.code || "this annex"} have not been saved. Leaving now discards them.</p>}
        confirmLabel="Discard changes"
        destructive
        onConfirm={() => { if (pendingId) setSelectedId(pendingId); setPendingId(null); }}
      />
      <MuPageHeader
        title="Annex library"
        description="The documents a contract refers to, written once."
        backTo="/admin/workforce"
        backLabel="Back to workforce"
        actions={
          <>
            <Button variant="outline" onClick={installPack} disabled={installing}>
              {installing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}
              Load the employee pack
            </Button>
            <Button onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" />New annex</Button>
          </>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <MuSection padded={false}>
          <MuEmpty
            art={art.objFolderDocuments}
            title="The library is empty"
            description="Add the first annex to begin."
            action={<Button onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" />New annex</Button>}
          />
        </MuSection>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <MuSection title="Annexes" padded={false}>
            <ul className="divide-y divide-line-soft">
              {items.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => choose(i.id)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      i.id === selectedId ? "bg-muted" : "hover:bg-muted/50"
                    }`}
                  >
                    <p className="text-[13px] font-semibold">{i.code}</p>
                    <p className="text-[13px] text-muted-foreground">{i.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <MuStatus tone={i.kind === "document" ? "info" : "neutral"} label={i.kind === "document" ? "Document" : "File"} />
                      {i.requires_signature && <MuStatus tone="warning" label="Signed" />}
                      {!i.active && <MuStatus tone="bad" label="Off" />}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </MuSection>

          {draft && (
            <MuSection
              title={`${draft.code}: ${draft.title}`}
              description="Changes here apply to contracts drafted from now on."
              actions={
                <>
                  <Button variant="outline" size="sm" onClick={() => setPreview((p) => !p)}>
                    {preview ? "Edit" : "Preview"}
                  </Button>
                  <Button size="sm" onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save
                  </Button>
                </>
              }
            >
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Code</Label>
                    <Input value={draft.code} onChange={(e) => set({ code: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Note printed under the title</Label>
                  <Input value={draft.note || ""} onChange={(e) => set({ note: e.target.value })} />
                </div>

                <div className="border-2 border-navy bg-tint/40 p-3">
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-label">Settings</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Asked to sign it", hint: "The person signs this annex alongside the letter.", key: "requires_signature" as const },
                    { label: "Clinical roles only", hint: "Left off contracts that are not clinical.", key: "clinical_only" as const },
                    { label: "In use", hint: "Turn off to retire it without deleting it.", key: "active" as const },
                  ].map((t) => (
                    <label key={t.key} title={t.hint} className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium">{t.label}</span>
                      <Switch
                        checked={!!draft[t.key]}
                        onCheckedChange={(v) => set({ [t.key]: v } as Partial<AnnexLibraryItem>)}
                      />
                    </label>
                  ))}
                </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border border-line p-3">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <p className="text-[13px]">
                    {draft.file_name ? `Attached: ${draft.file_name}` : "No file attached"}
                  </p>
                  <div className="ml-auto flex gap-2">
                    {draft.file_path && (
                      <Button variant="ghost" size="sm" onClick={() => openDocumentTab(draft.file_path!)}>Open</Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      {draft.file_name ? "Replace" : "Attach a file"}
                    </Button>
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) attach(f); e.target.value = ""; }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>The wording</Label>
                  {preview ? (
                    <div
                      className="prose prose-sm max-w-none border border-line p-4"
                      dangerouslySetInnerHTML={{ __html: draft.body || "<p>Nothing written yet.</p>" }}
                    />
                  ) : (
                    <ContractRichTextEditor
                      value={draft.body}
                      minHeight="360px"
                      placeholder="Write the annex here. Tokens like {{employee_name}} fill in from the contract."
                      onChange={(html) => set({ body: html })}
                    />
                  )}
                </div>

                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={remove}>
                    <Trash2 className="mr-2 h-4 w-4" />Remove from the library
                  </Button>
                </div>
              </div>
            </MuSection>
          )}
        </div>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New annex</DialogTitle>
            <DialogDescription>Give it a code and a title. The wording comes next.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Annex G" />
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Shift allowances" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button onClick={add}>Add it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MuPage>
  );
};

export default AnnexLibrary;
