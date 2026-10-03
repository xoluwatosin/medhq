// Shared branded email shell — mirrors the campaign renderer in send-campaign/index.ts.
// Keep in sync with that file so every email we send looks the same.
import { SITE_URL } from "./site-url.ts";
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

function buildButton(text: string, url: string, d: typeof DEFAULT_DESIGN): string {
  const safeUrl = isSafeHttpsUrl(url);
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
  const safeUrl = isSafeHttpsUrl(url) || "#";
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
  work = work.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) =>
    `<a href="${u}" style="color:${d.link_color};text-decoration:underline;">${t}</a>`);
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

  const LOGO_WHITE = "https://medicconnect.co/__l5e/assets-v1/6ff34975-6ca7-4929-9e0d-e65726372c6c/medicconnect-logo-white.png";
  const eyebrow = escapeHtml(String(templateData?.eyebrow || "The Care Operating System"));

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>@media (max-width:620px){.mc-container{padding:30px 22px 26px !important;}.mc-band{padding:22px !important;}}</style>
</head><body style="margin:0;padding:0;font-family:${SERIF};background:#FAF8F4;color:${d.body_color};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F4;padding:28px 14px 40px;">
  <tr><td align="center">
    <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="width:620px;max-width:100%;">

      <tr><td class="mc-band" style="background:#26306B;border-radius:0;padding:26px 30px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><img src="${LOGO_WHITE}" alt="Medic Connect" width="150" style="display:block;width:150px;height:auto;border:0;" /></td>
          <td style="text-align:right;vertical-align:middle;font-family:${SERIF};font-size:10px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.6);">${eyebrow}</td>
        </tr></table>
      </td></tr>

      <tr><td class="mc-container" style="background:#ffffff;border:1px solid ${d.divider_color};border-top:0;border-radius:0;padding:38px 34px 30px;text-align:left;">
        ${body}
        ${buildSignoff(d)}
        ${buildFooter(d, templateData?.footer)}
      </td></tr>

      <tr><td style="padding:16px 8px 0;text-align:center;color:${d.muted_color};font-size:11px;font-family:${SERIF};letter-spacing:0.04em;">
        © ${new Date().getFullYear()} Medic Connect · hello@medicconnect.co
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

}

export { buildEmailHtml, escapeHtml, isSafeHttpsUrl, renderEmailMarkdown, design };
