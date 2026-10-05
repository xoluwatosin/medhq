// Medic Connect email shell — the Kit grammar, in email-safe HTML.
//
// Structure, not just colour: navy masthead band with the white wordmark and a
// letter-spaced eyebrow, a warm-white page, a white content card with the
// soft symmetric corners (clients that ignore them show square ones), hairline
// rules, and a quiet footer with who sent it.
// Every transactional send uses this so the security code, the invite and the
// contract covering note read as one family.

const SITE = "https://medicconnect.co";

export const KIT = {
  navy: "#26306B",
  brand: "#3B4DC4",
  ink: "#1B2033",
  body: "#3A4152",
  muted: "#8A90A2",
  page: "#FAF8F4",
  card: "#FFFFFF",
  hairline: "#E4E1DA",
  tint: "#EEF1FF",
  font: "'Figtree','Segoe UI',Helvetica,Arial,sans-serif",
  curve: "16px",
  curveSm: "10px",

  logoWhite: `${SITE}/email-kit/medicconnect-logo-white.png`,
};

function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface KitEmailOptions {
  /** Small letter-spaced label in the masthead, e.g. "Admin Centre". */
  eyebrow?: string;
  /** Large heading at the top of the card. */
  title?: string;
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
    <tr><td style="background:${KIT.tint};border-left:4px solid ${KIT.brand};border-radius:0 ${KIT.curveSm} ${KIT.curveSm} 0;padding:34px 20px;text-align:center;">
      <div style="font-family:${KIT.font};font-size:52px;font-weight:800;letter-spacing:0.4em;color:${KIT.navy};line-height:1.05;">${esc(code)}</div>
      ${caption ? `<div style="font-family:${KIT.font};font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${KIT.muted};margin-top:14px;">${esc(caption)}</div>` : ""}
    </td></tr>
  </table>`;
}


export function kitParagraph(text: string): string {
  return `<p style="font-family:${KIT.font};font-size:16px;line-height:1.75;color:${KIT.body};margin:0 0 18px;">${esc(text)}</p>`;
}

export function kitButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 24px;"><tr>
    <td style="background:${KIT.brand};border-radius:${KIT.curveSm};">
      <a href="${url}" style="display:inline-block;padding:14px 30px;font-family:${KIT.font};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${esc(label)}</a>
    </td></tr></table>`;
}

/** Label/value rows, hairline separated. */
export function kitFacts(rows: { label: string; value: string }[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;">
    ${rows.map((r, i) => `<tr>
      <td style="${i ? `border-top:1px solid ${KIT.hairline};` : ""}padding:12px 0;width:38%;font-family:${KIT.font};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${KIT.muted};vertical-align:top;">${esc(r.label)}</td>
      <td style="${i ? `border-top:1px solid ${KIT.hairline};` : ""}padding:12px 0;font-family:${KIT.font};font-size:15px;color:${KIT.ink};">${esc(r.value)}</td>
    </tr>`).join("")}
  </table>`;
}

/** Section label above a block of copy. */
export function kitSubhead(text: string): string {
  return `<div style="font-family:${KIT.font};font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${KIT.navy};margin:30px 0 12px;">${esc(text)}</div>
  <div style="height:1px;background:${KIT.hairline};margin:0 0 16px;"></div>`;
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


export function kitEmail(o: KitEmailOptions): string {
  const preheader = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.preheader)}</div>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>@media (max-width:620px){.mc-card{padding:26px 20px !important;}.mc-band{padding:20px !important;}.mc-title{font-size:25px !important;line-height:1.2 !important;}.mc-fcol{display:block !important;width:100% !important;padding:0 0 22px !important;}.mc-mcol{display:block !important;width:100% !important;text-align:left !important;}.mc-logo{width:124px !important;}.mc-eyebrow{padding:12px 0 0 !important;}}</style>
</head><body style="margin:0;padding:0;background:${KIT.page};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${KIT.page};padding:28px 14px 40px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">

    <!-- masthead -->
    <tr><td class="mc-band" style="background:${KIT.navy};border-radius:${KIT.curve} ${KIT.curve} 0 0;padding:26px 30px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td class="mc-mcol" style="vertical-align:middle;padding-right:16px;"><img class="mc-logo" src="${KIT.logoWhite}" alt="Medic Connect" width="150" style="display:block;width:150px;max-width:60%;height:auto;border:0;" /></td>
        ${o.eyebrow ? `<td class="mc-mcol mc-eyebrow" style="text-align:right;vertical-align:middle;font-family:${KIT.font};font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;line-height:1.5;color:rgba(255,255,255,0.6);white-space:nowrap;">${esc(o.eyebrow)}</td>` : ""}
      </tr></table>
    </td></tr>

    <!-- card -->
    <tr><td class="mc-card" style="background:${KIT.card};border:1px solid ${KIT.hairline};border-top:0;border-radius:0 0 ${KIT.curve} ${KIT.curve};padding:36px 34px 34px;">
      ${o.title ? `<h1 class="mc-title" style="margin:0 0 10px;font-family:${KIT.font};font-size:30px;line-height:1.15;font-weight:600;letter-spacing:-0.02em;color:${KIT.navy};">${esc(o.title)}</h1>` : ""}
      ${o.standfirst ? `<p style="margin:0 0 22px;font-family:${KIT.font};font-size:15px;line-height:1.7;color:${KIT.muted};">${esc(o.standfirst)}</p>` : ""}
      ${o.title ? `<div style="height:1px;background:${KIT.hairline};margin:0 0 24px;"></div>` : ""}
      ${o.bodyHtml}
    </td></tr>

    <!-- footer: who sent this, on every email -->
    <tr><td style="padding:20px 30px 0;text-align:center;font-family:${KIT.font};font-size:12px;line-height:1.6;color:${KIT.muted};">
      ${esc(o.footnote || "Medic Connect Limited, 145 Igbosere Road, Lagos Island, Nigeria.")}<br />
      <a href="${SITE}" style="color:${KIT.muted};text-decoration:underline;">medicconnect.co</a>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;
}
