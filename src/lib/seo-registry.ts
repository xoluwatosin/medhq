/**
 * Vocabulary and pure logic for the SEO governance registry.
 *
 * The database is the authority on whether a page may be indexed; everything
 * here is presentation and client-side mirroring of the same rules so the
 * console can say plainly what is blocking a page before anyone tries.
 *
 * Operational truth is never restated here: services stay in `services`,
 * pricing stays in `service_fees`, articles stay in `blog_posts`.
 */
import type { StatusTone } from "@/components/field/Status";

export const PAGE_TYPES = [
  "service", "hub", "editorial", "comparison", "pricing", "trust",
  "location", "b2b", "talent", "job_collection", "other",
] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const INDEX_STATES = ["candidate", "draft", "review", "indexable", "noindex", "retired"] as const;
export type IndexState = (typeof INDEX_STATES)[number];

export const PUBLICATION_STATES = ["planned", "in_progress", "ready", "published", "archived"] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

export const EVIDENCE_STATES = ["missing", "partial", "sufficient", "stale"] as const;
export type EvidenceState = (typeof EVIDENCE_STATES)[number];

export const MODULE_TYPES = [
  "trust", "assessment", "clinical_scope", "escalation", "pricing_logic", "coverage",
  "care_reporting", "medication", "staffing_model", "postnatal", "safeguarding",
  "b2b_compliance", "talent_feed", "diaspora_coordination", "event_scoping",
  "programme_delivery", "other",
] as const;
export type ModuleType = (typeof MODULE_TYPES)[number];

export const REVIEW_STATES = ["draft", "review", "approved", "retired"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const CLAIM_TYPES = [
  "accreditation", "insurance", "membership", "service_scope", "coverage", "response_time",
  "workforce_count", "availability", "pricing", "credential_process", "partner",
  "operating_fact", "other",
] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export const CLAIM_STATES = ["draft", "review", "approved", "stale", "retired"] as const;
export type ClaimState = (typeof CLAIM_STATES)[number];

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const MARKET_STATES = [
  "research", "building_coverage", "available", "established", "suspended", "not_published",
] as const;
export type MarketState = (typeof MARKET_STATES)[number];

export const DEMAND_STATES = ["unknown", "weak", "moderate", "strong"] as const;
export type DemandState = (typeof DEMAND_STATES)[number];

export const SAFETY_STATES = ["review", "serviceable", "restricted", "suspended"] as const;
export type SafetyState = (typeof SAFETY_STATES)[number];

const sentence = (value: string) =>
  value.replace(/_/g, " ").replace(/^\w/, (character) => character.toUpperCase());

export const label = (value: string | null | undefined, overrides: Record<string, string> = {}) => {
  if (!value) return "Not recorded";
  return overrides[value] ?? sentence(value);
};

export const PAGE_TYPE_LABELS: Record<string, string> = {
  b2b: "B2B",
  job_collection: "Job collection",
};

export const indexTone = (state: string): StatusTone => {
  if (state === "indexable") return "good";
  if (state === "retired" || state === "noindex") return "neutral";
  if (state === "review") return "progress";
  return "info";
};

export const publicationTone = (state: string): StatusTone => {
  if (state === "published") return "good";
  if (state === "ready") return "info";
  if (state === "archived") return "neutral";
  return "progress";
};

export const evidenceTone = (state: string): StatusTone => {
  if (state === "sufficient") return "good";
  if (state === "partial") return "progress";
  return "warning";
};

export const reviewTone = (state: string): StatusTone => {
  if (state === "approved") return "good";
  if (state === "review") return "progress";
  if (state === "retired") return "neutral";
  return "info";
};

export const claimTone = (state: string): StatusTone => {
  if (state === "approved") return "good";
  if (state === "stale") return "warning";
  if (state === "retired") return "neutral";
  if (state === "review") return "progress";
  return "info";
};

export const riskTone = (risk: string): StatusTone => (risk === "high" ? "warning" : risk === "medium" ? "progress" : "neutral");

export const marketTone = (state: string): StatusTone => {
  if (state === "established" || state === "available") return "good";
  if (state === "suspended" || state === "not_published") return "warning";
  return "progress";
};

/** Mirrors `public.seo_claim_effective_state`. */
export const claimEffectiveState = (
  state: string,
  validFrom: string | null,
  validUntil: string | null,
  now: Date = new Date(),
): string => {
  if (state !== "approved") return state;
  if (validUntil && new Date(validUntil).getTime() < now.getTime()) return "stale";
  if (validFrom && new Date(validFrom).getTime() > now.getTime()) return "draft";
  return "approved";
};

export const CLINICAL_REQUIREMENTS = ["required", "not_required"] as const;
export type ClinicalRequirement = (typeof CLINICAL_REQUIREMENTS)[number];

/**
 * Clinical risk stays as governance metadata. It is deliberately not a
 * publication dependency: the governed SEO process is the approval authority
 * for canonical wording, including clinically related wording.
 */
interface ClinicalReviewable {
  requires_clinical_review?: boolean;
  clinical_reviewed_at?: string | null;
  clinical_reviewed_by?: string | null;
}

export interface PageGateInput {
  page_type: string;
  publication_state: string;
  /** Kept as a working note; it no longer gates publication. */
  evidence_state?: string;
  /** Governance metadata only. */
  clinical_requirement?: string | null;
  clinical_reviewed_at?: string | null;
  clinical_reviewed_by?: string | null;
  requiredClaims: Array<
    { state: string; valid_from: string | null; valid_until: string | null } & ClinicalReviewable
  >;
  requiredModules: Array<{ review_state: string } & ClinicalReviewable>;
  markets: Array<{ market_state: string; safety_state: string; hasLocalEvidence?: boolean }>;
  /** True when the page quotes a price: a pricing page, pricing claim or pricing module. */
  quotesPricing?: boolean;
  /** Governed fee records behind any quoted price. */
  governedFees?: Array<{ state: string; public_visibility?: string; is_current?: boolean }>;
}

/** A fee may only back a public price when it is current, public and priced. */
export const isPublishableFee = (fee: {
  state: string;
  public_visibility?: string;
  is_current?: boolean;
}): boolean =>
  ["set", "on_request"].includes(fee.state) &&
  (fee.public_visibility ?? "public") === "public" &&
  (fee.is_current ?? true);

/**
 * Mirrors `public.seo_page_blockers`. The server remains authoritative; this
 * exists so the console can show the same sentences without a round trip.
 */
export const pageBlockers = (page: PageGateInput, now: Date = new Date()): string[] => {
  const blockers: string[] = [];

  if (!["ready", "published"].includes(page.publication_state)) blockers.push("Publication not ready");
  if (page.requiredClaims.some((claim) => claimEffectiveState(claim.state, claim.valid_from, claim.valid_until, now) !== "approved")) {
    blockers.push("Required claim not approved");
  }
  if (page.requiredModules.some((module) => module.review_state !== "approved")) {
    blockers.push("Required module not approved");
  }
  if (page.page_type === "location" || page.markets.length > 0) {
    const serviceable = page.markets.some(
      (market) =>
        ["available", "established"].includes(market.market_state) &&
        market.safety_state === "serviceable",
    );
    if (!serviceable) blockers.push("Market not serviceable");
  }
  if (page.quotesPricing ?? page.page_type === "pricing") {
    if (!(page.governedFees ?? []).some(isPublishableFee)) blockers.push("Pricing not governed");
  }

  return blockers;
};

/** Keys a page-local context may never carry: they belong to a governed source. */
export const GOVERNED_KEYS = [
  "price", "prices", "pricing", "amount", "fee", "fees", "accreditation", "insurance",
  "professional_scope", "scope", "credential", "credentials", "credential_requirements",
  "coverage", "safeguarding", "safeguarding_standards", "response_time", "response_times",
] as const;

export const governedKeysIn = (context: Record<string, unknown>): string[] =>
  GOVERNED_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(context ?? {}, key));

export const PRICING_EVIDENCE_MISSING = "Pricing evidence missing";
