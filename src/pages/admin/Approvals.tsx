// Approvals: the super admin's queue of stories and campaigns that other
// admins have submitted. Approving a story publishes it there and then;
// approving a campaign sends it. Both are confirmed first. A rejection always
// carries a reason, which the author sees in the editor.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MuEmpty, MuLoadError, MuGroupHead, MuLedger, MuLedgerBody, MuLedgerRow, MuPageHeader, MuSection, MuStatus } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X, FileText, Megaphone } from "lucide-react";
import { adminDb } from "@/lib/admin-utils";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ConfirmAction } from "@/components/admin/ConfirmAction";

interface PendingItem {
  id: string;
  title: string;
  created_by_name: string | null;
  approval_status: string;
  created_at: string;
  status?: string;
  published_at?: string | null;
  type: "blog" | "campaign";
}

const Approvals = () => {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPending = async () => {
    const db = adminDb();
    const [blogRes, campaignRes] = await Promise.all([
      db.from("blog_posts").select("id, title, created_by_name, approval_status, created_at, status, published_at").eq("approval_status", "pending"),
      db.from("campaigns").select("id, title, created_by_name, approval_status, created_at").eq("approval_status", "pending"),
    ]);
    const failed = blogRes.error || campaignRes.error;
    if (failed) toast({ title: "Could not load the queue", description: failed.message, variant: "destructive" });
    setLoadError(failed ? failed.message : null);
    const blogItems: PendingItem[] = (blogRes.data || []).map((p: any) => ({ ...p, type: "blog" as const }));
    const campaignItems: PendingItem[] = (campaignRes.data || []).map((c: any) => ({ ...c, type: "campaign" as const }));
    setItems([...blogItems, ...campaignItems].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setLoading(false);
  };

  useEffect(() => { fetchPending(); }, []);

  const approve = async (item: PendingItem) => {
    setProcessing(item.id);
    const table = item.type === "blog" ? "blog_posts" : "campaigns";
    const updateData: Record<string, unknown> = { approval_status: "approved", approval_note: null };
    if (item.type === "blog") {
      // A post scheduled for later, or already live, keeps its date; anything else goes live now.
      const later = !!item.published_at && new Date(item.published_at) > new Date();
      const keepDate = later || (item.status === "published" && !!item.published_at);
      updateData.status = later ? "scheduled" : "published";
      updateData.published_at = keepDate ? item.published_at : new Date().toISOString();
    }
    const { error } = await adminDb().from(table).update(updateData).eq("id", item.id);
    if (error) {
      toast({ title: "Could not approve", description: error.message, variant: "destructive" });
      setProcessing(null);
      return;
    }
    if (item.type === "campaign") {
      const { data, error: sendErr } = await supabase.functions.invoke("send-campaign", { body: { campaignId: item.id } });
      if (sendErr) {
        toast({ title: "Approved, but the send failed", description: sendErr.message, variant: "destructive" });
      } else {
        toast({ title: "Campaign sent", description: `Delivered to ${data?.totalSent ?? 0} recipients.` });
      }
    } else {
      const later = !!item.published_at && new Date(item.published_at) > new Date();
      toast({ title: later ? "Scheduled" : "Published", description: later ? `"${item.title || "Untitled"}" goes live on ${new Date(item.published_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.` : `"${item.title || "Untitled"}" is live on The Bridge.` });
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setProcessing(null);
  };

  const reject = async (item: PendingItem, reason?: string) => {
    setProcessing(item.id);
    const table = item.type === "blog" ? "blog_posts" : "campaigns";
    const updateData: Record<string, unknown> = { approval_status: "rejected", approval_note: reason ?? null };
    if (item.type === "blog") updateData.status = "draft";
    const { error } = await adminDb().from(table).update(updateData).eq("id", item.id);
    if (error) {
      toast({ title: "Could not send it back", description: error.message, variant: "destructive" });
      setProcessing(null);
      return;
    }
    toast({ title: "Sent back", description: "The author will see your reason in the editor." });
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setProcessing(null);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <MuPageHeader
        title="Approvals"
        description="Approving publishes a story or sends a campaign, with no undo."
      />
      {loadError ? (
        <MuLoadError what="the queue" onRetry={() => { setLoading(true); fetchPending(); }} />
      ) : items.length === 0 ? (
        <MuSection padded={false}>
          <MuEmpty
            art={art.objClipboardChecks}
            title="Nothing to approve"
            description="Stories and campaigns other admins submit wait here."
          />
        </MuSection>
      ) : (
        <MuLedger>
          <MuGroupHead label="Waiting for approval" sentence={`${items.length} ${items.length === 1 ? "item" : "items"}, newest first.`} />
          <MuLedgerBody>
          {items.map((item) => {
            const busy = processing === item.id;
            const label = item.type === "blog" ? "story" : "campaign";
            return (
              <MuLedgerRow
                key={item.id}
                icon={item.type === "blog" ? FileText : Megaphone}
                title={
                  <Link
                    to={item.type === "blog" ? `/admin/posts/${item.id}` : `/admin/campaigns/${item.id}`}
                    className="hover:underline"
                  >
                    {item.title || "Untitled"}
                  </Link>
                }
                sentence={
                  <>
                    {item.created_by_name ? `By ${item.created_by_name}, ` : ""}
                    submitted {format(new Date(item.created_at), "dd MMM yyyy")}
                  </>
                }
                status={<MuStatus label={item.type === "blog" ? "Blog post" : "Campaign"} tone="info" />}
                trailing={
                  <>
                    <ConfirmAction
                      title={item.type === "blog" ? "Publish this story?" : "Send this campaign?"}
                      description={
                        item.type === "blog"
                          ? <p>"{item.title || "Untitled"}" goes live on The Bridge straight away.</p>
                          : <p>"{item.title || "Untitled"}" is sent to its whole audience now. A sent campaign cannot be recalled.</p>
                      }
                      confirmLabel={item.type === "blog" ? "Publish" : "Send now"}
                      onConfirm={() => approve(item)}
                      trigger={
                        <Button size="sm" disabled={busy}>
                          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                          Approve
                        </Button>
                      }
                    />
                    <ConfirmAction
                      title={`Send this ${label} back?`}
                      description={<p>The {label} returns to its author as a draft, with your reason.</p>}
                      confirmLabel="Send back"
                      destructive
                      reason={{ label: "Why it is going back", placeholder: "What needs to change before it can go out", required: true }}
                      onConfirm={(reason) => reject(item, reason)}
                      trigger={
                        <Button size="sm" variant="outline" disabled={busy}>
                          <X className="h-3 w-3 mr-1" />Send back
                        </Button>
                      }
                    />
                  </>
                }
              />
            );
          })}
          </MuLedgerBody>
        </MuLedger>
      )}
    </div>
  );
};

export default Approvals;
