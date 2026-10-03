import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminDb } from "@/lib/admin-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, Archive, ArchiveRestore } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Post {
  id: string;
  title: string;
  slug: string;
  status: string;
  category: string;
  created_at: string;
  archived: boolean;
  author: string | null;
  created_by_name: string | null;
  approval_status: string | null;
}

const PostsList = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const { toast } = useToast();

  const fetchPosts = async () => {
    const { data, error } = await adminDb()
      .from("blog_posts")
      .select("id, title, slug, status, category, created_at, archived, author, created_by_name, approval_status")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setPosts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleDelete = async (id: string) => {
    const { error } = await adminDb().from("blog_posts").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setPosts((p) => p.filter((post) => post.id !== id));
      toast({ title: "Post deleted" });
    }
  };

  const handleArchive = async (id: string, archive: boolean) => {
    const { error } = await adminDb().from("blog_posts").update({ archived: archive } as any).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setPosts((p) => p.map((post) => post.id === id ? { ...post, archived: archive } : post));
      toast({ title: archive ? "Post archived" : "Post restored" });
    }
  };

  const filteredPosts = posts.filter((p) => showArchived ? p.archived : !p.archived);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-serif">Blog posts</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
            <Label htmlFor="show-archived" className="text-sm text-muted-foreground">Archived</Label>
          </div>
          <Button asChild><Link to="/admin/posts/new"><Plus className="mr-2 h-4 w-4" />New post</Link></Button>
        </div>
      </div>
      {filteredPosts.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          {showArchived ? "No archived posts." : "No posts yet. Create your first one!"}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredPosts.map((post) => (
            <div key={post.id} className="flex items-center justify-between gap-3 p-4 border rounded-lg bg-card">
              <div className="min-w-0">
                <h3 className="font-medium">{post.title}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant={post.status === "published" ? "default" : "secondary"}>{post.status}</Badge>
                  {post.category && <Badge variant="outline">{post.category}</Badge>}
                  {post.archived && <Badge variant="secondary" className="text-xs">Archived</Badge>}
                  {post.approval_status === "pending" && <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">Pending Approval</Badge>}
                  {post.approval_status === "rejected" && <Badge variant="outline" className="text-xs border-destructive text-destructive">Rejected</Badge>}
                  {post.author && (
                    <span className="text-xs text-foreground/80">
                      Byline: <span className="font-medium">{post.author}</span>
                    </span>
                  )}
                </div>
                {post.created_by_name && (
                  <p className="text-[11px] text-muted-foreground mt-1">Created by {post.created_by_name}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="ghost" size="icon" asChild className="h-11 w-11">
                  <Link to={`/admin/posts/${post.id}`}><Pencil className="h-4 w-4" /></Link>
                </Button>
                <div className="hidden md:flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleArchive(post.id, !post.archived)}
                    title={post.archived ? "Restore" : "Archive"}
                  >
                    {post.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone. The post will be permanently deleted.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(post.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PostsList;
