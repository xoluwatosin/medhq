import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BellOff, CheckCheck, ChevronDown, Loader2, Mail, RefreshCw, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import ConsolePageHeader from "@/components/admin/console/ConsolePageHeader";
import HealthStrip from "@/components/admin/HealthStrip";
import Status from "@/components/field/Status";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { adminDb } from "@/lib/admin-utils";
import {
  areaLabel, areaStatuses, formatWhen, scheduleInWords, SEVERITY_LABEL, STATUS_CLASS, STATUS_LABEL,
  STATUS_TONE, timeAgo, worstStatus, type AdminAlert, type HealthOverview, type HealthStatus,
} from "@/lib/system-health";
import { cn } from "@/lib/utils";

const REFRESH_MS = 60_000;

const StatusChip = ({ status, label }: { status: HealthStatus; label?: string }) => (
  <Status label={label ?? STATUS_LABEL[status]} tone={STATUS_TONE[status]} className={STATUS_CLASS[status]} />
);

const SectionHead = ({ title, note }: { title: string; note?: string }) => (
  <div className="mb-2 mt-7 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-navy">{title}</h2>
    {note && <p className="text-xs text-muted-copy">{note}</p>}
  </div>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="border border-line-soft bg-card px-4 py-6 text-center text-sm text-muted-copy">{children}</p>
);

export default function SystemHealth() {
  const [data, setData] = useState<HealthOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolving, setResolving] = useState<AdminAlert | null>(null);
  const [note, setNote] = useState("");
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    const { data: overview, error: loadError } = await adminDb().rpc("ops_overview");
    if (loadError) {
      setError(loadError.code === "42501" || /not_permitted/.test(loadError.message)
        ? "You do not have access to System health. Ask whoever manages admin access."
        : loadError.message);
      return;
    }
    setError(null);
    setData(overview as HealthOverview);
  }, []);

  // Live: alerts arrive over Realtime; check results refresh every minute.
  useEffect(() => {
    void load();
    const nudge = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void load(), 400);
    };
    const channel = supabase
      .channel("system-health")
      .on("postgres_changes" as never, { event: "*", schema: "public", table: "admin_alerts" }, nudge)
      .subscribe();
    const interval = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const checkNow = async () => {
    setChecking(true);
    const { error: runError } = await adminDb().rpc("ops_run_checks_now");
    if (runError) toast.error(runError.message);
    else toast.success("Checks run.");
    await load();
    setChecking(false);
  };

  const acknowledge = async (alert: AdminAlert) => {
    setBusyId(alert.id);
    const { error: ackError } = await adminDb().rpc("ops_alert_acknowledge", { _id: alert.id });
    if (ackError) toast.error(ackError.message);
    else toast.success("Acknowledged. Reminder emails stop; it closes when the problem clears.");
    await load();
    setBusyId(null);
  };

  const resolve = async () => {
    if (!resolving) return;
    setBusyId(resolving.id);
    const { error: resolveError } = await adminDb().rpc("ops_alert_resolve", { _id: resolving.id, _note: note });
    if (resolveError) toast.error(resolveError.message);
    else toast.success("Alert closed.");
    setResolving(null);
    setNote("");
    await load();
    setBusyId(null);
  };

  const areas = useMemo(() => (data ? areaStatuses(data.checks, data.alerts) : []), [data]);
  const overall = useMemo(() => worstStatus(areas.map((a) => a.status)), [areas]);
  const lastRun = useMemo(
    () => data?.checks.map((c) => c.last_run_at).filter(Boolean).sort().at(-1) ?? null,
    [data],
  );
  const lastDigest = data?.emails.find((e) => e.kind === "digest");

  if (error) {
    return (
      <section className="mx-auto w-full max-w-[1100px]">
        <ConsolePageHeader title="System health" />
        <Empty>{error}</Empty>
      </section>
    );
  }
  if (!data) return <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  const openAlerts = data.alerts;
  const criticalOpen = openAlerts.filter((a) => a.severity === "critical" && !a.acknowledged_at).length;

  return (
    <section className="mx-auto w-full max-w-[1100px]" aria-labelledby="health-heading">
      <ConsolePageHeader
        id="health-heading"
        title="System health"
        description="Scheduled jobs, deliveries and outside services, checked every five minutes. This page updates by itself."
        action={
          <Button variant="outline" size="sm" onClick={checkNow} disabled={checking} className="gap-2">
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Check now
          </Button>
        }
      />

      <div
        className={cn(
          "mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 border px-4 py-3",
          overall === "critical" ? "border-status-alert/30 bg-status-alert-soft" : "border-line-soft bg-card",
        )}
        role="status"
      >
        <StatusChip status={overall} label={`Overall: ${STATUS_LABEL[overall]}`} />
        <span className="text-sm text-ink">
          {openAlerts.length === 0
            ? "Nothing open."
            : `${openAlerts.length} open alert${openAlerts.length === 1 ? "" : "s"}${criticalOpen ? `, ${criticalOpen} critical and not yet acknowledged` : ""}.`}
        </span>
        <span className="text-xs text-muted-copy sm:ml-auto">Last checked {timeAgo(lastRun)}</span>
      </div>

      <HealthStrip areas={areas} />

      <Tabs defaultValue="alerts" className="mt-6">
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-line-soft bg-transparent p-0">
          {[
            ["alerts", `Alerts${openAlerts.length ? ` (${openAlerts.length})` : ""}`],
            ["checks", "Checks"],
            ["jobs", "Scheduled jobs"],
            ["errors", "Function errors"],
            ["email", "Alert email"],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="shrink-0 rounded-none border-b-2 border-transparent px-3 py-2 text-[13.5px] data-[state=active]:border-navy data-[state=active]:bg-transparent data-[state=active]:text-navy data-[state=active]:shadow-none"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ---------- Alerts ---------- */}
        <TabsContent value="alerts" className="mt-0">
          <SectionHead title="Open" note="Acknowledge to stop reminder emails. Alerts close by themselves once fixed." />
          {openAlerts.length === 0 ? (
            <Empty>No open alerts. Everything checked is working.</Empty>
          ) : (
            <ul className="divide-y divide-line-soft border border-line-soft bg-card">
              {openAlerts.map((alert) => (
                <li key={alert.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
                  <div className="shrink-0 sm:w-[118px]">
                    <StatusChip status={alert.severity} label={SEVERITY_LABEL[alert.severity]} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy">{alert.title}</p>
                    {(alert.summary || (alert.detail as { reason?: string } | null)?.reason) && (
                      <p className="mt-0.5 text-sm text-ink/80">
                        {alert.summary ?? `Reason: ${(alert.detail as { reason?: string }).reason}`}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-copy">
                      {areaLabel(alert.area, alert.source)} · since {formatWhen(alert.created_at)}
                      {alert.source === "ops" && alert.occurrences > 1 && ` · still failing ${timeAgo(alert.last_seen_at)}`}
                      {alert.email_count > 0 && ` · emailed ${alert.email_count === 1 ? "once" : `${alert.email_count} times`}`}
                      {alert.acknowledged_at && ` · acknowledged ${timeAgo(alert.acknowledged_at)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {alert.link && (
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <Link to={alert.link}>Open<ArrowRight className="h-3.5 w-3.5" /></Link>
                      </Button>
                    )}
                    {!alert.acknowledged_at && alert.severity !== "info" && (
                      <Button size="sm" variant="outline" className="gap-1.5" disabled={busyId === alert.id} onClick={() => acknowledge(alert)}>
                        <BellOff className="h-3.5 w-3.5" />Acknowledge
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="gap-1.5" disabled={busyId === alert.id} onClick={() => setResolving(alert)}>
                      <CheckCheck className="h-3.5 w-3.5" />Close
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <SectionHead title="Closed in the last 24 hours" />
          {data.recently_resolved.length === 0 ? (
            <Empty>Nothing closed in the last day.</Empty>
          ) : (
            <ul className="divide-y divide-line-soft border border-line-soft bg-card">
              {data.recently_resolved.map((alert) => (
                <li key={alert.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                  <p className="min-w-0 flex-1 text-sm text-ink">{alert.title}</p>
                  <p className="shrink-0 text-xs text-muted-copy">
                    {alert.resolution_note ?? "Closed"} · {formatWhen(alert.resolved_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* ---------- Checks ---------- */}
        <TabsContent value="checks" className="mt-0">
          <SectionHead title="What is checked" note="Every five minutes" />
          <div className="space-y-3">
            {data.checks.map((check) => {
              const status: HealthStatus = check.last_status === "error"
                ? "warning"
                : worstStatus(check.results.map((r) => r.status));
              return (
                <Collapsible key={check.key} defaultOpen={status !== "ok"} className="border border-line-soft bg-card">
                  <CollapsibleTrigger className="group flex w-full items-start gap-3 px-4 py-3 text-left">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-navy">{check.label}</p>
                      <p className="mt-0.5 text-xs text-muted-copy">{check.description}</p>
                    </div>
                    <StatusChip status={status} label={check.last_status === "error" ? "Check broken" : undefined} />
                    <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-copy transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {check.last_error && (
                      <p className="mx-4 mb-3 bg-warn-bg px-3 py-2 text-xs text-warn-ink">The check failed to run: {check.last_error}</p>
                    )}
                    <ul className="divide-y divide-line-soft border-t border-line-soft">
                      {check.results.map((r) => (
                        <li key={r.subkey} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-ink">{r.title}</p>
                            {r.summary && <p className="text-xs text-muted-copy">{r.summary}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <StatusChip status={r.status} />
                            {r.link && (
                              <Button asChild size="icon" variant="ghost" aria-label={`Open ${r.title}`}>
                                <Link to={r.link}><ArrowRight className="h-4 w-4" /></Link>
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <p className="border-t border-line-soft px-4 py-2 text-[11px] text-muted-copy">
                      Last run {formatWhen(check.last_run_at)}
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </TabsContent>

        {/* ---------- Scheduled jobs ---------- */}
        <TabsContent value="jobs" className="mt-0">
          <SectionHead title="Scheduled jobs" note="Times in Lagos" />
          {data.jobs.length === 0 ? (
            <Empty>No scheduled jobs could be read.</Empty>
          ) : (
            <ul className="divide-y divide-line-soft border border-line-soft bg-card">
              {data.jobs.map((job) => {
                const last = job.runs[0];
                const status: HealthStatus = !job.active
                  ? "warning"
                  : last?.status === "failed" ? "warning" : last ? "ok" : "info";
                return (
                  <li key={job.name} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-mono text-[13px] text-navy">{job.name}</p>
                      <p className="text-xs text-muted-copy">
                        {scheduleInWords(job.schedule)}
                        {last ? ` · last ran ${formatWhen(last.started)}` : " · no runs recorded"}
                      </p>
                      {last?.status === "failed" && last.message && (
                        <p className="mt-1 line-clamp-2 text-xs text-warn-ink">{last.message}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="flex gap-1" aria-label={`Last ${job.runs.length} runs`}>
                        {job.runs.slice().reverse().map((run, i) => (
                          <span
                            key={i}
                            title={`${run.status} · ${formatWhen(run.started)}`}
                            className={cn(
                              "h-2.5 w-2.5",
                              run.status === "succeeded" ? "bg-status-green" : run.status === "failed" ? "bg-status-alert" : "bg-muted-foreground/40",
                            )}
                          />
                        ))}
                      </span>
                      <StatusChip status={status} label={!job.active ? "Paused" : last?.status === "failed" ? "Last run failed" : last ? "Running" : "Waiting"} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        {/* ---------- Function errors ---------- */}
        <TabsContent value="errors" className="mt-0">
          <SectionHead title="Recent function errors" note="Last 50, kept for 30 days" />
          {data.function_errors.length === 0 ? (
            <Empty>No errors recorded.</Empty>
          ) : (
            <ul className="divide-y divide-line-soft border border-line-soft bg-card">
              {data.function_errors.map((e) => (
                <li key={e.id} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:gap-4">
                  <p className="shrink-0 font-mono text-[13px] text-navy sm:w-[220px]">{e.function_name}</p>
                  <p className="min-w-0 flex-1 break-words text-sm text-ink">{e.message ?? `Status ${e.status}`}</p>
                  <p className="shrink-0 text-xs text-muted-copy">{formatWhen(e.occurred_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* ---------- Alert email ---------- */}
        <TabsContent value="email" className="mt-0">
          <SectionHead title="How you are told" />
          <ul className="divide-y divide-line-soft border border-line-soft bg-card text-sm">
            <li className="flex gap-3 px-4 py-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-status-alert" />
              <p><span className="font-semibold text-navy">Critical</span>: emailed at once, again after 30 minutes, then hourly (five emails at most) until acknowledged.</p>
            </li>
            <li className="flex gap-3 px-4 py-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-warn-ink" />
              <p><span className="font-semibold text-navy">Warnings</span>: batched, at most one email an hour.</p>
            </li>
            <li className="flex gap-3 px-4 py-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-copy" />
              <p>
                <span className="font-semibold text-navy">Daily summary</span>: 07:45 every day.
                {lastDigest && ` Last sent ${formatWhen(lastDigest.created_at)}${lastDigest.status === "failed" ? " (failed)" : ""}.`}
              </p>
            </li>
          </ul>
          <p className="mt-2 text-xs text-muted-copy">
            Everything goes to hello@medicconnect.co. Choosing recipients moves to Settings next.{" "}
            <Link to="/admin/alert-keys" className="underline underline-offset-2">Send a test alert</Link>.
          </p>

          <SectionHead title="Recently sent" />
          {data.emails.length === 0 ? (
            <Empty>No alert email sent yet.</Empty>
          ) : (
            <ul className="divide-y divide-line-soft border border-line-soft bg-card">
              {data.emails.map((e, i) => (
                <li key={i} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4">
                  <p className="min-w-0 flex-1 text-sm text-ink">
                    {e.kind === "digest" ? "Daily summary" : `${e.alerts} alert${e.alerts === 1 ? "" : "s"}`}
                    {e.error && <span className="block text-xs text-warn-ink">{e.error}</span>}
                  </p>
                  <StatusChip status={e.status === "failed" ? "warning" : e.status === "sent" ? "ok" : "info"} label={e.status === "sent" ? "Sent" : e.status === "failed" ? "Failed" : "Sending"} />
                  <p className="shrink-0 text-xs text-muted-copy">{formatWhen(e.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(resolving)} onOpenChange={(open) => { if (!open) { setResolving(null); setNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close this alert?</DialogTitle>
            <DialogDescription>
              {resolving?.source === "ops"
                ? "If the problem is still there, the next check opens a fresh alert. Acknowledge instead if you are working on it."
                : "Say what was done, so the history makes sense later."}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done (optional)" rows={3} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setResolving(null); setNote(""); }}>Cancel</Button>
            <Button onClick={resolve} disabled={busyId === resolving?.id}>Close alert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
