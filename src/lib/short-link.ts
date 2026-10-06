// Short share links for blog posts: www.medicconnect.co/b/<code> instead of
// the long hyphenated address. The code is worked out from the slug, so it
// needs no storage and never changes while the slug stays the same.
const SITE = "https://www.medicconnect.co";

/** Six letters and digits from the slug (FNV-1a hash, base 36). */
export const shortCode = (slug: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(6, "0").slice(-6);
};

export const shortBlogUrl = (slug: string): string => `${SITE}/b/${shortCode(slug)}`;
