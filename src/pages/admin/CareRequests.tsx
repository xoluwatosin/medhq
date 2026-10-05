import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ConsolePageHeader from "@/components/admin/console/ConsolePageHeader";
import ConsoleTabs from "@/components/admin/console/ConsoleTabs";
import ConsoleTable, { type ConsoleColumn } from "@/components/admin/console/ConsoleTable";
import ConsoleMobileList from "@/components/admin/console/ConsoleMobileList";
import { SelectField, Status } from "@/components/field";
import { MuEmpty } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { adminDb } from "@/lib/admin-utils";
import { requestReadiness, type RequestReadiness } from "@/lib/care-group";
import { nextActions, type NextAction } from "@/lib/care-work";
import { formatDate } from "@/lib/format";

interface CareRequestRow {
  id: string;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
  care_groups: { display_name: string } | null;
  care_request_recipients: Array<{
    id: string;
    client_id: string;
    clients: { full_name: string } | null;
  }>;
  care_people: { full_name: string } | null;
  care_service_intentions: Array<{
    id: string;
    state: string;
    services: { name: string } | null;
  }>;
  readiness: RequestReadiness | null;
  nextAction: NextAction | null;
}

const REQUEST_LABELS: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  questionnaire_sent: "Questionnaire sent",
  responses_returned: "Responses returned",
  assessment_booked: "Assessment booked",
  closed: "Closed",
};

const FILTERS = [
  { id: "attention", label: "Needs attention" },
  { id: "open", label: "Open" },
  { id: "returned", label: "Responses returned" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const COLUMNS: ConsoleColumn[] = [
  { key: "request", label: "Care request", width: "20%" },
  { key: "enquirer", label: "Enquirer", width: "15%" },
  { key: "recipients", label: "Recipients", width: "16%" },
  { key: "services", label: "Services", width: "16%" },
  { key: "status", label: "Status", width: "13%" },
  { key: "next", label: "Next action", width: "20%" },
];

const recipientNames = (row: CareRequestRow) =>
  row.care_request_recipients.map((recipient) => recipient.clients?.full_name).filter(Boolean).join(", ");

const enquirerName = (row: CareRequestRow) => row.care_people?.full_name ?? null;

const serviceNames = (row: CareRequestRow) =>
  Array.from(new Set(row.care_service_intentions.map((service) => service.services?.name).filter(Boolean))).join(", ");

const statusTone = (status: string) => {
  if (status === "closed") return "neutral" as const;
  if (status === "responses_returned" || status === "assessment_booked") return "good" as const;
  if (status === "questionnaire_sent") return "progress" as const;
  return "info" as const;
};

const needsAttention = (row: CareRequestRow) => !row.readiness?.ready || Boolean(row.nextAction);

const matchesFilter = (row: CareRequestRow, filter: FilterId) => {
  if (filter === "all") return true;
  if (filter === "attention") return row.status !== "closed" && needsAttention(row);
  if (filter === "open") return row.status !== "closed";
  if (filter === "returned") return row.status === "responses_returned";
  return row.status === "closed";
};

const nextActionText = (row: CareRequestRow) => {
  if (!row.readiness?.ready) return "Complete request preparation";
  if (row.nextAction) return row.nextAction.title;
  return "No outstanding work";
};

const CareRequests = ({ embedded = false }: { embedded?: boolean }) => {
  const [rows, setRows] = useState<CareRequestRow[]>([]);
  const [filter, setFilter] = useState<FilterId>("attention");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [requestsResult, actionsResult] = await Promise.all([
        adminDb()
          .from("care_requests")
          .select(
            "id, status, source, created_at, updated_at, care_groups(display_name), care_request_recipients(id, client_id, clients(full_name)), care_people:enquirer_person_id(full_name), care_service_intentions(id, state, services(name))",
          )
          .order("updated_at", { ascending: false }),
        nextActions().catch(() => [] as NextAction[]),
      ]);

      if (requestsResult.error) {
        toast.error("Could not load care requests");
        setLoadFailed(true);
        setLoading(false);
        return;
      }

      const base = (requestsResult.data ?? []) as unknown as Omit<CareRequestRow, "readiness" | "nextAction">[];
      const readiness = await Promise.all(base.map((request) => requestReadiness(request.id).catch(() => null)));
      const actions = new Map(actionsResult.map((action) => [action.client_id, action]));
      setRows(base.map((request, index) => ({
        ...request,
        readiness: readiness[index],
        nextAction: request.care_request_recipients
          .map((recipient) => actions.get(recipient.client_id))
          .filter((action): action is NextAction => Boolean(action))
          .sort((a, b) => a.rank_order - b.rank_order)[0] ?? null,
      })));
      setLoading(false);
    };
    void load();
  }, []);

  const visible = useMemo(() => rows.filter((row) => matchesFilter(row, filter)), [filter, rows]);
  const tabs = useMemo(
    () => FILTERS.map((item) => ({ ...item, count: rows.filter((row) => matchesFilter(row, item.id)).length })),
    [rows],
  );

  return (
    <section className={embedded ? "" : "w-full"} aria-labelledby={embedded ? undefined : "care-requests-heading"} aria-label={embedded ? "Care requests" : undefined}>
      {!embedded && (
        <ConsolePageHeader
          id="care-requests-heading"
          title="Care requests"
          description="Requests for care, their recipients, intended services and preparation state."
        />
      )}
      {embedded ? (
        // Inside the Care list, a second tab row would read as a second page.
        <div className="mb-4 max-w-[260px]">
          <SelectField
            label="Show"
            value={filter}
            onChange={(v) => setFilter((v || "attention") as FilterId)}
            placeholder={false}
            options={tabs.map((t) => ({ value: t.id, label: `${t.label} (${t.count})` }))}
          />
        </div>
      ) : (
        <ConsoleTabs tabs={tabs} active={filter} onChange={(id) => setFilter(id as FilterId)} label="Filter care requests" controls="care-request-records" />
      )}

      <div id="care-request-records">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : loadFailed ? (
          <p className="border border-line bg-card px-5 py-10 text-center text-sm text-muted-copy">Care requests could not be loaded. Refresh to try again.</p>
        ) : visible.length === 0 ? (
          <div className="border border-line bg-card">
            <MuEmpty
              art={art.objCarePlan}
              title="No care requests here"
              description={filter === "all" ? "Care requests appear here once an enquiry is promoted." : "Nothing in this view right now. Try another filter."}
            />
          </div>
        ) : (
          <>
            <ConsoleTable
              columns={COLUMNS}
              rows={visible}
              rowKey={(row) => row.id}
              renderRow={(row) => {
                const firstClient = row.care_request_recipients[0]?.client_id;
                return (
                  <>
                    <td className="border-r border-line-soft px-3 py-3 align-middle">
                      <strong className="block text-sm font-semibold text-navy">{row.care_groups?.display_name ?? "Care request"}</strong>
                      <span className="mt-0.5 block text-xs text-muted-copy">Updated {formatDate(row.updated_at)}</span>
                    </td>
                    <td className="border-r border-line-soft px-3 py-3 align-middle">{enquirerName(row) ?? "No enquirer recorded"}</td>
                    <td className="border-r border-line-soft px-3 py-3 align-middle">{recipientNames(row) || "No recipients"}</td>
                    <td className="border-r border-line-soft px-3 py-3 align-middle">{serviceNames(row) || "No services"}</td>
                    <td className="border-r border-line-soft px-3 py-3 align-middle"><Status label={REQUEST_LABELS[row.status] ?? row.status} tone={statusTone(row.status)} /></td>
                    <td className="px-3 py-3 align-middle">
                      <span className="block text-sm font-medium text-ink">{nextActionText(row)}</span>
                      {firstClient && <Button asChild variant="link" className="h-auto p-0 text-xs"><Link to={`/admin/clients/${firstClient}?tab=group&request=${row.id}`}>Open request</Link></Button>}
                    </td>
                  </>
                );
              }}
            />
            <ConsoleMobileList
              emptyLabel="No care requests"
              rows={visible.map((row) => {
                const firstClient = row.care_request_recipients[0]?.client_id;
                return {
                  key: row.id,
                  title: row.care_groups?.display_name ?? "Care request",
                  state: `${enquirerName(row) ?? "No enquirer recorded"}, for ${recipientNames(row) || "no recipients"}. ${nextActionText(row)}`,
                  status: <Status label={REQUEST_LABELS[row.status] ?? row.status} tone={statusTone(row.status)} />,
                  to: firstClient ? `/admin/clients/${firstClient}?tab=group&request=${row.id}` : undefined,
                };
              })}
            />
          </>
        )}
      </div>
    </section>
  );
};

export default CareRequests;