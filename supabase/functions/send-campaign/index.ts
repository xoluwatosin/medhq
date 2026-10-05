import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderEmail } from "../_shared/email-kit/render.ts";
import type { BlockInstance, EmailKind } from "../_shared/email-kit/types.ts";
import { SITE_URL } from "../_shared/site-url.ts";
import { selectAll } from "../_shared/select-all.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ── Editorial email renderer (pure white, content-first) ──
   All colours are configurable via templateData.design. Nothing is hardcoded
   into copy or layout decisions; defaults below match the editorial aesthetic. */

const DEFAULT_DESIGN = {
  primary_color: "#26306B",
  body_color: "#3A4152",
  muted_color: "#8A90A2",
  accent_color: "#3B4DC4",
  divider_color: "#E4E1DA",
  link_color: "#3B4DC4",
  button_bg: "#3B4DC4",
  button_text: "#ffffff",
  button_radius: 0,
  button_width: "auto" as "auto" | "full",
  button_align: "left" as "left" | "center" | "right",
  button_size: "md" as "sm" | "md" | "lg",
  show_accent_line: true,
  signoff: "With care,\nMedic Connect",
};

const ADDRESS_LINE = "Medic Connect · Lagos, Nigeria";
const ATTACHMENT_PREFIX = "campaigns/attachments/";

function safeAttachmentPath(value: string | undefined | null): string {
  if (!value) return "";
  try {
    const raw = decodeURIComponent(String(value));
    const path = raw.includes("/storage/v1/object/public/blog-images/")
      ? raw.split("/storage/v1/object/public/blog-images/").pop() ?? ""
      : raw;
    return path.startsWith(ATTACHMENT_PREFIX) && !path.includes("..") ? path : "";
  } catch {
    return "";
  }
}

function attachmentStorageUrl(att: any): string {
  const fromPath = safeAttachmentPath(att?.path);
  if (fromPath) {
    return `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/blog-images/${fromPath.split("/").map(encodeURIComponent).join("/")}`;
  }
  const rawUrl = String(att?.url || "");
  try {
    const parsed = new URL(rawUrl);
    const fromFileParam = safeAttachmentPath(parsed.searchParams.get("file"));
    if (fromFileParam) {
      return `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/blog-images/${fromFileParam.split("/").map(encodeURIComponent).join("/")}`;
    }
  } catch { /* not a URL */ }
  const directPath = safeAttachmentPath(rawUrl);
  if (directPath) {
    return `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/blog-images/${directPath.split("/").map(encodeURIComponent).join("/")}`;
  }
  return rawUrl;
}

/* Per-recipient merge. Two tags only, both safe to leave out of a campaign:
   {{claim_url}} becomes that person's personal claim link, and {{first_name}}
   their first name. Anything we cannot fill degrades to something sensible. */
function personalise(html: string, firstName: string, claimUrl: string): string {
  return html
    .replace(/\{\{\s*claim_url\s*\}\}/g, claimUrl)
    .replace(/%7B%7B\s*claim_url\s*%7D%7D/gi, encodeURI(claimUrl))
    .replace(/\{\{\s*first_name\s*\}\}/g, firstName || "there");
}

const UNSUBSCRIBE_URL = `${SITE_URL}/unsubscribe`;
const DEFAULT_FROM_EMAIL = "hello@medicconnect.co";
const VERIFIED_DOMAIN = "medicconnect.co";

function design(td: any) {
  const d = { ...DEFAULT_DESIGN, ...(td?.design || {}) };
  // Legacy gold accent no longer used; fall back to neutral grey
  if (d.accent_color === "#c9a84c") d.accent_color = DEFAULT_DESIGN.accent_color;
  return d;
}

function getFromEmail(td: any): string {
  const raw = (td as any)?.from_email;
  if (typeof raw === "string" && raw.toLowerCase().endsWith(`@${VERIFIED_DOMAIN}`)) {
    return raw.toLowerCase().trim();
  }
  return DEFAULT_FROM_EMAIL;
}

function isSafeHttpsUrl(u: string | undefined | null): string {
  if (!u) return "";
  try {
    const parsed = new URL(String(u));
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch { return ""; }
}

const MERGE_TAG_URL = /^\{\{\s*[A-Za-z0-9_]+\s*\}\}$/;

function isSafeCampaignHref(u: string | undefined | null): string {
  if (!u) return "";
  const value = String(u).trim();
  if (MERGE_TAG_URL.test(value)) return value;
  return isSafeHttpsUrl(value);
}

function buildButton(text: string, url: string, d: typeof DEFAULT_DESIGN): string {
  const safeUrl = isSafeCampaignHref(url);
  if (!safeUrl) return "";
  const pad = d.button_size === "sm" ? "11px 22px" : d.button_size === "lg" ? "16px 36px" : "14px 28px";
  const fs = d.button_size === "sm" ? "13px" : d.button_size === "lg" ? "16px" : "14px";
  const widthCss = d.button_width === "full" ? "display:block;width:100%;text-align:center;" : "display:inline-block;";
  const wrapAlign = `text-align:${d.button_align};`;
  return `<div style="margin:36px 0 8px;${wrapAlign}"><a href="${safeUrl}" style="${widthCss}background:${d.button_bg};color:${d.button_text};font-size:${fs};font-weight:500;letter-spacing:0.02em;padding:${pad};border-radius:${d.button_radius}px;text-decoration:none;font-family:'Figtree','Segoe UI',Arial,sans-serif;">${escapeHtml(text)}</a></div>`;
}

function buildHeading(text: string, d: typeof DEFAULT_DESIGN): string {
  const rule = d.show_accent_line ? `<div style="width:28px;height:1px;background:${d.accent_color};margin:0 0 28px;"></div>` : `<div style="height:18px;"></div>`;
  return `<h1 style="font-size:34px;line-height:1.2;color:${d.primary_color};margin:0 0 18px;font-family:'Figtree','Segoe UI',Arial,sans-serif;font-weight:600;letter-spacing:-0.015em;">${escapeHtml(text)}</h1>${rule}`;
}

const CTA_TOKEN_GLOBAL = /\\?\[\\?\[cta:([^|\]\\]+)\|([^|\]\\]+)(?:\|(left|center|right))?\\?\]\\?\]/g;
const CTA_TOKEN_SOLO = /^\\?\[\\?\[cta:([^|\]\\]+)\|([^|\]\\]+)(?:\|(left|center|right))?\\?\]\\?\]$/;

function inlineCtaHtml(label: string, url: string, d: typeof DEFAULT_DESIGN): string {
  const safeUrl = isSafeCampaignHref(url) || "#";
  return `<a href="${safeUrl}" style="display:inline-block;background:${d.button_bg};color:${d.button_text};font-size:13px;font-weight:500;letter-spacing:0.02em;padding:8px 16px;border-radius:${d.button_radius}px;text-decoration:none;font-family:'Figtree','Segoe UI',Arial,sans-serif;margin:2px 0;">${escapeHtml(label)}</a>`;
}

const SERIF = "'Figtree','Segoe UI',Arial,sans-serif";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInline(text: string, d: typeof DEFAULT_DESIGN): string {
  const ph: string[] = [];
  let work = text.replace(CTA_TOKEN_GLOBAL, (_m, label, url) => {
    ph.push(inlineCtaHtml(String(label).trim(), String(url).trim(), d));
    return `\u0000CTA${ph.length - 1}\u0000`;
  });
  work = escapeHtml(work);
  work = work.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) => {
    const href = isSafeCampaignHref(String(u).replace(/&amp;/g, ""));
    return href ? `<a href="${href}" style="color:${d.link_color};text-decoration:underline;">${t}</a>` : t;
  });
  work = work.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  work = work.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  work = work.replace(/_([^_\n]+)_/g, "<em>$1</em>");
  work = work.replace(/\u0000CTA(\d+)\u0000/g, (_m, i) => ph[Number(i)] ?? "");
  return work;
}

function renderEmailMarkdown(content: string, d: typeof DEFAULT_DESIGN): string {
  if (!content) return "";
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  const pStyle = `color:${d.body_color};font-size:17px;line-height:1.8;margin:0 0 22px;font-family:${SERIF};`;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      out.push(`<hr style="border:0;border-top:1px solid ${d.divider_color};margin:32px 0;" />`); i++; continue;
    }
    const solo = line.match(CTA_TOKEN_SOLO);
    if (solo) {
      const align = (solo[3] as any) || d.button_align;
      out.push(buildButton(solo[1].trim(), solo[2].trim(), { ...d, button_align: align }));
      i++; continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const size = level === 1 ? 28 : level === 2 ? 22 : 18;
      const mt = level === 1 ? 36 : level === 2 ? 32 : 24;
      out.push(`<h${level} style="font-family:${SERIF};font-weight:600;color:${d.primary_color};font-size:${size}px;line-height:1.25;margin:${mt}px 0 12px;letter-spacing:-0.01em;">${renderInline(h[2], d)}</h${level}>`);
      i++; continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) { buf.push(lines[i].trim().replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote style="border-left:3px solid ${d.accent_color};padding:4px 0 4px 16px;margin:24px 0;font-style:italic;color:${d.body_color};font-family:${SERIF};font-size:18px;line-height:1.7;">${renderInline(buf.join(" "), d)}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*]\s+/, "")); i++; }
      out.push(`<ul style="margin:0 0 22px 0;padding-left:22px;color:${d.body_color};font-family:${SERIF};font-size:17px;line-height:1.8;">${items.map(it => `<li style="margin:0 0 6px;">${renderInline(it, d)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\.\s+/, "")); i++; }
      out.push(`<ol style="margin:0 0 22px 0;padding-left:22px;color:${d.body_color};font-family:${SERIF};font-size:17px;line-height:1.8;">${items.map(it => `<li style="margin:0 0 6px;">${renderInline(it, d)}</li>`).join("")}</ol>`);
      continue;
    }
    const buf: string[] = [line]; i++;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (!next) break;
      if (/^(#{1,3})\s+/.test(next) || /^>\s?/.test(next) || /^[-*]\s+/.test(next) || /^\d+\.\s+/.test(next) || /^(-{3,}|\*{3,}|_{3,})$/.test(next) || CTA_TOKEN_SOLO.test(next)) break;
      buf.push(next); i++;
    }
    out.push(`<p style="${pStyle}">${renderInline(buf.join(" "), d)}</p>`);
  }
  return out.join("");
}

function buildParagraphs(content: string, d: typeof DEFAULT_DESIGN, recipientName?: string): string {
  const greeting = recipientName
    ? `<p style="color:${d.body_color};font-size:17px;line-height:1.8;margin:0 0 22px;font-family:'Figtree','Segoe UI',Arial,sans-serif;">Dear ${escapeHtml(recipientName)},</p>`
    : "";
  return greeting + renderEmailMarkdown(content, d);
}


function buildHero(url: string | undefined): string {
  const safeUrl = isSafeHttpsUrl(url);
  return safeUrl ? `<img src="${safeUrl}" alt="" style="display:block;width:100%;margin:0 0 36px;max-height:340px;object-fit:cover;" />` : "";
}

function buildSignoff(d: typeof DEFAULT_DESIGN): string {
  const lines = (d.signoff || DEFAULT_DESIGN.signoff).split("\n").filter(Boolean);
  if (lines.length === 0) return "";
  return `<div style="margin:44px 0 0;font-family:'Figtree','Segoe UI',Arial,sans-serif;color:${d.primary_color};font-size:17px;line-height:1.8;">
    ${lines.map((l, i) => i === lines.length - 1 ? `<span style="font-style:italic;">${l}</span>` : `${l}<br/>`).join("")}
  </div>`;
}

/* ── Footer builder (mirror of src/lib/email-footer.ts) ── */
const DEFAULT_FOOTER = {
  layout: "stacked" as "stacked" | "minimal" | "two-column" | "left" | "compact",
  separator: "dot" as "dot" | "pipe" | "slash" | "bullet" | "arrow" | "space" | "newline",
  social_format: "text" as "text" | "icons" | "icons-text",
  socials: [
    { platform: "instagram", url: "https://instagram.com/medicconnecthq" },
    { platform: "linkedin",  url: "https://ng.linkedin.com/company/medicconnect-co" },
    { platform: "x",         url: "https://x.com/MedicConnectHQ" },
  ],
  address: ADDRESS_LINE,
  tagline: "",
  show_unsubscribe: true,
  show_website: true,
  website_url: SITE_URL,
  website_label: "medicconnect.co",
  unsubscribe_url: UNSUBSCRIBE_URL,
};
const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram", linkedin: "LinkedIn", x: "X", facebook: "Facebook",
  whatsapp: "WhatsApp", youtube: "YouTube", tiktok: "TikTok",
};
const ICON_SLUG: Record<string, string> = {
  instagram: "instagram-new", linkedin: "linkedin", x: "twitterx",
  facebook: "facebook-new", whatsapp: "whatsapp", youtube: "youtube-play", tiktok: "tiktok",
};
const SEP_CHAR: Record<string, string> = {
  dot: "·", pipe: "|", slash: "/", bullet: "•", arrow: "→", space: "&nbsp;&nbsp;", newline: "",
};
function sepSpan(sep: string, color: string) {
  if (sep === "newline") return "<br/>";
  return `<span style="color:${color};margin:0 10px;">${SEP_CHAR[sep] || "·"}</span>`;
}
function iconUrl(platform: string, color: string) {
  return `https://img.icons8.com/ios-glyphs/60/${color.replace("#", "")}/${ICON_SLUG[platform] || platform}.png`;
}
function renderSocial(s: any, format: string, color: string) {
  const label = SOCIAL_LABELS[s.platform] || String(s.platform || "");
  const safeUrl = isSafeHttpsUrl(s.url) || "#";
  const link = `color:${color};font-size:12px;text-decoration:none;letter-spacing:0.04em;font-family:'Figtree','Segoe UI',Arial,sans-serif;`;
  if (format === "text") return `<a href="${safeUrl}" style="${link}">${escapeHtml(label)}</a>`;
  const img = `<img src="${iconUrl(s.platform, color)}" width="18" height="18" alt="${escapeHtml(label)}" style="vertical-align:middle;display:inline-block;border:0;" />`;
  if (format === "icons") return `<a href="${safeUrl}" style="${link};margin:0 8px;display:inline-block;">${img}</a>`;
  return `<a href="${safeUrl}" style="${link};margin:0 6px;display:inline-block;">${img}<span style="margin-left:6px;vertical-align:middle;">${escapeHtml(label)}</span></a>`;
}
function joinWithSep(parts: string[], sep: string, color: string) {
  return parts.filter(Boolean).join(sepSpan(sep, color));
}

function buildFooter(d: typeof DEFAULT_DESIGN, fIn?: any): string {
  const f = { ...DEFAULT_FOOTER, ...(fIn || {}) };
  const socials = (f.socials && f.socials.length ? f.socials : DEFAULT_FOOTER.socials).filter((s: any) => s && s.platform);
  const muted = d.muted_color;
  const divider = d.divider_color;

  const socialBlock = socials.map((s: any) => renderSocial(s, f.social_format, muted)).join(
    f.social_format === "icons" ? "" : sepSpan(f.separator, divider),
  );
  const linkStyle = `color:${muted};text-decoration:underline;font-family:'Figtree','Segoe UI',Arial,sans-serif;font-size:12px;`;
  const unsubUrl = isSafeHttpsUrl(f.unsubscribe_url) || UNSUBSCRIBE_URL;
  const siteUrl = isSafeHttpsUrl(f.website_url) || SITE_URL;
  const unsub = f.show_unsubscribe ? `<a href="${unsubUrl}" style="${linkStyle}">Unsubscribe</a>` : "";
  const site  = f.show_website ? `<a href="${siteUrl}" style="${linkStyle}">${escapeHtml(String(f.website_label || ""))}</a>` : "";
  const linksRow = joinWithSep([unsub, site], f.separator, divider);
  const addressLine = f.address
    ? `<span style="color:${muted};font-size:12px;line-height:1.7;font-family:'Figtree','Segoe UI',Arial,sans-serif;">${escapeHtml(String(f.address))}</span>` : "";
  const taglineHtml = f.tagline
    ? `<div style="color:${muted};font-size:11px;letter-spacing:0.24em;text-transform:uppercase;font-family:'Figtree','Segoe UI',Arial,sans-serif;margin-bottom:14px;">${escapeHtml(String(f.tagline))}</div>` : "";
  const hr = `<hr style="border:none;border-top:1px solid ${divider};margin:56px 0 24px;" />`;

  if (f.layout === "minimal") {
    const row = joinWithSep([socialBlock, addressLine, linksRow], f.separator, divider);
    return `${hr}<div style="text-align:center;padding:0 12px;">${taglineHtml}<div style="line-height:2;">${row}</div></div>`;
  }
  const safeAddr = escapeHtml(String(f.address || ""));
  if (f.layout === "two-column") {
    return `${hr}<table style="width:100%;border-collapse:collapse;font-family:'Figtree','Segoe UI',Arial,sans-serif;"><tr><td style="text-align:left;vertical-align:middle;padding:0 8px;">${taglineHtml}<div style="color:${muted};font-size:12px;line-height:1.7;">${safeAddr}</div><div style="margin-top:8px;line-height:1.8;">${linksRow}</div></td><td style="text-align:right;vertical-align:middle;padding:0 8px;">${socialBlock}</td></tr></table>`;
  }
  if (f.layout === "left") {
    return `${hr}<div style="text-align:left;padding:0 8px;font-family:'Figtree','Segoe UI',Arial,sans-serif;">${taglineHtml}<div style="line-height:2;margin-bottom:12px;">${socialBlock}</div><div style="color:${muted};font-size:12px;line-height:1.7;margin-bottom:8px;">${safeAddr}</div><div style="line-height:1.8;">${linksRow}</div></div>`;
  }
  if (f.layout === "compact") {
    const row = joinWithSep([addressLine, linksRow], f.separator, divider);
    return `${hr}<div style="text-align:center;padding:0 12px;font-family:'Figtree','Segoe UI',Arial,sans-serif;">${taglineHtml}<div style="margin-bottom:10px;line-height:1.8;">${socialBlock}</div><div style="line-height:1.8;">${row}</div></div>`;
  }
  return `${hr}<table style="width:100%;border-collapse:collapse;text-align:center;font-family:'Figtree','Segoe UI',Arial,sans-serif;">${f.tagline ? `<tr><td style="padding-bottom:14px;">${taglineHtml}</td></tr>` : ""}<tr><td style="padding-bottom:10px;line-height:1.8;">${socialBlock}</td></tr>${f.address ? `<tr><td style="color:${muted};font-size:12px;line-height:1.7;padding:8px 12px 4px;">${safeAddr}</td></tr>` : ""}${(unsub || site) ? `<tr><td style="padding:6px 12px 0;line-height:1.8;">${linksRow}</td></tr>` : ""}</table>`;
}

function buildEmailHtml(subject: string, content: string, template: string, templateData: any, recipientName?: string): string {
  const d = design(templateData);
  const heading = templateData?.heading || subject;
  const paragraphs = buildParagraphs(content, d, recipientName);
  const heroImg = buildHero(templateData?.hero_image_url);

  let body = "";

  if (template === "featured_story") {
    body = `${heroImg}${buildHeading(heading, d)}${paragraphs}${buildButton(templateData?.cta_text || "Read the story", templateData?.cta_url || "", d)}`;
  } else if (template === "newsletter_digest") {
    const stories = templateData?.stories || [];
    const storyCards = stories.filter((s: any) => s.title).map((s: any, i: number) => {
      const storyUrl = isSafeHttpsUrl(s.url);
      return `
      <div style="padding:26px 0;${i > 0 ? `border-top:1px solid ${d.divider_color};` : ""}">
        <h3 style="font-size:20px;color:${d.primary_color};margin:0 0 10px;font-family:'Figtree','Segoe UI',Arial,sans-serif;font-weight:600;line-height:1.35;">${escapeHtml(String(s.title))}</h3>
        <p style="color:${d.body_color};font-size:15px;line-height:1.75;margin:0 0 12px;font-family:'Figtree','Segoe UI',Arial,sans-serif;">${escapeHtml(String(s.excerpt || ""))}</p>
        ${storyUrl ? `<a href="${storyUrl}" style="color:${d.link_color};font-size:13px;font-weight:500;text-decoration:none;letter-spacing:0.04em;border-bottom:1px solid ${d.accent_color};padding-bottom:2px;">Read more</a>` : ""}
      </div>`;
    }).join("");
    body = `${heroImg}${buildHeading(heading, d)}${paragraphs}<div style="margin-top:18px;">${storyCards}</div>`;
  } else if (template === "announcement") {
    body = `<div style="text-align:center;margin:0 0 40px;">
      <div style="font-family:'Figtree','Segoe UI',Arial,sans-serif;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:${d.accent_color};margin-bottom:18px;">Announcement</div>
      <h1 style="font-size:34px;line-height:1.2;color:${d.primary_color};margin:0;font-family:'Figtree','Segoe UI',Arial,sans-serif;font-weight:600;letter-spacing:-0.015em;">${escapeHtml(heading)}</h1>
    </div>${paragraphs}${buildButton(templateData?.cta_text || "Learn more", templateData?.cta_url || "", { ...d, button_align: d.button_align === "left" ? "center" : d.button_align })}`;
  } else if (template === "event_highlight") {
    body = `${heroImg}${buildHeading(heading, d)}
      <div style="padding:24px 0;border-top:1px solid ${d.divider_color};border-bottom:1px solid ${d.divider_color};margin:0 0 30px;">
        <table style="border-collapse:collapse;width:100%;font-size:15px;color:${d.body_color};line-height:1.8;font-family:'Figtree','Segoe UI',Arial,sans-serif;">
          ${templateData?.event_date ? `<tr><td style="font-weight:500;color:${d.muted_color};padding-right:18px;width:90px;text-transform:uppercase;font-size:11px;letter-spacing:0.12em;">Date</td><td style="color:${d.primary_color};">${escapeHtml(String(templateData.event_date))}</td></tr>` : ""}
          ${templateData?.event_location ? `<tr><td style="font-weight:500;color:${d.muted_color};padding-right:18px;text-transform:uppercase;font-size:11px;letter-spacing:0.12em;padding-top:8px;">Location</td><td style="color:${d.primary_color};padding-top:8px;">${escapeHtml(String(templateData.event_location))}</td></tr>` : ""}
        </table>
      </div>${paragraphs}${buildButton(templateData?.cta_text || "Register", templateData?.cta_url || "", d)}`;
  } else if (template === "branded_header") {
    body = `${buildHeading(heading, d)}${paragraphs}${buildButton(templateData?.cta_text || "Learn more", templateData?.cta_url || "", d)}`;
  } else {
    body = `${buildHeading(heading, d)}${paragraphs}`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>@media (max-width:600px){.mc-container{padding:32px 22px 28px !important;}.mc-wrap{padding:16px 0 24px !important;}}</style>
</head><body style="margin:0;padding:0;font-family:'Figtree','Segoe UI',Arial,sans-serif;background:#FAF8F4;color:${d.body_color};">
  <div class="mc-wrap" style="max-width:640px;margin:0 auto;padding:32px 16px 40px;background:#ffffff;">
    <div class="mc-container" style="background:#ffffff;padding:8px 8px 0;">
      ${body}
      ${buildSignoff(d)}
      ${buildFooter(d, templateData?.footer)}
    </div>
    <div style="text-align:center;color:${d.muted_color};font-size:11px;font-family:'Figtree','Segoe UI',Arial,sans-serif;padding:24px 8px 0;letter-spacing:0.04em;">
      © ${new Date().getFullYear()} Medic Connect
    </div>
  </div>
</body></html>`;
}


/* ── Kit rendering ──
   A campaign composed in the block builder renders through the same kit code
   the browser preview uses, so what was on screen is what lands. Campaigns
   written before the kit fall back to the editorial renderer. */
function kitBlocks(campaign: any): BlockInstance[] | null {
  const blocks = campaign?.blocks;
  return Array.isArray(blocks) && blocks.length ? (blocks as BlockInstance[]) : null;
}

function buildCampaignHtml(campaign: any, recipientName?: string): string {
  const blocks = kitBlocks(campaign);
  if (blocks) {
    return renderEmail({
      name: campaign.title || "Campaign",
      kind: (campaign.kind === "transactional" ? "transactional" : "marketing") as EmailKind,
      subject: campaign.subject || campaign.title || "",
      preheader: campaign.preheader || "",
      blocks,
    }, SITE_URL).html;
  }
  return buildEmailHtml(
    campaign.subject || campaign.title,
    campaign.content,
    campaign.template || "plain",
    campaign.template_data || {},
    recipientName,
  );
}

/* ── Fetch PDF attachments and convert to base64 ── */
async function fetchAttachments(templateData: any): Promise<{ filename: string; content: string }[]> {
  const attachments = templateData?.attachments || [];
  if (attachments.length === 0) return [];
  const results: { filename: string; content: string }[] = [];
  // Resend caps total request size; refuse anything over 4 MB up front so a
  // large PDF fails loudly here instead of taking the whole function down.
  const MAX_BYTES = 4 * 1024 * 1024;
  for (const att of attachments) {
    if (!att.url || !att.filename) continue;
    // SSRF guard: only allow https URLs to the project's Supabase storage host
    let parsed: URL;
    try { parsed = new URL(attachmentStorageUrl(att)); } catch { console.error(`Invalid attachment URL`); continue; }
    if (parsed.protocol !== "https:") { console.error(`Rejected non-https attachment`); continue; }
    const allowedHost = (() => { try { return new URL(Deno.env.get("SUPABASE_URL")!).host; } catch { return ""; } })();
    if (allowedHost && parsed.host !== allowedHost) {
      console.error(`Rejected attachment from disallowed host: ${parsed.host}`);
      continue;
    }
    try {
      // Oversized attachments are skipped, not fatal: the email still sends
      // with its branded download link, which is the primary way recipients
      // get the document.
      if (typeof att.size === "number" && att.size > MAX_BYTES) {
        console.warn(`Skipping attachment "${att.filename}": ${(att.size / 1048576).toFixed(1)} MB exceeds the 4 MB limit; recipients use the download link instead.`);
        continue;
      }
      const res = await fetch(parsed.toString());
      if (!res.ok) { console.error(`Failed to fetch attachment ${att.filename}: ${res.status}`); continue; }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) {
        console.warn(`Skipping attachment "${att.filename}": ${(buf.byteLength / 1048576).toFixed(1)} MB exceeds the 4 MB limit; recipients use the download link instead.`);
        continue;
      }
      const bytes = new Uint8Array(buf);
      // Chunked conversion: spreading a whole multi-MB array blows the stack,
      // and string += per byte blows the function memory limit.
      const parts: string[] = [];
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
      }
      results.push({ filename: att.filename, content: btoa(parts.join("")) });
    } catch (err) { console.error(`Error fetching attachment ${att.filename} (skipped, email still sends):`, err); continue; }
  }
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { campaignId, testMode, testEmail, templateTest, resendFailedOnly } = body;

    // Template test mode
    if (templateTest && testEmail) {
      const html = buildEmailHtml(templateTest, "This is a test email from Medic Connect Admin Centre.", "plain", {});
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `Medic Connect <${DEFAULT_FROM_EMAIL}>`,
          to: [testEmail],
          subject: `[Test] ${templateTest}`,
          html,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!campaignId) {
      return new Response(JSON.stringify({ error: "campaignId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get campaign
    const { data: campaign, error: campErr } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();
    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const senderName = (campaign.template_data as any)?.sender_name || "Medic Connect";

    const fromEmail = getFromEmail(campaign.template_data);
    const replyTo = (campaign.template_data as any)?.reply_to || "hello@medicconnect.co";

    // Personal claim links are minted on demand: look up an existing invite,
    // otherwise create one. Nobody ever gets the generic /claim or /join door.
    const newToken = () =>
      Array.from(crypto.getRandomValues(new Uint8Array(20))).map((b) => b.toString(16).padStart(2, "0")).join("");
    const claimUrlFor = async (email: string): Promise<string> => {
      const e = email.trim().toLowerCase();
      const { data: existing } = await supabase.from("claim_invites").select("token").eq("email", e).maybeSingle();
      if (existing?.token) return `${SITE_URL}/claim?t=${existing.token}`;
      const token = newToken();
      await supabase.from("claim_invites").insert({ email: e, token, source: "campaign" });
      const { data: row } = await supabase.from("claim_invites").select("token").eq("email", e).maybeSingle();
      return `${SITE_URL}/claim?t=${row?.token ?? token}`;
    };

    // Test mode: send to specified email or admin email. The test email gets a
    // real personal claim link too, so tests exercise the exact live journey.
    if (testMode) {
      const target = (testEmail || user.email || "").toLowerCase();
      const testClaimUrl = target ? await claimUrlFor(target) : `${SITE_URL}/claim`;
      const html = personalise(buildCampaignHtml(campaign), "", testClaimUrl);
      const emailAttachments = await fetchAttachments(campaign.template_data || {});
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${senderName} <${fromEmail}>`,
          reply_to: replyTo,
          to: [testEmail || user.email],
          subject: `[Test] ${campaign.subject || campaign.title}`,
          html,
          ...(emailAttachments.length > 0 ? { attachments: emailAttachments } : {}),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get audience
    let members: { email: string; name?: string | null }[] = [];

    if (campaign.audience_type === "manual") {
      const manualEmails = (campaign.manual_recipients as string[]) || [];
      const emailsLower = manualEmails.filter(Boolean).map((e) => e.toLowerCase());
      const { data: enriched } = emailsLower.length
        ? await supabase.from("audience_members").select("email, name").in("email", emailsLower)
        : { data: [] as any[] };
      const nameMap = new Map((enriched || []).map((m: any) => [m.email.toLowerCase(), m.name]));
      members = manualEmails.filter(Boolean).map((email: string) => ({ email, name: nameMap.get(email.toLowerCase()) || null }));
    } else if (campaign.audience_type === "groups") {
      const groupIds = (campaign.template_data as any)?.audience_group_ids || campaign.manual_recipients || [];
      if (groupIds.length > 0) {
        members = await selectAll<{ email: string; name?: string | null }>((a, z) =>
          supabase.from("audience_members").select("email, name").in("group_id", groupIds).order("id").range(a, z));
      }
    } else {
      // Every contact, a page at a time: a plain select stops at 1,000 rows.
      members = await selectAll<{ email: string; name?: string | null }>((a, z) =>
        supabase.from("audience_members").select("email, name").order("id").range(a, z));
    }



    // Deduplicate, and drop placeholder addresses the provider always refuses
    const PLACEHOLDER_DOMAINS = ["example.com", "example.org", "example.net", "test.com"];
    const seen = new Set<string>();
    members = members.filter((m) => {
      const e = m.email.toLowerCase().trim();
      if (!e || seen.has(e)) return false;
      const domain = e.split("@")[1] || "";
      if (PLACEHOLDER_DOMAINS.includes(domain)) return false;
      seen.add(e);
      return true;
    });


    // Drop suppressed (bounced/complained/unsubscribed) recipients
    if (members.length > 0) {
      const { data: suppressed } = await supabase
        .from("email_suppressions")
        .select("email")
        .in("email", members.map((m) => m.email.toLowerCase()));
      const blocked = new Set((suppressed || []).map((s: any) => s.email.toLowerCase()));
      members = members.filter((m) => !blocked.has(m.email.toLowerCase()));
    }

    // Resend-failed-only mode: skip anyone we've already successfully sent to
    if (resendFailedOnly) {
      const { data: alreadySent } = await supabase
        .from("campaign_events")
        .select("recipient_email")
        .eq("campaign_id", campaignId)
        .eq("event_type", "sent");
      const sentSet = new Set((alreadySent || []).map((r: any) => r.recipient_email.toLowerCase()));
      members = members.filter((m) => !sentSet.has(m.email.toLowerCase()));
    }

    if (members.length === 0) {
      return new Response(JSON.stringify({ error: resendFailedOnly ? "No failed recipients to retry" : "No audience members" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const emailAttachments = await fetchAttachments(campaign.template_data || {});

    // Personal claim links, one per recipient. Existing invites are reused;
    // anyone without one gets an invite minted now, so every recipient's
    // {{claim_url}} is personal and trackable.
    const claimLinks = new Map<string, string>();
    {
      const emails = members.map((m) => m.email.toLowerCase());
      for (let i = 0; i < emails.length; i += 200) {
        const { data: invites } = await supabase
          .from("claim_invites")
          .select("email, token")
          .in("email", emails.slice(i, i + 200));
        for (const inv of invites || []) {
          claimLinks.set(String(inv.email).toLowerCase(), `${SITE_URL}/claim?t=${inv.token}`);
        }
      }
      const missing = emails.filter((e) => !claimLinks.has(e));
      if (missing.length > 0) {
        for (let i = 0; i < missing.length; i += 200) {
          const chunk = missing.slice(i, i + 200);
          await supabase.from("claim_invites").upsert(
            chunk.map((email) => ({ email, token: newToken(), source: "campaign" })),
            { onConflict: "email", ignoreDuplicates: true },
          );
        }
        for (let i = 0; i < missing.length; i += 200) {
          const { data: invites } = await supabase
            .from("claim_invites")
            .select("email, token")
            .in("email", missing.slice(i, i + 200));
          for (const inv of invites || []) {
            claimLinks.set(String(inv.email).toLowerCase(), `${SITE_URL}/claim?t=${inv.token}`);
          }
        }
      }
    }

    let totalSent = 0;
    let totalFailed = 0;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Throttle to 8 emails/second (under Resend's 10/sec hard cap), with 429 retry.
    const BATCH = 8;
    const INTERVAL_MS = 1100;

    const sendOne = async (member: { email: string; name?: string | null }, attempt = 1): Promise<void> => {
      try {
        const firstName = (member.name || "").trim().split(/\s+/)[0] || "";
        const claimUrl = claimLinks.get(member.email.toLowerCase()) || `${SITE_URL}/claim`;
        const html = personalise(buildCampaignHtml(campaign, firstName || undefined), firstName, claimUrl);

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${senderName} <${fromEmail}>`,
            reply_to: replyTo,
            to: [member.email],
            subject: campaign.subject || campaign.title,
            html,
            tags: [
              { name: "campaign_id", value: campaignId },
              { name: "type", value: "campaign" },
            ],
            ...(emailAttachments.length > 0 ? { attachments: emailAttachments } : {}),
          }),
        });
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          totalSent++;
          await supabase.from("campaign_events").insert({
            campaign_id: campaignId,
            event_type: "sent",
            recipient_email: member.email,
            resend_email_id: json?.id,
          });
          return;
        }
        const errBody = await res.text();
        // Retry on rate-limit up to 4 times with exponential backoff
        if (res.status === 429 && attempt <= 4) {
          await sleep(1200 * attempt);
          return sendOne(member, attempt + 1);
        }
        console.error(`Resend rejected ${member.email}: ${res.status} ${errBody}`);
        totalFailed++;
        await supabase.from("campaign_events").insert({
          campaign_id: campaignId,
          event_type: "failed",
          recipient_email: member.email,
          metadata: { status: res.status, error: errBody.slice(0, 500) },
        });
      } catch (e: any) {
        console.error(`Failed to send to ${member.email}:`, e);
        totalFailed++;
        await supabase.from("campaign_events").insert({
          campaign_id: campaignId,
          event_type: "failed",
          recipient_email: member.email,
          metadata: { error: String(e?.message || e).slice(0, 500) },
        });
      }
    };

    for (let i = 0; i < members.length; i += BATCH) {
      const batch = members.slice(i, i + BATCH);
      const started = Date.now();
      await Promise.all(batch.map((m) => sendOne(m)));
      const elapsed = Date.now() - started;
      if (i + BATCH < members.length && elapsed < INTERVAL_MS) {
        await sleep(INTERVAL_MS - elapsed);
      }
    }

    // Record that the claim link has gone out, so the follow-up wave can go to
    // the people who never clicked rather than to everyone again.
    if (claimLinks.size > 0) {
      const invited = members.map((m) => m.email.toLowerCase()).filter((e) => claimLinks.has(e));
      for (let i = 0; i < invited.length; i += 200) {
        await supabase
          .from("claim_invites")
          .update({ sent_at: new Date().toISOString() })
          .in("email", invited.slice(i, i + 200));
      }
    }


    // Update campaign stats (preserve prior sends when retrying failed-only)
    const update: any = {
      status: "sent",
      sent_at: new Date().toISOString(),
    };
    if (resendFailedOnly) {
      update.total_delivered = (campaign.total_delivered || 0) + totalSent;
    } else {
      update.total_recipients = members.length;
      update.total_delivered = totalSent;
    }
    await supabase.from("campaigns").update(update).eq("id", campaignId);

    return new Response(JSON.stringify({ success: true, totalSent, totalFailed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("send-campaign", error);
    return new Response(JSON.stringify({ error: "The campaign could not be sent. Check the logs for detail." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
