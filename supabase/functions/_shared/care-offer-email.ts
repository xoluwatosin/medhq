// The emails the family gets: the offer itself, and the pieces shared by the
// emails after it (accepting, paying, booking confirmed, each month).
//
// A warm hello, what is inside the offer as four small tiles, a navy panel
// with the way in, and a note that the PDF is attached. Built from email-safe
// tables with inline styles in the email kit's colours; on a phone the tiles
// stack. No prices here: those are in the offer and the attached PDF.
import { KIT, KIT_ART, type KitArt } from "./kit-email.ts";

const esc = (v: string) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const F = KIT.font;

/**
 * The baby's name on a strip of clear tape: a translucent band of the soft
 * brand blue, slightly taller than the text, as if stuck on the page.
 */
const taped = (name: string) =>
  `<span style="background-color:rgba(142,155,240,0.38);box-shadow:5px 0 0 rgba(142,155,240,0.38),-5px 0 0 rgba(142,155,240,0.38);color:${KIT.navy};font-weight:800;padding:2px 0;white-space:nowrap;">${esc(name)}</span>`;

/** One tile of what is inside: a small picture, a title and a line (HTML). */
const tile = (art: KitArt, title: string, lineHtml: string) => `
  <td class="mc-fcol" width="50%" style="width:50%;padding:0 6px 12px;vertical-align:top;">
    <table role="presentation" width="100%" height="100%" cellpadding="0" cellspacing="0" style="height:100%;background:${KIT.tint};border:2px solid ${KIT.navy};">
      <tr><td class="mc-tile" style="padding:16px 16px 18px;vertical-align:top;height:132px;">
        <img src="${art.src}" alt="" height="44" style="display:block;height:44px;width:auto;border:0;margin:0 0 10px;" />
        <div style="font-family:${F};font-size:16px;font-weight:800;letter-spacing:-0.01em;color:${KIT.navy};line-height:1.25;">${esc(title)}</div>
        <div style="font-family:${F};font-size:14px;line-height:1.6;color:${KIT.body};margin-top:4px;">${lineHtml}</div>
      </td></tr>
    </table>
  </td>`;

/**
 * The email that sends a care offer: a warm hello, what is inside, and the
 * way in. No prices: those are in the offer and the attached PDF.
 */
export function offerEmailBody(o: { first: string; careFor: string; optionCount: number; link: string; validUntil: string | null }) {
  const careFor = taped(o.careFor);
  const ways = o.optionCount > 1
    ? `${["", "", "Two", "Three", "Four"][o.optionCount] ?? o.optionCount} ways we can help, side by side`
    : "The care we are offering, in full";
  return `
  <p style="font-family:${F};font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${KIT.navy};margin:0 0 10px;">${o.first && o.first !== "Hello" ? `Hello ${esc(o.first)},` : "Hello,"}</p>
  <p style="font-family:${F};font-size:16px;line-height:1.7;color:${KIT.body};margin:0 0 26px;">Thank you for talking with us about ${careFor}. We have put everything together in one place, so you can take your time with it.</p>

  <div style="font-family:${F};font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:${KIT.brand};margin:0 0 12px;">What is inside</div>
  <table class="mc-tiles" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -6px 14px;width:calc(100% + 12px);">
    <tr>${tile(KIT_ART.carePlan, "Your options", ways)}${tile(KIT_ART.calendar, "Your care schedule", esc("What we agree now, and what we plan together"))}</tr>
    <tr>${tile(KIT_ART.shield, "Terms of care", esc("Our promises to you, and how it all works"))}${tile(KIT_ART.envelope, "Sign online", esc("Accept and pay from your phone, in minutes"))}</tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${KIT.navy};margin:0 0 22px;box-shadow:6px 6px 0 ${KIT.brand};">
    <tr><td style="padding:26px 24px 28px;">
      <div style="font-family:${F};font-size:24px;font-weight:800;letter-spacing:-0.03em;color:#ffffff;line-height:1.2;">Ready when you are</div>
      <div style="font-family:${F};font-size:15px;line-height:1.6;color:${KIT.bodyNavy};margin:8px 0 20px;">Open your offer to compare the options, ask us anything, and accept when it feels right.</div>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="background:#ffffff;border:2px solid #ffffff;box-shadow:4px 4px 0 ${KIT.brand};">
          <a href="${o.link}" style="display:inline-block;padding:14px 26px;font-family:${F};font-size:16px;font-weight:800;color:${KIT.navy};text-decoration:none;">Open your care offer &rarr;</a>
        </td>
      </tr></table>
      ${o.validUntil ? `<div style="font-family:${F};font-size:13px;color:${KIT.brandSoft};margin-top:16px;">Valid until ${esc(o.validUntil)}</div>` : ""}
    </td></tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px dashed ${KIT.brandSoft};margin:0 0 26px;">
    <tr>
      <td width="56" style="padding:14px 0 14px 16px;vertical-align:middle;">
        <div style="width:40px;height:40px;line-height:40px;background:${KIT.brand};color:#ffffff;text-align:center;font-family:${F};font-size:11px;font-weight:800;letter-spacing:0.08em;">PDF</div>
      </td>
      <td style="padding:14px 16px 14px 12px;vertical-align:middle;font-family:${F};font-size:14.5px;line-height:1.5;color:${KIT.ink};">
        <strong style="color:${KIT.navy};">Your offer is attached.</strong> Read it at your own pace, print it, or share it with family.
      </td>
    </tr>
  </table>

  ${signOff()}`;
}

/* ---------------------------------------------------------------------------
 * Pieces shared by every email the family gets after the offer: accepting,
 * paying, booking confirmed and each month's payment. Same voice and look as
 * the offer email.
 * ------------------------------------------------------------------------- */

/** A warm hello, then one or two lines. */
export const greeting = (first: string, lines: string[]) => `
  <p style="font-family:${F};font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${KIT.navy};margin:0 0 10px;">${first && first !== "Hello" ? `Hello ${esc(first)},` : "Hello,"}</p>
  ${lines.map((l) => `<p style="font-family:${F};font-size:16px;line-height:1.7;color:${KIT.body};margin:0 0 18px;">${l}</p>`).join("")}`;

/** Short label and value rows, light and quiet. */
export const infoRows = (rows: { label: string; value: string }[]) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 26px;border-top:2px solid ${KIT.navy};">
    ${rows.map((r) => `<tr>
      <td style="padding:12px 12px 12px 0;border-bottom:1px solid ${KIT.hairline};width:38%;font-family:${F};font-size:13px;font-weight:700;color:${KIT.muted};vertical-align:top;">${esc(r.label)}</td>
      <td style="padding:12px 0;border-bottom:1px solid ${KIT.hairline};font-family:${F};font-size:15.5px;font-weight:700;color:${KIT.navy};">${esc(r.value)}</td>
    </tr>`).join("")}
  </table>`;

/** The money, big and clear, on navy. */
export const moneyPanel = (o: { label: string; amount: string; sub?: string }) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${KIT.navy};margin:4px 0 24px;box-shadow:6px 6px 0 ${KIT.brand};">
    <tr><td style="padding:22px 24px 24px;">
      <div style="font-family:${F};font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:${KIT.brandSoft};">${esc(o.label)}</div>
      <div style="font-family:${F};font-size:38px;font-weight:800;letter-spacing:-0.04em;color:#ffffff;line-height:1.1;margin-top:8px;">${esc(o.amount)}</div>
      ${o.sub ? `<div style="font-family:${F};font-size:14.5px;line-height:1.5;color:${KIT.bodyNavy};margin-top:8px;">${esc(o.sub)}</div>` : ""}
    </td></tr>
  </table>`;

/** Two ways to pay: Paystack on navy, then the bank details on a tint. */
export const payPanel = (o: {
  amount: string; due?: string; payUrl: string | null;
  bank: { bankName: string; accountName: string; accountNumber: string; reference: string };
}) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${KIT.navy};margin:4px 0 0;box-shadow:6px 6px 0 ${KIT.brand};">
    <tr><td style="padding:22px 24px 24px;">
      <div style="font-family:${F};font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:${KIT.brandSoft};">${o.due ? `Due ${esc(o.due)}` : "To pay"}</div>
      <div style="font-family:${F};font-size:38px;font-weight:800;letter-spacing:-0.04em;color:#ffffff;line-height:1.1;margin:8px 0 18px;">${esc(o.amount)}</div>
      ${o.payUrl ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="background:#ffffff;border:2px solid #ffffff;box-shadow:4px 4px 0 ${KIT.brand};">
          <a href="${o.payUrl}" style="display:inline-block;padding:14px 24px;font-family:${F};font-size:16px;font-weight:800;color:${KIT.navy};text-decoration:none;">Pay online with Paystack &rarr;</a>
        </td></tr></table>
      <div style="font-family:${F};font-size:13.5px;color:${KIT.bodyNavy};margin-top:12px;">Card, bank transfer or USSD. Confirmed straight away.</div>` : ""}
    </td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${KIT.tint};border:2px solid ${KIT.navy};border-top:0;margin:0 0 24px;">
    <tr><td style="padding:18px 24px 20px;">
      <div style="font-family:${F};font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:${KIT.brand};margin-bottom:10px;">${o.payUrl ? "Or pay by bank transfer" : "Pay by bank transfer"}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${[["Bank", o.bank.bankName], ["Account name", o.bank.accountName], ["Account number", o.bank.accountNumber], ["Reference", o.bank.reference]].map(([k, v]) => `<tr>
          <td style="padding:4px 12px 4px 0;width:42%;font-family:${F};font-size:13.5px;color:${KIT.muted};">${esc(k)}</td>
          <td style="padding:4px 0;font-family:${F};font-size:15px;font-weight:800;color:${KIT.navy};letter-spacing:0.01em;">${esc(v)}</td>
        </tr>`).join("")}
      </table>
    </td></tr>
  </table>`;

/** What happens next, as small illustrated rows. */
export const stepTiles = (title: string, steps: { art: KitArt; title: string; line: string }[]) => `
  <div style="font-family:${F};font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:${KIT.brand};margin:6px 0 12px;">${esc(title)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
    ${steps.map((s, i) => `<tr><td style="padding:0 0 10px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${KIT.tint};border:2px solid ${KIT.navy};">
        <tr>
          <td width="64" style="padding:14px 0 14px 16px;vertical-align:middle;"><img src="${s.art.src}" alt="" height="40" style="display:block;height:40px;width:auto;border:0;" /></td>
          <td style="padding:14px 16px;vertical-align:middle;">
            <div style="font-family:${F};font-size:11px;font-weight:800;letter-spacing:0.14em;color:${KIT.brand};">STEP ${i + 1}</div>
            <div style="font-family:${F};font-size:16px;font-weight:800;color:${KIT.navy};line-height:1.3;margin-top:2px;">${esc(s.title)}</div>
            <div style="font-family:${F};font-size:14px;line-height:1.5;color:${KIT.body};margin-top:2px;">${esc(s.line)}</div>
          </td>
        </tr>
      </table>
    </td></tr>`).join("")}
  </table>`;

/** A dashed badge for an attachment. */
export const attachmentBadge = (strong: string, rest: string) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px dashed ${KIT.brandSoft};margin:0 0 26px;">
    <tr>
      <td width="56" style="padding:14px 0 14px 16px;vertical-align:middle;">
        <div style="width:40px;height:40px;line-height:40px;background:${KIT.brand};color:#ffffff;text-align:center;font-family:${F};font-size:11px;font-weight:800;letter-spacing:0.08em;">PDF</div>
      </td>
      <td style="padding:14px 16px 14px 12px;vertical-align:middle;font-family:${F};font-size:14.5px;line-height:1.5;color:${KIT.ink};">
        <strong style="color:${KIT.navy};">${esc(strong)}</strong> ${esc(rest)}
      </td>
    </tr>
  </table>`;

/** A quieter second button. */
export const softButton = (label: string, url: string) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 26px;"><tr>
    <td style="background:#ffffff;border:2px solid ${KIT.navy};box-shadow:4px 4px 0 ${KIT.navy};">
      <a href="${url}" style="display:inline-block;padding:12px 22px;font-family:${F};font-size:15px;font-weight:800;color:${KIT.navy};text-decoration:none;">${esc(label)} &rarr;</a>
    </td></tr></table>`;

/** Questions, and the sign-off. */
export const signOff = (extra?: string) => `
  ${extra ? `<p style="font-family:${F};font-size:14px;line-height:1.6;color:${KIT.muted};margin:0 0 16px;">${esc(extra)}</p>` : ""}
  <p style="font-family:${F};font-size:16px;line-height:1.7;color:${KIT.body};margin:0 0 22px;">Any questions at all? Just reply to this email, or call or WhatsApp us on <a href="https://wa.me/2348126988237" style="color:${KIT.brand};font-weight:700;text-decoration:none;">+234 812 698 8237</a>.</p>
  <p style="font-family:${F};font-size:16px;line-height:1.5;color:${KIT.body};margin:0;">With care,<br /><strong style="color:${KIT.navy};font-size:17px;">The Medic Connect team</strong></p>`;
