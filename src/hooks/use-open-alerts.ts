import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminDb } from "@/lib/admin-utils";
import type { AdminAlert } from "@/lib/system-health";

type OpenAlert = Pick<AdminAlert, "id" | "severity" | "title" | "area" | "acknowledged_at" | "resolved_at" | "created_at">;

let channelSeq = 0;

/**
 * Open alerts, kept live through Supabase Realtime. Used by the header bell and
 * the Overview. Pass enabled = false when the admin cannot see System health.
 */
export function useOpenAlerts(enabled: boolean) {
  const [alerts, setAlerts] = useState<OpenAlert[]>([]);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await adminDb()
        .from("admin_alerts")
        .select("id, severity, title, area, acknowledged_at, resolved_at, created_at")
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      setAlerts((data ?? []) as OpenAlert[]);
      setLoaded(true);
    };

    // Several changes usually land together at the end of a check run.
    const nudge = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void load(), 400);
    };

    void load();
    const channel = supabase
      .channel(`open-alerts-${++channelSeq}`)
      .on("postgres_changes" as never, { event: "*", schema: "public", table: "admin_alerts" }, nudge)
      .subscribe();

    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [enabled]);

  return { alerts, loaded };
}
