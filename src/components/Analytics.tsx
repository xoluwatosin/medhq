import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { initMeasurement, pageView, trackOutboundClick } from "@/lib/measurement";

/** Global click listener for WhatsApp, phone, and email links. */
function useOutboundLinkTracking() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const path = e.composedPath ? (e.composedPath() as EventTarget[]) : [];
      const target = path.find((el) => el instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;
      if (!target?.href) return;
      const href = target.href;
      if (href.startsWith("https://wa.me/")) {
        trackOutboundClick(href, "whatsapp");
      } else if (href.startsWith("tel:")) {
        trackOutboundClick(href, "phone");
      } else if (href.startsWith("mailto:")) {
        trackOutboundClick(href, "email");
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);
}

/** Route + outbound link tracking for the SPA. Drop once inside BrowserRouter. */
export function Analytics() {
  const location = useLocation();
  const initial = useRef(true);

  useEffect(() => {
    initMeasurement();
  }, []);

  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    pageView(location.pathname + location.search, document.title);
  }, [location]);

  useOutboundLinkTracking();
  return null;
}
