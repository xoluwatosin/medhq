import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Search, Filter } from "lucide-react";
import ExportDropdown from "@/components/admin/ExportDropdown";
import ConsoleMobileList from "@/components/admin/console/ConsoleMobileList";
import { HEARD_APPLICATION_STATUS, HEARD_ROLE_LABELS, PROFICIENCY_LABELS, SpokenLanguage } from "@/lib/heard-portal";

interface AccountApplication {
  id: string;
  role: string;
  status: string;
  created_at: string;
  profile: {
    first_name: string; last_name: string; preferred_name: string | null; email: string | null; phone: string | null;
    country_code: string | null; subdivision_name: string | null; subdivision_code: string | null; lga: string | null; city: string | null;
    timezone: string | null; languages: SpokenLanguage[] | null; adjustments: string | null; adjustments_discuss_privately: boolean;
  } | null;
}

interface Volunteer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  state: string;
  role_interest: string;
  motivation: string | null;
  time_commitment: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface WaitlistEntry {
  id: string;
  email: string;
  source: string | null;
  created_at: string;
}

const ROLE_LABEL: Record<string, string> = {
  peer_listener: "Peer Listener",
  social_media: "Social Media",
  professional: "Mental Health Professional",
};

const STATUSES = ["new", "reviewing", "invited", "training", "declined"];

const HeardVolunteers = () => {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Volunteer | null>(null);
  const [applications, setApplications] = useState<AccountApplication[]>([]);
  const [appSearch, setAppSearch] = useState("");
  const [appRole, setAppRole] = useState("all");
  const [openApp, setOpenApp] = useState<AccountApplication | null>(null);
  const { toast } = useToast();

  const fetchAll = async () => {
    setLoading(true);
    const [a, v, w] = await Promise.all([
      adminDb().from("heard_volunteer_applications").select("id, role, status, created_at, profile:heard_volunteer_profiles(first_name, last_name, preferred_name, email, phone, country_code, subdivision_name, subdivision_code, lga, city, timezone, languages, adjustments, adjustments_discuss_privately)").order("created_at", { ascending: false }),
      adminDb().from("heard_volunteers").select("*").order("created_at", { ascending: false }),
      adminDb().from("heard_waitlist").select("*").order("created_at", { ascending: false }),
    ]);
    if (a.error) toast({ title: "Could not load applications", description: a.error.message, variant: "destructive" });
    setApplications((a.data as unknown as AccountApplication[]) || []);
    if (v.error) toast({ title: "Error loading volunteers", description: v.error.message, variant: "destructive" });
    if (w.error) toast({ title: "Error loading waitlist", description: w.error.message, variant: "destructive" });
    setVolunteers((v.data as Volunteer[]) || []);
    setWaitlist((w.data as WaitlistEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await adminDb().from("heard_volunteers").update({ status }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setVolunteers((p) => p.map((v) => (v.id === id ? { ...v, status } : v)));
    if (selected?.id === id) setSelected({ ...selected, status });
  };

  const filtered = volunteers.filter((v) => {
    if (roleFilter !== "all" && v.role_interest !== roleFilter) return false;
    if (statusFilter !== "all" && v.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${v.first_name} ${v.last_name} ${v.email} ${v.state}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const appRows = applications.filter((x) => {
    if (appRole !== "all" && x.role !== appRole) return false;
    if (appSearch) {
      const q = appSearch.toLowerCase();
      if (!`${x.profile?.first_name} ${x.profile?.last_name} ${x.profile?.email}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const appName = (x: AccountApplication) => `${x.profile?.first_name ?? ""} ${x.profile?.last_name ?? ""}`.trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Heard applications</h1>
        <p className="text-sm text-muted-foreground mt-1">Account-based applications are separate from legacy interest records. Records are never merged automatically.</p>
      </div>

      <Tabs defaultValue="applications">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="applications">Applications ({applications.length})</TabsTrigger>
          <TabsTrigger value="volunteers">Legacy interest ({volunteers.length})</TabsTrigger>
          <TabsTrigger value="waitlist">Phone waitlist ({waitlist.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="space-y-4 mt-4">
          <div className="flex flex-col md:flex-row flex-wrap gap-3 md:items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search applications" placeholder="Name or email" className="pl-9" value={appSearch} onChange={(e) => setAppSearch(e.target.value)} />
            </div>
            <Select value={appRole} onValueChange={setAppRole}>
              <SelectTrigger className="md:w-[260px]" aria-label="Filter by role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {Object.entries(HEARD_ROLE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : appRows.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground text-sm">No applications</p>
          ) : (
            <>
              <div className="hidden md:block border rounded-xl overflow-hidden bg-background">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Selected role</TableHead><TableHead>Application status</TableHead><TableHead>Date started</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {appRows.map((x) => (
                      <TableRow key={x.id} className="cursor-pointer" tabIndex={0} onClick={() => setOpenApp(x)} onKeyDown={(e) => e.key === "Enter" && setOpenApp(x)}>
                        <TableCell className="font-medium">{appName(x)}</TableCell>
                        <TableCell className="text-sm">{x.profile?.email}</TableCell>
                        <TableCell className="text-sm">{HEARD_ROLE_LABELS[x.role] ?? x.role}</TableCell>
                        <TableCell><Badge variant="secondary">{HEARD_APPLICATION_STATUS[x.status] ?? x.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(x.created_at), "dd MMM yyyy")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ConsoleMobileList
                emptyLabel="No applications"
                rows={appRows.map((x) => ({
                  key: x.id,
                  title: appName(x),
                  state: `${HEARD_ROLE_LABELS[x.role] ?? x.role} · ${format(new Date(x.created_at), "dd MMM yyyy")}`,
                  status: <Badge variant="secondary">{HEARD_APPLICATION_STATUS[x.status] ?? x.status}</Badge>,
                  onOpen: () => setOpenApp(x),
                }))}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="volunteers" className="space-y-4 mt-4">
          <div className="hidden md:flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input placeholder="Search name, email, state..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {Object.entries(ROLE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <ExportDropdown
              data={filtered.map((v) => ({
                name: `${v.first_name} ${v.last_name}`,
                email: v.email,
                state: v.state,
                role: ROLE_LABEL[v.role_interest] ?? v.role_interest,
                time_commitment: v.time_commitment ?? "",
                status: v.status,
                motivation: v.motivation ?? "",
                signed_up_at: v.created_at,
              }))}
              filename="heard-volunteers"
            />
          </div>

          <details className="md:hidden border border-line-soft bg-card">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-2 text-sm font-medium text-navy">
              <Filter className="h-4 w-4" />Filter
            </summary>
            <div className="flex flex-col gap-3 px-4 pb-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search name, email, state..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {Object.entries(ROLE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <ExportDropdown
                data={filtered.map((v) => ({
                  name: `${v.first_name} ${v.last_name}`,
                  email: v.email,
                  state: v.state,
                  role: ROLE_LABEL[v.role_interest] ?? v.role_interest,
                  time_commitment: v.time_commitment ?? "",
                  status: v.status,
                  motivation: v.motivation ?? "",
                  signed_up_at: v.created_at,
                }))}
                filename="heard-volunteers"
              />
            </div>
          </details>

          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground text-sm">No volunteers match these filters yet.</p>
          ) : (
            <>
              <div className="hidden md:block border rounded-xl overflow-hidden bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Signed up</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((v) => (
                      <TableRow key={v.id} className="cursor-pointer" onClick={() => setSelected(v)}>
                        <TableCell className="font-medium">{v.first_name} {v.last_name}</TableCell>
                        <TableCell className="text-sm">{v.email}</TableCell>
                        <TableCell className="text-sm">{v.state}</TableCell>
                        <TableCell className="text-sm">{ROLE_LABEL[v.role_interest] ?? v.role_interest}</TableCell>
                        <TableCell className="text-sm">{v.time_commitment}</TableCell>
                        <TableCell><Badge variant="secondary">{v.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(v.created_at), "dd MMM yyyy")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ConsoleMobileList
                emptyLabel="No volunteers match these filters yet."
                rows={filtered.map((v) => ({
                  key: v.id,
                  title: `${v.first_name} ${v.last_name}`,
                  state: `${ROLE_LABEL[v.role_interest] ?? v.role_interest} · ${v.state} · ${format(new Date(v.created_at), "dd MMM yyyy")}`,
                  status: <Badge variant="secondary">{v.status}</Badge>,
                  onOpen: () => setSelected(v),
                }))}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="waitlist" className="space-y-4 mt-4">
          <div className="flex items-center justify-end">
            <ExportDropdown
              data={waitlist.map((w) => ({ email: w.email, source: w.source ?? "", joined_at: w.created_at }))}
              filename="heard-waitlist"
            />
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : waitlist.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground text-sm">No one on the waitlist yet.</p>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-background">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Email</TableHead><TableHead>Source</TableHead><TableHead>Joined</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {waitlist.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{w.source}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(w.created_at), "dd MMM yyyy p")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!openApp} onOpenChange={(open) => !open && setOpenApp(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {openApp && (
            <>
              <DialogHeader><DialogTitle>{appName(openApp)}</DialogTitle></DialogHeader>
              <div className="space-y-4 text-sm">
                <Row label="Preferred name" value={openApp.profile?.preferred_name ?? ""} />
                <Row label="Email" value={openApp.profile?.email ?? ""} />
                <Row label="Phone" value={openApp.profile?.phone ?? ""} />
                <Row label="Role" value={HEARD_ROLE_LABELS[openApp.role] ?? openApp.role} />
                <Row label="Status" value={HEARD_APPLICATION_STATUS[openApp.status] ?? openApp.status} />
                <Row label="Country" value={openApp.profile?.country_code ?? ""} />
                <Row label="State or region" value={openApp.profile?.subdivision_name ? `${openApp.profile.subdivision_name} (${openApp.profile.subdivision_code})` : ""} />
                <Row label="LGA" value={openApp.profile?.lga ?? ""} />
                <Row label="City or town" value={openApp.profile?.city ?? ""} />
                <Row label="Time zone" value={openApp.profile?.timezone ?? ""} />
                <Row label="Languages" value={(openApp.profile?.languages ?? []).map((l) => `${l.language} (${PROFICIENCY_LABELS[l.proficiency] ?? l.proficiency})`).join(", ")} />
                <Row label="Adjustments" value={openApp.profile?.adjustments_discuss_privately ? `${openApp.profile?.adjustments ?? ""} (prefers to discuss privately)`.trim() : openApp.profile?.adjustments ?? ""} />
                <p className="text-xs text-muted-foreground pt-2">Started {format(new Date(openApp.created_at), "PPPp")}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.first_name} {selected.last_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <Row label="Email" value={<a href={`mailto:${selected.email}`} className="text-primary hover:underline">{selected.email}</a>} />
                <Row label="State" value={selected.state} />
                <Row label="Role" value={ROLE_LABEL[selected.role_interest] ?? selected.role_interest} />
                <Row label="Time" value={selected.time_commitment ?? ""} />
                <div>
                  <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Motivation</p>
                  <p className="text-sm whitespace-pre-line">{selected.motivation}</p>
                </div>
                <div>
                  <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Status</p>
                  <Select value={selected.status} onValueChange={(s) => updateStatus(selected.id, s)}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground pt-2">Signed up {format(new Date(selected.created_at), "PPPp")}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="grid grid-cols-[100px_1fr] gap-3">
    <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground pt-0.5">{label}</span>
    <span>{value}</span>
  </div>
);

export default HeardVolunteers;
