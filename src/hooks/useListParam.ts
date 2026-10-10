// Filters that remember. Each filter, view, sort and page on an admin list
// lives in the address bar, so back, reload and shared links keep it, and the
// last-used set is restored when the list is opened bare.
//
// Usage, in place of useState:
//   useRestoreListParams();                       // once, at the top of the page
//   const [stateFilter, setStateFilter] = useListParam("state", "all");
import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { memoryKey, restoreSearch, withParam, withoutParams } from "@/lib/list-params";

// Several setters can run in one click (changing state also clears the LGA).
// React Router reads the address from the last render, so writes in the same
// tick would overwrite each other. This holds the newest address per path.
const pending = new Map<string, string>();

const remember = (pathname: string, search: string) => {
  try {
    localStorage.setItem(memoryKey(pathname), search);
  } catch {
    /* private windows and blocked storage just lose the memory */
  }
};

function useWriter() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    pending.set(location.pathname, location.search);
  }, [location.pathname, location.search]);
  return useCallback(
    (next: (current: string) => string) => {
      const current = pending.get(location.pathname) ?? location.search;
      const search = next(current);
      if (search === current) return;
      pending.set(location.pathname, search);
      remember(location.pathname, search);
      navigate({ pathname: location.pathname, search }, { replace: true });
    },
    [location.pathname, location.search, navigate],
  );
}

/** Call once per list page: a bare address restores the last-used filters. */
export function useRestoreListParams() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(memoryKey(location.pathname));
    } catch {
      saved = null;
    }
    const target = restoreSearch(location.search, saved);
    if (target) {
      pending.set(location.pathname, target);
      navigate({ pathname: location.pathname, search: target }, { replace: true });
    } else {
      pending.set(location.pathname, location.search);
      if (location.search) remember(location.pathname, location.search);
    }
    // Only on arrival at the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
}

/** One filter held in the address bar. Same shape as useState. */
export function useListParam<T extends string>(name: string, fallback: T): [T, (value: T) => void] {
  const location = useLocation();
  const write = useWriter();
  const value = (new URLSearchParams(location.search).get(name) ?? fallback) as T;
  const set = useCallback((next: T) => write((current) => withParam(current, name, next, fallback)), [write, name, fallback]);
  return [value, set];
}

/** Clear the named filters together, for a "Clear all" control. */
export function useClearListParams() {
  const write = useWriter();
  return useCallback((names: string[]) => write((current) => withoutParams(current, names)), [write]);
}
