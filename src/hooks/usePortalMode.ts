// One login, two operating modes. The account never changes when somebody
// joins or leaves the Workforce; only the mode it resolves to does.
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { resolvePortalMode, type PortalModeResult } from "@/lib/lifecycle";

export function usePortalMode() {
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<PortalModeResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setMode(null); setLoading(false); return; }
    let cancelled = false;
    void (async () => {
      try {
        const result = await resolvePortalMode();
        if (!cancelled) setMode(result);
      } catch {
        if (!cancelled) setMode(null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { mode, loading: loading || authLoading };
}
