// The email that sends a care offer to the family.
//
// A warm hello, what is inside the offer as four small tiles, a navy panel
// with the way in, and a note that the PDF is attached. Built from email-safe
// tables with inline styles in the email kit's colours; on a phone the tiles
// stack. No prices here: those are in the offer and the attached PDF.
import { KIT, KIT_ART, type KitArt } from "./kit-email.ts";

const esc = (v: string) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const F = KIT.font;

/** One tile of what is inside: a small picture, a title and a line. */
const tile = (art: KitArt, title: string, line: string) => `
  <td class="mc-fcol" width="50%" style="width:50%;padding:0 6px 12px;vertical-align:top;">
    <table role="presentation" width="100%" height="100%" cellpadding="0" cellspacing="0" style="height:100%;background:${KIT.tint};border:2px solid ${KIT.navy};">
      <tr><td class="mc-tile" style="padding:16px 16px 18px;vertical-align:top;height:132px;">
        <img src="${art.src}" alt="" height="44" style="display:block;height:44px;width:auto;border:0;margin:0 0 10px;" />
        <div style="font-family:${F};font-size:16px;font-weight:800;letter-spacing:-0.01em;color:${KIT.navy};line-height:1.25;">${esc(title)}</div>
        <div style="font-family:${F};font-size:14px;line-height:1.5;color:${KIT.body};margin-top:4px;">${esc(line)}</div>
      </td></tr>
    </table>
  </td>`;

/**
 * The email that sends a care offer: a warm hello, what is inside, and the
 * way in. No prices: those are in the offer and the attached PDF.
 */
export function offerEmailBody(o: { first: string; careFor: string; optionCount: number; link: string; validUntil: string | null }) {
  const careFor = esc(o.careFor);
  const ways = o.optionCount > 1 ? `${["", "", "Two", "Three", "Four"][o.optionCount] ?? o.optionCount} ways we can care for ${o.careFor}, side by side` : `How we will care for ${o.careFor}`;
  return `
  <p style="font-family:${F};font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${KIT.navy};margin:0 0 10px;">${o.first && o.first !== "Hello" ? `Hello ${esc(o.first)},` : "Hello,"}</p>
  <p style="font-family:${F};font-size:16px;line-height:1.7;color:${KIT.body};margin:0 0 26px;">Thank you for talking with us about ${careFor}. We have put everything together in one place, so you can take your time with it.</p>

  <div style="font-family:${F};font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:${KIT.brand};margin:0 0 12px;">What is inside</div>
  <table class="mc-tiles" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -6px 14px;width:calc(100% + 12px);">
    <tr>${tile(KIT_ART.carePlan, "Your options", ways)}${tile(KIT_ART.calendar, "Your care schedule", "What we agree now, and what we plan together")}</tr>
    <tr>${tile(KIT_ART.shield, "Terms of care", "Our promises to you, and how it all works")}${tile(KIT_ART.envelope, "Sign online", "Accept and pay from your phone, in minutes")}</tr>
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

  <p style="font-family:${F};font-size:16px;line-height:1.7;color:${KIT.body};margin:0 0 22px;">Any questions at all? Just reply to this email, or call or WhatsApp us on <a href="https://wa.me/2348126988237" style="color:${KIT.brand};font-weight:700;text-decoration:none;">+234 812 698 8237</a>. We are happy to talk it through.</p>
  <p style="font-family:${F};font-size:16px;line-height:1.5;color:${KIT.body};margin:0;">With care,<br /><strong style="color:${KIT.navy};font-size:17px;">The Medic Connect team</strong></p>`;
}
