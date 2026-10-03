// Types for the Medic Connect email kit.
//
// An email is never a blob of HTML. It is a kind, a subject, a preheader and an
// ordered list of block instances. The HTML is produced at send time from the
// kit, so the design system cannot be edited away by accident.

export type EmailKind = "marketing" | "transactional";

export type SlotType = "text" | "richtext" | "url" | "price" | "enum" | "bool";

export interface SlotSpec {
  type: SlotType;
  maxChars?: number;
  default?: string;
  required?: boolean;
  options?: string[];
  note?: string;
}

export interface ImageSpec {
  width?: number;
  height?: number;
  fixed?: string;
  alt?: string;
  decorative?: boolean;
  note?: string;
}

export interface BlockSpec {
  id: string;
  group: "masthead" | "button" | "campaign" | "utility" | "small" | "footer" | "text";
  name: string;
  surface?: string;
  slots: Record<string, SlotSpec>;
  images: Record<string, ImageSpec>;
  notes?: string;
}

export interface ImageRef {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface BlockInstance {
  /** uuid of this instance, stable across reorders */
  id: string;
  /** catalogue block id, e.g. 'cmp-hero' */
  blockId: string;
  slots: Record<string, string>;
  images: Record<string, ImageRef>;
  links: Record<string, string>;
  /** Optional uploaded asset backing this block, such as a campaign PDF. */
  assetRef?: string;
}

export interface EmailTemplateDoc {
  id?: string;
  name: string;
  kind: EmailKind;
  subject: string;
  preheader: string;
  blocks: BlockInstance[];
  /** the recipe it started from, kept so we can tell where a design came from */
  recipe?: string;
  /** a line for the coordinator, not for the reader */
  purpose?: string;
}

export interface Recipe {
  id: string;
  name: string;
  kind: EmailKind;
  blocks: string[];
}

export interface RuleViolation {
  rule: string;
  message: string;
  /** errors block a save, warnings are advice under the canvas */
  severity?: "error" | "warning";
  blockInstanceId?: string;
}
