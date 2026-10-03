import { createContext, ReactNode, useContext } from "react";
import { heardBase } from "@/lib/heard-host";

/**
 * The base path the Heard routes are mounted at.
 *
 *   ""               on heard.medicconnect.co
 *   "/heard-preview" on preview and Medic Connect hostnames
 *
 * Heard links and page paths are built through heardPath() so one component
 * tree serves both mount points without duplicating any page.
 */
// Default "/heard": the legacy pre-launch page and its thank-you page still
// live under /heard on Medic Connect hosts and are not part of the new mount.
const HeardBaseContext = createContext<string>("/heard");

export const HeardBaseProvider = ({
  base,
  children,
}: {
  base?: string;
  children: ReactNode;
}) => (
  <HeardBaseContext.Provider value={base ?? heardBase()}>
    {children}
  </HeardBaseContext.Provider>
);

/** Prefixes a Heard route with the active base: "/write" -> "/heard-preview/write". */
export const useHeardPath = () => {
  const base = useContext(HeardBaseContext);
  return (path: string) => {
    const clean = path.startsWith("/") ? path : `/${path}`;
    if (!base) return clean;
    return clean === "/" ? base : `${base}${clean}`;
  };
};

export const useHeardBase = () => useContext(HeardBaseContext);
