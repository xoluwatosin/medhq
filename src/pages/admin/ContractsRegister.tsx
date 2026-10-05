// Every contract, across everyone: who is waiting to sign, who is waiting on
// a countersignature, and what is still a draft. Contracts are made and
// issued from the person or staff record; this register is where staff see
// them all at once and chase the ones that are stuck.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import ConsoleTabs from "@/components/admin/console/ConsoleTabs";
import ConsoleTable, { type ConsoleColumn } from "@/components/admin/console/ConsoleTable";
import ConsoleMobileList from "@/components/admin/console/ConsoleMobileList";
import { MuEmpty, MuLoadError, MuPage, MuPageHeader, MuStatus, type MuTone } from "@/components/admin/mu/MuShell";
import { Button } from "@/components/ui/button";
import { art } from "@/components/mc/art";
import { adminDb } from "@/lib/admin-utils";
import { selectAll } from "@/lib/select-all";
import { CONTRACT_STATUS_LABELS } from "@/lib/staff";
import { formatDate } from "@/lib/format";
import { useListParam } from "@/hooks/useListParam";

interface Row {
  id: string;
  person_id: string;
  job_title: string | null;
  status: string;
  issued_at: string | null;
  signed_at: string | null;
  countersigned_at: string | null;
  created_at: string;
  person: string;
}

const VIEWS = [
  { id: "awaiting", label: "Awaiting signature" },
  { id: "countersign", label: "To countersign" },
  { id: "drafts", label: "Drafts" },
  { id: "settled", label: "Signed and active" },
  { id: "all", label: "All" },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

const inView = (row: Row, view: ViewId) => {
  if (view === "all") return true;
  if (view === "awaiting") return row.status === "issued";
  if (view === "countersign") return row.status === "signed" && !row.countersigned_at;
  if (view === "drafts") return row.status === "draft";
  return row.status === "active" || (row.status === "signed" && Boolean(row.countersigned_at));
};

const tone = (s: string): MuTone =>
  s === "active" || s === "signed" ? "good" : s === "issued" ? "info" : s === "draft" ? "warning" : "neutral";

const when = (row: Row) =>
  row.status === "issued" && row.issued_at ? `Issued ${formatDate(row.issued_at)}`
    : row.status === "signed" && row.signed_at ? `Signed ${formatDate(row.signed_at)}`
      : `Started ${formatDate(row.created_at)}`;

const COLUMNS: ConsoleColumn[] = [
  { key: "person", label: "Person", width: "28%" },
  { key: "role", label: "Role", width: "24%" },
  { key: "status", label: "Status", width: "22%" },
  { key: "when", label: "When", width: "14%" },
  { key: "open", label: "", width: "12%" },
];

const ContractsRegister = () => {
  const [view, setView] = useListParam<ViewId>("view", "awaiting");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const contracts = await selectAll<Omit<Row, "person">>((a, z) =>
        adminDb().from("mu_contracts")
          .select("id, person_id, job_title, status, issued_at, signed_at, countersigned_at, created_at")
          .order("created_at", { ascending: false }).order("id").range(a, z));
      const ids = Array.from(new Set(contracts.map((c) => c.person_id)));
      const names = new Map<string, string>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await adminDb().from("mu_people").select("id, full_name").in("id", ids.slice(i, i + 200));
        if (error) throw error;
        for (const p of data ?? []) names.set(p.id, p.full_name ?? "Unnamed");
      }
      setRows(contracts.map((c) => ({ ...c, person: names.get(c.person_id) ?? "Unnamed" })));
    } catch {
      setFailed(true);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => rows.filter((r) => inView(r, view)), [rows, view]);
  const tabs = useMemo(() => VIEWS.map((v) => ({ ...v, count: rows.filter((r) => inView(r, v.id)).length })), [rows]);

  return (
    <MuPage>
      <MuPageHeader
        title="Contracts"
        description="Every contract across the talent pool and staff. Contracts are made and issued from the person's record."
      />
      <ConsoleTabs tabs={tabs} active={view} onChange={(id) => setView(id as ViewId)} label="Contract views" controls="contract-rows" />
      <div id="contract-rows">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
        ) : failed ? (
          <MuLoadError what="the contracts" onRetry={() => void load()} />
        ) : visible.length === 0 ? (
          <div className="border border-line bg-card">
            <MuEmpty
              art={art.objSignedContract}
              title={view === "awaiting" ? "Nobody is waiting to sign" : view === "countersign" ? "Nothing to countersign" : "No contracts here"}
              description="Contracts appear here once they are started from a person's record."
            />
          </div>
        ) : (
          <>
            <ConsoleTable
              columns={COLUMNS}
              rows={visible}
              rowKey={(r) => r.id}
              renderRow={(r) => (
                <>
                  <td className="border-r border-line-soft px-3 py-3 align-middle">
                    <Link to={`/admin/match-universe/${r.person_id}`} className="font-semibold text-navy hover:underline">{r.person}</Link>
                  </td>
                  <td className="border-r border-line-soft px-3 py-3 align-middle">{r.job_title || "Role not set"}</td>
                  <td className="border-r border-line-soft px-3 py-3 align-middle">
                    <MuStatus label={r.status === "signed" && !r.countersigned_at ? "Signed, to countersign" : CONTRACT_STATUS_LABELS[r.status] ?? r.status} tone={tone(r.status)} />
                  </td>
                  <td className="border-r border-line-soft px-3 py-3 align-middle text-xs text-muted-foreground">{when(r)}</td>
                  <td className="px-3 py-2 align-middle">
                    <Button asChild variant="outline" size="sm" className="h-10 w-full"><Link to={`/admin/contracts/${r.id}`}>Open</Link></Button>
                  </td>
                </>
              )}
            />
            <ConsoleMobileList
              emptyLabel="No contracts"
              rows={visible.map((r) => ({
                key: r.id,
                title: r.person,
                state: `${r.job_title || "Role not set"}, ${when(r).toLowerCase()}`,
                status: <MuStatus label={CONTRACT_STATUS_LABELS[r.status] ?? r.status} tone={tone(r.status)} />,
                to: `/admin/contracts/${r.id}`,
              }))}
            />
          </>
        )}
      </div>
    </MuPage>
  );
};

export default ContractsRegister;
