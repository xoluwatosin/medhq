import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

export type EdgeSurface = "page" | "card" | "navy" | "desk" | "muted";

export interface ScreenEdges {
  top: EdgeSurface;
  bottom: EdgeSurface;
}

/**
 * The page visible at each iPhone edge. This is deliberately route-based:
 * Safari only exposes one theme colour, while the two safe areas can continue
 * the actual shell touching each edge.
 */
export const screenEdgesForPath = (pathname: string): ScreenEdges => {
  if (pathname.startsWith("/pre-assessment/") || pathname.startsWith("/care/start/")) return { top: "navy", bottom: "card" };

  const publicNavyTop = new Set([
    "/", "/for-facilities", "/care-at-home", "/clinical-home-care",
    "/post-surgical-care", "/care-from-abroad", "/agency-vs-private-nurse-lagos",
    "/antenatal-care", "/postnatal-care", "/nanny-childcare", "/eldercare",
    "/pediatric-care", "/hospital-staffing", "/hospital-support",
    "/clinical-research", "/about", "/contact", "/join", "/creator",
    "/blog", "/hm", "/heard",
  ]);
  if (publicNavyTop.has(pathname) || pathname.startsWith("/home-care-")) {
    return { top: "navy", bottom: "page" };
  }

  if (pathname === "/portal/login" || pathname === "/portal/set-password" || pathname === "/claim") {
    return { top: "navy", bottom: "navy" };
  }

  if (
    pathname === "/portal/start" ||
    pathname === "/portal/verify" ||
    /^\/join\/[^/]+\/(account|verify)$/.test(pathname)
  ) {
    return { top: "navy", bottom: "desk" };
  }

  if (pathname === "/portal" || pathname.startsWith("/portal/")) {
    return { top: "navy", bottom: "card" };
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return { top: "card", bottom: "muted" };
  }

  if (pathname === "/assessor" || pathname.startsWith("/assessor/")) {
    return { top: "page", bottom: "page" };
  }

  if (pathname.startsWith("/contract/")) return { top: "desk", bottom: "desk" };

  return { top: "page", bottom: "page" };
};

const IPhoneScreenEdges = () => {
  const { pathname } = useLocation();
  const edges = screenEdgesForPath(pathname);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.edgeTop = edges.top;
    root.dataset.edgeBottom = edges.bottom;

    // Safari uses theme-color for its own collapsible browser interface.
    // Read the semantic route token from CSS so colour values stay central.
    const themeColour = getComputedStyle(root).getPropertyValue("--active-edge-theme").trim();
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
      meta.content = themeColour;
    });
  }, [edges.bottom, edges.top]);

  return (
    <div className="iphone-screen-edges" aria-hidden="true">
      <span className="iphone-screen-edge iphone-screen-edge-top" />
      <span className="iphone-screen-edge iphone-screen-edge-bottom" />
    </div>
  );
};

export default IPhoneScreenEdges;