// GENERATED — do not edit. Run scripts/sync-email-kit.sh after changing src/lib/email-kit.
// The assembly rules, enforced in code rather than in a style guide nobody reads.
//
// Validation runs on save, not on send, and refuses with the rule that failed in
// plain words.
import { blockFields, BLOCK_BY_ID } from "./fields.ts";
import { renderEmail } from "./render.ts";
import type { EmailTemplateDoc, RuleViolation } from "./types.ts";

export function validateEmail(doc: EmailTemplateDoc): RuleViolation[] {
  const problems: RuleViolation[] = [];
  const blocks = doc.blocks ?? [];
  const ids = blocks.map((b) => b.blockId);
  const groupOf = (id: string) => BLOCK_BY_ID[id]?.group;

  const mastheads = ids.filter((id) => groupOf(id) === "masthead");
  if (mastheads.length !== 1) {
    problems.push({ rule: "one-masthead", message: "An email needs exactly one masthead." });
  } else if (groupOf(ids[0]) !== "masthead") {
    problems.push({ rule: "one-masthead", message: "The masthead has to be the first block." });
  }

  const footers = ids.filter((id) => groupOf(id) === "footer");
  if (footers.length !== 1) {
    problems.push({ rule: "one-footer", message: "An email needs exactly one footer." });
  } else if (groupOf(ids[ids.length - 1]) !== "footer") {
    problems.push({ rule: "one-footer", message: "The footer has to be the last block." });
  }

  if (doc.kind === "marketing" && footers.length && !footers.includes("ft-marketing")) {
    problems.push({
      rule: "footer-kind",
      message: "A marketing send uses the marketing footer, which carries the unsubscribe link.",
    });
  }
  if (doc.kind === "transactional" && footers.includes("ft-marketing")) {
    problems.push({
      rule: "footer-kind",
      message: "A transactional send must not carry an unsubscribe link. Use the transactional footer.",
    });
  }

  if (ids.filter((id) => id === "btn-primary" || id === "btn-full").length > 1) {
    problems.push({
      rule: "one-primary",
      message: "One primary button per email. Anything else is a secondary button or a text link.",
    });
  }

  // A receipt with a testimonial in it reads as a sales email. The closing band
  // and the reassurance row are shared furniture, so only the transactional
  // workhorses are barred from a campaign.
  const hasCampaign = ids.some((id) => id.startsWith("cmp-"));
  const TRANSACTIONAL_ONLY = ["utl-table", "utl-steps", "utl-tiers"];
  const mixed = ids.filter((id) => TRANSACTIONAL_ONLY.includes(id));
  if (hasCampaign && mixed.length) {
    problems.push({
      rule: "no-mixing",
      message: "Campaign blocks and transactional blocks do not belong in the same send.",
      severity: "error",
    });
  }

  let photos = 0;
  for (const instance of blocks) {
    for (const field of blockFields(instance.blockId)) {
      const value = instance.slots?.[field.path];
      if (field.kind === "image") {
        const ref = instance.images?.[field.path];
        if (!ref?.url) {
          problems.push({
            rule: "alt-required",
            message: `${BLOCK_BY_ID[instance.blockId]?.name ?? instance.blockId}: ${field.label} has no image.`,
            blockInstanceId: instance.id,
          });
        } else {
          photos += 1;
          if (!ref.alt?.trim()) {
            problems.push({
              rule: "alt-required",
              message: `${field.label} needs alt text that reads as a sentence.`,
              blockInstanceId: instance.id,
            });
          }
          if (field.width && ref.width && ref.width !== field.width) {
            problems.push({
              rule: "image-size",
              message: `${field.label} should be ${field.width} by ${field.height ?? "auto"} pixels.`,
              blockInstanceId: instance.id,
            });
          }
        }
        continue;
      }
      if (field.required && !value?.trim() && !field.default) {
        problems.push({
          rule: "required-slot",
          message: `${BLOCK_BY_ID[instance.blockId]?.name ?? instance.blockId}: ${field.label} is empty.`,
          blockInstanceId: instance.id,
        });
      }
      if (field.maxChars && !instance.assetRef && (value?.length ?? 0) > field.maxChars) {
        problems.push({
          rule: "max-chars",
          message: `${field.label} is over ${field.maxChars} characters.`,
          blockInstanceId: instance.id,
        });
      }
    }
  }
  if (photos > 2) {
    problems.push({
      rule: "max-photos",
      message: `${photos} photographs in one send. Two is the guide, for load time and image blocking.`,
      severity: "warning",
    });
  }

  const subject = (doc.subject ?? "").trim();
  if (!subject) problems.push({ rule: "subject-length", message: "The subject line is empty." });
  if (subject.length > 55) {
    problems.push({ rule: "subject-length", message: "The subject line is over 55 characters." });
  }
  const preheader = (doc.preheader ?? "").trim();
  if (preheader.length < 40 || preheader.length > 90) {
    problems.push({
      rule: "preheader-length",
      message: "The preheader should run 40 to 90 characters, continuing the subject.",
    });
  }
  if (preheader && preheader.toLowerCase() === subject.toLowerCase()) {
    problems.push({ rule: "preheader-length", message: "The preheader repeats the subject." });
  }

  return problems;
}

export function sizeWarning(doc: EmailTemplateDoc): string | null {
  const bytes = new TextEncoder().encode(renderEmail(doc).html).length;
  if (bytes > 100_000) {
    return `This send is ${Math.round(bytes / 1024)}KB. Gmail clips anything over roughly 100KB.`;
  }
  return null;
}

export function blockingProblems(doc: EmailTemplateDoc): RuleViolation[] {
  return validateEmail(doc).filter((p) => p.severity !== "warning");
}
