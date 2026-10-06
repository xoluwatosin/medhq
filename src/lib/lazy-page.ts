import { lazy, type ComponentType } from "react";

const RELOAD_FLAG = "mc-chunk-reload";

/**
 * A page loaded only when someone opens it, so the first visit downloads just
 * that page's code. If the file has gone (a new release replaced it while the
 * tab was open), reload once to pick up the new release.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- React.lazy accepts any component
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().then(
      (mod) => {
        try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* storage blocked */ }
        return mod;
      },
      (err) => {
        let reloaded = false;
        try {
          reloaded = sessionStorage.getItem(RELOAD_FLAG) === "1";
          if (!reloaded) sessionStorage.setItem(RELOAD_FLAG, "1");
        } catch { reloaded = true; }
        if (reloaded) throw err;
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      },
    ),
  );
}
