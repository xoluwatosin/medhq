// GENERATED — do not edit. Run scripts/sync-email-kit.sh after changing src/lib/email-kit.
// Converting an old editorial campaign into kit blocks.
//
// Campaigns used to be a blob of HTML or markdown plus a design object. Nothing
// in the archive is lost: the copy becomes a masthead, body blocks in order, an
// optional button and the correct footer, so every future send is a kit send.
import { newInstance } from "./recipes.ts";
import type { BlockInstance, EmailKind } from "./types.ts";

const MAX_BODY = 700;

/** Strip the editor's HTML back to plain paragraphs with kit marks. */
export function legacyToParagraphs(content: string): string[] {
  if (!content) return [];
  let text = content;
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = text
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\/\s*(p|div|h[1-6]|li)\s*>/gi, "\n\n")
      .replace(/<\s*(strong|b)\s*>([\s\S]*?)<\/\s*(strong|b)\s*>/gi, "**$2**")
      .replace(/<\s*(em|i)\s*>([\s\S]*?)<\/\s*(em|i)\s*>/gi, "*$2*")
      .replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Pack paragraphs into body blocks that respect the kit's character limit. */
function chunk(paragraphs: string[]): string[] {
  const out: string[] = [];
  let buffer = "";
  for (const p of paragraphs) {
    const next = buffer ? `${buffer}\n\n${p}` : p;
    if (next.length > MAX_BODY && buffer) {
      out.push(buffer);
      buffer = p.slice(0, MAX_BODY);
    } else {
      buffer = next.slice(0, MAX_BODY);
    }
  }
  if (buffer) out.push(buffer);
  return out;
}

export interface LegacyCampaign {
  content?: string | null;
  templateData?: any;
  kind?: EmailKind;
}

export function blocksFromLegacyCampaign(campaign: LegacyCampaign): BlockInstance[] {
  const kind: EmailKind = campaign.kind ?? "marketing";
  const data = campaign.templateData ?? {};
  const blocks: BlockInstance[] = [];

  const masthead = newInstance(kind === "marketing" ? "mh-campaign" : "mh-transactional");
  blocks.push(masthead);

  const paragraphs = legacyToParagraphs(campaign.content ?? "");
  const bodies = chunk(paragraphs);
  if (bodies.length === 0) bodies.push("");

  bodies.forEach((body, i) => {
    const block = newInstance("text-body");
    block.slots = {
      ...block.slots,
      body,
      ...(i === 0 && data.heading ? { heading: String(data.heading).slice(0, 60) } : {}),
    };
    blocks.push(block);
  });

  if (data.cta_text && data.cta_url) {
    const button = newInstance("btn-primary");
    button.slots = { ...button.slots, label: String(data.cta_text).slice(0, 26) };
    button.links = { ...button.links, href: String(data.cta_url) };
    blocks.push(button);
  }

  blocks.push(newInstance(kind === "marketing" ? "ft-marketing" : "ft-transactional"));
  return blocks;
}
