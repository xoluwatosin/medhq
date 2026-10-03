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
};

/**
 * Expansion routes approved for indexing. Empty until the ownership review
 * decides which routes have a distinct purpose against the established pages.
 */
export const INDEXABLE_EXPANSION_PATHS: string[] = [];

const indexableExpansion = new Set(INDEXABLE_EXPANSION_PATHS);

/** Expansion routes are not indexable unless explicitly approved above. */
export const isExpansionIndexable = (path: string): boolean => indexableExpansion.has(path);

/** The URL that owns the topic for a given route, when it is not the route itself. */
export const canonicalOwnerFor = (path: string): string | undefined => EXPANSION_REDIRECTS[path];
