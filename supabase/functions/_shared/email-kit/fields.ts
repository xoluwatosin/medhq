// GENERATED — do not edit. Run scripts/sync-email-kit.sh after changing src/lib/email-kit.
// Working out what a block can be filled with.
//
// The catalogue describes slots in shorthand ("items[].title"). The HTML is the
// truth about which placeholders actually exist, so the editable fields for a
// block are read off the HTML and then matched back to the catalogue for its
// character limits and image sizes.
import { BLOCK_HTML } from "./blocks.generated.ts";
import { CATALOGUE } from "./catalogue.generated.ts";
import type { BlockSpec, ImageSpec, SlotSpec } from "./types.ts";

const PLACEHOLDER = /\{\{([A-Za-z0-9_.]+)\}\}/g;

const LINK_KEYS = new Set([
  "href",
  "ctaHref",
  "unsubscribe",
  "website",
  "preferences",
  "facebook",
  "instagram",
  "linkedin",
  "whatsapp",
]);

const IMAGE_LEAVES = new Set(["photo", "logo", "mark", "watermark", "marks"]);

export type FieldKind = "text" | "richtext" | "image" | "alt" | "link" | "enum" | "bool";

export interface Field {
  /** placeholder path exactly as it appears in the HTML, e.g. items.0.title */
  path: string;
  kind: FieldKind;
  label: string;
  maxChars?: number;
  default?: string;
  required?: boolean;
  options?: string[];
  width?: number;
  height?: number;
  /** for an image, the path of its alt field */
  altPath?: string;
}

const catalogueBlocks = CATALOGUE.blocks as unknown as BlockSpec[];
const textBlocks = (CATALOGUE.textBlocks ?? []) as unknown as BlockSpec[];

export const ALL_BLOCKS: BlockSpec[] = [
  ...catalogueBlocks,
  ...textBlocks.map((b) => ({ ...b, group: "text" as const, images: b.images ?? {} })),
].map((b) => ({ ...b, slots: b.slots ?? {}, images: b.images ?? {} }));

export const BLOCK_BY_ID: Record<string, BlockSpec> = Object.fromEntries(
  ALL_BLOCKS.map((b) => [b.id, b]),
);

/** items.0.title -> items[].title, so a spec written once covers every index */
function specKey(path: string): string {
  return path.replace(/\.\d+\./g, "[].").replace(/\.\d+$/, "[]");
}

function humanise(path: string): string {
  const leaf = path.split(".").pop() ?? path;
  const index = path.match(/\.(\d+)\./)?.[1];
  const words = leaf
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
  return index ? `${words} ${Number(index) + 1}` : words;
}

const cache = new Map<string, Field[]>();

export function blockFields(blockId: string): Field[] {
  const cached = cache.get(blockId);
  if (cached) return cached;

  const html = BLOCK_HTML[blockId] ?? "";
  const spec = BLOCK_BY_ID[blockId];
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const match of html.matchAll(PLACEHOLDER)) {
    const path = match[1];
    if (path === "ASSET_BASE" || path === "preheader") continue;
    if (seen.has(path)) continue;
    seen.add(path);
    paths.push(path);
  }

  const fields: Field[] = [];
  for (const path of paths) {
    const leaf = path.split(".").pop() ?? path;
    const key = specKey(path);
    const slot = (spec?.slots as Record<string, SlotSpec> | undefined)?.[key];
    const image = (spec?.images as Record<string, ImageSpec> | undefined)?.[key];

    if (leaf.endsWith("Alt")) continue; // carried on the image field
    if (IMAGE_LEAVES.has(leaf)) {
      if (image?.fixed) continue; // logo and watermark come from the kit, not the editor
      const altPath = paths.find((p) => p === `${path}Alt`);
      fields.push({
        path,
        kind: "image",
        label: humanise(path),
        width: image?.width,
        height: image?.height,
        required: true,
        altPath,
      });
      continue;
    }
    if (LINK_KEYS.has(leaf)) {
      fields.push({ path, kind: "link", label: humanise(path), default: slot?.default });
      continue;
    }
    fields.push({
      path,
      kind:
        slot?.type === "richtext"
          ? "richtext"
          : slot?.type === "enum"
            ? "enum"
            : slot?.type === "bool"
              ? "bool"
              : "text",
      label: humanise(path),
      maxChars: slot?.maxChars,
      default: slot?.default,
      required: slot?.required,
      options: slot?.options,
    });
  }

  cache.set(blockId, fields);
  return fields;
}

export function blockHasImage(blockId: string): boolean {
  return blockFields(blockId).some((f) => f.kind === "image");
}
