import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, ArrowLeft, Save, Copy, ExternalLink, Trash2, Archive, Plus, Eye, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import {
  buildShareUrl,
  buildPreviewUrl,
  ensureUniqueSlug,
  slugify,
  DocumentField,
  Question,
  StandardFieldsConfig,
  StandardFieldKey,
  StandardFieldState,
  STANDARD_FIELD_LABELS,
  DEFAULT_STANDARD_FIELDS,
  normaliseStandardFields,
} from "@/lib/matchmaker";
import QuestionBuilder from "@/components/admin/QuestionBuilder";
import { LocationField } from "@/components/LocationSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface AudienceGroup {
  id: string;
  name: string;
}

interface Opportunity {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  location: string | null;
  role_details: string | null;
  requirements: string | null;
  document_fields: DocumentField[];
  questions: Question[];
  link_target: "detail" | "landing";
  status: "draft" | "open" | "closed" | "archived";
  audience_group_id: string | null;
  standard_fields: StandardFieldsConfig;
}

interface QuestionTemplate {
  id: string;
  name: string;
  questions: Question[];
}

const blankDoc = (): DocumentField => ({
  key: `doc-${Math.random().toString(36).slice(2, 8)}`,
  label: "",
  required: false,
});

interface MatchmakerEditorProps {
  embedded?: boolean;
}

const MatchmakerEditor = ({ embedded }: MatchmakerEditorProps) => {

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [op, setOp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<AudienceGroup[]>([]);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupDraftName, setGroupDraftName] = useState("");
  const [groupDraftDesc, setGroupDraftDesc] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [saveTplName, setSaveTplName] = useState("");
  const [savingTpl, setSavingTpl] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data, error }, { data: g }, { data: t }] = await Promise.all([
        adminDb().from("matchmaker_opportunities").select("*").eq("id", id).single(),
        adminDb().from("audience_groups").select("id, name").order("created_at", { ascending: false }),
        adminDb().from("matchmaker_question_templates").select("id, name, questions").order("updated_at", { ascending: false }),
      ]);
      if (error) { toast({ title: "Not found", variant: "destructive" }); navigate("/admin/match-universe/opportunities"); return; }
      setOp({
        ...data,
        document_fields: Array.isArray(data.document_fields) ? data.document_fields : [],
        questions: Array.isArray(data.questions) ? data.questions : [],
        standard_fields: normaliseStandardFields((data as any).standard_fields),
      });
      setGroups(g || []);
      setTemplates((t || []).map((x: any) => ({ ...x, questions: Array.isArray(x.questions) ? x.questions : [] })));
      setLoading(false);
    })();
  }, [id]);

  if (loading || !op) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const update = (patch: Partial<Opportunity>) => setOp({ ...op, ...patch });

  const persist = async (overrides: Partial<Opportunity> = {}) => {
    const merged: Opportunity = { ...op, ...overrides };
    const desiredSlug = merged.slug.trim() ? slugify(merged.slug) : slugify(merged.title);
    const safeSlug = await ensureUniqueSlug(desiredSlug, merged.id);
    const payload: any = {
      ...merged,
      slug: safeSlug,
      document_fields: merged.document_fields.filter((d) => d.label.trim()),
      questions: merged.questions.filter((q) => q.label.trim()),
      // Keep the date it actually closed; only stamp it when it first closes.
      closed_at: merged.status === "closed" ? ((merged as any).closed_at || new Date().toISOString()) : null,
    };
    const { error } = await adminDb().from("matchmaker_opportunities").update(payload).eq("id", op.id);
    if (error) throw error;
    setOp({ ...merged, slug: safeSlug });
    return safeSlug;
  };

  const handleSave = async () => {
    setSaving(true);
    try { await persist(); toast({ title: "Saved" }); }
    catch (e: any) { toast({ title: "Save failed", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handlePreview = async () => {
    try {
      const slug = await persist();
      window.open(buildPreviewUrl(slug), "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast({ title: "Preview failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Archive this opportunity? Applications stay attached. The slug cannot be reused.")) return;
    await adminDb().from("matchmaker_opportunities").update({ status: "archived" }).eq("id", op.id);
    toast({ title: "Archived" });
    navigate("/admin/match-universe/opportunities");
  };

  const handleBin = async () => {
    if (!confirm("Move this opportunity to the bin? You can restore it from the Bin tab.")) return;
    await adminDb().from("matchmaker_opportunities").update({ deleted_at: new Date().toISOString() }).eq("id", op.id);
    toast({ title: "Moved to bin" });
    navigate("/admin/match-universe/opportunities");
  };

  // (state hooks moved above early-return)

  const openCreateGroup = () => {
    setGroupDraftName(`Matchmakers: ${op.title || "Untitled"}`.slice(0, 80));
    setGroupDraftDesc(`Audience for: ${op.title || "Untitled opportunity"}`);
    setGroupDialogOpen(true);
  };

  const createAudienceGroup = async () => {
    if (!groupDraftName.trim()) return;
    setCreatingGroup(true);
    const { data, error } = await adminDb()
      .from("audience_groups")
      .insert({ name: groupDraftName.trim(), description: groupDraftDesc.trim() || null })
      .select("id, name")
      .single();
    setCreatingGroup(false);
    if (error) { toast({ title: "Could not create group", description: error.message, variant: "destructive" }); return; }
    setGroups([data, ...groups]);
    update({ audience_group_id: data.id });
    await adminDb().from("matchmaker_opportunities").update({ audience_group_id: data.id }).eq("id", op.id);
    setGroupDialogOpen(false);
    toast({ title: "Audience group created", description: data.name });
  };

  const saveAsTemplate = async () => {
    const name = saveTplName.trim();
    if (!name) { toast({ title: "Template name is required", variant: "destructive" }); return; }
    const cleaned = op.questions.filter((q) => q.label.trim());
    if (cleaned.length === 0) { toast({ title: "Add at least one question first", variant: "destructive" }); return; }
    setSavingTpl(true);
    const { data, error } = await adminDb()
      .from("matchmaker_question_templates")
      .insert({ name, questions: cleaned })
      .select("id, name, questions")
      .single();
    setSavingTpl(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    setTemplates([{ ...data, questions: Array.isArray(data.questions) ? data.questions : [] } as QuestionTemplate, ...templates]);
    setSaveTplOpen(false);
    toast({ title: "Template saved", description: name });
  };



  const createCampaignFromOpportunity = async () => {
    try {
      const slug = await persist();
      const shareUrl = buildShareUrl(slug, op.link_target);
      const subject = op.title;
      const content = [
        `# ${op.title}`,
        op.location ? `*${op.location}*\n` : "",
        op.summary || "",
        "",
        op.description || "",
        "",
        `[[cta:View opportunity|${shareUrl}]]`,
        "",
        "Know someone right for this? Forward this email — they can apply directly.",
      ].filter(Boolean).join("\n");

      const audienceIds = op.audience_group_id ? [op.audience_group_id] : [];
      const { data, error } = await adminDb()
        .from("campaigns")
        .insert({
          title: `Matchmakers — ${op.title}`,
          subject,
          content,
          status: "draft",
          audience_type: audienceIds.length ? "groups" : "all",
          template: "plain",
          template_data: { audience_group_ids: audienceIds },
        })
        .select("id")
        .single();
      if (error) throw error;
      toast({ title: "Campaign drafted", description: "Opening editor…" });
      navigate(`/admin/campaigns/${data.id}`);
    } catch (e: any) {
      toast({ title: "Could not create campaign", description: e.message, variant: "destructive" });
    }
  };

  const shareUrl = buildShareUrl(op.slug, op.link_target);
  const previewUrl = buildPreviewUrl(op.slug);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        {!embedded && (
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/match-universe/opportunities"><ArrowLeft className="mr-2 h-4 w-4" />All opportunities</Link>
          </Button>
        )}
        <div className={`flex gap-2 flex-wrap ${embedded ? "ml-auto" : ""}`}>
          <Button variant="outline" onClick={handlePreview}><Eye className="mr-2 h-4 w-4" />Preview</Button>
          {/* Embedded under the opportunity's own tabs, which already link here. */}
          {!embedded && (
            <>
              <Button variant="outline" asChild>
                <Link to={`/admin/match-universe/opportunities/${op.id}/applications`}>Applications</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to={`/admin/match-universe/opportunities/${op.id}/matches`}>Matches</Link>
              </Button>
            </>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save
          </Button>
        </div>
      </div>


      <div className="border border-line bg-card p-6 space-y-5">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={op.title} onChange={(e) => update({ title: e.target.value })} className="mt-1" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" value={op.slug} onChange={(e) => update({ slug: e.target.value })} className="mt-1 font-mono text-sm" />
            <p className="text-xs text-muted-foreground mt-1">Saved drafts and previews share this URL.</p>
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <LocationField value={op.location || ""} onChange={(v) => update({ location: v })} className="mt-1" />
          </div>
        </div>

        <div>
          <Label htmlFor="summary">Summary (one-liner)</Label>
          <Input id="summary" value={op.summary || ""} onChange={(e) => update({ summary: e.target.value })} className="mt-1" placeholder="ICU nurse for a private hospital, Lagos Island" />
        </div>

        <div>
          <Label htmlFor="description">About the job</Label>
          <Textarea id="description" rows={5} value={op.description || ""} onChange={(e) => update({ description: e.target.value })} className="mt-1" />
        </div>

        <div>
          <Label htmlFor="role_details">Role details</Label>
          <Textarea id="role_details" rows={4} value={op.role_details || ""} onChange={(e) => update({ role_details: e.target.value })} className="mt-1" placeholder="Hours, compensation range, start date, reporting line…" />
        </div>

        <div>
          <Label htmlFor="requirements">Requirements (free text)</Label>
          <Textarea id="requirements" rows={3} value={op.requirements || ""} onChange={(e) => update({ requirements: e.target.value })} className="mt-1" placeholder="Minimum 3 years ICU experience. Must hold a valid NMCN licence." />
        </div>

        <Separator />

        <div>
          <div className="mb-3">
            <Label>Standard applicant fields</Label>
            <p className="text-xs text-muted-foreground mt-0.5">First name, last name and email are always required. Toggle everything else on or off for this opportunity.</p>
          </div>
          <div className="space-y-2">
            {(["phone", "current_position", "years_experience", "cover_note"] as StandardFieldKey[]).map((k) => {
              const state = op.standard_fields[k];
              return (
                <div key={k} className="flex items-center justify-between gap-3 border border-line bg-card px-4 py-3">
                  <span className="text-sm">{STANDARD_FIELD_LABELS[k]}</span>
                  <Select
                    value={state}
                    onValueChange={(v: StandardFieldState) => update({ standard_fields: { ...op.standard_fields, [k]: v } })}
                  >
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Off</SelectItem>
                      <SelectItem value="optional">Optional</SelectItem>
                      <SelectItem value="required">Required</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div>
              <Label>Applicant questions</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Custom, typed questions. Load from a template or save the current set as one.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value=""
                onValueChange={(tplId) => {
                  const tpl = templates.find((t) => t.id === tplId);
                  if (!tpl) return;
                  const stamped = tpl.questions.map((q) => ({ ...q, id: `q-${Math.random().toString(36).slice(2, 10)}` }));
                  update({ questions: [...op.questions, ...stamped] });
                  toast({ title: "Template loaded", description: `${tpl.name} added ${stamped.length} question${stamped.length === 1 ? "" : "s"}` });
                }}
              >
                <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Load from template" /></SelectTrigger>
                <SelectContent>
                  {templates.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No templates yet</div>
                  ) : templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => { setSaveTplName(op.title || ""); setSaveTplOpen(true); }} disabled={op.questions.length === 0}>
                Save as template
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/match-universe/opportunities/templates">Manage</Link>
              </Button>
            </div>
          </div>
          <QuestionBuilder
            value={op.questions}
            onChange={(q) => update({ questions: q })}
          />
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label>Document uploads</Label>
            <Button variant="outline" size="sm" onClick={() => update({ document_fields: [...op.document_fields, blankDoc()] })}>
              <Plus className="mr-1 h-3.5 w-3.5" />Add field
            </Button>
          </div>
          {op.document_fields.length === 0 && <p className="text-sm text-muted-foreground">No document uploads asked for yet.</p>}
          <div className="space-y-2">
            {op.document_fields.map((d, i) => (
              <div key={d.key} className="flex items-center gap-2">
                <Input
                  value={d.label}
                  onChange={(e) => {
                    const next = [...op.document_fields];
                    next[i] = { ...d, label: e.target.value };
                    update({ document_fields: next });
                  }}
                  placeholder="e.g. CV / Resume"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={d.required}
                    onCheckedChange={(v) => {
                      const next = [...op.document_fields];
                      next[i] = { ...d, required: v };
                      update({ document_fields: next });
                    }}
                  />
                  <span className="text-xs text-muted-foreground w-16">{d.required ? "Required" : "Optional"}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => update({ document_fields: op.document_fields.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Link target</Label>
            <Select value={op.link_target} onValueChange={(v: any) => update({ link_target: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="detail">This opportunity</SelectItem>
                <SelectItem value="landing">Main Matchmakers page</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={op.status} onValueChange={(v: any) => update({ status: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div>
          <Label>Audience group</Label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-2">
            Manually sending this opportunity to a group makes that group its audience. Auto-create one or pick an existing.
          </p>
          <div className="flex gap-2 items-center flex-wrap">
            <Select
              value={op.audience_group_id || "__none"}
              onValueChange={(v) => update({ audience_group_id: v === "__none" ? null : v })}
            >
              <SelectTrigger className="flex-1 min-w-[200px]"><SelectValue placeholder="Pick a group" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">None</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={openCreateGroup}>
              <Plus className="mr-1 h-3.5 w-3.5" />New group
            </Button>
            <Button variant="default" size="sm" onClick={createCampaignFromOpportunity}>
              <Send className="mr-1 h-3.5 w-3.5" />Create campaign
            </Button>
          </div>
        </div>

        <div className="bg-tint/40 border border-line p-4 space-y-3">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-label">Share link</p>
            <div className="flex items-center gap-2">
              <code className="text-sm flex-1 truncate">{shareUrl}</code>
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(shareUrl); toast({ title: "Copied" }); }}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href={shareUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
              </Button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-label">Preview link (drafts visible only to admins)</p>
            <div className="flex items-center gap-2">
              <code className="text-sm flex-1 truncate">{previewUrl}</code>
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(previewUrl); toast({ title: "Copied" }); }}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
              </Button>
            </div>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            <Button variant="ghost" onClick={handleDelete}>
              <Archive className="mr-2 h-4 w-4" />Archive
            </Button>
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={handleBin}>
              <Trash2 className="mr-2 h-4 w-4" />Move to bin
            </Button>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save
          </Button>
        </div>
      </div>

      <Dialog open={saveTplOpen} onOpenChange={setSaveTplOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Save as question template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Template name *</Label>
              <Input value={saveTplName} onChange={(e) => setSaveTplName(e.target.value)} className="mt-1" placeholder="For example, ICU nurse standard questions" />
            </div>
            <p className="text-xs text-muted-foreground">Snapshots the current questions. Editing this template later won't change opportunities already using them.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveTplOpen(false)}>Cancel</Button>
            <Button onClick={saveAsTemplate} disabled={savingTpl || !saveTplName.trim()}>
              {savingTpl ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create audience group</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Group name *</Label>
              <Input value={groupDraftName} onChange={(e) => setGroupDraftName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={groupDraftDesc} onChange={(e) => setGroupDraftDesc(e.target.value)} className="mt-1" placeholder="Optional" />
            </div>
            <p className="text-xs text-muted-foreground">This group will be linked to this opportunity and available across Audience and Campaigns.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGroupDialogOpen(false)}>Cancel</Button>
            <Button onClick={createAudienceGroup} disabled={creatingGroup || !groupDraftName.trim()}>
              {creatingGroup ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MatchmakerEditor;
