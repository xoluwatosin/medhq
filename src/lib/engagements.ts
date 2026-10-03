// Two layers of hiring: the engagement, then the work under it.
//
// An engagement is the relationship. It is established once, papered once and
// signed once: employment on our books, a fixed term placement with a client,
// or a bank and locum agreement covering a scope of work for a period.
//
// Work offers are the shifts and assignments handed out underneath a live
// engagement. They carry dates, hours and sometimes their own rate, and they
// never need new paper, because the engagement already covers them.
import type { Offer } from "@/lib/offers";

export type EngagementType = "employment" | "placement" | "bank";
export type WorkType = "shift" | "assignment";
export type OfferLayerType = EngagementType | WorkType;

export interface OfferTypeSpec {
  value: OfferLayerType;
  /** Establishing the relationship, or handing out work under one. */
  layer: "engagement" | "work";
  label: string;
  /** One sentence, written the way it would be explained out loud. */
  description: string;
  /** Whether a signed document follows acceptance. */
  paper: "full_contract" | "agreement" | "none";
  /** Both sides sign, the candidate alone, or nobody. */
  signature: "both" | "candidate" | "none";
  /** Dated shifts belong on this offer. */
  usesShifts: boolean;
  /** The offer states its own rate rather than inheriting the engagement's. */
  ownRate: boolean;
  /** The contract type the paper is drafted as. */
  contractType?: string;
}

export const OFFER_TYPES: OfferTypeSpec[] = [
  {
    value: "employment",
    layer: "engagement",
    label: "Employment",
    description: "On our books, open ended. Their shifts and rota sit under this, with no further paper.",
    paper: "full_contract",
    signature: "both",
    usesShifts: false,
    ownRate: false,
    contractType: "full_time",
  },
  {
    value: "placement",
    layer: "engagement",
    label: "Placement",
    description: "A fixed term with one client or facility, ending on a date.",
    paper: "full_contract",
    signature: "both",
    usesShifts: false,
    ownRate: false,
    contractType: "fixed_term",
  },
  {
    value: "bank",
    layer: "engagement",
    label: "Bank or locum agreement",
    description: "A scope of work for a stated period. Rates are agreed shift by shift underneath it.",
    paper: "agreement",
    signature: "candidate",
    usesShifts: false,
    ownRate: false,
    contractType: "locum",
  },
  {
    value: "shift",
    layer: "work",
    label: "Shift offer",
    description: "Dated shifts under a live engagement. Accepted in their portal, no new paper.",
    paper: "none",
    signature: "none",
    usesShifts: true,
    ownRate: true,
  },
  {
    value: "assignment",
    layer: "work",
    label: "Assignment",
    description: "A run of days or a rota under a live engagement, offered as one piece of work.",
    paper: "none",
    signature: "none",
    usesShifts: true,
    ownRate: true,
  },
];

export const offerTypeSpec = (t?: string | null): OfferTypeSpec =>
  OFFER_TYPES.find((x) => x.value === t) || OFFER_TYPES[1];

export const ENGAGEMENT_TYPES = OFFER_TYPES.filter((t) => t.layer === "engagement");
export const WORK_TYPES = OFFER_TYPES.filter((t) => t.layer === "work");

/**
 * The layer an offer belongs to.
 *
 * Offers written before the two layers existed carry no type of their own, so
 * they are read the way they were meant: dated shifts were work, everything
 * else stood in for a placement.
 */
export function offerType(o: Offer): OfferLayerType {
  const t = (o as any).engagement_type as string | undefined;
  if (t && OFFER_TYPES.some((x) => x.value === t)) return t as OfferLayerType;
  return o.shifts?.length || o.kind === "shift" ? "shift" : "placement";
}

export const isEngagementOffer = (o: Offer) => offerTypeSpec(offerType(o)).layer === "engagement";
export const isWorkOffer = (o: Offer) => offerTypeSpec(offerType(o)).layer === "work";

/** An engagement that is running, and so can carry work under it. */
export const isLiveEngagement = (o: Offer) => isEngagementOffer(o) && o.status === "accepted";

/** How the paper on an engagement is described before it exists. */
export function paperLine(t: OfferLayerType): string {
  const spec = offerTypeSpec(t);
  if (spec.paper === "none") return "No document. It runs under the engagement they already hold.";
  if (spec.paper === "agreement") return "An agreement covering the scope, signed by them.";
  return "A full contract, signed by them and countersigned by us.";
}
