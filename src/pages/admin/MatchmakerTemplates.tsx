import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, Plus, Save, Trash2, Copy, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { Question } from "@/lib/matchmaker";
import QuestionBuilder from "@/components/admin/QuestionBuilder";
import { MuEmpty, MuPage, MuPageHeader } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";

interface Template {
  id: string;
  name: string;
  description: string | null;
  questions: Question[];
  updated_at: string;
}

const emptyTemplate = (): Template => ({
  id: "", name: "", description: "", questions: [], updated_at: new Date().toISOString(),
});

const MatchmakerTemplates = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await adminDb()
      .from("matchmaker_question_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    setTemplates((data || []).map((t: any) => ({
      ...t, questions: Array.isArray(t.questions) ? t.questions : [],
    })));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const save = async () => {
    if (!editing || !editing.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" }); return;
    }
    setSaving(true);
    const payload = {
      name: editing.name.trim(),
      description: editing.description?.trim() || null,
      questions: editing.questions.filter((q) => q.label.trim()),
    };
    const { error } = editing.id
      ? await adminDb().from("matchmaker_question_templates").update(payload).eq("id", editing.id)
      : await adminDb().from("matchmaker_question_templates").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Template saved" });
    setEditing(null);
    fetchAll();
  };

  const duplicate = async (t: Template) => {
    const { error } = await adminDb().from("matchmaker_question_templates").insert({
      name: `${t.name} (copy)`, description: t.description, questions: t.questions,
    });
    if (error) { toast({ title: "Copy failed", description: error.message, variant: "destructive" }); return; }
    fetchAll();
  };

  const remove = async (t: Template) => {
    if (!confirm(`Delete template "${t.name}"? Opportunities that already loaded it keep their questions.`)) return;
    await adminDb().from("matchmaker_question_templates").delete().eq("id", t.id);
    fetchAll();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (editing) {
    return (
      <MuPage className="max-w-3xl mx-auto">
        <MuPageHeader
          title={editing.name || "New template"}
          description="A reusable question set for opportunities."
          breadcrumb={
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)} className="-ml-3">
              <ArrowLeft className="mr-2 h-4 w-4" />All templates
            </Button>
          }
          actions={
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save template
            </Button>
          }
        />
        <div className="border border-line bg-card p-6 space-y-5">
          <div>
            <Label htmlFor="tn">Template name</Label>
            <Input id="tn" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1" placeholder="For example, clinical research nurse standard set" />
          </div>
          <div>
            <Label htmlFor="td">Description</Label>
            <Textarea id="td" rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-1" placeholder="Optional. What this template is for." />
          </div>
          <div>
            <Label className="mb-3 block">Questions</Label>
            <QuestionBuilder value={editing.questions} onChange={(q) => setEditing({ ...editing, questions: q })} />
          </div>
        </div>
      </MuPage>
    );
  }

  return (
    <MuPage className="max-w-4xl mx-auto">
      <MuPageHeader
        title="Question templates"
        description="Reusable question sets for opportunities."
        backTo="/admin/match-universe/opportunities"
        backLabel="Opportunities"
        actions={
          <Button onClick={() => setEditing(emptyTemplate())}>
            <Plus className="mr-2 h-4 w-4" />New template
          </Button>
        }
      />

      {templates.length === 0 ? (
        <div className="border border-line bg-card">
          <MuEmpty
            art={art.objClipboard}
            title="No templates yet"
            description="Create one to reuse question sets across opportunities."
          />
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="border border-line bg-card p-4 sm:p-5 flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium">{t.name}</h3>
                {t.description && <p className="text-sm text-muted-foreground mt-0.5">{t.description}</p>}
                <p className="text-xs text-muted-foreground mt-1">{t.questions.length} question{t.questions.length === 1 ? "" : "s"}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setEditing(t)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => duplicate(t)} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => remove(t)} title="Delete" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </MuPage>
  );
};

export default MatchmakerTemplates;
