// Pure helpers behind useListParam: what goes in the address bar, and what a
// list remembers between visits. No React here so the rules can be tested.

/** Set or clear one parameter. A value equal to its default is left out. */
export function withParam(search: string, name: string, value: string, fallback: string): string {
  const params = new URLSearchParams(search);
  if (value === fallback || value === "") params.delete(name);
  else params.set(name, value);
  params.sort();
  const out = params.toString();
  return out ? `?${out}` : "";
}

/** Clear several parameters at once (for "Clear all"). */
export function withoutParams(search: string, names: string[]): string {
  const params = new URLSearchParams(search);
  names.forEach((n) => params.delete(n));
  params.sort();
  const out = params.toString();
  return out ? `?${out}` : "";
}

/**
 * Where a list should land when opened. An address that already carries
 * filters wins (a shared link, a bookmark, a back button). A bare address
 * restores what this admin last used on this list.
 */
export function restoreSearch(currentSearch: string, remembered: string | null): string | null {
  if (currentSearch && currentSearch !== "?") return null;
  if (!remembered || remembered === "?") return null;
  return remembered.startsWith("?") ? remembered : `?${remembered}`;
}

export const memoryKey = (pathname: string) => `mc-list:${pathname}`;
