/**
 * Heard email layouts.
 *
 * The story or letter is the message. Heard branding stays to a small footer,
 * and the writer's email address never appears. Delivery automation comes with
 * the Heard admin stage; these builders are the presentation it will use.
 */

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const paragraphs = (body: string) =>
  body
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 18px;font-size:16px;line-height:1.8;color:#2C2552">${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("");

const wrap = (inner: string, footerLead: string, footerNote: string) => `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#FBFAFF">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;font-family:Figtree,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    ${inner}
    <div style="margin-top:36px;padding-top:16px;border-top:1px solid #C6C0DA">
      <p style="margin:0 0 4px;font-size:13px;font-weight:800;color:#16132F">${escapeHtml(footerLead)}</p>
      <p style="margin:0;font-size:13px;color:#4A4480">${escapeHtml(footerNote)}</p>
    </div>
  </div>
</body></html>`;

export interface HeardStoryEmail {
  subject: string;
  body: string;
  signature: string;
}

/** A swapped story, arriving as though from the person who wrote it. */
export const buildStorySwapEmail = (story: HeardStoryEmail) => ({
  subject: story.subject,
  html: wrap(
    `${paragraphs(story.body)}
     <p style="margin:24px 0 0;font-size:16px;color:#16132F;font-weight:700">${escapeHtml(story.signature)}</p>`,
    "You received this through Story Swap.",
    "No profiles. No introductions. Just one story for another.",
  ),
});

export interface HeardLetterEmail {
  heading?: string | null;
  body: string;
  signature: string;
}

/** A letter sent to somebody who asked to receive letters. */
export const buildLetterEmail = (letter: HeardLetterEmail) => ({
  subject: "A letter for you",
  html: wrap(
    `${letter.heading ? `<p style="margin:0 0 18px;font-size:22px;font-weight:800;letter-spacing:-0.035em;color:#16132F">${escapeHtml(letter.heading)}</p>` : ""}
     ${paragraphs(letter.body)}
     <p style="margin:24px 0 0;font-size:16px;color:#16132F;font-weight:700">${escapeHtml(letter.signature)}</p>`,
    "This letter was written by someone you don't know.",
    "That was the idea.",
  ),
});
