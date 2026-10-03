import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // still used for excerpt
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X, ArrowLeft, Eye, Pencil, CalendarIcon, Plus, Bell } from "lucide-react";
import { TEMPLATE_META, TEMPLATE_MAP, PolaroidFrame } from "@/components/blog-templates";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";

const HERO_TEMPLATES = [
  { value: "default", label: "Default (Full-bleed)" },
  { value: "polaroid", label: "Polaroid (Side-by-side)" },
];

const DEFAULT_CATEGORIES = ["Healthcare", "Wellness", "Clinical Insights", "Company News", "Industry Updates"];

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const PostEditor = () => {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isSuperAdmin, requiresBlogApproval, adminDisplayName } = useAuth();
  

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [heroTemplate, setHeroTemplate] = useState("default");
  const [polaroidCaption, setPolaroidCaption] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("clean-editorial");
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
  const [bodyImages, setBodyImages] = useState<string[]>([]);
  const [bodyCaptions, setBodyCaptions] = useState<string[]>([]);
  const [status, setStatus] = useState("draft");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [notifying, setNotifying] = useState(false);
  const [subscribersNotified, setSubscribersNotified] = useState(false);
  const [dropCapEnabled, setDropCapEnabled] = useState(true);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveInFlightRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  const currentMeta = TEMPLATE_META.find((t) => t.value === bodyTemplate);
  const slotCount = currentMeta?.slots.length || 0;

  // Load existing categories from DB
  useEffect(() => {
    supabase
      .from("blog_posts")
      .select("category")
      .then(({ data }) => {
        if (data) {
          const dbCats = data.map((p: any) => p.category).filter(Boolean);
          setCategories((prev) => [...new Set([...prev, ...dbCats])]);
        }
      });
  }, []);

  useEffect(() => {
    if (!isNew && id) {
      supabase
        .from("blog_posts")
        .select("*")
        .eq("id", id)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            toast({ title: "Post not found", variant: "destructive" });
            navigate("/admin/posts");
            return;
          }
          setTitle(data.title);
          setSlug(data.slug);
          setExcerpt(data.excerpt);
          setContent(data.content);
          setAuthor(data.author);
          setCategory(data.category);
          if (data.category && !DEFAULT_CATEGORIES.includes(data.category)) {
            setCategories((prev) => [...new Set([...prev, data.category])]);
          }
          setHeroTemplate(data.hero_template);
          setPolaroidCaption(data.polaroid_caption || "");
          setBodyTemplate(data.body_template || "clean-editorial");
          setFeaturedImageUrl(data.featured_image_url);
          setBodyImages(Array.isArray(data.body_images) ? (data.body_images as string[]) : []);
          setBodyCaptions(Array.isArray((data as any).body_captions) ? ((data as any).body_captions as string[]) : []);
          setStatus(data.status);
          setSubscribersNotified((data as any).subscribers_notified || false);
          setDropCapEnabled((data as any).drop_cap_enabled !== false);
          if (data.status === "scheduled" && data.published_at) {
            const d = new Date(data.published_at);
            setScheduledDate(d);
            setScheduledTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
          }
          setLoading(false);
          initialLoadDoneRef.current = true;
        });
    } else {
      initialLoadDoneRef.current = true;
    }
  }, [id, isNew]);

  // Debounced autosave for existing posts only (skip while saving / before initial load)
  useEffect(() => {
    if (isNew || !id || !initialLoadDoneRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      if (saving || autoSaveInFlightRef.current) return;
      if (!title.trim() || !slug.trim()) return;
      autoSaveInFlightRef.current = true;
      try {
        const { error } = await supabase
          .from("blog_posts")
          .update({
            title, slug, excerpt, content, author, category,
            hero_template: heroTemplate,
            polaroid_caption: polaroidCaption,
            body_template: bodyTemplate,
            featured_image_url: featuredImageUrl,
            body_images: bodyImages,
            body_captions: bodyCaptions,
            drop_cap_enabled: dropCapEnabled,
            last_edited_by: user?.id,
            last_edited_by_name: adminDisplayName || user?.email || "",
          } as any)
          .eq("id", id);
        if (!error) setLastAutoSavedAt(new Date());
      } finally {
        autoSaveInFlightRef.current = false;
      }
    }, 2000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [isNew, id, title, slug, excerpt, content, author, category, heroTemplate, polaroidCaption, bodyTemplate, featuredImageUrl, bodyImages, bodyCaptions, dropCapEnabled, saving, user?.id, adminDisplayName, user?.email]);

  // Resize bodyImages/bodyCaptions when template changes
  useEffect(() => {
    const resize = (prev: string[]) => {
      if (prev.length < slotCount) return [...prev, ...Array(slotCount - prev.length).fill("")];
      if (prev.length > slotCount) return prev.slice(0, slotCount);
      return prev;
    };
    setBodyImages(resize);
    setBodyCaptions(resize);
  }, [bodyTemplate, slotCount]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (isNew) setSlug(slugify(val));
  };

  const uploadImage = async (file: File, prefix: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${prefix}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("blog-images").upload(path, file);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return null;
    }
    const { data } = supabase.storage.from("blog-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleFeaturedUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file, "featured");
    if (url) setFeaturedImageUrl(url);
    setUploading(false);
  };

  const handleSlotUpload = async (e: React.ChangeEvent<HTMLInputElement>, slotIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file, "body");
    if (url) {
      setBodyImages((prev) => {
        const next = [...prev];
        next[slotIndex] = url;
        return next;
      });
    }
    setUploading(false);
  };

  const removeSlotImage = (slotIndex: number) => {
    setBodyImages((prev) => { const next = [...prev]; next[slotIndex] = ""; return next; });
    setBodyCaptions((prev) => { const next = [...prev]; next[slotIndex] = ""; return next; });
  };

  const removeFeaturedImage = () => setFeaturedImageUrl(null);

  const updateCaption = (index: number, val: string) => {
    setBodyCaptions((prev) => { const next = [...prev]; next[index] = val; return next; });
  };

  const handleSave = async (publishStatus: string) => {
    if (!title.trim() || !slug.trim()) {
      toast({ title: "Title and slug are required", variant: "destructive" });
      return;
    }
    if (publishStatus === "scheduled" && !scheduledDate) {
      toast({ title: "Please pick a scheduled date", variant: "destructive" });
      return;
    }
    setSaving(true);

    let publishedAt: string | undefined;
    if (publishStatus === "published") {
      publishedAt = new Date().toISOString();
    } else if (publishStatus === "scheduled" && scheduledDate) {
      const [h, m] = scheduledTime.split(":").map(Number);
      const d = new Date(scheduledDate);
      d.setHours(h, m, 0, 0);
      if (d.getTime() <= Date.now()) {
        setSaving(false);
        toast({ title: "Schedule must be in the future", description: "Pick a date and time later than now.", variant: "destructive" });
        return;
      }
      publishedAt = d.toISOString();
    }


    const postData: any = {
      title, slug, excerpt, content, author, category,
      hero_template: heroTemplate,
      polaroid_caption: polaroidCaption,
      body_template: bodyTemplate,
      featured_image_url: featuredImageUrl,
      body_images: bodyImages,
      body_captions: bodyCaptions,
      drop_cap_enabled: dropCapEnabled,
      status: publishStatus,
      published_at: publishedAt ?? null,
      last_edited_by: user?.id,
      last_edited_by_name: adminDisplayName || user?.email || "",
    };

    // Attribution
    if (isNew) {
      postData.created_by = user?.id;
      postData.created_by_name = adminDisplayName || user?.email || "";
      postData.editors = [];
    }

    // Approval workflow: if user requires approval and trying to publish
    if (requiresBlogApproval && !isSuperAdmin && publishStatus === "published") {
      postData.status = "draft";
      postData.approval_status = "pending";
    }

    let error;
    if (isNew) {
      ({ error } = await supabase.from("blog_posts").insert(postData as any));
    } else {
      ({ error } = await supabase.from("blog_posts").update(postData as any).eq("id", id));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      const submittedForApproval = requiresBlogApproval && !isSuperAdmin && publishStatus === "published";
      toast({ title: submittedForApproval ? "Submitted for approval" : publishStatus === "published" ? "Published!" : publishStatus === "scheduled" ? "Scheduled!" : "Saved as draft" });
      navigate("/admin/posts");
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const BodyComponent = TEMPLATE_MAP[bodyTemplate] || TEMPLATE_MAP["clean-editorial"];

  // ─── Preview Mode (Read-only render — matches public BlogPost) ───
  if (showPreview) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>
            <Pencil className="h-4 w-4 mr-2" />Edit Form
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <Switch id="preview-dropcap" checked={dropCapEnabled} onCheckedChange={setDropCapEnabled} />
            <Label htmlFor="preview-dropcap" className="text-xs">Drop cap</Label>
          </div>
          {lastAutoSavedAt && (
            <span className="text-xs text-muted-foreground">
              Saved · {format(lastAutoSavedAt, "HH:mm")}
            </span>
          )}
        </div>

        <div className="overflow-hidden bg-background border rounded-lg">
          {/* Hero Preview — inline editable */}
          {heroTemplate === "polaroid" ? (
            <section className="bg-accent py-10 sm:py-14">
              <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 text-accent-foreground">
                  <span className="text-sm font-medium uppercase tracking-wider opacity-70">{category || "Category"}</span>
                  <h1
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleTitleChange(e.currentTarget.textContent || "")}
                    className="text-3xl font-bold font-serif mt-2 mb-3 outline-none focus:ring-2 focus:ring-primary/30 rounded px-1 -mx-1"
                  >{title || "Post Title"}</h1>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setExcerpt(e.currentTarget.textContent || "")}
                    className="opacity-80 outline-none focus:ring-2 focus:ring-primary/30 rounded px-1 -mx-1"
                  >{excerpt || "Excerpt will appear here..."}</p>
                  <p className="mt-3 text-sm opacity-60">
                    By{" "}
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => setAuthor(e.currentTarget.textContent || "")}
                      className="outline-none focus:ring-2 focus:ring-primary/30 rounded px-1"
                    >{author || "Author"}</span>
                  </p>
                </div>
                <div className="flex-shrink-0 w-56 md:w-[35%]">
                  {featuredImageUrl ? (
                    <PolaroidFrame src={featuredImageUrl} caption={polaroidCaption || undefined} rotation={-3} variant="tape" className="w-full" />
                  ) : (
                    <div className="aspect-square bg-muted/30 rounded flex items-center justify-center text-xs text-muted-foreground">No featured image</div>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <section className="relative h-[320px] flex items-end overflow-hidden">
              {featuredImageUrl && (
                <img loading="lazy" decoding="async" src={featuredImageUrl} alt={title} className="absolute inset-0 w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/30 to-transparent" />
              <div className="relative z-10 max-w-3xl mx-auto px-4 pb-8 w-full">
                <span className="text-sm font-medium uppercase tracking-wider text-background/70">{category || "Category"}</span>
                <h1
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleTitleChange(e.currentTarget.textContent || "")}
                  className="text-2xl sm:text-3xl font-bold font-serif text-background mt-1 mb-2 outline-none focus:ring-2 focus:ring-background/40 rounded px-1 -mx-1"
                >{title || "Post Title"}</h1>
                <p className="text-background/80 text-sm">
                  By{" "}
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setAuthor(e.currentTarget.textContent || "")}
                    className="outline-none focus:ring-2 focus:ring-background/40 rounded px-1"
                  >{author || "Author"}</span>
                </p>
              </div>
            </section>
          )}

          {/* Body — read-only render using shared TEMPLATE_MAP */}
          <div className="bg-background">
            <BodyComponent content={content} bodyImages={bodyImages} bodyCaptions={bodyCaptions} dropCapEnabled={dropCapEnabled} />
          </div>

          {/* Inline body editor — edits flow straight into the preview above */}
          <div className="border-t border-border bg-muted/20 p-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Edit body</Label>
            <RichTextEditor value={content} onChange={setContent} minHeight="300px" />
          </div>
        </div>


        {/* Schedule + Actions */}
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Schedule</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-[180px] justify-start text-left font-normal", !scheduledDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="w-[120px] h-9" />
                {scheduledDate && (
                  <Button variant="ghost" size="sm" onClick={() => setScheduledDate(undefined)} className="text-muted-foreground">Clear</Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => handleSave("draft")} variant="outline" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save Draft
            </Button>
            {requiresBlogApproval && !isSuperAdmin ? (
              <Button onClick={() => handleSave("published")} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Submit for Approval
              </Button>
            ) : scheduledDate && scheduledDate > new Date() ? (
              <Button onClick={() => handleSave("scheduled")} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Schedule
              </Button>
            ) : (
              <Button onClick={() => handleSave("published")} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Publish Now
              </Button>
            )}
            {!isNew && status === "published" && (
              <Button
                variant="outline"
                disabled={notifying || subscribersNotified}
                className="gap-2"
                onClick={async () => {
                  setNotifying(true);
                  try {
                    const { error } = await supabase.functions.invoke("notify-new-post", { body: { post_id: id } });
                    if (error) throw error;
                    setSubscribersNotified(true);
                    toast({ title: "Subscribers notified!", description: "Email sent to all newsletter subscribers." });
                  } catch (err: any) {
                    toast({ title: "Failed to notify", description: err.message, variant: "destructive" });
                  } finally {
                    setNotifying(false);
                  }
                }}
              >
                {notifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                {subscribersNotified ? "Subscribers Notified" : "Notify Subscribers"}
              </Button>
            )}
          </div>
        </div>

      </div>
    );
  }




  // ─── Editor Mode ───
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" asChild><Link to="/admin/posts"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-2xl font-bold font-serif flex-1">{isNew ? "New Post" : "Edit Post"}</h1>
        <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
          <Eye className="h-4 w-4 mr-2" />Preview
        </Button>
      </div>

      <div className="space-y-6">
        {/* Title & Slug */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => handleTitleChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
        </div>

        {/* Author & Category */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Author</Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex gap-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {addingCategory ? (
                <div className="flex gap-1">
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="New category"
                    className="w-36"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newCategory.trim()) {
                        const trimmed = newCategory.trim();
                        if (!categories.includes(trimmed)) setCategories((prev) => [...prev, trimmed]);
                        setCategory(trimmed);
                        setNewCategory("");
                        setAddingCategory(false);
                      }
                      if (e.key === "Escape") { setAddingCategory(false); setNewCategory(""); }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (newCategory.trim()) {
                        const trimmed = newCategory.trim();
                        if (!categories.includes(trimmed)) setCategories((prev) => [...prev, trimmed]);
                        setCategory(trimmed);
                      }
                      setNewCategory("");
                      setAddingCategory(false);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="icon" onClick={() => setAddingCategory(true)} title="Add category">
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Excerpt */}
        <div className="space-y-2">
          <Label>Excerpt</Label>
          <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} />
        </div>

        {/* Featured Image */}
        <div className="space-y-2">
          <Label>Featured Image</Label>
          {featuredImageUrl ? (
            <div className="relative max-w-xs">
              <img loading="lazy" decoding="async" src={featuredImageUrl} alt="Featured" className="h-40 w-full rounded-lg object-cover" />
              <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={removeFeaturedImage}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <label className="flex items-center gap-2 cursor-pointer border rounded-lg p-4 hover:bg-muted/50 transition-colors max-w-xs">
              <Upload className="h-4 w-4" />
              <span className="text-sm">{uploading ? "Uploading..." : "Upload image"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFeaturedUpload} disabled={uploading} />
            </label>
          )}
        </div>

        {/* Hero Template */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Hero Template</Label>
            <Select value={heroTemplate} onValueChange={setHeroTemplate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HERO_TEMPLATES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {heroTemplate === "polaroid" && (
            <div className="space-y-2">
              <Label>Polaroid Caption</Label>
              <Input value={polaroidCaption} onChange={(e) => setPolaroidCaption(e.target.value)} placeholder="e.g. Our first day!" />
            </div>
          )}
        </div>

        {/* Body Template */}
        <div className="space-y-2">
          <Label>Body Template</Label>
          <Select value={bodyTemplate} onValueChange={setBodyTemplate}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TEMPLATE_META.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Drop Cap Toggle */}
        <div className="flex items-center gap-3">
          <Switch id="drop-cap" checked={dropCapEnabled} onCheckedChange={setDropCapEnabled} />
          <Label htmlFor="drop-cap" className="text-sm">Drop cap on first paragraph</Label>
        </div>



        {/* Body Image Slots + Captions */}
        {currentMeta && (
          <div className="space-y-3">
            <Label>Body Images ({currentMeta.label})</Label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {currentMeta.slots.map((slotName, i) => (
                <div key={`${bodyTemplate}-${i}`} className="space-y-1">
                  <span className="text-xs text-muted-foreground">{slotName}</span>
                  {bodyImages[i] ? (
                    <div className="relative">
                      <img loading="lazy" decoding="async" src={bodyImages[i]} alt={slotName} className="h-24 w-full rounded object-cover" />
                      <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5" onClick={() => removeSlotImage(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center h-24 border border-dashed rounded cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleSlotUpload(e, i)} disabled={uploading} />
                    </label>
                  )}
                  <Input
                    placeholder="Caption (optional)"
                    value={bodyCaptions[i] || ""}
                    onChange={(e) => updateCaption(i, e.target.value)}
                    className="text-xs h-7"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Editor */}
        <div className="space-y-2">
          <Label>Content</Label>
          <RichTextEditor value={content} onChange={setContent} />
        </div>

        {/* Schedule */}
        <div className="space-y-2">
          <Label>Schedule Publish</Label>
          <div className="flex flex-wrap items-end gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !scheduledDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={setScheduledDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-[130px]"
            />
            {scheduledDate && (
              <Button variant="ghost" size="sm" onClick={() => setScheduledDate(undefined)} className="text-muted-foreground">
                Clear
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Leave empty to publish immediately, or pick a future date/time to schedule.</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <Button onClick={() => handleSave("draft")} variant="outline" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save Draft
          </Button>
          {requiresBlogApproval && !isSuperAdmin ? (
            <Button onClick={() => handleSave("published")} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Submit for Approval
            </Button>
          ) : scheduledDate && scheduledDate > new Date() ? (
            <Button onClick={() => handleSave("scheduled")} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Schedule
            </Button>
          ) : (
            <Button onClick={() => handleSave("published")} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Publish Now
            </Button>
          )}
          {!isNew && status === "published" && (
            <Button
              variant="outline"
              disabled={notifying || subscribersNotified}
              className="gap-2"
              onClick={async () => {
                setNotifying(true);
                try {
                  const { error } = await supabase.functions.invoke("notify-new-post", {
                    body: { post_id: id },
                  });
                  if (error) throw error;
                  setSubscribersNotified(true);
                  toast({ title: "Subscribers notified!", description: "Email sent to all newsletter subscribers." });
                } catch (err: any) {
                  toast({ title: "Failed to notify", description: err.message, variant: "destructive" });
                } finally {
                  setNotifying(false);
                }
              }}
            >
              {notifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              {subscribersNotified ? "Subscribers Notified" : "Notify Subscribers"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostEditor;
