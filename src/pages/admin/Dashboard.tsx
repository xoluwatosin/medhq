import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, ClipboardList, Inbox, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import ConsolePageHeader from "@/components/admin/console/ConsolePageHeader";
import { Button } from "@/components/ui/button";
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
  const { isSuperAdmin, permissions } = useAuth();
  const [counts, setCounts] = useState<OverviewCounts>({ care: 0, enquiries: 0, applications: 0, alerts: 0, approvals: 0 });
  const [loading, setLoading] = useState(true);
  const can = (permission: string) => isSuperAdmin || permissions.includes(permission);

  useEffect(() => {
    const load = async () => {
      const db = adminDb();
      const [care, enquiries, applications, alerts, posts, campaigns] = await Promise.all([
        can("dashboard") ? nextActions().catch(() => []) : Promise.resolve([]),
        can("enquiries")
          ? db.from("contact_submissions").select("id", { count: "exact", head: true }).eq("archived", false).eq("status", "new")
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
    can("dashboard") ? { title: "Care requests", detail: "Care work needing attention", count: counts.care, to: "/admin/care/requests", icon: ClipboardList } : null,
    can("enquiries") ? { title: "Enquiries", detail: "New enquiries to review", count: counts.enquiries, to: "/admin/enquiries", icon: Inbox } : null,
    can("match_universe") ? { title: "Intake", detail: "Joined the pool this week", count: counts.applications, to: "/admin/match-universe/intake", icon: UserPlus } : null,
    can("dashboard") ? { title: "Operational alerts", detail: "Unresolved alerts", count: counts.alerts, to: "/admin/intelligence", icon: AlertCircle } : null,
    isSuperAdmin ? { title: "Approvals", detail: "Content awaiting approval", count: counts.approvals, to: "/admin/approvals", icon: ShieldCheck } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item)), [counts, isSuperAdmin, permissions]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  return (
    <section className="mx-auto w-full max-w-[960px]" aria-labelledby="overview-heading">
      <ConsolePageHeader id="overview-heading" title="Overview" description="Work that needs attention across Medic Connect." />
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
