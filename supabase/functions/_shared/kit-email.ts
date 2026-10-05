// Medic Connect email shell — the Kit grammar, in email-safe HTML.
//
// The site's look, as far as email allows: one square card with a 2px navy
// edge and a hard blue offset (clients without box-shadow show the edge
// alone), a navy masthead with the white wordmark, a white tag eyebrow, a
// heavy heading with one word on a blue swipe and a character standing on the
// band's edge, then the four-colour stripe, square buttons and heavy navy
// rules between sections. Every transactional send uses this so the security
// code, the invite and the care reply read as one family.

const SITE = "https://medicconnect.co";

export const KIT = {
  navy: "#26306B",
  brand: "#3B4DC4",
  ink: "#1B2033",
  body: "#3A4152",
  muted: "#8A90A2",
  page: "#FFFFFF",
  card: "#FFFFFF",
  hairline: "#E1E4F2",
  tint: "#EEF1FF",
  brandSoft: "#8E9BF0",
  bodyNavy: "#C6CBF0",
  font: "'Figtree','Segoe UI',Helvetica,Arial,sans-serif",
  logoWhite: `${SITE}/email-kit/medicconnect-logo-white.png`,
};

/**
 * Characters and objects for the masthead, served from public/email-kit.
 * Characters stand on the band's bottom edge; objects sit level with the text.
 */
export interface KitArt { src: string; width: number; height: number; stands: boolean }
const piece = (file: string, w: number, h: number, stands: boolean): KitArt =>
  ({ src: `${SITE}/email-kit/${file}`, width: w, height: h, stands });
export const KIT_ART = {
  coordinator: piece("coordinator-phone.png", 136, 140, false),
  nurse: piece("char-nurse.png", 65, 170, true),
  caregiver: piece("char-caregiver.png", 84, 170, true),
  doctor: piece("char-doctor.png", 71, 170, true),
  carePlan: piece("obj-care-plan.png", 93, 100, false),
  calendar: piece("obj-calendar.png", 116, 100, false),
  envelope: piece("obj-envelope-heart.png", 124, 100, false),
  priceTag: piece("obj-price-tag-naira.png", 103, 100, false),
  shield: piece("obj-shield-check.png", 93, 100, false),
};

function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface KitEmailOptions {
  /** Small letter-spaced label in the masthead, e.g. "Admin Centre". */
  eyebrow?: string;
  /** Large heading at the top of the card. */
  title?: string;
  /** One word of the title set on a blue swipe. */
  accent?: string;
  /** A character or object from KIT_ART for the masthead. */
  art?: KitArt;
  /** Quiet line under the title. */
  standfirst?: string;
  /** Hidden inbox preview line. */
  preheader?: string;
  /** Ready-made HTML for the card body. */
  bodyHtml: string;
  /** Footer note under the navy band, e.g. a security disclaimer. */
  footnote?: string;
}

/** A single big value: OTP codes, reference numbers. */
export function kitCodePanel(code: string, caption?: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;">
    <tr><td style="background:${KIT.tint};border-left:4px solid ${KIT.brand};padding:34px 20px;text-align:center;">
      <div style="font-family:${KIT.font};font-size:52px;font-weight:800;letter-spacing:0.4em;color:${KIT.navy};line-height:1.05;">${esc(code)}</div>
      ${caption ? `<div style="font-family:${KIT.font};font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${KIT.muted};margin-top:14px;">${esc(caption)}</div>` : ""}
    </td></tr>
  </table>`;
}


export function kitParagraph(text: string): string {
  return `<p style="font-family:${KIT.font};font-size:16px;line-height:1.75;color:${KIT.body};margin:0 0 18px;">${esc(text)}</p>`;
}

/** The one thing to do: square, blue, a navy edge and a hard offset. */
export function kitButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 26px;"><tr>
    <td style="background:${KIT.brand};border:2px solid ${KIT.navy};box-shadow:4px 4px 0 ${KIT.navy};">
      <a href="${url}" style="display:inline-block;padding:14px 28px;font-family:${KIT.font};font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;">${esc(label)}</a>
    </td></tr></table>`;
}

/** Label/value rows on a tint panel. */
export function kitFacts(rows: { label: string; value: string }[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;background:${KIT.tint};border-left:4px solid ${KIT.brand};">
    ${rows.map((r, i) => `<tr>
      <td style="${i ? `border-top:1px solid #DCE1FA;` : ""}padding:12px 12px 12px 18px;width:36%;font-family:${KIT.font};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${KIT.muted};vertical-align:top;">${esc(r.label)}</td>
      <td style="${i ? `border-top:1px solid #DCE1FA;` : ""}padding:12px 18px 12px 0;font-family:${KIT.font};font-size:15px;font-weight:600;color:${KIT.ink};">${esc(r.value)}</td>
    </tr>`).join("")}
  </table>`;
}

/** Section opener: a heavy navy rule, then the label in blue caps. */
export function kitSubhead(text: string): string {
  return `<div style="height:4px;background:${KIT.navy};margin:34px 0 14px;font-size:0;line-height:0;">&nbsp;</div>
  <div style="font-family:${KIT.font};font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:${KIT.brand};margin:0 0 14px;">${esc(text)}</div>`;
}

/** Numbered steps in navy squares: what happens next. */
export function kitSteps(steps: { title: string; detail?: string }[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
    ${steps.map((st, i) => `<tr>
      <td width="44" style="padding:0 0 14px;vertical-align:top;">
        <div style="width:32px;height:32px;line-height:32px;background:${i === 0 ? KIT.brand : KIT.navy};color:#ffffff;text-align:center;font-family:${KIT.font};font-size:12px;font-weight:800;">${String(i + 1).padStart(2, "0")}</div>
      </td>
      <td style="padding:4px 0 14px;vertical-align:top;font-family:${KIT.font};">
        <div style="font-size:16px;font-weight:800;letter-spacing:-0.01em;color:${KIT.navy};line-height:1.3;">${esc(st.title)}</div>
        ${st.detail ? `<div style="font-size:14.5px;line-height:1.6;color:${KIT.body};margin-top:3px;">${inline(st.detail)}</div>` : ""}
      </td>
    </tr>`).join("")}
  </table>`;
}

/** Bulleted list, square navy markers. */
export function kitList(items: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
    ${items.map((t) => `<tr>
      <td width="18" style="padding:7px 0 0;vertical-align:top;"><div style="width:6px;height:6px;background:${KIT.brand};margin-top:4px;"></div></td>
      <td style="padding:4px 0;font-family:${KIT.font};font-size:15px;line-height:1.7;color:${KIT.body};">${inline(t)}</td>
    </tr>`).join("")}
  </table>`;
}

/** A quoted note from us, e.g. a review reason. */
export function kitQuote(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;"><tr>
    <td style="background:${KIT.page};border-left:3px solid ${KIT.navy};padding:16px 18px;font-family:${KIT.font};font-size:15px;line-height:1.7;color:${KIT.ink};font-style:italic;">${inline(text)}</td>
  </tr></table>`;
}

/** Attention band, e.g. payment due before a visit. */
export function kitNotice(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;"><tr>
    <td style="background:${KIT.tint};border-left:3px solid ${KIT.brand};padding:14px 18px;font-family:${KIT.font};font-size:13px;font-weight:600;letter-spacing:0.02em;color:${KIT.navy};">${inline(text)}</td>
  </tr></table>`;
}

/** Columned data table, e.g. invoice lines. */
export function kitTable(
  head: string[],
  rows: string[][],
  align: ("left" | "center" | "right")[] = [],
): string {
  const a = (i: number) => align[i] || "left";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;border-collapse:collapse;">
    <tr>${head.map((h, i) => `<td style="padding:0 0 10px;border-bottom:1px solid ${KIT.navy};text-align:${a(i)};font-family:${KIT.font};font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${KIT.navy};">${esc(h)}</td>`).join("")}</tr>
    ${rows.map((r) => `<tr>${r.map((c, i) => `<td style="padding:13px 0;border-bottom:1px solid ${KIT.hairline};text-align:${a(i)};font-family:${KIT.font};font-size:14px;line-height:1.5;color:${KIT.ink};">${inline(c)}</td>`).join("")}</tr>`).join("")}
  </table>`;
}

/** Right-aligned money summary with a navy grand total. */
export function kitTotals(rows: { label: string; value: string; strong?: boolean }[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 24px;">
    ${rows.map((r) => `<tr>
      <td style="padding:${r.strong ? "14px 14px 14px 0" : "5px 14px 5px 0"};text-align:right;font-family:${KIT.font};font-size:${r.strong ? "12px" : "13px"};${r.strong ? `font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${KIT.navy};` : `color:${KIT.muted};`}">${esc(r.label)}</td>
      <td width="140" style="padding:${r.strong ? "14px 0" : "5px 0"};text-align:right;font-family:${KIT.font};font-size:${r.strong ? "22px" : "14px"};font-weight:${r.strong ? "700" : "500"};color:${r.strong ? KIT.navy : KIT.ink};${r.strong ? `border-top:1px solid ${KIT.hairline};` : ""}">${esc(r.value)}</td>
    </tr>`).join("")}
  </table>`;
}

/** Inline markdown: **bold** and bare links, everything else escaped. */
function inline(text: string): string {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${KIT.ink};font-weight:600;">$1</strong>`)
    .replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color:${KIT.brand};">$1</a>`);
}

/**
 * Renders the mini-markdown our templates are written in:
 * `## heading`, `> quote`, `- list`, `**bold**` and `[[cta:Label|url]]`.
 */
export function kitMarkdown(md: string): string {
  const out: string[] = [];
  const lines = String(md ?? "").replace(/\r\n/g, "\n").split("\n");
  let bullets: string[] = [];
  let para: string[] = [];

  const flushBullets = () => { if (bullets.length) { out.push(kitList(bullets)); bullets = []; } };
  const flushPara = () => {
    if (!para.length) return;
    out.push(`<p style="font-family:${KIT.font};font-size:16px;line-height:1.75;color:${KIT.body};margin:0 0 18px;">${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flush = () => { flushPara(); flushBullets(); };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }

    const cta = line.match(/^\[\[cta:(.+?)\|(.+?)\]\]$/);
    if (cta) { flush(); out.push(kitButton(cta[1], cta[2])); continue; }

    if (line.startsWith("## ")) { flush(); out.push(kitSubhead(line.slice(3))); continue; }
    if (line.startsWith("# ")) { flush(); out.push(kitSubhead(line.slice(2))); continue; }
    if (line.startsWith("> ")) { flush(); out.push(kitQuote(line.slice(2))); continue; }
    if (/^[-*]\s+/.test(line)) { flushPara(); bullets.push(line.replace(/^[-*]\s+/, "")); continue; }

    flushBullets();
    para.push(line);
  }
  flush();
  return out.join("\n");
}

/** One-call shell for templates written in the mini-markdown above. */
export function kitEmailFromMarkdown(
  o: Omit<KitEmailOptions, "bodyHtml"> & { markdown: string },
): string {
  const { markdown, ...rest } = o;
  return kitEmail({ ...rest, bodyHtml: kitMarkdown(markdown) });
}


/** The title, with one word on a blue swipe. */
function titleHtml(title: string, accent?: string): string {
  const t = esc(title);
  if (!accent) return t;
  const a = esc(accent);
  const at = t.indexOf(a);
  if (at < 0) return t;
  return `${t.slice(0, at)}<span style="background:${KIT.brand};color:#ffffff;padding:0 6px;">${a}</span>${t.slice(at + a.length)}`;
}

export function kitEmail(o: KitEmailOptions): string {
  const preheader = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.preheader)}</div>`
    : "";
  const stripe = [
    [KIT.navy, 5], [KIT.brand, 2], [KIT.brandSoft, 1], [KIT.tint, 3],
  ].map(([c, w]) => `<td width="${Math.round((Number(w) / 11) * 100)}%" style="height:8px;background:${c};font-size:0;line-height:0;">&nbsp;</td>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>@media (max-width:620px){.mc-card{padding:26px 20px !important;}.mc-band{padding:20px 20px 0 !important;}.mc-title{font-size:26px !important;}.mc-art{max-width:72px !important;}.mc-logo{width:124px !important;}.mc-fcol{display:block !important;width:100% !important;padding:0 0 22px !important;}}</style>
</head><body style="margin:0;padding:0;background:${KIT.page};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${KIT.page};padding:24px 12px 40px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;border:2px solid ${KIT.navy};box-shadow:8px 8px 0 ${KIT.brand};background:${KIT.card};">

    <!-- masthead -->
    <tr><td class="mc-band" style="background:${KIT.navy};padding:26px 30px 0;">
      <img class="mc-logo" src="${KIT.logoWhite}" alt="Medic Connect" width="150" style="display:block;width:150px;max-width:60%;height:auto;border:0;" />
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;"><tr>
        <td style="vertical-align:bottom;padding:0 0 26px;">
          ${o.eyebrow ? `<span style="display:inline-block;background:#ffffff;color:${KIT.navy};font-family:${KIT.font};font-size:10px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;padding:6px 10px;">${esc(o.eyebrow)}</span>` : ""}
          ${o.title ? `<h1 class="mc-title" style="margin:14px 0 0;font-family:${KIT.font};font-size:32px;line-height:1.2;font-weight:800;letter-spacing:-0.035em;color:#ffffff;">${titleHtml(o.title, o.accent)}</h1>` : ""}
          ${o.standfirst ? `<p style="margin:10px 0 0;font-family:${KIT.font};font-size:15px;line-height:1.6;color:${KIT.bodyNavy};">${esc(o.standfirst)}</p>` : ""}
        </td>
        ${o.art ? `<td width="${o.art.width}" style="vertical-align:bottom;text-align:right;padding:0 0 ${o.art.stands ? 0 : 24}px 12px;"><img class="mc-art" src="${o.art.src}" alt="" width="${o.art.width}" height="${o.art.height}" style="display:block;width:${o.art.width}px;height:auto;border:0;margin-left:auto;" /></td>` : ""}
      </tr></table>
    </td></tr>
    <tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${stripe}</tr></table></td></tr>

    <!-- body -->
    <tr><td class="mc-card" style="padding:32px 34px 30px;">
      ${o.bodyHtml}
    </td></tr>
  </table>

  <!-- footer: who sent this, on every email -->
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">
    <tr><td style="padding:26px 30px 0;text-align:center;font-family:${KIT.font};font-size:12px;line-height:1.6;color:${KIT.muted};">
      ${esc(o.footnote || "Medic Connect Limited, 145 Igbosere Road, Lagos Island, Nigeria.")}<br />
      <a href="${SITE}" style="color:${KIT.muted};text-decoration:underline;">medicconnect.co</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}
