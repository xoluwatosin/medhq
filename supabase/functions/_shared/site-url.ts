// The public origin used in links we email out. Set the SITE_URL secret to
// move every emailed link at once. The fallback is the current live host so
// nothing changes until that secret exists.
export const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://www.medicconnect.co").replace(/\/+$/, "");