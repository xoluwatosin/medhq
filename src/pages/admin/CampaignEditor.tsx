// The campaign editor.
//
// A campaign is now the same thing as any other Medic Connect email: a kind, a
// subject, a preheader and an ordered list of kit blocks. The composing half of
// this screen is the shared block builder, so what a coordinator assembles here
// is exactly what the send renders. Audience, attachments, approval and the
// send statistics are unchanged.
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MuEmpty, MuNote, MuPageHeader, MuStats, MuStatus, MuToolbar } from "@/components/admin/mu/MuShell";
import { SelectField } from "@/components/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Save, Send, Upload, FlaskConical, Check, FileText, Eye, Pencil, Plus, Trash2, ExternalLink } from "lucide-react";
import { adminDb } from "@/lib/admin-utils";
import AudienceGroupManager from "@/components/admin/AudienceGroupManager";
import { format } from "date-fns";
import {
  blocksFromLegacyCampaign,
  blankEmail,
  fromRecipe,
  renderEmail,
  RECIPES,
  sizeWarning,
  validateEmail,
  type BlockInstance,
  type EmailKind,
  type EmailTemplateDoc,
} from "@/lib/email-kit";
import {
  addBlockTo,
  BlockInspector,
  BlockPalette,
  DirectEmailCanvas,
  duplicateBlockIn,
  KitDesignPanel,
  moveBlock,
  RuleReport,
} from "@/components/admin/email-kit/Builder";
import { campaignFunnel, campaignLinkStats, type CampaignFunnel, type LinkStat } from "@/lib/email-analytics";
import { campaignDownloadUrl } from "@/lib/campaign-downloads";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEFAULT_FROM_EMAIL = "hello@medicconnect.co";
const VERIFIED_DOMAIN = "medicconnect.co";

type CampaignAsset = { id?: string; filename: string; displayName?: string; url: string; path: string; size: number };

const CTA_TOKEN = /\[\[cta:([^|\]]+)\|([^|\]]+)(?:\|(left|center|right))?\]\]/g;

function promoteInlineCtas(blocks: BlockInstance[]): { blocks: BlockInstance[]; changed: boolean } {
  let changed = false;
  const promoted: BlockInstance[] = [];
  for (const block of blocks) {
    let current = block;
    for (const [path, value] of Object.entries(block.slots ?? {})) {
      if (!value || !CTA_TOKEN.test(value)) { CTA_TOKEN.lastIndex = 0; continue; }
      CTA_TOKEN.lastIndex = 0;
      const matches = [...value.matchAll(CTA_TOKEN)];
      CTA_TOKEN.lastIndex = 0;
      current = { ...current, slots: { ...current.slots, [path]: value.replace(CTA_TOKEN, "").replace(/\n{3,}/g, "\n\n").trim() } };
      promoted.push(current);
      matches.forEach((match) => promoted.push({
        id: crypto.randomUUID(),
        blockId: "btn-secondary",
        slots: { label: match[1].trim() },
        links: { href: match[2].trim() },
        images: {},
        assetRef: match[2].trim(),
      }));
      changed = true;
      break;
    }
    if (!promoted.includes(current)) promoted.push(current);
  }
  return { blocks: promoted, changed };
}

const FROM_EMAIL_OPTIONS = [
  { value: "hello@medicconnect.co", label: "hello@medicconnect.co", hint: "Recommended, a human inbox" },
  { value: "notifications@medicconnect.co", label: "notifications@medicconnect.co", hint: "Transactional or legacy" },
  { value: "admin@medicconnect.co", label: "admin@medicconnect.co", hint: "Internal or admin" },
  { value: "custom", label: "Custom address", hint: `Must be @${VERIFIED_DOMAIN}` },
];

const FromEmailSelector = ({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) => {
  const isCustom = value && !FROM_EMAIL_OPTIONS.some((o) => o.value !== "custom" && o.value === value);
  const [customValue, setCustomValue] = useState(isCustom ? value : "");
  const selectedValue = isCustom ? "custom" : value || DEFAULT_FROM_EMAIL;

  const handleSelect = (v: string) => {
    if (v === "custom") onChange(customValue || `care@${VERIFIED_DOMAIN}`);
    else onChange(v);
  };

  return (
    <div className="space-y-2">
      <Select value={selectedValue} onValueChange={handleSelect} disabled={disabled}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {FROM_EMAIL_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              <span className="font-medium">{o.label}</span>
              <span className="text-muted-foreground ml-2 text-xs">{o.hint}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedValue === "custom" && (
        <Input
          type="email"
          value={customValue}
          onChange={(e) => { setCustomValue(e.target.value); onChange(e.target.value); }}
          disabled={disabled}
          placeholder={`your-alias@${VERIFIED_DOMAIN}`}
          className="text-xs"
        />
      )}
    </div>
  );
};

function isValidFromEmail(email?: string): boolean {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.toLowerCase().endsWith(`@${VERIFIED_DOMAIN}`);
}

const SubjectCounter = ({ length }: { length: number }) => {
  const tone = length === 0 ? "text-muted-foreground" : length <= 55 ? "text-muted-foreground" : "text-destructive";
  return <p className={`text-xs ${tone}`}>{length} of 55 characters</p>;
};

/* ── Main component ── */
const CampaignEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isSuperAdmin, adminDisplayName, requiresCampaignApproval } = useAuth();
  // Only admins who have been asked to seek approval take that path. Everyone
  // else sends directly, behind the same confirmation.
  const needsApproval = requiresCampaignApproval && !isSuperAdmin;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const loadedRef = useRef(false);

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("draft");
  const [templateData, setTemplateData] = useState<any>({});
  const [audienceType, setAudienceType] = useState("all");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [manualRecipients, setManualRecipients] = useState("");

  // The email itself, in kit form
  const [doc, setDoc] = useState<EmailTemplateDoc>(blankEmail("marketing"));
  const [selected, setSelected] = useState<string | null>(null);
  const [previewWidth, setPreviewWidth] = useState<"desktop" | "mobile">("desktop");
  const [canvasMode, setCanvasMode] = useState<"edit" | "preview">("edit");
  const [converted, setConverted] = useState(false);

  const [stats, setStats] = useState({ total_recipients: 0, total_delivered: 0, total_opened: 0, total_clicked: 0, tracking_enabled: true });
  const [funnel, setFunnel] = useState<CampaignFunnel | null>(null);
  const [linkStats, setLinkStats] = useState<LinkStat[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const attachments: CampaignAsset[] = templateData?.attachments || [];
  const totalAttachmentSize = attachments.reduce((sum: number, a: any) => sum + (a.size || 0), 0);

  const updateTemplateField = (key: string, value: any) =>
    setTemplateData((prev: any) => ({ ...prev, [key]: value }));

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /* ── Load ── */
  useEffect(() => {
    const fetchData = async () => {
      const db = adminDb();
      const [campRes, groupRes] = await Promise.all([
        db.from("campaigns").select("*").eq("id", id).single(),
        db.from("audience_groups").select("id, name").order("created_at"),
      ]);
      if (campRes.error) {
        toast({ title: "Error", description: campRes.error.message, variant: "destructive" });
        navigate("/admin/campaigns");
        return;
      }
      const c: any = campRes.data;
      setTitle(c.title || "");
      setStatus(c.status || "draft");
      setTemplateData(c.template_data || {});
      setAudienceType(c.audience_type || "all");
      setSelectedGroupIds((c.template_data as any)?.audience_group_ids || c.manual_recipients || []);
      setManualRecipients(
        c.audience_type === "manual" && c.manual_recipients?.length
          ? (c.manual_recipients as string[]).join("\n")
          : "",
      );

      const kind: EmailKind = c.kind === "transactional" ? "transactional" : "marketing";
      const existing = Array.isArray(c.blocks) ? (c.blocks as BlockInstance[]) : [];
      if (existing.length) {
        const promoted = promoteInlineCtas(existing);
        setDoc({ name: c.title || "Campaign", kind, subject: c.subject || "", preheader: c.preheader || "", blocks: promoted.blocks });
        if (promoted.changed) setConverted(true);
      } else {
        // Nothing in the archive is lost: the old copy becomes kit blocks.
        const promoted = promoteInlineCtas(blocksFromLegacyCampaign({ content: c.content, templateData: c.template_data, kind }));
        setDoc({
          name: c.title || "Campaign",
          kind,
          subject: c.subject || "",
          preheader: c.preheader || "",
          blocks: promoted.blocks,
        });
        if (c.content || promoted.changed) setConverted(true);
      }

      setStats({
        total_recipients: c.total_recipients || 0,
        total_delivered: c.total_delivered || 0,
        total_opened: c.total_opened || 0,
        total_clicked: c.total_clicked || 0,
        tracking_enabled: (c as any).tracking_enabled !== false,
      });
      setGroups(groupRes.data || []);
      loadedRef.current = true;
      setLoading(false);

      setTimeout(() => {
        if (!(c.template_data as any)?.from_email) updateTemplateField("from_email", DEFAULT_FROM_EMAIL);
      }, 0);
    };
    fetchData();
  }, [id]);

  // Engagement detail for sent campaigns: the funnel and per-link clicks come
  // from the event stream, deduplicated to unique people.
  useEffect(() => {
    if (!id || status !== "sent") return;
    campaignFunnel(id).then(setFunnel);
    campaignLinkStats(id).then(setLinkStats);
  }, [id, status]);

  useEffect(() => {
    if (loadedRef.current) setIsDirty(true);
  }, [title, doc, audienceType, manualRecipients, templateData, selectedGroupIds]);

  /* ── Kit state ── */
  const problems = useMemo(() => validateEmail(doc), [doc]);
  const errors = problems.filter((p) => p.severity !== "warning");
  const clipWarning = useMemo(() => sizeWarning(doc), [doc]);
  const current = doc.blocks.find((b) => b.id === selected) ?? null;

  const patchDoc = (patch: Partial<EmailTemplateDoc>) => setDoc((d) => ({ ...d, ...patch }));
  const setBlocks = (blocks: BlockInstance[]) => setDoc((d) => ({ ...d, blocks }));
  const patchBlock = (blockInstanceId: string, patch: Partial<BlockInstance>) =>
    setDoc((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === blockInstanceId ? { ...b, ...patch } : b)) }));

  const addBlock = (blockId: string) => {
    const { blocks, instance } = addBlockTo(doc.blocks, blockId, selected);
    setBlocks(blocks);
    setSelected(instance.id);
  };

  const startFromRecipe = (recipeId: string) => {
    const next = fromRecipe(recipeId);
    if (!next) return;
    setDoc((d) => ({ ...d, kind: next.kind, blocks: next.blocks }));
    setSelected(next.blocks[1]?.id ?? null);
    setConverted(false);
  };

  /* ── Payload ── */
  const buildPayload = useCallback(() => ({
    title,
    subject: doc.subject,
    preheader: doc.preheader,
    kind: doc.kind,
    blocks: doc.blocks as any,
    content: renderEmail(doc).text,
    audience_type: audienceType,
    template: "kit",
    template_data: { ...templateData, audience_group_ids: selectedGroupIds },
    manual_recipients: audienceType === "manual"
      ? manualRecipients.split(/[\n,]+/).map((e) => e.trim()).filter(Boolean)
      : audienceType === "groups"
        ? selectedGroupIds
        : [],
    last_edited_by: user?.id,
    last_edited_by_name: adminDisplayName || user?.email || "",
  }), [title, doc, audienceType, templateData, selectedGroupIds, manualRecipients, user, adminDisplayName]);

  /* ── Auto-save ── */
  const autoSave = useCallback(async () => {
    if (!isDirty || !title.trim() || status === "sent") return;
    setAutoSaving(true);
    try {
      const { error } = await adminDb().from("campaigns").update(buildPayload()).eq("id", id);
      if (!error) { setIsDirty(false); setLastAutoSaved(new Date()); setConverted(false); }
    } catch { /* silent */ } finally { setAutoSaving(false); }
  }, [isDirty, title, status, buildPayload, id]);

  useEffect(() => {
    if (status === "sent") return;
    const interval = setInterval(autoSave, 30000);
    return () => clearInterval(interval);
  }, [autoSave, status]);

  const saveDraft = async () => {
    if (!title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await adminDb().from("campaigns").update(buildPayload()).eq("id", id);
    setSaving(false);
    if (error) toast({ title: "Error saving", description: error.message, variant: "destructive" });
    else { setIsDirty(false); setConverted(false); toast({ title: "Draft saved" }); }
  };

  const readyToSend = () => {
    if (!title.trim() || !doc.subject.trim() || doc.blocks.length === 0) {
      toast({ title: "Give the campaign a title, a subject and some blocks", variant: "destructive" });
      return false;
    }
    if (errors.length) {
      toast({ title: "Fix the flagged items first", description: errors[0].message, variant: "destructive" });
      return false;
    }
    if (!isValidFromEmail(templateData?.from_email)) {
      toast({ title: "Invalid sender address", description: `From email must be a verified @${VERIFIED_DOMAIN} address.`, variant: "destructive" });
      return false;
    }
    return true;
  };

  const sendCampaign = async () => {
    if (!readyToSend()) return;
    setSending(true);
    try {
      await adminDb().from("campaigns").update(buildPayload()).eq("id", id);
      const { data, error } = await supabase.functions.invoke("send-campaign", { body: { campaignId: id } });
      if (error) throw error;
      setIsDirty(false);
      toast({ title: "Campaign sent", description: `Sent to ${data?.totalSent ?? 0} recipients.` });
      setStatus("sent");
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  const submitForApproval = async () => {
    if (!readyToSend()) return;
    const { error } = await adminDb().from("campaigns").update({ ...buildPayload(), approval_status: "pending", approval_note: null }).eq("id", id);
    if (error) {
      toast({ title: "Could not submit", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Submitted for approval" });
    navigate("/admin/campaigns");
  };

  const sendTest = async () => {
    if (!testEmail.trim()) { toast({ title: "Enter an email address", variant: "destructive" }); return; }
    if (!readyToSend()) return;
    setSendingTest(true);
    try {
      await adminDb().from("campaigns").update(buildPayload()).eq("id", id);
      const { error } = await supabase.functions.invoke("send-campaign", {
        body: { campaignId: id, testMode: true, testEmail: testEmail.trim() },
      });
      if (error) throw error;
      toast({ title: "Test email sent", description: `Check ${testEmail.trim()}` });
    } catch (err: any) {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    }
    setSendingTest(false);
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) { toast({ title: "Only PDF files are allowed", variant: "destructive" }); return; }
    if (file.size > 10 * 1024 * 1024) { toast({ title: "File too large", description: "Max 10MB per file", variant: "destructive" }); return; }
    if (totalAttachmentSize + file.size > 35 * 1024 * 1024) { toast({ title: "Total attachments too large", description: "Combined size would exceed 35MB limit", variant: "destructive" }); return; }
    setUploadingAttachment(true);
    const path = `campaigns/attachments/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("blog-images").upload(path, file);
    if (error) toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    else {
      updateTemplateField("attachments", [...attachments, {
        id: crypto.randomUUID(),
        filename: file.name,
        displayName: file.name.replace(/\.pdf$/i, ""),
        url: campaignDownloadUrl(path, file.name),
        path,
        size: file.size,
      }]);
    }
    setUploadingAttachment(false);
    e.target.value = "";
  };

  const removeAttachment = async (index: number) => {
    const att = attachments[index];
    if (att?.path) await supabase.storage.from("blog-images").remove([att.path]);
    updateTemplateField("attachments", attachments.filter((_: any, i: number) => i !== index));
  };

  const insertPdfButton = (index: number) => {
    const att = attachments[index];
    if (!att?.url) return;
    const button: BlockInstance = {
      id: crypto.randomUUID(), blockId: "btn-secondary", images: {},
      slots: { label: `Download ${att.displayName || att.filename.replace(/\.pdf$/i, "")}` },
      links: { href: att.url }, assetRef: att.id || att.path || att.url,
    };
    const selectedIndex = doc.blocks.findIndex((block) => block.id === selected);
    const at = selectedIndex >= 0 ? selectedIndex + 1 : Math.max(0, doc.blocks.findIndex((block) => block.blockId.startsWith("ft-")));
    const next = [...doc.blocks];
    next.splice(at < 0 ? next.length : at, 0, button);
    setBlocks(next);
    setSelected(button.id);
    setCanvasMode("edit");
    toast({ title: "PDF button inserted", description: "The file remains in Assets so you can reuse, replace or delete it." });
  };

  const renameAsset = (index: number, name: string) => {
    updateTemplateField("attachments", attachments.map((asset, i) => i === index ? { ...asset, displayName: name } : asset));
  };

  const replaceAsset = async (index: number, file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) { toast({ title: "Only PDF files are allowed", variant: "destructive" }); return; }
    const old = attachments[index];
    const path = `campaigns/attachments/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("blog-images").upload(path, file);
    if (error) { toast({ title: "Replace failed", description: error.message, variant: "destructive" }); return; }
    const url = campaignDownloadUrl(path, file.name);
    const ref = old.id || old.path || old.url;
    setBlocks(doc.blocks.map((block) => block.assetRef === ref || block.links?.href === old.url
      ? { ...block, assetRef: old.id || path, links: { ...block.links, href: url } }
      : block));
    updateTemplateField("attachments", attachments.map((asset, i) => i === index ? { ...asset, id: asset.id || path, filename: file.name, url, path, size: file.size } : asset));
    if (old.path) await supabase.storage.from("blog-images").remove([old.path]);
    toast({ title: "PDF replaced", description: "Every button using it now points to the new file." });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const isSent = status === "sent";
  const isEditable = !isSent;
  const showJourney = isSent && !!funnel && stats.tracking_enabled && funnel.sent > 0;

  const recipientCount = audienceType === "all"
    ? "all contacts"
    : audienceType === "groups"
      ? `${selectedGroupIds.length} group${selectedGroupIds.length !== 1 ? "s" : ""}`
      : manualRecipients.split(/[\n,]+/).map((e) => e.trim()).filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <MuPageHeader
        title={title || "Untitled campaign"}
        backTo="/admin/campaigns"
        backLabel="Campaigns"
        actions={
          <>
            {isEditable && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {autoSaving ? <><Loader2 className="h-3 w-3 animate-spin" />Saving</> : lastAutoSaved ? <><Check className="h-3 w-3" />Auto-saved {format(lastAutoSaved, "HH:mm")}</> : null}
              </span>
            )}
            <MuStatus label={status} tone={isSent ? "good" : "neutral"} />
          </>
        }
      />

      {converted && isEditable && (
        <MuNote title="Converted to kit blocks">Save the draft to keep the conversion.</MuNote>
      )}

      {/* Sent stats. The journey below repeats these numbers with rates, so
          the tiles stand in only when there is no tracked journey to show. */}
      {isSent && !showJourney && (
        <MuStats
          columns={4}
          stats={[
            { label: "Recipients", value: stats.total_recipients, tracked: true },
            { label: "Delivered", value: stats.total_delivered, tracked: true },
            { label: "Opened", value: stats.total_opened, tracked: stats.tracking_enabled },
            { label: "Clicked", value: stats.total_clicked, tracked: stats.tracking_enabled },
          ].map((s) => s.tracked
            ? { label: s.label, value: s.value }
            : { label: s.label, value: "Not tracked", hint: s.label === "Opened" ? "Sent before tracking was switched on." : undefined })}
        />
      )}

      {/* Funnel: how far each email actually travelled */}
      {showJourney && funnel && (
        <div className="border border-line bg-card p-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-label">Journey</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
            {([
              ["Sent", funnel.sent, null],
              ["Delivered", funnel.delivered, funnel.sent],
              ["Opened", funnel.opened, funnel.delivered],
              ["Clicked", funnel.clicked, funnel.delivered],
              ["Profile claimed", funnel.claimed, funnel.delivered],
            ] as [string, number, number | null][]).map(([label, value, base], i) => (
              <span key={label} className="flex items-center gap-2">
                {i > 0 && <span className="text-muted-foreground">→</span>}
                <span className="border border-line px-3 py-1">
                  <span className="font-medium">{value}</span> {label.toLowerCase()}
                  {base != null && base > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">({Math.round((value / base) * 100)}%)</span>
                  )}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Which links people actually clicked */}
      {isSent && linkStats.length > 0 && (
        <div className="border border-line bg-card p-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-label">Clicks by link</p>
          <div className="divide-y divide-line-soft text-sm">
            {linkStats.map((l) => (
              <div key={l.url} className="flex items-center justify-between gap-4 py-2">
                <span className="truncate text-muted-foreground" title={l.url}>{l.url}</span>
                <span className="shrink-0 font-medium">
                  {l.uniqueClickers} {l.uniqueClickers === 1 ? "person" : "people"}
                  {l.clicks > l.uniqueClickers && <span className="ml-1 text-xs text-muted-foreground">({l.clicks} clicks)</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Set-up */}
      <div className="border border-line bg-card p-4">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-label">Sender</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Campaign title, internal</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={isSent} placeholder="For example, March newsletter" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Sender name</Label>
            <Input placeholder="Medic Connect" value={templateData?.sender_name || ""} onChange={(e) => updateTemplateField("sender_name", e.target.value)} disabled={isSent} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">From email</Label>
            <FromEmailSelector value={templateData?.from_email || ""} onChange={(v) => updateTemplateField("from_email", v)} disabled={isSent} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Reply-to</Label>
            <Input type="email" placeholder="hello@medicconnect.co" value={templateData?.reply_to || ""} onChange={(e) => updateTemplateField("reply_to", e.target.value)} disabled={isSent} />
          </div>
        </div>
      </div>

      {/* Builder */}
      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        {isEditable ? (
          <aside className="order-3 space-y-4 xl:order-1 xl:sticky xl:top-4 xl:self-start">
            <BlockPalette onAdd={addBlock} height="40vh" />
            <div className="border border-line bg-card">
              <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">PDF assets</p>
                <label className="cursor-pointer">
                  <Button asChild variant="outline" size="icon" className="h-8 w-8" title="Upload PDF" aria-label="Upload PDF">
                    <span>{uploadingAttachment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</span>
                  </Button>
                  <input type="file" accept=".pdf" className="hidden" disabled={uploadingAttachment} onChange={handleAttachmentUpload} />
                </label>
              </div>
              <div className="space-y-3 p-3">
                {attachments.length === 0 && <MuEmpty title="No PDFs yet" description="Upload a PDF to link it from a button in the email." />}
                {attachments.map((att, i) => (
                  <div key={att.id || att.path || i} className="space-y-2 border border-line p-3">
                    <div className="flex items-start gap-2">
                      <FileText className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <Input
                          value={att.displayName || att.filename.replace(/\.pdf$/i, "")}
                          onChange={(event) => renameAsset(i, event.target.value)}
                          className="h-8"
                          aria-label={`Display name for ${att.filename}`}
                        />
                        <p className="mt-1 truncate text-xs text-muted-foreground" title={att.filename}>{att.filename}, {formatFileSize(att.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-8 flex-1 gap-1" onClick={() => insertPdfButton(i)}>
                        <Plus className="h-3.5 w-3.5" /> Insert
                      </Button>
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Open PDF">
                        <a href={att.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                      <label className="cursor-pointer">
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Replace PDF">
                          <span><Upload className="h-3.5 w-3.5" /></span>
                        </Button>
                        <input type="file" accept=".pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) replaceAsset(i, file); event.target.value = ""; }} />
                      </label>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete PDF"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete this PDF?</AlertDialogTitle><AlertDialogDescription>This removes the uploaded file. Any buttons using it will also be removed so the email cannot contain broken links.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Keep PDF</AlertDialogCancel><AlertDialogAction onClick={() => { const ref = att.id || att.path || att.url; setBlocks(doc.blocks.filter((block) => block.assetRef !== ref && block.links?.href !== att.url)); removeAttachment(i); }}>Delete file and buttons</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
                {attachments.length > 0 && <p className="text-xs text-muted-foreground">{formatFileSize(totalAttachmentSize)} stored</p>}
              </div>
            </div>
          </aside>
        ) : <div />}

        <section className="order-1 min-w-0 space-y-4 xl:order-2">
          <div className="border border-line bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Subject line</Label>
                <Input value={doc.subject} onChange={(e) => patchDoc({ subject: e.target.value })} disabled={isSent} placeholder="What lands in the inbox" />
                <SubjectCounter length={doc.subject.length} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Preheader</Label>
                <Input value={doc.preheader} onChange={(e) => patchDoc({ preheader: e.target.value })} disabled={isSent} placeholder="The line that continues the subject, never repeats it" />
                <p className="text-xs text-muted-foreground">{doc.preheader.length} of 90 characters</p>
              </div>
            </div>
            {isEditable && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">Start from a recipe</span>
                <SelectField
                  label="Recipe"
                  hideLabel
                  value=""
                  onChange={(v) => { if (v) startFromRecipe(v); }}
                  placeholder="Choose a recipe"
                  options={RECIPES.map((r) => ({ value: r.id, label: r.name }))}
                  className="w-64"
                />
                <SelectField
                  label="Kind"
                  hideLabel
                  value={doc.kind}
                  onChange={(v) => { if (v) patchDoc({ kind: v as EmailKind }); }}
                  options={[
                    { value: "marketing", label: "Marketing" },
                    { value: "transactional", label: "Transactional" },
                  ]}
                  className="w-44"
                />
              </div>
            )}
          </div>

          {isEditable && <KitDesignPanel doc={doc} onBlocks={setBlocks} width={previewWidth} onWidth={setPreviewWidth} />}

          <RuleReport problems={problems} clipWarning={clipWarning} />

          <div className="border border-line bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">Email canvas</p>
              <Tabs value={isEditable ? canvasMode : "preview"} onValueChange={(value) => setCanvasMode(value as "edit" | "preview")}>
                <TabsList>
                  {isEditable && <TabsTrigger value="edit" className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit email</TabsTrigger>}
                  <TabsTrigger value="preview" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> Check final</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <DirectEmailCanvas
              doc={doc}
              selected={selected}
              onSelect={(blockId) => { setSelected(blockId); setCanvasMode("edit"); }}
              onPreviewSelect={(blockId) => { setSelected(blockId); setCanvasMode("edit"); }}
              onMove={(blockId, delta) => setBlocks(moveBlock(doc.blocks, blockId, delta))}
              onDuplicate={(blockId) => setBlocks(duplicateBlockIn(doc.blocks, blockId))}
              onRemove={(blockId) => { setBlocks(doc.blocks.filter((block) => block.id !== blockId)); setSelected(null); }}
              width={previewWidth}
              preview={!isEditable || canvasMode === "preview"}
              editor={current ? (
                <div className="xl:hidden">
                  <BlockInspector current={current} onChange={(patch) => patchBlock(current.id, patch)} height="auto" />
                </div>
              ) : null}
            />
          </div>
        </section>

        {isEditable ? (
          <div className="order-2 hidden xl:order-3 xl:sticky xl:top-4 xl:block xl:self-start"><BlockInspector current={current} onChange={(patch) => current && patchBlock(current.id, patch)} /></div>
        ) : <div />}
      </div>

      {/* Audience */}
      <div className="space-y-3 border border-line bg-card p-4">
        <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">Audience</Label>
        <RadioGroup value={audienceType} onValueChange={(v) => { setAudienceType(v); if (v !== "groups") setSelectedGroupIds([]); }} disabled={isSent}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all" id="aud-all" />
            <Label htmlFor="aud-all" className="font-normal">All contacts</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="groups" id="aud-groups" />
            <Label htmlFor="aud-groups" className="font-normal">Select groups</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="manual" id="aud-manual" />
            <Label htmlFor="aud-manual" className="font-normal">Manual entry</Label>
          </div>
        </RadioGroup>

        {audienceType === "groups" && (
          <div className="space-y-2">
            {groups.length > 0 ? (
              <div className="space-y-2 border border-line p-3">
                {groups.map((g) => (
                  <label key={g.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.includes(g.id)}
                      onChange={(e) => setSelectedGroupIds((prev) => e.target.checked ? [...prev, g.id] : prev.filter((x) => x !== g.id))}
                      disabled={isSent}
                      className="border-primary"
                    />
                    {g.name}
                  </label>
                ))}
                {selectedGroupIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedGroupIds.length} group{selectedGroupIds.length !== 1 ? "s" : ""} selected</p>
                )}
              </div>
            ) : (
              <div className="border border-dashed border-line"><MuEmpty title="No groups yet" description="Create a group to start sending." /></div>
            )}
            <AudienceGroupManager
              groups={groups}
              selectedGroupIds={selectedGroupIds}
              disabled={isSent}
              onGroupsChanged={async () => {
                const { data } = await adminDb().from("audience_groups").select("id, name").order("created_at");
                setGroups(data || []);
              }}
              onGroupCreated={(g) => setSelectedGroupIds((prev) => prev.includes(g.id) ? prev : [...prev, g.id])}
            />
          </div>
        )}

        {audienceType === "manual" && (
          <div className="space-y-2">
            <Textarea
              placeholder="Enter email addresses, one per line or comma-separated"
              className="min-h-[100px]"
              value={manualRecipients}
              onChange={(e) => setManualRecipients(e.target.value)}
              disabled={isSent}
            />
            {manualRecipients.trim() && (
              <p className="text-xs text-muted-foreground">
                {manualRecipients.split(/[\n,]+/).map((e) => e.trim()).filter(Boolean).length} recipients
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {isEditable && (
        <MuToolbar>
          <Button onClick={saveDraft} disabled={saving || sending} variant="outline" className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save draft
          </Button>
          <div className="flex items-center gap-2">
            <Input type="email" placeholder="test@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="w-48" />
            <Button variant="outline" className="gap-2" onClick={sendTest} disabled={sendingTest}>
              {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Send test
            </Button>
          </div>
          {needsApproval ? (
            <Button onClick={submitForApproval} disabled={saving || sending} className="gap-2">
              <Send className="h-4 w-4" />Submit for approval
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={saving || sending} className="gap-2">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send now
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Send this campaign?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will send "{doc.subject || title}" to <span className="font-semibold">{recipientCount}</span> recipients. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={sendCampaign}>Yes, send now</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </MuToolbar>
      )}
    </div>
  );
};

export default CampaignEditor;
