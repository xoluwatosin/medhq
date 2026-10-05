// The block builder, shared by the email template library and the campaign
// editor. One editor, used twice: a palette of kit blocks, the email being
// assembled, and an inspector for whichever block is selected.
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Copy,
  FileText,
  GripVertical,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BLOCK_BY_ID,
  blockFields,
  newInstance,
  type BlockInstance,
  type EmailTemplateDoc,
  type Field,
  type RuleViolation,
  renderEmail,
} from "@/lib/email-kit";

export const GROUP_ORDER: { id: string; label: string }[] = [
  { id: "masthead", label: "Mastheads" },
  { id: "text", label: "Copy" },
  { id: "button", label: "Buttons" },
  { id: "campaign", label: "Campaign" },
  { id: "utility", label: "Transactional" },
  { id: "small", label: "Small parts" },
  { id: "footer", label: "Footers" },
];

const ALL = Object.values(BLOCK_BY_ID);

/* ── Pure operations on a block list, so both editors behave identically ── */

export function addBlockTo(
  blocks: BlockInstance[],
  blockId: string,
  selectedId: string | null,
): { blocks: BlockInstance[]; instance: BlockInstance } {
  const instance = newInstance(blockId);
  const group = BLOCK_BY_ID[blockId]?.group;
  const next = [...blocks];
  if (group === "footer") next.push(instance);
  else if (group === "masthead") next.unshift(instance);
  else {
    const at = selectedId ? next.findIndex((b) => b.id === selectedId) : -1;
    const footerAt = next.findIndex((b) => BLOCK_BY_ID[b.blockId]?.group === "footer");
    const target = at >= 0 ? at + 1 : footerAt >= 0 ? footerAt : next.length;
    next.splice(target, 0, instance);
  }
  return { blocks: next, instance };
}

export function moveBlock(blocks: BlockInstance[], id: string, delta: number): BlockInstance[] {
  const next = [...blocks];
  const at = next.findIndex((b) => b.id === id);
  const to = at + delta;
  if (at < 0 || to < 0 || to >= next.length) return blocks;
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

/** Drag and drop reorder: toIndex is the gap the block drops into, counted
 *  against the list as it looked before the drag started. */
export function reorderBlock(blocks: BlockInstance[], id: string, toIndex: number): BlockInstance[] {
  const from = blocks.findIndex((b) => b.id === id);
  if (from < 0) return blocks;
  const next = [...blocks];
  const [item] = next.splice(from, 1);
  let at = from < toIndex ? toIndex - 1 : toIndex;
  at = Math.max(0, Math.min(at, next.length));
  next.splice(at, 0, item);
  return next;
}

/** A palette block dropped straight onto a gap in the canvas. */
export function insertBlockAt(
  blocks: BlockInstance[],
  blockId: string,
  index: number,
): { blocks: BlockInstance[]; instance: BlockInstance } {
  const instance = newInstance(blockId);
  const next = [...blocks];
  const at = Math.max(0, Math.min(index, next.length));
  next.splice(at, 0, instance);
  return { blocks: next, instance };
}

export function duplicateBlockIn(blocks: BlockInstance[], id: string): BlockInstance[] {
  const at = blocks.findIndex((b) => b.id === id);
  if (at < 0) return blocks;
  const source = blocks[at];
  const copy: BlockInstance = {
    ...source,
    id: crypto.randomUUID(),
    slots: { ...source.slots },
    links: { ...source.links },
    images: { ...source.images },
  };
  const next = [...blocks];
  next.splice(at + 1, 0, copy);
  return next;
}

/** Swap the single block of a group for another, keeping its position. */
export function swapGroupBlock(
  blocks: BlockInstance[],
  group: string,
  blockId: string,
): BlockInstance[] {
  const at = blocks.findIndex((b) => BLOCK_BY_ID[b.blockId]?.group === group);
  const instance = newInstance(blockId);
  if (at < 0) {
    const { blocks: next } = addBlockTo(blocks, blockId, null);
    return next;
  }
  const next = [...blocks];
  // carry across any copy the coordinator already wrote for shared slot names
  const old = next[at];
  instance.slots = { ...instance.slots, ...pickShared(instance.slots, old.slots) };
  instance.links = { ...instance.links, ...pickShared(instance.links, old.links) };
  next[at] = instance;
  return next;
}

function pickShared<T>(target: Record<string, T>, source: Record<string, T> = {}) {
  const out: Record<string, T> = {};
  for (const key of Object.keys(target)) if (source[key] !== undefined) out[key] = source[key];
  return out;
}

/* ── Palette ── */

export const BlockPalette = ({
  onAdd,
  height = "70vh",
}: {
  onAdd: (blockId: string) => void;
  height?: string;
}) => (
  <aside className="border border-line bg-card">
    <p className="border-b border-line-soft px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-label">Blocks</p>
    <ScrollArea style={{ height }}>
      <div className="space-y-4 p-3">
        {GROUP_ORDER.map((group) => {
          const blocks = ALL.filter((b) => b.group === group.id);
          if (!blocks.length) return null;
          return (
            <div key={group.id}>
              <p className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-1">
                {blocks.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onAdd(b.id)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-mc-new-block", b.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className="flex w-full cursor-grab items-center justify-between px-2 py-1.5 text-left text-sm hover:bg-muted"
                    title="Click to add, or drag onto the email"
                  >
                    <span>{b.name}</span>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  </aside>
);

/* ── Canvas: the ordered block list ── */

export const BlockCanvas = ({
  blocks,
  selected,
  onSelect,
  onMove,
  onReorder,
  onInsertAt,
  onDuplicate,
  onRemove,
  title = "The email",
}: {
  blocks: BlockInstance[];
  selected: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, delta: number) => void;
  /** Drop a block into an exact gap. Without it the canvas is click-only. */
  onReorder?: (id: string, toIndex: number) => void;
  /** A palette block dragged straight onto the canvas. */
  onInsertAt?: (blockId: string, index: number) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  title?: string;
}) => {
  const [dropGap, setDropGap] = useState<number | null>(null);
  const acceptsDrop = Boolean(onReorder || onInsertAt);

  const gapFromEvent = (e: DragEvent<HTMLDivElement>, i: number): number => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? i : i + 1;
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const gap = dropGap ?? blocks.length;
    const newBlockId = e.dataTransfer.getData("application/x-mc-new-block");
    const moveId = e.dataTransfer.getData("application/x-mc-move-block");
    if (newBlockId && onInsertAt) onInsertAt(newBlockId, gap);
    else if (moveId && onReorder) onReorder(moveId, gap);
    setDropGap(null);
  };

  return (
    <div className="border border-line bg-card">
      <p className="border-b border-line-soft px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-label">{title}</p>
      <div
        className="space-y-1 p-3"
        onDragOver={acceptsDrop ? (e) => e.preventDefault() : undefined}
        onDrop={acceptsDrop ? handleDrop : undefined}
      >
        {blocks.length === 0 && (
          <p className="px-1 py-4 text-sm text-muted-foreground">
            Add a masthead, your copy and a footer from the left.
          </p>
        )}
        {blocks.map((b, i) => (
          <div key={b.id}>
            {dropGap === i && <div className="mx-1 mb-1 h-0.5 bg-primary" />}
            <div
              onClick={() => onSelect(b.id)}
              draggable={Boolean(onReorder)}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-mc-move-block", b.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setDropGap(null)}
              onDragOver={acceptsDrop ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropGap(gapFromEvent(e, i)); } : undefined}
              className={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-sm ${
                selected === b.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"
              }`}
            >
              {onReorder ? (
                <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="flex-1">{BLOCK_BY_ID[b.blockId]?.name ?? b.blockId}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onMove(b.id, -1); }} disabled={i === 0}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onMove(b.id, 1); }} disabled={i === blocks.length - 1}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onDuplicate(b.id); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(b.id); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {acceptsDrop && dropGap === blocks.length && blocks.length > 0 && (
          <div className="mx-1 h-0.5 bg-primary" />
        )}
        {acceptsDrop && blocks.length > 0 && (
          <p className="px-1 pt-1 text-xs text-muted-foreground">
            Drag a block to reorder it, or drag one in from the palette.
          </p>
        )}
      </div>
    </div>
  );
};

/* ── Direct email canvas ── */

export const DirectEmailCanvas = ({
  doc,
  selected,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
  width,
  preview,
  editor,
  onPreviewSelect,
}: {
  doc: EmailTemplateDoc;
  selected: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, delta: number) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  width: "desktop" | "mobile";
  preview: boolean;
  editor?: ReactNode;
  onPreviewSelect?: (id: string) => void;
}) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const html = renderEmail(doc).html;
  const selectedIndex = doc.blocks.findIndex((block) => block.id === selected);

  const wireFrame = () => {
    const frameDocument = frameRef.current?.contentDocument;
    if (!frameDocument) return;
    frameDocument.querySelectorAll<HTMLElement>("[data-mc-block]").forEach((element) => {
      const id = element.dataset.mcBlock;
      element.style.cursor = "pointer";
      element.style.outline = !preview && id === selected ? "3px solid #3B4DC4" : "none";
      element.style.outlineOffset = "-3px";
      element.onclick = (event) => {
        if (!id) return;
        event.preventDefault();
        event.stopPropagation();
        if (preview) onPreviewSelect?.(id);
        else onSelect(id);
      };
      if (!preview) {
        element.onmouseenter = () => {
          if (id !== selected) element.style.outline = "2px dashed #3B4DC4";
        };
        element.onmouseleave = () => {
          element.style.outline = id === selected ? "3px solid #3B4DC4" : "none";
        };
      }
    });
    frameDocument.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
      link.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const block = link.closest<HTMLElement>("[data-mc-block]");
        const id = block?.dataset.mcBlock;
        if (!id) return;
        if (preview) onPreviewSelect?.(id);
        else onSelect(id);
      };
    });
  };

  useEffect(wireFrame, [html, preview, selected, onPreviewSelect]);

  return (
    <div className="space-y-2">
      {!preview && selected && selectedIndex >= 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border bg-card px-3 py-2">
          <p className="text-sm font-medium">{BLOCK_BY_ID[doc.blocks[selectedIndex].blockId]?.name ?? "Email element"}</p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Move up" onClick={() => onMove(selected, -1)} disabled={selectedIndex === 0}><ArrowUp className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Move down" onClick={() => onMove(selected, 1)} disabled={selectedIndex === doc.blocks.length - 1}><ArrowDown className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicate" onClick={() => onDuplicate(selected)}><Copy className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete" onClick={() => onRemove(selected)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
      {!preview && !selected && (
        <div className="flex items-center gap-2 border bg-card px-3 py-2 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" /> Select anything in the email to edit it.
        </div>
      )}
      {!preview && selected && editor}
      <div className="flex justify-center overflow-hidden bg-muted/30 p-3">
        <iframe
          ref={frameRef}
          title={preview ? "Campaign preview" : "Editable campaign"}
          srcDoc={html}
          onLoad={wireFrame}
          className="h-[74vh] w-full bg-background"
          style={{ maxWidth: width === "mobile" ? 380 : 640 }}
        />
      </div>
    </div>
  );
};

/* ── Inspector ── */

export const BlockInspector = ({
  current,
  onChange,
  height = "70vh",
}: {
  current: BlockInstance | null;
  onChange: (patch: Partial<BlockInstance>) => void;
  height?: string;
}) => (
  <aside className="border border-line bg-card">
    <p className="border-b border-line-soft px-4 py-3 text-sm font-semibold text-navy">
      {current ? BLOCK_BY_ID[current.blockId]?.name ?? current.blockId : "Nothing selected"}
    </p>
    <ScrollArea style={{ height }}>
      <div className="space-y-4 p-4">
        {!current && (
          <p className="text-sm text-muted-foreground">
            Pick a block in the middle column to write its copy.
          </p>
        )}
        {current && BLOCK_BY_ID[current.blockId]?.notes && (
          <p className="bg-muted px-3 py-2 text-xs text-muted-foreground">
            {BLOCK_BY_ID[current.blockId]?.notes}
          </p>
        )}
        {current &&
          blockFields(current.blockId).map((field) => (
            <FieldInput
              key={field.path}
              field={field}
              instance={current}
              onChange={onChange}
            />
          ))}
      </div>
    </ScrollArea>
  </aside>
);

/* ── Rule report ── */

export const RuleReport = ({
  problems,
  clipWarning,
}: {
  problems: RuleViolation[];
  clipWarning?: string | null;
}) => {
  const errors = problems.filter((p) => p.severity !== "warning");
  const warnings = problems.filter((p) => p.severity === "warning");
  if (!errors.length && !warnings.length && !clipWarning) return null;
  return (
    <div className="space-y-1.5 border border-line bg-card p-4">
      {errors.map((p, i) => (
        <p key={`e${i}`} className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{p.message}
        </p>
      ))}
      {warnings.map((p, i) => (
        <p key={`w${i}`} className="flex items-start gap-2 text-sm text-amber-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{p.message}
        </p>
      ))}
      {clipWarning && (
        <p className="flex items-start gap-2 text-sm text-amber-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{clipWarning}
        </p>
      )}
    </div>
  );
};

/* ── Design panel, kit only ──
   No colour picker, no fonts, no sizes. The choices here are which kit block
   carries the masthead, the footer and the primary button, plus the width the
   preview is checked at. */

const MASTHEADS = [
  { id: "mh-campaign", label: "Navy campaign band" },
  { id: "mh-newsletter", label: "Light newsletter rule" },
  { id: "mh-transactional", label: "Quiet transactional" },
  { id: "mh-eyebrow", label: "Eyebrow only" },
];

const FOOTERS = [
  { id: "ft-marketing", label: "Marketing, with unsubscribe" },
  { id: "ft-transactional", label: "Transactional, no unsubscribe" },
  { id: "ft-signature", label: "Signature" },
];

const BUTTONS = [
  { id: "btn-primary", label: "Primary, brand blue" },
  { id: "btn-secondary", label: "Secondary outline" },
  { id: "btn-on-navy", label: "On navy" },
  { id: "btn-whatsapp", label: "WhatsApp" },
  { id: "btn-full", label: "Full width" },
  { id: "btn-link", label: "Text link" },
];

export const KitDesignPanel = ({
  doc,
  onBlocks,
  width,
  onWidth,
}: {
  doc: EmailTemplateDoc;
  onBlocks: (blocks: BlockInstance[]) => void;
  width: "desktop" | "mobile";
  onWidth: (w: "desktop" | "mobile") => void;
}) => {
  const currentOf = (group: string) =>
    doc.blocks.find((b) => BLOCK_BY_ID[b.blockId]?.group === group)?.blockId ?? "";

  const Row = ({
    label,
    group,
    options,
    hint,
  }: {
    label: string;
    group: string;
    options: { id: string; label: string }[];
    hint?: string;
  }) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select
        value={currentOf(group)}
        onValueChange={(v) => onBlocks(swapGroupBlock(doc.blocks, group, v))}
      >
        <SelectTrigger className="h-9"><SelectValue placeholder="None" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <div className="border border-line bg-card p-4">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-label">Design</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Row label="Masthead" group="masthead" options={MASTHEADS} />
        <Row
          label="Footer"
          group="footer"
          options={FOOTERS}
          hint="Marketing sends must carry the unsubscribe footer."
        />
        <Row label="Button" group="button" options={BUTTONS} />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Preview width</Label>
          <Select value={width} onValueChange={(v) => onWidth(v as "desktop" | "mobile")}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="desktop">Desktop, 600px</SelectItem>
              <SelectItem value="mobile">Mobile, 380px</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Colour, type and spacing come from the Medic Connect kit and are not editable here, so
        every send looks like us.
      </p>
    </div>
  );
};

/* ── One editable slot ── */

export const FieldInput = ({
  field,
  instance,
  onChange,
}: {
  field: Field;
  instance: BlockInstance;
  onChange: (patch: Partial<BlockInstance>) => void;
}) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (field.kind === "image") {
    const ref = instance.images?.[field.path];
    const upload = async (file: File) => {
      setUploading(true);
      const path = `email-kit/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.\-]/g, "-")}`;
      const { error } = await supabase.storage.from("blog-images").upload(path, file, { upsert: false });
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      } else {
        const { data } = supabase.storage.from("blog-images").getPublicUrl(path);
        onChange({ images: { ...instance.images, [field.path]: { ...ref, url: data.publicUrl } } });
      }
      setUploading(false);
    };
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">
          {field.label}
          {field.width ? ` · ${field.width} by ${field.height} pixels` : ""}
        </Label>
        {ref?.url && <img loading="lazy" decoding="async" src={ref.url} alt={ref.alt ?? ""} className="h-24 w-full object-cover" />}
        <div className="flex gap-2">
          <Input
            value={ref?.url ?? ""}
            onChange={(e) => onChange({ images: { ...instance.images, [field.path]: { ...ref, url: e.target.value } } })}
            placeholder="https://"
            className="h-9"
          />
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </div>
        <Input
          value={ref?.alt ?? ""}
          onChange={(e) => onChange({ images: { ...instance.images, [field.path]: { ...ref, url: ref?.url ?? "", alt: e.target.value } } })}
          placeholder="Alt text, a sentence describing the photograph"
          className="h-9"
        />
      </div>
    );
  }

  if (field.kind === "link") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{field.label}</Label>
        <Input
          value={instance.links?.[field.path] ?? ""}
          onChange={(e) => onChange({ links: { ...instance.links, [field.path]: e.target.value } })}
          placeholder="https://"
          className="h-9"
        />
      </div>
    );
  }

  const value = instance.slots?.[field.path] ?? "";
  const setValue = (next: string) => onChange({ slots: { ...instance.slots, [field.path]: next } });

  if (field.kind === "enum" && field.options?.length) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{field.label}</Label>
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Choose" /></SelectTrigger>
          <SelectContent>
            {field.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.kind === "bool") {
    return (
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs">{field.label}</Label>
        <Switch checked={value === "true"} onCheckedChange={(v) => setValue(v ? "true" : "false")} />
      </div>
    );
  }

  const over = field.maxChars ? value.length > field.maxChars : false;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{field.label}</Label>
      {field.kind === "richtext" ? (
        <RichTextEditor
          value={value}
          onChange={setValue}
          minHeight="160px"
          placeholder="Write this part of the email…"
          enableCta
          className="text-sm"
        />
      ) : (
        <Input value={value} onChange={(e) => setValue(e.target.value)} className="h-9" />
      )}
      {field.maxChars && (
        <p className={`text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
          {value.length} of {field.maxChars} characters
        </p>
      )}
    </div>
  );
};
