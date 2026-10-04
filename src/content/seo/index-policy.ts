/**
 * Indexing policy for SEO routes.
 *
 * A route existing in the codebase no longer makes it indexable. A route is
 * served to anyone who has the link, but it only enters the sitemap, llms.txt
 * and search indexes when its governed registry record is approved and its
 * path is listed here. This file mirrors `public.seo_pages`: the database
 * remains the governance authority, this file is the build-time and
 * render-time copy of the same decision.
 */

/**
 * Expansion routes that duplicate an established page. The established URL
 * owns the topic; the duplicate redirects to it and never renders content.
 */
export const EXPANSION_REDIRECTS: Record<string, string> = {
  "/antenatal-care-at-home": "/antenatal-care",
  "/clinical-research-staffing": "/clinical-research",
  "/hospital-support-services": "/hospital-support",
  "/ngo-health-programme-implementation": "/ngo-healthcare-staffing",
  "/community-health-outreach-services": "/ngo-healthcare-staffing",
  "/physiotherapy-after-stroke": "/stroke-recovery-at-home",
  "/managed-postpartum-stay-in-nigeria": "/professional-omugwo",
};

/**
 * Expansion routes approved for indexing after the ownership review: each
 * answers a distinct question with no established or governed page owning it.
 * Overlapping routes stay unindexed until their cluster is resolved; see
 * ownership-table.md.
 */
export const INDEXABLE_EXPANSION_PATHS: string[] = [
  "/wound-dressing-at-home",
  "/blood-sample-collection-at-home",
  "/iv-therapy-at-home",
  "/injection-at-home",
  "/stoma-care-at-home",
  "/peg-feeding-support-at-home",
  "/tracheostomy-care-at-home",
  "/ventilator-care-at-home",
  "/medication-administration-at-home",
  "/diabetic-foot-care-at-home",
  "/medical-escort-services",
  "/home-care-vs-care-home",
  "/nurse-vs-caregiver",
  "/who-do-i-need-after-surgery",
  "/transport-to-medical-appointments",
  "/how-to-verify-a-nurse-in-nigeria",
  "/how-to-verify-a-doctor-in-nigeria",
  "/caregiver-cost-in-lagos",
  "/diabetes-care-at-home",
  "/cancer-care-at-home",
  "/night-nurse-for-newborn",
  "/live-in-nanny",
  "/live-in-caregiver",
  "/continence-care-at-home",
  "/orthopaedic-recovery-at-home",
];

const indexableExpansion = new Set(INDEXABLE_EXPANSION_PATHS);

/** Expansion routes are not indexable unless explicitly approved above. */
export const isExpansionIndexable = (path: string): boolean => indexableExpansion.has(path);

/** The URL that owns the topic for a given route, when it is not the route itself. */
export const canonicalOwnerFor = (path: string): string | undefined => EXPANSION_REDIRECTS[path];
