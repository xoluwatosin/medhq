/* ── Email markdown → HTML renderer ──
   Shared between CampaignEditor preview and the send-campaign edge function
   (kept in sync manually; see supabase/functions/send-campaign/index.ts).
   Supports: paragraphs, # / ## / ### headings, > blockquote, - / * unordered
   list, 1. ordered list, --- horizontal rule, **bold**, *italic*, [text](url),
   and the CTA token [[cta:Label|url|align]] both solo-line (block button) and
   inline (pill). All styling is inline so it survives email clients. */

export type EmailDesign = {
  primary_color: string;
  body_color: string;
  muted_color: string;
  accent_color: string;
  divider_color: string;
  link_color: string;
  button_bg: string;
  button_text: string;
  button_radius: number;
  button_width: "auto" | "full";
  button_align: "left" | "center" | "right";
  button_size: "sm" | "md" | "lg";
};

export const CTA_TOKEN_GLOBAL = /\\?\[\\?\[cta:([^|\]\\]+)\|([^|\]\\]+)(?:\|(left|center|right))?\\?\]\\?\]/g;
const CTA_TOKEN_SOLO = /^\\?\[\\?\[cta:([^|\]\\]+)\|([^|\]\\]+)(?:\|(left|center|right))?\\?\]\\?\]$/;

const SERIF = "'Figtree',Georgia,serif";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineButton(label: string, url: string, d: EmailDesign): string {
  return `<a href="${url}" style="display:inline-block;background:${d.button_bg};color:${d.button_text};font-size:13px;font-weight:500;letter-spacing:0.02em;padding:8px 16px;border-radius:${d.button_radius}px;text-decoration:none;font-family:'Figtree',Arial,sans-serif;margin:2px 0;">${escapeHtml(label)}</a>`;
}

function blockButton(label: string, url: string, d: EmailDesign, alignOverride?: string): string {
  const pad = d.button_size === "sm" ? "11px 22px" : d.button_size === "lg" ? "16px 36px" : "14px 28px";
  const fs = d.button_size === "sm" ? "13px" : d.button_size === "lg" ? "16px" : "14px";
  const widthCss = d.button_width === "full" ? "display:block;width:100%;text-align:center;" : "display:inline-block;";
  const align = alignOverride || d.button_align;
  return `<div style="margin:32px 0 8px;text-align:${align};"><a href="${url || "#"}" style="${widthCss}background:${d.button_bg};color:${d.button_text};font-size:${fs};font-weight:500;letter-spacing:0.02em;padding:${pad};border-radius:${d.button_radius}px;text-decoration:none;font-family:'Figtree',Arial,sans-serif;">${escapeHtml(label || "Learn more")}</a></div>`;
}

function renderInline(text: string, d: EmailDesign): string {
  // Protect CTA tokens first (so they aren't mangled by other regexes)
  const ctaPlaceholders: string[] = [];
  let work = text.replace(CTA_TOKEN_GLOBAL, (_m, label, url) => {
    const idx = ctaPlaceholders.length;
    ctaPlaceholders.push(inlineButton(String(label).trim(), String(url).trim(), d));
    return `\u0000CTA${idx}\u0000`;
  });

  work = escapeHtml(work);

  // Links [text](url)
  work = work.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) =>
    `<a href="${u}" style="color:${d.link_color};text-decoration:underline;">${t}</a>`,
  );
  // Bold then italic
  work = work.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  work = work.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  work = work.replace(/_([^_\n]+)_/g, "<em>$1</em>");

  // Restore CTA placeholders
  work = work.replace(/\u0000CTA(\d+)\u0000/g, (_m, i) => ctaPlaceholders[Number(i)] ?? "");
  return work;
}

const pStyle = (d: EmailDesign) =>
  `color:${d.body_color};font-size:17px;line-height:1.8;margin:0 0 22px;font-family:${SERIF};`;

export function renderEmailMarkdown(content: string, d: EmailDesign): string {
  if (!content) return "";
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) { i++; continue; }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      out.push(`<hr style="border:0;border-top:1px solid ${d.divider_color};margin:32px 0;" />`);
      i++;
      continue;
    }

    // Solo CTA token → block button
    const solo = line.match(CTA_TOKEN_SOLO);
    if (solo) {
      out.push(blockButton(solo[1].trim(), solo[2].trim(), d, solo[3]));
      i++;
      continue;
    }

    // Headings
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = renderInline(h[2], d);
      const size = level === 1 ? 28 : level === 2 ? 22 : 18;
      const mt = level === 1 ? 36 : level === 2 ? 32 : 24;
      out.push(`<h${level} style="font-family:${SERIF};font-weight:600;color:${d.primary_color};font-size:${size}px;line-height:1.25;margin:${mt}px 0 12px;letter-spacing:-0.01em;">${text}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote style="border-left:3px solid ${d.accent_color};padding:4px 0 4px 16px;margin:24px 0;font-style:italic;color:${d.body_color};font-family:${SERIF};font-size:18px;line-height:1.7;">${renderInline(buf.join(" "), d)}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      out.push(`<ul style="margin:0 0 22px 0;padding-left:22px;color:${d.body_color};font-family:${SERIF};font-size:17px;line-height:1.8;">${items.map(it => `<li style="margin:0 0 6px;">${renderInline(it, d)}</li>`).join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      out.push(`<ol style="margin:0 0 22px 0;padding-left:22px;color:${d.body_color};font-family:${SERIF};font-size:17px;line-height:1.8;">${items.map(it => `<li style="margin:0 0 6px;">${renderInline(it, d)}</li>`).join("")}</ol>`);
      continue;
    }

    // Paragraph (may span multiple consecutive non-empty, non-special lines)
    const buf: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (!next) break;
      if (/^(#{1,3})\s+/.test(next) || /^>\s?/.test(next) || /^[-*]\s+/.test(next) || /^\d+\.\s+/.test(next) || /^(-{3,}|\*{3,}|_{3,})$/.test(next) || CTA_TOKEN_SOLO.test(next)) break;
      buf.push(next);
      i++;
    }
    out.push(`<p style="${pStyle(d)}">${renderInline(buf.join(" "), d)}</p>`);
  }

  return out.join("");
}
