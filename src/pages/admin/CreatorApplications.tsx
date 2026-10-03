import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConsoleMobileList from "@/components/admin/console/ConsoleMobileList";
import { Loader2, Archive, Search, ExternalLink } from "lucide-react";
import { PAGE_SIZE, adminDb } from "@/lib/admin-utils";
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

const statusColors: Record<string, string> = {
  new: "default",
  reviewed: "secondary",
  accepted: "outline",
  rejected: "destructive",
};

const CreatorApplications = () => {
  const [items, setItems] = useState<CreatorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<CreatorApplication | null>(null);
  const [page, setPage] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
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
    fetchData();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await adminDb().from("creator_applications").update({ status }).eq("id", id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    if (selected?.id === id) setSelected({ ...selected, status });
  };

  const archiveItem = async (id: string) => {
    await adminDb().from("creator_applications").update({ archived: true }).eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelected(null);
    toast({ title: "Application archived" });
  };

  const filtered = items.filter((i) => {
    const matchesSearch =
      !search ||
      [i.name, i.email, i.country].some((f) =>
        f.toLowerCase().includes(search.toLowerCase())
      );
    const matchesStatus = statusFilter === "all" || i.status === statusFilter;
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold">Creator applications</h1>
        <ExportDropdown data={filtered} filename="creator-applications" />
      </div>
      <div className="flex gap-3 mb-4">
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
          </SelectContent>
        </Select>
      </div>
      <div className="hidden md:block overflow-x-auto border rounded-lg">
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
            {paged.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  No creator applications found.
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
                    <Badge variant={statusColors[item.status] as any}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(item.created_at), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        archiveItem(item.id);
                      }}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConsoleMobileList
        emptyLabel="No creator applications found."
        rows={paged.map((item) => ({
          key: item.id,
          title: item.name,
          state: `${item.country} · ${format(new Date(item.created_at), "dd MMM yyyy")}`,
          status: <Badge variant={statusColors[item.status] as any}>{item.status}</Badge>,
          onOpen: () => setSelected(item),
        }))}
      />
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
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
            <DialogTitle>Creator Application: {selected?.name}</DialogTitle>
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
                <span className="font-medium">Social Links:</span>
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
                  <span className="font-medium">Rate Card:</span>{" "}
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatorApplications;
