import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, ClipboardList, Inbox, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import ConsolePageHeader from "@/components/admin/console/ConsolePageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { adminDb } from "@/lib/admin-utils";
import { nextActions } from "@/lib/care-work";
import HealthStrip from "@/components/admin/HealthStrip";
import { areaStatuses, HEALTH_PERMISSION, type HealthOverview, type HealthStatus } from "@/lib/system-health";

interface OverviewCounts {
  care: number;
  enquiries: number;
  applications: number;
  alerts: number;
  approvals: number;
}

const Dashboard = () => {
  const { isSuperAdmin, permissions } = useAuth();
  const [counts, setCounts] = useState<OverviewCounts>({ care: 0, enquiries: 0, applications: 0, alerts: 0, approvals: 0 });
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<{ key: string; label: string; status: HealthStatus }[]>([]);
  const can = (permission: string) => isSuperAdmin || permissions.includes(permission);
  const seesHealth = can(HEALTH_PERMISSION);

  useEffect(() => {
    const load = async () => {
      const db = adminDb();
      const [care, enquiries, applications, alerts, posts, campaigns, overview] = await Promise.all([
        can("dashboard") ? nextActions().catch(() => []) : Promise.resolve([]),
        can("enquiries")
          ? db.from("contact_submissions").select("id", { count: "exact", head: true }).eq("archived", false).eq("status", "new")
          : Promise.resolve({ count: 0 }),
        can("applications")
          ? db.from("join_applications").select("id", { count: "exact", head: true }).eq("archived", false).in("status", ["new", "reviewed"])
          : Promise.resolve({ count: 0 }),
        can("dashboard") || seesHealth
          ? db.from("admin_alerts").select("id", { count: "exact", head: true }).is("resolved_at", null)
          : Promise.resolve({ count: 0 }),
        isSuperAdmin
          ? db.from("blog_posts").select("id", { count: "exact", head: true }).eq("approval_status", "pending")
          : Promise.resolve({ count: 0 }),
        isSuperAdmin
          ? db.from("campaigns").select("id", { count: "exact", head: true }).eq("approval_status", "pending")
          : Promise.resolve({ count: 0 }),
        seesHealth ? db.rpc("ops_overview") : Promise.resolve({ data: null }),
      ]);
      const ops = overview.data as HealthOverview | null;
      setHealth(ops ? areaStatuses(ops.checks, ops.alerts) : []);
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
    can("dashboard") ? { title: "Care requests", detail: "Care work needing attention", count: counts.care, to: "/admin/care/requests", icon: ClipboardList } : null,
    can("enquiries") ? { title: "Enquiries", detail: "New enquiries to review", count: counts.enquiries, to: "/admin/enquiries", icon: Inbox } : null,
    can("match_universe") ? { title: "Intake", detail: "New arrivals under review", count: counts.applications, to: "/admin/match-universe/intake", icon: UserPlus } : null,
    seesHealth
      ? { title: "System alerts", detail: "Open alerts from System health", count: counts.alerts, to: "/admin/system", icon: AlertCircle }
      : can("dashboard") ? { title: "Operational alerts", detail: "Unresolved alerts", count: counts.alerts, to: "/admin/intelligence", icon: AlertCircle } : null,
    isSuperAdmin ? { title: "Approvals", detail: "Content awaiting approval", count: counts.approvals, to: "/admin/approvals", icon: ShieldCheck } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item)), [counts, isSuperAdmin, permissions]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  return (
    <section className="mx-auto w-full max-w-[960px]" aria-labelledby="overview-heading">
      <ConsolePageHeader id="overview-heading" title="Overview" description="Work that needs attention across Medic Connect." />
      {health.length > 0 && <HealthStrip areas={health} linked className="mb-4" />}
      <div className="border border-line-soft bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] border-b border-line-soft bg-grey-pill px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-copy">
          <span>Work</span><span>Open</span>
        </div>
        <div className="divide-y divide-line-soft">
          {work.map((item) => (
            <div key={item.title} className="flex min-h-[68px] items-center gap-3 px-4 py-3">
              <item.icon className="h-5 w-5 shrink-0 text-muted-copy" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy">{item.title}</p>
                <p className="text-xs text-muted-copy">{item.detail}</p>
              </div>
              <span className="min-w-8 text-right text-lg font-semibold tabular-nums text-ink">{item.count}</span>
              <Button asChild variant="ghost" size="icon" aria-label={`Open ${item.title}`}>
                <Link to={item.to}><ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
