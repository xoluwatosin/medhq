/* ── Email footer builder ──
   Pure HTML string builder shared by the campaign preview (browser)
   and the send-campaign edge function (Deno). Keep the Deno copy in
   supabase/functions/send-campaign/index.ts in sync with this file. */

export type FooterLayout =
  | "stacked"        // socials line / address / links (default, centered)
  | "minimal"        // single centered row: socials sep address sep links
  | "two-column"     // brand left, socials right
  | "left"           // left-aligned editorial stack
  | "compact";       // tagline + one tight line

export type FooterSeparator = "dot" | "pipe" | "slash" | "bullet" | "arrow" | "space" | "newline";
export type SocialFormat = "text" | "icons" | "icons-text";

export type SocialPlatform =
  | "instagram" | "linkedin" | "x" | "facebook" | "whatsapp" | "youtube" | "tiktok";

export interface SocialLink { platform: SocialPlatform; url: string; }

export interface FooterConfig {
  layout: FooterLayout;
  separator: FooterSeparator;
  social_format: SocialFormat;
  socials: SocialLink[];
  address: string;
  tagline: string;
  show_unsubscribe: boolean;
  show_website: boolean;
  website_url: string;
  website_label: string;
  unsubscribe_url: string;
}

export interface FooterDesignTokens {
  muted_color: string;
  divider_color: string;
}

export const DEFAULT_FOOTER: FooterConfig = {
  layout: "stacked",
  separator: "dot",
  social_format: "text",
  socials: [
    { platform: "instagram", url: "https://instagram.com/medicconnecthq" },
    { platform: "linkedin",  url: "https://ng.linkedin.com/company/medicconnect-co" },
    { platform: "x",         url: "https://x.com/MedicConnectHQ" },
  ],
  address: "Medic Connect · Lagos, Nigeria",
  tagline: "",
  show_unsubscribe: true,
  show_website: true,
  website_url: "https://www.medicconnect.co",
  website_label: "medicconnect.co",
  unsubscribe_url: "https://www.medicconnect.co/unsubscribe",
};

export const FOOTER_LAYOUT_OPTIONS: { value: FooterLayout; label: string; hint: string }[] = [
  { value: "stacked",    label: "Stacked Centered",      hint: "Socials · address · links on three centered rows" },
  { value: "minimal",    label: "Minimal Single Row",    hint: "Everything on one centered line" },
  { value: "two-column", label: "Two Column",            hint: "Address left, socials right" },
  { value: "left",       label: "Left-Aligned Editorial",hint: "Left-stacked, no centering" },
  { value: "compact",    label: "Compact Signature",     hint: "Tagline + tight single line" },
];

export const FOOTER_SEPARATOR_OPTIONS: { value: FooterSeparator; label: string }[] = [
  { value: "dot",     label: "Dot  ·" },
  { value: "pipe",    label: "Pipe  |" },
  { value: "slash",   label: "Slash  /" },
  { value: "bullet",  label: "Bullet  •" },
  { value: "arrow",   label: "Arrow  →" },
  { value: "space",   label: "Wide space" },
  { value: "newline", label: "New line (stack)" },
];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  linkedin:  "LinkedIn",
  x:         "X",
  facebook:  "Facebook",
  whatsapp:  "WhatsApp",
  youtube:   "YouTube",
  tiktok:    "TikTok",
};

const ICON_SLUG: Record<SocialPlatform, string> = {
  instagram: "instagram-new",
  linkedin:  "linkedin",
  x:         "twitterx",
  facebook:  "facebook-new",
  whatsapp:  "whatsapp",
  youtube:   "youtube-play",
  tiktok:    "tiktok",
};

const SEP_CHAR: Record<FooterSeparator, string> = {
  dot: "·", pipe: "|", slash: "/", bullet: "•", arrow: "→", space: "&nbsp;&nbsp;", newline: "",
};

function sepSpan(sep: FooterSeparator, color: string): string {
  if (sep === "newline") return "<br/>";
  return `<span style="color:${color};margin:0 10px;">${SEP_CHAR[sep]}</span>`;
}

function iconUrl(platform: SocialPlatform, color: string): string {
  const hex = color.replace("#", "");
  return `https://img.icons8.com/ios-glyphs/60/${hex}/${ICON_SLUG[platform]}.png`;
}

function renderSocial(s: SocialLink, format: SocialFormat, color: string): string {
  const label = SOCIAL_PLATFORM_LABELS[s.platform];
  const baseLink = `color:${color};font-size:12px;text-decoration:none;letter-spacing:0.04em;font-family:'Figtree',Arial,sans-serif;`;
  if (format === "text") {
    return `<a href="${s.url || "#"}" style="${baseLink}">${label}</a>`;
  }
  const img = `<img src="${iconUrl(s.platform, color)}" width="18" height="18" alt="${label}" style="vertical-align:middle;display:inline-block;border:0;" />`;
  if (format === "icons") {
    return `<a href="${s.url || "#"}" style="${baseLink};margin:0 8px;display:inline-block;">${img}</a>`;
  }
  return `<a href="${s.url || "#"}" style="${baseLink};margin:0 6px;display:inline-block;">${img}<span style="margin-left:6px;vertical-align:middle;">${label}</span></a>`;
}

function joinWithSep(parts: string[], sep: FooterSeparator, color: string): string {
  return parts.filter(Boolean).join(sepSpan(sep, color));
}

export function buildFooterHtml(d: FooterDesignTokens, fIn: Partial<FooterConfig> | undefined): string {
  const f: FooterConfig = { ...DEFAULT_FOOTER, ...(fIn || {}) };
  const socials = (f.socials && f.socials.length ? f.socials : DEFAULT_FOOTER.socials).filter(s => s && s.platform);
  const muted = d.muted_color;
  const divider = d.divider_color;

  const socialBlock = socials.map(s => renderSocial(s, f.social_format, muted)).join(
    f.social_format === "icons" ? "" : sepSpan(f.separator, divider)
  );

  const linkStyle = `color:${muted};text-decoration:underline;font-family:'Figtree',Arial,sans-serif;font-size:12px;`;
  const unsub  = f.show_unsubscribe ? `<a href="${f.unsubscribe_url}" style="${linkStyle}">Unsubscribe</a>` : "";
  const site   = f.show_website ? `<a href="${f.website_url}" style="${linkStyle}">${f.website_label}</a>` : "";
  const linksRow = joinWithSep([unsub, site], f.separator, divider);

  const addressLine = f.address
    ? `<span style="color:${muted};font-size:12px;line-height:1.7;font-family:'Figtree',Arial,sans-serif;">${f.address}</span>`
    : "";

  const taglineHtml = f.tagline
    ? `<div style="color:${muted};font-size:11px;letter-spacing:0.24em;text-transform:uppercase;font-family:'Figtree',Arial,sans-serif;margin-bottom:14px;">${f.tagline}</div>`
    : "";

  const hr = `<hr style="border:none;border-top:1px solid ${divider};margin:56px 0 24px;" />`;

  /* ── Layouts ── */
  if (f.layout === "minimal") {
    const row = joinWithSep([socialBlock, addressLine, linksRow], f.separator, divider);
    return `${hr}<div style="text-align:center;padding:0 12px;">${taglineHtml}<div style="line-height:2;">${row}</div></div>`;
  }

  if (f.layout === "two-column") {
    return `${hr}
<table style="width:100%;border-collapse:collapse;font-family:'Figtree',Arial,sans-serif;">
  <tr>
    <td style="text-align:left;vertical-align:middle;padding:0 8px;">
      ${taglineHtml}
      <div style="color:${muted};font-size:12px;line-height:1.7;">${f.address}</div>
      <div style="margin-top:8px;line-height:1.8;">${linksRow}</div>
    </td>
    <td style="text-align:right;vertical-align:middle;padding:0 8px;">${socialBlock}</td>
  </tr>
</table>`;
  }

  if (f.layout === "left") {
    return `${hr}
<div style="text-align:left;padding:0 8px;font-family:'Figtree',Arial,sans-serif;">
  ${taglineHtml}
  <div style="line-height:2;margin-bottom:12px;">${socialBlock}</div>
  <div style="color:${muted};font-size:12px;line-height:1.7;margin-bottom:8px;">${f.address}</div>
  <div style="line-height:1.8;">${linksRow}</div>
</div>`;
  }

  if (f.layout === "compact") {
    const row = joinWithSep([addressLine, linksRow], f.separator, divider);
    return `${hr}
<div style="text-align:center;padding:0 12px;font-family:'Figtree',Arial,sans-serif;">
  ${taglineHtml}
  <div style="margin-bottom:10px;line-height:1.8;">${socialBlock}</div>
  <div style="line-height:1.8;">${row}</div>
</div>`;
  }

  /* Default: stacked centered */
  return `${hr}
<table style="width:100%;border-collapse:collapse;text-align:center;font-family:'Figtree',Arial,sans-serif;">
  ${f.tagline ? `<tr><td style="padding-bottom:14px;">${taglineHtml}</td></tr>` : ""}
  <tr><td style="padding-bottom:10px;line-height:1.8;">${socialBlock}</td></tr>
  ${f.address ? `<tr><td style="color:${muted};font-size:12px;line-height:1.7;padding:8px 12px 4px;">${f.address}</td></tr>` : ""}
  ${(unsub || site) ? `<tr><td style="padding:6px 12px 0;line-height:1.8;">${linksRow}</td></tr>` : ""}
</table>`;
}
