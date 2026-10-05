import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { MuEmpty, MuPage, MuPageHeader, MuSection } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { ClipArt } from "@/components/mc/brand";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { adminDb } from "@/lib/admin-utils";
import { nextActions } from "@/lib/care-work";

interface OverviewCounts {
  care: number;
  enquiries: number;
  applications: number;
  alerts: number;
  approvals: number;
}

const Dashboard = () => {
  const { isSuperAdmin, permissions, adminDisplayName } = useAuth();
  const [counts, setCounts] = useState<OverviewCounts>({ care: 0, enquiries: 0, applications: 0, alerts: 0, approvals: 0 });
  const [loading, setLoading] = useState(true);
  const can = (permission: string) => isSuperAdmin || permissions.includes(permission);

  useEffect(() => {
    const load = async () => {
      const db = adminDb();
      const [care, enquiries, applications, alerts, posts, campaigns] = await Promise.all([
        can("dashboard") ? nextActions().catch(() => []) : Promise.resolve([]),
        can("enquiries")
          // The same rule as the Enquiries desk's Unanswered view.
          ? db.from("contact_submissions").select("id", { count: "exact", head: true }).eq("archived", false).eq("stage", "new").is("last_sent_at", null)
          : Promise.resolve({ count: 0 }),
        // The Intake tile links to Intake, so it counts what Intake counts:
        // people who arrived in the pool this week.
        can("match_universe")
          ? db.rpc("mu_intake_health").then((r: any) => ({ count: Number(r.data?.people_week ?? 0) })).catch(() => ({ count: 0 }))
          : Promise.resolve({ count: 0 }),
        can("dashboard")
          ? db.from("admin_alerts").select("id", { count: "exact", head: true }).is("resolved_at", null)
          : Promise.resolve({ count: 0 }),
        isSuperAdmin
          ? db.from("blog_posts").select("id", { count: "exact", head: true }).eq("approval_status", "pending")
          : Promise.resolve({ count: 0 }),
        isSuperAdmin
          ? db.from("campaigns").select("id", { count: "exact", head: true }).eq("approval_status", "pending")
          : Promise.resolve({ count: 0 }),
      ]);
      setCounts({
        care: care.filter((item) => item.rank_order <= 3).length,
        enquiries: enquiries.count ?? 0,
        applications: applications.count ?? 0,
        alerts: alerts.count ?? 0,
        approvals: (posts.count ?? 0) + (campaigns.count ?? 0),
      });
      setLoading(false);
    };
    void load();
  }, [isSuperAdmin, permissions]);

  const work = useMemo(() => [
    can("dashboard") ? { title: "Care", detail: "Clients whose next step is due", count: counts.care, to: "/admin/clients?view=attention", art: art.objCarePlan, clear: "No care step is due" } : null,
    can("enquiries") ? { title: "Enquiries", detail: "Waiting for a first reply", count: counts.enquiries, to: "/admin/enquiries?view=owed", art: art.objEnvelope, clear: "Every enquiry has a reply" } : null,
    can("match_universe") ? { title: "Intake", detail: "Joined the talent pool this week", count: counts.applications, to: "/admin/match-universe/intake", art: art.objPaperUpload, clear: "Nobody new this week" } : null,
    can("dashboard") ? { title: "Alerts", detail: "Operational alerts not yet resolved", count: counts.alerts, to: "/admin/intelligence", art: art.objAlarmBeacon, clear: "No open alerts" } : null,
    isSuperAdmin ? { title: "Approvals", detail: "Posts and campaigns waiting for you", count: counts.approvals, to: "/admin/approvals", art: art.objClipboardChecks, clear: "Nothing to approve" } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item)), [counts, isSuperAdmin, permissions]);

  // Busy queues first, so the first card is the first job.
  const ordered = useMemo(() => [...work].sort((a, b) => Number(b.count > 0) - Number(a.count > 0)), [work]);
  const waiting = work.reduce((n, w) => n + (w.count > 0 ? 1 : 0), 0);

  const quick = [
    can("dashboard") ? { label: "Add a client", to: "/admin/clients" } : null,
    can("campaigns") ? { label: "New campaign", to: "/admin/campaigns" } : null,
    can("invoices") ? { label: "New invoice", to: "/admin/invoices" } : null,
    can("match_universe") ? { label: "Talent pool", to: "/admin/match-universe" } : null,
    can("blog") ? { label: "Write a post", to: "/admin/posts" } : null,
  ].filter((q): q is { label: string; to: string } => Boolean(q));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = (adminDisplayName || "").trim().split(/\s+/)[0];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  return (
    <MuPage>
      <MuPageHeader
        eyebrow="Overview"
        title={first ? `${greeting}, ${first}` : greeting}
        description={
          work.length === 0
            ? "Your access does not include any work queues yet."
            : waiting === 0
              ? "Nothing is waiting on you right now."
              : `${waiting} ${waiting === 1 ? "queue needs" : "queues need"} you today. The busiest is first.`
        }
      />

      {work.length === 0 ? (
        <MuSection padded={false}>
          <MuEmpty art={art.objMagnifier} title="Nothing to show" description="Ask the super admin if you need a queue." />
        </MuSection>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {ordered.map((item, i) => {
            const busy = item.count > 0;
            return (
              <Link
                key={item.title}
                to={item.to}
                style={{ ["--mc-tilt" as string]: `${[-1.1, 0.8, -0.5, 1, -0.8][i % 5]}deg` }}
                className={cn(
                  "mc-tilt group relative flex min-h-[176px] flex-col border-2 border-navy p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4",
                  busy ? "bg-card shadow-offset-blue" : "bg-tint/50 shadow-offset-sm",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-label">{item.title}</p>
                    <p className={cn("mt-2 text-[52px] font-extrabold leading-none tracking-[-0.05em] tabular-nums", busy ? "text-brand" : "text-navy/30")}>
                      {item.count}
                    </p>
                  </div>
                  <ClipArt src={item.art} size={88} />
                </div>
                <p className="mt-3 text-[15px] font-bold leading-snug text-navy">{busy ? item.detail : item.clear}</p>
                <span className={cn("mt-auto inline-flex items-center gap-1.5 pt-4 text-[14px] font-extrabold", busy ? "text-brand" : "text-navy/60")}>
                  {busy ? "Open" : "Look anyway"} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {quick.length > 0 && (
        <section aria-label="Start something">
          <hr className="border-t-4 border-navy" />
          <p className="eyebrow mt-4">Start something</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {quick.map((q) => (
              <Link
                key={q.label}
                to={q.to}
                className="inline-flex min-h-11 items-center gap-2 border-2 border-navy bg-card px-4 text-[14.5px] font-extrabold text-navy shadow-offset-sm transition-all hover:bg-tint active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                {q.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </MuPage>
  );
};

export default Dashboard;
