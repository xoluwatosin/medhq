// Care offer links and money, shared by the family's page and staff sending.
//
// A link reads MC-2610-0102-O1-K7M4Q2XP: the offer reference, then a secret.
// Only its hash is kept. Totals are worked out the same way as on the page.
import { hashToken } from "./care-form.ts";

export const OFFER_TOKEN = /^MC-\d{4}-\d{4,}-O\d+-[A-Z0-9]{8}$/;

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newOfferSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes).map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const offerTokenHash = (plain: string) => hashToken(plain);

export interface OfferOption { id: string; title: string; monthly: number }

export const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

export function optionTotals(option: OfferOption, months: number, discountPercent: number) {
  const total = option.monthly * months;
  // Rounded down, so the discount is never smaller than promised: to the
  // nearest ₦1,000 on larger sums, to the nearest ₦10 on small ones.
  const step = total >= 100_000 ? 1000 : 10;
  const upfront = Math.floor((total * (100 - discountPercent)) / 100 / step) * step;
  return { monthly: option.monthly, total, upfront, saving: total - upfront };
}
