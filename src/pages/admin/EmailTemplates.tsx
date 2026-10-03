// The email builder.
//
// Three columns: the blocks you may use, the email you are assembling, and the
// copy for whatever block you have selected. Nobody writes HTML here, and the
// house rules are checked before a design can be saved.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mail, Plus, Save, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminDb } from "@/lib/admin-utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  blankEmail,
  fromRecipe,
  renderEmail,
  RECIPES,
  validateEmail,
  sizeWarning,
  type BlockInstance,
  type EmailKind,
  type EmailTemplateDoc,
} from "@/lib/email-kit";
import { CATALOGUE } from "@/lib/email-kit/catalogue.generated";
import {
  addBlockTo,
  BlockCanvas,
  BlockInspector,
  BlockPalette,
  duplicateBlockIn,
  insertBlockAt,
  moveBlock,
  reorderBlock,
  RuleReport,
} from "@/components/admin/email-kit/Builder";

interface TemplateRow {
  id: string;
  name: string;
  kind: string;
  purpose: string | null;
  updated_at: string;
}

const EmailTemplates = () => {
  const { toast } = useToast();
  const [list, setList] = useState<TemplateRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [doc, setDoc] = useState<EmailTemplateDoc | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [startOpen, setStartOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await adminDb()
      .from("email_kit_templates")
      .select("id, name, kind, purpose, updated_at")
      .order("updated_at", { ascending: false });
    setList((data as TemplateRow[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const problems = useMemo(() => (doc ? validateEmail(doc) : []), [doc]);
  const errors = problems.filter((p) => p.severity !== "warning");
  const clipWarning = useMemo(() => (doc ? sizeWarning(doc) : null), [doc]);
  const html = useMemo(() => (doc ? renderEmail(doc).html : ""), [doc]);

  const patchDoc = (patch: Partial<EmailTemplateDoc>) =>
    setDoc((d) => (d ? { ...d, ...patch } : d));

  const patchBlock = (id: string, patch: Partial<BlockInstance>) =>
    setDoc((d) =>
      d ? { ...d, blocks: d.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) } : d,
    );

  const addBlock = (blockId: string) => {
    let created: string | null = null;
    setDoc((d) => {
      if (!d) return d;
      const { blocks, instance } = addBlockTo(d.blocks, blockId, selected);
      created = instance.id;
      return { ...d, blocks };
    });
    if (created) setSelected(created);
  };

  const move = (id: string, delta: number) =>
    setDoc((d) => (d ? { ...d, blocks: moveBlock(d.blocks, id, delta) } : d));

  const reorder = (id: string, toIndex: number) =>
    setDoc((d) => (d ? { ...d, blocks: reorderBlock(d.blocks, id, toIndex) } : d));

  const insertAt = (blockId: string, index: number) => {
    let created: string | null = null;
    setDoc((d) => {
      if (!d) return d;
      const { blocks, instance } = insertBlockAt(d.blocks, blockId, index);
      created = instance.id;
      return { ...d, blocks };
    });
    if (created) setSelected(created);
  };

  const removeBlock = (id: string) =>
    setDoc((d) => (d ? { ...d, blocks: d.blocks.filter((b) => b.id !== id) } : d));

  const duplicateBlock = (id: string) =>
    setDoc((d) => (d ? { ...d, blocks: duplicateBlockIn(d.blocks, id) } : d));

  const startNew = (recipeId: string | null, kind: EmailKind) => {
    const next = recipeId ? fromRecipe(recipeId) : blankEmail(kind);
    if (!next) return;
    setDoc(next);
    setOpenId(null);
    setSelected(next.blocks[1]?.id ?? next.blocks[0]?.id ?? null);
    setStartOpen(false);
  };

  const openTemplate = async (id: string) => {
    const { data, error } = await adminDb().from("email_kit_templates").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      toast({ title: "Could not open that email", description: error?.message, variant: "destructive" });
      return;
    }
    const row = data as any;
    setDoc({
      name: row.name,
      kind: row.kind as EmailKind,
      recipe: row.recipe ?? undefined,
      purpose: row.purpose ?? undefined,
      subject: row.subject ?? "",
      preheader: row.preheader ?? "",
      blocks: (row.blocks ?? []) as BlockInstance[],
    });
    setOpenId(id);
    setSelected(null);
  };

  const save = async () => {
    if (!doc) return;
    if (errors.length) {
      toast({ title: "Fix the flagged items first", description: errors[0].message, variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: doc.name,
      kind: doc.kind,
      recipe: doc.recipe ?? null,
      purpose: doc.purpose ?? null,
      subject: doc.subject,
      preheader: doc.preheader,
      blocks: doc.blocks as any,
    };
    const query = openId
      ? adminDb().from("email_kit_templates").update(payload).eq("id", openId).select("id").maybeSingle()
      : adminDb().from("email_kit_templates").insert(payload).select("id").maybeSingle();
    const { data, error } = await query;
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else {
      setOpenId((data as any)?.id ?? openId);
      toast({ title: "Saved" });
      load();
    }
    setSaving(false);
  };

  const sendTest = async () => {
    if (!doc || !testEmail.trim()) {
      toast({ title: "Enter an address to send the test to" });
      return;
    }
    setTesting(true);
    const rendered = renderEmail(doc);
    const { error } = await supabase.functions.invoke("send-kit-test", {
      body: { to: testEmail.trim(), subject: rendered.subject, html: rendered.html, text: rendered.text },
    });
    toast(
      error
        ? { title: "Test failed", description: error.message, variant: "destructive" }
        : { title: `Test sent to ${testEmail.trim()}` },
    );
    setTesting(false);
  };

  const current = doc?.blocks.find((b) => b.id === selected) ?? null;

  if (!doc) {
    return (
      <div>
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Email library</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every email we send is assembled from the Medic Connect kit, so the brand stays put
              and nobody has to write HTML.
            </p>
          </div>
          <Button onClick={() => setStartOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />New email
          </Button>
        </header>

        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center">
            <Mail className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No emails yet. Start from a recipe and the structure is already correct.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((row) => (
              <button
                key={row.id}
                onClick={() => openTemplate(row.id)}
                className="rounded-2xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{row.name}</span>
                  <Badge variant={row.kind === "marketing" ? "default" : "secondary"}>
                    {row.kind === "marketing" ? "Marketing" : "Transactional"}
                  </Badge>
                </div>
                {row.purpose && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{row.purpose}</p>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Edited {new Date(row.updated_at).toLocaleDateString("en-GB")}
                </p>
              </button>
            ))}
          </div>
        )}

        <StartDialog open={startOpen} onOpenChange={setStartOpen} onStart={startNew} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setDoc(null); setOpenId(null); load(); }}>
            All emails
          </Button>
          <Input
            value={doc.name}
            onChange={(e) => patchDoc({ name: e.target.value })}
            className="h-9 w-56 font-medium"
          />
          <Select value={doc.kind} onValueChange={(v) => patchDoc({ kind: v as EmailKind })}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="transactional">Transactional</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="you@medicconnect.co"
            className="h-9 w-56"
          />
          <Button variant="outline" size="sm" onClick={sendTest} disabled={testing}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send test
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[240px_1fr_340px]">
        <BlockPalette onAdd={addBlock} />

        {/* Canvas */}
        <section className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Subject line</Label>
                <Input
                  value={doc.subject}
                  onChange={(e) => patchDoc({ subject: e.target.value })}
                  placeholder="What lands in the inbox"
                />
                <p className="text-xs text-muted-foreground">{doc.subject.length} of 55 characters</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Preheader</Label>
                <Input
                  value={doc.preheader}
                  onChange={(e) => patchDoc({ preheader: e.target.value })}
                  placeholder="The line that continues the subject, never repeats it"
                />
                <p className="text-xs text-muted-foreground">{doc.preheader.length} of 90 characters</p>
              </div>
            </div>
          </div>

          <RuleReport problems={problems} clipWarning={clipWarning} />

          <BlockCanvas
            blocks={doc.blocks}
            selected={selected}
            onSelect={setSelected}
            onMove={move}
            onReorder={reorder}
            onInsertAt={insertAt}
            onDuplicate={duplicateBlock}
            onRemove={removeBlock}
          />

          <div className="rounded-lg border bg-card">
            <p className="border-b px-4 py-3 text-sm font-medium">Preview</p>
            <iframe title="Email preview" srcDoc={html} className="h-[80vh] w-full bg-white" />
          </div>
        </section>

        <BlockInspector
          current={current}
          onChange={(patch) => current && patchBlock(current.id, patch)}
        />
      </div>

    </div>
  );
};

const StartDialog = ({
  open,
  onOpenChange,
  onStart,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStart: (recipeId: string | null, kind: EmailKind) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Start a new email</DialogTitle>
        <DialogDescription>
          A recipe gives you the right blocks in the right order for that job. You can still change
          anything afterwards.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        {RECIPES.map((r) => (
          <button
            key={r.id}
            onClick={() => onStart(r.id, r.kind as EmailKind)}
            className="w-full rounded-xl border p-3 text-left transition hover:border-primary/40"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{r.name}</span>
              <Badge variant={r.kind === "marketing" ? "default" : "secondary"}>
                {r.kind === "marketing" ? "Marketing" : "Transactional"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{r.blocks.length} blocks</p>
          </button>
        ))}
      </div>
      <Separator />
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => onStart(null, "transactional")}>
          Blank transactional
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => onStart(null, "marketing")}>
          Blank marketing
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Contact details in footers come from the kit: {CATALOGUE.meta.contact.email}, {CATALOGUE.meta.contact.whatsapp}.
      </p>
    </DialogContent>
  </Dialog>
);

export default EmailTemplates;
