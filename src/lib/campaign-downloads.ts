const ATTACHMENT_PREFIX = "campaigns/attachments/";
const STORAGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/blog-images/`;
const PUBLIC_ORIGIN = "https://www.medicconnect.co";

function safeAttachmentPath(value: string | null | undefined): string {
  if (!value) return "";
  try {
    const raw = decodeURIComponent(value);
    const path = raw.includes("/storage/v1/object/public/blog-images/")
      ? raw.split("/storage/v1/object/public/blog-images/").pop() ?? ""
      : raw;
    return path.startsWith(ATTACHMENT_PREFIX) && !path.includes("..") ? path : "";
  } catch {
    return "";
  }
}

/** Branded recipient-facing link. The raw storage URL is kept internal only. */
export function campaignDownloadUrl(path: string, filename?: string): string {
  const safePath = safeAttachmentPath(path);
  if (!safePath) return "";
  const displayName = filename || safePath.split("/").pop() || "document.pdf";
  return `${PUBLIC_ORIGIN}/download/${encodeURIComponent(displayName)}?file=${encodeURIComponent(safePath)}`;
}

export function campaignStorageUrl(path: string): string {
  const safePath = safeAttachmentPath(path);
  if (!safePath) return "";
  return `${STORAGE_BASE}${safePath.split("/").map(encodeURIComponent).join("/")}`;
}

export function campaignAttachmentPath(value: string | null): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    return safeAttachmentPath(url.searchParams.get("file") || value);
  } catch {
    return safeAttachmentPath(value);
  }
}
