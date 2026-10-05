import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MuEmpty, MuPage, MuPageHeader, MuStatus, MuToolbar, type MuTone } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConsoleMobileList from "@/components/admin/console/ConsoleMobileList";
import { Loader2, Archive, ArchiveRestore, Search, Download, Eye, EyeOff } from "lucide-react";
import { PAGE_SIZE, adminDb } from "@/lib/admin-utils";
import { selectAll } from "@/lib/select-all";
import ExportDropdown from "@/components/admin/ExportDropdown";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface Application {
  id: string; person_id?: string | null; name: string; email: string; phone: string; role: string;
  experience: string | null; message: string | null; status: string; archived: boolean; created_at: string;
  first_name?: string | null; last_name?: string | null; role_other?: string | null;
  qualification?: string | null; qualification_other?: string | null; years_experience?: number | null;
  licensing_body?: string | null; licensing_body_other?: string | null;
  license_number?: string | null; license_expiry?: string | null; license_to_practice?: string | null;
  nysc_status?: string | null; right_to_work?: boolean | null;
  background_check_consent?: boolean | null; criminal_record?: boolean | null;
  criminal_record_details?: string | null; drug_test_consent?: boolean | null;
  emergency_med_interest?: string | null; training_commitment?: boolean | null;
  lives_in_lagos?: boolean | null; state?: string | null; lga_primary?: string | null;
  lgas_willing_to_commute?: string[] | null; has_transport?: boolean | null;
  languages?: any; availability?: string[] | null;
  start_window?: string | null; start_date?: string | null;
  cv_url?: string | null; declaration_accepted?: boolean | null;
}

const statusTone: Record<string, MuTone> = { new: "info", reviewed: "neutral", accepted: "good", rejected: "warning" };
// Stored keys stay as they are; these are the labels the screen shows.
const STATUS_LABELS: Record<string, string> = { new: "Submitted", reviewed: "Under review", accepted: "Accepted", rejected: "Rejected" };
const yn = (v: boolean | null | undefined) => v === true ? "Yes" : v === false ? "No" : "Not answered";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="pt-3 mt-3 border-t first:border-t-0 first:pt-0 first:mt-0">
    <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-label">{title}</h4>
    <div className="space-y-1.5">{children}</div>
  </div>
);
const Row = ({ label, value }: { label: string; value: React.ReactNode }) =>
  value === null || value === undefined || value === "" ? null : (
    <div className="text-sm"><span className="font-medium">{label}:</span> <span className="text-muted-foreground">{value}</span></div>
  );

const Applications = () => {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Application | null>(null);
  const [page, setPage] = useState(0);
  const [downloadingCv, setDownloadingCv] = useState(false);
  const [cvPreviewUrl, setCvPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const { toast } = useToast();

  const fetchItems = async () => {
    const { data, error } = await adminDb().from("join_applications").select("*").eq("archived", false).order("created_at", { ascending: false });
    if (error) toast({ title: "Could not load applications", description: error.message, variant: "destructive" });
    else setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    void fetchItems();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  // Archived applications are a status-style view, read only when it is chosen.
  const showingArchived = statusFilter === "archived";
  const [archived, setArchived] = useState<Application[] | null>(null);
  const [archivedFailed, setArchivedFailed] = useState(false);

  useEffect(() => {
    if (!showingArchived || archived !== null) return;
    (async () => {
      setArchivedFailed(false);
      try {
        const rows = await selectAll<Application>((from, to) =>
          adminDb().from("join_applications").select("*").eq("archived", true)
            .order("created_at", { ascending: false }).order("id").range(from, to),
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
    const { error } = await adminDb().from("join_applications").update({ archived: false }).eq("id", id);
    if (error) {
      toast({ title: "Could not restore", description: error.message, variant: "destructive" });
      return;
    }
    setArchived((prev) => (prev ? prev.filter((i) => i.id !== id) : prev));
    setSelected(null);
    toast({ title: "Application restored" });
    void fetchItems();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await adminDb().from("join_applications").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Could not change the status", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    setArchived((prev) => (prev ? prev.map((i) => (i.id === id ? { ...i, status } : i)) : prev));
    if (selected?.id === id) setSelected({ ...selected, status });
  };

  const archiveItem = async (id: string) => {
    const { error } = await adminDb().from("join_applications").update({ archived: true }).eq("id", id);
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

  const downloadCv = async (path: string) => {
    setDownloadingCv(true);
    const { data, error } = await supabase.storage.from("applications").createSignedUrl(path, 60);
    setDownloadingCv(false);
    if (error || !data?.signedUrl) {
      toast({ title: "Could not open the CV", description: "The download link could not be created.", variant: "destructive" });
      return;
    }
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const togglePreview = async (path: string) => {
    if (cvPreviewUrl) { setCvPreviewUrl(null); return; }
    setLoadingPreview(true);
    const { data, error } = await supabase.storage.from("applications").createSignedUrl(path, 600);
    setLoadingPreview(false);
    if (error || !data?.signedUrl) {
      toast({ title: "Could not load the CV preview", description: "The preview link could not be created.", variant: "destructive" });
      return;
    }
    setCvPreviewUrl(data.signedUrl);
  };

  const getCvExt = (path: string) => path.split(".").pop()?.toLowerCase() || "";

  const filtered = (showingArchived ? archived ?? [] : items).filter((i) => {
    const matchesSearch = !search || [i.name, i.email, i.role].some((f) => (f || "").toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = showingArchived || statusFilter === "all" || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <MuPage>
      <MuPageHeader
        title="Candidate applications"
        description="Applications sent through the old join form, kept for the record."
        actions={<ExportDropdown data={filtered} filename="applications" />}
      />
      <MuToolbar>
        <div className="relative flex-1 lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, email, role…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 bg-background" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-full bg-background lg:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">Submitted</SelectItem>
            <SelectItem value="reviewed">Under review</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </MuToolbar>
      <div className="hidden md:block overflow-x-auto border border-line bg-card">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Experience</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead className="w-10" /></TableRow>
          </TableHeader>
          <TableBody>
            {showingArchived && archived === null ? (
              <TableRow><TableCell colSpan={7} className="py-12 text-center"><Loader2 className="inline h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>
            ) : showingArchived && archivedFailed ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Archived applications could not be loaded. Refresh to try again.</TableCell></TableRow>
            ) : paged.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="p-0">
                {showingArchived && !search
                  ? <MuEmpty art={art.objFolderDocuments} title="No archived applications" description="Applications you archive appear here and can be restored." />
                  : <MuEmpty art={art.objMagnifier} title="No applications found" description="Try a different search or status." />}
              </TableCell></TableRow>
            ) : paged.map((item) => (
              <TableRow key={item.id} className="cursor-pointer" onClick={() => { setCvPreviewUrl(null); setSelected(item); }}>
                <TableCell className="font-medium">
                  {item.name}
                  {/* Every join application made a person; open their record. */}
                  {item.person_id && (
                    <Link to={`/admin/match-universe/${item.person_id}`} onClick={(e) => e.stopPropagation()} className="mt-0.5 block text-xs font-bold text-brand hover:underline">
                      Open in Talent pool
                    </Link>
                  )}
                </TableCell>
                <TableCell>{item.email}</TableCell>
                <TableCell>{item.role}</TableCell>
                <TableCell>{item.experience || (item.years_experience != null ? `${item.years_experience} yrs` : "Not stated")}</TableCell>
                <TableCell><MuStatus tone={statusTone[item.status] ?? "neutral"} label={STATUS_LABELS[item.status] ?? item.status} /></TableCell>
                <TableCell className="text-muted-foreground text-sm">{format(new Date(item.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  {showingArchived ? (
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); void restoreItem(item.id); }}><ArchiveRestore className="h-4 w-4 mr-2" />Restore</Button>
                  ) : (
                    <Button variant="ghost" size="icon" aria-label="Archive application" onClick={(e) => { e.stopPropagation(); archiveItem(item.id); }}><Archive className="h-4 w-4" /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConsoleMobileList
        emptyLabel={showingArchived && archived === null ? "Loading archived applications" : showingArchived && archivedFailed ? "Archived applications could not be loaded." : showingArchived && !search ? "No archived applications." : "No applications found."}
        emptyArt={showingArchived && archived !== null && !archivedFailed && !search ? art.objFolderDocuments : undefined}
        rows={paged.map((item) => ({
          key: item.id,
          title: item.name,
          state: (
            <span className="flex flex-wrap gap-x-3">
              <span>{item.role_other || item.role}</span>
              <span>{format(new Date(item.created_at), "dd MMM yyyy")}</span>
            </span>
          ),
          status: <MuStatus tone={statusTone[item.status] ?? "neutral"} label={STATUS_LABELS[item.status] ?? item.status} />,
          onOpen: () => { setCvPreviewUrl(null); setSelected(item); },
        }))}
      />
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setCvPreviewUrl(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Application from {selected?.name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="overflow-hidden break-words">
              <Section title="Personal details">
                <Row label="Email" value={selected.email} />
                <Row label="Phone" value={selected.phone} />
                <Row label="Submitted" value={format(new Date(selected.created_at), "dd MMM yyyy, HH:mm")} />
                <div className="text-sm flex items-center gap-2">
                  <span className="font-medium">Status:</span>
                  <Select value={selected.status} onValueChange={(v) => updateStatus(selected.id, v)}>
                    <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Submitted</SelectItem>
                      <SelectItem value="reviewed">Under review</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Section>

              <Section title="Professional details">
                <Row label="Role" value={selected.role_other || selected.role} />
                <Row label="Qualification" value={selected.qualification_other || selected.qualification} />
                <Row label="Years experience" value={selected.years_experience ?? selected.experience} />
                <Row label="Licensing body" value={selected.licensing_body_other || selected.licensing_body} />
                <Row label="Licence number" value={selected.license_number} />
                <Row label="Licence expiry" value={selected.license_expiry ? format(new Date(selected.license_expiry), "dd MMM yyyy") : null} />
                <Row label="Licence to practise" value={selected.license_to_practice} />
              </Section>

              <Section title="Compliance">
                <Row label="NYSC" value={selected.nysc_status} />
                <Row label="Right to work" value={yn(selected.right_to_work)} />
                <Row label="Background check" value={yn(selected.background_check_consent)} />
                <Row label="Drug test" value={yn(selected.drug_test_consent)} />
                <Row label="Criminal record" value={yn(selected.criminal_record)} />
                {selected.criminal_record_details && <Row label="Details" value={selected.criminal_record_details} />}
                <Row label="Emergency medicine training" value={selected.emergency_med_interest} />
                <Row label="Training commitment" value={yn(selected.training_commitment)} />
              </Section>

              <Section title="Location and availability">
                <Row label="Lives in Lagos" value={yn(selected.lives_in_lagos)} />
                <Row label="State" value={selected.state} />
                <Row label="LGA" value={selected.lga_primary} />
                <Row label="Willing to commute to" value={selected.lgas_willing_to_commute?.length ? selected.lgas_willing_to_commute.join(", ") : null} />
                <Row label="Has transport" value={yn(selected.has_transport)} />
                <Row label="Languages" value={Array.isArray(selected.languages) && selected.languages.length ? selected.languages.map((l: any) => `${l.language} (${l.fluency})`).join(", ") : null} />
                <Row label="Availability" value={selected.availability?.length ? selected.availability.join(", ") : null} />
                <Row label="Start" value={selected.start_window === "future" && selected.start_date ? `Future, ${format(new Date(selected.start_date), "dd MMM yyyy")}` : selected.start_window} />
              </Section>

              <Section title="Documents and declaration">
                {selected.cv_url ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={loadingPreview} onClick={() => togglePreview(selected.cv_url!)} className="gap-2">
                        {loadingPreview ? <Loader2 className="h-3 w-3 animate-spin" /> : cvPreviewUrl ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {cvPreviewUrl ? "Hide preview" : "View CV"}
                      </Button>
                      <Button size="sm" variant="outline" disabled={downloadingCv} onClick={() => downloadCv(selected.cv_url!)} className="gap-2">
                        {downloadingCv ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}Download
                      </Button>
                    </div>
                    {cvPreviewUrl && (
                      <div className="border border-line bg-muted/30 overflow-hidden">
                        {["jpg", "jpeg", "png", "webp", "gif"].includes(getCvExt(selected.cv_url)) ? (
                          <img loading="lazy" decoding="async" src={cvPreviewUrl} alt="CV preview" className="w-full h-auto max-h-[600px] object-contain bg-background" />
                        ) : (
                          <iframe src={cvPreviewUrl} title="CV preview" className="w-full h-[600px] bg-background" />
                        )}
                      </div>
                    )}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No CV uploaded</p>}
                <Row label="Declaration accepted" value={yn(selected.declaration_accepted)} />
                {selected.message && (
                  <div className="pt-2">
                    <span className="font-medium text-sm">Cover note:</span>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{selected.message}</p>
                  </div>
                )}
              </Section>
              {selected.archived && (
                <div className="mt-4 flex justify-end">
                  <Button variant="outline" onClick={() => void restoreItem(selected.id)}><ArchiveRestore className="h-4 w-4 mr-2" />Restore</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MuPage>
  );
};

export default Applications;
