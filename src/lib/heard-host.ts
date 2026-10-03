/**
 * Which product is this hostname serving, and where do Heard pages live?
 *
 * Heard and Medic Connect share one codebase and one backend, but they are
 * separate products. The hostname decides which one the browser is looking at.
 *
 *   heard.medicconnect.co  -> Heard, at the root of the site
 *   everything else        -> Medic Connect, unchanged
 *
 * Preview and local development do not have the Heard hostname, so the same
 * Heard route definitions are also mounted under a dedicated development
 * prefix. See docs/heard/architecture.md.
 *
 *   production: heard.medicconnect.co/story-swap
 *   preview:    <preview host>/heard-preview/story-swap
 *
 * There is no product query parameter. The hostname alone decides the live
 * product, and the prefix alone decides the preview namespace.
 */

export const HEARD_HOSTNAMES = ["heard.medicconnect.co"];

/** Development/preview prefix for Heard on non-Heard hostnames. */
export const HEARD_PREVIEW_BASE = "/heard-preview";

const hostIsHeard = (hostname: string): boolean =>
  HEARD_HOSTNAMES.includes(hostname.toLowerCase().replace(/^www\./, ""));

export const isHeardHost = (hostname?: string): boolean => {
  if (typeof window === "undefined") return false;
  return hostIsHeard(hostname ?? window.location.hostname);
};

/** "" on the Heard hostname, "/heard-preview" everywhere else. */
export const heardBase = (): string => (isHeardHost() ? "" : HEARD_PREVIEW_BASE);
