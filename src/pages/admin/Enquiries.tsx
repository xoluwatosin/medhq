// Enquiries.
//
// Enquiry records sorted by how long they have waited, with what was asked
// for, what was sent, and the stage the enquiry has reached.

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Link } from "react-router-dom";
import { useClearListParams, useListParam, useRestoreListParams } from "@/hooks/useListParam";
import { FilterChips } from "@/components/admin/FilterChips";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MuEmpty, MuPageHeader, MuStatus, MuToolbar } from "@/components/admin/mu/MuShell";
import { SelectField } from "@/components/field";
import { art } from "@/components/mc/art";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConsoleMobileList from "@/components/admin/console/ConsoleMobileList";
import { Loader2, Archive, ArchiveRestore, Search, Send, Settings2, Clock, Mail, HeartPulse } from "lucide-react";

const HEAD = "text-[11px] font-bold uppercase tracking-[0.14em] text-label";
import { useNavigate } from "react-router-dom";

import { adminDb } from "@/lib/admin-utils";
import { selectAll } from "@/lib/select-all";
import ExportDropdown from "@/components/admin/ExportDropdown";
import { format, formatDistanceToNowStrict } from "date-fns";
import { PromoteEnquiries } from "@/components/admin/care/PromoteEnquiries";
import { careRequestRows, isCareRequest, phoneCountry } from "@/lib/enquiry-summary";
import {
  ENQUIRY_STAGES, loadEnquiries, loadServiceLines, loadSends, sendEnquiryReply,
  setEnquiryOwner, setEnquiryStage, stageLabel, enquiryOrigin,
  type Enquiry, type EnquirySend, type ServiceLine,
} from "@/lib/enquiries";

const PAGE = 25;

const Enquiries = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<Enquiry[]>([]);
  const [lines, setLines] = useState<ServiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  // Filters live in the address bar and the desk remembers the last set used.
  useRestoreListParams();
  const clearParams = useClearListParams();
  const [search, setSearch] = useListParam<string>("q", "");
  const [lineFilter, setLineFilter] = useListParam<string>("line", "all");
  const [view, setView] = useListParam<string>("view", "owed");
  const [pageParam, setPageParam] = useListParam<string>("page", "1");
  const page = Math.max(0, (Number(pageParam) || 1) - 1);
  const setPage = (n: number) => setPageParam(String(n + 1));

  const [selected, setSelected] = useState<Enquiry | null>(null);
  // Route to Care, from the enquiry itself.
  const [routeOpen, setRouteOpen] = useState(false);
  const [careServices, setCareServices] = useState<any[]>([]);
  const openRoute = async () => {
    if (careServices.length === 0) {
      const { data } = await adminDb().from("services").select("id, slug, name, client_group, client_groups").eq("is_offered", true).order("sort_order");
      setCareServices(data ?? []);
    }
    setRouteOpen(true);
  };
  const [sends, setSends] = useState<EnquirySend[]>([]);
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();


  const load = async () => {
    try {
      const [rows, ls] = await Promise.all([loadEnquiries(), loadServiceLines(true)]);
      setItems(rows);
      setLines(ls);
    } catch (err) {
      setLoadFailed(true);
      toast({
        title: "Could not load enquiries",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Archived enquiries are kept apart and only read when the Archived tab is opened.
  const [archived, setArchived] = useState<Enquiry[] | null>(null);
  const [archivedFailed, setArchivedFailed] = useState(false);
  const showingArchived = view === "archived";

  const loadArchived = async () => {
    setArchivedFailed(false);
    try {
      const rows = await selectAll<Enquiry>((from, to) =>
        adminDb()
          .from("contact_submissions")
          .select("*")
          .eq("archived", true)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
      );
      setArchived(rows.map((r) => ({
        ...r,
        answers: r.answers && typeof r.answers === "object" ? r.answers : {},
      })));
    } catch (err) {
      setArchivedFailed(true);
      setArchived([]);
      toast({
        title: "Could not load archived enquiries",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (showingArchived && archived === null) void loadArchived();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [showingArchived, archived]);

  // A change made in the dialog lands on whichever list holds the row.
  const patchRow = (id: string, patch: Partial<Enquiry>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    setArchived((prev) => (prev ? prev.map((i) => (i.id === id ? { ...i, ...patch } : i)) : prev));
  };

  const restoreItem = async (id: string) => {
    const { error } = await adminDb().from("contact_submissions").update({ archived: false }).eq("id", id);
    if (error) {
      toast({ title: "Could not restore", description: error.message, variant: "destructive" });
      return;
    }
    setArchived((prev) => (prev ? prev.filter((i) => i.id !== id) : prev));
    setSelected(null);
    toast({ title: "Enquiry restored" });
    void load();
  };

  const openEnquiry = async (item: Enquiry) => {
    setSelected(item);
    setSends([]);
    if (item.status === "new") {
      const { error } = await adminDb().from("contact_submissions").update({ status: "read" }).eq("id", item.id);
      if (error) toast({ title: "Could not mark it read", description: error.message, variant: "destructive" });
      else patchRow(item.id, { status: "read" });
    }
    try { setSends(await loadSends(item.id)); } catch { /* the history is not the point */ }
  };

  const changeStage = async (id: string, stage: string) => {
    await setEnquiryStage(id, stage);
    patchRow(id, { stage });
    setSelected((s) => (s && s.id === id ? { ...s, stage } : s));
  };

  const changeOwner = async (id: string, owner: string) => {
    await setEnquiryOwner(id, owner || null);
    patchRow(id, { owner });
  };

  // Archiving is one click, so it comes with an undo rather than a dialog.
  const archiveItem = async (id: string) => {
    const { error } = await adminDb().from("contact_submissions").update({ archived: true }).eq("id", id);
    if (error) {
      toast({ title: "Could not archive", description: error.message, variant: "destructive" });
      return;
    }
    const removed = items.find((i) => i.id === id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    // The archived list reads again next time it is opened.
    setArchived(null);
    setSelected(null);
    toast({
      title: "Enquiry archived",
      action: (
        <ToastAction
          altText="Undo archive"
          onClick={async () => {
            const { error: undoError } = await adminDb().from("contact_submissions").update({ archived: false }).eq("id", id);
            if (undoError) toast({ title: "Could not undo", description: undoError.message, variant: "destructive" });
            else {
              setArchived(null);
              if (removed) setItems((prev) => [removed, ...prev].sort((a, b) => b.created_at.localeCompare(a.created_at)));
            }
          }}
        >
          Undo
        </ToastAction>
      ),
    });
  };

  const resend = async (item: Enquiry, force: boolean) => {
    setSending(true);
    try {
      const res = await sendEnquiryReply(item.id, force);
      if (res?.skipped === "already_sent") {
        toast({ title: "Already sent", description: "Use Send again to send it a second time." });
      } else if (res?.skipped === "suppressed") {
        toast({ title: "Address suppressed", description: "This address has bounced or unsubscribed.", variant: "destructive" });
      } else {
        toast({ title: "Reply sent", description: res?.brochure ? `Guide attached: ${res.brochure}` : "No brochure is loaded for this line yet." });
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, last_sent_at: new Date().toISOString() } : i)));
      }
      setSends(await loadSends(item.id));
    } catch (err) {
      toast({
        title: "Could not send the reply",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const lineName = (key: string | null) => lines.find((l) => l.key === key)?.name ?? key ?? "Not set";

  const owed = (i: Enquiry) => i.stage === "new" && !i.last_sent_at;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = showingArchived ? archived ?? [] : items;
    return source.filter((i) => {
      if (term && ![i.name, i.email, i.service, i.city].some((f) => (f ?? "").toLowerCase().includes(term))) return false;
      if (lineFilter !== "all" && i.service_line !== lineFilter) return false;
      if (view === "archived") return true;
      if (view === "owed") return owed(i);
      if (view === "open") return !["won", "closed"].includes(i.stage);
      if (view === "won") return i.stage === "won";
      return true;
    });
  }, [items, archived, showingArchived, search, lineFilter, view]);

  const paged = filtered.slice(page * PAGE, (page + 1) * PAGE);
  const totalPages = Math.ceil(filtered.length / PAGE);

  const counts = {
    owed: items.filter(owed).length,
    open: items.filter((i) => !["won", "closed"].includes(i.stage)).length,
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <MuPageHeader
        title="Enquiries"
        description="Website enquiries, replies and routing into care."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/admin/enquiries/setup"><Settings2 className="h-4 w-4 mr-2" />Enquiry setup</Link>
            </Button>
            <ExportDropdown data={filtered} filename="enquiries" />
          </>
        }
      />

      <Tabs value={view} onValueChange={(v) => { setView(v); setPage(0); }} className="mt-4">
        <TabsList>
          <TabsTrigger value="owed">Unanswered ({counts.owed})</TabsTrigger>
          <TabsTrigger value="open">Open ({counts.open})</TabsTrigger>
          <TabsTrigger value="won">Care started</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="my-4">
      <MuToolbar>
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email or town"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <SelectField
          label="Service line"
          hideLabel
          className="w-56"
          value={lineFilter === "all" ? "" : lineFilter}
          placeholder="Every service line"
          onChange={(v) => { setLineFilter(v || "all"); setPage(0); }}
          options={lines.map((l) => ({ value: l.key, label: l.name }))}
        />
      </MuToolbar>
      </div>
      <div className="mb-4">
        <FilterChips
          filters={[
            ...(search ? [{ key: "q", label: `Search: ${search}`, onRemove: () => { setSearch(""); setPage(0); } }] : []),
            ...(lineFilter !== "all" ? [{ key: "line", label: lineName(lineFilter), onRemove: () => { setLineFilter("all"); setPage(0); } }] : []),
          ]}
          onClearAll={() => clearParams(["q", "line", "page"])}
          shown={filtered.length}
          noun={filtered.length === 1 ? "enquiry" : "enquiries"}
        />
      </div>

      {showingArchived && archived === null ? (
        <div className="flex justify-center border border-line bg-card py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (showingArchived ? archivedFailed : loadFailed) ? (
        <div className="border border-line bg-card px-5 py-10 text-center text-sm text-muted-foreground">
          {showingArchived ? "Archived enquiries" : "Enquiries"} could not be loaded. Refresh to try again.
        </div>
      ) : paged.length === 0 ? (
        <div className="border border-line bg-card">
          {showingArchived && !search && lineFilter === "all" ? (
            <MuEmpty
              art={art.objFolderDocuments}
              title="No archived enquiries"
              description="Enquiries you archive appear here and can be restored."
            />
          ) : (
          <MuEmpty
            art={search || lineFilter !== "all" ? art.objMagnifier : art.objEnvelope}
            title={search || lineFilter !== "all" ? "No matching enquiries" : "No enquiries here"}
            description={search || lineFilter !== "all" ? "Try a different search or service line." : "Enquiries in this view appear here as they arrive."}
          />
          )}
        </div>
      ) : (
      <>
      <div className="hidden md:block overflow-x-auto border border-line bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={HEAD}>Person</TableHead>
              <TableHead className={HEAD}>Service line</TableHead>
              <TableHead className={HEAD}>Stage</TableHead>
              <TableHead className={HEAD}>Reply</TableHead>
              <TableHead className={HEAD}>Waiting</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((item) => (
              <TableRow key={item.id} className="cursor-pointer" onClick={() => openEnquiry(item)}>
                <TableCell>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{[item.email, item.city].filter(Boolean).join(", ")}</div>
                </TableCell>
                <TableCell className="text-sm">{lineName(item.service_line)}</TableCell>
                <TableCell><MuStatus label={stageLabel(item.stage)} /></TableCell>
                <TableCell className="text-sm">
                  {item.last_sent_at
                    ? <span className="text-muted-foreground">Sent {format(new Date(item.last_sent_at), "dd MMM")}</span>
                    : <span className="text-destructive font-medium">Not sent</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNowStrict(new Date(item.created_at))}
                </TableCell>
                <TableCell>
                  {showingArchived ? (
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); void restoreItem(item.id); }}>
                      <ArchiveRestore className="h-4 w-4 mr-2" />Restore
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" aria-label="Archive enquiry" onClick={(e) => { e.stopPropagation(); archiveItem(item.id); }}>
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConsoleMobileList
        emptyLabel="No enquiries here."
        rows={paged.map((item) => ({
          key: item.id,
          title: item.name,
          state: `${lineName(item.service_line)}, waiting ${formatDistanceToNowStrict(new Date(item.created_at))}`,
          status: <MuStatus label={stageLabel(item.stage)} />,
          onOpen: () => openEnquiry(item),
        }))}
      />
      </>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selected?.name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-5 text-sm break-words">
              <div className="grid gap-2 border border-line p-3 sm:grid-cols-2">
                <div><span className="text-muted-foreground">Email</span><div>{selected.email}</div></div>
                <div><span className="text-muted-foreground">Phone</span><div>{selected.phone || "Not given"}{phoneCountry(selected.phone) && phoneCountry(selected.phone) !== "Nigeria" ? `, ${phoneCountry(selected.phone)}` : ""}</div></div>
                <div><span className="text-muted-foreground">Service line</span><div>{lineName(selected.service_line)}</div></div>
                <div><span className="text-muted-foreground">Town</span><div>{selected.city || "Not given"}</div></div>
                <div><span className="text-muted-foreground">Sent through</span><div>{selected.source.replace(/_/g, " ")}</div></div>
                <div><span className="text-muted-foreground">Source</span><div>{enquiryOrigin(selected)}</div></div>
                <div><span className="text-muted-foreground">Received</span><div>{format(new Date(selected.created_at), "dd MMM yyyy, HH:mm")}</div></div>
              </div>

              {isCareRequest(selected.answers) ? (
                <div>
                  <div className="font-semibold mb-2">Care request</div>
                  <div className="border border-line divide-y divide-line-soft">
                    {careRequestRows(selected.answers, lineName).map((row) => (
                      <div key={row.label} className="flex gap-3 px-3 py-2">
                        <div className="w-44 shrink-0 text-muted-foreground">{row.label}</div>
                        <div>{row.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : Object.keys(selected.answers).length > 0 && (
                <div>
                  <div className="font-semibold mb-2">Enquiry details</div>
                  <div className="border border-line divide-y divide-line-soft">
                    {Object.entries(selected.answers).map(([k, v]) => (
                      <div key={k} className="flex gap-3 px-3 py-2">
                        <div className="w-44 shrink-0 text-muted-foreground capitalize">{k.replace(/_/g, " ")}</div>
                        <div>{Array.isArray(v) ? v.join(", ") : String(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.message && !isCareRequest(selected.answers) && (
                <div className="border border-line p-3">
                  <div className="font-semibold mb-1">Message</div>
                  <p className="whitespace-pre-wrap text-muted-foreground">{selected.message}</p>
                </div>
              )}

              <div className="grid gap-3 border-2 border-navy bg-tint/40 p-3 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-label mb-1">Stage</div>
                  <SelectField
                    label="Stage"
                    hideLabel
                    value={selected.stage}
                    onChange={(v) => { if (v) changeStage(selected.id, v); }}
                    options={ENQUIRY_STAGES.map((s) => ({ value: s.key, label: s.label }))}
                  />
                </div>
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-label mb-1">Owner</div>
                  <Input
                    defaultValue={selected.owner ?? ""}
                    placeholder="Name"
                    onBlur={(e) => changeOwner(selected.id, e.target.value)}
                  />
                </div>
              </div>


              <div className="flex flex-col gap-3 border-l-4 border-l-brand bg-tint/50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-extrabold text-navy">Care</div>
                  <div className="text-muted-foreground">
                    {selected.care_client_id ? "Has a care record" : "Not routed yet"}
                  </div>
                </div>
                {selected.care_client_id ? (
                  <Button size="sm" variant="outline" onClick={() => navigate(`/admin/clients/${selected.care_client_id}`)}>Open care record</Button>
                ) : (
                  <Button size="sm" onClick={() => void openRoute()}>Route to Care</Button>
                )}
              </div>

              <div className="border border-line p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-semibold"><Mail className="h-4 w-4" />Reply and brochure</div>
                  <Button size="sm" disabled={sending} onClick={() => resend(selected, !!selected.last_sent_at)}>
                    {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    {selected.last_sent_at ? "Send again" : "Send now"}
                  </Button>
                </div>
                {sends.length === 0 ? (
                  <p className="text-muted-foreground">Nothing sent yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {sends.map((s) => (
                      <li key={s.id} className="flex items-start gap-2 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>
                          {[
                            format(new Date(s.sent_at), "dd MMM yyyy, HH:mm"),
                            s.subject,
                            s.brochure_name,
                            s.status !== "sent" ? "failed" : null,
                          ].filter(Boolean).join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" asChild>
                  <a href={`mailto:${selected.email}`}>Reply by email</a>
                </Button>
                {selected.archived ? (
                  <Button variant="outline" onClick={() => void restoreItem(selected.id)}>
                    <ArchiveRestore className="h-4 w-4 mr-2" />Restore
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => archiveItem(selected.id)}>
                    <Archive className="h-4 w-4 mr-2" />Archive
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <PromoteEnquiries
        open={routeOpen}
        onOpenChange={setRouteOpen}
        services={careServices}
        onlyId={selected?.id}
        onDone={() => { setSelected(null); void load(); }}
      />
    </div>
  );
};

export default Enquiries;
