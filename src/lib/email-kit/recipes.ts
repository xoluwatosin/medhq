// The recipes. A send is a starting point plus the copy, never a blank canvas.
import { CATALOGUE } from "./catalogue.generated";
import { blockFields } from "./fields";
import type { BlockInstance, EmailKind, EmailTemplateDoc, Recipe } from "./types";

export const RECIPES = CATALOGUE.recipes as unknown as Recipe[];

export const GROUPS = CATALOGUE.groups as unknown as { id: string; name: string; position: string; max?: number }[];

export const TOKENS = CATALOGUE.tokens as unknown as {
  color: Record<string, string>;
};

export const KIT_CONTACT = CATALOGUE.meta.contact;

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `b${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function newInstance(blockId: string): BlockInstance {
  const slots: Record<string, string> = {};
  const links: Record<string, string> = {};
  for (const field of blockFields(blockId)) {
    if (field.kind === "link") {
      links[field.path] = field.default ?? defaultLink(field.path);
    } else if (field.kind !== "image" && field.default) {
      slots[field.path] = field.default;
    }
  }
  return { id: uid(), blockId, slots, images: {}, links };
}

function defaultLink(path: string): string {
  switch (path) {
    case "whatsapp":
      return KIT_CONTACT.whatsappUrl;
    case "website":
      return "https://www.medicconnect.co";
    case "unsubscribe":
      return "https://www.medicconnect.co/unsubscribe";
    case "preferences":
      return "https://www.medicconnect.co/unsubscribe";
    case "facebook":
      return "https://www.facebook.com/medicconnect";
    case "instagram":
      return "https://www.instagram.com/medicconnect";
    case "linkedin":
      return "https://www.linkedin.com/company/medicconnect";
    default:
      return "https://www.medicconnect.co";
  }
}

export function fromRecipe(recipeId: string, name?: string): EmailTemplateDoc | null {
  const recipe = RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return null;
  return {
    name: name ?? recipe.name,
    kind: recipe.kind as EmailKind,
    subject: "",
    preheader: "",
    blocks: recipe.blocks.map(newInstance),
  };
}

export function blankEmail(kind: EmailKind = "transactional"): EmailTemplateDoc {
  return {
    name: "Untitled email",
    kind,
    subject: "",
    preheader: "",
    blocks: [
      newInstance(kind === "marketing" ? "mh-campaign" : "mh-transactional"),
      newInstance("text-body"),
      newInstance(kind === "marketing" ? "ft-marketing" : "ft-transactional"),
    ],
  };
}
