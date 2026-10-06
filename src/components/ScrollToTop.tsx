import { useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Opening a page starts it at the top. A link to a section (#apply) goes to
 * that section, and Back or Forward leaves the browser to return to where the
 * visitor was. Filters that only change the query (?view=archived) keep the
 * scroll position.
 */
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType === "POP") return;
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView();
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, hash, navigationType]);

  return null;
};

export default ScrollToTop;
