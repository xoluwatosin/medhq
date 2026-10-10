// Lightweight UTM + referrer capture. First-touch attribution: the first
// value we see per session is kept, subsequent visits don't overwrite.

const KEY = "mc_attribution_v1";

export interface Attribution {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer: string | null;
  landing_path: string | null;
  captured_at: string;
}

const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

function inferSourceFromReferrer(ref: string | null): { source: string | null; medium: string | null } {
  if (!ref) return { source: null, medium: null };
  try {
    const host = new URL(ref).hostname.replace(/^www\./, "");
    if (!host) return { source: null, medium: null };
    if (/google\./.test(host)) return { source: "google", medium: "organic" };
    if (/bing\./.test(host)) return { source: "bing", medium: "organic" };
    if (/duckduckgo\./.test(host)) return { source: "duckduckgo", medium: "organic" };
    if (/(instagram|l\.instagram)\./.test(host)) return { source: "instagram", medium: "social" };
    if (/(facebook|l\.facebook|fb\.me)\./.test(host)) return { source: "facebook", medium: "social" };
    if (/(twitter|t\.co|x\.com)\./.test(host)) return { source: "twitter", medium: "social" };
    if (/linkedin\./.test(host)) return { source: "linkedin", medium: "social" };
    if (/(whatsapp|wa\.me)\./.test(host)) return { source: "whatsapp", medium: "social" };
    if (/(t\.me|telegram)\./.test(host)) return { source: "telegram", medium: "social" };
    if (/tiktok\./.test(host)) return { source: "tiktok", medium: "social" };
    if (/youtube\./.test(host)) return { source: "youtube", medium: "social" };
    return { source: host, medium: "referral" };
  } catch {
    return { source: null, medium: null };
  }
}

export function captureAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const hasUtm = PARAMS.some((p) => url.searchParams.get(p));
    const stored = sessionStorage.getItem(KEY);
    if (stored && !hasUtm) {
      return JSON.parse(stored) as Attribution;
    }

    const ref = document.referrer || null;
    const sameOrigin = ref ? (() => { try { return new URL(ref).origin === window.location.origin; } catch { return false; } })() : false;
    const externalRef = sameOrigin ? null : ref;

    const inferred = inferSourceFromReferrer(externalRef);

    // A short share link (/b/<code>) only ever comes from someone sharing a post.
    const shared = url.pathname.startsWith("/b/");

    const attribution: Attribution = {
      utm_source: url.searchParams.get("utm_source") || inferred.source || (shared ? "share" : null),
      utm_medium: url.searchParams.get("utm_medium") || inferred.medium || (shared ? "shared_link" : null),
      utm_campaign: url.searchParams.get("utm_campaign") || (shared ? "blog" : null),
      utm_term: url.searchParams.get("utm_term"),
      utm_content: url.searchParams.get("utm_content"),
      referrer: externalRef,
      landing_path: url.pathname + url.search,
      captured_at: new Date().toISOString(),
    };

    // Only write if we captured something meaningful, or nothing is stored yet.
    if (!stored || hasUtm) {
      sessionStorage.setItem(KEY, JSON.stringify(attribution));
    }
    return stored ? (JSON.parse(stored) as Attribution) : attribution;
  } catch {
    return null;
  }
}

export function getAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored) return JSON.parse(stored) as Attribution;
    return captureAttribution();
  } catch {
    return null;
  }
}

/**
 * The visit's source as database columns, for any public form that records a
 * lead (contact_submissions, creator_applications, join_applications and the
 * matchmaker applications all carry these seven columns).
 */
export function attributionColumns() {
  const a = getAttribution();
  return {
    utm_source: a?.utm_source ?? null,
    utm_medium: a?.utm_medium ?? null,
    utm_campaign: a?.utm_campaign ?? null,
    utm_term: a?.utm_term ?? null,
    utm_content: a?.utm_content ?? null,
    referrer: a?.referrer ?? null,
    landing_path: a?.landing_path ?? null,
  };
}
