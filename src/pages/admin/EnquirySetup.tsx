// What we ask, and what we send back.
//
// Every service line owns its questions, its brochure and the words that open
// and close its reply. Change them here and the public form and the automatic
// email both change with them.

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MuEmpty, MuPageHeader, MuSection, MuStatus } from "@/components/admin/mu/MuShell";
import { SelectField } from "@/components/field";
import { art } from "@/components/mc/art";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileText, Loader2, Plus, Save, Trash2, Upload } from "lucide-react";
import {
  brochureLink, deleteQuestion, loadQuestions, loadServiceLines, saveQuestion,
  saveServiceLine, uploadBrochure,
  type EnquiryQuestion, type QuestionType, type ServiceLine,
} from "@/lib/enquiries";
import { format } from "date-fns";

const TYPES: { key: QuestionType; label: string }[] = [
  { key: "choice", label: "Pick one" },
  { key: "multi", label: "Pick several" },
  { key: "text", label: "Short answer" },
  { key: "textarea", label: "Long answer" },
];

const EnquirySetup = () => {
  const { toast } = useToast();
  const [lines, setLines] = useState<ServiceLine[]>([]);
  const [questions, setQuestions] = useState<EnquiryQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string>("__shared");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Partial<EnquiryQuestion> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const [l, q] = await Promise.all([loadServiceLines(true), loadQuestions(true)]);
      setLines(l);
      setQuestions(q);
    } catch (err) {
      toast({
        title: "Could not load the setup",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const line = useMemo(
    () => (activeKey === "__shared" ? null : lines.find((l) => l.key === activeKey) ?? null),
    [lines, activeKey],
  );

  const shown = useMemo(
    () => questions
      .filter((q) => (line ? q.service_line_id === line.id : q.service_line_id === null))
      .sort((a, b) => a.sort_order - b.sort_order),
    [questions, line],
  );

  const patchLine = (patch: Partial<ServiceLine>) =>
    setLines((prev) => prev.map((l) => (l.key === activeKey ? { ...l, ...patch } : l)));

  const persistLine = async () => {
    if (!line) return;
    setSaving(true);
    try {
      await saveServiceLine(line);
      toast({ title: "Saved" });
    } catch (err) {
      toast({ title: "Not saved", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const onBrochure = async (file: File | null) => {
    if (!file || !line) return;
    setSaving(true);
    try {
      const { path, name } = await uploadBrochure(line.key, file);
      patchLine({ brochure_path: path, brochure_name: name, brochure_updated_at: new Date().toISOString() });
      toast({ title: "Brochure uploaded", description: `${name} now goes out with every ${line.name.toLowerCase()} reply.` });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openBrochure = async () => {
    if (!line?.brochure_path) return;
    const url = await brochureLink(line.brochure_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const saveEditing = async () => {
    if (!editing?.label || !editing.field_key) return;
    setSaving(true);
    try {
      await saveQuestion({
        ...editing,
        service_line_id: line?.id ?? null,
        options: editing.options ?? [],
      });
      setEditing(null);
      await load();
    } catch (err) {
      toast({ title: "Not saved", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeQuestion = async (id: string) => {
    await deleteQuestion(id);
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <div className="mb-6">
        <MuPageHeader
          title="Enquiry setup"
          description="What each service line asks, and what we send back when somebody asks for care."
          backTo="/admin/enquiries"
          backLabel="Back to enquiries"
          actions={
            <Button
              onClick={() => setEditing({ field_key: "", label: "", help: "", input_type: "choice", options: [], required: false, sort_order: (shown.length ? shown[shown.length - 1].sort_order : 0) + 10, active: true })}
            >
              <Plus className="h-4 w-4 mr-2" />Add a question
            </Button>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <nav className="space-y-1">
          <button
            onClick={() => setActiveKey("__shared")}
            className={`w-full text-left px-3 py-2 text-sm ${activeKey === "__shared" ? "bg-tint font-semibold text-navy" : "hover:bg-tint/50"}`}
          >
            Asked of everybody
          </button>
          {lines.map((l) => (
            <button
              key={l.key}
              onClick={() => setActiveKey(l.key)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm ${activeKey === l.key ? "bg-tint font-semibold text-navy" : "hover:bg-tint/50"}`}
            >
              <span className="truncate">{l.name}</span>
              {!l.brochure_path && <MuStatus label="No guide" tone="warning" />}
            </button>
          ))}
        </nav>

        <div className="space-y-6">
          {line && (
            <MuSection title={`The reply for ${line.name.toLowerCase()}`}>
              <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Subject line</Label>
                  <Input value={line.reply_subject} onChange={(e) => patchLine({ reply_subject: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Shown on the public form</Label>
                  <Input value={line.name} onChange={(e) => patchLine({ name: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Opening words</Label>
                <Textarea rows={2} value={line.reply_intro} onChange={(e) => patchLine({ reply_intro: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Closing words, before the guide</Label>
                <Textarea rows={2} value={line.reply_outro} onChange={(e) => patchLine({ reply_outro: e.target.value })} />
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-4">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => onBrochure(e.target.files?.[0] ?? null)}
                />
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={saving}>
                  <Upload className="h-4 w-4 mr-2" />{line.brochure_path ? "Replace the guide" : "Upload a guide"}
                </Button>
                {line.brochure_path ? (
                  <button onClick={openBrochure} className="inline-flex items-center gap-2 text-sm text-primary underline">
                    <FileText className="h-4 w-4" />
                    {line.brochure_name}
                    {line.brochure_updated_at ? `, updated ${format(new Date(line.brochure_updated_at), "dd MMM yyyy")}` : ""}
                  </button>
                ) : (
                  <span className="text-sm text-muted-foreground">No guide is attached to this line yet, so replies go out without one.</span>
                )}
                <div className="ml-auto flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={line.active} onCheckedChange={(v) => patchLine({ active: v })} />
                    Shown on the site
                  </label>
                  <Button onClick={persistLine} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save
                  </Button>
                </div>
              </div>
              </div>
            </MuSection>
          )}

          <MuSection
            title={line ? `Questions only ${line.name.toLowerCase()} asks` : "Questions asked of everybody"}
            padded={false}
          >
            <div className="divide-y divide-line-soft">
            {shown.length === 0 ? (
              <MuEmpty
                art={art.objClipboardChecks}
                title="No questions here yet"
                description="Add a question and it appears on the public form for this line."
              />
            ) : shown.map((q) => (
              <div key={q.id} className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{q.label} {q.required && <span className="text-destructive">*</span>}</div>
                  <div className="text-xs text-muted-foreground">
                    {[
                      TYPES.find((t) => t.key === q.input_type)?.label,
                      `saved as ${q.field_key}`,
                      q.options.length ? `${q.options.length} options` : null,
                      !q.active ? "hidden" : null,
                    ].filter(Boolean).join(", ")}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditing(q)}>Edit</Button>
                <Button variant="ghost" size="icon" aria-label="Delete question" onClick={() => removeQuestion(q.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            </div>
          </MuSection>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit question" : "New question"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>The question</Label>
                <Input
                  value={editing.label ?? ""}
                  onChange={(e) => setEditing({
                    ...editing,
                    label: e.target.value,
                    field_key: editing.id ? editing.field_key : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40),
                  })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Helper line, if it needs one</Label>
                <Input value={editing.help ?? ""} onChange={(e) => setEditing({ ...editing, help: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Answer type"
                  value={editing.input_type ?? "choice"}
                  onChange={(v) => { if (v) setEditing({ ...editing, input_type: v as QuestionType }); }}
                  options={TYPES.map((t) => ({ value: t.key, label: t.label }))}
                />
                <div className="space-y-1.5">
                  <Label>Order</Label>
                  <Input
                    type="number"
                    value={editing.sort_order ?? 100}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                  />
                </div>
              </div>
              {(editing.input_type === "choice" || editing.input_type === "multi") && (
                <div className="space-y-1.5">
                  <Label>Options, one per line</Label>
                  <Textarea
                    rows={6}
                    value={(editing.options ?? []).join("\n")}
                    onChange={(e) => setEditing({ ...editing, options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                  />
                </div>
              )}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.required ?? false} onCheckedChange={(v) => setEditing({ ...editing, required: v })} />
                  Must be answered
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                  Asked right now
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEditing} disabled={saving || !editing?.label}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnquirySetup;
