import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArchiveRestore, Search } from "lucide-react";
import { adminDb } from "@/lib/admin-utils";
import { format } from "date-fns";

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
    await adminDb().from(table).update({ archived: false }).eq("id", id);
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

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold mb-6">Archive</h1>
      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search archives…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <Accordion type="multiple" defaultValue={["enquiries", "applications", "creator", "posts", "campaigns"]}>
        <AccordionItem value="enquiries">
          <AccordionTrigger>Contact Enquiries ({filterBySearch(enquiries, ["name", "email"]).length})</AccordionTrigger>
          <AccordionContent>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Date</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>
                {filterBySearch(enquiries, ["name", "email"]).map((i) => (
                  <TableRow key={i.id}><TableCell>{i.name}</TableCell><TableCell>{i.email}</TableCell><TableCell className="text-sm text-muted-foreground">{format(new Date(i.created_at), "dd MMM yyyy")}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => unarchive("contact_submissions", i.id)}><ArchiveRestore className="h-4 w-4" /></Button></TableCell></TableRow>
                ))}
                {filterBySearch(enquiries, ["name", "email"]).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Empty</TableCell></TableRow>}
              </TableBody>
            </Table>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="applications">
          <AccordionTrigger>Join Applications ({filterBySearch(applications, ["name", "email"]).length})</AccordionTrigger>
          <AccordionContent>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Date</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>
                {filterBySearch(applications, ["name", "email", "role"]).map((i) => (
                  <TableRow key={i.id}><TableCell>{i.name}</TableCell><TableCell>{i.role}</TableCell><TableCell className="text-sm text-muted-foreground">{format(new Date(i.created_at), "dd MMM yyyy")}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => unarchive("join_applications", i.id)}><ArchiveRestore className="h-4 w-4" /></Button></TableCell></TableRow>
                ))}
                {filterBySearch(applications, ["name", "email", "role"]).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Empty</TableCell></TableRow>}
              </TableBody>
            </Table>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="creator">
          <AccordionTrigger>Creator Applications ({filterBySearch(creatorApps, ["name", "email"]).length})</AccordionTrigger>
          <AccordionContent>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Country</TableHead><TableHead>Date</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>
                {filterBySearch(creatorApps, ["name", "email", "country"]).map((i) => (
                  <TableRow key={i.id}><TableCell>{i.name}</TableCell><TableCell>{i.country}</TableCell><TableCell className="text-sm text-muted-foreground">{format(new Date(i.created_at), "dd MMM yyyy")}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => unarchive("creator_applications", i.id)}><ArchiveRestore className="h-4 w-4" /></Button></TableCell></TableRow>
                ))}
                {filterBySearch(creatorApps, ["name", "email", "country"]).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Empty</TableCell></TableRow>}
              </TableBody>
            </Table>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="posts">
          <AccordionTrigger>Blog Posts ({filterBySearch(posts, ["title"]).length})</AccordionTrigger>
          <AccordionContent>
            <Table>
              <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Date</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>
                {filterBySearch(posts, ["title"]).map((i) => (
                  <TableRow key={i.id}><TableCell>{i.title}</TableCell><TableCell>{i.category}</TableCell><TableCell className="text-sm text-muted-foreground">{format(new Date(i.created_at), "dd MMM yyyy")}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => unarchive("blog_posts", i.id)}><ArchiveRestore className="h-4 w-4" /></Button></TableCell></TableRow>
                ))}
                {filterBySearch(posts, ["title"]).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Empty</TableCell></TableRow>}
              </TableBody>
            </Table>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="campaigns">
          <AccordionTrigger>Campaigns ({filterBySearch(campaigns, ["title"]).length})</AccordionTrigger>
          <AccordionContent>
            <Table>
              <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>
                {filterBySearch(campaigns, ["title"]).map((i: any) => (
                  <TableRow key={i.id}><TableCell>{i.title}</TableCell><TableCell>{i.status}</TableCell><TableCell className="text-sm text-muted-foreground">{format(new Date(i.created_at), "dd MMM yyyy")}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => unarchive("campaigns", i.id)}><ArchiveRestore className="h-4 w-4" /></Button></TableCell></TableRow>
                ))}
                {filterBySearch(campaigns, ["title"]).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Empty</TableCell></TableRow>}
              </TableBody>
            </Table>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default Archives;
