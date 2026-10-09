import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // still used for excerpt
import { SelectField } from "@/components/field";
import { MuNote, MuPageHeader, MuSection, MuToolbar } from "@/components/admin/mu/MuShell";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X, Eye, Pencil, CalendarIcon, Plus, Bell } from "lucide-react";
import { TEMPLATE_META, TEMPLATE_MAP, PolaroidFrame } from "@/components/blog-templates";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";

const HERO_TEMPLATES = [
  { value: "default", label: "Default (full bleed)" },
  { value: "polaroid", label: "Polaroid (side by side)" },
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
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);
  const [approvalNote, setApprovalNote] = useState<string | null>(null);
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
          setApprovalStatus((data as any).approval_status ?? null);
          setApprovalNote((data as any).approval_note ?? null);
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

  // Autosave only ever touches a draft that is not waiting on approval. A live
  // or scheduled story changes when the editor presses Update, not while they
  // are mid-sentence; a submitted story stays as the approver saw it.
  const autosaveOn = !isNew && status === "draft" && approvalStatus !== "pending";

  // Debounced autosave for existing posts only (skip while saving / before initial load)
  useEffect(() => {
    if (!autosaveOn || !id || !initialLoadDoneRef.current) return;
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
  }, [autosaveOn, id, title, slug, excerpt, content, author, category, heroTemplate, polaroidCaption, bodyTemplate, featuredImageUrl, bodyImages, bodyCaptions, dropCapEnabled, saving, user?.id, adminDisplayName, user?.email]);

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
    // The database applies the same rule, so this only keeps the screen honest.
    const goingLive = publishStatus === "published" || publishStatus === "scheduled";
    if (requiresBlogApproval && !isSuperAdmin && goingLive) {
      postData.status = "draft";
      postData.approval_status = "pending";
      postData.approval_note = null;
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
      const submittedForApproval = requiresBlogApproval && !isSuperAdmin && goingLive;
      toast({ title: submittedForApproval ? "Submitted for approval" : publishStatus === "published" ? "Published" : publishStatus === "scheduled" ? "Scheduled" : "Saved as draft" });
      navigate("/admin/posts");
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const BodyComponent = TEMPLATE_MAP[bodyTemplate] || TEMPLATE_MAP["clean-editorial"];

  // ─── Preview Mode (Read-only render — matches public BlogPost) ───
  if (showPreview) {
    return (
      <div>
        <div className="mb-4">
        <MuToolbar>
          <Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>
            <Pencil className="h-4 w-4 mr-2" />Edit form
          </Button>
          <div className="flex items-center gap-2 lg:ml-auto">
            <Switch id="preview-dropcap" checked={dropCapEnabled} onCheckedChange={setDropCapEnabled} />
            <Label htmlFor="preview-dropcap" className="text-xs">Drop cap</Label>
          </div>
          {autosaveOn && lastAutoSavedAt && (
            <span className="text-xs text-muted-foreground">
              Saved {format(lastAutoSavedAt, "HH:mm")}
            </span>
          )}
          {!isNew && !autosaveOn && (
            <span className="text-xs text-muted-foreground">
              {approvalStatus === "pending" ? "Waiting for approval, autosave is off" : "Live story, changes go out when you press Update"}
            </span>
          )}
        </MuToolbar>
        </div>

        <div className="overflow-hidden border border-line bg-background">
          {/* Hero preview, editable inline */}
          {heroTemplate === "polaroid" ? (
            <section className="bg-accent py-10 sm:py-14">
              <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 text-accent-foreground">
                  <span className="text-sm font-medium uppercase tracking-wider opacity-70">{category || "Category"}</span>
                  <h1
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleTitleChange(e.currentTarget.textContent || "")}
                    className="text-3xl font-bold font-serif mt-2 mb-3 outline-none focus:ring-2 focus:ring-primary/30 px-1 -mx-1"
                  >{title || "Post title"}</h1>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setExcerpt(e.currentTarget.textContent || "")}
                    className="opacity-80 outline-none focus:ring-2 focus:ring-primary/30 px-1 -mx-1"
                  >{excerpt || "Excerpt will appear here..."}</p>
                  <p className="mt-3 text-sm opacity-60">
                    By{" "}
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => setAuthor(e.currentTarget.textContent || "")}
                      className="outline-none focus:ring-2 focus:ring-primary/30 px-1"
                    >{author || "Author"}</span>
                  </p>
                </div>
                <div className="flex-shrink-0 w-56 md:w-[35%]">
                  {featuredImageUrl ? (
                    <PolaroidFrame src={featuredImageUrl} caption={polaroidCaption || undefined} rotation={-3} variant="tape" className="w-full" />
                  ) : (
                    <div className="aspect-square bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">No featured image</div>
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
                  className="text-2xl sm:text-3xl font-bold font-serif text-background mt-1 mb-2 outline-none focus:ring-2 focus:ring-background/40 px-1 -mx-1"
                >{title || "Post title"}</h1>
                <p className="text-background/80 text-sm">
                  By{" "}
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setAuthor(e.currentTarget.textContent || "")}
                    className="outline-none focus:ring-2 focus:ring-background/40 px-1"
                  >{author || "Author"}</span>
                </p>
              </div>
            </section>
          )}

          {/* Body, a read-only render using shared TEMPLATE_MAP */}
          <div className="bg-background">
            <BodyComponent content={content} bodyImages={bodyImages} bodyCaptions={bodyCaptions} dropCapEnabled={dropCapEnabled} />
          </div>

          {/* Inline body editor: edits flow straight into the preview above */}
          <div className="border-t border-border bg-muted/20 p-4">
            <Label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-label">Edit body</Label>
            <RichTextEditor value={content} onChange={setContent} minHeight="300px" />
          </div>
        </div>


        {/* Schedule + Actions */}
        <div className="mt-4 space-y-3 border-2 border-navy bg-tint/40 p-3">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-label">Publishing</p>
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
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save draft
            </Button>
            {requiresBlogApproval && !isSuperAdmin ? (
              <Button onClick={() => handleSave("published")} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Submit for approval
              </Button>
            ) : scheduledDate && scheduledDate > new Date() ? (
              <Button onClick={() => handleSave("scheduled")} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Schedule
              </Button>
            ) : (
              <Button onClick={() => handleSave("published")} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Publish now
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
                    toast({ title: "Subscribers notified", description: "Email sent to all newsletter subscribers." });
                  } catch (err: any) {
                    toast({ title: "Failed to notify", description: err.message, variant: "destructive" });
                  } finally {
                    setNotifying(false);
                  }
                }}
              >
                {notifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                {subscribersNotified ? "Subscribers notified" : "Notify subscribers"}
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
      <div className="mb-6">
        <MuPageHeader
          title={isNew ? "New post" : "Edit post"}
          backTo="/admin/posts"
          backLabel="Blog posts"
          actions={
            <Button variant="outline" onClick={() => setShowPreview(true)}>
              <Eye className="h-4 w-4 mr-2" />Preview
            </Button>
          }
        />
      </div>

      <div className="space-y-6">
        {approvalStatus === "rejected" && (
          <MuNote title="Sent back by the approver" tone="warning">
            {approvalNote || "No reason was given."}
          </MuNote>
        )}
        {approvalStatus === "pending" && (
          <MuNote title="Waiting for approval">
            Saving again replaces the version the approver sees.
          </MuNote>
        )}
        <MuSection title="Details">
        <div className="space-y-4">
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
              <SelectField
                label="Category"
                hideLabel
                value={category}
                onChange={(v) => { if (v) setCategory(v); }}
                placeholder="Choose a category"
                options={categories.map((c) => ({ value: c, label: c }))}
                className="flex-1"
              />
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
                    aria-label="Add category"
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
                <Button variant="outline" size="icon" onClick={() => setAddingCategory(true)} title="Add category" aria-label="Add category">
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
        </div>
        </MuSection>

        <MuSection title="Images and layout">
        <div className="space-y-4">

        {/* Featured Image */}
        <div className="space-y-2">
          <Label>Featured image</Label>
          {featuredImageUrl ? (
            <div className="relative max-w-xs">
              <img loading="lazy" decoding="async" src={featuredImageUrl} alt="Featured" className="h-40 w-full object-cover" />
              <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" aria-label="Remove image" onClick={removeFeaturedImage}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <label className="flex max-w-xs cursor-pointer items-center gap-2 border border-dashed border-line p-4 transition-colors hover:bg-muted/50">
              <Upload className="h-4 w-4" />
              <span className="text-sm">{uploading ? "Uploading" : "Upload image"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFeaturedUpload} disabled={uploading} />
            </label>
          )}
        </div>

        {/* Hero Template */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <SelectField
              label="Hero template"
              value={heroTemplate}
              onChange={(v) => { if (v) setHeroTemplate(v); }}
              options={HERO_TEMPLATES.map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>
          {heroTemplate === "polaroid" && (
            <div className="space-y-2">
              <Label>Polaroid caption</Label>
              <Input value={polaroidCaption} onChange={(e) => setPolaroidCaption(e.target.value)} placeholder="For example, our first day" />
            </div>
          )}
        </div>

        {/* Body Template */}
        <SelectField
          label="Body template"
          value={bodyTemplate}
          onChange={(v) => { if (v) setBodyTemplate(v); }}
          options={TEMPLATE_META.map((t) => ({ value: t.value, label: t.label }))}
        />

        {/* Drop Cap Toggle */}
        <div className="flex items-center gap-3">
          <Switch id="drop-cap" checked={dropCapEnabled} onCheckedChange={setDropCapEnabled} />
          <Label htmlFor="drop-cap" className="text-sm">Drop cap on first paragraph</Label>
        </div>



        {/* Body Image Slots + Captions */}
        {currentMeta && (
          <div className="space-y-3">
            <Label>Body images ({currentMeta.label})</Label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {currentMeta.slots.map((slotName, i) => (
                <div key={`${bodyTemplate}-${i}`} className="space-y-1">
                  <span className="text-xs text-muted-foreground">{slotName}</span>
                  {bodyImages[i] ? (
                    <div className="relative">
                      <img loading="lazy" decoding="async" src={bodyImages[i]} alt={slotName} className="h-24 w-full object-cover" />
                      <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5" aria-label="Remove image" onClick={() => removeSlotImage(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex h-24 cursor-pointer items-center justify-center border border-dashed border-line transition-colors hover:bg-muted/50" aria-label={`Upload ${slotName}`}>
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

        </div>
        </MuSection>

        {/* Content Editor */}
        <MuSection title="Content">
          <RichTextEditor value={content} onChange={setContent} />
        </MuSection>

        <MuSection title="Publishing">
        <div className="space-y-4">

        {/* Schedule */}
        <div className="space-y-2">
          <Label>Schedule</Label>
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
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <Button onClick={() => handleSave("draft")} variant="outline" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save draft
          </Button>
          {requiresBlogApproval && !isSuperAdmin ? (
            <Button onClick={() => handleSave("published")} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Submit for approval
            </Button>
          ) : scheduledDate && scheduledDate > new Date() ? (
            <Button onClick={() => handleSave("scheduled")} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Schedule
            </Button>
          ) : (
            <Button onClick={() => handleSave("published")} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Publish now
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
                  toast({ title: "Subscribers notified", description: "Email sent to all newsletter subscribers." });
                } catch (err: any) {
                  toast({ title: "Failed to notify", description: err.message, variant: "destructive" });
                } finally {
                  setNotifying(false);
                }
              }}
            >
              {notifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              {subscribersNotified ? "Subscribers notified" : "Notify subscribers"}
            </Button>
          )}
        </div>
        </div>
        </MuSection>
      </div>
    </div>
  );
};

export default PostEditor;
