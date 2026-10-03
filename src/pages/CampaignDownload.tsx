import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { campaignAttachmentPath, campaignStorageUrl } from "@/lib/campaign-downloads";

/**
 * Retired landing page. Kept only so links in already-sent emails still work:
 * it redirects straight to the file with no interstitial screen.
 */
const CampaignDownload = () => {
  const [params] = useSearchParams();
  const path = campaignAttachmentPath(params.get("file"));
  const sourceUrl = path ? campaignStorageUrl(path) : "";
  const [objectUrl, setObjectUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!sourceUrl) return;
    let cancelled = false;

    const openDocument = async () => {
      try {
        const response = await fetch(sourceUrl);
        if (!response.ok) throw new Error("Document unavailable");
        const blob = await response.blob();
        if (cancelled) return;
        const nextUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        setObjectUrl(nextUrl);
        window.location.replace(nextUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    openDocument();
    return () => { cancelled = true; };
  }, [sourceUrl]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 text-center">
      <p className="text-base text-muted-foreground">
        {failed ? (
          "That document link is not available right now."
        ) : objectUrl ? (
          <>
            Opening your document.{" "}
            <a className="underline" href={objectUrl}>
              Tap here if it does not open.
            </a>
          </>
        ) : sourceUrl ? (
          "Opening your document."
        ) : (
          "That document link is no longer available."
        )}
      </p>
    </main>
  );
};

export default CampaignDownload;
