// GENERATED — do not edit. Run scripts/sync-email-kit.sh after changing src/lib/email-kit.
// Rendering an email from block instances.
//
// One function, used by the builder preview and by every send, so what a
// coordinator sees is what lands in the inbox. Nothing here invents markup:
// every byte of layout comes from the kit's block HTML.
import { BLOCK_HTML } from "./blocks.generated.ts";
import { KIT_ASSET_PATHS } from "./assets.generated.ts";
import { CATALOGUE } from "./catalogue.generated.ts";
import { blockFields, BLOCK_BY_ID } from "./fields.ts";
import type { BlockInstance, EmailTemplateDoc } from "./types.ts";
import { SITE_URL } from "../site-url.ts";

export const PUBLIC_ORIGIN = SITE_URL;

const PLACEHOLDER = /\{\{([A-Za-z0-9_.]+)\}\}/g;

export function assetBase(origin: string = PUBLIC_ORIGIN): string {
  return origin.replace(/\/$/, "");
}

/** The kit references some assets as .svg. Email clients need raster, so every
 *  reference resolves to the PNG rendered from the same artwork. */
function resolveAssets(html: string, origin: string): string {
  return html.replace(/\{\{ASSET_BASE\}\}\/([A-Za-z0-9{}.\-]+)/g, (_m, file: string) => {
    const name = String(file).replace(/\.svg$/, ".png");
    const path = KIT_ASSET_PATHS[name];
    if (!path) return `${assetBase(origin)}/email-kit/${name}`;
    return `${assetBase(origin)}${path}`;
  });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A button that lives inside body copy. Same bulletproof table shape as the
 *  kit's btn-primary, so it survives every client the kit does. The label and
 *  url arrive already escaped; the url may still hold a {{variable}} that the
 *  send layer fills per recipient. */
function inlineButton(label: string, url: string, align?: string): string {
  const textAlign = align === "center" || align === "right" ? align : "left";
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:100%; margin:${textAlign === "left" ? "18px auto 6px 0" : textAlign === "right" ? "18px 0 6px auto" : "18px auto 6px"};">` +
    `<tr><td bgcolor="#3B4DC4" style="background:#3B4DC4; padding:15px 28px; max-width:480px; overflow-wrap:anywhere; word-break:break-word;">` +
    `<a href="${url}" style="display:block; white-space:normal; font-family:Figtree, 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size:14.5px; line-height:1.35; font-weight:600; color:#FFFFFF; text-decoration:none;">${label}</a>` +
    `</td></tr></table>`
  );
}

/** Copy formatting is bold, italic, links and inline buttons
 *  ([[cta:Label|https://…]]). Everything else is stripped. */
export function renderRichText(value: string): string {
  const escaped = escapeHtml(value);
  const withMarks = escaped
    .replace(/\[\[cta:([^|\]]+)\|([^|\]]+)(?:\|(left|center|right))?\]\]/g, (_m, label: string, url: string, align?: string) => {
      const href = safeUrl(url.trim().replace(/&amp;/g, "&"));
      return href ? inlineButton(label.trim(), escapeHtml(href), align) : label.trim();
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+?)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" style="color:#3B4DC4; text-decoration:underline;">$1</a>');
  return withMarks.replace(/\n{2,}/g, "<br><br>").replace(/\n/g, "<br>");
}

/** Merge tags such as {{claim_url}} are filled per recipient at send time, so
 *  they must survive URL validation instead of being stripped to an empty href. */
const MERGE_TAG = /^\{\{\s*[A-Za-z0-9_]+\s*\}\}$/;

export function safeUrl(value: string | undefined | null): string {
  if (!value) return "";
  if (MERGE_TAG.test(String(value).trim())) return String(value).trim();
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" || url.protocol === "mailto:" || url.protocol === "tel:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function valueFor(instance: BlockInstance, path: string, origin: string): string {
  const fields = blockFields(instance.blockId);
  const field = fields.find((f) => f.path === path);

  if (path.endsWith("Alt")) {
    const imagePath = path.slice(0, -3);
    return escapeHtml(instance.images?.[imagePath]?.alt ?? "");
  }
  if (field?.kind === "image") {
    const ref = instance.images?.[path];
    return ref ? escapeHtml(safeUrl(ref.url) || ref.url) : "";
  }
  if (field?.kind === "link") {
    return escapeHtml(safeUrl(instance.links?.[path] ?? instance.slots?.[path] ?? field.default ?? ""));
  }
  const raw = instance.slots?.[path] ?? field?.default ?? "";
  if (!raw) return "";
  return field?.kind === "richtext" ? renderRichText(raw) : escapeHtml(raw);
}

export function renderBlock(instance: BlockInstance, origin = PUBLIC_ORIGIN): string {
  const template = BLOCK_HTML[instance.blockId];
  if (!template) return "";
  const filled = template.replace(PLACEHOLDER, (_m, path: string) => {
    if (path === "ASSET_BASE") return "{{ASSET_BASE}}";
    return valueFor(instance, path, origin);
  });
  let rendered = resolveAssets(filled, origin);
  if (instance.assetRef && BLOCK_BY_ID[instance.blockId]?.group === "button") {
    rendered = rendered
      .replace(/<table role="presentation" cellpadding="0" cellspacing="0" border="0">/, '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:100%;">')
      .replace(/<td([^>]*)style="([^"]*)">\s*<a/, '<td$1style="$2 max-width:480px; overflow-wrap:anywhere; word-break:break-word;"><a')
      .replace(/<a href="([^"]*)" style="([^"]*)">/, '<a href="$1" style="$2 display:block; white-space:normal; line-height:1.35;">');
  }
  return rendered.replace(/<tr(\s|>)/, `<tr data-mc-block="${escapeHtml(instance.id)}"$1`);
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderEmail(doc: EmailTemplateDoc, origin = PUBLIC_ORIGIN): RenderedEmail {
  const open = resolveAssets(
    (BLOCK_HTML["wrapper-open"] ?? "").replace("{{preheader}}", escapeHtml(doc.preheader ?? "")),
    origin,
  );
  const close = resolveAssets(BLOCK_HTML["wrapper-close"] ?? "", origin);
  const body = (doc.blocks ?? []).map((b) => renderBlock(b, origin)).join("\n");

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(doc.subject ?? "")}</title>
${STYLE_BLOCK}
</head>
<body style="margin:0; padding:0; background:#FAF8F4;">
${open}
${body}
${close}
</body></html>`;

  return { subject: doc.subject, html, text: renderPlainText(doc) };
}

/** Every send goes out with a plain text alternative. The fee is written out in
 *  words there, since the naira sign does not survive every plain text client. */
export function renderPlainText(doc: EmailTemplateDoc): string {
  const lines: string[] = [];
  for (const instance of doc.blocks ?? []) {
    const fields = blockFields(instance.blockId);
    for (const field of fields) {
      if (field.kind === "image") {
        const alt = instance.images?.[field.path]?.alt;
        if (alt) lines.push(`[${alt}]`);
        continue;
      }
      const raw = instance.slots?.[field.path] ?? instance.links?.[field.path] ?? "";
      if (!raw) continue;
      lines.push(field.kind === "richtext" ? stripMarks(raw) : raw);
    }
    lines.push("");
  }
  const contact = CATALOGUE.meta.contact;
  lines.push(`Medic Connect, ${contact.address}`);
  lines.push(`WhatsApp ${contact.whatsapp}, ${contact.email}`);
  return lines
    .join("\n")
    .replace(/₦35,000/g, "35,000 naira")
    .replace(/₦/g, "NGN ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripMarks(value: string): string {
  return value
    .replace(/\[\[cta:([^|\]]+)\|([^|\]]+)(?:\|(left|center|right))?\]\]/g, (_m, label: string, url: string) => `${label.trim()} (${url.trim()})`)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*([^*]+?)\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
}

/** Mobile stacking and the forced dark surfaces. Designed, never inherited. */
const STYLE_BLOCK = `<style>
@media only screen and (max-width:600px) {
  img { max-width:100% !important; height:auto !important; }
  table { max-width:100% !important; }
  td { overflow-wrap:anywhere; word-break:break-word; }
  .mc-stack { display:block !important; width:100% !important; max-width:100% !important; }
  .mc-stack-img img { width:100% !important; height:auto !important; }
  .mc-pad { padding-left:24px !important; padding-right:24px !important; }
  .mc-btn a { display:block !important; text-align:center !important; }
  .mc-threeup td { display:block !important; width:100% !important; }
}
@media (prefers-color-scheme: dark) {
  .mc-warm { background:#14161F !important; }
  .mc-tint { background:#1E2340 !important; }
  .mc-body-text { color:#B9BCC8 !important; }
  .mc-ink { color:#F2F0EA !important; }
  .mc-hair { border-color:#2C3040 !important; }
  a.mc-link { color:#8E9BFF !important; }
  .mc-price { color:#FF6B6B !important; }
}
</style>`;
