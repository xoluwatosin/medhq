import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MuEmpty, MuPage, MuPageHeader, MuStatus, type MuTone } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConsoleMobileList from "@/components/admin/console/ConsoleMobileList";
import { Loader2, Archive, ArchiveRestore, Search, ExternalLink } from "lucide-react";
import { PAGE_SIZE, adminDb } from "@/lib/admin-utils";
import { selectAll } from "@/lib/select-all";
import ExportDropdown from "@/components/admin/ExportDropdown";
import { format } from "date-fns";

interface CreatorApplication {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  social_links: string;
  portfolio_url: string | null;
  rate_card_url: string | null;
  message: string;
  status: string;
  archived: boolean;
  created_at: string;
}

const statusTone: Record<string, MuTone> = {
  new: "info",
  reviewed: "neutral",
  accepted: "good",
  rejected: "warning",
};
const STATUS_LABELS: Record<string, string> = {
  new: "New",
  reviewed: "Reviewed",
  accepted: "Accepted",
  rejected: "Rejected",
};

const CreatorApplications = () => {
  const [items, setItems] = useState<CreatorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<CreatorApplication | null>(null);
  const [page, setPage] = useState(0);
  const { toast } = useToast();

  const fetchData = async () => {
    const { data, error } = await adminDb()
      .from("creator_applications")
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  // Archived applications are a status-style view, read only when it is chosen.
  const showingArchived = statusFilter === "archived";
  const [archived, setArchived] = useState<CreatorApplication[] | null>(null);
  const [archivedFailed, setArchivedFailed] = useState(false);

  useEffect(() => {
    if (!showingArchived || archived !== null) return;
    (async () => {
      setArchivedFailed(false);
      try {
        const rows = await selectAll<CreatorApplication>((from, to) =>
          adminDb()
            .from("creator_applications")
            .select("*")
            .eq("archived", true)
            .order("created_at", { ascending: false })
            .order("id")
            .range(from, to),
        );
        setArchived(rows);
      } catch (err) {
        setArchivedFailed(true);
        setArchived([]);
        toast({ title: "Could not load archived applications", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
      }
    })();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [showingArchived, archived]);

  const restoreItem = async (id: string) => {
    const { error } = await adminDb().from("creator_applications").update({ archived: false }).eq("id", id);
    if (error) {
      toast({ title: "Could not restore", description: error.message, variant: "destructive" });
      return;
    }
    setArchived((prev) => (prev ? prev.filter((i) => i.id !== id) : prev));
    setSelected(null);
    toast({ title: "Application restored" });
    void fetchData();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await adminDb().from("creator_applications").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Could not change the status", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    setArchived((prev) => (prev ? prev.map((i) => (i.id === id ? { ...i, status } : i)) : prev));
    if (selected?.id === id) setSelected({ ...selected, status });
  };

  const archiveItem = async (id: string) => {
    const { error } = await adminDb().from("creator_applications").update({ archived: true }).eq("id", id);
    if (error) {
      toast({ title: "Could not archive", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    // The archived view reads again next time it is chosen.
    setArchived(null);
    setSelected(null);
    toast({ title: "Application archived" });
  };

  const filtered = (showingArchived ? archived ?? [] : items).filter((i) => {
    const matchesSearch =
      !search ||
      [i.name, i.email, i.country].some((f) =>
        f.toLowerCase().includes(search.toLowerCase())
      );
    const matchesStatus = showingArchived || statusFilter === "all" || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  return (
    <MuPage>
      <MuPageHeader
        title="Creator programme"
        description="People who asked to make content with Medic Connect."
        actions={<ExportDropdown data={filtered} filename="creator-applications" />}
      />
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, country…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="hidden md:block overflow-x-auto border border-line bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {showingArchived && archived === null ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <Loader2 className="inline h-6 w-6 animate-spin text-primary" />
                </TableCell>
              </TableRow>
            ) : showingArchived && archivedFailed ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Archived creator applications could not be loaded. Refresh to try again.
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  {showingArchived && !search ? (
                    <MuEmpty
                      art={art.objFolderDocuments}
                      title="No archived creator applications"
                      description="Applications you archive appear here and can be restored."
                    />
                  ) : (
                    <MuEmpty
                      art={art.objMagnifier}
                      title="No creator applications found"
                      description="Try a different search or status."
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(item)}
                >
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.email}</TableCell>
                  <TableCell>{item.country}</TableCell>
                  <TableCell>
                    <MuStatus tone={statusTone[item.status] ?? "neutral"} label={STATUS_LABELS[item.status] ?? item.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(item.created_at), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    {showingArchived ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          void restoreItem(item.id);
                        }}
                      >
                        <ArchiveRestore className="h-4 w-4 mr-2" />
                        Restore
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Archive application"
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveItem(item.id);
                        }}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConsoleMobileList
        emptyLabel={
          showingArchived && archived === null
            ? "Loading archived applications"
            : showingArchived && archivedFailed
              ? "Archived creator applications could not be loaded."
              : showingArchived && !search
                ? "No archived creator applications."
                : "No creator applications found."
        }
        emptyArt={showingArchived && archived !== null && !archivedFailed && !search ? art.objFolderDocuments : undefined}
        rows={paged.map((item) => ({
          key: item.id,
          title: item.name,
          state: (
            <span className="flex flex-wrap gap-x-3">
              <span>{item.country}</span>
              <span>{format(new Date(item.created_at), "dd MMM yyyy")}</span>
            </span>
          ),
          status: <MuStatus tone={statusTone[item.status] ?? "neutral"} label={STATUS_LABELS[item.status] ?? item.status} />,
          onOpen: () => setSelected(item),
        }))}
      />
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground self-center">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Creator application from {selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm overflow-hidden break-words">
              <div>
                <span className="font-medium">Email:</span> {selected.email}
              </div>
              <div>
                <span className="font-medium">Phone:</span> {selected.phone}
              </div>
              <div>
                <span className="font-medium">Country:</span> {selected.country}
              </div>
              <div>
                <span className="font-medium">Date:</span>{" "}
                {format(new Date(selected.created_at), "dd MMM yyyy, HH:mm")}
              </div>
              <div>
                <span className="font-medium">Status:</span>{" "}
                <Select
                  value={selected.status}
                  onValueChange={(v) => updateStatus(selected.id, v)}
                >
                  <SelectTrigger className="w-28 inline-flex h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-2 border-t">
                <span className="font-medium">Social links:</span>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {selected.social_links}
                </p>
              </div>
              {selected.portfolio_url && (
                <div>
                  <span className="font-medium">Portfolio:</span>{" "}
                  <a
                    href={selected.portfolio_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {selected.rate_card_url && (
                <div>
                  <span className="font-medium">Rate card:</span>{" "}
                  <a
                    href={selected.rate_card_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              <div className="pt-2 border-t">
                <span className="font-medium">Why Medic Connect:</span>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {selected.message}
                </p>
              </div>
              {selected.archived && (
                <div className="flex justify-end pt-2">
                  <Button variant="outline" onClick={() => void restoreItem(selected.id)}>
                    <ArchiveRestore className="h-4 w-4 mr-2" />
                    Restore
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MuPage>
  );
};

export default CreatorApplications;
