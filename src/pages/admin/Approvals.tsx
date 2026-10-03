import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X, FileText, Megaphone } from "lucide-react";
import { adminDb } from "@/lib/admin-utils";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface PendingItem {
  id: string;
  title: string;
  created_by_name: string | null;
  approval_status: string;
  created_at: string;
  type: "blog" | "campaign";
}

const Approvals = () => {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPending = async () => {
    const db = adminDb();
    const [blogRes, campaignRes] = await Promise.all([
      db.from("blog_posts").select("id, title, created_by_name, approval_status, created_at").eq("approval_status", "pending"),
      db.from("campaigns").select("id, title, created_by_name, approval_status, created_at").eq("approval_status", "pending"),
    ]);
    const blogItems: PendingItem[] = (blogRes.data || []).map((p: any) => ({ ...p, type: "blog" as const }));
    const campaignItems: PendingItem[] = (campaignRes.data || []).map((c: any) => ({ ...c, type: "campaign" as const }));
    setItems([...blogItems, ...campaignItems].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setLoading(false);
  };

  useEffect(() => { fetchPending(); }, []);

  const handleApproval = async (item: PendingItem, status: "approved" | "rejected") => {
    setProcessing(item.id);
    const table = item.type === "blog" ? "blog_posts" : "campaigns";
    const updateData: any = { approval_status: status };
    // If approving a blog post, also set it to published
    if (status === "approved" && item.type === "blog") {
      updateData.status = "published";
      updateData.published_at = new Date().toISOString();
    }
    const { error } = await adminDb().from(table).update(updateData).eq("id", item.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setProcessing(null);
      return;
    }

    // If approving a campaign, actually send it now
    if (status === "approved" && item.type === "campaign") {
      toast({ title: "Approved — sending campaign…" });
      const { data, error: sendErr } = await supabase.functions.invoke("send-campaign", { body: { campaignId: item.id } });
      if (sendErr) {
        toast({ title: "Approved but send failed", description: sendErr.message, variant: "destructive" });
      } else {
        toast({ title: "Campaign sent", description: `Delivered to ${data?.totalSent ?? 0} recipients.` });
      }
    } else {
      toast({ title: status === "approved" ? "Approved!" : "Rejected" });
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setProcessing(null);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold mb-6">Approvals</h1>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No items pending approval.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  {item.type === "blog" ? <FileText className="h-4 w-4 text-muted-foreground" /> : <Megaphone className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <Link
                      to={item.type === "blog" ? `/admin/posts/${item.id}` : `/admin/campaigns/${item.id}`}
                      className="font-medium hover:underline"
                    >
                      {item.title || "Untitled"}
                    </Link>
                    <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">{item.type === "blog" ? "Blog Post" : "Campaign"}</Badge>
                      {item.created_by_name && <span>by {item.created_by_name}</span>}
                      <span>{format(new Date(item.created_at), "dd MMM yyyy")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    disabled={processing === item.id}
                    onClick={() => handleApproval(item, "approved")}
                  >
                    {processing === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={processing === item.id}
                    onClick={() => handleApproval(item, "rejected")}
                  >
                    <X className="h-3 w-3 mr-1" />Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Approvals;
