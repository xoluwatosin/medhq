import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArchiveRestore, Search } from "lucide-react";
import { adminDb } from "@/lib/admin-utils";
import { format } from "date-fns";
import { MuEmpty, MuPage, MuPageHeader, MuToolbar } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";

const HEAD = "text-[11px] font-bold uppercase tracking-[0.14em] text-label";

interface ArchiveGroup {
  value: string;
  label: string;
  table: string;
  items: any[];
  columns: { head: string; key: string }[];
}

const Archives = () => {
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [creatorApps, setCreatorApps] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const fetchAll = async () => {
      const db = adminDb();
      const [e, a, cr, p, c] = await Promise.all([
        db.from("contact_submissions").select("*").eq("archived", true).order("created_at", { ascending: false }),
        db.from("join_applications").select("*").eq("archived", true).order("created_at", { ascending: false }),
        db.from("creator_applications").select("*").eq("archived", true).order("created_at", { ascending: false }),
        db.from("blog_posts").select("*").eq("archived", true).order("created_at", { ascending: false }),
        db.from("campaigns").select("*").eq("archived", true).order("created_at", { ascending: false }),
      ]);
      setEnquiries(e.data || []);
      setApplications(a.data || []);
      setCreatorApps(cr.data || []);
      setPosts(p.data || []);
      setCampaigns(c.data || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const unarchive = async (table: string, id: string) => {
    const { error } = await adminDb().from(table).update({ archived: false }).eq("id", id);
    if (error) {
      toast({ title: "Could not restore", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Item restored" });
    if (table === "contact_submissions") setEnquiries((p) => p.filter((i) => i.id !== id));
    if (table === "join_applications") setApplications((p) => p.filter((i) => i.id !== id));
    if (table === "creator_applications") setCreatorApps((p) => p.filter((i) => i.id !== id));
    if (table === "blog_posts") setPosts((p) => p.filter((i) => i.id !== id));
    if (table === "campaigns") setCampaigns((p) => p.filter((i) => i.id !== id));
  };

  const filterBySearch = (items: any[], fields: string[]) =>
    items.filter((i) => !search || fields.some((f) => i[f]?.toLowerCase?.()?.includes(search.toLowerCase())));

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const groups: ArchiveGroup[] = [
    { value: "enquiries", label: "Contact enquiries", table: "contact_submissions", items: filterBySearch(enquiries, ["name", "email"]), columns: [{ head: "Name", key: "name" }, { head: "Email", key: "email" }] },
    { value: "applications", label: "Join applications", table: "join_applications", items: filterBySearch(applications, ["name", "email", "role"]), columns: [{ head: "Name", key: "name" }, { head: "Role", key: "role" }] },
    { value: "creator", label: "Creator applications", table: "creator_applications", items: filterBySearch(creatorApps, ["name", "email", "country"]), columns: [{ head: "Name", key: "name" }, { head: "Country", key: "country" }] },
    { value: "posts", label: "Blog posts", table: "blog_posts", items: filterBySearch(posts, ["title"]), columns: [{ head: "Title", key: "title" }, { head: "Category", key: "category" }] },
    { value: "campaigns", label: "Campaigns", table: "campaigns", items: filterBySearch(campaigns, ["title"]), columns: [{ head: "Title", key: "title" }, { head: "Status", key: "status" }] },
  ];

  return (
    <MuPage>
      <MuPageHeader title="Archive" description="Archived enquiries, applications, posts and campaigns. Restore anything that was filed by mistake." />
      <MuToolbar>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search the archive" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </MuToolbar>
      <Accordion type="multiple" defaultValue={groups.map((g) => g.value)} className="border border-line bg-card">
        {groups.map((g) => (
          <AccordionItem key={g.value} value={g.value} className="border-line-soft last:border-b-0">
            <AccordionTrigger className="px-5 text-[15px] font-extrabold text-navy hover:no-underline">
              {g.label} ({g.items.length})
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              {g.items.length === 0 ? (
                <MuEmpty
                  art={search ? art.objMagnifier : art.objFolderDocuments}
                  title={search ? "No matches" : "Nothing archived"}
                  description={search ? "Nothing archived here matches that search." : "Archived items of this kind will appear here."}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-line-soft hover:bg-transparent">
                      {g.columns.map((c) => <TableHead key={c.key} className={HEAD}>{c.head}</TableHead>)}
                      <TableHead className={HEAD}>Date</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.items.map((i) => (
                      <TableRow key={i.id} className="border-line-soft">
                        {g.columns.map((c) => <TableCell key={c.key}>{i[c.key]}</TableCell>)}
                        <TableCell className="text-sm text-muted-foreground">{format(new Date(i.created_at), "dd MMM yyyy")}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" aria-label="Restore" onClick={() => unarchive(g.table, i.id)}>
                            <ArchiveRestore className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </MuPage>
  );
};

export default Archives;
